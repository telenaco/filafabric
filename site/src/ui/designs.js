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
import { patternField, withPicture, PICTURE } from '../engine/picture.js';
import { applyBeadSizes } from './nozzle-limits.js';
import { THICKNESS_RANGES } from '../engine/pattern-effects.js';
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
import { bridgeCrossings } from '../engine/crossings.js';
import { joinedPlane } from '../engine/flat-variants.js';
import { acceptIssues } from '../engine/fabric-result.js';
import { clearanceOrder } from '../engine/order.js';
import { pictureDarkness } from '../engine/picture.js';
import { loopsClose } from '../engine/shapes.js';
import { FIELD_IDS, createField } from '../engine/fields.js';
import { generateRelief, reliefPlacements } from '../engine/relief.js';
import { hatch, boundaryFor } from '../engine/layers.js';
import { generateFringe } from '../engine/fringe.js';
import { generateSpiral } from '../engine/spiral.js';
import { generateWeave, WEAVE_BINDINGS, WEAVE_BINDING_IDS, WEAVE_DRAFT_PRESETS, draftBinding } from '../engine/weave.js';
import { bindingThumb, thumbFromLayers, rowsThumb } from './thumbs.js';
import { OPTION_ICONS } from './option-thumbs.js';
import { MORE_DESIGNS } from './more-designs.js';
import { RESEARCH_DESIGNS } from './research-designs.js';
import { RAISED_DESIGNS } from './raised-designs.js';
import { SLIDING_LOOP_DESIGNS } from './sliding-loop-designs.js';
import { RESEARCH_CELL_DESIGNS } from './research-cell-designs.js';
import { EXPERIMENTAL_DESIGNS } from './experimental-designs.js';
import { makeFlatVariants } from './flat-variants.js';
import { LAYERED_DENSITY, retuneCard } from './density.js';
import { LINE_DESIGNS } from './line-designs.js';
import { SVG_DESIGNS } from './svg-design.js';
import { PUBLICATION_DESIGNS } from './pub-designs.js';
import { BASIC_DESIGNS } from './basic-designs.js';
import {
  RELIEF_CONTROLS, FRINGE_CONTROLS, BOUCLE_CONTROLS, SPIRAL_CONTROLS, WEAVE_CONTROLS, withColour, defineControls,
} from './structure-controls.js';
import { colourMode, colourResult } from '../engine/colour-plan.js';
import { legacySupport, sanitizeSupport } from '../engine/backing.js';

const DEFAULT_DRAFT = { preset:'point-twill', ...WEAVE_DRAFT_PRESETS['point-twill'] };
const sanitizeDraft = (raw) => {
  const fallback=()=>({preset:DEFAULT_DRAFT.preset,threading:[...DEFAULT_DRAFT.threading],tieup:DEFAULT_DRAFT.tieup.map(row=>[...row]),treadling:[...DEFAULT_DRAFT.treadling]});
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fallback();
  const ints=(value,limit)=>Array.isArray(value)?value.slice(0,limit).map(n=>Number.isInteger(Number(n))?Math.max(0,Math.min(7,Number(n))):0):[];
  let tieup=Array.isArray(raw.tieup)?raw.tieup.slice(0,8).map(row=>Array.isArray(row)?row.slice(0,8).map(value=>value===true):[]):[];
  if(!tieup.length)tieup=fallback().tieup;
  const shafts=tieup.length,treadles=Math.max(1,...tieup.map(row=>row.length));
  tieup=tieup.map(row=>Array.from({length:treadles},(_,i)=>row[i]===true));
  const threading=ints(raw.threading,32).map(shaft=>Math.min(shafts-1,shaft)),treadling=ints(raw.treadling,32).map(treadle=>Math.min(treadles-1,treadle));
  return {preset:['point-twill','block','herringbone','custom'].includes(raw.preset)?raw.preset:'custom',threading:threading.length?threading:fallback().threading.map(shaft=>Math.min(shafts-1,shaft)),tieup,treadling:treadling.length?treadling:fallback().treadling.map(treadle=>Math.min(treadles-1,treadle))};
};
const WEAVE_BASE = WEAVE_CONTROLS([...WEAVE_BINDING_IDS,'draft']);
const WEAVE = { ...WEAVE_BASE, defaults:{...WEAVE_BASE.defaults,draft:sanitizeDraft(DEFAULT_DRAFT)}, sanitize(raw){return {...WEAVE_BASE.sanitize(raw),draft:sanitizeDraft(raw?.draft)};} };
// a design's pattern as a field: a built-in one or the uploaded picture (picture.js), dark parts reading as more
const fieldFor = (s, picture, polarity = 'positive') => patternField(s.pattern, { scale: s.patternScale, picture, polarity });
const sizeOf = (s) => [s.width, s.height];
const setSizeOf = (s, w, h) => { s.width = w; s.height = h; };
const SCALE_SLIDER = { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false };

// the Wave net and its bridged variant share one settings key, so both carry the bridge radius
const BRIDGE_SHARED = { defaults: { filletRadius: 1, bridgeHeight: 0.7 }, ranges: { filletRadius: { min: 0.4, max: 3, step: 0.1 }, bridgeHeight: { min: 0.3, max: 2, step: 0.1 } } };

const squiggleShapeCards = [
  { id: 'squiggle', name: 'Wave net', shape: 'wave', family: 'waves', settingsKey: 'wave', joins: 'Two wavy families cross and fuse where they meet.', shared: BRIDGE_SHARED },
  { id: 'square-net', name: 'Square-wave net', shape: 'square', family: 'waves', settingsKey: 'square-net', joins: 'Two square-wave families cross and fuse.' },
  { id: 'trapezoid-net', name: 'Trapezoid-wave net', shape: 'trapezoid', family: 'waves', settingsKey: 'trapezoid-net', joins: 'Two families with localized trapezoidal waves cross and fuse.', sources: { papers: [66] }, about: 'Straight strand sections alternate with localized trapezoidal slack waves. Inspired by Pattinson 2019; not a calibrated strain-response prediction.' },
  { id: 'honeycomb-layered', name: 'Honeycomb · layered', shape: 'honeycomb', family: 'cells', settingsKey: 'honeycomb', joins: 'Two half-hexagon families meet as cells.' },
  { id: 'figure8-net', name: 'Figure-8 net', shape: 'figure8', family: 'loops', settingsKey: 'figure8-net', joins: 'Two figure-8 families cross and fuse.' },
  { id: 'looped-net', name: 'Looped net', shape: 'looped', family: 'loops', settingsKey: 'looped-net', shelf: 'raised', support: 'built-in', joins: 'Loops circle over themselves and lift over the earlier pass.' },
  { id: 'squiggle-rings', name: 'Squiggle rings (legacy)', shape: 'ring', family: 'rings', settingsKey: 'squiggle-rings', hidden: true, joins: 'Wavy ring families cross.' },
  { id: 'squiggle-zigzag', name: 'Squiggle zigzag (legacy)', shape: 'zigzag', family: 'waves', settingsKey: 'squiggle-zigzag', hidden: true, joins: 'Two zigzag families cross and fuse.' },
  // the same strand shapes in one plane: the two families meet where they cross, and nothing is lifted over anything
  { id: 'squiggle-flat', name: 'Wave net · flat', shape: 'wave', family: 'waves', settingsKey: 'wave', shelf: 'flat', flat: true, shared: BRIDGE_SHARED, file: 'squiggle-flat', transform: () => joinedPlane,
    joins: 'Two wavy families meet in one layer, joined where they cross.', blurb: 'Two wavy families in one layer, joined where they cross',
    about: 'The same two wavy families as the Wave net, but in one print layer: where a line meets one of the other family they are joined there, and neither is lifted over the other. The layered version is on the Layered shelf.' },
  { id: 'square-net-flat', name: 'Square-wave net · flat', shape: 'square', family: 'waves', settingsKey: 'square-net', shelf: 'flat', flat: true, file: 'square-net-flat', transform: () => joinedPlane,
    joins: 'Two square-wave families meet in one layer, joined where they cross.', blurb: 'Two square-wave families in one layer, joined where they cross',
    about: 'The same two square-wave families as the Square-wave net, but in one print layer, joined where they cross. The layered version is on the Layered shelf.' },
  { id: 'figure8-net-flat', name: 'Figure-8 net · flat', shape: 'figure8', family: 'loops', settingsKey: 'figure8-net', shelf: 'flat', flat: true, file: 'figure8-net-flat', transform: () => joinedPlane,
    joins: 'Two figure-8 families meet in one layer, joined where they cross.', blurb: 'Two figure-8 families in one layer, joined where they cross',
    about: 'The same two figure-8 families as the Figure-8 net, but in one print layer: every place a line meets another, or itself, it is joined there. The layered version is on the Layered shelf.' },
  { id: 'wave-bridged', name: 'Wave net · bridged crossings', shape: 'wave', family: 'waves', settingsKey: 'wave', shelf: 'raised', joins: 'The second family rises over the first on rounded bridges at every crossing.',
    blurb: 'Rounded bridges where the waves cross', about: 'The second family rises over the first on rounded bridges. Height and rounding are independent; ramps lengthen to limit slope. A toolpath adaptation of Kim and Lee\'s CAD geometry, not their demonstrated slicing process.',
    file: 'wave-bridged', sources: { papers: [31] }, shared: BRIDGE_SHARED,
    sliders: [{ key: 'filletRadius', label: 'Bridge roundness', help: 'Rounding length, independent of height. Slope limits can make the ramp longer.', lo: 'Tight', hi: 'Round', unit: 'mm', edit: true }, { key: 'bridgeHeight', label: 'Bridge height', help: 'Crossing-height parameter, independent of rounding.', lo: 'Low', hi: 'High', unit: 'mm', edit: true }],
    describe: s => ({ filletRadius: `${s.filletRadius} mm`, bridgeHeight: `${s.bridgeHeight} mm` }),
    transform: (s) => (strands, cfg) => {
      const bridged = bridgeCrossings(strands, { filletRadius: s.filletRadius, height: s.bridgeHeight ?? null, lineThickness: cfg.t.layer_height, bead: cfg.t.extrusion_width });
      return clearanceOrder(bridged.strands, { tipRadius: cfg.t.nozzle_tip_radius, coneHalfAngle: cfg.t.nozzle_cone_half_angle, layerHeight: cfg.t.layer_height, bead: cfg.t.extrusion_width, maxSplits: 8, workBudget: 1.5e5 }).strands;
    },
    verdict: (result, settings) => { const v = buildSquiggleVerdict(result.stats, { colorChange: settings.colorChange }); v.body += ` Bridge height ${settings.bridgeHeight} mm; rounding ${settings.filletRadius} mm.`; return v; } },
  { id: 'colour-exposure', name: 'Colour exposure texture', shape: 'wave', family: 'textures', shelf: 'raised', joins: 'The upper family sits higher where the picture is light, showing more of the lower colour.',
    blurb: 'The upper colour sits higher or lower with the picture', about: 'Two coloured line families (two-colour halftone) where the upper family follows the picture in both thickness and height, so more or less of the lower colour shows through. The height range is small, 0 to 0.4 mm; calibrate the halftone first.',
    // where the picture is light the upper family stands above the lower one and touches it less: loose regions are part of the effect
    accept: (issue, result, s) => /separate fabric regions/.test(issue) && s.exposureHeight > 0,
    file: 'colour-exposure', settingsKey: 'colour-exposure', sources: { catalogue: ['N3', 'M2'], papers: [17] }, fixedEffect: 'thickness', pattern: 'centerSpot', colourMode: 'halftone2',
    shared: { defaults: { exposureHeight: 0.2 }, ranges: { exposureHeight: { min: 0, max: 0.4, step: 0.05 } } },
    slider: { key: 'exposureHeight', label: 'Exposure height', help: 'How much higher the upper family sits where the picture is lightest. Zero makes the plain two-colour halftone Wave net.', lo: 'Flat', hi: 'Raised', unit: 'mm', edit: true },
    describe: (s) => ({ exposureHeight: `${Math.round(s.exposureHeight * 100) / 100} mm` }),
    transform: (s, { sampler, width, height }) => s.exposureHeight > 0 ? (strands) => strands.map((strand) => strand.family !== 'L2' ? strand : { ...strand, pts: strand.pts.map((point) => ({ ...point, z: (point.z ?? 0) + s.exposureHeight * (1 - Math.max(0, Math.min(1, sampler(point.x, point.y, width, height)))) })) }) : undefined },
];

function squiggleCard(def) {
  const c = SQUIGGLE;
  const shared = def.shared ?? { defaults: {}, ranges: {} }, effect = def.fixedEffect ?? 'depth';
  const defaults = () => ({ ...c.defaults, shape: def.shape, patternEffect: effect, thin: 0.6, thick: 1.8, ...(def.pattern ? { pattern: def.pattern } : {}), ...(def.colourMode ? { colourMode: def.colourMode, colorChange: def.colourMode === 'halftone2' } : {}), ...shared.defaults });
  const sanitize = (raw) => {
    const out = { ...c.sanitize(raw), shape: def.shape, patternEffect: def.fixedEffect ?? (['thickness','bonding'].includes(raw?.patternEffect) ? raw.patternEffect : 'depth'), bundle:Math.max(1,Math.min(5,Math.round(Number(raw?.bundle)||1))),bundleTouch:raw?.bundleTouch!==false,bundleGap:Math.max(.1,Math.min(1,Number(raw?.bundleGap)||.3)) };
    if (def.colourMode) out.colourMode = raw?.colourMode ?? def.colourMode;
    if (def.pattern && !(raw && SQ_PATTERNS.includes(raw.pattern))) out.pattern = def.pattern;
    for (const [key, range] of Object.entries({ ...THICKNESS_RANGES, ...shared.ranges })) {
      const value = Number(raw?.[key]);
      const valid = Object.hasOwn(THICKNESS_RANGES,key) ? value > 0 : value >= range.min && value <= range.max;
      out[key] = Number.isFinite(value) && valid ? value : defaults()[key];
    }
    return out;
  };
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
      ...(def.slider ? [def.slider] : []),
      ...(def.sliders ?? []),
      {key:'bundle',label:'Strands per bundle',help:'Parallel neighbouring strands. Touching bundles fuse; gapped bundles flex separately.',lo:'Single',hi:'Five',unit:'',edit:true},
      {key:'bundleGap',label:'Gap inside bundle',help:'Separation between neighbouring strands when not bonded.',lo:'Narrow',hi:'Wide',unit:'mm',edit:true,when:s=>s.bundle>1},
    ] },
    {kind:'switch',key:'bundleTouch',label:'Bond neighbours in bundles',help:'Touching neighbours use 0.9 × bead spacing.',when:s=>s.bundle>1},
    { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' },
    { kind: 'pattern', key: 'pattern', title: 'Pattern', picture: 'positive', pictureHint: 'Dark parts of your picture make the waves deeper; lighter parts make them shallower.' },
  ];
  const generate = (machine, material, settings, { outline = null, picture = null } = {}) => {
    const image = settings.pattern === 'image' && picture?.image ? pictureDarkness(picture.image, settings.width, settings.height) : null;
    const sampler = image ?? SAMPLERS[settings.pattern] ?? patternField(settings.pattern,{scale:settings.patternScale??1,picture}) ?? SAMPLERS.centerSpot;
    return acceptIssues(generateSquiggle(machine, material, { width: settings.width, height: settings.height, mode: settings.mode, shape: def.shape,
      spacing: settings.spacing, amplitude: settings.amplitude, wavelength: settings.wavelength, sampler,
      colorChange: settings.colorChange, outline, patternEffect: settings.patternEffect, thin: settings.thin, thick: settings.thick, colourMode: settings.colourMode,
      bundle:settings.bundle??1,bundleTouch:settings.bundleTouch!==false,bundleGap:settings.bundleGap??.3,
      transform: def.transform?.(settings, { sampler, width: settings.width, height: settings.height }) }), def.accept && ((issue, found) => def.accept(issue, found, settings)));
  };
  const thumbSettings = { ...defaults(), width: 36, height: 22 };
  const thumbGeometry = generateSquiggleTextile({ ...thumbSettings, strandWidth: 0.4, layerHeight: 0.2 });
  // a flat card is one layer, so its picture is one colour; a layered one shows its two
  const thumbLayers = def.flat ? [[thumbGeometry.layer1, thumbGeometry.layer2]] : [[thumbGeometry.layer1], [thumbGeometry.layer2]];
  return {
    id: def.id, name: def.name, blurb: def.blurb ?? 'A two-family textile net made from shaped strands', about: def.about ?? 'Two families of continuous shaped strands meet in a flat mesh. The selected card fixes the strand shape; Structure controls whether the families cross or run in parallel.', file: def.file ?? 'squiggle', status: 'ready',
    shelf: def.shelf ?? 'layered', family: def.family, support: def.support ?? 'self', state: 'untested', joins: def.joins, sources: def.sources ?? {},
    settingsKey: def.settingsKey, shape: def.shape, hidden: !!def.hidden, roles: { base: 'First family', anchored: 'Second family' },
    defaults:()=>({...defaults(),bundle:1,bundleTouch:true,bundleGap:.3}), sanitize, ranges: { ...c.ranges, ...THICKNESS_RANGES, ...shared.ranges,bundle:{min:1,max:5,step:1},bundleGap:{min:.1,max:1,step:.05} }, size: sizeOf, setSize: setSizeOf, controls, patterns: [...SQ_PATTERNS], patternEffects: def.fixedEffect ? [def.fixedEffect] : ['depth', 'thickness','bonding'],
    thumb: thumbFromLayers(thumbLayers, thumbSettings.width, thumbSettings.height), generate,
    figure: () => ({ value: '2', unit: '', label: 'Layers' }),
    describe: (s) => ({ ...c.describe(s),bundle:`${s.bundle??1} strands`,bundleGap:`${s.bundleGap??.3} mm`, mode: s.mode === 'cross' ? 'Crossed' : 'Parallel', ...(def.describe ? def.describe(s) : {}) }),
    verdict: def.verdict ?? ((result, settings) => buildSquiggleVerdict(result.stats, { colorChange: settings.colorChange })),
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
    id: 'loop-pile', patternEffects: ['height'],
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
        options: [...WEAVE_BINDING_IDS.map((id) => ({ id, label: WEAVE_BINDINGS[id].label, hint: WEAVE_BINDINGS[id].hint, thumb: bindingThumb(WEAVE_BINDINGS[id].over) })),{id:'draft',label:'Your draft',hint:'Set the threading, tie-up and treadling yourself',thumb:bindingThumb(draftBinding(WEAVE_DRAFT_PRESETS['point-twill']).over)}],
      },
      { kind:'draft', title:'Your draft', when:s=>s.binding==='draft' },
      { kind: 'sliders', title: 'Look and feel', items: [{ key: 'pitch', label: 'Line spacing', help: 'Distance between neighbouring warp lines and between neighbouring weft lines.', lo: 'Fine', hi: 'Open', unit: 'mm', edit: true }] },
    ],
    generate: (machine, material, s, { outline = null } = {}) => generateWeave(machine, material, { ...s, binding:s.binding==='draft'?draftBinding(s.draft):s.binding, outline }),
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
    id: 'relief', patternEffects: ['height'],
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
DESIGNS.push(...BASIC_DESIGNS, ...SVG_DESIGNS, ...MORE_DESIGNS, ...RESEARCH_DESIGNS, ...RAISED_DESIGNS, ...LINE_DESIGNS, ...PUBLICATION_DESIGNS);

const CORRUGATION=withColour(defineControls({
  ranges:{width:{min:10,max:240,step:5},height:{min:10,max:200,step:5},rise:{min:.2,max:1.2,step:.05},wavelength:{min:4,max:30,step:.5},direction:{min:0,max:180,step:1},baseOpenness:{min:.8,max:4,step:.1}},
  defaults:{width:100,height:100,rise:.6,wavelength:10,direction:0,baseOpenness:3,colorChange:false},
  describe:s=>({rise:`${s.rise} mm`,wavelength:`${s.wavelength} mm`,direction:`${s.direction}°`,baseOpenness:`${s.baseOpenness} mm`}),
}));
DESIGNS.push({
  ...fromControls(CORRUGATION),id:'corrugation',name:'Corrugation',blurb:'Shallow ridges over a supporting net',file:'corrugation',
  shelf:'raised',family:'textures',support:'built-in',state:'untested',joins:'Smooth ridges rise over a crossed base net.',sources:{catalogue:['N2']},
  about:'A fixed sine field makes shallow, even ridges in one direction. A crossed base net supports every crest; rise is capped at 1.2 mm and the slope stays below 0.35. Geometry estimates are not physical qualification.',
  roles:{base:'Supporting net',anchored:'On the bed',lifting:'Rising and falling',free:'Raised'},
  controls:[{kind:'size',title:'Size and shape'},{kind:'sliders',title:'Look and feel',items:[{key:'rise',label:'Rise',help:'Maximum ridge height above the base.',lo:'Shallow',hi:'High',unit:'mm',edit:true},{key:'wavelength',label:'Wavelength',help:'Distance between successive ridges.',lo:'Fine',hi:'Broad',unit:'mm',edit:true},{key:'direction',label:'Direction',help:'Angle of the ridges across the swatch.',lo:'0°',hi:'180°',unit:'°',edit:true},{key:'baseOpenness',label:'Base openness',help:'The supporting crossed net stays close enough to support each crest.',lo:'Dense',hi:'Open',unit:'mm',edit:true}]},{kind:'switch',key:'colorChange',label:'Two colours'}],
  generate:(machine,material,s,{outline=null}={})=>{const angle=s.direction*Math.PI/180,field=(x,y)=>.5+.5*Math.sin(2*Math.PI*(x*Math.cos(angle)+y*Math.sin(angle))/s.wavelength);return generateRelief(machine,material,{width:s.width,height:s.height,relief:s.rise,rowPitch:s.baseOpenness,field,outline,maxSlopeDeg:Math.atan(.35)*180/Math.PI});},
  overviewLayers:(s,boundary)=>{const angle=s.direction*Math.PI/180,field=(x,y)=>.5+.5*Math.sin(2*Math.PI*(x*Math.cos(angle)+y*Math.sin(angle))/s.wavelength),relief=reliefPlacements({width:s.width,height:s.height,field,relief:s.rise,rowPitch:s.baseOpenness,boundary,maxSlopeDeg:Math.atan(.35)*180/Math.PI});return [hatch(boundary,{spacing:s.baseOpenness}),relief.placements.map(p=>p.points)];},
  verdict:r=>buildReliefVerdict(r.relief),figure:r=>({value:r.relief.peak.toFixed(1),unit:'mm',label:'Peak height'}),summary:r=>`corrugation with ridges up to ${r.relief.peak.toFixed(1)} millimetres high`,
});

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
  thumb: rowsThumb('figure8'),
  joins: 'One strand in rows of figure-8s; each touches the next row.',
  blurb: 'One continuous strand in rows of figure-8s',
  about: 'Flat rows of one continuous strand formed from figure-8 loops, with each row touching the next.',
  defaults: () => ({ ...COIL_DEFAULTS, shape: 'figure8' }),
  sanitize: (raw) => sanitizeCoil({ ...raw, shape: 'figure8' }),
  presets: coilPresets.map((preset) => ({ ...preset, patch: { ...preset.patch, shape: 'figure8' } })),
};
DESIGNS.splice(DESIGNS.indexOf(coil) + 1, 0, figure8Rows, coilShapeCard);
// cards that printed as two layers go to the Layered shelf; a truly flat card takes each one's place on the Flat shelf
DESIGNS.push(...makeFlatVariants(DESIGNS));
DESIGNS.push(...SLIDING_LOOP_DESIGNS);
DESIGNS.push(...RESEARCH_CELL_DESIGNS);
DESIGNS.push(...EXPERIMENTAL_DESIGNS);
// Tune only the finished Layered cards, after their Flat/Raised twins have been copied.
for (const card of DESIGNS) {
  const tuning = card.shelf === 'layered' && LAYERED_DENSITY[card.id];
  if (!tuning) continue;
  const group = card.variantGroup ?? card.settingsKey;
  if (group) {
    for (const twin of DESIGNS) if (card.settingsKey && twin !== card && twin.settingsKey === card.settingsKey) twin.variantGroup ??= group;
    card.variantGroup ??= group;
  }
  Object.assign(card, retuneCard(card, tuning), { settingsKey: card.id });
  if (card.id === 'chainmail') {
    const aliases = s => ({ ...s, ringSize: s.spacing * s.ratio, overlap: s.spacing * (s.ratio - 1) });
    const defaults = card.defaults, sanitize = card.sanitize;
    card.defaults = () => aliases(defaults());
    card.sanitize = raw => aliases(sanitize(raw));
  }
  if (card.def) {
    try { card.thumb = thumbFromLayers(card.def.build({ ...card.defaults(), width: 36, height: 22 }, boundaryFor(36, 22)).layers, 36, 22); } catch { /* keep the existing thumbnail */ }
  }
}
// every card has a picture: Corrugation had none
const corrugationCard = DESIGNS.find((card) => card.id === 'corrugation');
if (corrugationCard && !corrugationCard.thumb) corrugationCard.thumb = rowsThumb('wave');

/**
 * Picture detail: with your picture as the pattern, how finely the design draws it. Detail 2 halves these lengths (line
 * spacing, wave size, cell, ring or loop size, row pitch), so there are twice as many lines or cells across the picture;
 * a density grows instead. Each design names the settings that set its scale.
 */
const WAVE_SCALE = ['spacing', 'amplitude', 'wavelength'];
export const DETAIL_KEYS = Object.freeze({
  squiggle: WAVE_SCALE, 'square-net': WAVE_SCALE, 'trapezoid-net': WAVE_SCALE, 'honeycomb-layered': WAVE_SCALE, 'figure8-net': WAVE_SCALE,
  'looped-net': WAVE_SCALE, 'squiggle-flat': WAVE_SCALE, 'square-net-flat': WAVE_SCALE, 'figure8-net-flat': WAVE_SCALE, 'wave-bridged': WAVE_SCALE,
  'colour-exposure': WAVE_SCALE, zigzag: ['spacing', 'depth', 'wavelength'], 'zigzag-flat': ['spacing', 'depth', 'wavelength'],
  coil: ['size', 'pitch'], 'figure8-rows': ['size', 'pitch'], 'coil-flat': ['size', 'pitch'], 'figure8-rows-flat': ['size', 'pitch'],
  boucle: ['size', 'pitch', 'rowPitch'], 'boucle-flat': ['size', 'pitch', 'rowPitch'], relief: ['rowPitch'], crosshatch: ['spacing'],
  meander: ['cell'], 'meander-flat': ['cell'], voronoi: ['spacing'], 'voronoi-cells': ['spacing'], 'moire-net': ['pitchA'],
  'rings-flat': ['ringSize'], 'spiral-cells': ['cell'], 'star-metric': ['cell'], 'grid-lifted': ['spacing'], 'grid-sliding': ['spacing'],
  flowlines: ['spacing'], bubbles: ['size'], starlattice: ['size'], 'starlattice-flat': ['size'],
});
const DETAIL_GROWS = Object.freeze({ 'stochastic-net': ['density'] });
export const DETAIL_RANGE = Object.freeze({ min: 0.5, max: 4, step: 0.1 });
export const offersDetail = (mod) => !!(DETAIL_KEYS[mod?.id] || DETAIL_GROWS[mod?.id]);
const sanitizeDetail = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.max(DETAIL_RANGE.min, Math.min(DETAIL_RANGE.max, n)) * 10) / 10 : 1; };
/** The settings a design is built with at its picture detail: unchanged unless the pattern is your picture. */
export function atDetail(mod, s) {
  const detail = sanitizeDetail(s?.detail);
  if (s?.pattern !== PICTURE || detail === 1 || !offersDetail(mod)) return s;
  const out = { ...s };
  for (const key of DETAIL_KEYS[mod.id] ?? []) if (Number.isFinite(out[key])) out[key] = out[key] / detail;
  for (const key of DETAIL_GROWS[mod.id] ?? []) if (Number.isFinite(out[key])) out[key] = out[key] * detail;
  return out;
}

// Common colour state and panel for every card; old boolean links remain accepted.
for (const mod of DESIGNS.filter(card => card.status === 'ready')) {
  const c = withColour({ defaults: mod.defaults(), sanitize: mod.sanitize });
  mod.defaults = () => ({ ...c.defaults, layerColours: [] });
  const opening = colourMode(mod.defaults());
  mod.sanitize = opening === 'one' ? c.sanitize : (raw) => {
    const out = c.sanitize(raw);
    if (!raw || (raw.colourMode === undefined && raw.colorChange === undefined)) { out.colourMode = opening; out.colorChange = ['face', 'halftone2'].includes(opening); }
    return out;
  };
  mod.presets = mod.presets?.map(p => ({ ...p, patch: { ...p.patch, ...(typeof p.patch.colorChange === 'boolean' ? { colourMode: p.patch.colorChange ? 'face' : 'one' } : {}) } }));
  mod.colourModes = mod.patternEffects?.includes('thickness') ? ['one', 'face', 'per-layer', 'halftone2'] : ['one', 'face', 'per-layer'];
  if (mod.controls) {
    const controls = mod.controls.filter(section => !(section.kind === 'switch' && section.key === 'colorChange') && section.kind !== 'colour');
    // Size and shape is always the first section, ahead of Start from
    const sizeAt = controls.findIndex(section => section.kind === 'size');
    if (sizeAt > 0) controls.unshift(...controls.splice(sizeAt, 1));
    const supportAt = controls.findIndex(section => section.kind === 'support');
    controls.splice(supportAt < 0 ? controls.length : supportAt, 0, { kind: 'colour', title: 'Colour' });
    // an extra backing under the design, just before its colour: not under a raised design (it has its own base) nor
    // under the Zigzag mesh · flat, which is the backing itself
    if (mod.shelf !== 'raised' && mod.id !== 'zigzag-flat') controls.splice(controls.findIndex(section => section.kind === 'colour'), 0, { kind: 'backing', title: 'Extra backing' });
    mod.controls = controls;
  }
  if (mod.generate) {
    const generate = mod.generate;
    mod.generate = (machine, material, s, options) => {
      const mode = colourMode(s);
      return colourResult(generate(machine, material, { ...atDetail(mod, s), colorChange: mode === 'face' || mode === 'halftone2' }, options), s);
    };
  }
  if (offersDetail(mod)) {
    // the picture detail travels with the design's settings (links, saved files) like any of its sliders
    const sanitize = mod.sanitize, defaults = mod.defaults;
    mod.sanitize = (raw) => ({ ...sanitize(raw), detail: sanitizeDetail(raw?.detail ?? 1) });
    mod.defaults = () => ({ ...defaults(), detail: 1 });
  }
}

// Support belongs to the card; a second, global carrier must never be added to it.
for (const mod of DESIGNS.filter(card => card.status === 'ready')) {
  if (mod.support === 'built-in' && mod.controls) mod.controls.push({ kind: 'support', title: 'Support', readonly: true });
  if (mod.support !== 'auto') continue;
  const drawing = mod.id === 'svgdesign', defaults = mod.defaults, sanitize = mod.sanitize;
  const fallback = legacySupport(defaults(), drawing);
  mod.defaults = () => ({ ...defaults(), support: structuredClone(fallback) });
  mod.sanitize = raw => {
    const out = sanitize(raw);
    out.support = raw?.support ? sanitizeSupport(raw.support, legacySupport(out, drawing)) : legacySupport(out, drawing);
    if (!drawing) Object.assign(out, { backing: out.support.style, spacing: out.support.openness, angle: out.support.angle, backingDepth: out.support.depth, backingLength: out.support.wavelength, backingLayers: out.support.layers === 2 ? 'two' : 'one' });
    else {
      Object.assign(out, { backing: out.support.enabled === false ? 'none' : out.support.layers === 2 ? 'two' : 'one', backingArea: out.support.area });
      for (let k = 1; k <= 2; k++) {
        const pass = out.support.passes?.[k - 1];
        Object.assign(out, { [`backing${k}Pattern`]: pass?.pattern ?? (out.support.style === 'straight' ? 'rectilinear' : out.support.style), [`backing${k}Spacing`]: pass?.spacing ?? out.support.openness, [`backing${k}Angle`]: pass?.angle ?? out.support.angle + 90 * (k - 1) });
      }
    }
    return out;
  };
  mod.presets = mod.presets?.map(p => ({ ...p, patch: { ...p.patch, support: legacySupport({ ...defaults(), ...p.patch }, drawing) } }));
  const match = mod.presetMatch;
  if (match) mod.presetMatch = s => match(mod.sanitize(s));
  mod.controls = mod.controls.filter(section => !['backing', 'backingLayers', 'backingArea', 'backing1Pattern', 'backing2Pattern'].includes(section.key))
    .map(section => section.kind === 'sliders' ? { ...section, items: section.items.filter(item => drawing ? !item.key.startsWith('backing') : !['angle', 'spacing', 'backingDepth', 'backingLength'].includes(item.key)) } : section)
    .filter(section => section.kind !== 'sliders' || section.items.length);
  mod.controls.push({ kind: 'support', title: 'Support', optional: drawing, area: drawing, hint: 'One carrier, printed after the motif. The existing print order is preserved.' });
  mod.controls = mod.controls.map(section => section.kind === 'choice' ? { ...section, options: section.options.map(option => option.patch ? { ...option, patch: { ...option.patch, support: legacySupport({ ...defaults(), ...option.patch }, drawing) } } : option) } : section);
  const generate = mod.generate;
  mod.generate = (machine, material, s, options) => generate(machine, material, { ...s, support: s.support ? sanitizeSupport(s.support, fallback) : legacySupport({ ...defaults(), ...s }, drawing) }, options);
}

const drawingCard = DESIGNS.find(card => card.id === 'svgdesign');
drawingCard.hidden = false;
drawingCard.name = 'Your drawing';

// T1.9: keep stable setting keys; use the library's material language in slider labels/help.
for (const card of DESIGNS) {
  const waves = ['squiggle', 'square-net', 'zigzag', 'crosshatch-wavy', 'honeycomb-layered'].includes(card.id);
  card.controls = card.controls?.map(section => ({
    ...section,
    items: section.items?.map(item => {
      const labels = {
        spacing: waves ? ['Gap between strands', 'The main softness control: a wider gap gives a softer, more open net.'] : null,
        amplitude: waves ? ['Wave depth', 'How far it stretches before the strands pull straight.'] : null,
        depth: ['Wave depth', 'How far it stretches before the strands pull straight.'],
        wavelength: waves ? ['Wave length', 'With depth, how much slack each strand holds.'] : null,
        rowOverlap: ['Overlap', 'How much neighbouring rows share at each join. More overlap is stronger and stiffer; avoid point-only contact.'],
        overlap: ['Overlap', 'How much neighbours share at each join. More overlap is stronger and stiffer; avoid point-only contact.'],
        thin: ['Strand thickness · light', 'The thinnest extrusion flow. Thinner strands make a softer net.'],
        thick: ['Strand thickness · dark', 'The thickest extrusion flow. Thicker strands make a stronger, firmer net.'],
        pileHeight: ['Height', 'How high a strand rises over the layer below.'],
      };
      const copy = labels[item.key];
      return copy ? { ...item, label: copy[0], help: copy[1] } : item;
    }),
  }));
  card.controls = card.controls?.map(section => section.kind === 'choice' && section.key === 'directions'
    ? { ...section, title: 'Directions', hint: '0/90 is soft on the bias; 60° grids feel similar in every direction.' }
    : section);
}

// Sizes that count in beads follow the nozzle: their minimum is a floor for the finest nozzle (ui/nozzle-limits.js).
applyBeadSizes(DESIGNS);

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
