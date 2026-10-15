import { createRng } from './rng.js';
import { ConfigError } from './params.js';
import { clipPolyline, chainPolylines } from './layers.js';
import { delaunay } from './voronoi.js';

/**
 * Bubbles: a packing of circles of mixed sizes (Plotcaster's "Bubbles"), made into a fabric. The first layer prints
 * every circle; neighbouring circles are joined, at the point where they nearly touch, by a short double bridge, so
 * one strand tours a whole cluster of circles (the outline of a tree of circles is one closed curve). The second
 * layer puts a small circle in every gap between three neighbours, centred on their radical centre and sized so it
 * meets each of the three at a right angle: the one circle that is orthogonal to all three (made smaller where the
 * three are of mixed sizes, but always reaching into each). So every bubble is held by the circles in the gaps round
 * it, and each of those crosses three bubbles.
 */

const TAU = Math.PI * 2;
export const MAX_BUBBLES = 8000;

const circle = (c, r, from = 0, to = TAU, step = 0.5) => {
  const n = Math.max(8, Math.ceil((Math.abs(to - from) * r) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
};

/** How far a point is from the nearest edge of the outline. */
export function edgeDistance(boundary, x, y) {
  let best = Infinity;
  for (const ring of boundary.rings ?? []) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
    }
  }
  return best;
}

/**
 * Circles of mixed sizes packed until no gap is left that would take another: first a scatter of random circles
 * (each as large as fits, up to a random fraction of the largest size), then the largest empty circle is filled
 * again and again, found on a grid of distances to the nearest circle, until the largest gap is too small.
 * Every circle is whole: it keeps `edge` mm inside the outline (repeats.js), so the edge of the swatch is a row of
 * whole bubbles against it, none cut in half.
 */
export function packCircles(boundary, { size = 4, gap = 0.6, seed = 1, tone = null, edge = 0.5 } = {}) {
  const rng = createRng(seed);
  const box = boundary.bbox();
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const maxAt = (x, y) => (tone ? size * (1.3 - 0.7 * Math.max(0, Math.min(1, tone(x - box.minX, y - box.minY, w, h)))) : size);
  const rMin = Math.max(1, 0.2 * size);
  const estimate = (w * h) / (Math.PI * (0.65 * size) ** 2); // about one bubble per π(0.65·size)² of swatch
  if (estimate > MAX_BUBBLES) throw new ConfigError([`This would need about ${Math.round(estimate)} bubbles; the limit is ${MAX_BUBBLES}. Use larger bubbles or a smaller swatch.`]);

  // room[i]: how large a circle centred on grid point i could be (distance to the nearest circle, less the gap, and to
  // the edge of the outline, less `edge`)
  const step = Math.max(0.4, size / 8);
  const nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1;
  const room = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = box.minX + i * step, y = box.minY + j * step;
      room[j * nx + i] = boundary.contains(x, y) ? edgeDistance(boundary, x, y) - edge : -1;
    }
  }
  const out = [];
  const place = (c) => {
    out.push(c);
    if (out.length > MAX_BUBBLES) throw new ConfigError([`This would need more than ${MAX_BUBBLES} bubbles; use larger bubbles or a smaller swatch.`]);
    const reach = c.r + gap + 1.3 * size;
    const i0 = Math.max(0, Math.floor((c.x - reach - box.minX) / step)), i1 = Math.min(nx - 1, Math.ceil((c.x + reach - box.minX) / step));
    const j0 = Math.max(0, Math.floor((c.y - reach - box.minY) / step)), j1 = Math.min(ny - 1, Math.ceil((c.y + reach - box.minY) / step));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * nx + i;
        if (room[k] < 0) continue;
        const d = Math.hypot(box.minX + i * step - c.x, box.minY + j * step - c.y) - c.r - gap;
        if (d < room[k]) room[k] = d;
      }
    }
  };
  const roomAt = (x, y) => {
    const i = Math.round((x - box.minX) / step), j = Math.round((y - box.minY) / step);
    return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : room[j * nx + i];
  };

  // a random scatter, so the packing has no rows
  for (let t = 0; t < estimate * 3; t++) {
    const x = box.minX + rng.next() * w, y = box.minY + rng.next() * h;
    const free = roomAt(x, y) - step; // the grid is coarse: keep a grid step clear
    const r = Math.min(maxAt(x, y) * (0.55 + 0.45 * rng.next()), free);
    if (r >= rMin) place({ x, y, r });
  }
  // then the largest gaps, until none is left that takes a circle
  for (;;) {
    let best = -1, bk = -1;
    for (let k = 0; k < room.length; k++) if (room[k] > best) { best = room[k]; bk = k; }
    if (bk < 0 || best < rMin) break;
    const x = box.minX + (bk % nx) * step, y = box.minY + Math.floor(bk / nx) * step;
    place({ x, y, r: Math.min(maxAt(x, y), best) });
  }
  return out;
}

/** The circle orthogonal to three circles: centred on their radical centre, radius the square root of its power. */
export function orthogonalCircle(a, b, c) {
  // power(p, k) = |p - k|² - r² is equal for all three: two linear equations in p
  const eq = (u, v) => [2 * (v.x - u.x), 2 * (v.y - u.y), v.x * v.x + v.y * v.y - v.r * v.r - (u.x * u.x + u.y * u.y - u.r * u.r)];
  const [a1, b1, c1] = eq(a, b), [a2, b2, c2] = eq(a, c);
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) return null;
  const p = { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  const power = (p.x - a.x) ** 2 + (p.y - a.y) ** 2 - a.r * a.r;
  return power > 0 ? { x: p.x, y: p.y, r: Math.sqrt(power) } : null;
}

/**
 * One closed tour of a tree of circles: round each circle anticlockwise, and at every child a bridge out, the
 * child's own tour, and a bridge back, the two bridges about `width` apart. The tour starts in the widest gap between
 * the root's children. A child with no room for its bridges (too close to a neighbour's, or to the way back to the
 * parent) is not bridged: its index goes into `unbridged`, so its branch is toured on its own instead of lost.
 */
function tour(circles, children, root, width, unbridged = []) {
  const pts = [];
  const half = (r) => Math.asin(Math.min(0.9, width / 2 / r));
  const arc = (c, from, to) => pts.push(...circle(c, c.r, from, to).slice(pts.length ? 1 : 0));
  // round circle i from angle `from` to `to`, detouring into each child on the way
  const walk = (i, from, to) => {
    const c = circles[i];
    const kids = children[i]
      .map((j) => {
        const a = Math.atan2(circles[j].y - c.y, circles[j].x - c.x);
        return { j, a: from + ((((a - from) % TAU) + TAU) % TAU) };
      })
      .sort((p, q) => p.a - q.a);
    const d = half(c.r);
    let at = from;
    for (const k of kids) {
      if (k.a - d < at || k.a + d > to) { unbridged.push(k.j); continue; }
      arc(c, at, k.a - d);
      // out on the right of the line between the centres, round the child, back on the left
      const child = circles[k.j], back = k.a + Math.PI, dc = half(child.r);
      walk(k.j, back + dc, back + TAU - dc);
      at = k.a + d;
    }
    arc(c, at, to);
  };
  const c0 = circles[root];
  const angles = children[root].map((j) => Math.atan2(circles[j].y - c0.y, circles[j].x - c0.x)).sort((p, q) => p - q);
  let start = 0, widest = -1;
  angles.forEach((a, k) => {
    const next = k + 1 < angles.length ? angles[k + 1] : angles[0] + TAU;
    if (next - a > widest) { widest = next - a; start = (a + next) / 2; }
  });
  walk(root, start, start + TAU);
  return pts;
}

/**
 * @param size  mm: the largest bubble radius (smaller ones fill the gaps)
 * @param tone  optional field (x, y, w, h) → 0..1: smaller bubbles where it is bright
 * @param link  join neighbouring bubbles into one strand per cluster (otherwise every bubble is its own loop)
 */
export function bubblesLayers(boundary, { size = 4, gap = 0.6, seed = 1, tone = null, link = true, strandWidth = 0.45 } = {}) {
  const circles = packCircles(boundary, { size, gap, seed, tone });
  if (circles.length < 3) throw new ConfigError(['The swatch is too small for bubbles this size.']);

  // layer 2, the backing: a ring in each gap between three neighbours (Delaunay triangles of the centres), centred
  // where it meets all three at a right angle. Each is made to reach well into its three bubbles, so neighbouring rings
  // overlap one another round every bubble and the backing is one connected mesh that holds the bubbles from all
  // sides. A ring near the edge is made small enough to stay whole inside it, like the bubbles.
  const tris = delaunay(circles);
  const bite = 1.5 * strandWidth; // the least a backing ring reaches into each of its bubbles
  const gaps = [];
  for (const [i, j, k] of tris) {
    const a = circles[i], b = circles[j], c = circles[k];
    const orth = orthogonalCircle(a, b, c);
    if (!orth || !boundary.contains(orth.x, orth.y)) continue;
    // a little past the right-angle circle, so it overlaps the rings in the neighbouring gaps, and never less than a
    // bite into the furthest of the three (a tight gap's right-angle circle is small); where they are of mixed sizes
    // that circle can be larger than the gap, and it is held to reach `depth` into the furthest
    const far = Math.max(...[a, b, c].map((q) => Math.hypot(orth.x - q.x, orth.y - q.y) - q.r));
    const depth = Math.max(bite, Math.min(2, 0.5 * Math.min(a.r, b.r, c.r)));
    const o = { x: orth.x, y: orth.y, r: Math.min(Math.max(1.2 * orth.r, far + bite), far + depth, edgeDistance(boundary, orth.x, orth.y) - 0.5) };
    if (o.r < Math.max(0.8, far + 0.2) || o.r > 1.6 * Math.max(a.r, b.r, c.r)) continue;
    // four bubbles round one gap give two triangles with almost the same circle: keep one
    const twin = gaps.findIndex((g) => Math.hypot(g.x - o.x, g.y - o.y) < 0.25 * Math.max(g.r, o.r));
    if (twin < 0) gaps.push(o);
    else if (o.r > gaps[twin].r) gaps[twin] = o;
  }
  // a bubble against the edge has no gap of three on its outer side, so its outer arc would run on uncrossed: a ring
  // in the gap between it and each neighbour along the edge crosses both, wherever that ring fits whole
  const againstEdge = (q) => edgeDistance(boundary, q.x, q.y) - q.r < Math.max(2, 0.5 * q.r);
  for (const [i, j, k] of tris) {
    for (const [p, q] of [[i, j], [j, k], [k, i]]) {
      if (p > q) continue;
      const a = circles[p], b = circles[q];
      if (!againstEdge(a) || !againstEdge(b)) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y), apart = d - a.r - b.r;
      if (apart > Math.min(a.r, b.r)) continue;
      const t = (a.r + apart / 2) / d;
      const o = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (gaps.some((g) => Math.hypot(g.x - o.x, g.y - o.y) < 0.8 * g.r)) continue; // already crossed there
      const r = Math.min(apart / 2 + Math.max(bite, Math.min(1.6, 0.4 * Math.min(a.r, b.r))), edgeDistance(boundary, o.x, o.y) - 0.5);
      if (r >= Math.max(0.8, apart / 2 + bite)) gaps.push({ x: o.x, y: o.y, r });
    }
  }

  // layer 1: each bubble, or one tour per cluster of bubbles that nearly touch (a spanning tree of the neighbours)
  let rings;
  if (link) {
    const width = Math.max(1, 2.5 * strandWidth);
    const edges = [];
    for (const [i, j, k] of tris) {
      for (const [p, q] of [[i, j], [j, k], [k, i]]) {
        const d = Math.hypot(circles[p].x - circles[q].x, circles[p].y - circles[q].y) - circles[p].r - circles[q].r;
        if (d < gap + 1.2 && p < q) edges.push({ p, q, d });
      }
    }
    edges.sort((e, f) => e.d - f.d);
    const parent = circles.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const adj = circles.map(() => []);
    for (const e of edges) {
      const a = find(e.p), b = find(e.q);
      if (a === b) continue;
      parent[a] = b;
      adj[e.p].push(e.q);
      adj[e.q].push(e.p);
    }
    // root each tree at its first circle; children are the neighbours further from the root
    const seen = new Array(circles.length).fill(false);
    const children = circles.map(() => []);
    const roots = [];
    for (let r = 0; r < circles.length; r++) {
      if (seen[r]) continue;
      roots.push(r);
      seen[r] = true;
      const stack = [r];
      while (stack.length) {
        const i = stack.pop();
        for (const j of adj[i]) if (!seen[j]) { seen[j] = true; children[i].push(j); stack.push(j); }
      }
    }
    // a branch that could not be bridged into its parent is toured as a cluster of its own
    rings = [];
    const queue = [...roots];
    while (queue.length) {
      const unbridged = [];
      rings.push(tour(circles, children, queue.shift(), width, unbridged));
      queue.push(...unbridged);
    }
  } else {
    rings = circles.map((c) => circle(c, c.r));
  }
  const clip = (list) => list.flatMap((pts) => clipPolyline(pts, boundary));
  const layers = [chainPolylines(clip(rings), boundary, 0), chainPolylines(clip(gaps.map((g) => circle(g, g.r))), boundary, 0)];
  return { layers, extra: { bubbles: circles.length, gaps: gaps.length } };
}
