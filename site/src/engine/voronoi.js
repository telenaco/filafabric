import { createRng } from './rng.js';
import { ConfigError } from './params.js';
import { clipPolyline, trailsFromEdges, densify, chainPolylines } from './layers.js';
import { findCrossings } from './crossings.js';

/**
 * Voronoi lace: a centroidal Voronoi tessellation (Lloyd-relaxed, so the cells are even and round) with its Delaunay
 * triangulation as the second layer. Each Voronoi edge is the perpendicular bisector of a Delaunay edge, so the two
 * layers cross at about a right angle wherever the triangles are not obtuse. A tone field makes the cells smaller
 * where it is bright, so the lace can be graded. Edges are joined into trails; a Voronoi vertex has three edges
 * (odd), so a tessellation needs about half as many strands as it has vertices unless routed.
 */

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * Buckets of `size` mm holding indices into `pts`, so that a site only looks at the sites near it. This is what lets a
 * lace of any size build in time proportional to its number of cells (a 1 x 1 m garment has a few hundred thousand),
 * where comparing every site with every other grew with the square of that number.
 */
function bucketGrid(pts, size) {
  const map = new Map();
  const key = (i, j) => (i + 1048576) * 2097152 + (j + 1048576); // a number, not a string: much faster to look up
  const add = (p, n) => { const k = key(Math.floor(p.x / size), Math.floor(p.y / size)); let list = map.get(k); if (!list) map.set(k, list = []); list.push(n); };
  pts.forEach(add);
  return {
    size, add,
    /** Indices of the points in the buckets within r of (x, y): every point within r, and some a little further. */
    /** Whether every point in the buckets within r of (x, y) passes `test` (stops at the first that fails; no list made). */
    all(x, y, r, test) {
      const i0 = Math.floor((x - r) / size), i1 = Math.floor((x + r) / size), j0 = Math.floor((y - r) / size), j1 = Math.floor((y + r) / size);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const list = map.get(key(i, j)); if (list) for (const n of list) if (!test(n)) return false; }
      return true;
    },
    near(x, y, r) {
      const out = [], i0 = Math.floor((x - r) / size), i1 = Math.floor((x + r) / size), j0 = Math.floor((y - r) / size), j1 = Math.floor((y + r) / size);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const list = map.get(key(i, j)); if (list) for (const n of list) out.push(n); }
      return out;
    },
  };
}

/** The index of the point of `pts` nearest (x, y), searching ever wider rings of buckets. */
function nearestIndex(grid, pts, x, y) {
  for (let r = grid.size; ; r *= 2) {
    let best = -1, bd = Infinity;
    for (const n of grid.near(x, y, r)) { const d = (pts[n].x - x) ** 2 + (pts[n].y - y) ** 2; if (d < bd) { bd = d; best = n; } }
    if (best >= 0 && bd <= r * r || r > 1e7) return best;
  }
}

/** Sites by dart throwing with a local radius, then Lloyd relaxation on a grid with density weights. */
export function sites(box, { spacing = 8, relax = 4, seed = 1, tone = null } = {}) {
  const rng = createRng(seed);
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const toneAt = (x, y) => (tone ? Math.max(0, Math.min(1, tone(x - box.minX, y - box.minY, w, h))) : 0.5);
  const radiusAt = (x, y) => spacing * (1.35 - 0.7 * toneAt(x, y));
  const pts = [];
  const limit = 4 + Math.ceil(((w * h) / (spacing * spacing)) * 2.2);
  const darts = bucketGrid([], spacing * 1.35 * 0.85);
  for (let tries = 0; tries < limit * 40 && pts.length < limit; tries++) {
    const p = { x: box.minX + rng.next() * w, y: box.minY + rng.next() * h };
    const r = radiusAt(p.x, p.y) * 0.85;
    if (darts.all(p.x, p.y, r, (n) => dist2(p, pts[n]) >= r * r)) { darts.add(p, pts.length); pts.push(p); }
  }
  if (pts.length < 4) throw new Error('The swatch is too small for this cell size');

  // Lloyd: every grid sample belongs to its nearest site; each site moves to the weighted centroid of its samples
  const step = Math.max(0.5, Math.min(w, h) / 60, spacing / 8);
  for (let it = 0; it < relax; it++) {
    const sum = pts.map(() => ({ x: 0, y: 0, m: 0 }));
    const grid = bucketGrid(pts, spacing);
    for (let y = box.minY + step / 2; y < box.maxY; y += step) {
      for (let x = box.minX + step / 2; x < box.maxX; x += step) {
        const best = nearestIndex(grid, pts, x, y);
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

/** Polygon (vertex labels name the edge that starts there) cut to the side of the bisector of a and b nearer a. */
function clipByBisector(poly, a, b, label) {
  const nx = b.x - a.x, ny = b.y - a.y, c = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
  const side = (p) => p.x * nx + p.y * ny - c; // <= 0: nearer a
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp <= 0) !== (sq <= 0)) {
      const t = sp / (sp - sq);
      // leaving the half-plane starts the new bisector edge; coming back in continues the edge p-q
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, label: sp <= 0 ? label : p.label });
    }
  }
  return out;
}

/**
 * Delaunay edges and Voronoi edges (clipped to the box) as two-point polylines, for the first `count` points (the rest
 * are mirror sites: they shape the cells along the edge but get no cell of their own). Each cell is the box cut by the
 * bisectors with the sites near it (a bucket grid finds them, and the search widens for any cell that needs it), so the
 * time grows with the number of cells, not its square. Every wall is the bisector of the two sites it separates, and
 * those two sites make a Delaunay edge.
 */
export function tessellate(points, box, { count = points.length } = {}) {
  const spacing = Math.sqrt(((box.maxX - box.minX) * (box.maxY - box.minY)) / Math.max(1, count));
  const grid = bucketGrid(points, spacing), span = Math.hypot(box.maxX - box.minX, box.maxY - box.minY);
  const voronoi = [], delaunayEdges = [], seen = new Set();
  for (let i = 0; i < count; i++) {
    const a = points[i];
    let r = 3 * spacing, poly;
    for (;;) {
      poly = [{ x: box.minX, y: box.minY, label: -1 }, { x: box.maxX, y: box.minY, label: -1 }, { x: box.maxX, y: box.maxY, label: -1 }, { x: box.minX, y: box.maxY, label: -1 }];
      const near = grid.near(a.x, a.y, r).filter((n) => n !== i && dist2(points[n], a) <= r * r).sort((m, n) => dist2(points[m], a) - dist2(points[n], a));
      for (const n of near) { poly = clipByBisector(poly, a, points[n], n); if (poly.length < 3) break; }
      // any site whose bisector could still cut this cell is within twice its farthest corner
      const far = Math.max(0, ...poly.map((p) => Math.sqrt(dist2(p, a))));
      if (2 * far <= r || r > 4 * span) break;
      r = 2 * far + spacing;
    }
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k], q = poly[(k + 1) % poly.length], j = p.label;
      if (j < 0 || dist2(p, q) <= 1e-4) continue;
      // a wall between two real cells is found from both sides: keep it once
      const key = j < count ? (i < j ? `${i},${j}` : `${j},${i}`) : `${i},m${j}`;
      if (seen.has(key)) continue;
      seen.add(key);
      voronoi.push([{ x: p.x, y: p.y }, { x: q.x, y: q.y }]);
      delaunayEdges.push([a, points[j]]);
    }
  }
  return { delaunay: delaunayEdges, voronoi };
}

/**
 * @param spacing  mean distance between neighbouring sites (mm)
 * @param relax    Lloyd iterations (0 is a random scatter, 5 or more is an even lace)
 * @param seed     random seed
 * @param tone     optional (x, y, w, h) giving 0..1; cells are smaller where it is bright
 */
export const MAX_SITES = 400000; // a 1 x 1 m garment at 1.7 mm cells is about 350,000

/** Whether an outline is just its own bounding box (the plain swatch), so its edges are straight and square. */
export function isBox(boundary) {
  const ring = boundary.rings?.length === 1 ? boundary.rings[0] : null;
  if (!ring || ring.length !== 4) return false;
  const b = boundary.bbox();
  return ring.every((p) => (Math.abs(p.x - b.minX) < 1e-9 || Math.abs(p.x - b.maxX) < 1e-9) && (Math.abs(p.y - b.minY) < 1e-9 || Math.abs(p.y - b.maxY) < 1e-9));
}

export function voronoiLayers(boundary, { spacing = 8, relax = 4, seed = 1, tone = null, whole = true } = {}) {
  const box = boundary.bbox();
  const estimate = Math.ceil(((box.maxX - box.minX) * (box.maxY - box.minY)) / (spacing * spacing));
  if (estimate > MAX_SITES) {
    throw new ConfigError([`This would need about ${estimate} cells; the limit is ${MAX_SITES}. Use larger cells or a smaller swatch.`]);
  }
  const points = sites(box, { spacing, relax, seed, tone });
  const toLayer = (edges) => chainPolylines(trailsFromEdges(edges).flatMap((t) => clipPolyline(densify(t), boundary)), boundary, spacing);
  if (whole && isBox(boundary)) {
    // whole cells (repeats.js): every site mirrored across each edge, so the edge itself is a wall of the lace (the
    // wall between a site and its mirror image lies on it). The cells along the edge are closed there, with their walls
    // meeting it square on, instead of being cut open; a little in from the edge so the wall is printed whole.
    const m = 0.3;
    const inner = { minX: box.minX + m, minY: box.minY + m, maxX: box.maxX - m, maxY: box.maxY - m };
    const mirrors = points.flatMap((p) => [
      { x: 2 * inner.minX - p.x, y: p.y }, { x: 2 * inner.maxX - p.x, y: p.y },
      { x: p.x, y: 2 * inner.minY - p.y }, { x: p.x, y: 2 * inner.maxY - p.y },
    ]);
    const { delaunay: dEdges, voronoi: vEdges } = tessellate([...points, ...mirrors], inner, { count: points.length });
    const own = new Set(points);
    // the first layer joins the real sites only
    return { layers: [toLayer(dEdges.filter(([a, b]) => own.has(a) && own.has(b))), toLayer(vEdges)], extra: { sites: points.length } };
  }
  const { delaunay: dEdges, voronoi: vEdges } = tessellate(points, box);
  return { layers: [toLayer(dEdges), toLayer(vEdges)], extra: { sites: points.length } };
}

/** Flat Voronoi cell walls, optionally closed by the swatch perimeter. Shares the exact site/tessellation path above. */
export function voronoiCellsLayers(boundary,{spacing=8,relax=4,seed=1,tone=null,border=true}={}){
  const lace=voronoiLayers(boundary,{spacing,relax,seed,tone,whole:true});
  const walls=lace.layers[1];
  for(const p of walls)p.family='cells';
  const outline=border?(boundary.rings??[]).map(r=>{
    const cx=r.reduce((n,p)=>n+p.x,0)/r.length,cy=r.reduce((n,p)=>n+p.y,0)/r.length;
    const inset=r.map(p=>{const d=Math.hypot(cx-p.x,cy-p.y),step=Math.min(.6,d*.08);return d?{x:p.x+(cx-p.x)*step/d,y:p.y+(cy-p.y)*step/d}:p;});
    const path=densify([...inset,inset[0]]);path.family='border';return path;
  }):[];
  const paths=[...walls,...outline],{found}=findCrossings(paths.map((p)=>({pts:p.map((q)=>({...q,z:0}))})),{strandWidth:.45,cell:1});
  found.forEach((crossing,index)=>{
    const id=`voronoi-cell-node:${index}`;
    for(const pathIndex of [crossing.sa,crossing.sb]){paths[pathIndex].joints??=[];paths[pathIndex].joints.push({id,x:crossing.x,y:crossing.y});}
  });
  const layers=[paths];layers.families=['cells','border'];
  layers.extra={families:layers.families,sites:lace.extra.sites,border};
  return layers;
}
