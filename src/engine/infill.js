import { PolygonBoundary } from './boundary.js';
import { hatch, clipPolyline, chainPolylines, densify, trailsFromEdges } from './layers.js';
import { distanceField, contourLoops } from './spiral.js';
import { hilbertCells } from './meander.js';
import { createRng } from './rng.js';

/**
 * The infill patterns of PrusaSlicer, as flat 2D slices that can be laid inside any outline.
 *
 * A slicer fills a solid with these patterns layer after layer; here a pattern is one layer (or a few) of a textile,
 * so each is described by what one slice of it looks like. Several patterns are slices of a 3D lattice (cubic,
 * gyroid, 3D honeycomb): `layer` says which slice, so two layers of the same pattern are two different slices
 * instead of two copies, and they cross each other instead of lying on top of one another.
 *
 * Every pattern takes the same `spacing`, and means the same thing by it: the distance between lines if the pattern's
 * line were laid out in parallel rows, i.e. area / length. Two patterns at the same spacing therefore use about the
 * same amount of filament, which is what makes them comparable. (Lightning is the exception: it is sparse by nature,
 * and its spacing is the gap between branch tips.)
 */

export const INFILL_PATTERNS = Object.freeze({
  rectilinear: { id: 'rectilinear', label: 'Rectilinear', hint: 'Parallel lines joined at the ends; every layer turned 90°', family: 'lines' },
  aligned: { id: 'aligned', label: 'Aligned rectilinear', hint: 'Parallel lines the same way on every layer, each layer half a gap to the side', family: 'lines' },
  grid: { id: 'grid', label: 'Grid', hint: 'Two directions crossing in the same layer', family: 'lines' },
  triangles: { id: 'triangles', label: 'Triangles', hint: 'Three directions 60° apart meeting at points', family: 'lines' },
  stars: { id: 'stars', label: 'Stars', hint: 'Three directions shifted so they make small triangles and six-pointed stars', family: 'lines' },
  cubic: { id: 'cubic', label: 'Cubic', hint: 'A slice of a cubic lattice: triangles that open into hexagons from layer to layer', family: '3d' },
  line: { id: 'line', label: 'Line', hint: 'Parallel lines that are not joined: every line is a strand of its own', family: 'lines' },
  concentric: { id: 'concentric', label: 'Concentric', hint: 'Rings that follow the outline inwards', family: 'curve' },
  honeycomb: { id: 'honeycomb', label: 'Honeycomb', hint: 'Hexagons, joined into long trails', family: 'cells' },
  honeycomb3d: { id: 'honeycomb3d', label: '3D honeycomb', hint: 'Two zigzag directions whose phase moves layer to layer: octagons, squares and hexagons', family: '3d' },
  gyroid: { id: 'gyroid', label: 'Gyroid', hint: 'The smooth wavy lines of a gyroid slice, which change from layer to layer', family: '3d' },
  hilbert: { id: 'hilbert', label: 'Hilbert curve', hint: 'One curve that visits every cell once, never crossing itself', family: 'curve' },
  archimedean: { id: 'archimedean', label: 'Archimedean chords', hint: 'A spiral from the middle outwards, in short straight chords', family: 'curve' },
  octagram: { id: 'octagram', label: 'Octagram spiral', hint: 'An eight-pointed star path that spirals out, in long straight chords', family: 'curve' },
  adaptive: { id: 'adaptive', label: 'Adaptive cubic', hint: 'Cubic that is dense near the edge and open in the middle', family: '3d' },
  support: { id: 'support', label: 'Support cubic', hint: 'A sparse cubic: the lightest lattice that still ties layers together', family: '3d' },
  lightning: { id: 'lightning', label: 'Lightning', hint: 'Branching trails that reach in from the edge: sparse, with few crossings', family: 'tree' },
});

export const INFILL_IDS = Object.freeze(Object.keys(INFILL_PATTERNS));

const STEP = 0.5;
const SQRT3 = Math.sqrt(3);
/** Slices of a 3D pattern are a quarter of a period apart, so two layers are really different. */
const LAYER_PHASE = 0.25;

/** area / contour length of the gyroid sin x cos y + sin y cos z + sin z cos x = 0 in a slice, as a multiple of its period (measured). */
const GYROID_SPACING_PER_PERIOD = 0.392;

const ringsOf = (boundary) => {
  if (boundary.rings) return boundary.rings;
  const b = boundary.bbox();
  return [[{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }]];
};

const length = (pts) => {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
};

/** The distance from (x, y) to the nearest ring edge, and the nearest point there. */
function nearestOnRings(rings, x, y) {
  let best = Infinity, at = null;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 1e-12 ? ((x - a.x) * dx + (y - a.y) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a.x + t * dx, py = a.y + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; at = { x: px, y: py }; }
    }
  }
  return { distance: best, point: at };
}

/** Marching squares over a sampled field: every contour at `level` as an open or closed polyline. */
function contourPolylines({ nx, ny, minX, minY, cell, data }, level) {
  const at = (ix, iy) => data[iy * nx + ix];
  const points = new Map();
  const next = new Map();
  const crossing = (ax, ay, bx, by, horizontal) => {
    const id = (Math.min(ay, by) * nx + Math.min(ax, bx)) * 2 + (horizontal ? 0 : 1);
    if (!points.has(id)) {
      const va = at(ax, ay), vb = at(bx, by);
      const t = (level - va) / (vb - va);
      points.set(id, { x: minX + (ax + (bx - ax) * t) * cell, y: minY + (ay + (by - ay) * t) * cell });
    }
    return id;
  };
  const link = (a, b) => {
    if (!next.has(a)) next.set(a, []);
    if (!next.has(b)) next.set(b, []);
    next.get(a).push(b);
    next.get(b).push(a);
  };
  for (let iy = 0; iy + 1 < ny; iy++) {
    for (let ix = 0; ix + 1 < nx; ix++) {
      const v00 = at(ix, iy), v10 = at(ix + 1, iy), v11 = at(ix + 1, iy + 1), v01 = at(ix, iy + 1);
      const code = (v00 >= level ? 1 : 0) | (v10 >= level ? 2 : 0) | (v11 >= level ? 4 : 0) | (v01 >= level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const bottom = () => crossing(ix, iy, ix + 1, iy, true);
      const top = () => crossing(ix, iy + 1, ix + 1, iy + 1, true);
      const left = () => crossing(ix, iy, ix, iy + 1, false);
      const right = () => crossing(ix + 1, iy, ix + 1, iy + 1, false);
      switch (code) {
        case 1: case 14: link(left(), bottom()); break;
        case 2: case 13: link(bottom(), right()); break;
        case 3: case 12: link(left(), right()); break;
        case 4: case 11: link(right(), top()); break;
        case 6: case 9: link(bottom(), top()); break;
        case 7: case 8: link(left(), top()); break;
        default: {
          const centre = (v00 + v10 + v11 + v01) / 4 >= level;
          if ((code === 5) === centre) { link(left(), top()); link(bottom(), right()); } else { link(left(), bottom()); link(right(), top()); }
        }
      }
    }
  }
  const seen = new Set();
  const out = [];
  const walk = (start) => {
    const ids = [start];
    seen.add(start);
    let prev = null, cur = start;
    for (;;) {
      const options = next.get(cur).filter((n) => n !== prev && !seen.has(n));
      if (options.length === 0) break;
      prev = cur;
      cur = options[0];
      seen.add(cur);
      ids.push(cur);
    }
    return ids;
  };
  // open contours start at their ends (one neighbour), the rest are closed loops
  for (const [id, around] of next) if (around.length === 1 && !seen.has(id)) out.push(walk(id).map((k) => points.get(k)));
  for (const id of next.keys()) {
    if (seen.has(id)) continue;
    const loop = walk(id).map((k) => points.get(k));
    loop.push({ ...loop[0] });
    out.push(loop);
  }
  return out.filter((c) => c.length >= 2);
}

/** Polylines of `list` rotated so each closed loop starts at its point nearest to where the last one ended. */
function startNear(loop, at) {
  const pts = loop.slice(0, -1);
  let k = 0, best = Infinity;
  pts.forEach((p, i) => {
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < best) { best = d; k = i; }
  });
  const rotated = [...pts.slice(k), ...pts.slice(0, k)];
  rotated.push({ ...rotated[0] });
  return rotated;
}

/* ---------- the patterns: each takes ctx { B, box, centre, anchor, s, layer, rings, seed, inset } and returns polylines ---------- */

const family = (ctx, deg, spacing, offset = 0, maxJog = null) =>
  hatch(ctx.B, { angle: deg, spacing, offset, anchor: ctx.anchor, inset: ctx.inset, maxJog });

/** Three directions 60° apart; `offsets` slide each by a fraction of the spacing (all zero: triangles meeting at points). */
const threeWays = (ctx, offsets) => [0, 60, 120].flatMap((deg, k) => family(ctx, deg, 3 * ctx.s, offsets[k]));

const PATTERNS = {
  rectilinear: (ctx) => hatch(ctx.B, { angle: 90 * (ctx.layer % 2), spacing: ctx.s, anchor: ctx.anchor, inset: ctx.inset }),
  aligned: (ctx) => hatch(ctx.B, { angle: 0, spacing: ctx.s, anchor: ctx.anchor, inset: ctx.inset }),
  line: (ctx) => hatch(ctx.B, { angle: 90 * (ctx.layer % 2), spacing: ctx.s, anchor: ctx.anchor, inset: ctx.inset, maxJog: -1 }),
  grid: (ctx) => [0, 90].flatMap((deg) => family(ctx, deg, 2 * ctx.s)),
  triangles: (ctx) => threeWays(ctx, [0, 0, 0]),
  stars: (ctx) => threeWays(ctx, [1 / 3, 0, 0]),
  cubic: (ctx) => threeWays(ctx, [LAYER_PHASE * ctx.layer, 0, 0]),
  support: (ctx) => [0, 60, 120].flatMap((deg, k) => family(ctx, deg, 5.5 * ctx.s, k === 0 ? LAYER_PHASE * ctx.layer : 0)),

  adaptive(ctx) {
    // a sparse cubic everywhere, and a fine one only within a band of the edge
    const coarse = [0, 60, 120].flatMap((deg, k) => family(ctx, deg, 4 * ctx.s, k === 0 ? LAYER_PHASE * ctx.layer : 0));
    const band = Math.max(2 * ctx.s, 4);
    const field = distanceField(ctx.rings, ctx.B, Math.max(0.5, Math.min(2, ctx.s / 2)));
    const near = {
      contains: (x, y) => {
        const ix = (x - field.minX) / field.cell, iy = (y - field.minY) / field.cell;
        const i0 = Math.max(0, Math.min(field.nx - 2, Math.floor(ix))), j0 = Math.max(0, Math.min(field.ny - 2, Math.floor(iy)));
        const fx = ix - i0, fy = iy - j0;
        const d = (field.data[j0 * field.nx + i0] * (1 - fx) + field.data[j0 * field.nx + i0 + 1] * fx) * (1 - fy)
          + (field.data[(j0 + 1) * field.nx + i0] * (1 - fx) + field.data[(j0 + 1) * field.nx + i0 + 1] * fx) * fy;
        return d >= 0 && d <= band;
      },
    };
    const fine = [0, 60, 120].flatMap((deg, k) => family(ctx, deg, 2 * ctx.s, k === 0 ? LAYER_PHASE * ctx.layer : 0).flatMap((pts) => clipPolyline(pts, near, 1.5)));
    return [...coarse, ...fine];
  },

  concentric(ctx) {
    const cell = Math.max(0.5, ctx.s / 3, Math.sqrt(((ctx.box.maxX - ctx.box.minX) * (ctx.box.maxY - ctx.box.minY) * Math.max(4, ctx.edges)) / 4e7));
    const field = distanceField(ctx.rings, ctx.B, cell);
    const loops = [];
    for (let level = 0.4; level < field.max; level += ctx.s) loops.push(...contourLoops(field, level));
    const ordered = [];
    let at = null;
    for (const loop of loops) {
      const run = at ? startNear(loop, at) : loop;
      ordered.push(run);
      at = run[run.length - 1];
    }
    return chainPolylines(ordered, ctx.B, ctx.s + 1.5);
  },

  honeycomb(ctx) {
    // hexagon side a gives area / line length = a·√3/2, so a = 2s/√3
    const a = (2 * ctx.s) / SQRT3;
    const w = SQRT3 * a;
    const { minX, minY, maxX, maxY } = ctx.box;
    const seen = new Set();
    const edges = [];
    const key = (p) => `${Math.round(p.x * 50)},${Math.round(p.y * 50)}`;
    const rowsN = Math.ceil((maxY - minY) / (1.5 * a)) + 2;
    const colsN = Math.ceil((maxX - minX) / w) + 2;
    for (let j = -1; j < rowsN; j++) {
      for (let i = -1; i < colsN; i++) {
        const cx = minX + i * w + (j & 1 ? w / 2 : 0), cy = minY + j * 1.5 * a;
        const v = Array.from({ length: 6 }, (_, k) => ({ x: cx + a * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), y: cy + a * Math.sin(Math.PI / 6 + (k * Math.PI) / 3) }));
        for (let k = 0; k < 6; k++) {
          const p = v[k], q = v[(k + 1) % 6];
          const id = [key(p), key(q)].sort().join('|');
          if (seen.has(id)) continue;
          seen.add(id);
          edges.push([p, q]);
        }
      }
    }
    return chainPolylines(trailsFromEdges(edges).flatMap((trail) => clipPolyline(trail, ctx.B, 1)), ctx.B, ctx.s * 2);
  },

  honeycomb3d(ctx) {
    // two perpendicular families of zigzags whose phase moves with the layer: where they meet, cells open and close
    const period = 4 * ctx.s;
    const amp = 0.8 * ctx.s;
    const factor = Math.hypot(1, (4 * amp) / period);
    const lane = 2 * ctx.s * factor;
    const { minX, minY, maxX, maxY } = ctx.box;
    const phase = LAYER_PHASE * ctx.layer;
    const zig = (t, ph) => { const u = ((t / period + ph) % 1 + 1) % 1; return amp * (u < 0.5 ? 4 * u - 1 : 3 - 4 * u); };
    const out = [];
    const run = (from, to, ph, place) => {
      const pts = [];
      const n = Math.ceil((to - from) / (period / 8)) + 1;
      for (let i = 0; i <= n; i++) { const t = from + ((to - from) * i) / n; pts.push(place(t, zig(t, ph))); }
      return pts;
    };
    for (let y = minY - amp; y <= maxY + amp; y += lane) out.push(run(minX - 1, maxX + 1, phase, (t, d) => ({ x: t, y: y + d })));
    for (let x = minX - amp; x <= maxX + amp; x += lane) out.push(run(minY - 1, maxY + 1, phase + 0.5, (t, d) => ({ x: x + d, y: t })));
    return out.flatMap((pts) => clipPolyline(pts, ctx.B, 1));
  },

  gyroid(ctx) {
    const L = ctx.s / GYROID_SPACING_PER_PERIOD; // the period (mm) that gives area / length = s
    const k = (2 * Math.PI) / L;
    const kz = 0.6 + 2 * Math.PI * LAYER_PHASE * ctx.layer;
    const { minX, minY, maxX, maxY } = ctx.box;
    const cell = Math.max(L / 14, 0.25);
    const margin = 2 * cell;
    const ox = minX - margin, oy = minY - margin;
    const nx = Math.ceil((maxX - minX + 2 * margin) / cell) + 1, ny = Math.ceil((maxY - minY + 2 * margin) / cell) + 1;
    if (nx * ny > 2.5e6) return [];
    const sx = new Float64Array(nx), cx = new Float64Array(nx), sy = new Float64Array(ny), cy = new Float64Array(ny);
    for (let i = 0; i < nx; i++) { sx[i] = Math.sin(k * (ox + i * cell)); cx[i] = Math.cos(k * (ox + i * cell)); }
    for (let j = 0; j < ny; j++) { sy[j] = Math.sin(k * (oy + j * cell)); cy[j] = Math.cos(k * (oy + j * cell)); }
    const cz = Math.cos(kz), sz = Math.sin(kz);
    const data = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) data[j * nx + i] = sx[i] * cy[j] + sy[j] * cz + sz * cx[i];
    const lines = contourPolylines({ nx, ny, minX: ox, minY: oy, cell, data }, 0);
    return chainPolylines(lines.flatMap((pts) => clipPolyline(pts, ctx.B, 1)), ctx.B, ctx.s);
  },

  hilbert(ctx) {
    const { minX, minY, maxX, maxY } = ctx.box;
    const side = Math.max(maxX - minX, maxY - minY);
    const order = Math.max(1, Math.min(8, Math.round(Math.log2(Math.max(2, side / ctx.s)))));
    const n = 1 << order;
    const cell = side / n;
    const x0 = (minX + maxX) / 2 - side / 2, y0 = (minY + maxY) / 2 - side / 2;
    const pts = hilbertCells(order).map((c) => ({ x: x0 + (c.x + 0.5) * cell, y: y0 + (c.y + 0.5) * cell }));
    return chainPolylines(clipPolyline(pts, ctx.B, 1), ctx.B, cell * 1.6);
  },

  archimedean(ctx) {
    const { minX, minY, maxX, maxY } = ctx.box;
    const c = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const reach = Math.hypot(maxX - minX, maxY - minY) / 2 + ctx.s;
    const pts = [];
    for (let theta = 0, r = 0; r <= reach; theta += Math.min(0.5, Math.max(0.1, 2 / Math.max(r, 1)))) {
      r = (ctx.s * theta) / (2 * Math.PI);
      pts.push({ x: c.x + r * Math.cos(theta), y: c.y + r * Math.sin(theta) });
    }
    return chainPolylines(clipPolyline(pts, ctx.B, 1), ctx.B, ctx.s * 2.5);
  },

  octagram(ctx) {
    // the {8/3} star: each corner is 135° on from the last, so eight corners wind three times round
    const { minX, minY, maxX, maxY } = ctx.box;
    const c = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const reach = Math.hypot(maxX - minX, maxY - minY) / 2 + ctx.s;
    const dr = (3 * ctx.s) / 8;
    const pts = [];
    for (let k = 0; k * dr <= reach; k++) {
      const a = (k * 135 * Math.PI) / 180 + Math.PI / 8, r = k * dr;
      pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
    }
    return chainPolylines(clipPolyline(pts, ctx.B, 1), ctx.B, ctx.s * 2.5);
  },

  lightning(ctx) {
    const g = 2.2 * ctx.s;
    const { minX, minY, maxX, maxY } = ctx.box;
    const rng = createRng(ctx.seed * 7919 + ctx.layer * 104729 + 3);
    const sites = [];
    for (let y = minY + g / 2; y < maxY; y += g) {
      for (let x = minX + g / 2; x < maxX; x += g) {
        const p = { x: x + rng.symmetric(g * 0.3), y: y + rng.symmetric(g * 0.3) };
        if (ctx.B.contains(p.x, p.y)) sites.push(p);
      }
    }
    if (sites.length > 4000) return [];
    const info = sites.map((p) => ({ p, ...nearestOnRings(ctx.rings, p.x, p.y) }));
    info.sort((a, b) => a.distance - b.distance); // grow from the edge inwards
    const edges = [];
    const nodes = [];
    for (const it of info) {
      let target = it.point, d = it.distance;
      for (const n of nodes) {
        const dn = Math.hypot(n.x - it.p.x, n.y - it.p.y);
        if (dn < d * 0.9) { d = dn; target = n; }
      }
      // a branch must not cross the outline: fall back to the way straight out to the edge
      const mid = { x: (target.x + it.p.x) / 2, y: (target.y + it.p.y) / 2 };
      if (!ctx.B.contains(mid.x, mid.y)) target = it.point;
      edges.push([it.p, target]);
      nodes.push(it.p);
    }
    return chainPolylines(trailsFromEdges(edges).flatMap((trail) => clipPolyline(trail, ctx.B, 1)), ctx.B, g);
  },
};

/**
 * One layer of a PrusaSlicer infill pattern inside the boundary.
 * @param pattern  a key of INFILL_PATTERNS
 * @param spacing  mm: area / line length, so patterns use about the same filament at the same spacing
 * @param angle    degrees: turns the whole pattern
 * @param layer    which slice (0, 1, 2…): 3D patterns move on by a quarter period, parallel ones turn or shift
 * @param inset    mm the lines stop short of the edge
 * @returns an array of polylines ({ x, y } points 0.5 mm apart), all inside the boundary; none shorter than 1 mm
 */
export function infillLines(pattern, boundary, { spacing = 3, angle = 0, layer = 0, seed = 1, inset = 0.3 } = {}) {
  const make = PATTERNS[pattern];
  if (!make) throw new Error(`Unknown infill pattern: ${pattern}`);
  const s = Math.max(0.4, spacing);
  const rings = ringsOf(boundary);
  const box0 = boundary.bbox();
  const centre = { x: (box0.minX + box0.maxX) / 2, y: (box0.minY + box0.maxY) / 2 };
  const a = (angle * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const toFrame = (p) => ({ x: centre.x + (p.x - centre.x) * c + (p.y - centre.y) * sn, y: centre.y - (p.x - centre.x) * sn + (p.y - centre.y) * c });
  const fromFrame = (p) => ({ x: centre.x + (p.x - centre.x) * c - (p.y - centre.y) * sn, y: centre.y + (p.x - centre.x) * sn + (p.y - centre.y) * c });
  const framed = angle % 360 === 0 ? rings : rings.map((r) => r.map(toFrame));
  const B = new PolygonBoundary(framed);
  // parallel and aligned layers must not land on the same lines: the anchor moves a little every layer
  const shift = pattern === 'aligned' ? { x: 0, y: 0.5 * s * (layer % 2) } : { x: 0.37 * s * layer, y: 0.23 * s * layer };
  const ctx = { B, box: B.bbox(), centre, anchor: { x: centre.x + shift.x, y: centre.y + shift.y }, s, layer, rings: framed, edges: framed.reduce((n, r) => n + r.length, 0), seed, inset };
  const lines = make(ctx);
  const out = [];
  for (const pts of lines) {
    if (pts.length < 2 || length(pts) < 1) continue;
    const dense = densify(pts, STEP);
    out.push(angle % 360 === 0 ? dense : dense.map(fromFrame));
  }
  return out;
}

/** Total length (mm) of a set of polylines. */
export function totalLength(lines) {
  return lines.reduce((n, pts) => n + length(pts), 0);
}
