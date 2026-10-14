import { hatch } from './layers.js';

/**
 * Crosshatch and isogrid: layers of parallel lines, each layer at its own angle, so every pair of layers crosses.
 * Two directions at 90° drape like woven cloth; three at 60° apart (an isogrid) are close to isotropic.
 * A kagome is three directions placed so that only two lines ever meet at a point (hexagons and triangles).
 * Lines may be given a wave so they can stretch along their own length, which straight strands barely do.
 */
export const DIRECTIONS = Object.freeze({
  '0-90': { label: '0° and 90°', hint: 'Square: like woven cloth', angles: [0, 90] },
  '45-135': { label: '45° and 135°', hint: 'Diagonal: stretches along the sides', angles: [45, 135] },
  '60-120': { label: '60° and 120°', hint: 'Two directions, leaning', angles: [60, 120] },
  '0-60-120': { label: 'Three ways', hint: 'Isogrid: three layers 60° apart meeting in triangles', angles: [0, 60, 120], offsets: [0, 0, 0] },
  kagome: { label: 'Kagome', hint: 'Three ways in hexagons and triangles: never more than two strands at a crossing', angles: [0, 60, 120], offsets: [0, 0.5, 0] },
});

export const DIRECTION_IDS = Object.freeze(Object.keys(DIRECTIONS));

/**
 * @returns { layers } one layer per direction; every layer is hatch lines at that angle, offset so layers interleave
 */
export function crosshatchLayers(boundary, { directions = '0-90', spacing = 3, shape = 'wave', size = 0, pitch = 6 } = {}) {
  const set = DIRECTIONS[directions];
  if (!set) throw new Error(`Unknown crosshatch directions: ${directions}`);
  // three directions are placed on one lattice through the middle: a line at angle a lies where n(a)·p is a whole
  // number of spacings (plus its offset), and n(0) - n(60) + n(120) = 0, so three lines meet at a point only where
  // their offsets add up (o0 - o60 + o120) to a whole number. Offsets of 0 give the isogrid's triangles; ½ moves every
  // third line off the crossings of the other two, the kagome's hexagons, so no crossing stacks three strands.
  const box = boundary.bbox();
  const anchor = set.offsets ? { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 } : null;
  const layers = set.angles.map((angle, k) => hatch(boundary, {
    angle,
    spacing,
    anchor,
    offset: set.offsets ? set.offsets[k] : k === 0 ? 0 : 0.5 * (k % 2),
    shape: size > 0 ? shape : null,
    size,
    pitch,
  }));
  return { layers, angles: set.angles };
}
