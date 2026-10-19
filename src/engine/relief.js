import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { plan } from './planner.js';
import { PolygonBoundary, RectBoundary } from './boundary.js';
import { serpentineChains } from './fill.js';
import { fitLanes } from './repeats.js';
import { MAX_MOVES } from './tiler.js';
import { crossBase } from './base.js';
import { finishFabric } from './fabric-result.js';
import { appendPoints } from './layers.js';

/** The rows of a relief: from one edge to the other, the first and last 0.3 mm in, as near `rowPitch` apart as fits (repeats.js). */
const rowLanes = (lo, hi, rowPitch) => fitLanes(lo + 0.3, hi - 0.3, rowPitch);

/**
 * Relief: one strand per piece of fabric, row after row, that follows a pattern field up and down. Where the field is
 * below `floor` the strand lies on the bed; above it, the strand rises into a smooth arch (a bobble, a ridge, a
 * seersucker pucker) and comes back down. Nothing is printed on top of anything, so the fabric is one strand thick;
 * the relief is what gives it body.
 */

const STEP = 0.5; // mm between points along a row
const EDGE = 1.5; // mm: the relief fades to the bed this far from the left and right edges, so rows can be joined

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** Height (mm above the bed) for a field value: 0 below `floor`, then a smooth rise to `relief`. */
export function reliefHeight(f, relief, floor = 0.3) {
  return relief * smooth((f - floor) / (1 - floor));
}

/**
 * A raised stretch of strand with nothing under it sags, so no raised run may be longer than `maxSpan`: a run that is
 * is cut by a dip to the bed at its lowest point in the middle half, and so on until every run is short enough.
 * `u` is the distance along the row of each point.
 */
function anchorLongSpans(z, u, maxSpan) {
  for (let pass = 0; pass < 60; pass++) {
    let changed = false;
    let i = 0;
    while (i < z.length) {
      if (z[i] <= 0.05) { i++; continue; }
      let j = i;
      while (j + 1 < z.length && z[j + 1] > 0.05) j++;
      if (u[j] - u[i] > maxSpan) {
        const lo = i + Math.floor((j - i) * 0.25), hi = i + Math.ceil((j - i) * 0.75);
        let k = lo;
        for (let m = lo; m <= hi; m++) if (z[m] < z[k]) k = m;
        for (let m = i; m <= j; m++) z[m] = Math.min(z[m], z[m] * smooth(Math.abs(u[m] - u[k]) / 1.5));
        changed = true;
      }
      i = j + 1;
    }
    if (!changed) return;
  }
}

/**
 * The highest profile under `z` whose slope never exceeds `maxSlopeDeg` (a forward and a backward pass of
 * z[i] <= z[i-1] + rise). A bump narrower than the slope allows is cut down to what the strand can climb; broad
 * ones are untouched. `xy[i]` is the distance from point i-1 to point i along the ground.
 */
function limitSlope(z, xy, maxSlopeDeg) {
  const tan = Math.tan((maxSlopeDeg * Math.PI) / 180);
  for (let i = 1; i < z.length; i++) z[i] = Math.min(z[i], z[i - 1] + tan * xy[i]);
  for (let i = z.length - 2; i >= 0; i--) z[i] = Math.min(z[i], z[i + 1] + tan * xy[i + 1]);
}

/**
 * Rows of strand with relief. Returns placements in the shape the planner prints (points carry z above the bed).
 * `field(x, y, w, h)` is a 0..1 sampler; with no field every row is flat.
 */
export function reliefPlacements({ width, height, field = null, relief = 2, rowPitch = 3, floor = 0.3, boundary = null, maxSlopeDeg = 25, maxSpan = 16 }) {
  const warnings = [];
  const height_ = (x, y, fade) => (field ? reliefHeight(field(x, y, width, height), relief, floor) * fade : 0);
  const placements = [];
  let rows = 0;

  const rowPoints = (c, from, to) => {
    const dir = to >= from ? 1 : -1;
    const length = Math.abs(to - from);
    const n = Math.max(1, Math.ceil(length / STEP));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = (length * i) / n;
      const x = from + dir * u;
      const fade = smooth(Math.min(u, length - u) / EDGE);
      pts.push({ x, y: c, z: height_(x, c, fade) });
    }
    const z = pts.map((p) => p.z);
    const u = pts.map((p) => Math.abs(p.x - from));
    anchorLongSpans(z, u, maxSpan);
    limitSlope(z, pts.map((p, i) => (i ? Math.abs(p.x - pts[i - 1].x) : 0)), maxSlopeDeg);
    pts.forEach((p, i) => { p.z = z[i]; });
    return pts;
  };

  if (!boundary || boundary.isRectangle) {
    const lanes = rowLanes(0, height, rowPitch);
    const pts = [];
    const bulge = Math.min(0.35 * rowPitch, 1.5);
    lanes.forEach((c, k) => {
      const forward = k % 2 === 0;
      const row = rowPoints(c, forward ? 0 : width, forward ? width : 0);
      if (k > 0) {
        const prev = pts[pts.length - 1];
        const next = row[0];
        const turns = 6;
        for (let i = 1; i < turns; i++) {
          const t = i / turns;
          pts.push({ x: prev.x + (forward ? 1 : -1) * Math.sin(Math.PI * t) * bulge, y: prev.y + (next.y - prev.y) * t, z: 0 });
        }
      }
      appendPoints(pts, row);
      rows++;
    });
    placements.push({ id: 'relief', row: 0, col: 0, footY: lanes[0] ?? 0, points: pts });
  } else {
    const box = boundary.bbox();
    const lanes = rowLanes(box.minY, box.maxY, rowPitch);
    const chains = serpentineChains(boundary, 'y', lanes, { inset: 0.3, minLength: 2, maxJog: 3 * rowPitch });
    chains.forEach((segments, index) => {
      const pts = [];
      for (const seg of segments) {
        const row = rowPoints(seg.c, seg.from, seg.to);
        if (pts.length) {
          const prev = pts[pts.length - 1];
          const n = Math.max(1, Math.ceil(Math.hypot(row[0].x - prev.x, row[0].y - prev.y) / STEP));
          for (let i = 1; i < n; i++) pts.push({ x: prev.x + ((row[0].x - prev.x) * i) / n, y: prev.y + ((row[0].y - prev.y) * i) / n, z: 0 });
        }
        appendPoints(pts, row);
        rows++;
      }
      placements.push({ id: index === 0 ? 'relief' : `relief-${index + 1}`, row: 0, col: index, footY: segments[0].c, points: pts });
    });
    if (placements.length === 0) warnings.push('The outline is too small for these rows: nothing to print');
  }

  // arc length and the highest point, as the planner and the statistics expect
  let peak = 0;
  let longestSpan = 0;
  let maxSlope = 0;
  for (const p of placements) {
    let s = 0;
    let run = 0;
    p.points.forEach((q, i) => {
      if (i > 0) {
        const a = p.points[i - 1];
        const d = Math.hypot(q.x - a.x, q.y - a.y);
        s += d;
        if (d > 1e-9) maxSlope = Math.max(maxSlope, Math.abs(q.z - a.z) / d);
        run = q.z > 0.05 && a.z > 0.05 ? run + d : 0;
        longestSpan = Math.max(longestSpan, run);
      }
      q.s = s;
      q.part = 'leg';
      peak = Math.max(peak, q.z);
    });
    p.arcLength = s;
    p.lift = Math.max(relief, peak);
  }
  return { placements, rows, peak, longestSpan, maxSlopeDeg: (Math.atan(maxSlope) * 180) / Math.PI, warnings };
}

/**
 * End to end: machine, material and relief settings in, moves, stats and G-code out.
 * `params`: width, height, relief (mm), rowPitch (mm), field (sampler or null), outline (rings in mm).
 */
export function generateRelief(machine, material, params = {}) {
  const width = params.width ?? 100;
  const height = params.height ?? 100;
  const relief = params.relief ?? 2;
  const cfg = resolveConfig(machine, material, {
    sample_width: width,
    sample_height: height,
    include_base: false,
    loop_z_lift: relief,
    random_enabled: false,
  });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);

  const outline = params.outline ?? null;
  const boundary = outline ? new PolygonBoundary(outline) : new RectBoundary(width, height);
  const rowPitch = params.rowPitch ?? 3;
  const estimate = Math.ceil((width / STEP) * (height / rowPitch));
  if (estimate > MAX_MOVES) {
    throw new ConfigError([`This layout would need about ${estimate.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use wider rows or a smaller swatch.`]);
  }
  const r = reliefPlacements({ width, height, field: params.field ?? null, relief, rowPitch, floor: params.floor ?? 0.3, boundary });
  cfg.derived.loopBaseZ = 3 * cfg.t.layer_height;
  const box = boundary.bbox(), lanes = rowLanes(box.minY, box.maxY, rowPitch);
  const base = crossBase({ boundary, lanes, spacing: rowPitch, z: cfg.t.layer_height, inset: outline ? cfg.t.extrusion_width / 2 : 0 });
  const planned = plan(cfg, base, r.placements, boundary);
  const stats = computeStats(planned.moves, cfg, r.placements);
  const warnings = [...r.warnings, ...planned.warnings];
  if (planned.moves.length === 0 && warnings.length === 0) warnings.push('Nothing to print');
  const gcode = writeGcode(planned.moves, cfg, { stats });
  return finishFabric({ cfg, base, placements: r.placements, moves: planned.moves, stats, warnings, gcode, outline, relief: { rows: r.rows, peak: r.peak, longestSpan: r.longestSpan, maxSlopeDeg: r.maxSlopeDeg } }, { boundary });
}
