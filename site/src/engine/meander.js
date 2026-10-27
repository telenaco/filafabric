import { clipPolyline } from './layers.js';
import { backingStack, carrierLayers } from './backing.js';
import { createRng } from './rng.js';
import { sites } from './voronoi.js';
import { ConfigError } from './params.js';
import { attachMotifs, cellSeed, nativeBorders } from './repair-geometry.js';

/**
 * Meanders: a space-filling curve (Hilbert, Peano, Moore, Sierpiński, Gosper, a maze or a tour through dots) as one
 * continuous strand that never crosses itself, and an independent hatch across it at an angle as the second layer.
 * The curve folds back and forth, so it stretches by unfolding (hidden slack) and reads as lace; the hatch crosses
 * every fold so no stretch of curve goes unheld.
 */
export const CURVES = Object.freeze({
  hilbert: { label: 'Hilbert', hint: 'Tight folds of 90°, in a square grid of 2ⁿ cells' },
  peano: { label: 'Peano', hint: 'Long serpentines of 3 x 3 cells, in a grid of 3ⁿ' },
  maze: { label: 'Maze', hint: 'A random closed meander that walks round a maze, a different one for every seed' },
  tsp: { label: 'Stipple tour', hint: 'One loop through scattered dots, denser where a pattern is bright' },
  moore: { label: 'Moore', hint: 'The Hilbert curve closed into a loop: no loose ends' },
  sierpinski: { label: 'Sierpiński', hint: 'A closed loop of 45° zigzags, like a lattice of diamonds' },
  gosper: { label: 'Gosper', hint: 'The flowsnake: folds of 60° on a hexagonal grid, like fish scales' },
});

/** Space-filling curves written as L-systems: a turtle draws forward on the `draw` letters and turns on + and -. */
export const LSYSTEMS = Object.freeze({
  moore: { axiom: 'LFL+F+LFL', rules: { L: '-RF+LFL+FR-', R: '+LF-RFR-FL+' }, angle: 90, draw: 'F' },
  sierpinski: { axiom: 'F--XF--F--XF', rules: { X: 'XF+G+XF--F--XF+G+X' }, angle: 45, draw: 'FG' },
  gosper: { axiom: 'A', rules: { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' }, angle: 60, draw: 'AB' },
});

/** The points of an L-system curve after `iterations` rewrites, one unit per step. */
export function lsystemCurve(id, iterations) {
  const sys = LSYSTEMS[id];
  let word = sys.axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (let c = 0; c < word.length; c++) {
      const ch = word[c];
      next += sys.rules[ch] ?? ch;
    }
    word = next;
  }
  const turn = (sys.angle * Math.PI) / 180;
  let x = 0, y = 0, a = 0;
  const pts = [{ x, y }];
  for (let c = 0; c < word.length; c++) {
    const ch = word[c];
    if (sys.draw.includes(ch)) {
      x += Math.cos(a);
      y += Math.sin(a);
      pts.push({ x: Math.round(x * 1e9) / 1e9, y: Math.round(y * 1e9) / 1e9 });
    } else if (ch === '+') a += turn;
    else if (ch === '-') a -= turn;
  }
  return pts;
}

const extent = (pts) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY };
};

/**
 * The curve that fills the box with folds about `cell` mm apart. Moore and Sierpiński fill a square, so they are
 * stretched to the box like the Hilbert curve; the Gosper curve fills a ragged hexagonal island, so it is drawn at
 * its true size, made large enough to cover the box, and clipped.
 */
function lsystemFill(curve, box, cell) {
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  if (curve === 'gosper') {
    const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
    for (let it = 1; it <= 5; it++) {
      const raw = lsystemCurve('gosper', it);
      const mid = raw.reduce((m, p) => ({ x: m.x + p.x / raw.length, y: m.y + p.y / raw.length }), { x: 0, y: 0 });
      const pts = raw.map((p) => ({ x: cx + (p.x - mid.x) * cell, y: cy + (p.y - mid.y) * cell }));
      // it covers the box once every point of the box is near the curve
      const grid = new Map();
      for (const p of pts) grid.set(`${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`, true);
      let covered = true;
      for (let y = box.minY; y <= box.maxY && covered; y += cell) {
        for (let x = box.minX; x <= box.maxX; x += cell) {
          const i = Math.floor(x / cell), j = Math.floor(y / cell);
          let near = false;
          for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1 && !near; b++) near = grid.has(`${i + a},${j + b}`);
          if (!near) { covered = false; break; }
        }
      }
      if (covered || it === 5) return { pts, order: it };
    }
  }
  // Moore and Sierpiński: the iteration whose folds come closest to `cell` apart once stretched to the box (a curve
  // that fills an area A with length L has its folds about A / L apart), then stretched to fill the box
  let best = null;
  for (let it = 1; it <= 7; it++) {
    let raw = lsystemCurve(curve, it);
    // the Sierpiński curve fills a square standing on its corner: turn it to lie flat
    if (curve === 'sierpinski') raw = raw.map((p) => ({ x: (p.x - p.y) / Math.SQRT2, y: (p.x + p.y) / Math.SQRT2 }));
    const e = extent(raw);
    const sx = w / Math.max(1e-9, e.maxX - e.minX), sy = h / Math.max(1e-9, e.maxY - e.minY);
    const apart = (w * h) / ((raw.length - 1) * Math.sqrt(sx * sy));
    const fit = Math.abs(Math.log(apart / cell));
    if (!best || fit < best.fit) best = { raw, e, fit, it };
    if (apart < cell / 2 || raw.length > 40000) break;
  }
  const { raw, e } = best;
  const edge = 0.4;
  const pts = raw.map((p) => ({
    x: box.minX + edge + ((p.x - e.minX) * (w - 2 * edge)) / Math.max(1e-9, e.maxX - e.minX),
    y: box.minY + edge + ((p.y - e.minY) * (h - 2 * edge)) / Math.max(1e-9, e.maxY - e.minY),
  }));
  return { pts, order: best.it };
}
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
export function mazeCells(order, seed = 1, legacy = false) {
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
    const choice = legacy ? rng.next() : createRng(cellSeed(seed,bx,by)).next();
    const [nx, ny, dx, dy] = options[Math.floor(choice * options.length)];
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
  if (pts.length > 20000) return pts;
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
export const MAX_TOUR_POINTS = 1500;

export function meanderLayers(boundary, { curve = 'hilbert', cell = 6, angle = 45, spacing = 5, seed = 1, tone = null, backing = 'straight', backingDepth = 2, backingLength = 10, backingLayers = 'one', support = null, bead=.45, legacy=false } = {}) {
  const stack = () => support ? carrierLayers(boundary, support) : backingStack(boundary, { style: backing, angle, spacing, depth: backingDepth, wavelength: backingLength }, backingLayers);
  const finish=(paths,extra)=>{
    const carriers=stack();
    if(legacy)return {layers:[paths,...carriers],extra};
    let attached=attachMotifs(paths,carriers,boundary,{bead,reach:Math.max(cell,spacing)*4}),edgeCarrier=false;
    if(attached.unattached&&carriers.length){
      // Clipped edge fragments cannot extend out of the outline. Close the selected carrier
      // at its perimeter instead, so both clipped ends meet designed support inside the sheet.
      const last=carriers.at(-1),family=last[0]?.family??`carrier-${carriers.length}`;
      last.push(...nativeBorders(boundary,bead,family).map(path=>Object.assign(path,{role:'carrier'})));
      attached=attachMotifs(paths,carriers,boundary,{bead,reach:Math.max(cell,spacing)*4});edgeCarrier=true;
    }
    if(attached.unattached)throw new ConfigError([`${attached.unattached} long Meander fragments cannot reach two carrier contacts inside the outline. Use a denser or crossed two-layer Support carrier.`]);
    return {layers:[attached.paths,...carriers],extra:{...extra,attachment:{dropped:attached.dropped,extended:attached.extended,unattached:attached.unattached,edgeCarrier}},warnings:[...(attached.dropped||attached.extended?[`Carrier attachment: ${attached.dropped} fragments dropped, ${attached.extended} extended.`]:[]),...(edgeCarrier?['The Support carrier includes a perimeter to anchor clipped edge fragments.']:[])]};
  };
  if (!CURVES[curve]) throw new Error(`Unknown meander curve: ${curve}`);
  const box = boundary.bbox();
  if (curve === 'tsp') {
    const estimate = Math.ceil(((box.maxX - box.minX) * (box.maxY - box.minY)) / (cell * cell));
    if (estimate > MAX_TOUR_POINTS) {
      throw new ConfigError([`This would need about ${estimate} dots; the limit is ${MAX_TOUR_POINTS}. Use larger cells or a smaller swatch.`]);
    }
    const dots = legacy ? sites(box, { spacing: cell, relax: 2, seed, tone }) : [];
    if(!legacy)for(let j=Math.floor(box.minY/cell);j<Math.ceil(box.maxY/cell);j++)for(let i=Math.floor(box.minX/cell);i<Math.ceil(box.maxX/cell);i++){
      const rng=createRng(cellSeed(seed,i,j)),x=(i+.2+.6*rng.next())*cell,y=(j+.2+.6*rng.next())*cell;
      if(boundary.contains(x,y)&&(!tone||rng.next()<.25+.75*tone(x,y)))dots.push({x,y});
    }
    if(dots.length<2)return finish([],{dots:dots.length});
    const tour = tspTour(dots);
    tour.push({ ...tour[0] });
    return finish(clipPolyline(chaikin(tour), boundary),{dots:dots.length});
  }
  if (LSYSTEMS[curve]) {
    const { pts, order } = lsystemFill(curve, box, cell);
    return finish(clipPolyline(chaikin(chaikin(pts)), boundary),{order,cells:pts.length});
  }
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const order = curveOrder(curve, Math.max(w, h), cell);
  const cells = curve === 'peano' ? peanoCells(order) : curve === 'maze' ? mazeCells(order, seed, legacy) : hilbertCells(order);
  const n = curve === 'peano' ? 3 ** order : 1 << order;
  // cell centres run (almost) edge to edge, so the curve reaches the border and the hatch there is held too
  const edge = 0.4;
  const span = Math.max(1, n - 1);
  let pts = cells.map((c) => ({ x: box.minX + edge + (c.x * (w - 2 * edge)) / span, y: box.minY + edge + (c.y * (h - 2 * edge)) / span }));
  // round the corners so the strand turns instead of stopping dead
  pts = chaikin(chaikin(pts));
  const layer1 = clipPolyline(pts, boundary);
  return finish(layer1,{order,cells:n});
}

/** The point on segment a-b nearest to p. */
function nearestOnSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const u = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return { x: a.x + u * dx, y: a.y + u * dy };
}

/** True when segments p1-p2 and p3-p4 cross at a point inside both; touching at an end does not count. */
function segmentsCross(p1, p2, p3, p4) {
  const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return side(p3, p4, p1) * side(p3, p4, p2) < 0 && side(p1, p2, p3) * side(p1, p2, p4) < 0;
}

/**
 * A backing-free meander held together by designed in-plane ties between nearby parallel folds. Ties start at stations
 * every `tieInterval` mm along each run (not at every point of its rounded corners, which would pile them on top of one
 * another), run straight across the gap to the nearest fold beside it, and are dropped when they would cross the curve,
 * another tie, or sit closer to a tie than half the interval. The ties are native geometry, so the result stays one
 * layer: a tie meets the curve end-on and nothing is stacked.
 */
export function meanderTiesLayers(boundary, { curve = 'hilbert', cell = 6, angle = 45, tieInterval = 6, tieLength = null, seed = 1, bead = 0.45 } = {}) {
  const interval = Math.max(2, Math.min(20, Number(tieInterval) || 6)), width = Math.max(0.45, Number(bead) || 0.45);
  const reach = cell * 1.2;
  const base = meanderLayers(boundary, { curve, cell, angle, seed, backing: 'straight', backingLayers: 'one', legacy:true }).layers[0];
  const runs = base.filter((path) => path.length >= 2).map((path, i) => {
    const run = path.map((p) => ({ ...p }));
    run.family = 'curve'; run.role = 'native'; run.runId = i;
    return run;
  });

  // every piece of every run, with how far along its run it starts, so a tie can skip folds the curve itself already joins
  const byRun = runs.map(() => []);
  const lengths = runs.map(() => 0);
  runs.forEach((run, r) => {
    let arc = 0;
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], b = run[i], length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > 1e-6) byRun[r].push({ r, a, b, length, arc, ux: (b.x - a.x) / length, uy: (b.y - a.y) / length, stamp: 0 });
      arc += length;
    }
    lengths[r] = arc;
  });

  // a coarse grid of the pieces, so that finding the folds beside a station does not scan the whole curve
  const grid = new Map();
  const slot = (i, j) => i * 65537 + j;
  for (const s of byRun.flat()) {
    for (let i = Math.floor(Math.min(s.a.x, s.b.x) / reach); i <= Math.floor(Math.max(s.a.x, s.b.x) / reach); i++) {
      for (let j = Math.floor(Math.min(s.a.y, s.b.y) / reach); j <= Math.floor(Math.max(s.a.y, s.b.y) / reach); j++) {
        if (!grid.has(slot(i, j))) grid.set(slot(i, j), []);
        grid.get(slot(i, j)).push(s);
      }
    }
  }
  let stamp = 0;
  const piecesNear = (x0, y0, x1, y1) => {
    const found = [];
    stamp++;
    for (let i = Math.floor(x0 / reach); i <= Math.floor(x1 / reach); i++) {
      for (let j = Math.floor(y0 / reach); j <= Math.floor(y1 / reach); j++) {
        for (const s of grid.get(slot(i, j)) ?? []) if (s.stamp !== stamp) { s.stamp = stamp; found.push(s); }
      }
    }
    return found;
  };

  const ties = [], mids = [], tied = new Set();
  /** Tries the ties from `p` on piece `s`, nearest fold first, and keeps the first that is clear of everything. */
  const tryTie = (s, p, minSpacing) => {
    const candidates = [];
    for (const other of piecesNear(p.x - reach, p.y - reach, p.x + reach, p.y + reach)) {
      if (Math.abs(s.ux * other.ux + s.uy * other.uy) < 0.8) continue; // only folds that run alongside
      if (other.r === s.r && Math.abs(other.arc - s.arc) < 2 * cell) continue; // the curve already joins these
      const q = nearestOnSegment(p, other.a, other.b), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d >= 1.5 * width && d <= reach) candidates.push({ q, d, other });
    }
    candidates.sort((x, y) => x.d - y.d);
    for (const { q, d, other } of candidates) {
      const ux = (q.x - p.x) / d, uy = (q.y - p.y) / d;
      if (Math.abs(ux * s.ux + uy * s.uy) > 0.5) continue; // a tie runs across the folds, not along them
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      if (mids.some((m) => Math.hypot(m.x - mid.x, m.y - mid.y) < minSpacing)) continue;
      // a hair in from both ends, so touching the fold it starts and ends on is not a crossing
      const e1 = { x: p.x + ux * 0.05, y: p.y + uy * 0.05 }, e2 = { x: q.x - ux * 0.05, y: q.y - uy * 0.05 };
      const crossesCurve = piecesNear(Math.min(p.x, q.x), Math.min(p.y, q.y), Math.max(p.x, q.x), Math.max(p.y, q.y)).some((o) => segmentsCross(e1, e2, o.a, o.b));
      if (crossesCurve || ties.some((t) => segmentsCross(e1, e2, t[0], t[1]))) continue;
      const extra = Math.max(0, (Number(tieLength) || 0) - d) / 2;
      const tie = [{ x: p.x - ux * extra, y: p.y - uy * extra }, { x: q.x + ux * extra, y: q.y + uy * extra }];
      tie.family = 'ties-designed'; tie.role = 'native';
      // declared joints: where the tie meets the curve it is joined to it, not laid over it
      const here = { id: `tie:${ties.length}:a`, x: p.x, y: p.y }, there = { id: `tie:${ties.length}:b`, x: q.x, y: q.y };
      tie.joints = [here, there];
      (runs[s.r].joints ??= []).push(here); (runs[other.r].joints ??= []).push(there);
      ties.push(tie); mids.push(mid); tied.add(s.r); tied.add(other.r);
      return;
    }
  };

  /** Walks the runs picked by `wanted`, trying a tie every `step` mm of their length. */
  const place = (step, minSpacing, wanted) => {
    runs.forEach((run, r) => {
      if (!wanted(r)) return;
      let next = step / 2;
      for (const s of byRun[r]) {
        for (; next <= s.arc + s.length; next += step) {
          const t = (next - s.arc) / s.length;
          tryTie(s, { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }, minSpacing);
        }
      }
    });
  };
  place(interval, interval / 2, () => true);
  // a long run that caught no tie at those stations is tried again, closer together
  place(interval / 3, interval / 6, (r) => lengths[r] > 2 * interval && !tied.has(r));

  const layers = [[...runs, ...ties]];
  layers.families = ['curve', 'ties-designed'];
  layers.extra = { families: layers.families, runs: runs.length, ties: ties.length, tieInterval: interval };
  return layers;
}
