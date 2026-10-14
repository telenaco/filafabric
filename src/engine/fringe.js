import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { plan } from './planner.js';
import { crossBase } from './base.js';
import { finishFabric } from './fabric-result.js';
import { orderPlacements, travelDistance } from './fabric.js';
import { RectBoundary } from './boundary.js';
import { createRng } from './rng.js';
import { MAX_LOOPS, MAX_MOVES } from './tiler.js';

/**
 * Fringe: a mesh of base lines with hairs standing off them. Each hair is anchored on a base line, rises in the first
 * half of its length and then hangs free to its end: an open loop. Hairs are printed from the far rows to the near
 * rows, as the loop pile does, so the nozzle never dives under a raised strand.
 */

const STEP = 0.5; // mm between points along a hair
const smooth = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * @returns { placements, rows, hairs }. Placements are in the planner's shape (z above the loop base level).
 *   variation 0..100 scales a seeded wobble of each hair's length, height and sideways drift.
 */
export function fringePlacements({ width, height, length = 15, lift = 3, spacing = 3, rowGap = 5, variation = 0, seed = 1 }) {
  const rng = createRng(seed);
  const v = Math.max(0, Math.min(1, variation / 100));
  const rows = Math.floor(height / rowGap + 1e-9) + 1;
  const perRow = Math.max(0, Math.floor((width - spacing) / spacing + 1e-9) + 1);
  if (perRow * rows > MAX_LOOPS) {
    throw new ConfigError([`Too many hairs (about ${perRow * rows}); the limit is ${MAX_LOOPS}. Increase the hair spacing or the row gap, or use a smaller swatch.`]);
  }
  const list = [];
  for (let k = 0; k < rows; k++) {
    const y0 = k * rowGap;
    const shift = k % 2 === 1 ? spacing / 2 : 0;
    for (let i = 0; i < perRow; i++) {
      const x0 = spacing / 2 + shift + i * spacing;
      if (x0 > width) break;
      // draw the wobble first so a hair that is skipped does not shift the ones after it
      const wobbleLength = rng.symmetric(0.25);
      const wobbleLift = rng.symmetric(0.2);
      const drift = rng.symmetric(1);
      const L = Math.min(length * (1 + v * wobbleLength), height - y0);
      if (L < 2) continue;
      // A hair shortened by the panel edge must also become lower; smoothstep's peak derivative is 3h/L.
      const h = Math.min(Math.max(0.2, lift * (1 + v * wobbleLift)), L * Math.tan(25 * Math.PI / 180) / 3);
      const n = Math.max(2, Math.ceil(L / STEP));
      const points = [];
      for (let m = 0; m <= n; m++) {
        const t = m / n;
        points.push({ x: x0 + v * 1.2 * drift * Math.sin(Math.PI * t) , y: y0 + L * t, z: h * smooth(t / 0.5), s: L * t, part: 'leg' });
      }
      list.push({ id: `h${k}c${i}`, row: k, col: i, footY: y0, points, arcLength: L, lift: h });
    }
  }
  // far rows first, left to right within a row
  list.sort((a, b) => b.row - a.row || a.col - b.col);
  return { placements: list, rows, hairs: list.length };
}

/**
 * End to end: machine, material and fringe settings in, moves, stats and G-code out.
 * `params`: width, height, length, lift, spacing, rowGap, variation (0..100), seed.
 */
export function generateFringe(machine, material, params = {}) {
  const width = params.width ?? 100;
  const height = params.height ?? 100;
  const rowGap = params.rowGap ?? 5;
  const length = params.length ?? 15;
  const cfg = resolveConfig(machine, material, {
    sample_width: width,
    sample_height: height,
    base_spacing: rowGap,
    loop_length: length,
    loop_z_lift: params.lift ?? 3,
    random_enabled: false,
  });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);

  const t = cfg.t;
  cfg.derived.loopBaseZ = 3 * t.layer_height;
  const boundary = new RectBoundary(width, height);
  const lanes = Array.from({ length: Math.floor(height / rowGap + 1e-9) + 1 }, (_, k) => k * rowGap);
  const base = crossBase({ boundary, lanes, spacing: rowGap, z: t.layer_height });
  const f = fringePlacements({ width, height, length, lift: params.lift ?? 3, spacing: params.spacing ?? 3, rowGap, variation: params.variation ?? 0, seed: params.seed ?? 1 });
  const beforeMm = travelDistance(f.placements.map((p) => ({ pts: p.points })));
  f.placements = orderPlacements(f.placements);
  const routing = { beforeMm, afterMm: travelDistance(f.placements.map((p) => ({ pts: p.points }))) };
  const estimate = Math.ceil((f.hairs * length) / STEP);
  if (estimate > MAX_MOVES) {
    throw new ConfigError([`This layout would need about ${estimate.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use fewer or shorter hairs.`]);
  }
  const planned = plan(cfg, base, f.placements, boundary);
  const stats = computeStats(planned.moves, cfg, f.placements);
  const warnings = [...planned.warnings];
  if (f.hairs === 0) warnings.push('No hairs fit: the swatch is shorter than one hair, so only the base will print');
  const gcode = writeGcode(planned.moves, cfg, { stats });
  return finishFabric({ cfg, base, placements: f.placements, moves: planned.moves, stats, warnings, gcode, outline: null, routing, fringe: { rows: f.rows, hairs: f.hairs } }, { boundary });
}
