import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { PolygonBoundary } from './boundary.js';
import { serpentineChains, centredLanes } from './fill.js';
import { emitStrands } from './emit.js';
import { lanePoints, lanePeriods, loopsClose, fillPitch } from './shapes.js';
import { fitLanes } from './repeats.js';
import { resolveCrossings } from './crossings.js';
import { MAX_MOVES } from './tiler.js';
import { finishFabric } from './fabric-result.js';
import { appendPoints } from './layers.js';

/**
 * Coil: flat rows of one continuous looped strand, one layer thick.
 *
 * Each row is a strand that circles over itself every `pitch` mm (or follows another shape). Rows are `rowPitch`
 * apart, where `rowOverlap` 0 leaves the loops of neighbouring rows just touching and larger values push them into
 * each other. Wherever the strand crosses itself or a neighbouring row, the later pass lifts over the earlier one by
 * about a layer (crossings.js), so there is no second layer and no hop between rows: a rectangle prints as a single
 * serpentine.
 */

const STEP = 0.4; // mm between points along a strand

/** Straight points from p to q, at most STEP apart (excluding p, including q). */
function connect(pts, p, q, z) {
  const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / STEP));
  for (let i = 1; i <= n; i++) pts.push({ x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n, z });
}

/** The row spacing for a loop size and an overlap fraction; never closer than a strand and a half. */
export function coilRowPitch(size, rowOverlap, strandWidth = 0.45) {
  return Math.max(2 * size * (1 - rowOverlap), 1.5 * strandWidth);
}

/**
 * @returns { strands, rows, loops, crossings, maxLift, maxSlopeDeg, rowPitch, warnings }
 *   sizeAt(x, y) → 0..1 (world mm) scales the loop size from a pattern field
 */
export function generateCoilTextile({
  width = 100,
  height = 100,
  shape = 'looped',
  size = 3,
  pitch = 5,
  rowOverlap = 0.25,
  layerHeight = 0.2,
  strandWidth = 0.45,
  lift = 0.25,
  sizeAt = null,
  boundary = null,
  rowPitch: rowPitchOverride = null,
  whole = true,
  planCrossings = true,
}) {
  const warnings = [];
  const rowPitch = rowPitchOverride ?? coilRowPitch(size, rowOverlap, strandWidth);
  const makesLoops = shape === 'looped' || shape === 'figure8' || shape === 'ring';
  if (shape === 'looped' && loopsClose(pitch, size)) {
    warnings.push('The loops close up: this size is too small for this spacing, so the line is only wavy. Make the loops larger or the spacing smaller.');
  }
  // whole repeats (repeats.js): rows from one edge to the other, and loops that fill each row to its ends
  const rowsIn = whole ? fitLanes : centredLanes;

  /** One lane as world points: `from` to `to` along x at height `c`. */
  const lane = (c, from, to) => {
    const dir = to >= from ? 1 : -1;
    const length = Math.abs(to - from);
    const field = sizeAt ? (u) => sizeAt(from + dir * u, c) : null;
    const p = whole ? fillPitch(shape, length, pitch, size) : pitch;
    const pts = lanePoints({ shape, length, pitch: p, size, sizeAt: field, step: STEP });
    return { pts: pts.map((q) => ({ x: from + dir * q.u, y: c + q.v, z: layerHeight })), loops: makesLoops ? lanePeriods({ shape, length, pitch: p, size }) : 0 };
  };

  const strands = [];
  let rows = 0;
  let loops = 0;
  let pointBudget = 0;

  if (!boundary || boundary.isRectangle) {
    if (width < pitch) warnings.push('The swatch is narrower than one loop, so each row is a plain line.');
    const y0 = Math.min(size, height / 2);
    const y1 = Math.max(height - size, height / 2);
    const rowYs = rowsIn(y0, y1, rowPitch);
    const count = rowYs.length;
    // cheap estimate first, so a huge layout is refused before anything is built
    const perRow = lanePoints({ shape, length: width, pitch, size, step: STEP }).length;
    pointBudget = perRow * count;
    if (pointBudget > MAX_MOVES) {
      throw new ConfigError([
        `This layout would need about ${pointBudget.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use larger loops, wider spacing or a smaller swatch.`,
      ]);
    }
    const pts = [];
    const bulge = Math.min(0.35 * rowPitch, 1.5);
    for (let k = 0; k < count; k++) {
      const c = rowYs[k];
      const forward = k % 2 === 0;
      const row = lane(c, forward ? 0 : width, forward ? width : 0);
      if (k > 0) {
        // a rounded turn from the end of the previous row to the start of this one, bulging outward
        const prev = pts[pts.length - 1];
        const next = row.pts[0];
        const turns = 6;
        const outward = forward ? -1 : 1; // the previous row ended at x = 0 when this one runs forward, else at x = width
        for (let i = 1; i < turns; i++) {
          const t = i / turns;
          pts.push({ x: prev.x + outward * Math.sin(Math.PI * t) * bulge, y: prev.y + (next.y - prev.y) * t, z: layerHeight });
        }
      }
      appendPoints(pts, row.pts);
      loops += row.loops;
      rows++;
    }
    strands.push({ id: 'coil', kind: 'base', name: 'Coil', pts, rowOrder: 0 });
  } else {
    const box = boundary.bbox();
    const margin = size * 0.6;
    const lo = box.minY + margin, hi = box.maxY - margin;
    const lanes = hi > lo ? rowsIn(lo, hi, rowPitch) : [(box.minY + box.maxY) / 2];
    const chains = serpentineChains(boundary, 'y', lanes, { inset: 0.3, minLength: Math.max(2 * pitch, 1), maxJog: 3 * rowPitch });
    let id = 0;
    for (const segments of chains) {
      const pts = [];
      for (const seg of segments) {
        const row = lane(seg.c, seg.from, seg.to);
        if (pts.length) connect(pts, pts[pts.length - 1], row.pts[0], layerHeight);
        appendPoints(pts, row.pts, pts.length ? 1 : 0);
        loops += row.loops;
        rows++;
      }
      pointBudget += pts.length;
      if (pointBudget > MAX_MOVES) {
        throw new ConfigError([
          `This layout would need more than ${MAX_MOVES.toLocaleString('en')} moves. Use larger loops, wider spacing or a smaller swatch.`,
        ]);
      }
      // rows are laid bottom to top, branch by branch (fill.js): the strands keep that order when printed
      strands.push({ id: id === 0 ? 'coil' : `coil-${id + 1}`, kind: 'base', name: 'Coil', pts, rowOrder: id });
      id++;
    }
    if (strands.length === 0) warnings.push('The outline is too small for these loops: nothing to print');
  }

  const resolved = planCrossings ? resolveCrossings(strands, { lift, strandWidth }) : { strands, crossings: 0, maxLift: 0, maxSlopeDeg: 0 };
  return {
    strands: resolved.strands,
    rows,
    loops,
    crossings: resolved.crossings,
    maxLift: resolved.maxLift,
    maxSlopeDeg: resolved.maxSlopeDeg,
    rowPitch,
    warnings,
  };
}

/**
 * End to end: machine, material and coil settings in, moves, stats and G-code out.
 * `params`: width, height, shape, size, pitch, rowOverlap (0..1), lift, layerHeight, sampler (x, y, w, h) → 0..1, outline (rings in mm).
 */
export function generateCoil(machine, material, params = {}) {
  const width = params.width ?? 100;
  const height = params.height ?? 100;
  const cfg = resolveConfig(machine, material, {
    sample_width: width,
    sample_height: height,
    // only when asked for, so the layer thickness the studio chose (on the material) is not overridden
    ...(params.layerHeight !== undefined ? { layer_height: params.layerHeight } : {}),
  });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);

  const outline = params.outline ?? null;
  const sampler = params.sampler ?? null;
  const coil = generateCoilTextile({
    width,
    height,
    shape: params.shape ?? 'looped',
    size: params.size ?? 3,
    pitch: params.pitch ?? 5,
    rowOverlap: params.rowOverlap ?? 0.25,
    rowPitch: params.rowPitch ?? null,
    layerHeight: cfg.t.layer_height,
    strandWidth: cfg.t.extrusion_width,
    lift: params.lift ?? 0.25,
    // a pattern shrinks the loops to 45% where it is 0 and leaves them full size where it is 1
    sizeAt: sampler ? (x, y) => 0.45 + 0.55 * Math.max(0, Math.min(1, sampler(x, y, width, height))) : null,
    boundary: outline ? new PolygonBoundary(outline) : null,
  });

  const moves = emitStrands(coil.strands);
  const stats = computeStats(moves, cfg, []);
  stats.loops = coil.loops;
  stats.crossings = coil.crossings;
  stats.maxLift = coil.maxLift;
  stats.maxSlopeDeg = coil.maxSlopeDeg;
  const gcode = writeGcode(moves, cfg, { stats });

  const warnings = [...coil.warnings];
  if (moves.length === 0 && warnings.length === 0) warnings.push('Nothing to print');
  return finishFabric({ cfg, strands: coil.strands, moves, stats, warnings, gcode, outline, coil }, { flat: true, reinforce: (params.shape ?? 'looped') === 'ring' });
}
