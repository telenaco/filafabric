// The design registry: one entry per card in the left column. Pure data and functions (no DOM), so it is tested
// in Node and shared by the studio, the share-link sanitiser and the exporter.
//
// A module is { id, name, blurb, file, status: 'ready' | 'planned', roles, defaults(), sanitize(raw), legacyPanel? }.
// Card metadata includes shelf, family, joins, support, state, sources and optional legacy migration records.
//   file      prefix of the exported G-code file name
//   roles     what each preview role is called in this design's legend (base, anchored, lifting, free)
//   legacyPanel the loop pile and squiggle keep their hand-written panels and their own state keys
//             (`primary`, `squiggle`); newer designs keep their state under `designs[id]`
//   planned   a placeholder tile: visible, not selectable
//   preset    a tile that opens another design with some settings changed (`opens: { design, patch }`)
//
// Newer designs also describe themselves so the studio can build their panel and run them without per-design code:
//   about, ranges, size(state) / setSize(state, w, h), presets, presetMatch(state), controls (see coil below),
//   describe(state), generate(machine, material, state, { outline }), verdict(result, state),
//   figure(result) → { value, unit, label }, summary(result) → text for the preview's accessible name.
import { patternField, withPicture } from '../engine/picture.js';
import { PRIMARY_DEFAULTS, sanitizePrimary } from './controls.js';
import { SQUIGGLE, SQ_PATTERNS } from './squiggle-controls.js';
import {
  COIL_RANGES, COIL_DEFAULTS, COIL_PRESETS, COIL_SHAPES, COIL_PATTERNS, sanitizeCoil, describeCoil, coilParams, presetMatch,
} from './coil-controls.js';
import {
  buildCoilVerdict, buildReliefVerdict, buildFringeVerdict, buildSpiralVerdict, buildBoucleVerdict, buildWeaveVerdict, buildLayeredVerdict, buildSquiggleVerdict,
} from './verdict.js';
import { generateCoil } from '../engine/coil.js';
import { generateSquiggle, generateSquiggleTextile, SAMPLERS } from '../engine/squiggle.js';
import { pictureDarkness } from '../engine/picture.js';
import { loopsClose } from '../engine/shapes.js';
import { FIELD_IDS, createField } from '../engine/fields.js';
import { generateRelief } from '../engine/relief.js';
import { generateFringe } from '../engine/fringe.js';
import { generateSpiral } from '../engine/spiral.js';
import { generateWeave, WEAVE_BINDINGS, WEAVE_BINDING_IDS } from '../engine/weave.js';
import { bindingThumb, thumbFromLayers } from './thumbs.js';
import { OPTION_ICONS } from './option-thumbs.js';
import { MORE_DESIGNS } from './more-designs.js';
import { LINE_DESIGNS } from './line-designs.js';
import { SVG_DESIGNS } from './svg-design.js';
import { PUBLICATION_DESIGNS } from './pub-designs.js';
import { BASIC_DESIGNS } from './basic-designs.js';
import {
  RELIEF_CONTROLS, FRINGE_CONTROLS, BOUCLE_CONTROLS, SPIRAL_CONTROLS, WEAVE_CONTROLS,
} from './structure-controls.js';

const WEAVE = WEAVE_CONTROLS(WEAVE_BINDING_IDS);
// a design's pattern as a field: a built-in one or the uploaded picture (picture.js), dark parts reading as more
const fieldFor = (s, picture, polarity = 'positive') => patternField(s.pattern, { scale: s.patternScale, picture, polarity });
const sizeOf = (s) => [s.width, s.height];
const setSizeOf = (s, w, h) => { s.width = w; s.height = h; };
const SCALE_SLIDER = { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false };

const squiggleShapeCards = [
  { id: 'squiggle', name: 'Wave net', shape: 'wave', family: 'waves', settingsKey: 'wave', joins: 'Two wavy families cross and fuse where they meet.' },
  { id: 'square-net', name: 'Square-wave net', shape: 'square', family: 'waves', settingsKey: 'square-net', joins: 'Two square-wave families cross and fuse.' },
  { id: 'honeycomb-layered', name: 'Honeycomb · layered', shape: 'honeycomb', family: 'cells', settingsKey: 'honeycomb', joins: 'Two half-hexagon families meet as cells.' },
  { id: 'figure8-net', name: 'Figure-8 net', shape: 'figure8', family: 'loops', settingsKey: 'figure8-net', joins: 'Two figure-8 families cross and fuse.' },
  { id: 'looped-net', name: 'Looped net', shape: 'looped', family: 'loops', settingsKey: 'looped-net', shelf: 'raised', support: 'built-in', joins: 'Loops circle over themselves and lift over the earlier pass.' },
  { id: 'squiggle-rings', name: 'Squiggle rings (legacy)', shape: 'ring', family: 'rings', settingsKey: 'squiggle-rings', hidden: true, joins: 'Wavy ring families cross.' },
  { id: 'squiggle-zigzag', name: 'Squiggle zigzag (legacy)', shape: 'zigzag', family: 'waves', settingsKey: 'squiggle-zigzag', hidden: true, joins: 'Two zigzag families cross and fuse.' },
];

function squiggleCard(def) {
  const c = SQUIGGLE;
  const defaults = () => ({ ...c.defaults, shape: def.shape });
  const sanitize = (raw) => ({ ...c.sanitize(raw), shape: def.shape });
  const controls = [
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'mode', title: 'Structure', options: [
      { id: 'cross', label: 'Crossed', hint: 'Two wavy layers cross and fuse at their intersections.', thumb: OPTION_ICONS['squiggle:mode'].cross },
      { id: 'parallel', label: 'Parallel', hint: 'Two wavy families lie side by side and cross at their turns.', thumb: OPTION_ICONS['squiggle:mode'].parallel },
    ] },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'spacing', label: 'Spacing', help: 'Distance between neighbouring lines.', lo: 'Close', hi: 'Open', unit: 'mm', edit: true },
      { key: 'amplitude', label: 'Amplitude', help: 'Side-to-side swing of each line.', lo: 'Shallow', hi: 'Deep', unit: 'mm', edit: true },
      { key: 'wavelength', label: 'Wavelength', help: 'Distance between successive waves.', lo: 'Short', hi: 'Long', unit: 'mm', edit: true },
    ] },
    { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' },
    { kind: 'pattern', key: 'pattern', title: 'Pattern', picture: 'positive', pictureHint: 'Dark parts of your picture make the waves deeper; lighter parts make them shallower.' },
  ];
  const generate = (machine, material, settings, { outline = null, picture = null } = {}) => {
    const image = settings.pattern === 'image' && picture?.image ? pictureDarkness(picture.image, settings.width, settings.height) : null;
    const sampler = image ?? SAMPLERS[settings.pattern] ?? SAMPLERS.centerSpot;
    return generateSquiggle(machine, material, { width: settings.width, height: settings.height, mode: settings.mode, shape: def.shape,
      spacing: settings.spacing, amplitude: settings.amplitude, wavelength: settings.wavelength, sampler,
      colorChange: settings.colorChange, outline });
  };
  const thumbSettings = { ...defaults(), width: 36, height: 22 };
  const thumbGeometry = generateSquiggleTextile({ ...thumbSettings, strandWidth: 0.4, layerHeight: 0.2 });
  const thumbLayers = [[thumbGeometry.layer1], [thumbGeometry.layer2]];
  return {
    id: def.id, name: def.name, blurb: 'A two-family textile net made from shaped strands', about: 'Two families of continuous shaped strands meet in a flat mesh. The selected card fixes the strand shape; Structure controls whether the families cross or run in parallel.', file: 'squiggle', status: 'ready',
    shelf: def.shelf ?? 'layered', family: def.family, support: def.support ?? 'self', state: 'untested', joins: def.joins, sources: {},
    settingsKey: def.settingsKey, shape: def.shape, hidden: !!def.hidden, roles: { base: 'First family', anchored: 'Second family' },
    defaults, sanitize, ranges: c.ranges, size: sizeOf, setSize: setSizeOf, controls, patterns: [...SQ_PATTERNS],
    thumb: thumbFromLayers(thumbLayers, thumbSettings.width, thumbSettings.height), generate,
    figure: () => ({ value: '2', unit: '', label: 'Layers' }),
    describe: (s) => ({ ...c.describe(s), mode: s.mode === 'cross' ? 'Crossed' : 'Parallel' }),
    verdict: (result, settings) => buildSquiggleVerdict(result.stats, { colorChange: settings.colorChange }),
    summary: () => 'a two-family shaped-strand net',
  };
}

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
    shelf: 'raised', family: 'pile', support: 'built-in', state: 'untested',
    joins: "Raised loops are anchored to an open base mesh.", sources: {},
    name: 'Loop pile',
    blurb: 'Soft raised loops on an open base',
    file: 'looppile',
    status: 'ready',
    legacyPanel: true,
    roles: { base: 'Base', anchored: 'Anchored feet', lifting: 'Rising and falling', free: 'Free-hanging' },
    defaults: () => ({ ...PRIMARY_DEFAULTS }),
    sanitize: sanitizePrimary,
  },
  squiggleCard(squiggleShapeCards[0]),
  ...squiggleShapeCards.slice(1).map(squiggleCard),
  {
    id: 'coil',
    shelf: 'flat', family: 'loops', support: 'self', state: 'untested',
    joins: "One strand in rows; each loop touches the next row.", sources: {},
    name: 'Coil',
    blurb: 'One strand in rows: loops, zigzags or waves that meet',
    about: 'Flat rows of one continuous strand, one layer thick: loops that circle over themselves, or zigzag, wave and square rows whose peaks meet the next row (neighbouring rows run opposite ways, so they sit half a wave apart). Where the strand crosses itself or the row before, it lifts over by a layer, so there is no second layer to print.',
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
        picture: 'positive',
        pictureHint: 'Dark parts of the picture get full-size loops, light parts small ones.',
        scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false },
      },
    ],
    generate: (machine, material, c, { outline = null, picture = null } = {}) => generateCoil(machine, material, coilParams(c, { outline, picture })),
    verdict: (result, c) => buildCoilVerdict(result.stats, { loopsClose: c.shape === 'looped' && loopsClose(c.pitch, c.size) }),
    figure: (result) => ({ value: result.stats.crossings.toLocaleString('en'), unit: '', label: 'Crossings' }),
    summary: (result) => `a coil of ${result.stats.loops} loops`,
  },
  {
    ...fromControls(WEAVE),
    id: 'weave',
    shelf: 'layered', family: 'woven', support: 'self', state: 'untested',
    joins: "Lower and upper pieces at two levels, joined by ramps; crossings fuse.", sources: {},
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
    shelf: 'layered', family: 'radial', support: 'built-in', state: 'untested',
    joins: "Nested rings held by a crossing carrier.", sources: {},
    name: 'Spiral panel',
    blurb: 'Nested rings held by crossing strands',
    about: 'Nested rings follow the outline. Crossed backing or normal strands hold the panel together.',
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
          { id: 'none', label: 'None', hint: 'Rings only: one strand, no lifts', thumb: OPTION_ICONS['spiral:second'].none },
          { id: 'normals', label: 'Normals', hint: 'Lines along the normals of the outline, crossing every ring at a right angle', thumb: OPTION_ICONS['spiral:second'].normals },
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
    shelf: 'layered', family: 'rings', support: 'built-in', state: 'untested',
    joins: "Rings sit on a carrier line, for edges.", sources: {},
    name: 'Bouclé & picots',
    blurb: 'Flat rings on a line, for edges',
    about: 'Rows of line with a round ring standing on it, alternately above and below, printed as one strand. Rings that touch the next row lie over it, one layer thick.',
    file: 'boucle',
    shapes: [],
    patterns: withPicture(['none', ...FIELD_IDS]),
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
      { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'Where the pattern is bright the rings are full size; where it is dark they shrink.', scale: SCALE_SLIDER, picture: 'positive', pictureHint: 'Dark parts of the picture get full-size rings, light parts small ones.' },
    ],
    generate: (machine, material, s, { outline = null, picture = null } = {}) => generateCoil(machine, material, {
      width: s.width, height: s.height, shape: 'ring', size: s.size, pitch: s.pitch, rowPitch: s.rowPitch, rowOverlap: 0, lift: s.lift, sampler: fieldFor(s, picture), outline,
    }),
    verdict: (result) => buildBoucleVerdict(result.stats, { rings: result.coil.loops }),
    figure: (result) => ({ value: result.coil.loops.toLocaleString('en'), unit: '', label: 'Rings' }),
    summary: (result) => `a bouclé of ${result.coil.loops} rings`,
  },
  {
    ...fromControls(RELIEF_CONTROLS),
    id: 'relief',
    shelf: 'raised', family: 'textures', support: 'built-in', state: 'untested',
    joins: "Rows rise and fall over a crossed base.", sources: {},
    name: 'Relief',
    blurb: 'Bobbles, seersucker and pleats',
    about: 'Rows rise and fall over crossed backing to form bobbles, puckered stripes or pleats.',
    file: 'relief',
    patterns: withPicture(FIELD_IDS),
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
      { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'The strand rises where the pattern is bright and lies on the bed where it is dark.', scale: { ...SCALE_SLIDER, lo: 'Fine', hi: 'Broad' }, picture: 'positive', pictureHint: 'The strand rises where the picture is dark and lies on the bed where it is light.' },
    ],
    generate: (machine, material, s, { outline = null, picture = null } = {}) => generateRelief(machine, material, {
      width: s.width, height: s.height, relief: s.relief, rowPitch: s.rowPitch, field: fieldFor(s, picture), outline,
    }),
    verdict: (result) => buildReliefVerdict(result.relief),
    figure: (result) => ({ value: result.relief.peak.toFixed(1), unit: 'mm', label: 'Peak height' }),
    summary: (result) => `a relief up to ${result.relief.peak.toFixed(1)} millimetres high`,
  },
  {
    ...fromControls(FRINGE_CONTROLS),
    id: 'fringe',
    shelf: 'raised', family: 'pile', support: 'built-in', state: 'untested',
    joins: "Hanging loops with free ends, anchored to base rows.", sources: {},
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

// the Drawing & infill card (svgdesign) comes first after the original structures, then the line-algorithm library and the newer line designs
DESIGNS.push(...BASIC_DESIGNS, ...SVG_DESIGNS, ...MORE_DESIGNS, ...LINE_DESIGNS, ...PUBLICATION_DESIGNS);

// These constructions use incompatible setting schemas: the layered card is a Squiggle net (mode,
// spacing, amplitude, wavelength), while the flat card is an Auxetic cell (rowPitch, period, amplitude).
// Keep their controls and stored settings separate rather than silently interpreting one schema as the other.
const flatHoneycomb = DESIGNS.find((card) => card.id === 'honeycomb-flat');
if (flatHoneycomb) flatHoneycomb.settingsKey = 'honeycomb-flat';
const starLattice = DESIGNS.find((card) => card.id === 'starlattice');
if (starLattice) {
  starLattice.joins = 'Star straps in non-crossing families meet at the tile edges.';
  starLattice.sources = { catalogue: ['S3'], papers: [30, 31] };
}

// Coil's visible cards fix the strand shape; retain the old shape picker only for saved links that used it.
const coil = DESIGNS.find((card) => card.id === 'coil');
const legacyCoil = { ...coil, controls: coil.controls, presets: COIL_PRESETS };
const coilPresets = COIL_PRESETS.filter((preset) => preset.id !== 'zigzag-cells');
coil.name = 'Looped rows';
coil.blurb = 'One continuous strand in rows of loops';
coil.about = 'Flat rows of one continuous strand: loops circle over themselves, lifting over earlier passes where they cross.';
coil.joins = 'One strand in rows of loops; each touches the next row.';
coil.presets = coilPresets;
coil.sanitize = (raw) => sanitizeCoil({ ...raw, shape: 'looped' });
coil.controls = coil.controls.filter((section) => section.kind !== 'shape');
const coilShapeCard = {
  ...legacyCoil,
  id: 'coil-shapes', name: 'Coil · legacy shapes', blurb: 'Older Coil settings with selectable strand shapes',
  settingsKey: 'coil-shapes', hidden: true,
  about: 'Compatibility card for saved Coil designs that use a strand shape other than loops.',
};
const figure8Rows = {
  ...coil,
  id: 'figure8-rows', name: 'Figure-8 rows', settingsKey: 'figure8-rows',
  joins: 'One strand in rows of figure-8s; each touches the next row.',
  blurb: 'One continuous strand in rows of figure-8s',
  about: 'Flat rows of one continuous strand formed from figure-8 loops, with each row touching the next.',
  defaults: () => ({ ...COIL_DEFAULTS, shape: 'figure8' }),
  sanitize: (raw) => sanitizeCoil({ ...raw, shape: 'figure8' }),
  presets: coilPresets.map((preset) => ({ ...preset, patch: { ...preset.patch, shape: 'figure8' } })),
};
DESIGNS.splice(DESIGNS.indexOf(coil) + 1, 0, figure8Rows, coilShapeCard);

/**
 * The essentials: the structures to start from, listed first and in this order. Every other card is a variation, an
 * experiment or a structure that needs more care.
 */
export const ESSENTIALS = Object.freeze(['zigzag', 'squiggle', 'coil', 'starlattice', 'dipweave', 'halftone', 'meander', 'turing', 'svgdesign', 'bubbles', 'voronoi']);

const BY_ID = new Map(DESIGNS.map((d) => [d.id, d]));

export const designById = (id) => BY_ID.get(id);

/**
 * The gallery: the essentials in their order, then every other card (the caller ranks those). A hidden card is in
 * neither, but still opens from a link or a saved file; it keeps its place in ESSENTIALS for when it comes back.
 */
export function galleryGroups() {
  const shown = (d) => !!d && !d.hidden;
  return {
    essentials: ESSENTIALS.map(designById).filter(shown),
    others: DESIGNS.filter((d) => !ESSENTIALS.includes(d.id) && shown(d)),
  };
}
export const READY_IDS = Object.freeze(DESIGNS.filter((d) => d.status === 'ready').map((d) => d.id));
export const isReady = (id) => READY_IDS.includes(id);

/** A base card exits a matching preset tile, preserving dimensions and unrelated custom controls. */
export function baseDesignSettings(id, settings) {
  const out = { ...settings }, defaults = designById(id)?.defaults?.();
  if (!defaults) return out;
  for (const tile of DESIGNS) {
    if (tile.status !== 'preset' || tile.opens.design !== id) continue;
    if (!Object.entries(tile.opens.patch).every(([key, value]) => settings[key] === value)) continue;
    for (const key of Object.keys(tile.opens.patch)) out[key] = defaults[key];
  }
  return out;
}
