import { hatch } from './layers.js';

/**
 * Dip weave: warp lines straight on the bed, and weft lines printed after them that ride over each warp and dip
 * back to the bed between. It is one layer thick except at the crossings, where the weft sits on the warp.
 *
 * Nothing is printed in mid-air: the weft is on the bed everywhere except where it passes over a warp. The nozzle tip
 * has to fit in the gap between two warp lines to lay the weft down there, which is why the pitch has a floor.
 */
export const MIN_DIP_PITCH = 2.5; // mm between lines: the least that lets the nozzle tip drop to the bed between warps

export function dipweaveLayers(boundary, { warpPitch = 3.5, weftPitch = 3.5 } = {}) {
  const warp = hatch(boundary, { angle: 90, spacing: warpPitch });
  const weft = hatch(boundary, { angle: 0, spacing: weftPitch, offset: 0.25 });
  // one layer: the weft comes after the warp, so crossings lift the weft over it
  return { layers: [[...warp, ...weft]], extra: { warpPitch, weftPitch } };
}
