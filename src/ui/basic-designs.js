// The plain zigzag card: no shapes to choose, no patterns, no extras. What the older Squiggle & Gyroid card does with a
// whole library of strand shapes and patterns is here reduced to a wave, a depth and a spacing.
//
// (A single layer of zigzag, sine or square rows that meet peak to peak is the Coil with a zigzag, wave or square
// shape and no row overlap: neighbouring rows run opposite ways, which turns them half a wave from each other.)
import { defineControls, r1 } from './structure-controls.js';
import { layered } from './more-designs.js';
import { waveLines } from '../engine/wavegrid.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };

export const BASIC_DESIGNS = [];

const ZIGZAG = defineControls({
  ranges: {
    ...SIZE,
    spacing: { min: 0.8, max: 10, step: 0.1 },
    depth: { min: 0.4, max: 8, step: 0.1 },
    wavelength: { min: 2, max: 20, step: 0.5 },
  },
  defaults: { width: 100, height: 100, mode: 'parallel', wavelength: 6, depth: 2, spacing: 3, colorChange: false },
  enums: { mode: ['cross', 'parallel'] },
  bools: ['colorChange'],
  describe: (s) => ({
    spacing: `${r1(s.spacing)} mm apart`,
    depth: `${r1(s.depth)} mm each way`,
    wavelength: `${r1(s.wavelength)} mm per wave`,
  }),
});

BASIC_DESIGNS.push(layered({
  id: 'zigzag',
  name: 'Zigzag mesh',
  blurb: 'Two zigzag layers, side by side or crossed',
  about: 'The plain version: two layers of zigzag lines. Side by side, the second layer is the first turned half a wave, so the lines cross each other all along and open into diamonds. Crossed, one layer runs across the other. Only the wave, its depth and the line spacing to choose. The depth does not need to match the spacing, because the two layers overlap. For strand shapes, patterns and the rest, see Advanced zigzag mesh.',
  file: 'zigzag',
  c: ZIGZAG,
  controls: [
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'choice',
      key: 'mode',
      title: 'Layers',
      hint: 'How the two layers lie.',
      options: [
        { id: 'parallel', label: 'Side by side', hint: 'Both layers run the same way, the second half a wave along: they cross all along and open into diamonds' },
        { id: 'cross', label: 'Crossed', hint: 'The second layer runs across the first, at 90°' },
      ],
    },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines in a layer.', lo: 'Dense', hi: 'Open', unit: 'mm', edit: true },
        { key: 'depth', label: 'Wave depth', help: 'How far each line swings to either side of its centre line.', lo: 'Shallow', hi: 'Deep', unit: 'mm', edit: true },
        { key: 'wavelength', label: 'Wave length', help: 'Length of one full wave, from one peak to the next on the same side.', lo: 'Tight', hi: 'Long', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary, { bead = 0.45, perimeters = 0 } = {}) => {
    const base = { spacing: s.spacing, amplitude: s.depth, wavelength: s.wavelength, shape: 'triangle', angle: 0, clearance: bead / 2 + perimeters * bead * 0.8 + 1e-5 };
    const second = s.mode === 'cross' ? { ...base, angle: 90 } : { ...base, phase: 0.5 };
    return { layers: [waveLines(boundary, base), waveLines(boundary, second)] };
  },
  summary: (result) => `a zigzag mesh with ${result.report.crossings} crossings`,
}));
