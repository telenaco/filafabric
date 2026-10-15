import { PolygonBoundary } from './boundary.js';
import { ConfigError } from './params.js';

/** Boundary extraction for a boolean material predicate over straight polygon edges. */
export function polygonRegion(candidates, material) {
  const edges = candidates.flatMap((ring) => ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length], cuts: [0, 1] }))).filter((e) => Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) > 1e-9);
  const box = candidates.flat().reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }), cell = Math.max(0.1, Math.sqrt(Math.max(1, (box.maxX - box.minX) * (box.maxY - box.minY)) / Math.max(1, edges.length)) * 4);
  const grid = new Map();
  let comparisons = 0, entries = 0;
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  const cutPair = (e, q) => {
    const rx = e.b.x - e.a.x, ry = e.b.y - e.a.y, sx = q.b.x - q.a.x, sy = q.b.y - q.a.y;
    const px = q.a.x - e.a.x, py = q.a.y - e.a.y, den = cross(rx, ry, sx, sy);
    if (Math.abs(den) > 1e-12) {
      const t = cross(px, py, sx, sy) / den, u = cross(px, py, rx, ry) / den;
      if (t >= -1e-10 && t <= 1 + 1e-10 && u >= -1e-10 && u <= 1 + 1e-10) { e.cuts.push(Math.max(0, Math.min(1, t))); q.cuts.push(Math.max(0, Math.min(1, u))); }
    } else if (Math.abs(cross(px, py, rx, ry)) < 1e-9 * Math.hypot(rx, ry)) {
      const project = (p, a, dx, dy) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
      for (const p of [q.a, q.b]) { const t = project(p, e.a, rx, ry); if (t > 0 && t < 1) e.cuts.push(t); }
      for (const p of [e.a, e.b]) { const t = project(p, q.a, sx, sy); if (t > 0 && t < 1) q.cuts.push(t); }
    }
  };
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i], seen = new Set();
    const x0 = Math.floor((Math.min(e.a.x, e.b.x) - 1e-8) / cell), x1 = Math.floor((Math.max(e.a.x, e.b.x) + 1e-8) / cell);
    const y0 = Math.floor((Math.min(e.a.y, e.b.y) - 1e-8) / cell), y1 = Math.floor((Math.max(e.a.y, e.b.y) + 1e-8) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${x},${y}`, prior = grid.get(key) ?? [];
      for (const j of prior) if (!seen.has(j)) {
        seen.add(j);
        if (++comparisons > 2000000) throw new ConfigError(['These overlapping polygon contours are too complex; simplify their edges.']);
        cutPair(e, edges[j]);
      }
      prior.push(i); grid.set(key, prior);
      if (++entries > 500000) throw new ConfigError(['These polygon contours need too much clipping; simplify their edges.']);
    }
  }
  const keyOf = (p) => `${Math.round(p.x * 1e7)},${Math.round(p.y * 1e7)}`, pieces = [], unique = new Set();
  for (const e of edges) {
    const ts = e.cuts.sort((a, b) => a - b).filter((t, i, all) => !i || t - all[i - 1] > 1e-10);
    const point = (t) => ({ x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t });
    for (let j = 1; j < ts.length; j++) {
      let a = point(ts[j - 1]), b = point(ts[j]);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (len < 1e-7) continue;
      const p = point((ts[j] + ts[j - 1]) / 2), epsilon = Math.min(1e-5, len / 100);
      const left = material(p.x - dy / len * epsilon, p.y + dx / len * epsilon), right = material(p.x + dy / len * epsilon, p.y - dx / len * epsilon);
      if (left === right) continue;
      if (!left) [a, b] = [b, a];
      const from = keyOf(a), to = keyOf(b), key = `${from}:${to}`;
      if (!unique.has(key)) { pieces.push({ a, b, from, to }); unique.add(key); }
    }
  }
  const outgoing = new Map();
  pieces.forEach((e, i) => { const list = outgoing.get(e.from) ?? []; list.push(i); outgoing.set(e.from, list); });
  const used = new Set(), rings = [];
  for (let i = 0; i < pieces.length; i++) {
    if (used.has(i)) continue;
    const start = pieces[i], ring = [], first = start.from;
    let current = i, closed = false;
    for (let k = 0; k <= pieces.length; k++) {
      const edge = pieces[current];
      if (used.has(current)) break;
      used.add(current); ring.push(edge.a);
      if (edge.to === first) { closed = true; break; }
      const next = (outgoing.get(edge.to) ?? []).filter((j) => !used.has(j));
      if (!next.length) break;
      const angle = Math.atan2(edge.b.y - edge.a.y, edge.b.x - edge.a.x);
      next.sort((j, q) => {
        const turn = (e) => (Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x) - angle + 2 * Math.PI) % (2 * Math.PI);
        return turn(pieces[j]) - turn(pieces[q]);
      });
      current = next[0];
    }
    if (!closed) throw new ConfigError(['These polygon edges could not be joined reliably; separate touching contours or simplify their edges.']);
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}


const boxOf = (ring) => ring.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
const overlaps = (a, b) => a.minX <= b.maxX + 1e-8 && a.maxX >= b.minX - 1e-8 && a.minY <= b.maxY + 1e-8 && a.maxY >= b.minY - 1e-8;

function crosses(a, b) {
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
    const ax = q.x - p.x, ay = q.y - p.y, bx = s.x - r.x, by = s.y - r.y, den = cross(ax, ay, bx, by);
    if (Math.abs(den) < 1e-12) continue;
    const t = cross(r.x - p.x, r.y - p.y, bx, by) / den, u = cross(r.x - p.x, r.y - p.y, ax, ay) / den;
    if (t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9) return true;
  }
  return false;
}

const probes = (ring) => ring.flatMap((p, i) => { const q = ring[(i + 1) % ring.length]; return [p, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }]; });

/** Union of filled contours, each minus the UNION of its holes. Preserve input order when no boolean work is needed. */
export function unionFilledRegions(fills) {
  if (!fills.length) return [];
  const regions = fills.map((f) => {
    const outer = new PolygonBoundary([f.ring]), holes = f.holes.map((ring) => new PolygonBoundary([ring]));
    return { ...f, box: boxOf(f.ring), contains: (x, y) => outer.contains(x, y) && !holes.some((h) => h.contains(x, y)) };
  });
  const candidates = fills.flatMap((f) => [f.ring, ...f.holes]);
  const ringOverlap = (a, b) => {
    if (!overlaps(boxOf(a), boxOf(b))) return false;
    const ba = new PolygonBoundary([a]), bb = new PolygonBoundary([b]);
    return probes(a).some((p) => bb.contains(p.x, p.y)) || probes(b).some((p) => ba.contains(p.x, p.y)) || crosses(a, b);
  };
  const needsUnion = regions.some((a, i) => regions.slice(i + 1).some((b) => {
    if (!overlaps(a.box, b.box)) return false;
    return probes(a.ring).some((p) => b.contains(p.x, p.y)) || probes(b.ring).some((p) => a.contains(p.x, p.y))
      || [a.ring, ...a.holes].some((ra) => [b.ring, ...b.holes].some((rb) => overlaps(boxOf(ra), boxOf(rb)) && crosses(ra, rb)));
  })) || fills.some((f) => f.holes.some((a, i) => f.holes.slice(i + 1).some((b) => ringOverlap(a, b))));
  return needsUnion ? polygonRegion(candidates, (x, y) => regions.some((r) => r.contains(x, y))) : candidates;
}

