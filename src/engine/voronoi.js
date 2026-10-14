import { createRng } from './rng.js';
import { ConfigError } from './params.js';
import { clipPolyline, trailsFromEdges, densify } from './layers.js';

/**
 * Voronoi lace: a centroidal Voronoi tessellation (Lloyd-relaxed, so the cells are even and round) with its Delaunay
 * triangulation as the second layer. Each Voronoi edge is the perpendicular bisector of a Delaunay edge, so the two
 * layers cross at about a right angle wherever the triangles are not obtuse. A tone field makes the cells smaller
 * where it is bright, so the lace can be graded. Edges are joined into trails; a Voronoi vertex has three edges
 * (odd), so a tessellation needs about half as many strands as it has vertices unless routed.
 */

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Sites by dart throwing with a local radius, then Lloyd relaxation on a grid with density weights. */
export function sites(box, { spacing = 8, relax = 4, seed = 1, tone = null } = {}) {
  const rng = createRng(seed);
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const toneAt = (x, y) => (tone ? Math.max(0, Math.min(1, tone(x - box.minX, y - box.minY, w, h))) : 0.5);
  const radiusAt = (x, y) => spacing * (1.35 - 0.7 * toneAt(x, y));
  const pts = [];
  const limit = 4 + Math.ceil(((w * h) / (spacing * spacing)) * 2.2);
  for (let tries = 0; tries < limit * 40 && pts.length < limit; tries++) {
    const p = { x: box.minX + rng.next() * w, y: box.minY + rng.next() * h };
    const r = radiusAt(p.x, p.y) * 0.85;
    if (pts.every((q) => dist2(p, q) >= r * r)) pts.push(p);
  }
  if (pts.length < 4) throw new Error('The swatch is too small for this cell size');

  // Lloyd: every grid sample belongs to its nearest site; each site moves to the weighted centroid of its samples
  const step = Math.max(0.5, Math.min(w, h) / 60, spacing / 8);
  for (let it = 0; it < relax; it++) {
    const sum = pts.map(() => ({ x: 0, y: 0, m: 0 }));
    for (let y = box.minY + step / 2; y < box.maxY; y += step) {
      for (let x = box.minX + step / 2; x < box.maxX; x += step) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        const r = radiusAt(x, y);
        const weight = 1 / (r * r);
        const s = sum[best];
        s.x += x * weight;
        s.y += y * weight;
        s.m += weight;
      }
    }
    sum.forEach((s, i) => {
      if (s.m > 0) pts[i] = { x: Math.min(box.maxX, Math.max(box.minX, s.x / s.m)), y: Math.min(box.maxY, Math.max(box.minY, s.y / s.m)) };
    });
  }
  return pts;
}

function circumcircle(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { x, y, r2: (a.x - x) ** 2 + (a.y - y) ** 2 };
}

/** Bowyer-Watson Delaunay triangulation: triangles as index triples into `points`. */
export function delaunay(points) {
  const n = points.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const d = Math.max(maxX - minX, maxY - minY, 1) * 20;
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const all = [...points, { x: mx - d, y: my - d }, { x: mx, y: my + d }, { x: mx + d, y: my - d }];
  let tris = [{ v: [n, n + 1, n + 2], c: circumcircle(all[n], all[n + 1], all[n + 2]) }];
  for (let i = 0; i < n; i++) {
    const p = all[i];
    const bad = [], keep = [];
    for (const t of tris) (t.c && dist2(p, t.c) < t.c.r2 - 1e-9 ? bad : keep).push(t);
    const edges = new Map();
    for (const t of bad) {
      for (let k = 0; k < 3; k++) {
        const a = t.v[k], b = t.v[(k + 1) % 3];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [a, b]);
      }
    }
    for (const [a, b] of edges.values()) keep.push({ v: [a, b, i], c: circumcircle(all[a], all[b], p) });
    tris = keep;
  }
  return tris.filter((t) => t.v.every((v) => v < n)).map((t) => t.v);
}

/** Liang-Barsky: the part of segment a-b inside the box, or null. */
function clipSegment(a, b, box) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const tests = [[-dx, a.x - box.minX], [dx, box.maxX - a.x], [-dy, a.y - box.minY], [dy, box.maxY - a.y]];
  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [{ x: a.x + t0 * dx, y: a.y + t0 * dy }, { x: a.x + t1 * dx, y: a.y + t1 * dy }];
}

/** Delaunay edges and Voronoi edges (clipped to the box) as two-point polylines. */
export function tessellate(points, box) {
  const tri = delaunay(points);
  const delaunayEdges = new Map();
  const owners = new Map();
  tri.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!delaunayEdges.has(key)) delaunayEdges.set(key, [a, b]);
      if (!owners.has(key)) owners.set(key, []);
      owners.get(key).push(ti);
    }
  });
  const centres = tri.map((t) => circumcircle(points[t[0]], points[t[1]], points[t[2]]));
  const far = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) * 4;
  const voronoi = [];
  for (const [key, list] of owners) {
    const [a, b] = delaunayEdges.get(key);
    let seg = null;
    if (list.length === 2 && centres[list[0]] && centres[list[1]]) {
      seg = [centres[list[0]], centres[list[1]]];
    } else if (list.length === 1 && centres[list[0]]) {
      // a hull edge: the Voronoi edge is a ray, away from the triangle's third vertex
      const third = tri[list[0]].find((v) => v !== a && v !== b);
      const pa = points[a], pb = points[b], pc = points[third];
      let nx = -(pb.y - pa.y), ny = pb.x - pa.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      if ((pc.x - pa.x) * nx + (pc.y - pa.y) * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const c = centres[list[0]];
      seg = [{ x: c.x, y: c.y }, { x: c.x + nx * far, y: c.y + ny * far }];
    }
    if (!seg) continue;
    const clipped = clipSegment(seg[0], seg[1], box);
    if (clipped && dist2(clipped[0], clipped[1]) > 1e-4) voronoi.push(clipped);
  }
  return {
    delaunay: [...delaunayEdges.values()].map(([a, b]) => [points[a], points[b]]),
    voronoi,
  };
}

/**
 * @param spacing  mean distance between neighbouring sites (mm)
 * @param relax    Lloyd iterations (0 is a random scatter, 5 or more is an even lace)
 * @param seed     random seed
 * @param tone     optional (x, y, w, h) giving 0..1; cells are smaller where it is bright
 */
export const MAX_SITES = 1500;

export function voronoiLayers(boundary, { spacing = 8, relax = 4, seed = 1, tone = null } = {}) {
  const box = boundary.bbox();
  const estimate = Math.ceil(((box.maxX - box.minX) * (box.maxY - box.minY)) / (spacing * spacing));
  if (estimate > MAX_SITES) {
    throw new ConfigError([`This would need about ${estimate} cells; the limit is ${MAX_SITES}. Use larger cells or a smaller swatch.`]);
  }
  const points = sites(box, { spacing, relax, seed, tone });
  const { delaunay: dEdges, voronoi: vEdges } = tessellate(points, box);
  const toLayer = (edges) => trailsFromEdges(edges).flatMap((t) => clipPolyline(densify(t), boundary));
  return { layers: [toLayer(dEdges), toLayer(vEdges)], extra: { sites: points.length } };
}
