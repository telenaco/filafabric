// The plain zigzag card: no shapes to choose, no patterns, no extras. What the older Squiggle & Gyroid card does with a
// whole library of strand shapes and patterns is here reduced to a wave, a depth and a spacing.
//
// (A single layer of zigzag, sine or square rows that meet peak to peak is the Coil with a zigzag, wave or square
// shape and no row overlap: neighbouring rows run opposite ways, which turns them half a wave from each other.)
import { defineControls, r1 } from './structure-controls.js';
import { layered } from './more-designs.js';
import { waveLines } from '../engine/wavegrid.js';
import { patternField, withPicture } from '../engine/picture.js';
import { FIELD_IDS } from '../engine/fields.js';
import { thicknessAlong, THICKNESS_RANGES } from '../engine/pattern-effects.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };

export const BASIC_DESIGNS = [];

const ZIGZAG = defineControls({
  ranges: {
    ...SIZE,
    spacing: { min: 0.8, max: 10, step: 0.1 },
    depth: { min: 0.4, max: 8, step: 0.1 },
    wavelength: { min: 2, max: 20, step: 0.5 },
    patternScale: { min: 0.5, max: 2, step: 0.25 },
    ...THICKNESS_RANGES,
  },
  defaults: { width: 100, height: 100, mode: 'parallel', wavelength: 6, depth: 2, spacing: 3, colorChange: false, pattern: 'none', patternScale: 1, thin: 0.6, thick: 1.8, patternEffect: 'depth' },
  bools: ['colorChange'],
  enums: { mode: ['cross', 'parallel'], pattern: withPicture(['none', ...FIELD_IDS]) },
  describe: (s) => ({
    spacing: `${r1(s.spacing)} mm apart`,
    depth: `${r1(s.depth)} mm each way`,
    wavelength: `${r1(s.wavelength)} mm per wave`,
  }),
});

BASIC_DESIGNS.push(layered({
  id: 'zigzag',
  shelf: 'layered', family: 'waves', support: 'self', state: 'untested',
  joins: "Two zigzag layers fuse where they meet.", sources: {},
  name: 'Zigzag mesh',
  blurb: 'Two zigzag layers, side by side or crossed',
  about: 'The plain version: two layers of zigzag lines. Side by side, the second layer is the first turned half a wave, so the lines cross each other all along and open into diamonds. Crossed, one layer runs across the other. Only the wave, its depth and the line spacing to choose. The depth does not need to match the spacing, because the two layers overlap. For strand shapes, patterns and the rest, see Advanced zigzag mesh.',
  file: 'zigzag',
  c: ZIGZAG,
  patterns: withPicture(['none', ...FIELD_IDS]),
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
    { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'Choose a field for wave depth or line thickness.', picture: 'positive', pictureHint: 'Dark parts of the picture make strands deeper or thicker.', scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false } },
    COLOUR,
  ],
  patternEffects: ['depth', 'thickness'],
  defaults: () => ({ ...ZIGZAG.defaults }),
  sanitize: (raw) => {
    const out = { ...ZIGZAG.sanitize(raw), patternEffect: raw?.patternEffect === 'thickness' ? 'thickness' : 'depth', patternScale: Number.isFinite(Number(raw?.patternScale)) ? Math.max(0.5, Math.min(2, Number(raw.patternScale))) : 1 };
    for (const [key, range] of Object.entries(THICKNESS_RANGES)) {
      const value = Number(raw?.[key]);
      out[key] = Number.isFinite(value) && value >= range.min && value <= range.max ? value : ZIGZAG.defaults[key];
    }
    return out;
  },
  build: (s, boundary, { bead = 0.45, perimeters = 0, printedBoundary = false, picture = null } = {}) => {
    const pitch = bead * 0.8;
    const base = { spacing: s.spacing, amplitude: s.depth, wavelength: s.wavelength, shape: 'triangle', angle: 0, clearance: (printedBoundary && perimeters > 0 ? pitch : bead / 2) + perimeters * pitch + 1e-5 };
    const second = s.mode === 'cross' ? { ...base, angle: 90 } : { ...base, phase: 0.5 };
    const field = patternField(s.pattern, { scale: s.patternScale, picture });
    const depthAt = s.patternEffect === 'depth' ? field : null;
    const layers = [waveLines(boundary, { ...base, depthAt }), waveLines(boundary, { ...second, depthAt })];
    if (field && s.patternEffect === 'thickness') return { layers: layers.map((layer, index) => layer.map((line) => thicknessAlong(line, field, { thin: s.thin, thick: s.thick, layer: index }))) };
    return { layers };
  },
  summary: (result) => `a zigzag mesh with ${result.report.crossings} crossings`,
}));
