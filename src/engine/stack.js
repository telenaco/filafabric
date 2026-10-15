import { ConfigError } from './params.js';
import { resolveCrossings } from './crossings.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';
import { analyzeFabric } from './fabric.js';
import { PolygonBoundary } from './boundary.js';
import { MAX_MOVES } from './tiler.js';

/**
 * Number of layers: a structure printed on top of itself, for a thicker fabric.
 *
 * Copy k lies one layer height above copy k - 1, point for point, and wherever it crosses an earlier strand it lifts
 * over it by a layer, so at a crossing the strands pile up one layer at a time instead of passing through each other.
 */

/**
 * @param strands  ordered strands { id, pts: [{ x, y, z }] } of one copy
 * @param count    how many copies in all (1 returns the strands as they are)
 * @returns strands of every copy, in print order, copy by copy
 */
export function stackStrands(strands, count, { layerHeight = 0.2, strandWidth = 0.45 } = {}) {
  const copies = Math.max(1, Math.round(count));
  if (copies <= 1) return strands;
  const all = [];
  for (let k = 0; k < copies; k++) {
    for (const s of strands) {
      all.push({ ...s, id: `${s.id}~${k + 1}`, copy: k, pts: s.pts.map((p) => ({ ...p, z: p.z + k * layerHeight })) });
    }
  }
  return resolveCrossings(all, { follow: true, preserve: true, lift: layerHeight, strandWidth }).strands;
}

/**
 * A finished result printed `count` times on top of itself: the moves, the statistics, the fabric check and the G-code
 * are made again from the stacked strands. Results made of raised loops (`placements`) keep their own height and come
 * back unchanged.
 */
export function stackLayers(result, count) {
  const copies = Math.max(1, Math.round(count));
  if (copies <= 1 || !result?.strands?.length || result.placements?.length || !result.cfg) return result;
  const { cfg } = result;
  const layerHeight = cfg.t.layer_height, strandWidth = cfg.t.extrusion_width;
  const points = result.strands.reduce((n, s) => n + s.pts.length, 0);
  if (points * copies > MAX_MOVES) {
    throw new ConfigError([`${copies} layers of this pattern would need about ${(points * copies).toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use fewer layers, a wider spacing or a smaller swatch.`]);
  }
  const strands = stackStrands(result.strands, copies, { layerHeight, strandWidth });
  const moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  const stats = { ...result.stats, ...computeStats(moves, cfg, []) };
  stats.loops = result.stats.loops;
  stats.crossings = result.stats.crossings;
  const boundary = new PolygonBoundary(result.outline ?? [[{ x: 0, y: 0 }, { x: cfg.t.sample_width, y: 0 }, { x: cfg.t.sample_width, y: cfg.t.sample_height }, { x: 0, y: cfg.t.sample_height }]]);
  const fabric = analyzeFabric(strands, { strandWidth, layerHeight, boundary });
  const gcode = writeGcode(moves, cfg, { stats, comments: [`The pattern printed ${copies} times on top of itself, each ${layerHeight} mm above the one before`] });
  return { ...result, strands, moves, stats, fabric, gcode, stack: { copies }, warnings: [...(result.warnings ?? []).filter((w) => !fabric.issues.includes(w)), ...fabric.issues] };
}
