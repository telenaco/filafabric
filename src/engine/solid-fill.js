import { PolygonBoundary } from './boundary.js';
import { serpentineChains } from './fill.js';
import { offsetPolyline } from './drawing.js';

/**
 * Solid fill for a closed shape: every part of it covered by strands laid side by side, each overlapping its neighbour
 * by `overlap` of a strand width (20% by default), so the shape prints as one solid piece. The fill follows the shape:
 *
 *   - a round shape (a circle, an ellipse, a rounded polygon) is a coil: one continuous spiral from just inside the
 *     edge to the middle, every turn a strand pitch inside the one before;
 *   - any other shape (a rectangle, a star, a letter) is a zigzag: one pass round the edge, then lines back and forth
 *     along the shape's longer side, joined at alternate ends.
 *
 * A second layer reverses the coil (from the middle back out) or turns the zigzag a quarter turn, so two layers make
 * a solid patch with no line lying on the same line below it. Plain geometry in mm: no printing.
 */

export const SOLID_OVERLAP = 0.2;
const ROUND = 0.88; // circularity (4πA/P²) from which a shape counts as round: 1 for a circle, 0.79 for a square

const area2 = (ring) => ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
const perimeter = (ring) => ring.reduce((sum, p, i) => sum + Math.hypot(ring[(i + 1) % ring.length].x - p.x, ring[(i + 1) % ring.length].y - p.y), 0);
const anticlockwise = (ring) => (area2(ring) < 0 ? ring.slice().reverse() : ring.slice());
const centroid = (ring) => {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], c = p.x * q.y - q.x * p.y;
    a += c; x += (p.x + q.x) * c; y += (p.y + q.y) * c;
  }
  return Math.abs(a) < 1e-12 ? { x: ring[0].x, y: ring[0].y } : { x: x / (3 * a), y: y / (3 * a) };
};
const distanceToRing = (p, ring) => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-20, dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
};

/** 'coil' for a round shape, 'zigzag' for anything else (and for any shape with holes in it). */
export function solidKind(ring, holes = []) {
  if (holes.length) return 'zigzag';
  const p = perimeter(ring);
  if (!(p > 0)) return 'zigzag';
  return (4 * Math.PI * Math.abs(area2(ring) / 2)) / (p * p) >= ROUND ? 'coil' : 'zigzag';
}

/** The ring moved `d` mm inwards (anticlockwise in, anticlockwise out), or null once it has closed up. */
function insetRing(ccw, d) {
  const out = offsetPolyline([...ccw, ccw[0]], d).slice(0, -1);
  // an offset past the middle turns the ring inside out
  return area2(out) > 1e-9 ? out : null;
}

/** A hole (anticlockwise) grown outward by d, into the solid round it; null if it grows into nothing. */
function growRing(ccw, d) {
  const cw = ccw.slice().reverse();
  const out = offsetPolyline([...cw, cw[0]], d).slice(0, -1).reverse();
  return area2(out) > 1e-9 ? out : null;
}

/**
 * The ring as a radius for every direction seen from `c`: where a ray from c first meets it. An inset taken past the
 * curvature of the outline (the narrow ends of an ellipse) crosses itself in small loops; the first meeting is the
 * true inner edge, so the loops are skipped. Sampled at `count` directions and read back by interpolation.
 */
function polar(ring, c, count) {
  const radii = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    const a = (2 * Math.PI * k) / count, ux = Math.cos(a), uy = Math.sin(a);
    let best = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const ex = q.x - p.x, ey = q.y - p.y, det = ex * uy - ey * ux;
      if (Math.abs(det) < 1e-12) continue;
      const wx = p.x - c.x, wy = p.y - c.y;
      const t = (ex * wy - ey * wx) / det; // along the ray
      const s = (ux * wy - uy * wx) / det; // along the edge
      if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
    }
    if (!Number.isFinite(best)) return null; // the middle is not inside this ring
    radii[k] = best;
  }
  return (angle) => {
    const f = ((((angle / (2 * Math.PI)) % 1) + 1) % 1) * count, i = Math.floor(f) % count, t = f - Math.floor(f);
    return radii[i] * (1 - t) + radii[(i + 1) % count] * t;
  };
}

/**
 * A coil: one spiral from half a strand inside the edge to the middle, turns `pitch` apart. Each turn blends one inset
 * of the outline into the next, so it is a true spiral (no jog from ring to ring) for any round shape.
 */
export function coilPath(ring, { bead = 0.45, overlap = SOLID_OVERLAP, step = 0.4 } = {}) {
  const ccw = anticlockwise(ring), c = centroid(ccw);
  const pitch = bead * (1 - overlap);
  const inner = distanceToRing(c, ccw); // how far in the middle is
  const radii = ccw.map((p) => Math.hypot(p.x - c.x, p.y - c.y)), mean = radii.reduce((n, r) => n + r, 0) / radii.length;
  const count = Math.max(72, Math.ceil((2 * Math.PI * radii.reduce((m, r) => Math.max(m, r), 0)) / step));
  // a circle needs no offsetting: each turn is the circle, smaller
  const circle = radii.every((r) => Math.abs(r - mean) < 0.005 * mean);
  const rings = [];
  for (let d = bead / 2; d < inner - 0.3 * bead; d += pitch) {
    if (circle) { const r = mean - d; rings.push(() => r); continue; }
    const r = insetRing(ccw, d);
    if (!r) break;
    const f = polar(r, c, count);
    if (!f) return concentric(ccw, c, { bead, pitch, inner });
    rings.push(f);
  }
  if (!rings.length) return [c, { x: c.x + 1e-3, y: c.y }]; // a speck: one dot of strand
  // once round at the edge first, so the first turn hugs the edge all the way round before it spirals in
  rings.unshift(rings[0]);
  const pts = [];
  const start = Math.atan2(ccw[0].y - c.y, ccw[0].x - c.x);
  const TAU = 2 * Math.PI;
  for (let k = 0; k < rings.length; k++) {
    const here = rings[k], next = rings[k + 1] ?? null;
    for (let theta = 0; ; ) {
      const t = theta / TAU, a = start + theta;
      const r = next ? here(a) * (1 - t) + next(a) * t : here(a);
      pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
      if (theta >= TAU) break;
      theta = Math.min(TAU, theta + Math.min(Math.PI / 24, step / Math.max(r, 0.5)));
    }
    // a turn ends exactly where the next one begins
    if (next) pts.pop();
  }
  // the last turn leaves a gap in the middle no wider than a pitch, a dot for a circle and a short slot for an ellipse:
  // run through it along the shape's long axis
  const axis = longAxis(ccw), innermost = rings.at(-1);
  const reach = (a) => Math.max(0, innermost(a) - bead / 2);
  const ahead = reach(axis), behind = reach(axis + Math.PI);
  if (ahead > 0.3 * bead || behind > 0.3 * bead) {
    pts.push({ x: c.x + ahead * Math.cos(axis), y: c.y + ahead * Math.sin(axis) }, { x: c.x - behind * Math.cos(axis), y: c.y - behind * Math.sin(axis) });
  } else {
    pts.push({ x: c.x, y: c.y });
  }
  return pts;
}

/** For a round shape that is not seen once round from its middle: nested insets joined by a short step inward. */
function concentric(ccw, c, { bead, pitch, inner }) {
  const pts = [];
  for (let d = bead / 2; d < inner - 0.3 * bead; d += pitch) {
    const r = insetRing(ccw, d);
    if (!r) break;
    let k0 = 0;
    if (pts.length) {
      const end = pts.at(-1);
      for (let i = 1; i < r.length; i++) if (Math.hypot(r[i].x - end.x, r[i].y - end.y) < Math.hypot(r[k0].x - end.x, r[k0].y - end.y)) k0 = i;
    }
    for (let i = 0; i <= r.length; i++) pts.push(r[(k0 + i) % r.length]);
  }
  return pts.length >= 2 ? pts : [c, { x: c.x + 1e-3, y: c.y }];
}

/** The direction (radians) of a shape's longer side: the main axis of its outline. */
export function longAxis(ring) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, w = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], len = Math.hypot(q.x - p.x, q.y - p.y);
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    sx += mx * len; sy += my * len; sxx += mx * mx * len; syy += my * my * len; sxy += mx * my * len; w += len;
  }
  if (!(w > 0)) return 0;
  const mx = sx / w, my = sy / w;
  const cxx = sxx / w - mx * mx, cyy = syy / w - my * my, cxy = sxy / w - mx * my;
  // an axis-aligned rectangle (or a square) keeps its own sides as the axes
  if (Math.abs(cxy) < 1e-9 * Math.max(1, cxx + cyy)) return cxx >= cyy ? 0 : Math.PI / 2;
  return 0.5 * Math.atan2(2 * cxy, cxx - cyy);
}

const rotate = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

/**
 * A zigzag: one pass round the edge (half a strand inside it), then lines at `angle` (radians) a pitch apart inside that
 * pass, run back and forth and joined at alternate ends. A shape the lines cannot cross in one go (a U, a star) gets a
 * zigzag for each part. Returns polylines, the edge pass first.
 */
export function zigzagPaths(ring, { bead = 0.45, overlap = SOLID_OVERLAP, angle = longAxis(ring), holes = [], edged = [] } = {}) {
  const ccw = anticlockwise(ring);
  const pitch = bead * (1 - overlap);
  const edge = insetRing(ccw, bead / 2);
  if (!edge) return [];
  const out = [[...edge, edge[0]]];
  // each hole gets a pass round its edge too, so an opening has a clean printed rim: half a strand out from it, or, where
  // the drawing already prints the hole's edge as a line, a pitch out from that line, overlapping it as neighbours do
  const rim = holes.map((_, i) => (edged[i] ? pitch : bead / 2));
  const holeEdges = holes.map((h, i) => growRing(anticlockwise(h), rim[i])).filter(Boolean).map((h) => [...h, h[0]]);
  // the lines run inside the edge passes, a pitch in from them, so each line end overlaps them as one line overlaps the next
  const core = insetRing(ccw, bead / 2 + pitch);
  if (!core) return [...out, ...holeEdges];
  const coreHoles = holes.map((h, i) => growRing(anticlockwise(h), rim[i] + pitch)).filter(Boolean);
  const turned = core.map((p) => rotate(p, -angle));
  const boundary = new PolygonBoundary([turned, ...coreHoles.map((h) => h.map((p) => rotate(p, -angle)))]);
  const box = boundary.bbox();
  const span = box.maxY - box.minY;
  // evenly spaced lanes from one side of the core to the other, never further apart than a pitch
  const count = Math.max(1, Math.ceil(span / pitch - 1e-9) + 1);
  const lanes = count === 1 ? [(box.minY + box.maxY) / 2] : Array.from({ length: count }, (_, k) => box.minY + (span * k) / (count - 1));
  // the ends are pulled in a hair, so a join along the core's own edge counts as inside it
  const chains = serpentineChains(boundary, 'y', lanes.map((y, k) => (k === 0 ? y + 1e-4 : k === count - 1 ? y - 1e-4 : y)), { inset: 1e-3, minLength: 1e-3, maxJog: 4 * pitch });
  for (const segments of chains) {
    const pts = [];
    for (const seg of segments) pts.push({ x: seg.from, y: seg.c }, { x: seg.to, y: seg.c });
    out.push(pts.map((p) => rotate(p, angle)));
  }
  // start the edge pass beside the first zigzag, so the one runs on into the other without a travel
  if (out.length > 1) {
    const to = out[1][0], ringPts = out[0].slice(0, -1);
    let k0 = 0;
    for (let i = 1; i < ringPts.length; i++) if (Math.hypot(ringPts[i].x - to.x, ringPts[i].y - to.y) < Math.hypot(ringPts[k0].x - to.x, ringPts[k0].y - to.y)) k0 = i;
    const loop = [...ringPts.slice(k0), ...ringPts.slice(0, k0), ringPts[k0]];
    out[0] = loop;
    if (Math.hypot(loop.at(-1).x - to.x, loop.at(-1).y - to.y) <= 2 * bead + pitch) out.splice(0, 2, [...loop, ...out[1]]);
  }
  out.splice(1, 0, ...holeEdges);
  return out;
}

/**
 * The fill of one shape for one layer, as polylines in print order. `layer` 0 is the first layer of the patch,
 * 1 the second: the coil reversed, or the zigzag turned a quarter turn.
 */
export function solidLayer(ring, { bead = 0.45, overlap = SOLID_OVERLAP, layer = 0, holes = [], edged = [], kind = solidKind(ring, holes) } = {}) {
  if (kind === 'coil' && !holes.length) {
    const path = coilPath(ring, { bead, overlap });
    return [layer % 2 ? path.slice().reverse() : path];
  }
  const angle = longAxis(ring) + (layer % 2 ? Math.PI / 2 : 0);
  return zigzagPaths(ring, { bead, overlap, angle, holes, edged });
}
