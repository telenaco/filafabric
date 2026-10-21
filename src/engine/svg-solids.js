import { interpretDrawing } from './drawing.js';
import { solidKind, solidLayer, SOLID_OVERLAP } from './solid-fill.js';
import { PolygonBoundary } from './boundary.js';
import { clipStrands, analyzeFabric } from './fabric.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';
import { headerNotes } from './brim.js';
import { MAX_MOVES } from './tiler.js';
import { ConfigError } from './params.js';

/**
 * Green shapes of a drawing print solid, after the pattern and on top of it: the pattern is made as usual, over the
 * whole swatch, and then each green shape is filled (a coil if it is round, a zigzag otherwise, neighbouring passes
 * overlapping by 20%) in SOLID_LAYERS layers, the first one layer above the highest strand already printed under the
 * shape. So a green circle is a solid disc lying on the fabric, joined to it wherever the fabric reaches up to it.
 */

export const SOLID_LAYERS = 2;

/** A design whose own strands stand up off the bed (loops, pillars, a spacer): its heights are kept as they are. */
export const hasNativeHeight = (result) => !!(result.placements?.length || result.spacer || result.pillarWeave);

/** The green shapes of a drawing placed at width x height mm, in the coordinates of a window starting at offset. */
export function vectorSolids(vector, width = vector.width, height = vector.height, offsetX = 0, offsetY = 0) {
  const move = (ring) => ring.map((p) => ({ x: p.x - offsetX, y: p.y - offsetY }));
  return interpretDrawing(vector, { scaleX: width / vector.width, scaleY: height / vector.height }).solids
    .map((s) => ({ ...s, ring: move(s.ring), holes: (s.holes ?? []).map(move), edged: s.edged ?? [] }));
}

function nearRing(p, ring, d) {
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-20, dx * dx + dy * dy)));
    if (Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < d) return true;
  }
  return false;
}

function inside(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/**
 * The highest point printed over the shape (or within `margin` of its edge), 0 when nothing is. Nothing in its holes
 * counts, nor anything within `holeMargin` of a hole's edge: a window's own rim and the pattern's ends lie on that edge.
 */
export function topOver(strands, ring, margin = 0, holes = [], holeMargin = 0) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  minX -= margin; minY -= margin; maxX += margin; maxY += margin;
  let top = 0;
  for (const s of strands) {
    for (const p of s.pts) {
      if (p.z <= top || p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      if (inside(p.x, p.y, ring) && !holes.some((h) => inside(p.x, p.y, h) || (holeMargin > 0 && nearRing(p, h, holeMargin)))) top = p.z;
    }
  }
  return top;
}

/** The solid fill strands of every shape: layer by layer, so each layer of every shape is down before the next. */
export function solidStrands(solids, under, { bead = 0.45, layerHeight = 0.2, layers = SOLID_LAYERS, overlap = SOLID_OVERLAP } = {}) {
  // a shape may come with the height already measured under it (a panel measures it as it prints)
  // a lace's pattern lies in its red windows, which are holes in the solid: the solid sits on whatever is under itself
  const shapes = solids.map((s) => ({ ...s, holes: s.holes ?? [], kind: solidKind(s.ring, s.holes ?? []), top: s.top ?? topOver(under, s.ring, 0, s.holes ?? [], bead) }));
  const out = [];
  for (let k = 0; k < layers; k++) {
    shapes.forEach((s, i) => {
      const z = s.top + (k + 1) * layerHeight;
      for (const pts of solidLayer(s.ring, { bead, overlap, layer: k, kind: s.kind, holes: s.holes, edged: s.edged ?? [] })) {
        out.push({ id: `solid-${i + 1}-${k + 1}-${out.length + 1}`, name: 'Solid shape', solid: s.kind, solidLayer: k, fixed: true, ground: s.top === 0,
          kind: s.top === 0 && k === 0 ? 'base' : 'supported', pts: pts.map((p) => ({ x: p.x, y: p.y, z })) });
      }
    });
  }
  return { strands: out, shapes };
}

/**
 * Adds the green shapes of `vector` to a finished result, printed last. `fullWidth` x `fullHeight` is the size the
 * drawing is placed at and `offsetX`, `offsetY` where this result's swatch lies in it (a preview window or a section).
 * The moves already planned are kept exactly; the fill follows them after a lift clear of everything printed.
 */
export function applySvgSolids(result, vector, { fullWidth = vector.width, fullHeight = vector.height, offsetX = 0, offsetY = 0 } = {}) {
  const solids = vectorSolids(vector, fullWidth, fullHeight, offsetX, offsetY);
  if (!solids.length) return result;
  const { cfg } = result, h = cfg.t.layer_height, bead = cfg.t.extrusion_width;
  const W = cfg.t.sample_width, H = cfg.t.sample_height;
  const body = result.strands ?? [];
  const { strands: fill, shapes } = solidStrands(solids, body, { bead, layerHeight: h });
  const swatch = new PolygonBoundary([[{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]]);
  const added = clipStrands(fill, swatch, 0);
  if (!added.length) return result;
  const retraction = cfg.derived.retraction;
  const ground = added.filter((st) => st.ground), raised = added.filter((st) => !st.ground);
  let moves = result.moves ?? [];
  // a solid lying on the bed (a lace's body) prints before the pattern, right after the drawing's own lines (the edges of
  // its windows, on the same first layer): the pattern then lies against it, and the nozzle never comes down beside
  // strands already printed higher up. A flat result's moves are its strands emitted in order, so they split there.
  const lead = hasNativeHeight(result) ? 0 : Math.max(0, body.findIndex((st) => st.name !== 'Imported SVG lines'));
  const split = lead ? emitStrands(body.slice(0, lead), { retraction }).length : 0;
  if (ground.length) moves = joinMoves(joinMoves(moves.slice(0, split), emitStrands(ground, { retraction }), retraction), moves.slice(split), retraction);
  // a solid on top of the pattern (a button on a garment) prints last, once everything under it is down
  if (raised.length) {
    // (a loop, not Math.max(...): a full-size print has far more moves than a call can take arguments)
    let printedTop = 0;
    for (const m of moves) if (m.z > printedTop) printedTop = m.z;
    for (const st of raised) for (const p of st.pts) if (p.z > printedTop) printedTop = p.z;
    const safeZ = printedTop + 3;
    moves = joinMoves(moves, emitStrands(raised, { retraction, startLift: safeZ - raised[0].pts[0].z, travelLift: 3 }), retraction, safeZ);
  }
  if (moves.length > MAX_MOVES) throw new ConfigError([`The solid shapes would take the print past ${MAX_MOVES.toLocaleString('en')} moves. Use fewer or smaller green shapes, or a smaller swatch.`]);
  const strands = [...body.slice(0, lead), ...ground, ...body.slice(lead), ...raised];
  const stats = { ...result.stats, ...computeStats(moves, cfg, result.placements ?? []), loops: result.stats.loops };
  // the piece's outline: the pattern's, unless solids lie outside it (a lace's green body round its red windows)
  const piece = pieceRings(result.outline ?? swatch.rings, shapes.map((sh) => sh.ring));
  const boundary = new PolygonBoundary(piece);
  const fabric = analyzeFabric(strands, { strandWidth: bead, layerHeight: h, boundary });
  const warnings = [...(result.warnings ?? []).filter((w) => !(result.fabric?.issues ?? []).includes(w)), ...fabric.issues];
  const coils = shapes.filter((s) => s.kind === 'coil').length;
  const solid = { count: shapes.length, coils, zigzags: shapes.length - coils, layers: SOLID_LAYERS, overlap: SOLID_OVERLAP };
  return {
    ...result, strands, moves, stats, fabric, warnings, solid, pieceOutline: piece,
    ...(result.report ? { report: { ...result.report, components: fabric.components } } : {}),
    gcode: writeGcode(moves, cfg, { stats, comments: [...headerNotes(result), `Solid shapes: ${shapes.length} green (${coils} coiled, ${shapes.length - coils} zigzag), ${SOLID_LAYERS} layers on top of the pattern, ${Math.round(SOLID_OVERLAP * 100)}% overlap`] }),
  };
}

/**
 * A drawing with green shapes and nothing red to fill (a lace drawn as a green outline with blue openings): it prints as
 * its solids alone, with the drawing's lines, and no pattern anywhere.
 */
export function solidOnly(vector) {
  if (!vector) return false;
  const model = interpretDrawing(vector);
  return model.solids.length > 0 && model.rings.length === 0;
}

/** The result with its pattern taken out; the drawing's lines and solids are added to it as usual. */
export function withoutPattern(result) {
  return { ...result, strands: [], moves: [], placements: [], warnings: [] };
}

const ringInside = (a, b) => inside(a[0].x, a[0].y, b) && inside(a[Math.floor(a.length / 2)].x, a[Math.floor(a.length / 2)].y, b);

/**
 * The outline of the whole piece for checking it. The pattern's own outline while every solid lies on it (a button on a
 * garment). A solid round the pattern's outline (a lace's green body round its red windows) makes the outermost solids
 * the outline, with whatever of the pattern's outline lies outside them. A solid in a hole of the outline (a green disc
 * in a blue cut-out) is added to it: the rings read inside and out in turn, so the disc counts and the hole round it not.
 */
export function pieceRings(outlineRings, solidRings) {
  const region = new PolygonBoundary(outlineRings);
  const loose = solidRings.filter((s) => !(region.contains(s[0].x, s[0].y) && region.contains(s[Math.floor(s.length / 2)].x, s[Math.floor(s.length / 2)].y)));
  if (!loose.length) return outlineRings;
  const around = loose.filter((s) => outlineRings.some((o) => ringInside(o, s)));
  let rings = outlineRings;
  if (around.length) {
    const outer = around.filter((s) => !around.some((t) => t !== s && ringInside(s, t)));
    rings = [...outer, ...outlineRings.filter((o) => !outer.some((s) => ringInside(o, s)))];
  }
  return [...rings, ...loose.filter((s) => !around.includes(s))];
}

/** `before` then `after`, joined by a lift clear of everything printed (and a balanced retraction for a long move). */
function joinMoves(before, after, retraction, safeZ = null) {
  if (!before.length) return after;
  if (!after.length) return before;
  const last = before.at(-1), first = after[0];
  let top = safeZ;
  if (top === null) {
    top = first.z;
    for (const m of before) if (m.z > top) top = m.z;
    top += 3;
  }
  const lift = { x: last.x, y: last.y, z: top, cls: 'travel', extrude: false };
  const rest = [...after];
  const k = rest.findIndex((m) => m.extrude), startup = k >= 0 ? rest.slice(0, k + 1) : [];
  if (k >= 0 && retraction?.length > 0 && Math.hypot(first.x - last.x, first.y - last.y) >= retraction.minTravel && !startup.some((m) => m.retract === 'retract')) {
    lift.retract = 'retract';
    if (!startup.some((m) => m.retract === 'unretract')) rest[k] = { ...rest[k], retract: 'unretract' };
  }
  return [...before, lift, { x: first.x, y: first.y, z: top, cls: 'travel', extrude: false }, ...rest];
}
