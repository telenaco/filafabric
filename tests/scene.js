import { resolveConfig } from '../src/engine/params.js';
import { RectBoundary } from '../src/engine/boundary.js';
import { buildBase } from '../src/engine/base.js';
import { tile } from '../src/engine/tiler.js';
import { createRng } from '../src/engine/rng.js';
import { defaultProfiles } from './helpers.js';

/** Builds cfg + boundary + base + tiled loops for a parameter override set. */
export function scene(over = {}, profiles = {}) {
  const defaults = defaultProfiles();
  const cfg = resolveConfig(profiles.machine ?? defaults.machine, profiles.material ?? defaults.material, over);
  const boundary = new RectBoundary(cfg.t.sample_width, cfg.t.sample_height);
  const t = cfg.t;
  const base = t.include_base
    ? buildBase({ bbox: boundary.bbox(), spacing: t.base_spacing, cornerRadius: t.corner_radius, z: t.layer_height, resolution: t.curve_resolution })
    : null;
  const tiled = t.include_loops
    ? tile(cfg, boundary, createRng(t.random_seed))
    : { placements: [], warnings: [], counts: { candidates: 0, kept: 0, dropped: 0, unresolvedLegs: 0 } };
  return { cfg, boundary, base, tiled };
}
