// The two plainest zigzag cards: no shapes to choose, no patterns, no extras. What the older Squiggle & Gyroid card does
// with a whole library of strand shapes and patterns is here reduced to a wave, a depth and a spacing.
import { defineControls, r1 } from './structure-controls.js';
import { layered } from './more-designs.js';
import { shapeThumb } from './thumbs.js';
import { waveLines, WAVE_SHAPES } from '../engine/wavegrid.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };

export const BASIC_DESIGNS = [];

/* ---------- Zigzag mesh: two layers of zigzag lines ---------- */

const ZIGZAG = defineControls({
  ranges: {
    ...SIZE,
    spacing: { min: 1, max: 10, step: 0.1 },
    depth: { min: 0.4, max: 8, step: 0.1 },
    wavelength: { min: 2, max: 20, step: 0.5 },
  },
  defaults: { width: 100, height: 100, mode: 'parallel', direction: 'horizontal', wavelength: 6, depth: 2, spacing: 3, colorChange: false },
  enums: { mode: ['cross', 'parallel'], direction: ['horizontal', 'vertical'] },
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
      kind: 'choice',
      key: 'direction',
      title: 'Lines run',
      hint: 'The way the first layer runs.',
      options: [
        { id: 'horizontal', label: 'Horizontal', hint: 'Along the width' },
        { id: 'vertical', label: 'Vertical', hint: 'Along the height' },
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
  build: (s, boundary) => {
    const base = { spacing: s.spacing, amplitude: s.depth, wavelength: s.wavelength, shape: 'triangle', angle: s.direction === 'horizontal' ? 0 : 90 };
    const second = s.mode === 'cross' ? { ...base, angle: base.angle + 90 } : { ...base, phase: 0.5 };
    return { layers: [waveLines(boundary, base), waveLines(boundary, second)] };
  },
  summary: (result) => `a zigzag mesh with ${result.report.crossings} crossings`,
}));

/* ---------- Zigzag single layer: one layer whose lines meet their neighbours ---------- */

const SINGLE = defineControls({
  ranges: {
    ...SIZE,
    spacing: { min: 1, max: 10, step: 0.1 },
    wavelength: { min: 2, max: 20, step: 0.5 },
    overlap: { min: 0, max: 100, step: 5 },
  },
  defaults: { width: 100, height: 100, shape: 'triangle', spacing: 3, wavelength: 6, overlap: 20 },
  enums: { shape: WAVE_SHAPES },
  describe: (s) => ({
    spacing: `${r1(s.spacing)} mm apart`,
    wavelength: `${r1(s.wavelength)} mm per wave`,
    overlap: s.overlap === 0 ? 'Peaks just meet' : `Cross by ${s.overlap}%`,
  }),
});

const WAVE_LABELS = { sine: 'Sine', triangle: 'Triangle', square: 'Square' };
const WAVE_HINTS = {
  sine: 'A smooth wave: soft cells',
  triangle: 'A zigzag: straight runs and sharp turns, diamond cells',
  square: 'A square wave: right-angle steps, rectangular cells',
};
const waveThumb = (id) => shapeThumb(id === 'sine' ? 'wave' : id === 'triangle' ? 'zigzag' : 'square');

BASIC_DESIGNS.push(layered({
  id: 'zigzag-single',
  name: 'Zigzag single layer',
  blurb: 'One layer: every other line half a wave along',
  about: 'A single layer of wavy lines, every other line half a wave along from the one before. Where one line swings towards its neighbour, the neighbour swings away, so the peaks meet (or cross, with more overlap) and close into cells: diamonds with a zigzag, soft cells with a sine, rectangles with a square wave. Each wave always reaches the next line, so one layer holds itself together; where lines cross, one lifts over the other by a layer.',
  file: 'zigzag-single',
  c: SINGLE,
  controls: [
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'choice',
      key: 'shape',
      title: 'Wave',
      hint: 'The shape of every line.',
      options: WAVE_SHAPES.map((id) => ({ id, label: WAVE_LABELS[id], hint: WAVE_HINTS[id], thumb: waveThumb(id) })),
    },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines.', lo: 'Dense', hi: 'Open', unit: 'mm', edit: true },
        { key: 'wavelength', label: 'Wave length', help: 'Length of one full wave.', lo: 'Tight', hi: 'Long', unit: 'mm', edit: true },
        { key: 'overlap', label: 'Reach', help: 'How far the peaks reach into the next line. Zero: they just meet. More: they cross and close into cells.', lo: 'Meet', hi: 'Cross', unit: '%', edit: true },
      ],
    },
  ],
  build: (s, boundary) => ({
    layers: [waveLines(boundary, {
      spacing: s.spacing,
      // half the spacing is where the peaks of neighbouring lines meet; more than that and they cross
      amplitude: (s.spacing / 2) * (1 + s.overlap / 100),
      wavelength: s.wavelength,
      shape: s.shape,
      laneShift: 0.5,
    })],
  }),
  summary: (result) => `a single layer of zigzag lines with ${result.report.crossings} crossings`,
}));

