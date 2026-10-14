import { chainPolylines } from './layers.js';
import { ConfigError } from './params.js';

/**
 * Flow lines: evenly spaced streamlines of a direction field (Jobard and Lefer's method: grow a line from a seed
 * until it leaves the shape or comes too close to another line, then seed new lines one spacing to either side of
 * it), and the same for the field turned 90°. The second layer is perpendicular to the first at every point, so the
 * two cross wherever they meet, however the lines bend. Plotcaster's "Flow" style, made into a fabric.
 */

const TAU = Math.PI * 2;

/** Each field gives a direction (radians, either way along it) at a point; `scale` is its size in mm. */
export const FLOWS = Object.freeze({
  waves: {
    label: 'Waves',
    hint: 'Lines that ripple across, crossed by lines that ripple up',
    angle: (x, y, { scale, bend }) => bend * Math.sin((TAU * y) / scale) * Math.cos((TAU * x) / (2.3 * scale)),
  },
  swirl: {
    label: 'Swirl',
    hint: 'Rings round the centre, crossed by lines that run out from it',
    angle: (x, y, { cx, cy, bend }) => Math.atan2(y - cy, x - cx) + Math.PI / 2 + bend * 0.5,
  },
  vortices: {
    label: 'Vortices',
    hint: 'A grid of whirls turning alternately, like eddies',
    angle: (x, y, { scale }) => {
      const k = TAU / scale;
      return Math.atan2(-Math.cos(k * x) * Math.sin(k * y), Math.sin(k * x) * Math.cos(k * y));
    },
  },
  pattern: {
    label: 'Follow a pattern',
    hint: 'A pattern turns the lines: one way where it is bright, the other where it is dark',
    angle: null, // from the pattern
  },
});
export const FLOW_IDS = Object.freeze(Object.keys(FLOWS));

/**
 * Evenly spaced streamlines of `angleAt` inside the boundary.
 * @returns polylines of { x, y }
 */
export function evenStreamlines(boundary, angleAt, { dsep = 3, step = 0.4, avoid = [], avoidRadius = 1.5, maxPoints = 60000 } = {}) {
  const dtest = 0.5 * dsep;
  const box = boundary.bbox();
  const cell = dsep;
  const grid = new Map();
  const key = (ix, iy) => ix * 100003 + iy;
  const put = (p, id) => {
    const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell));
    const list = grid.get(k);
    if (list) list.push({ x: p.x, y: p.y, id });
    else grid.set(k, [{ x: p.x, y: p.y, id }]);
  };
  const near = (p, d, self = -1) => {
    const ix = Math.floor(p.x / cell), iy = Math.floor(p.y / cell);
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const list = grid.get(key(ix + a, iy + b));
        if (!list) continue;
        for (const q of list) if (q.id !== self && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < d * d) return true;
      }
    }
    return false;
  };
  const blocked = (p) => avoid.some((c) => (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < avoidRadius * avoidRadius);
  const dirAt = (p, prev) => {
    const a = angleAt(p.x, p.y);
    if (!Number.isFinite(a)) return null;
    let dx = Math.cos(a), dy = Math.sin(a);
    if (prev && dx * prev.x + dy * prev.y < 0) { dx = -dx; dy = -dy; } // the field has no arrow: keep going the same way
    return { x: dx, y: dy };
  };

  const lines = [];
  let total = 0;
  const grow = (seed, id) => {
    const halves = [];
    for (const sign of [1, -1]) {
      const pts = [];
      const own = []; // this line's own points, to stop it running into itself
      let p = seed;
      let d = dirAt(p, null);
      if (!d) { halves.push(pts); continue; }
      d = { x: d.x * sign, y: d.y * sign };
      for (let i = 0; i < 4000; i++) {
        const mid = { x: p.x + (d.x * step) / 2, y: p.y + (d.y * step) / 2 };
        const dm = dirAt(mid, d);
        if (!dm) break;
        const nextP = { x: p.x + dm.x * step, y: p.y + dm.y * step };
        if (!boundary.contains(nextP.x, nextP.y) || blocked(nextP) || near(nextP, dtest, id)) break;
        if (own.length > (3 * dtest) / step && own.slice(0, own.length - Math.ceil((3 * dtest) / step)).some((q) => (q.x - nextP.x) ** 2 + (q.y - nextP.y) ** 2 < dtest * dtest)) break;
        pts.push(nextP);
        own.push(nextP);
        d = dm;
        p = nextP;
      }
      halves.push(pts);
    }
    return [...halves[1].reverse(), seed, ...halves[0]];
  };

  const queue = [];
  const tryLine = (seed) => {
    if (!boundary.contains(seed.x, seed.y) || blocked(seed) || near(seed, dsep * 0.98)) return;
    const id = lines.length;
    const line = grow(seed, id);
    let len = 0;
    for (let i = 1; i < line.length; i++) len += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
    if (len < 2 * dsep) return;
    total += line.length;
    if (total > maxPoints) throw new ConfigError(['These flow lines would need too many moves; use a wider spacing or a smaller swatch.']);
    lines.push(line);
    for (const q of line) put(q, id);
    // seeds one spacing to each side, every few steps
    const every = Math.max(1, Math.round(dsep / step / 2));
    for (let i = 0; i + 1 < line.length; i += every) {
      const a = line[i], b = line[i + 1];
      const len2 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len2, ny = (b.x - a.x) / len2;
      queue.push({ x: a.x + nx * dsep, y: a.y + ny * dsep }, { x: a.x - nx * dsep, y: a.y - ny * dsep });
    }
  };

  // start from the middle, then make sure no part of the shape is left without lines
  tryLine({ x: (box.minX + box.maxX) / 2 + 0.01, y: (box.minY + box.maxY) / 2 + 0.01 });
  const drain = () => { while (queue.length) tryLine(queue.shift()); };
  drain();
  for (let y = box.minY + dsep / 2; y < box.maxY; y += dsep) {
    for (let x = box.minX + dsep / 2; x < box.maxX; x += dsep) { tryLine({ x, y }); drain(); }
  }
  return lines;
}

/** Orders lines so each starts near where the last ended (reversing as needed), for fewer, shorter jogs. */
export function orderLines(lines) {
  const left = lines.map((l) => l.slice());
  const out = [];
  let end = null;
  while (left.length) {
    let best = 0, flip = false, bd = Infinity;
    left.forEach((l, i) => {
      if (!end) { if (l[0].x + l[0].y < bd) { bd = l[0].x + l[0].y; best = i; flip = false; } return; }
      const a = Math.hypot(l[0].x - end.x, l[0].y - end.y), b = Math.hypot(l[l.length - 1].x - end.x, l[l.length - 1].y - end.y);
      if (a < bd) { bd = a; best = i; flip = false; }
      if (b < bd) { bd = b; best = i; flip = true; }
    });
    const [line] = left.splice(best, 1);
    if (flip) line.reverse();
    out.push(line);
    end = line[line.length - 1];
  }
  return out;
}

/**
 * The pattern blurred over about one line spacing and sampled on a grid, read back by bilinear interpolation: lines
 * that follow the contours of a pattern with sharp steps would otherwise zigzag along every step.
 */
function smoothed(tone, box, spacing) {
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const cell = Math.max(0.4, spacing / 4);
  const pad = Math.ceil((2 * spacing) / cell) + 1;
  const nx = Math.ceil(w / cell) + 2 * pad + 1, ny = Math.ceil(h / cell) + 2 * pad + 1;
  const x0 = box.minX - pad * cell, y0 = box.minY - pad * cell;
  let grid = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = tone(x0 + i * cell - box.minX, y0 + j * cell - box.minY, w, h);
      grid[j * nx + i] = Number.isFinite(v) ? v : 0;
    }
  }
  // a Gaussian blur of sigma = spacing / 2, one direction at a time
  const sigma = spacing / 2 / cell, reach = Math.ceil(2.5 * sigma);
  const kernel = [];
  for (let k = -reach; k <= reach; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const sum = kernel.reduce((a, b) => a + b, 0);
  const pass = (src, dx, dy) => {
    const out = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let acc = 0;
        for (let k = -reach; k <= reach; k++) {
          const ii = Math.min(nx - 1, Math.max(0, i + k * dx)), jj = Math.min(ny - 1, Math.max(0, j + k * dy));
          acc += kernel[k + reach] * src[jj * nx + ii];
        }
        out[j * nx + i] = acc / sum;
      }
    }
    return out;
  };
  grid = pass(pass(grid, 1, 0), 0, 1);
  return (x, y) => {
    const fx = Math.min(nx - 1.001, Math.max(0, (x - x0) / cell)), fy = Math.min(ny - 1.001, Math.max(0, (y - y0) / cell));
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = grid[j * nx + i], b = grid[j * nx + i + 1], c = grid[(j + 1) * nx + i], d = grid[(j + 1) * nx + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

/**
 * The points where a direction field has no direction: the centre of a whirl, the saddle between two, the middle of
 * a bump in a pattern. Found by walking round each grid cell and counting how far the direction turns (its index);
 * a direction field has no arrow, so the angle is doubled first.
 */
export function singularPoints(box, angleAt, cell) {
  const wrap = (a) => a - TAU * Math.round(a / TAU);
  const out = [];
  // the grid is set off by an odd fraction of a cell, so a point with no direction never falls on a grid corner
  const off = 0.613 * cell;
  for (let y = box.minY - off; y < box.maxY + cell; y += cell) {
    for (let x = box.minX - off; x < box.maxX + cell; x += cell) {
      const ring = [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]].map(([px, py]) => 2 * angleAt(px, py));
      if (!ring.every(Number.isFinite)) continue;
      let turn = 0;
      for (let i = 0; i < 4; i++) turn += wrap(ring[(i + 1) % 4] - ring[i]);
      if (Math.abs(turn) > Math.PI) out.push({ x: x + cell / 2, y: y + cell / 2 });
    }
  }
  return out;
}

/**
 * @param flow     a key of FLOWS
 * @param spacing  mm between neighbouring lines
 * @param scale    mm: the size of one wave or whirl
 * @param bend     how far the lines lean: radians for waves and swirl; for a pattern, the turn from darkest to brightest
 *                 in half turns
 * @param tone     for 'pattern': a field (x, y, w, h) → 0..1 that turns the lines
 */
export function flowLayers(boundary, { flow = 'waves', spacing = 3, scale = 20, bend = 0.6, tone = null } = {}) {
  const f = FLOWS[flow];
  if (!f) throw new Error(`Unknown flow: ${flow}`);
  const box = boundary.bbox();
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const ctx = { scale, bend, cx: box.minX + w / 2, cy: box.minY + h / 2, box };
  let angle;
  if (flow === 'pattern') {
    // the pattern turns the lines: bright one way, dark the other. An angle that is one smooth value at every point
    // can never wind round a point, so these lines have no centres or saddles, only bends
    const field = smoothed(tone ?? ((x, y) => 0.5 + 0.5 * Math.sin((TAU * x) / scale) * Math.sin((TAU * y) / scale)), box, spacing);
    angle = (x, y) => 2 * bend * (field(x, y) - 0.5) * Math.PI;
  } else {
    angle = (x, y) => f.angle(x, y, ctx);
  }
  // a small hole round each point with no direction, so the lines that crowd into it stop short of a blob
  const avoid = singularPoints(box, angle, Math.max(0.5, spacing / 3));
  const avoidRadius = Math.max(1.5, 0.6 * spacing);
  const turned = (x, y) => angle(x, y) + Math.PI / 2;
  const layer = (fn) => chainPolylines(orderLines(evenStreamlines(boundary, fn, { dsep: spacing, avoid, avoidRadius })), boundary, 1.6 * spacing);
  return { layers: [layer(angle), layer(turned)], extra: { flow, singular: avoid.length } };
}
