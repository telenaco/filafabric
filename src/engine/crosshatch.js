import { hatch } from './layers.js';

/**
 * Crosshatch and isogrid: layers of parallel lines, each layer at its own angle, so every pair of layers crosses.
 * Two directions at 90° drape like woven cloth; three at 60° apart (an isogrid) are close to isotropic.
 * Lines may be given a wave so they can stretch along their own length, which straight strands barely do.
 */
export const DIRECTIONS = Object.freeze({
  '0-90': { label: '0° and 90°', hint: 'Square: like woven cloth', angles: [0, 90] },
  '45-135': { label: '45° and 135°', hint: 'Diagonal: stretches along the sides', angles: [45, 135] },
  '60-120': { label: '60° and 120°', hint: 'Two directions, leaning', angles: [60, 120] },
  '0-60-120': { label: 'Three ways', hint: 'Isogrid: three layers 60° apart', angles: [0, 60, 120] },
});

export const DIRECTION_IDS = Object.freeze(Object.keys(DIRECTIONS));

/**
 * @returns { layers } one layer per direction; every layer is hatch lines at that angle, offset so layers interleave
 */
export function crosshatchLayers(boundary, { directions = '0-90', spacing = 3, shape = 'wave', size = 0, pitch = 6 } = {}) {
  const set = DIRECTIONS[directions];
  if (!set) throw new Error(`Unknown crosshatch directions: ${directions}`);
  const layers = set.angles.map((angle, k) => hatch(boundary, {
    angle,
    spacing,
    offset: k === 0 ? 0 : 0.5 * (k % 2),
    shape: size > 0 ? shape : null,
    size,
    pitch,
  }));
  return { layers, angles: set.angles };
}
