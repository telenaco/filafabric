// The design registry: one entry per card in the left column. Pure data and functions (no DOM), so it is tested
// in Node and shared by the studio, the share-link sanitiser and the exporter.
//
// A module is { id, name, blurb, file, status: 'ready' | 'planned', roles, defaults(), sanitize(raw), legacy? }.
//   file      prefix of the exported G-code file name
//   roles     what each preview role is called in this design's legend (base, anchored, lifting, free)
//   legacy    the loop pile and squiggle keep their hand-written panels and their own state keys
//             (`primary`, `squiggle`); newer designs keep their state under `designs[id]`
//   planned   a placeholder tile: visible, not selectable
//   preset    a tile that opens another design with some settings changed (`opens: { design, patch }`)
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
import {
  buildCoilVerdict, buildReliefVerdict, buildFringeVerdict, buildSpiralVerdict, buildBoucleVerdict, buildWeaveVerdict, buildLayeredVerdict,
} from './verdict.js';
import { generateCoil } from '../engine/coil.js';
import { loopsClose } from '../engine/shapes.js';
import { FIELD_IDS, createField } from '../engine/fields.js';
import { generateRelief } from '../engine/relief.js';
import { generateFringe } from '../engine/fringe.js';
import { generateSpiral } from '../engine/spiral.js';
import { generateWeave, WEAVE_BINDINGS, WEAVE_BINDING_IDS } from '../engine/weave.js';
import { bindingThumb } from './thumbs.js';
import { MORE_DESIGNS } from './more-designs.js';
import { LINE_DESIGNS } from './line-designs.js';
import {
  RELIEF_CONTROLS, FRINGE_CONTROLS, BOUCLE_CONTROLS, SPIRAL_CONTROLS, WEAVE_CONTROLS,
} from './structure-controls.js';

const WEAVE = WEAVE_CONTROLS(WEAVE_BINDING_IDS);
const fieldFor = (pattern, scale) => (pattern === 'none' ? null : createField(pattern, { scale }));
const sizeOf = (s) => [s.width, s.height];
const setSizeOf = (s, w, h) => { s.width = w; s.height = h; };
const SCALE_SLIDER = { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false };

/** What every newer design shares: its controls object spread in, size accessors, and the pieces the panel needs. */
const fromControls = (c) => ({
  status: 'ready',
  defaults: () => ({ ...c.defaults }),
  sanitize: c.sanitize,
  ranges: c.ranges,
  presets: c.presets,
  presetMatch: c.presetMatch,
  describe: c.describe,
  size: sizeOf,
  setSize: setSizeOf,
});

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
    id: 'zigzag-mesh',
    name: 'Zigzag mesh',
    blurb: 'Two anti-phase layers that open into diamonds',
    file: 'squiggle',
    status: 'preset',
    opens: { design: 'squiggle', patch: { shape: 'zigzag', mode: 'parallel' } },
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
  {
    ...fromControls(WEAVE),
    id: 'weave',
    name: 'Weave',
    blurb: 'Over and under, plain to satin',
    about: 'Warp and weft lines that pass over and under each other, printed in two passes by level (a nozzle cannot go under a printed strand). Experimental: it needs a lift for every piece, and the strands fuse where they cross.',
    file: 'weave',
    roles: { base: 'Lower strands', anchored: 'Upper strands' },
    presetMatch: (s) => s.binding,
    controls: [
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'choice',
        key: 'binding',
        title: 'Binding',
        hint: 'Which strand is on top at each crossing. Satin has the fewest lifts.',
        options: WEAVE_BINDING_IDS.map((id) => ({ id, label: WEAVE_BINDINGS[id].label, hint: WEAVE_BINDINGS[id].hint, thumb: bindingThumb(WEAVE_BINDINGS[id].over) })),
      },
      { kind: 'sliders', title: 'Look and feel', items: [{ key: 'pitch', label: 'Line spacing', help: 'Distance between neighbouring warp lines and between neighbouring weft lines.', lo: 'Fine', hi: 'Open', unit: 'mm', edit: true }] },
    ],
    generate: (machine, material, s, { outline = null } = {}) => generateWeave(machine, material, { ...s, outline }),
    verdict: (result) => buildWeaveVerdict(result.stats),
    figure: (result) => ({ value: result.stats.pieces.toLocaleString('en'), unit: '', label: 'Pieces' }),
    summary: (result) => `a ${result.weave.columns} by ${result.weave.rows} weave in ${result.stats.pieces} pieces`,
  },
  {
    ...fromControls(SPIRAL_CONTROLS),
    id: 'spiral',
    name: 'Spiral panel',
    blurb: 'One strand, no hops, follows an outline',
    about: 'Rings that follow the edge of the panel, nested inwards and joined by short jogs, so a panel prints as one strand with no lifts. Drop an SVG outline to follow any shape.',
    file: 'spiral',
    roles: { base: 'Ring' },
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'choice',
        key: 'second',
        title: 'Second layer',
        hint: 'Normals are lines that climb away from the edge, crossing every ring at a right angle, so the panel has crossings and holds together.',
        options: [
          { id: 'none', label: 'None', hint: 'Rings only: one strand, no lifts' },
          { id: 'normals', label: 'Normals', hint: 'Lines along the normals of the outline, crossing every ring at a right angle' },
        ],
      },
      { kind: 'sliders', title: 'Look and feel', items: [{ key: 'spacing', label: 'Ring spacing', help: 'Distance between neighbouring rings.', lo: 'Tight', hi: 'Open', unit: 'mm', edit: true }] },
      { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the rings so you can load a second filament (M600). Only with normals.' },
    ],
    generate: (machine, material, s, { outline = null } = {}) => generateSpiral(machine, material, { width: s.width, height: s.height, spacing: s.spacing, second: s.second, colorChange: s.colorChange, outline }),
    verdict: (result) => (result.layerCount > 1 ? buildLayeredVerdict(result) : buildSpiralVerdict(result.stats, result.spiral)),
    figure: (result) => ({ value: result.spiral.rings.toLocaleString('en'), unit: '', label: 'Rings' }),
    summary: (result) => `a spiral panel of ${result.spiral.rings} rings`,
  },
  {
    ...fromControls(BOUCLE_CONTROLS),
    id: 'boucle',
    name: 'Bouclé & picots',
    blurb: 'Flat rings on a line, for edges',
    about: 'Rows of line with a round ring standing on it, alternately above and below, printed as one strand. Rings that touch the next row lie over it, one layer thick.',
    file: 'boucle',
    shapes: [],
    patterns: ['none', ...FIELD_IDS],
    roles: { base: 'Line and rings', anchored: 'Crossing over' },
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'size', label: 'Ring size', help: 'Diameter of each ring.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
          { key: 'pitch', label: 'Ring spacing', help: 'Distance along the row from one ring to the next.', lo: 'Packed', hi: 'Open', unit: 'mm', edit: true },
          { key: 'rowPitch', label: 'Row spacing', help: 'Distance between the rows of line.', lo: 'Close', hi: 'Wide', unit: 'mm', edit: true },
          { key: 'lift', label: 'Crossing lift', help: 'How far a strand rises where it lies over another. About one layer.', lo: 'Flat', hi: 'High', unit: 'mm', edit: true },
        ],
      },
      { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'Where the pattern is bright the rings are full size; where it is dark they shrink.', scale: SCALE_SLIDER },
    ],
    generate: (machine, material, s, { outline = null } = {}) => generateCoil(machine, material, {
      width: s.width, height: s.height, shape: 'ring', size: s.size, pitch: s.pitch, rowPitch: s.rowPitch, rowOverlap: 0, lift: s.lift, sampler: fieldFor(s.pattern, s.patternScale), outline,
    }),
    verdict: (result) => buildBoucleVerdict(result.stats, { rings: result.coil.loops }),
    figure: (result) => ({ value: result.coil.loops.toLocaleString('en'), unit: '', label: 'Rings' }),
    summary: (result) => `a bouclé of ${result.coil.loops} rings`,
  },
  {
    ...fromControls(RELIEF_CONTROLS),
    id: 'relief',
    name: 'Relief',
    blurb: 'Bobbles, seersucker and pleats',
    about: 'Rows of one strand that rise and fall with a pattern: bobbles, puckered stripes or broad pleats. Nothing is printed on top of anything, so the fabric is one strand thick and the relief gives it body.',
    file: 'relief',
    patterns: FIELD_IDS,
    roles: { base: 'Base', anchored: 'On the bed', lifting: 'Rising and falling', free: 'Raised' },
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'relief', label: 'Relief', help: 'How far the strand rises where the pattern is brightest.', lo: 'Subtle', hi: 'Deep', unit: 'mm', edit: true },
          { key: 'rowPitch', label: 'Row spacing', help: 'Distance between neighbouring rows of strand.', lo: 'Close', hi: 'Open', unit: 'mm', edit: true },
        ],
      },
      { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'The strand rises where the pattern is bright and lies on the bed where it is dark.', scale: { ...SCALE_SLIDER, lo: 'Fine', hi: 'Broad' } },
    ],
    generate: (machine, material, s, { outline = null } = {}) => generateRelief(machine, material, {
      width: s.width, height: s.height, relief: s.relief, rowPitch: s.rowPitch, field: fieldFor(s.pattern, s.patternScale), outline,
    }),
    verdict: (result) => buildReliefVerdict(result.relief),
    figure: (result) => ({ value: result.relief.peak.toFixed(1), unit: 'mm', label: 'Peak height' }),
    summary: (result) => `a relief up to ${result.relief.peak.toFixed(1)} millimetres high`,
  },
  {
    ...fromControls(FRINGE_CONTROLS),
    id: 'fringe',
    name: 'Fringe',
    blurb: 'Hanging loops with a free end',
    about: 'A base of lines with hairs standing off them: each rises in the first half of its length and hangs free to its end. Printed from the far rows to the near rows so the nozzle never dives under a hair.',
    file: 'fringe',
    outline: false,
    roles: { base: 'Base', anchored: 'Anchored feet', lifting: 'Rising', free: 'Free end' },
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'length', label: 'Hair length', help: 'How far each hair reaches from its base line.', lo: 'Short', hi: 'Long', unit: 'mm', edit: true },
          { key: 'lift', label: 'Hair height', help: 'How high the free end stands above the base.', lo: 'Low', hi: 'High', unit: 'mm', edit: true },
          { key: 'spacing', label: 'Hair spacing', help: 'Distance between neighbouring hairs in a row.', lo: 'Packed', hi: 'Open', unit: 'mm', edit: true },
          { key: 'rowGap', label: 'Row gap', help: 'Distance between the base lines the hairs stand on.', lo: 'Close', hi: 'Wide', unit: 'mm', edit: true },
          { key: 'variation', label: 'Natural variation', help: 'Random wobble in each hair\'s length, height and drift.', lo: 'Even', hi: 'Wild', unit: '%', edit: true },
        ],
      },
    ],
    generate: (machine, material, s) => generateFringe(machine, material, s),
    verdict: (result) => buildFringeVerdict(result.stats, result.fringe),
    figure: (result) => ({ value: result.fringe.hairs.toLocaleString('en'), unit: '', label: 'Hairs' }),
    summary: (result) => `a fringe of ${result.fringe.hairs} hairs`,
  },
];

// the line-algorithm library joins the column after the original structures, then the newer line designs
DESIGNS.push(...MORE_DESIGNS, ...LINE_DESIGNS);

const BY_ID = new Map(DESIGNS.map((d) => [d.id, d]));

export const designById = (id) => BY_ID.get(id);
export const READY_IDS = Object.freeze(DESIGNS.filter((d) => d.status === 'ready').map((d) => d.id));
export const isReady = (id) => READY_IDS.includes(id);
