import { clipPolyline } from './layers.js';
import { minCrossingAmplitude } from './squiggle.js';

/**
 * Rosette (guilloché): the parallel squiggle mesh wrapped round a centre, for round pieces. The first layer is one
 * continuous spiral that grows by `spacing` per turn and swings in and out `lobes` times per turn; the second is the
 * same spiral half a turn spacing further out, swinging the opposite way. A whole number of lobes per turn keeps
 * every turn in step with the next, so, exactly as in the parallel mesh, each second-layer turn crosses the turns on
 * both sides as long as the swing is at least a quarter of the spacing plus half a strand.
 */

const TAU = Math.PI * 2;
const MIN_WAVE = 3; // mm: the shortest wave along a turn; the centre is left open where they would be shorter

/**
 * @param spacing  mm between neighbouring turns of one layer
 * @param lobes    swings in and out per turn
 * @param depth    mm of swing (raised to the crossing minimum if lower)
 * @param hub      radius of the open centre, mm (widened so no wave is shorter than MIN_WAVE)
 */
export function rosetteLayers(boundary, { spacing = 4, lobes = 18, depth = 1.4, hub = 4, strandWidth = 0.45 } = {}) {
  const box = boundary.bbox();
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const R = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2 + spacing;
  const swing = Math.max(depth, minCrossingAmplitude(spacing, strandWidth));
  const open = Math.max(hub, (lobes * MIN_WAVE) / TAU, swing + 1);
  const turns = Math.max(1, (R - open) / spacing);

  const spiral = (offset, sign) => {
    const pts = [];
    for (let theta = 0; theta <= turns * TAU; ) {
      const base = open + offset + (spacing * theta) / TAU;
      const r = base + sign * swing * Math.sin(lobes * theta);
      pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
      // half a millimetre of arc, and at least sixteen points per lobe
      theta += Math.min(0.5 / Math.max(base, 1), TAU / (lobes * 16));
    }
    return clipPolyline(pts, boundary);
  };
  return { layers: [spiral(0, 1), spiral(spacing / 2, -1)], extra: { swing, open, turns } };
}
