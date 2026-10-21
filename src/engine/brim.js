import { ConfigError } from './params.js';
import { PolygonBoundary } from './boundary.js';
import { polygonRegion } from './polygon-region.js';
import { clipStrands, segmentInside, segmentContact, contactGraph, analyzeFabric } from './fabric.js';
import { emitStrands, travelLiftOf } from './emit.js';
import { computeStats } from './stats.js';
import { GcodeWriter, writeGcode } from './gcode.js';
import { MAX_MOVES } from './tiler.js';

const OVERLAP = 0.2;
const rectangle = (width, height) => [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// A second supported layer fuses to the tie below; lifted/free decorative spans retain their intended freedom.
const tieEligible = (p, layerHeight) => p.z <= 2 * layerHeight + 0.04 && !['unsupported', 'rising', 'falling'].includes(p.cls);
function validateCount(count) {
  if (!Number.isInteger(count) || count < 0 || count > 50) throw new ConfigError(['Brim count must be an integer from 0 to 50.']);
}
function boxOf(ring) {
  return ring.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}
const inBox = (x, y, b) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
const twiceArea = (ring) => ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p.x * q.y - p.y * q.x; }, 0);
function cleanContour(ring) {
  if (ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new ConfigError(['The brim offset produced a non-finite contour; simplify the outline.']);
  const clean = ring.filter((p, i) => !i || distance(p, ring[i - 1]) > 1e-8);
  if (clean.length > 1 && distance(clean[0], clean.at(-1)) < 1e-8) clean.pop();
  return clean.length >= 3 && Math.abs(twiceArea(clean)) > 1e-10 ? clean : [];
}

function convexHull(points) {
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list) => { const out = []; for (const p of list) { while (out.length >= 2 && turn(out.at(-2), out.at(-1), p) <= 1e-12) out.pop(); out.push(p); } return out; };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}

/** A circumscribed polygonal capsule. Straight offsets are exact; round corners conservatively clear the bead. */
function capsule(a, b, radius) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x), sides = 24, step = 2 * Math.PI / sides;
  const r = radius / Math.cos(step / 2), points = [];
  for (const p of [a, b]) for (let k = 0; k < sides; k++) {
    const theta = angle + (k + 0.5) * step;
    points.push({ x: p.x + r * Math.cos(theta), y: p.y + r * Math.sin(theta) });
  }
  return convexHull(points);
}

function convexRing(ring) {
  const area = ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p.x * q.y - p.y * q.x; }, 0);
  if (Math.abs(area) < 1e-10) return null;
  const ccw = area > 0 ? ring : [...ring].reverse();
  for (let i = 0; i < ccw.length; i++) {
    const a = ccw[i], b = ccw[(i + 1) % ccw.length], c = ccw[(i + 2) % ccw.length];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < -1e-10) return null;
  }
  // Local turn signs alone accept a pentagram. Require the global hull vertices in boundary order too.
  const hull = convexHull([...ccw]), keys = new Map(hull.map((p, i) => [`${p.x},${p.y}`, i]));
  const order = ccw.map((p) => keys.get(`${p.x},${p.y}`)).filter((i) => i !== undefined);
  if (order.length !== hull.length || order.some((value, i) => value !== (order[0] + i) % hull.length)
    || Math.abs(twiceArea(hull) - area * Math.sign(area)) > Math.max(1, Math.abs(area)) * 1e-9) return null;
  return { ring: ccw, area: Math.abs(area), box: boxOf(ccw), boundary: new PolygonBoundary([ccw]) };
}

/** Convex erosion is the intersection of the polygon's inward-shifted edge half-planes. */
function insetConvex(ring, radius) {
  let out = ring;
  for (let i = 0; i < ring.length && out.length >= 3; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y, length = distance(a, b);
    const side = (p) => (dx * (p.y - a.y) - dy * (p.x - a.x)) / length - radius;
    const next = [];
    let previous = out.at(-1), before = side(previous);
    for (const p of out) {
      const after = side(p);
      if ((before >= 0) !== (after >= 0)) {
        const t = before / (before - after);
        next.push({ x: previous.x + (p.x - previous.x) * t, y: previous.y + (p.y - previous.y) * t });
      }
      if (after >= 0) next.push(p);
      previous = p; before = after;
    }
    out = next;
  }
  return cleanContour(out);
}

/** Circumscribed miter expansion of a convex hole, independent of the file's ring winding. */
function outsetConvex(ring, radius) {
  const normals = ring.map((a, i) => { const b = ring[(i + 1) % ring.length], length = distance(a, b); return { x: (b.y - a.y) / length, y: (a.x - b.x) / length }; });
  return ring.map((p, i) => {
    const a = normals[(i + ring.length - 1) % ring.length], b = normals[i], k = radius / (1 + a.x * b.x + a.y * b.y);
    return { x: p.x + (a.x + b.x) * k, y: p.y + (a.y + b.y) * k };
  });
}

/** The separating-axis test distinguishes truly intersecting contours from overlapping boxes. */
function convexSeparated(a, b) {
  for (const ring of [a, b]) for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], nx = q.y - p.y, ny = p.x - q.x;
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const v of a) { const projection = nx * v.x + ny * v.y; minA = Math.min(minA, projection); maxA = Math.max(maxA, projection); }
    for (const v of b) { const projection = nx * v.x + ny * v.y; minB = Math.min(minB, projection); maxB = Math.max(maxB, projection); }
    if (maxA < minB - 1e-9 || maxB < minA - 1e-9) return true;
  }
  return false;
}

/** Avoid thousands of overlapping capsules for finely sampled convex SVG circles and nested holes. */
function convexInsets(rings, radius) {
  const nodes = rings.map(convexRing);
  if (nodes.some((n) => !n)) return null;
  for (const node of nodes) {
    node.parent = null;
    for (const other of nodes) {
      if (other.area <= node.area || (node.parent && node.parent.area <= other.area)) continue;
      if (node.box.minX < other.box.minX || node.box.minY < other.box.minY || node.box.maxX > other.box.maxX || node.box.maxY > other.box.maxY) continue;
      if (node.ring.every((p) => other.boundary.contains(p.x, p.y))) node.parent = other;
    }
  }
  // Crossing or touching sibling rings need the general even-odd boolean path.
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    const ancestor = (p, q) => { for (; p; p = p.parent) if (p === q) return true; return false; };
    if (ancestor(a, b) || ancestor(b, a)) continue;
    if (a.box.minX <= b.box.maxX && a.box.maxX >= b.box.minX && a.box.minY <= b.box.maxY && a.box.maxY >= b.box.minY && !convexSeparated(a.ring, b.ring)) return null;
  }
  for (const node of nodes) {
    let depth = 0;
    for (let p = node.parent; p; p = p.parent) depth++;
    node.hole = depth % 2 === 1;
    node.offset = node.hole ? outsetConvex(node.ring, radius) : insetConvex(node.ring, radius);
    node.offsetBoundary = node.offset.length >= 3 ? new PolygonBoundary([node.offset]) : null;
  }
  const regions = nodes.filter((n) => !n.hole && n.offsetBoundary).map((outer) => ({ outer, holes: nodes.filter((n) => n.hole && n.parent === outer) }));
  if (!regions.length) return [];
  const candidates = regions.flatMap((r) => [r.outer.offset, ...r.holes.map((h) => h.offset)]);
  if (regions.every((r) => !r.holes.length)) return candidates;
  return polygonRegion(candidates, (x, y) => regions.some((r) => r.outer.offsetBoundary.contains(x, y) && !r.holes.some((h) => h.offsetBoundary.contains(x, y))));
}

/** RDP chords plus a measured clearance allowance. Every original edge stays within this allowance. */
function capsuleContour(ring, tolerance) {
  if (ring.length < 16) return { ring, allowance: 0 };
  const points = [...ring, ring[0]], keep = new Set([0, ring.length]), stack = [[0, ring.length]];
  let allowance = 0;
  while (stack.length) {
    const [from, to] = stack.pop(), a = points[from], b = points[to], dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    let far = 0, index = -1;
    for (let i = from + 1; i < to; i++) {
      const p = points[i], t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-30, len2)));
      const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      if (d > far) { far = d; index = i; }
    }
    if (far > tolerance) { keep.add(index); stack.push([from, index], [index, to]); }
    else allowance = Math.max(allowance, far);
  }
  const simplified = [...keep].sort((a, b) => a - b).filter((i) => i < ring.length).map((i) => points[i]);
  return simplified.length >= 3 ? { ring: simplified, allowance } : { ring, allowance: 0 };
}

/** Erode vector material by a distance. Boundary capsules handle concavity, holes and collapsing necks without a raster. */
function insetRings(rings, radius) {
  const convex = convexInsets(rings, radius);
  if (convex !== null) return convex;
  // A drawn curve comes in as hundreds of edges a third of a millimetre long, and every edge is a capsule that overlaps
  // its neighbours: the clipping between them grows far faster than the edges do. Chords within 0.05 mm of the curve
  // are invisible under a 0.45 mm bead, and the allowance below keeps the result on the safe side of the true inset.
  const material = new PolygonBoundary(rings), capsules = [], tolerance = Math.min(0.05, radius * 0.2);
  // Inflate each simplified contour's capsules by its measured chord deviation. Since a straight
  // original edge lies within the convex tolerance tube of its chord, the enlarged capsule covers
  // the original radius-wide tube completely. Subtraction can only remove extra material, never add it.
  for (const original of rings) {
    const { ring, allowance } = capsuleContour(original, tolerance);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (distance(a, b) < 1e-8) continue;
      const pts = capsule(a, b, radius + allowance);
      capsules.push({ pts, box: boxOf(pts), boundary: new PolygonBoundary([pts]) });
    }
  }
  const maxSpan = capsules.reduce((span, c) => Math.max(span, c.box.maxX - c.box.minX, c.box.maxY - c.box.minY), 0);
  const cell = Math.max(1, radius * 2, maxSpan / 32), grid = new Map();
  for (const capsule of capsules) for (let x = Math.floor(capsule.box.minX / cell); x <= Math.floor(capsule.box.maxX / cell); x++) for (let y = Math.floor(capsule.box.minY / cell); y <= Math.floor(capsule.box.maxY / cell); y++) {
    const key = `${x},${y}`, list = grid.get(key) ?? []; list.push(capsule); grid.set(key, list);
  }
  return polygonRegion([...rings, ...capsules.map((c) => c.pts)], (x, y) => material.contains(x, y)
    && !(grid.get(`${Math.floor(x / cell)},${Math.floor(y / cell)}`) ?? []).some((c) => inBox(x, y, c.box) && c.boundary.contains(x, y)));
}

/** Side-by-side bed runs INSIDE the full selected outline. Clip to a preview only after making its real contours. */
export function buildBrimStrands(rings, { count = 2, strandWidth = 0.45, layerHeight = 0.2, viewport = null } = {}) {
  validateCount(count);
  if (!count) return [];
  if (!(strandWidth > 0) || !Number.isFinite(strandWidth) || !(layerHeight > 0) || !Number.isFinite(layerHeight)) throw new ConfigError(['Brim bead width and layer height must be positive finite numbers.']);
  if (!Array.isArray(rings) || !rings.length) return [];
  rings = rings.map((ring) => ring.filter((p, i) => !i || distance(p, ring[i - 1]) > 1e-9)).map((ring) => ring.length > 3 && distance(ring[0], ring.at(-1)) < 1e-9 ? ring.slice(0, -1) : ring).filter((ring) => ring.length >= 3);
  if (!rings.length) return [];
  const strands = [];
  for (let run = 0; run < count; run++) {
    const inset = strandWidth / 2 + run * strandWidth * (1 - OVERLAP);
    const contours = insetRings(rings, inset).map(cleanContour).filter((ring) => ring.length >= 3);
    if (!contours.length) break;
    for (const ring of contours) strands.push({ id: `brim-${run + 1}-${strands.length + 1}`, name: 'Brim', kind: 'base', layer: -1, brim: true, run, inset, pts: [...ring, ring[0]].map((p) => ({ ...p, z: layerHeight })) });
  }
  if (!viewport) return strands;
  const width = viewport.width ?? viewport[0], height = viewport.height ?? viewport[1];
  const x = viewport.x ?? 0, y = viewport.y ?? 0;
  const crop = new PolygonBoundary([rectangle(width, height).map((p) => ({ x: p.x + x, y: p.y + y }))]);
  return strands.flatMap((strand) => {
    const parts = clipStrands([strand], crop, 0);
    // Clipping a closed contour can split one continuous corner at its original seam.
    if (parts.length > 1 && distance(parts.at(-1).pts.at(-1), parts[0].pts[0]) < 1e-7) {
      const last = parts.pop();
      parts[0] = { ...parts[0], pts: [...last.pts, ...parts[0].pts.slice(1)] };
    }
    return parts;
  });
}

function closest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-20, dx * dx + dy * dy)));
  return { x: a.x + dx * t, y: a.y + dy * t, z: a.z };
}

/** Join exposed bed-level components to nearby brim without moving, flattening or replanning body strands. */
function brimConnections(brim, body, boundary, { strandWidth, layerHeight, maxTie = 12 }) {
  if (!brim.length || !body.length) return [];
  const all = [...brim, ...body], graph = contactGraph(all, { strandWidth, layerHeight });
  const parent = new Map(graph.labels.map((i) => [i, i]));
  const root = (i) => { while (parent.get(i) !== i) i = parent.get(i); return i; };
  const grid = new Map(), candidates = new Map(), cell = maxTie;
  brim.forEach((s, si) => {
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i];
      const e = { a, b, group: graph.labels[si] };
      for (let x = Math.floor(Math.min(a.x, b.x) / cell); x <= Math.floor(Math.max(a.x, b.x) / cell); x++) for (let y = Math.floor(Math.min(a.y, b.y) / cell); y <= Math.floor(Math.max(a.y, b.y) / cell); y++) {
        const key = `${x},${y}`, list = grid.get(key) ?? []; list.push(e); grid.set(key, list);
      }
    }
  });
  body.forEach((s, si) => {
    const group = graph.labels[si + brim.length];
    let previous = null;
    s.pts.forEach((p, i) => {
      if (!tieEligible(p, layerHeight) || (previous && i !== s.pts.length - 1 && distance(previous, p) < 1)) return;
      previous = p;
      const seen = new Set(), x = Math.floor(p.x / cell), y = Math.floor(p.y / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const e of grid.get(`${x + dx},${y + dy}`) ?? []) {
        if (e.group === group || seen.has(e)) continue;
        seen.add(e);
        const q = closest(p, e.a, e.b), d = distance(p, q), key = `${group}:${e.group}`;
        if (d > maxTie || d < strandWidth * 0.8 || (candidates.has(key) && candidates.get(key).d <= d)) continue;
        if (!segmentInside(p, q, boundary, strandWidth / 2)) continue;
        candidates.set(key, { p, q, d, group, other: e.group });
      }
    });
  });
  const ties = [];
  for (const c of [...candidates.values()].sort((a, b) => a.d - b.d)) {
    const a = root(c.group), b = root(c.other);
    if (a === b) continue;
    parent.set(a, b);
    ties.push({ id: `brim-tie-${ties.length + 1}`, name: 'Brim connection', kind: 'base', layer: -1, brim: true, connection: true,
      pts: [c.q, { ...c.p, z: layerHeight }] });
  }
  // An attached component can still have a frayed end at the opposite side of the outline.
  // Tie each open bed endpoint independently; never treat a closed motif's seam as an exposed end.
  for (const s of body) {
    if (s.pts.length < 2 || distance(s.pts[0], s.pts.at(-1)) < 1e-7) continue;
    for (const p of [s.pts[0], s.pts.at(-1)]) {
      if (!tieEligible(p, layerHeight) || ties.some((t) => distance(t.pts.at(-1), p) < 1e-7)) continue;
      let best = null;
      const seen = new Set(), x = Math.floor(p.x / cell), y = Math.floor(p.y / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const e of grid.get(`${x + dx},${y + dy}`) ?? []) {
        if (seen.has(e)) continue;
        seen.add(e);
        const q = closest(p, e.a, e.b), d = distance(p, q);
        if (d > maxTie || (best && best.d <= d)) continue;
        if (!segmentInside(p, q, boundary, strandWidth / 2)) continue;
        best = { q, d };
      }
      if (!best || best.d <= strandWidth * 0.8) continue;
      ties.push({ id: `brim-tie-${ties.length + 1}`, name: 'Brim connection', kind: 'base', layer: -1, brim: true, connection: true,
        pts: [best.q, { ...p, z: layerHeight }] });
    }
  }
  return ties;
}

export function headerNotes(result) {
  const standard = new Set(new GcodeWriter(result.cfg).header({ stats: result.stats }));
  return (result.gcode ?? '').split('; BODY START')[0].split(/\r?\n/)
    .filter((line) => line.startsWith('; ') && !standard.has(line) && !/^; (?:estimated time|filament:|param )/.test(line))
    .map((line) => line.slice(2));
}

/** Prepend brim and short bed ties. Native coordinates, classes and commands stay intact; only a missing startup prime is added. */
export function applyBrim(result, { count = 2, outline = result.outline, fullWidth = result.cfg?.t.sample_width, fullHeight = result.cfg?.t.sample_height, maxTie = 12 } = {}) {
  validateCount(count);
  if (!count) return result;
  const { cfg } = result, { extrusion_width: strandWidth, layer_height: layerHeight } = cfg.t;
  const rings = outline ?? [rectangle(fullWidth, fullHeight)], boundary = new PolygonBoundary(rings);
  const viewport = { width: cfg.t.sample_width, height: cfg.t.sample_height };
  let brim;
  try {
    brim = buildBrimStrands(rings, { count, strandWidth, layerHeight, viewport });
  } catch (error) {
    // the brim is an extra: an outline too detailed to offset leaves it out, and the design itself still prints
    if (!(error instanceof ConfigError)) throw error;
    return { ...result, warnings: [...(result.warnings ?? []), `The brim was left out: ${error.errors?.[0] ?? error.message} The design prints without it.`] };
  }
  const body = result.strands ?? [];
  const connections = brimConnections(brim, body, boundary, { strandWidth, layerHeight, maxTie });
  const added = [...brim, ...connections], strands = [...added, ...body];
  const prefix = emitStrands(added, { retraction: cfg.derived.retraction });
  const nativeMoves = [...result.moves];
  if (prefix.length && nativeMoves.length) {
    const last = prefix.at(-1), first = nativeMoves[0], safeZ = Math.max(last.z, first.z, layerHeight) + travelLiftOf(cfg.derived.retraction);
    const lift = { x: last.x, y: last.y, z: safeZ, cls: 'travel', extrude: false };
    const firstExtrusion = nativeMoves.findIndex((m) => m.extrude), retraction = cfg.derived.retraction;
    const startup = firstExtrusion >= 0 ? nativeMoves.slice(0, firstExtrusion + 1) : [];
    // Reuse any native startup retract/prime rather than doubling it. Ordinary native planners
    // start with unretracted travel, so the newly introduced handoff needs its own balanced pair.
    if (firstExtrusion >= 0 && retraction.length > 0 && distance(last, first) >= retraction.minTravel
      && !startup.some((m) => m.retract === 'retract')) {
      lift.retract = 'retract';
      if (!startup.some((m) => m.retract === 'unretract')) nativeMoves[firstExtrusion] = { ...nativeMoves[firstExtrusion], retract: 'unretract' };
    }
    prefix.push(lift, { x: first.x, y: first.y, z: safeZ, cls: 'travel', extrude: false });
  }
  const moves = [...prefix, ...nativeMoves];
  if (moves.length > MAX_MOVES) throw new ConfigError(['The brim would exceed the print move limit. Use fewer brim runs or a smaller section.']);
  const stats = { ...result.stats, ...computeStats(moves, cfg, result.placements ?? []), loops: result.stats.loops };
  const baseSegments = (result.base?.strands ?? []).flatMap((pts) => pts.slice(1).map((p, i) => [pts[i], p]));
  const supportedAt = baseSegments.length ? (p) => baseSegments.some(([a, b]) => p.z - a.z > layerHeight / 2 && p.z - a.z <= layerHeight + 0.04 && segmentContact(p, p, a, b).distance <= strandWidth / 2) : null;
  // checked against the whole piece: a lace's solid body lies outside the outline of its windows of pattern
  const fabric = analyzeFabric(strands, { strandWidth, layerHeight, boundary: result.pieceOutline ? new PolygonBoundary(result.pieceOutline) : boundary, supportedAt });
  const warnings = [...(result.warnings ?? []).filter((w) => !(result.fabric?.issues ?? []).includes(w)), ...fabric.issues];
  const metadata = { count, overlap: OVERLAP, strandWidth, pitch: strandWidth * (1 - OVERLAP), width: strandWidth * (1 + (count - 1) * (1 - OVERLAP)), runs: brim.length, connections: connections.length };
  return { ...result, strands, moves, stats, fabric, warnings, brim: metadata, ...(result.report ? { report: { ...result.report, components: fabric.components } } : {}),
    gcode: writeGcode(moves, cfg, { stats, comments: [...headerNotes(result), `Brim: ${count} runs, 20% bead overlap, inside the selected outline`] }) };
}
