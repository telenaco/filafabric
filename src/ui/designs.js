// The design registry: one entry per card in the left column. Pure data and functions (no DOM), so it is tested
// in Node and shared by the studio, the share-link sanitiser and the exporter.
//
// A module is { id, name, blurb, file, status: 'ready' | 'planned', roles, defaults(), sanitize(raw), legacy? }.
//   file      prefix of the exported G-code file name
//   roles     what each preview role is called in this design's legend (base, anchored, lifting, free)
//   legacy    the loop pile and squiggle keep their hand-written panels and their own state keys
//             (`primary`, `squiggle`); newer designs keep their state under `designs[id]`
//   planned   a placeholder tile: visible, not selectable
//
// Newer designs also describe themselves so the studio can build their panel and run them without per-design code:
//   about, ranges, size(state) / setSize(state, w, h), presets, presetMatch(state), controls (see coil below),
//   describe(state), generate(machine, material, state, { outline }), verdict(result, state),
//   figure(result) → { value, unit, label }, summary(result) → text for the preview's accessible name.
import { PRIMARY_DEFAULTS, sanitizePrimary } from './controls.js';
import { SQUIGGLE_DEFAULTS, sanitizeSquiggle } from './squiggle-controls.js';
import {
  COIL_RANGES, COIL_DEFAULTS, COIL_PRESETS, COIL_SHAPES, COIL_PATTERNS, sanitizeCoil, describeCoil, coilParams, presetMatch,
} from './coil-controls.js';
import { buildCoilVerdict } from './verdict.js';
import { generateCoil } from '../engine/coil.js';
import { loopsClose } from '../engine/shapes.js';

export const DESIGNS = [
  {
    id: 'loop-pile',
    name: 'Loop pile',
    blurb: 'Soft raised loops on an open base',
    file: 'looppile',
    status: 'ready',
    legacy: true,
    roles: { base: 'Base', anchored: 'Anchored feet', lifting: 'Rising and falling', free: 'Free-hanging' },
    defaults: () => ({ ...PRIMARY_DEFAULTS }),
    sanitize: sanitizePrimary,
  },
  {
    id: 'squiggle',
    name: 'Squiggle & Gyroid',
    blurb: 'Two wavy layers that lock together',
    file: 'squiggle',
    status: 'ready',
    legacy: true,
    roles: { base: 'Layer 1', anchored: 'Layer 2' },
    defaults: () => ({ ...SQUIGGLE_DEFAULTS }),
    sanitize: sanitizeSquiggle,
  },
  {
    id: 'coil',
    name: 'Coil',
    blurb: 'One looped strand, loops that overlap',
    about: 'Flat rows of one continuous looped strand, one layer thick. Where the strand crosses itself or the row before, it lifts over by a layer, so there is no second layer to print.',
    file: 'coil',
    status: 'ready',
    roles: { base: 'Strand', anchored: 'Crossing over' },
    defaults: () => ({ ...COIL_DEFAULTS }),
    sanitize: sanitizeCoil,
    ranges: COIL_RANGES,
    shapes: COIL_SHAPES,
    patterns: COIL_PATTERNS,
    presets: COIL_PRESETS,
    presetMatch,
    size: (c) => [c.width, c.height],
    setSize: (c, w, h) => { c.width = w; c.height = h; },
    describe: describeCoil,
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      { kind: 'shape', key: 'shape', title: 'Strand shape', hint: 'How the line wanders. Looped circles over itself.' },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'size', label: 'Loop size', help: 'How far the strand swings to each side.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
          { key: 'pitch', label: 'Loop spacing', help: 'Distance along the row for each loop. Closer than twice the loop size and neighbouring loops overlap.', lo: 'Packed', hi: 'Open', unit: 'mm', edit: true, readout: (d) => (d.overlap.startsWith('loops') ? `${d.pitch} · ${d.overlap}` : d.pitch) },
          { key: 'rowOverlap', label: 'Row overlap', help: 'How far each row reaches into the one before it.', lo: 'Apart', hi: 'Deep', unit: '%', edit: true },
          { key: 'lift', label: 'Crossing lift', help: 'How far a strand rises where it lies over another. About one layer.', lo: 'Flat', hi: 'High', unit: 'mm', edit: true },
        ],
      },
      {
        kind: 'pattern',
        key: 'pattern',
        title: 'Pattern',
        hint: 'Where the pattern is bright the loops are full size; where it is dark they shrink.',
        scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false },
      },
    ],
    generate: (machine, material, c, { outline = null } = {}) => generateCoil(machine, material, coilParams(c, { outline })),
    verdict: (result, c) => buildCoilVerdict(result.stats, { loopsClose: c.shape === 'looped' && loopsClose(c.pitch, c.size) }),
    figure: (result) => ({ value: result.stats.crossings.toLocaleString('en'), unit: '', label: 'Crossings' }),
    summary: (result) => `a coil of ${result.stats.loops} loops`,
  },
];

const BY_ID = new Map(DESIGNS.map((d) => [d.id, d]));

export const designById = (id) => BY_ID.get(id);
export const READY_IDS = Object.freeze(DESIGNS.filter((d) => d.status === 'ready').map((d) => d.id));
export const isReady = (id) => READY_IDS.includes(id);
