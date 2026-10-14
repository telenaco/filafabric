import { hatch, clipPolyline } from './layers.js';
import { createRng } from './rng.js';
import { sites } from './voronoi.js';
import { ConfigError } from './params.js';

/**
 * Meanders: a space-filling curve (Hilbert or Peano) as one continuous strand that never crosses itself, and an
 * independent hatch across it at an angle as the second layer. The curve folds back and forth, so it stretches by
 * unfolding (hidden slack) and reads as lace; the hatch crosses every fold so no stretch of curve goes unheld.
 */
export const CURVES = Object.freeze({
  hilbert: { label: 'Hilbert', hint: 'Tight folds of 90°, in a square grid of 2ⁿ cells' },
  peano: { label: 'Peano', hint: 'Long serpentines of 3 x 3 cells, in a grid of 3ⁿ' },
  maze: { label: 'Maze', hint: 'A random closed meander that walks round a maze, a different one for every seed' },
  tsp: { label: 'Stipple tour', hint: 'One loop through scattered dots, denser where a pattern is bright' },
});
export const CURVE_IDS = Object.freeze(Object.keys(CURVES));

/** The Hilbert curve of order n as grid cells (i, j) in 0..2ⁿ-1, in visiting order. */
export function hilbertCells(order) {
  const n = 1 << order;
  const cells = [];
  for (let d = 0; d < n * n; d++) {
    let x = 0, y = 0, t = d;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t >> 1);
      const ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
        [x, y] = [y, x];
      }
      x += s * rx;
      y += s * ry;
      t >>= 2;
    }
    cells.push({ x, y });
  }
  return cells;
}

/** The Peano curve of order n as grid cells in 0..3ⁿ-1, in visiting order. */
export function peanoCells(order) {
  if (order === 0) return [{ x: 0, y: 0 }];
  const sub = peanoCells(order - 1);
  const m = 3 ** (order - 1);
  const out = [];
  for (let bx = 0; bx < 3; bx++) {
    for (let k = 0; k < 3; k++) {
      const by = bx % 2 === 0 ? k : 2 - k;
      for (const c of sub) {
        const x = by % 2 === 1 ? m - 1 - c.x : c.x; // reflected across x in odd rows of blocks
        const y = bx % 2 === 1 ? m - 1 - c.y : c.y; // reflected across y in odd columns
        out.push({ x: bx * m + x, y: by * m + y });
      }
    }
  }
  return out;
}

/**
 * A random closed meander on a 2ⁿ x 2ⁿ grid: grow a random spanning tree over the 2ⁿ⁻¹ x 2ⁿ⁻¹ blocks of four cells, then
 * walk round it. Each block starts as a little square of four cells; every tree edge swaps two edges between
 * neighbouring squares to merge them, so the result is one cycle through every cell and, being the outline of a tree,
 * it never crosses itself. The same seed gives the same maze.
 */
export function mazeCells(order, seed = 1) {
  const m = 1 << Math.max(0, order - 1); // blocks per side
  const n = 2 * m;
  const rng = createRng(seed);
  const id = (x, y) => y * n + x;
  const adj = Array.from({ length: n * n }, () => new Set());
  const link = (a, b) => { adj[a].add(b); adj[b].add(a); };
  const cut = (a, b) => { adj[a].delete(b); adj[b].delete(a); };
  for (let by = 0; by < m; by++) {
    for (let bx = 0; bx < m; bx++) {
      const x = 2 * bx, y = 2 * by;
      link(id(x, y), id(x + 1, y)); link(id(x + 1, y), id(x + 1, y + 1)); link(id(x + 1, y + 1), id(x, y + 1)); link(id(x, y + 1), id(x, y));
    }
  }
  // a random depth-first spanning tree of the blocks
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const bx = cur % m, by = Math.floor(cur / m);
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [bx + dx, by + dy, dx, dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < m && y < m && !seen.has(y * m + x));
    if (options.length === 0) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = options[Math.floor(rng.next() * options.length)];
    seen.add(ny * m + nx);
    stack.push(ny * m + nx);
    // merge the two squares: swap the facing edges for two edges that cross between them
    const ax = 2 * bx, ay = 2 * by, cx = 2 * nx, cy = 2 * ny;
    if (dx === 1) { cut(id(ax + 1, ay), id(ax + 1, ay + 1)); cut(id(cx, cy), id(cx, cy + 1)); link(id(ax + 1, ay), id(cx, cy)); link(id(ax + 1, ay + 1), id(cx, cy + 1)); }
    else if (dx === -1) { cut(id(ax, ay), id(ax, ay + 1)); cut(id(cx + 1, cy), id(cx + 1, cy + 1)); link(id(ax, ay), id(cx + 1, cy)); link(id(ax, ay + 1), id(cx + 1, cy + 1)); }
    else if (dy === 1) { cut(id(ax, ay + 1), id(ax + 1, ay + 1)); cut(id(cx, cy), id(cx + 1, cy)); link(id(ax, ay + 1), id(cx, cy)); link(id(ax + 1, ay + 1), id(cx + 1, cy)); }
    else { cut(id(ax, ay), id(ax + 1, ay)); cut(id(cx, cy + 1), id(cx + 1, cy + 1)); link(id(ax, ay), id(cx, cy + 1)); link(id(ax + 1, ay), id(cx + 1, cy + 1)); }
  }
  // walk the cycle
  const cells = [];
  let prev = -1, cur = 0;
  do {
    cells.push({ x: cur % n, y: Math.floor(cur / n) });
    const next = [...adj[cur]].find((v) => v !== prev) ?? [...adj[cur]][0];
    prev = cur;
    cur = next;
  } while (cur !== 0 && cells.length <= n * n);
  return cells;
}

/**
 * One closed tour through the points: nearest neighbour first, then 2-opt until no swap shortens it. A tour that
 * cannot be shortened by swapping two edges does not cross itself.
 */
export function tspTour(points) {
  const n = points.length;
  if (n < 3) return points.map((p) => ({ x: p.x, y: p.y }));
  const d = (a, b) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
  const left = new Set(Array.from({ length: n }, (_, i) => i));
  let start = 0;
  for (let i = 1; i < n; i++) if (points[i].x < points[start].x) start = i;
  const tour = [start];
  left.delete(start);
  while (left.size) {
    const cur = tour[tour.length - 1];
    let best = -1, bd = Infinity;
    for (const i of left) {
      const di = d(cur, i);
      if (di < bd) { bd = di; best = i; }
    }
    tour.push(best);
    left.delete(best);
  }
  for (let pass = 0, improved = true; improved && pass < 100; pass++) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const a = tour[i], b = tour[i + 1], c = tour[j], e = tour[(j + 1) % n];
        if (d(a, c) + d(b, e) < d(a, b) + d(c, e) - 1e-9) {
          for (let lo = i + 1, hi = j; lo < hi; lo++, hi--) [tour[lo], tour[hi]] = [tour[hi], tour[lo]];
          improved = true;
        }
      }
    }
  }
  return tour.map((i) => ({ x: points[i].x, y: points[i].y }));
}

/** One round of Chaikin corner cutting on an open polyline (the ends stay put). */
function chaikin(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (i > 1) out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    if (i < pts.length - 1) out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** The order that makes the cells about `cell` mm across over the larger side. */
export function curveOrder(curve, size, cell) {
  const base = curve === 'peano' ? 3 : 2;
  return Math.max(1, Math.min(curve === 'peano' ? 4 : 6, Math.round(Math.log(Math.max(size / cell, base)) / Math.log(base))));
}

/**
 * @param curve    'hilbert' | 'peano'
 * @param cell     target cell size in mm (the curve's strand spacing)
 * @param angle    angle of the second layer's hatch, degrees
 * @param spacing  spacing of the hatch, mm
 */
export const MAX_TOUR_POINTS = 600;

export function meanderLayers(boundary, { curve = 'hilbert', cell = 6, angle = 45, spacing = 5, seed = 1, tone = null } = {}) {
  if (!CURVES[curve]) throw new Error(`Unknown meander curve: ${curve}`);
  const box = boundary.bbox();
  if (curve === 'tsp') {
    const estimate = Math.ceil(((box.maxX - box.minX) * (box.maxY - box.minY)) / (cell * cell));
    if (estimate > MAX_TOUR_POINTS) {
      throw new ConfigError([`This would need about ${estimate} dots; the limit is ${MAX_TOUR_POINTS}. Use larger cells or a smaller swatch.`]);
    }
    const dots = sites(box, { spacing: cell, relax: 2, seed, tone });
    const tour = tspTour(dots);
    tour.push({ ...tour[0] });
    return { layers: [clipPolyline(chaikin(tour), boundary), hatch(boundary, { angle, spacing })], extra: { dots: dots.length } };
  }
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const order = curveOrder(curve, Math.max(w, h), cell);
  const cells = curve === 'peano' ? peanoCells(order) : curve === 'maze' ? mazeCells(order, seed) : hilbertCells(order);
  const n = curve === 'peano' ? 3 ** order : 1 << order;
  let pts = cells.map((c) => ({ x: box.minX + ((c.x + 0.5) * w) / n, y: box.minY + ((c.y + 0.5) * h) / n }));
  // round the corners so the strand turns instead of stopping dead
  pts = chaikin(chaikin(pts));
  const layer1 = clipPolyline(pts, boundary);
  const layer2 = hatch(boundary, { angle, spacing });
  return { layers: [layer1, layer2], extra: { order, cells: n } };
}
