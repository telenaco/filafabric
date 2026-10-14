// The layered designs of the line-algorithm library: structures made of a few layers of plotted lines, each a card.
// Every one is described by a small `layered({...})` call: its controls, and a `build(settings, boundary)` that turns
// settings into layers of polylines. The rest (the panel, the print, the verdict, the report) is shared.
import { defineControls, r1, r2 } from './structure-controls.js';
import { buildLayeredVerdict } from './verdict.js';
import { thumbFromLayers, shapeThumb } from './thumbs.js';
import { boundaryFor, layeredResult } from '../engine/layers.js';
import { SHAPES } from '../engine/shapes.js';
import { crosshatchLayers, DIRECTIONS, DIRECTION_IDS } from '../engine/crosshatch.js';
import { auxeticLayers, CELLS, CELL_IDS } from '../engine/auxetic.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const WAVY = ['looped', 'figure8', 'zigzag', 'honeycomb', 'wave', 'square'];
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };
const shapeOptions = () => WAVY.map((id) => ({ id, label: SHAPES[id].label, hint: SHAPES[id].hint, thumb: shapeThumb(id) }));

/**
 * @param def  { id, name, blurb, about, file, c (a defineControls result), controls (panel description),
 *               build(settings, boundary) → { layers, extra? }, verdict?, figure?, summary(result), thumbSize? }
 */
function layered(def) {
  const { c } = def;
  const [tw, th] = def.thumbSize ?? [36, 22];
  let thumb = '';
  try {
    const s = { ...c.defaults, width: tw, height: th };
    thumb = thumbFromLayers(def.build(s, boundaryFor(tw, th)).layers, tw, th);
  } catch { /* a tile without a picture still works */ }
  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    about: def.about,
    file: def.file,
    status: 'ready',
    thumb,
    roles: { base: 'Layer 1', anchored: 'Later layers' },
    defaults: () => ({ ...c.defaults }),
    sanitize: c.sanitize,
    ranges: c.ranges,
    presets: c.presets,
    presetMatch: c.presetMatch,
    describe: c.describe,
    size: (s) => [s.width, s.height],
    setSize: (s, w, h) => { s.width = w; s.height = h; },
    controls: def.controls,
    generate: (machine, material, s, { outline = null } = {}) => {
      const built = def.build(s, boundaryFor(s.width, s.height, outline));
      return layeredResult(machine, material, {
        width: s.width,
        height: s.height,
        layers: built.layers,
        colorChange: !!s.colorChange,
        outline,
        extra: { layerCount: built.layers.length, ...(built.extra ?? {}) },
      });
    },
    verdict: (result, s) => (def.verdict ? def.verdict(result, s) : buildLayeredVerdict(result)),
    figure: (result) => (def.figure ? def.figure(result) : { value: result.report.perCm2.toFixed(1), unit: 'per cm²', label: 'Crossings' }),
    summary: (result) => def.summary(result),
  };
}

const CROSSHATCH = defineControls({
  ranges: { ...SIZE, spacing: { min: 2, max: 8, step: 0.5 }, size: { min: 0, max: 2.5, step: 0.25 }, pitch: { min: 3, max: 10, step: 0.5 } },
  defaults: { width: 50, height: 50, directions: '0-90', spacing: 3.5, shape: 'wave', size: 0, pitch: 6, colorChange: false },
  enums: { directions: DIRECTION_IDS, shape: WAVY },
  bools: ['colorChange'],
  presets: [
    { id: 'square', name: 'Square', blurb: 'Two layers at 90°', patch: { directions: '0-90', size: 0 } },
    { id: 'diagonal', name: 'Diagonal', blurb: 'On the bias', patch: { directions: '45-135', size: 0 } },
    { id: 'isogrid', name: 'Isogrid', blurb: 'Three layers 60° apart', patch: { directions: '0-60-120', size: 0 } },
    { id: 'wavy-diagonal', name: 'Wavy diagonal', blurb: 'Lines that can stretch', patch: { directions: '45-135', shape: 'wave', size: 1.25 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart`, size: s.size === 0 ? 'Straight' : `${r2(s.size)} mm`, pitch: `${r1(s.pitch)} mm` }),
});

export const MORE_DESIGNS = [
  layered({
    id: 'crosshatch',
    name: 'Crosshatch & isogrid',
    blurb: 'Layers of lines at 60°, 90° or three ways',
    about: 'Layers of parallel lines, each layer at its own angle, so every pair of layers crosses. Square drapes like woven cloth on the bias; three directions 60° apart are close to the same in every direction. Give the lines a wave so they can stretch along their length.',
    file: 'crosshatch',
    c: CROSSHATCH,
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'choice',
        key: 'directions',
        title: 'Directions',
        hint: 'The angle of each layer. Every pair of layers crosses.',
        options: DIRECTION_IDS.map((id) => ({ id, label: DIRECTIONS[id].label, hint: DIRECTIONS[id].hint })),
      },
      { kind: 'choice', key: 'shape', title: 'Line shape', hint: 'Only used when the wave size is above zero.', options: shapeOptions() },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines in a layer.', lo: 'Dense', hi: 'Airy', unit: 'mm', edit: true },
          { key: 'size', label: 'Wave size', help: 'How far each line swings to the side. Zero is straight.', lo: 'Straight', hi: 'Deep', unit: 'mm', edit: true },
          { key: 'pitch', label: 'Wave length', help: 'Length of one full wave.', lo: 'Tight', hi: 'Long', unit: 'mm', edit: true },
        ],
      },
      COLOUR,
    ],
    build: (s, boundary) => crosshatchLayers(boundary, { directions: s.directions, spacing: s.spacing, shape: s.shape, size: s.size, pitch: s.pitch }),
    summary: (result) => `a crosshatch of ${result.layerCount} layers with ${result.report.crossings} crossings`,
  }),
];

const AUXETIC = defineControls({
  ranges: { ...SIZE, rowPitch: { min: 3, max: 10, step: 0.5 }, period: { min: 4, max: 16, step: 0.5 }, amplitude: { min: 0.5, max: 4, step: 0.25 } },
  defaults: { width: 50, height: 50, rowPitch: 6, period: 8, amplitude: 1.75, cell: 'reentrant', colorChange: false },
  enums: { cell: CELL_IDS },
  bools: ['colorChange'],
  presets: [
    { id: 'honeycomb', name: 'Honeycomb', blurb: 'Convex hexagon cells', patch: { cell: 'hexagon', amplitude: 1.5, rowPitch: 6, period: 8 } },
    { id: 're-entrant', name: 'Re-entrant', blurb: 'Bow-tie cells that widen when pulled', patch: { cell: 'reentrant', amplitude: 1.75, rowPitch: 6, period: 8 } },
    { id: 'deep-auxetic', name: 'Deep auxetic', blurb: 'Larger cells, deeper bow-ties', patch: { cell: 'reentrant', amplitude: 2.25, rowPitch: 7, period: 10 } },
  ],
  describe: (s) => ({ rowPitch: `${r1(s.rowPitch)} mm apart`, period: `${r1(s.period)} mm`, amplitude: `${r2(s.amplitude)} mm` }),
});

MORE_DESIGNS.push(layered({
  id: 'auxetic',
  name: 'Auxetic mesh',
  blurb: 'Honeycomb and re-entrant (bow-tie) cells',
  about: 'Rows of zigzag, each the mirror of the one below, and staircases that climb through them. Struts at the waists make an ordinary honeycomb; struts at the wide points make bow-tie cells that widen when pulled, so the fabric spreads under tension and hugs a curve.',
  file: 'auxetic',
  c: AUXETIC,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'choice',
      key: 'cell',
      title: 'Cell',
      hint: 'Where the struts join the rows.',
      options: CELL_IDS.map((id) => ({ id, label: CELLS[id].label, hint: CELLS[id].hint })),
    },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'rowPitch', label: 'Row spacing', help: 'Distance between the rows of zigzag, and so the height of a cell.', lo: 'Close', hi: 'Wide', unit: 'mm', edit: true },
        { key: 'period', label: 'Cell width', help: 'Length of one zigzag, and so the width of a cell.', lo: 'Narrow', hi: 'Wide', unit: 'mm', edit: true },
        { key: 'amplitude', label: 'Cell depth', help: 'How far each row swings. Deeper bow-ties are more auxetic. Limited so rows never touch.', lo: 'Shallow', hi: 'Deep', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => auxeticLayers(boundary, { rowPitch: s.rowPitch, period: s.period, amplitude: s.amplitude, cell: s.cell }),
  summary: (result) => `an auxetic mesh of ${result.report.crossings} crossings`,
}));
