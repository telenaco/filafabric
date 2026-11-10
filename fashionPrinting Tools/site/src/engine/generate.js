import { resolveConfig } from './params.js';
import { RectBoundary, PolygonBoundary } from './boundary.js';
import { buildBase, buildOutlineBase, crossBase } from './base.js';
import { finishFabric } from './fabric-result.js';
import { orderPlacements, travelDistance } from './fabric.js';
import { centredLanes } from './fill.js';
import { tile } from './tiler.js';
import { createRng } from './rng.js';
import { plan } from './planner.js';
import { computeStats } from './stats.js';
import { writeGcode, bedFitErrors, PreflightError } from './gcode.js';

/**
 * The whole pipeline: profiles + textile parameters -> tagged moves -> stats -> G-code.
 * `options.outline`: rings (mm, already fitted inside sample_width x sample_height) to fill instead of the rectangle.
 * Throws ConfigError (bad parameters) or PreflightError (cannot be printed on this machine).
 */
export function generate(machine, material, textile = {}, { outline = null, liftAt = null } = {}) {
  const cfg = resolveConfig(machine, material, textile);
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);
  const t = cfg.t;
  if (t.include_base) cfg.derived.loopBaseZ = t.loop_start_z ?? 3 * t.layer_height;
  const boundary = outline ? new PolygonBoundary(outline) : new RectBoundary(t.sample_width, t.sample_height);

  let base = null;
  let rows = null;
  if (outline) {
    const box = boundary.bbox();
    const lanes = centredLanes(box.minY, box.maxY, t.base_spacing);
    if (t.include_base) base = buildOutlineBase({ boundary, lanes, z: t.layer_height, inset: t.extrusion_width / 2 });
    rows = lanes.filter((_, k) => k % t.row_pitch_multiple === 0);
  } else if (t.include_base) {
    base = buildBase({
      bbox: boundary.bbox(),
      spacing: t.base_spacing,
      cornerRadius: t.corner_radius,
      z: t.layer_height,
      resolution: t.curve_resolution,
    });
  }

  if (t.include_base) {
    const box = boundary.bbox(), lanes = outline ? centredLanes(box.minY, box.maxY, t.base_spacing) : Array.from({ length: Math.floor(t.sample_height / t.base_spacing + 1e-9) + 1 }, (_, k) => k * t.base_spacing);
    base = crossBase({ boundary, lanes, spacing: t.base_spacing, z: t.layer_height, inset: outline ? t.extrusion_width / 2 : 0 });
  }

  const tiled = t.include_loops
    ? tile(cfg, boundary, createRng(t.random_seed), { rows, liftAt })
    : { placements: [], warnings: [], counts: { candidates: 0, kept: 0, dropped: 0, unresolvedLegs: 0 } };

  const beforeMm = travelDistance(tiled.placements.map((p) => ({ pts: p.points })));
  tiled.placements = orderPlacements(tiled.placements, { reverse: true });
  const routing = { beforeMm, afterMm: travelDistance(tiled.placements.map((p) => ({ pts: p.points }))) };

  const planned = plan(cfg, base, tiled.placements, boundary);
  const stats = computeStats(planned.moves, cfg, tiled.placements);
  const warnings = [...tiled.warnings, ...planned.warnings];
  if (planned.moves.length === 0) warnings.push('Nothing to print: enable the base or the loops');
  const gcode = writeGcode(planned.moves, cfg, { stats });

  return finishFabric({ cfg, base, placements: tiled.placements, moves: planned.moves, stats, warnings, counts: tiled.counts, gcode, outline, routing }, { boundary });
}
