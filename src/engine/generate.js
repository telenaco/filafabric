import { resolveConfig } from './params.js';
import { RectBoundary } from './boundary.js';
import { buildBase } from './base.js';
import { tile } from './tiler.js';
import { createRng } from './rng.js';
import { plan } from './planner.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';

/**
 * The whole pipeline: profiles + textile parameters -> tagged moves -> stats -> G-code.
 * Throws ConfigError (bad parameters) or PreflightError (cannot be printed on this machine).
 */
export function generate(machine, material, textile = {}) {
  const cfg = resolveConfig(machine, material, textile);
  const t = cfg.t;
  const boundary = new RectBoundary(t.sample_width, t.sample_height);

  const base = t.include_base
    ? buildBase({
        bbox: boundary.bbox(),
        spacing: t.base_spacing,
        cornerRadius: t.corner_radius,
        z: t.layer_height,
        resolution: t.curve_resolution,
      })
    : null;

  const tiled = t.include_loops
    ? tile(cfg, boundary, createRng(t.random_seed))
    : { placements: [], warnings: [], counts: { candidates: 0, kept: 0, dropped: 0, unresolvedLegs: 0 } };

  const planned = plan(cfg, base, tiled.placements, boundary);
  const stats = computeStats(planned.moves, cfg, tiled.placements);
  const warnings = [...tiled.warnings, ...planned.warnings];
  if (planned.moves.length === 0) warnings.push('Nothing to print: enable the base or the loops');
  const gcode = writeGcode(planned.moves, cfg, { stats });

  return { cfg, base, placements: tiled.placements, moves: planned.moves, stats, warnings, counts: tiled.counts, gcode };
}
