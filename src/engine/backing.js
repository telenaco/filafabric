import { hatch } from './layers.js';
import { infillLines } from './infill.js';
import { waveLines } from './wavegrid.js';

/**
 * The layers laid across a curve or a field to hold it: lines at an angle over the first layer.
 *
 *  - 'wave'     sine-wave lines whose depth and length you set: the wavy backing, close to a gyroid slice
 *  - 'gyroid'   the lines of a gyroid slice itself, fixed in shape
 *  - 'straight' plain parallel lines (a hatch)
 *
 * One backing makes a design two layers; a second backing, turned across the first, makes it three.
 */
export const BACKING_STYLES = Object.freeze(['wave', 'gyroid', 'straight']);
export const BACKING_LAYER_COUNTS = Object.freeze(['one', 'two']);

/**
 * @param style      'wave' | 'gyroid' | 'straight'
 * @param angle      degrees the whole backing is turned
 * @param spacing    mm between lines: for the gyroid and straight backings area / length, for the wave the distance
 *                   between the lines' centres
 * @param depth      wave only: mm each line swings to either side of its centre line
 * @param wavelength wave only: mm per full wave
 * @param layer      which backing layer this is (1, 2): a wave is shifted a quarter wave per layer, a gyroid moves on a slice
 */
export function backingLines(boundary, { style = 'straight', angle = 45, spacing = 5, depth = 2, wavelength = 10, layer = 1 } = {}) {
  if (style === 'gyroid') return infillLines('gyroid', boundary, { spacing, angle, layer });
  if (style === 'wave') return waveLines(boundary, { angle, spacing, amplitude: depth, wavelength, shape: 'sine', phase: 0.25 * (layer - 1) });
  return hatch(boundary, { angle, spacing });
}

/**
 * The backing layers of a design: one, or two with the second turned 90° across the first.
 * @param count  'one' | 'two'
 * @returns an array of layers, each an array of polylines
 */
export function backingStack(boundary, options, count = 'one') {
  const first = backingLines(boundary, { ...options, layer: 1 });
  if (count !== 'two') return [first];
  return [first, backingLines(boundary, { ...options, angle: (options.angle ?? 45) + 90, layer: 2 })];
}
