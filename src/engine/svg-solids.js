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
  return interpretDrawing(vector, { scaleX: width / vector.width, scaleY: height / vector.height }).solids
    .map((s) => ({ ...s, ring: s.ring.map((p) => ({ x: p.x - offsetX, y: p.y - offsetY })) }));
}

function inside(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** The highest point printed over the shape (or within a strand width of its edge), 0 when nothing is. */
export function topOver(strands, ring, margin = 0) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  minX -= margin; minY -= margin; maxX += margin; maxY += margin;
  let top = 0;
  for (const s of strands) {
    for (const p of s.pts) {
      if (p.z <= top || p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      if (inside(p.x, p.y, ring)) top = p.z;
    }
  }
  return top;
}

/** The solid fill strands of every shape: layer by layer, so each layer of every shape is down before the next. */
export function solidStrands(solids, under, { bead = 0.45, layerHeight = 0.2, layers = SOLID_LAYERS, overlap = SOLID_OVERLAP } = {}) {
  // a shape may come with the height already measured under it (a panel measures it as it prints)
  const shapes = solids.map((s) => ({ ...s, kind: solidKind(s.ring), top: s.top ?? topOver(under, s.ring) }));
  const out = [];
  for (let k = 0; k < layers; k++) {
    shapes.forEach((s, i) => {
      const z = s.top + (k + 1) * layerHeight;
      for (const pts of solidLayer(s.ring, { bead, overlap, layer: k, kind: s.kind })) {
        out.push({ id: `solid-${i + 1}-${k + 1}-${out.length + 1}`, name: 'Solid shape', solid: s.kind, solidLayer: k, fixed: true,
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
  const nativeMoves = result.moves ?? [];
  // (a loop, not Math.max(...): a full-size print has far more moves than a call can take arguments)
  let printedTop = 0;
  for (const m of nativeMoves) if (m.z > printedTop) printedTop = m.z;
  for (const s of added) for (const p of s.pts) if (p.z > printedTop) printedTop = p.z;
  const last = nativeMoves.at(-1), first = added[0].pts[0], safeZ = printedTop + 3;
  const suffix = emitStrands(added, { retraction: cfg.derived.retraction, startLift: safeZ - first.z, travelLift: 3 });
  const handoff = [];
  if (last) {
    const lift = { x: last.x, y: last.y, z: safeZ, cls: 'travel', extrude: false };
    const retraction = cfg.derived.retraction;
    if (retraction.length > 0 && Math.hypot(first.x - last.x, first.y - last.y) >= retraction.minTravel) {
      lift.retract = 'retract';
      const k = suffix.findIndex((m) => m.extrude);
      if (k >= 0) suffix[k] = { ...suffix[k], retract: 'unretract' };
    }
    handoff.push(lift);
  }
  const moves = [...nativeMoves, ...handoff, ...suffix];
  if (moves.length > MAX_MOVES) throw new ConfigError([`The solid shapes would take the print past ${MAX_MOVES.toLocaleString('en')} moves. Use fewer or smaller green shapes, or a smaller swatch.`]);
  const strands = [...body, ...added];
  const stats = { ...result.stats, ...computeStats(moves, cfg, result.placements ?? []), loops: result.stats.loops };
  const boundary = new PolygonBoundary(result.outline ?? swatch.rings);
  const fabric = analyzeFabric(strands, { strandWidth: bead, layerHeight: h, boundary });
  const warnings = [...(result.warnings ?? []).filter((w) => !(result.fabric?.issues ?? []).includes(w)), ...fabric.issues];
  const coils = shapes.filter((s) => s.kind === 'coil').length;
  const solid = { count: shapes.length, coils, zigzags: shapes.length - coils, layers: SOLID_LAYERS, overlap: SOLID_OVERLAP };
  return {
    ...result, strands, moves, stats, fabric, warnings, solid,
    ...(result.report ? { report: { ...result.report, components: fabric.components } } : {}),
    gcode: writeGcode(moves, cfg, { stats, comments: [...headerNotes(result), `Solid shapes: ${shapes.length} green (${coils} coiled, ${shapes.length - coils} zigzag), ${SOLID_LAYERS} layers on top of the pattern, ${Math.round(SOLID_OVERLAP * 100)}% overlap`] }),
  };
}
