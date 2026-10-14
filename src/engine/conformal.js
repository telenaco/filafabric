import { sampleGrid, isoLines } from './isolines.js';
import { clipPolyline } from './layers.js';
import { PolygonBoundary } from './boundary.js';
import { ConfigError } from './params.js';

/**
 * Conformal mesh: the two layers are the level lines of the real and the imaginary part of one complex function
 * f(z). Wherever f is smooth (analytic) those two families of lines cross at exactly 90°, and the cells they make are
 * small squares, larger or smaller with the function's stretch. So the second layer is guaranteed to cross the first
 * everywhere, however the grid bends: round a hole like a buttonhole, round two holes, round two poles like the
 * field of a magnet, or into two families of spirals. Each map has holes where it cannot be printed (where f blows up
 * or the cells would shrink to nothing); every hole gets a ring round it, a hem, in the first layer.
 */

const TAU = Math.PI * 2;
const MIN_GAP = 1.2; // mm: closer lines than this would fuse into a solid band

const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const clog = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];

/**
 * Each map works in a unit frame: z = (point - centre) / L, with L half the shorter side of the swatch, so a map
 * keeps its proportions at any size. `k` is the feature size (hole radius, pole distance) as a fraction of L.
 */
export const MAPS = Object.freeze({
  hole: {
    label: 'Round a hole',
    hint: 'A square grid that bends round a round hole, like a buttonhole',
    f: (z, { k }) => {
      const inv = cdiv([k * k, 0], z);
      return [z[0] + inv[0], z[1] + inv[1]];
    },
    holes: ({ k }) => [{ x: 0, y: 0, r: k }],
    hemLayer: 1, // the potential lines (layer 1) run into the rim, so the hem is printed over them
  },
  twin: {
    label: 'Two holes',
    hint: 'The grid flows round two holes side by side',
    f: (z, { k }) => {
      const d = 0.55, r2 = (0.6 * k) ** 2;
      const a = cdiv([r2, 0], [z[0] - d, z[1]]);
      const b = cdiv([r2, 0], [z[0] + d, z[1]]);
      return [z[0] + a[0] + b[0], z[1] + a[1] + b[1]];
    },
    holes: ({ k }) => [{ x: -0.55, y: 0, r: 0.6 * k }, { x: 0.55, y: 0, r: 0.6 * k }],
    hemLayer: 1,
  },
  dipole: {
    label: 'Two poles',
    hint: 'Rings round two poles crossed by arcs through both, like the field of a magnet',
    f: (z, { k }) => clog(cdiv([z[0] - k, z[1]], [z[0] + k, z[1]])),
    holes: ({ k }) => [{ x: -k, y: 0, r: 0.3 * k }, { x: k, y: 0, r: 0.3 * k }],
    cut: { v: TAU },
    poles: true, // the lines crowd towards each pole: its hole is widened to where they come MIN_GAP apart
    percentile: 0.85,
    hemLayer: 0,
  },
  nautilus: {
    label: 'Nautilus',
    hint: 'Two families of spirals at right angles; the cells grow towards the edge',
    // (arms + i·twist) / |arms + i·twist| · log z: once round, each family moves on by a whole number of lines
    f: (z, { arms, twist }) => {
      const h = Math.hypot(arms, twist);
      return cmul([arms / h, twist / h], clog(z));
    },
    holes: () => [],
    spiral: true,
    hemLayer: 0,
  },
});
export const MAP_IDS = Object.freeze(Object.keys(MAPS));

const circle = (cx, cy, r, step = 0.5) => {
  const n = Math.max(16, Math.ceil((TAU * r) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push({ x: cx + r * Math.cos((TAU * i) / n), y: cy + r * Math.sin((TAU * i) / n) });
  return pts;
};

/** Joins pieces whose ends almost touch (a line broken by a branch cut), in either direction. */
function stitch(list, gap) {
  const lines = list.map((p) => p.slice());
  let joined = true;
  while (joined) {
    joined = false;
    outer: for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue;
        const a = lines[i], b = lines[j];
        const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
        let merged = null;
        if (d(a[a.length - 1], b[0]) <= gap) merged = [...a, ...b];
        else if (d(a[a.length - 1], b[b.length - 1]) <= gap) merged = [...a, ...b.slice().reverse()];
        else if (d(a[0], b[b.length - 1]) <= gap) merged = [...b, ...a];
        if (merged) {
          lines[i] = merged;
          lines.splice(j, 1);
          joined = true;
          break outer;
        }
      }
    }
  }
  return lines;
}

/**
 * Serpentine joins, only where both ends met the outer edge of the swatch (so a line is never joined across a hole,
 * a cut or a crowded patch): one strand continues into the next when the jog is short and stays inside.
 */
function joinAtBorder(list, outer, region, maxJog) {
  const atBorder = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y, len = Math.hypot(dx, dy) || 1;
    return !outer.contains(p.x + (dx / len) * 1.2, p.y + (dy / len) * 1.2);
  };
  const out = [];
  let cur = null;
  for (const pts of list) {
    if (cur) {
      const end = cur[cur.length - 1], start = pts[0];
      const ok = Math.hypot(start.x - end.x, start.y - end.y) <= maxJog
        && atBorder(end, cur[cur.length - 2]) && atBorder(start, pts[1])
        && region.contains((start.x + end.x) / 2, (start.y + end.y) / 2);
      if (ok) { cur.push(...pts); continue; }
      out.push(cur);
    }
    cur = pts.slice();
  }
  if (cur) out.push(cur);
  return out;
}

/** Splits a polyline wherever `ok(point)` is false. */
function splitWhere(pts, ok) {
  const out = [];
  let run = [];
  for (const p of pts) {
    if (ok(p)) run.push(p);
    else { if (run.length >= 2) out.push(run); run = []; }
  }
  if (run.length >= 2) out.push(run);
  return out;
}

/**
 * @param map      a key of MAPS
 * @param spacing  mm between neighbouring lines where the map stretches the least (the typical cell size)
 * @param feature  size of the holes or the distance of the poles, as a fraction of half the shorter side
 * @param arms, twist  the nautilus: how many lines of each family go once round
 */
export function conformalLayers(boundary, { map = 'hole', spacing = 3, feature = 0.35, arms = 21, twist = 13 } = {}) {
  const m = MAPS[map];
  if (!m) throw new Error(`Unknown conformal map: ${map}`);
  const box = boundary.bbox();
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const cx = box.minX + w / 2, cy = box.minY + h / 2;
  const L = Math.min(w, h) / 2;
  const params = { k: feature, arms, twist };
  const toZ = (x, y) => [(x - cx) / L, (y - cy) / L];

  // holes in mm; the nautilus' centre hole is as small as it can be before its lines crowd closer than MIN_GAP
  const turn = Math.hypot(arms, twist);
  let holes = m.holes(params).map((c) => ({ x: cx + c.x * L, y: cy + c.y * L, r: c.r * L }));
  if (m.spiral) holes.push({ x: cx, y: cy, r: Math.max(2, (MIN_GAP * turn) / TAU) });
  const inHole = (x, y) => holes.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r);

  const cell = Math.max(0.35, Math.min(spacing / 6, Math.max(w, h) / 320));
  const fAt = (x, y) => {
    const key = `${x},${y}`;
    let v = values.get(key);
    if (!v) {
      v = inHole(x, y) ? [NaN, NaN] : m.f(toZ(x, y), params);
      values.set(key, v);
    }
    return v;
  };

  // |f'| in the unit frame (the same in every direction, f being analytic)
  const slope = (x, y) => {
    const z = toZ(x, y), e = 1e-4;
    const a = m.f(z, params), b = m.f([z[0] + e, z[1]], params);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / e;
  };
  // the level step: the nautilus moves on a whole number of lines per turn, the others give `spacing` where the
  // map stretches least (the median of the stretch over the swatch)
  let step;
  if (m.spiral) {
    step = TAU / turn;
  } else {
    const samples = [];
    for (let y = box.minY + cell; y < box.maxY; y += 4 * cell) {
      for (let x = box.minX + cell; x < box.maxX; x += 4 * cell) {
        if (!inHole(x, y) && boundary.contains(x, y)) {
          const s = slope(x, y);
          if (Number.isFinite(s)) samples.push(s);
        }
      }
    }
    if (samples.length === 0) throw new ConfigError(['The holes fill the whole swatch; make them smaller.']);
    samples.sort((p, q) => p - q);
    step = (spacing * samples[Math.floor(samples.length * (m.percentile ?? 0.5))]) / L;
  }
  // near a pole |f'| grows like 1 / distance, so the lines come MIN_GAP apart at MIN_GAP / step mm from it
  if (m.poles) holes = holes.map((c) => ({ ...c, r: Math.max(c.r, (1.1 * MIN_GAP) / step) }));
  const region = new PolygonBoundary([...boundary.rings, ...holes.filter((c) => c.r > 0).map((c) => circle(c.x, c.y, c.r, 1).slice(0, -1))]);
  const values = new Map();
  const uField = sampleGrid(box, cell, (x, y) => fAt(x, y)[0]);
  const vField = sampleGrid(box, cell, (x, y) => fAt(x, y)[1]);
  if (uField.nx * uField.ny > 400000) throw new ConfigError(['This swatch is too large for the conformal mesh; use a smaller one.']);
  // where the lines come closer than MIN_GAP they are cut, so a singular point leaves a hole instead of a blob
  const roomy = (p) => (step * L) / slope(p.x, p.y) >= MIN_GAP;

  const family = (field, part) => {
    let lo = Infinity, hi = -Infinity;
    for (const v of field.data) if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const jump = m.spiral ? (part === 0 ? TAU * twist : TAU * arms) / turn : (m.cut?.[part === 0 ? 'u' : 'v'] ?? Infinity);
    const maxJump = jump / 2;
    const list = [];
    let flip = false;
    for (let level = Math.ceil(lo / step) * step + step * 0.5; level <= hi; level += step) {
      for (const line of isoLines(field, level, { maxJump })) {
        for (const piece of clipPolyline(line, region)) {
          for (const part2 of splitWhere(piece, roomy)) list.push(flip ? part2.reverse() : part2);
        }
      }
      flip = !flip;
    }
    return joinAtBorder(stitch(list, 2.5 * cell), boundary, region, 2.5 * spacing);
  };

  const hems = holes.flatMap((c) => clipPolyline(circle(c.x, c.y, c.r + 0.3), boundary));
  const layers = [family(uField, 0), family(vField, 1)];
  layers[m.hemLayer ?? 0].unshift(...hems);
  return { layers, extra: { holes: holes.length, cell } };
}
