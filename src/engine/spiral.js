import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { PolygonBoundary } from './boundary.js';
import { emitStrands } from './emit.js';
import { layeredResult } from './layers.js';
import { MAX_MOVES } from './tiler.js';
import { finishFabric } from './fabric-result.js';

/**
 * Spiral panel: nested rings that follow the edge of the panel, joined into as few strands as the shape allows.
 *
 * The distance from every point to the nearest edge is sampled on a grid; each ring is the line where that distance
 * equals 0.4 mm, then 0.4 + spacing, then 0.4 + 2 × spacing and so on (marching squares). A rectangle gives nested
 * rectangles, a heart gives nested hearts, and a shape with a hole gives rings round the hole too. Rings are printed
 * outside in and each is joined to the next by a short jog, so a convex panel is one strand with no lifts.
 */

const EPS = 1e-9;

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > EPS ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Signed distance to the nearest ring edge on a grid: positive inside the shape. */
export function distanceField(rings, boundary, cell) {
  const box = boundary.bbox();
  const minX = box.minX - cell, minY = box.minY - cell;
  const nx = Math.ceil((box.maxX - box.minX) / cell) + 3;
  const ny = Math.ceil((box.maxY - box.minY) / cell) + 3;
  const data = new Float32Array(nx * ny);
  const edges = [];
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) edges.push(ring[j].x, ring[j].y, ring[i].x, ring[i].y);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = minX + ix * cell, y = minY + iy * cell;
      let best = Infinity;
      for (let e = 0; e < edges.length; e += 4) {
        const d = segmentDistance(x, y, edges[e], edges[e + 1], edges[e + 2], edges[e + 3]);
        if (d < best) best = d;
      }
      data[iy * nx + ix] = boundary.contains(x, y) ? best : -best;
    }
  }
  let max = 0;
  for (const v of data) if (v > max) max = v;
  return { minX, minY, nx, ny, cell, data, max };
}

/** Closed polylines where the field equals `level` (marching squares, joined through shared grid edges). */
export function contourLoops(field, level) {
  const { nx, ny, data, minX, minY, cell } = field;
  const at = (ix, iy) => data[iy * nx + ix];
  const pointOnEdge = new Map(); // edge id -> {x, y}
  const edgeId = (ix, iy, horizontal) => (iy * nx + ix) * 2 + (horizontal ? 0 : 1);
  const crossing = (ax, ay, bx, by, horizontal) => {
    const id = edgeId(Math.min(ax, bx), Math.min(ay, by), horizontal);
    if (!pointOnEdge.has(id)) {
      const va = at(ax, ay), vb = at(bx, by);
      const t = (level - va) / (vb - va);
      pointOnEdge.set(id, { x: minX + (ax + (bx - ax) * t) * cell, y: minY + (ay + (by - ay) * t) * cell });
    }
    return id;
  };
  const next = new Map(); // edge id -> neighbouring edge ids (each contour edge has two)
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
        case 5: case 10: {
          // a saddle: let the average of the corners decide which way the contour bends
          const centre = (v00 + v10 + v11 + v01) / 4 >= level;
          if ((code === 5) === centre) { link(left(), top()); link(bottom(), right()); } else { link(left(), bottom()); link(right(), top()); }
          break;
        }
        default: break;
      }
    }
  }
  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    // every contour edge has exactly two neighbours, so the walk simply never turns back
    const ids = [start];
    seen.add(start);
    let prev = start;
    let cur = next.get(start)[0];
    while (cur !== undefined && cur !== start && !seen.has(cur)) {
      ids.push(cur);
      seen.add(cur);
      const around = next.get(cur);
      const forward = around[0] === prev ? around[1] : around[0];
      prev = cur;
      cur = forward;
    }
    if (ids.length >= 3) {
      const pts = ids.map((id) => pointOnEdge.get(id));
      pts.push({ ...pts[0] });
      loops.push(pts);
    }
  }
  return loops;
}

const signedArea = (pts) => {
  let a = 0;
  for (let i = 1; i < pts.length; i++) a += pts[i - 1].x * pts[i].y - pts[i].x * pts[i - 1].y;
  return a / 2;
};

/**
 * @returns { strands, rings, levels, warnings }: strands of { id, kind, name, pts } at the first layer height
 */
export function generateSpiralTextile({ width, height, spacing = 3, inset = 0.4, layerHeight = 0.2, boundary = null, rings = null }) {
  const shape = boundary ?? new PolygonBoundary([[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]]);
  const outlineRings = rings ?? shape.rings;
  const cell = Math.max(0.5, Math.max(width, height) / 320);
  const field = distanceField(outlineRings, shape, cell);
  const warnings = [];
  const levels = [];
  for (let d = inset; d < field.max - cell * 0.25; d += spacing) levels.push(d);
  if (levels.length === 0) warnings.push('The panel is too narrow for a ring at this spacing: nothing to print');

  const strands = [];
  let current = null;
  let end = null;
  let ringCount = 0;
  let points = 0;
  const jog = 1.6 * spacing + 1;
  const flush = () => { if (current && current.length > 1) strands.push({ id: strands.length === 0 ? 'spiral' : `spiral-${strands.length + 1}`, kind: 'base', name: 'Spiral', pts: current }); current = null; end = null; };

  for (const level of levels) {
    let loops = contourLoops(field, level).map((pts) => (signedArea(pts) < 0 ? pts.slice().reverse() : pts));
    // nearest loop first, so the jogs stay short when a level has several loops
    while (loops.length) {
      let pick = 0, pickIndex = 0, best = Infinity;
      const ref = end ?? loops[0][0];
      loops.forEach((loop, li) => {
        for (let i = 0; i < loop.length - 1; i++) {
          const d = Math.hypot(loop[i].x - ref.x, loop[i].y - ref.y);
          if (d < best) { best = d; pick = li; pickIndex = i; }
        }
      });
      const loop = loops.splice(pick, 1)[0];
      const body = loop.slice(0, -1);
      const rotated = [...body.slice(pickIndex), ...body.slice(0, pickIndex)];
      rotated.push({ ...rotated[0] });
      const z = layerHeight;
      const pts = rotated.map((p) => ({ x: p.x, y: p.y, z }));
      const startsNear = end && Math.hypot(pts[0].x - end.x, pts[0].y - end.y) <= jog && shape.contains((pts[0].x + end.x) / 2, (pts[0].y + end.y) / 2);
      if (!startsNear) flush();
      if (!current) current = [];
      current.push(...pts);
      end = pts[pts.length - 1];
      ringCount++;
      points += pts.length;
    }
  }
  flush();
  if (points > MAX_MOVES) {
    throw new ConfigError([`This layout would need about ${points.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use wider spacing or a smaller panel.`]);
  }
  return { strands, rings: ringCount, levels: levels.length, warnings, field, shape };
}

/** Distance at (x, y), interpolated between the four nearest grid samples. */
function distanceAt(field, x, y) {
  const fx = (x - field.minX) / field.cell, fy = (y - field.minY) / field.cell;
  const ix = Math.max(0, Math.min(field.nx - 2, Math.floor(fx))), iy = Math.max(0, Math.min(field.ny - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - ix)), ty = Math.max(0, Math.min(1, fy - iy));
  const at = (i, j) => field.data[j * field.nx + i];
  return (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
}

/**
 * The second layer of a spiral panel: lines along the normals of the outline, so they cross every ring at a right
 * angle. A line starts on the outermost ring every `spacing` mm and climbs the distance field (the direction
 * away from the nearest edge) until the distance stops growing or the climb turns sharply, which is the middle of
 * the panel or the ridge where the normals from two edges meet. Normals stop separately at the ridge; the shared planner orders their endpoints.
 */
export function normalLines(field, boundary, { spacing = 3, inset = 0.4 } = {}) {
  const outer = contourLoops(field, inset).map((pts) => (signedArea(pts) < 0 ? pts.slice().reverse() : pts));
  const seeds = [];
  for (const loop of outer) {
    let carried = spacing / 2;
    for (let i = 1; i < loop.length; i++) {
      const a = loop[i - 1], b = loop[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let t = carried; t <= len; t += spacing) seeds.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len, loop: outer.indexOf(loop) });
      carried = (carried + spacing - (len % spacing)) % spacing || spacing;
    }
  }
  const h = field.cell * 0.75;
  const lines = [];
  for (const seed of seeds) {
    const pts = [{ x: seed.x, y: seed.y }];
    let p = { x: seed.x, y: seed.y };
    let d = distanceAt(field, p.x, p.y);
    let flat = 0;
    let first = null;
    for (let step = 0; step < 600; step++) {
      const gx = (distanceAt(field, p.x + h, p.y) - distanceAt(field, p.x - h, p.y)) / (2 * h);
      const gy = (distanceAt(field, p.x, p.y + h) - distanceAt(field, p.x, p.y - h)) / (2 * h);
      const g = Math.hypot(gx, gy);
      if (g < 1e-6) break;
      // the ridge where normals from two edges meet (a square's diagonals): the climb turns sharply there, and
      // following it would pile every normal onto the ridge, so the line stops
      if (!first) first = { x: gx / g, y: gy / g };
      else if ((gx * first.x + gy * first.y) / g < Math.cos(15 * Math.PI / 180)) break;
      const next = { x: p.x + (gx / g) * 0.5, y: p.y + (gy / g) * 0.5 };
      const nd = distanceAt(field, next.x, next.y);
      if (nd < d - 1e-3 || !boundary.contains(next.x, next.y)) break;
      flat = nd - d < 0.05 ? flat + 1 : 0;
      p = next;
      d = nd;
      pts.push(next);
      if (flat >= 3) break;
    }
    if (pts.length >= 3) lines.push(pts);
  }
  // Keep ridge ends separate: a diagonal connector crosses the rings obliquely and adds another ridge pile-up.
  // The shared planner chooses the nearest endpoint of each normal.
  return lines;
}

/**
 * End to end: machine, material and spiral settings in, moves, stats and G-code out.
 * `params`: width, height, spacing (mm between rings), outline (rings in mm) or null.
 */
export function generateSpiral(machine, material, params = {}) {
  const width = params.width ?? 100;
  const height = params.height ?? 100;
  const cfg = resolveConfig(machine, material, { sample_width: width, sample_height: height });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);
  const outline = params.outline ?? null;
  const spiral = generateSpiralTextile({
    width,
    height,
    spacing: params.spacing ?? 3,
    layerHeight: cfg.t.layer_height,
    boundary: outline ? new PolygonBoundary(outline) : null,
  });
  if (params.second === 'normals') {
    const normals = normalLines(spiral.field, spiral.shape, { spacing: params.spacing ?? 3 });
    const layered = layeredResult(machine, material, {
      width,
      height,
      layers: [spiral.strands.map((s) => s.pts.map(({ x, y }) => ({ x, y }))), normals],
      outline,
      colorChange: !!params.colorChange,
      extra: { layerCount: 2, spiral: { rings: spiral.rings, levels: spiral.levels, warnings: spiral.warnings } },
    });
    layered.stats.loops = spiral.rings;
    return layered;
  }
  const moves = emitStrands(spiral.strands, { retraction: cfg.derived.retraction });
  const stats = computeStats(moves, cfg, []);
  stats.loops = spiral.rings;
  const gcode = writeGcode(moves, cfg, { stats });
  const warnings = [...spiral.warnings];
  if (moves.length === 0 && warnings.length === 0) warnings.push('Nothing to print');
  return finishFabric({ cfg, strands: spiral.strands, moves, stats, warnings, gcode, outline, spiral }, { flat: true, reinforce: true });
}
