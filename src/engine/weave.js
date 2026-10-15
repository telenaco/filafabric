import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { PolygonBoundary } from './boundary.js';
import { emitStrands } from './emit.js';
import { MAX_MOVES } from './tiler.js';
import { finishFabric } from './fabric-result.js';

/**
 * Weave: warp lines (columns) and weft lines (rows) that pass over and under each other, two layers thick.
 *
 * A nozzle cannot go under a strand that is already printed (its body is above the tip), so a printed weave cannot
 * be woven the way cloth is. This one is printed in two passes by level instead: wherever a strand is "under" it
 * lies on the bed, wherever it is "over" it lies one layer up, and every strand is cut into pieces at the change
 * of level. Pass 1 prints all the lower pieces, pass 2 all the upper ones, so at every crossing the upper strand
 * is laid over the lower. Pieces meet at a short ramp in the middle of the gap between two crossings.
 *
 * The cost is a lift for every piece, and the strands fuse where they cross, so the binding changes how the fabric
 * looks and how its strands float far more than how it stretches.
 */

/** 0, 1, 2, 3, 3, 2, 1, 0, 0, 1 ...: a line number folded back on itself every `period` lines (a pointed draft). */
const fold = (n, period) => {
  const m = ((n % period) + period) % period;
  return m < period / 2 ? m : period - 1 - m;
};
/**
 * A crepe: no diagonal and no short repeat to follow. It is a quadratic in the line numbers taken mod 16, which is
 * irregular to the eye yet fixed, half over and half under, with no float longer than four crossings.
 */
const crepe = (i, j) => (3 * i * i + 6 * j * j + 4 * i * j + i + 2 * j) % 16 < 8;

export const WEAVE_BINDINGS = Object.freeze({
  plain: { id: 'plain', label: 'Plain', hint: 'Over one, under one', over: (i, j) => (i + j) % 2 === 0 },
  twill21: { id: 'twill21', label: 'Twill 2/1', hint: 'Over two, under one, stepping across', over: (i, j) => (i + j) % 3 !== 0 },
  twill22: { id: 'twill22', label: 'Twill 2/2', hint: 'Over two, under two', over: (i, j) => (i + j) % 4 < 2 },
  basket: { id: 'basket', label: 'Basket', hint: 'Pairs over pairs', over: (i, j) => (Math.floor(i / 2) + Math.floor(j / 2)) % 2 === 0 },
  satin: { id: 'satin', label: 'Satin', hint: 'Long floats with rare ties', over: (i, j) => (i + 2 * j) % 5 !== 0 },
  herringbone: { id: 'herringbone', label: 'Herringbone', hint: 'Twill 2/2 that turns round every four lines', over: (i, j) => (fold(i, 8) + j) % 4 < 2 },
  diamond: { id: 'diamond', label: 'Diamond twill', hint: 'Twill that turns round both ways, drawing diamonds', over: (i, j) => (fold(i, 8) + fold(j, 8)) % 4 < 2 },
  crepe: { id: 'crepe', label: 'Crepe', hint: 'Short floats in an irregular order: no twill line to follow', over: crepe },
});

export const WEAVE_BINDING_IDS = Object.freeze(Object.keys(WEAVE_BINDINGS));

export const MAX_PIECES = 12000;
const STEP = 0.5;
const smooth = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * One line of the weave as pieces. `crossings` are { t, level } in order along the line (level 1 = on the bed,
 * 2 = one layer up); the line runs from `from` to `to` along `axis` at position `c`.
 */
function linePieces({ axis, c, from, to, crossings, z1, z2, ramp }) {
  const levels = crossings.map((x) => x.level);
  const cuts = []; // where one level hands over to the next
  for (let k = 0; k + 1 < crossings.length; k++) {
    if (levels[k] !== levels[k + 1]) cuts.push({ t: (crossings[k].t + crossings[k + 1].t) / 2, to: levels[k + 1] });
  }
  const zOf = (level) => (level === 2 ? z2 : z1);
  let level = levels[0] ?? 1;
  const bounds = [{ start: from, level }];
  for (const cut of cuts) {
    bounds[bounds.length - 1].end = cut.t;
    level = cut.to;
    bounds.push({ start: cut.t, level });
  }
  bounds[bounds.length - 1].end = to;

  // the height along the line: each cut is a smooth step of one layer, centred on the cut
  const zAt = (t) => {
    let z = zOf(levels[0] ?? 1);
    let current = levels[0] ?? 1;
    for (const cut of cuts) {
      z += (zOf(cut.to) - zOf(current)) * smooth((t - (cut.t - ramp)) / (2 * ramp));
      current = cut.to;
    }
    return z;
  };

  return bounds.map((piece) => {
    const n = Math.max(1, Math.ceil((piece.end - piece.start) / STEP));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = piece.start + ((piece.end - piece.start) * i) / n;
      pts.push(axis === 'x' ? { x: c, y: t, z: zAt(t) } : { x: t, y: c, z: zAt(t) });
    }
    return { level: piece.level, pts };
  });
}

/**
 * @param pitch    mm between neighbouring warp lines, and between neighbouring weft lines
 * @param binding  a key of WEAVE_BINDINGS
 * @returns { strands, crossings, pieces, columns, rows, warnings }; strands are in print order (all lower pieces,
 *          then all upper pieces), each piece a strand so there is a lift between them
 */
export function generateWeaveTextile({ width, height, pitch = 4, binding = 'plain', layerHeight = 0.2, strandWidth = 0.45, boundary = null }) {
  const spec = WEAVE_BINDINGS[binding];
  if (!spec) throw new Error(`Unknown weave binding: ${binding}`);
  const warnings = [];
  const z1 = layerHeight;
  const z2 = 2 * layerHeight;
  const ramp = Math.max(0.4, Math.min(1.2, pitch / 2 - 0.8));
  const columns = Math.floor(width / pitch + 1e-9);
  const rows = Math.floor(height / pitch + 1e-9);
  const x = (i) => (width - (columns - 1) * pitch) / 2 + i * pitch;
  const y = (j) => (height - (rows - 1) * pitch) / 2 + j * pitch;
  if (columns < 1 || rows < 1) {
    return { strands: [], crossings: 0, pieces: 0, columns: Math.max(0, columns), rows: Math.max(0, rows), warnings: ['The swatch is smaller than one pitch: nothing to print'] };
  }

  const isRect = !boundary || boundary.isRectangle;
  const inside = (cx, cy) => (isRect ? cx >= 0 && cx <= width && cy >= 0 && cy <= height : boundary.contains(cx, cy));
  const warpSpans = (i) => (isRect ? [[0, height]] : boundary.intervals('x', x(i)).map(([a, b]) => [a + 0.3, b - 0.3]).filter(([a, b]) => b - a >= 1));
  const weftSpans = (j) => (isRect ? [[0, width]] : boundary.intervals('y', y(j)).map(([a, b]) => [a + 0.3, b - 0.3]).filter(([a, b]) => b - a >= 1));

  const pieces = []; // { level, pts, order }
  let crossings = 0;
  let order = 0;
  for (let i = 0; i < columns; i++) {
    for (const [a, b] of warpSpans(i)) {
      const marks = [];
      for (let j = 0; j < rows; j++) {
        if (y(j) > a && y(j) < b && inside(x(i), y(j))) marks.push({ t: y(j), level: spec.over(i, j) ? 1 : 2 });
      }
      crossings += marks.length;
      for (const p of linePieces({ axis: 'x', c: x(i), from: a, to: b, crossings: marks, z1, z2, ramp })) pieces.push({ ...p, order: order++ });
    }
  }
  for (let j = 0; j < rows; j++) {
    for (const [a, b] of weftSpans(j)) {
      const marks = [];
      for (let i = 0; i < columns; i++) {
        if (x(i) > a && x(i) < b && inside(x(i), y(j))) marks.push({ t: x(i), level: spec.over(i, j) ? 2 : 1 });
      }
      for (const p of linePieces({ axis: 'y', c: y(j), from: a, to: b, crossings: marks, z1, z2, ramp })) pieces.push({ ...p, order: order++ });
    }
  }
  // each crossing was counted from its warp line only
  if (pieces.length > MAX_PIECES) {
    throw new ConfigError([`This weave would need ${pieces.length.toLocaleString('en')} separate pieces, a lift for each; the limit is ${MAX_PIECES.toLocaleString('en')}. Use a wider pitch, a plainer binding (satin has the fewest pieces) or a smaller swatch.`]);
  }
  const pointCount = pieces.reduce((n, p) => n + p.pts.length, 0);
  if (pointCount > MAX_MOVES) {
    throw new ConfigError([`This weave would need about ${pointCount.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use a wider pitch or a smaller swatch.`]);
  }

  // print order: every lower piece first, then every upper one; within a pass, always the nearest piece next
  const strands = [];
  let id = 0;
  let at = null;
  for (const level of [1, 2]) {
    const left = pieces.filter((p) => p.level === level);
    while (left.length) {
      let pick = 0, reverse = false, best = Infinity;
      if (at) {
        left.forEach((p, k) => {
          const a = p.pts[0], b = p.pts[p.pts.length - 1];
          const da = Math.hypot(a.x - at.x, a.y - at.y), db = Math.hypot(b.x - at.x, b.y - at.y);
          if (da < best) { best = da; pick = k; reverse = false; }
          if (db < best) { best = db; pick = k; reverse = true; }
        });
      }
      const piece = left.splice(pick, 1)[0];
      const pts = reverse ? piece.pts.slice().reverse() : piece.pts;
      at = pts[pts.length - 1];
      strands.push({ id: `w${id++}`, kind: level === 1 ? 'base' : 'supported', name: level === 1 ? 'Lower strands' : 'Upper strands', pts });
    }
  }
  if (strandWidth > pitch - 0.5) warnings.push('The strands are almost as wide as the pitch, so neighbouring lines will touch');
  return { strands, crossings, pieces: pieces.length, columns, rows, warnings };
}

/**
 * End to end: machine, material and weave settings in, moves, stats and G-code out.
 * `params`: width, height, pitch (mm), binding, outline (rings in mm) or null.
 */
export function generateWeave(machine, material, params = {}) {
  const width = params.width ?? 100;
  const height = params.height ?? 100;
  const cfg = resolveConfig(machine, material, { sample_width: width, sample_height: height });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);
  const outline = params.outline ?? null;
  const weave = generateWeaveTextile({
    width,
    height,
    pitch: params.pitch ?? 4,
    binding: params.binding ?? 'plain',
    layerHeight: cfg.t.layer_height,
    strandWidth: cfg.t.extrusion_width,
    boundary: outline ? new PolygonBoundary(outline) : null,
  });
  const moves = emitStrands(weave.strands, { retraction: cfg.derived.retraction });
  const stats = computeStats(moves, cfg, []);
  stats.loops = 0;
  stats.crossings = weave.crossings;
  stats.pieces = weave.pieces;
  const gcode = writeGcode(moves, cfg, { stats });
  const warnings = [...weave.warnings];
  if (moves.length === 0 && warnings.length === 0) warnings.push('Nothing to print');
  return finishFabric({ cfg, strands: weave.strands, moves, stats, warnings, gcode, outline, weave });
}
