// The layered designs of the line-algorithm library: structures made of a few layers of plotted lines, each a card.
// Every one is described by a small `layered({...})` call: its controls, and a `build(settings, boundary)` that turns
// settings into layers of polylines. The rest (the panel, the print, the verdict, the report) is shared.
import { patternField, withPicture } from '../engine/picture.js';
import { defineControls, r1, r2 } from './structure-controls.js';
import { buildLayeredVerdict } from './verdict.js';
import { thumbFromLayers, optionThumbFromLayers, shapeThumb } from './thumbs.js';
import { OPTION_ICONS } from './option-thumbs.js';
import { boundaryFor, layeredResult } from '../engine/layers.js';
import { acceptIssues } from '../engine/fabric-result.js';
import { resolveConfig } from '../engine/params.js';
import { SHAPES } from '../engine/shapes.js';
import { crosshatchLayers, DIRECTIONS, DIRECTION_IDS } from '../engine/crosshatch.js';
import { auxeticLayers, CELLS, CELL_IDS } from '../engine/auxetic.js';
import { dipweaveLayers, MIN_DIP_PITCH } from '../engine/dipweave.js';
import { webLayers } from '../engine/web.js';
import { chainmailLayers } from '../engine/chainmail.js';
import { meanderLayers, CURVES, CURVE_IDS } from '../engine/meander.js';
import { lissajousLayers } from '../engine/lissajous.js';
import { truchetLayers, truchetLegacyLayers, TILES, TILE_IDS } from '../engine/truchet.js';
import { voronoiLayers } from '../engine/voronoi.js';
import { turingLayers } from '../engine/turing.js';
import { rotatedStackLayers, STACK_TURNS } from '../engine/rotated-stack.js';
import { moireLayers } from '../engine/moire.js';
import { FIELD_IDS, createField } from '../engine/fields.js';
import { BACKING_STYLES, BACKING_LAYER_COUNTS } from '../engine/backing.js';
import { thicknessAlong, THICKNESS_RANGES } from '../engine/pattern-effects.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const WAVY = ['looped', 'figure8', 'zigzag', 'honeycomb', 'wave', 'square'];
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };
const shapeOptions = () => WAVY.map((id) => ({ id, label: SHAPES[id].label, hint: SHAPES[id].hint, thumb: shapeThumb(id) }));

/**
 * @param def  { id, name, blurb, about, file, c (a defineControls result), controls (panel description),
 *               build(settings, boundary) → { layers, extra? }, verdict?, figure?, summary(result), thumbSize? }
 */
export function layered(def) {
  const { c } = def;
  // `bundle` names a choice that does the job of a "Start from" row: each of its options also sets the sizes and
  // angles of the preset that picks it, so there is one selector instead of two that mean the same thing
  let controls = def.controls;
  if (def.bundle) {
    controls = controls.filter((x) => x.kind !== 'presets').map((x) => {
      if (x.kind !== 'choice' || x.key !== def.bundle) return x;
      return {
        ...x,
        hint: x.hint ? `${x.hint} Each also sets the sizes that suit it.` : 'Each also sets the sizes that suit it.',
        options: x.options.map((o) => {
          const preset = c.presets.find((p) => p.patch[def.bundle] === o.id);
          if (!preset) return o;
          const { [def.bundle]: chosen, ...patch } = preset.patch;
          return { ...o, patch };
        }),
      };
    });
  }
  const [tw, th] = def.thumbSize ?? [36, 22];
  // every option and every preset gets a picture: a drawn icon where the geometry cannot show the difference at the size
  // of a button (option-thumbs.js), otherwise the design itself, small, with that option or preset chosen. Those are
  // drawn the first time their section is opened (`picture`), so opening the studio costs nothing.
  const picture = (patch) => () => {
    try {
      const s = { ...c.defaults, ...patch, width: tw, height: th };
      return optionThumbFromLayers(def.build(c.sanitize ? c.sanitize(s) : s, boundaryFor(tw, th)).layers, tw, th);
    } catch { return ''; }
  };
  controls = controls.map((x) => {
    if (x.kind !== 'choice') return x;
    const icons = OPTION_ICONS[`${def.id}:${x.key}`] ?? {};
    return { ...x, options: x.options.map((o) => (o.thumb ? o : icons[o.id] ? { ...o, thumb: icons[o.id] } : { ...o, picture: picture({ ...(o.patch ?? {}), [x.key]: o.id }) })) };
  });
  let thumb = '';
  try {
    const s = { ...c.defaults, width: tw, height: th };
    thumb = thumbFromLayers(def.build(s, boundaryFor(tw, th)).layers, tw, th);
  } catch { /* a tile without a picture still works */ }
  const card = {
    shelf: def.shelf,
    family: def.family,
    joins: def.joins,
    support: def.support,
    state: def.state,
    settingsKey: def.settingsKey,
    variantGroup: def.variantGroup,
    sources: def.sources,
    patternEffects: def.patternEffects,
    colourModes: def.colourModes,
    legacy: def.legacy,
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    about: def.about,
    file: def.file,
    status: 'ready',
    thumb,
    roles: def.roles ?? { base: 'Layer 1', anchored: 'Later layers' },
    defaults: def.defaults ?? (() => ({ ...c.defaults })),
    sanitize: def.sanitize ?? c.sanitize,
    ranges: def.ranges ?? c.ranges,
    presets: c.presets,
    presetMatch: c.presetMatch,
    presetPicture: (preset) => picture(preset.patch)(),
    describe: def.describe ?? c.describe,
    size: (s) => [s.width, s.height],
    setSize: (s, w, h) => { s.width = w; s.height = h; },
    patterns: def.patterns,
    controls,
    // kept in the code and left out of the list
    hidden: !!def.hidden,
    // a design that works from the imported drawing says so, and then the studio hands it the drawing and the real size
    usesVector: !!def.usesVector,
    vectorGuides: !!def.vectorGuides,
    fullSize: !!def.fullSize,
    panel: def.panel,
    svgNote: def.svgNote,
    optimizeTravel: !!def.optimizeTravel,
    // Display-only XY geometry: no travel planning, crossing analysis, stats or G-code allocation.
    overviewLayers: (s, boundary, context) => def.build(s, boundary, context).layers,
    generate: (machine, material, s, { outline = null, vector = null, vectorSize = null, vectorOffset = [0, 0], includeLines = true, picture = null, perimeters = 0, printedBoundary = false } = {}) => {
      // a drawing's lines print as many passes as their width asks for, and a pass is as wide as this filament's bead
      // a raised card may change what this one result is printed with (a fan, a speed) without touching the profile
      const printed = def.material ? def.material(s, material) : material;
      const bead = resolveConfig(machine, printed, { sample_width: s.width, sample_height: s.height }).t.extrusion_width;
      const built = def.build(s, boundaryFor(s.width, s.height, outline), { vector, bead, vectorSize, vectorOffset, includeLines, picture, perimeters, printedBoundary, widthMaps:material.flow.width_maps??null });
      const result = layeredResult(machine, printed, {
        width: s.width,
        height: s.height,
        layers: built.layers,
        families: built.families ?? built.extra?.families,
        source: def.id,
        colorChange: !!s.colorChange,
        outline: built.outline ?? outline,
        inset: def.usesVector ? 0 : undefined,
        optimizeTravel: !!def.optimizeTravel,
        extra: { layerCount: built.layers.length, ...(built.extra ?? {}) },
        planes: !!built.extra?.planes,
        ramp: def.ramp ?? 1.6,
      });
      if (built.warnings?.length) result.warnings.push(...built.warnings);
      // what a card's transform left on its `extra` while the strands were built (counts, notes) is only known now
      for (const [key, value] of Object.entries(built.extra ?? {})) if (key !== 'transform' && result[key] === undefined) result[key] = value;
      acceptIssues(result, def.accept && ((issue, found) => def.accept(issue, found, s)));
      if (def.advise) { const advice = def.advise(result, s, printed); result.warnings.push(...advice); }
      return result;
    },
    verdict: (result, s) => (def.verdict ? def.verdict(result, s) : buildLayeredVerdict(result)),
    figure: (result) => (def.figure ? def.figure(result) : { value: result.report.perCm2.toFixed(1), unit: 'per cm²', label: 'Crossings' }),
    summary: (result) => def.summary(result),
  };
  // the description it was made from, so a variant of this card (a truly flat version, say) can be made from the same pieces
  Object.defineProperty(card, 'def', { value: def });
  return card;
}

const CROSSHATCH = defineControls({
  ranges: { ...SIZE, spacing: { min: 0.8, max: 8, step: 0.1 }, size: { min: 0, max: 2.5, step: 0.25 }, pitch: { min: 0.8, max: 10, step: 0.1 }, bundle:{min:1,max:5,step:1},bundleGap:{min:.1,max:1,step:.05},
    // read only by the raised variants of the grid (Grid · lifted crossings, Grid · sliding channels); the layered grid ignores them
    lift:{min:.4,max:2,step:.1},liftLength:{min:1,max:8,step:.5},liftFan:{min:0,max:100,step:5},spanLift:{min:.6,max:2,step:.1},channelLift:{min:1.2,max:3,step:.1},legBefore:{min:.8,max:3,step:.1},channelSpeed:{min:1.5,max:6,step:.1} },
  defaults: { width: 100, height: 100, directions: '0-90', spacing: 3.5, shape: 'wave', size: 0, pitch: 6, bundle:1,bundleTouch:true,bundleGap:.3,colorChange: false,
    liftWhere:'alternate',lift:1,liftLength:3,liftFan:60,slideMask:'b',spanLift:1,channelLift:2,legBefore:1.2,channelSpeed:3.3 },
  enums: { directions: DIRECTION_IDS, shape: WAVY, liftWhere:['all','alternate','pattern'], slideMask:['b','a','alternate','pattern'] },
  bools: ['colorChange','bundleTouch'],
    presets: [
    { id: 'square', name: 'Square', blurb: 'Two layers at 90°', patch: { directions: '0-90', size: 0 } },
    { id: 'diagonal', name: 'Diagonal', blurb: 'On the bias', patch: { directions: '45-135', size: 0 } },
    { id: 'isogrid', name: 'Isogrid', blurb: 'Three layers 60° apart', patch: { directions: '0-60-120', size: 0 } },
    { id: 'kagome', name: 'Kagome', blurb: 'Hexagons and triangles, two strands at a node', patch: { directions: 'kagome', size: 0 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart` }),
});

const BACKING_LABELS = {
  wave: { label: 'Wave', hint: 'Sine-wave lines whose depth and length you set' },
  gyroid: { label: 'Gyroid', hint: 'The wavy lines of a gyroid slice, fixed in shape' },
  straight: { label: 'Straight', hint: 'Parallel straight lines' },
};

/** The grid card's description, shared by its raised variants (Grid · lifted crossings, Grid · sliding channels). */
export const GRID_DEF = {
    id: 'crosshatch',
    shelf: 'layered', family: 'grids', support: 'self', state: 'untested',
    joins: "Straight lines in two or three directions fuse where they cross.", sources: { catalogue: ['S2'], papers: [29, 54, 9] },
    optimizeTravel: true,
    hidden: false,
    settingsKey: 'grid',
    patternEffects: ['thickness'],
    name: 'Crosshatch & isogrid',
    blurb: 'Straight lines at the angles you choose, layer on layer',
    about: 'The angle is the design here: straight layers of parallel lines, each layer at its own angle, so every pair of layers crosses. Square drapes like woven cloth on the bias; three directions 60° apart are close to the same in every direction.',
    file: 'crosshatch',
    c: CROSSHATCH,
    bundle: 'directions',
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
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines in a layer.', lo: 'Dense', hi: 'Airy', unit: 'mm', edit: true },
          { key: 'bundle', label: 'Strands per bundle', help: 'Group parallel strands; 1 preserves the original grid.', lo: 'Single', hi: 'Five', unit: '', edit: true, filenameWhen:s=>Number(s.bundle)>1 },
          { key: 'bundleGap', label: 'Gap inside bundle', help: 'Used only when bundle neighbours do not touch.', lo: 'Narrow', hi: 'Wide', unit: 'mm', edit: true, when:s=>Number(s.bundle)>1, filenameWhen:s=>Number(s.bundle)>1 },
        ],
      },
      {kind:'switch',key:'bundleTouch',when:s=>Number(s.bundle)>1,label:'Touch neighbours inside bundles',help:'When on, adjacent strands are 0.9 × bead width apart and fuse.'},
      { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'Line thickness carries the dark and light parts of the pattern.', picture: 'positive', pictureHint: 'Dark parts of the picture make the strands thicker.', scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false } },
    ],
    defaults: () => ({ ...CROSSHATCH.defaults, shape: 'looped', size: 0, pattern: 'none', patternScale: 1, patternEffect: 'thickness', thin: 0.6, thick: 1.8 }),
    sanitize: (raw) => {
      const out = { ...CROSSHATCH.sanitize(raw), shape: 'looped', size: 0,
        pattern: ['none', ...FIELD_IDS, 'image'].includes(raw?.pattern) ? raw.pattern : 'none',
        patternScale: Number.isFinite(Number(raw?.patternScale)) ? Math.max(0.5, Math.min(2, Number(raw.patternScale))) : 1,
        patternEffect: 'thickness' };
      for (const [key, range] of Object.entries(THICKNESS_RANGES)) {
        const value = Number(raw?.[key]);
        out[key] = Number.isFinite(value) && value >= range.min && value <= range.max ? value : key === 'thin' ? 0.6 : 1.8;
      }
      return out;
    },
    ranges: { ...CROSSHATCH.ranges, patternScale: { min: 0.5, max: 2, step: 0.25 }, ...THICKNESS_RANGES },
    patterns: withPicture(['none', ...FIELD_IDS]),
    build: (s, boundary, ctx) => {
      const field = patternField(s.pattern, { scale: s.patternScale, picture: ctx?.picture });
      const built = crosshatchLayers(boundary, { directions: s.directions, spacing: s.spacing, shape: s.shape, size: s.size, pitch: s.pitch,bundle:s.bundle,bundleTouch:s.bundleTouch,bundleGap:s.bundleGap,bead:ctx?.bead??.45,bundleMask:s.pattern==='none'?null:(x,y)=>field?.(x,y)<.5 });
      if (!field) return built;
      return { ...built, layers: built.layers.map((layer, index) => layer.map((line) => thicknessAlong(line, field, { thin: s.thin, thick: s.thick, layer: index, complement: s.colourMode === 'halftone2', widthMaps:ctx?.widthMaps, bead:ctx?.bead??.45 }))) };
    },
    summary: (result) => `a crosshatch of ${result.layerCount} layers with ${result.report.crossings} crossings`,
};
export const MORE_DESIGNS = [layered(GRID_DEF)];



const AUXETIC = defineControls({
  ranges: { ...SIZE, rowPitch: { min: 0.8, max: 10, step: 0.1 }, period: { min: 1.5, max: 16, step: 0.5 }, amplitude: { min: 0.5, max: 4, step: 0.25 } },
  defaults: { width: 100, height: 100, rowPitch: 6, period: 8, amplitude: 1.75, cell: 'reentrant', colorChange: false },
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
  shelf: 'flat', family: 'cells', support: 'self', state: 'untested',
  joins: "Bow-tie cells joined by struts; they widen when pulled.", sources: { catalogue: ['S4'], papers: [24, 26, 55] },
  optimizeTravel: true,
  name: 'Re-entrant mesh',
  blurb: 'Bow-tie cells that widen when pulled',
  about: 'Rows of zigzag, each the mirror of the one below, and staircases that climb through them. Struts at the waists make an ordinary honeycomb; struts at the wide points make bow-tie cells that widen when pulled, so the fabric spreads under tension and hugs a curve.',
  file: 'auxetic',
  c: AUXETIC,
  defaults: () => ({ ...AUXETIC.defaults, cell: 'reentrant' }),
  sanitize: (raw) => ({ ...AUXETIC.sanitize(raw), cell: 'reentrant' }),
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
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

const crosshatch = MORE_DESIGNS[0];
crosshatch.presets = CROSSHATCH.presets.filter((preset) => preset.id !== 'wavy-diagonal');
MORE_DESIGNS.push({
  ...crosshatch, id: 'crosshatch-wavy', name: 'Grid & isogrid · legacy waves', hidden: true, settingsKey: 'crosshatch-wavy',
  patternEffects: [],
  defaults: () => ({ ...CROSSHATCH.defaults }), sanitize: CROSSHATCH.sanitize,
  controls: [
    { kind: 'presets', title: 'Start from' }, { kind: 'size', title: 'Size and shape' },
    ...crosshatch.controls.filter((section) => section.kind === 'choice'),
    { kind: 'choice', key: 'shape', title: 'Line shape', options: shapeOptions() },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines in a layer.', lo: 'Dense', hi: 'Airy', unit: 'mm', edit: true },
      { key: 'size', label: 'Wave size', help: 'How far each line swings to the side.', lo: 'Straight', hi: 'Deep', unit: 'mm', edit: true },
      { key: 'pitch', label: 'Wave length', help: 'Length of one full wave.', lo: 'Tight', hi: 'Long', unit: 'mm', edit: true },
    ] },
  ],
});
MORE_DESIGNS.at(-1).presets = CROSSHATCH.presets;
MORE_DESIGNS.at(-1).controls = MORE_DESIGNS.at(-1).controls.filter((section) => section.kind !== 'pattern');

const honeycombFlat = layered({
  id: 'honeycomb-flat', shelf: 'flat', family: 'cells', support: 'self', state: 'untested',
  joins: 'Hexagon cells share their walls in one pass.', sources: { catalogue: ['S4'], papers: [24, 26, 55] },
  name: 'Honeycomb · flat', blurb: 'Hexagon cells share their walls in one pass',
  about: 'A single connected pass of convex hexagon cells joined by struts.', file: 'auxetic', c: AUXETIC,
  defaults: () => ({ ...AUXETIC.defaults, cell: 'hexagon' }),
  sanitize: (raw) => ({ ...AUXETIC.sanitize(raw), cell: 'hexagon' }),
  controls: [
    { kind: 'size', title: 'Size and shape' },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'rowPitch', label: 'Row spacing', help: 'Distance between cell rows.', lo: 'Close', hi: 'Wide', unit: 'mm', edit: true },
      { key: 'period', label: 'Cell width', help: 'Length of one zigzag, and so the width of a cell.', lo: 'Narrow', hi: 'Wide', unit: 'mm', edit: true },
      { key: 'amplitude', label: 'Cell depth', help: 'Depth of each hexagon cell.', lo: 'Shallow', hi: 'Deep', unit: 'mm', edit: true },
    ] },
  ],
  build: (s, boundary) => auxeticLayers(boundary, { rowPitch: s.rowPitch, period: s.period, amplitude: s.amplitude, cell: 'hexagon' }),
  summary: (result) => `a flat honeycomb of ${result.report.crossings} crossings`,
});
honeycombFlat.settingsKey = 'honeycomb';
MORE_DESIGNS.push(honeycombFlat);

const DIPWEAVE = defineControls({
  ranges: { ...SIZE, warpPitch: { min: 0.8, max: 8, step: 0.1 }, weftPitch: { min: 0.8, max: 8, step: 0.1 } },
  defaults: { width: 100, height: 100, warpPitch: 3.5, weftPitch: 3.5 },
  presets: [
    { id: 'fine', name: 'Fine', blurb: 'Close lines, many crossings', patch: { warpPitch: 3, weftPitch: 3 } },
    { id: 'open', name: 'Open', blurb: 'Airy mesh', patch: { warpPitch: 5, weftPitch: 5 } },
    { id: 'ribbed', name: 'Ribbed', blurb: 'Close warp, wide weft', patch: { warpPitch: 2.5, weftPitch: 6 } },
  ],
  describe: (s) => ({ warpPitch: `${r1(s.warpPitch)} mm apart`, weftPitch: `${r1(s.weftPitch)} mm apart` }),
});

MORE_DESIGNS.push(layered({
  id: 'dipweave',
  shelf: 'raised', family: 'woven', support: 'self', state: 'untested',
  joins: "Wefts rise over the warps and dip between them.", sources: {},
  optimizeTravel: true,
  name: 'Dip weave',
  blurb: 'A straight warp with a weft that dips between: over and under in one layer',
  about: 'The over-and-under is the design here, in a single layer: warp lines straight on the bed and weft lines printed after them that ride over each warp and dip back to the bed between, so the fabric is one layer thick except at the crossings. Nothing is printed in mid-air, but the nozzle tip needs room to drop between warps.',
  file: 'dipweave',
  ramp: 0.8, // a short ramp, so the weft really is back on the bed between warps
  c: DIPWEAVE,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'warpPitch', label: 'Warp spacing', help: 'Distance between the lines that run up the fabric.', lo: 'Close', hi: 'Open', unit: 'mm', edit: true },
        { key: 'weftPitch', label: 'Weft spacing', help: 'Distance between the lines that run across and ride over the warp.', lo: 'Close', hi: 'Open', unit: 'mm', edit: true },
      ],
    },
  ],
  build: (s, boundary) => dipweaveLayers(boundary, { warpPitch: s.warpPitch, weftPitch: s.weftPitch }),
  verdict: (result, s) => {
    if (Math.min(s.warpPitch, s.weftPitch) < MIN_DIP_PITCH) {
      return {
        level: 'heads-up',
        title: 'Tight for the nozzle',
        body: `The nozzle tip needs about ${MIN_DIP_PITCH} mm between lines to drop to the bed between two warps. At this spacing the weft will be laid on top of the warp instead of dipping, and the fabric gets thicker.`,
        action: null, actionLabel: '', share: 0,
      };
    }
    return buildLayeredVerdict(result);
  },
  summary: (result) => `a dip weave of ${result.report.crossings} crossings`,
}));

const auxetic = MORE_DESIGNS.find((card) => card.id === 'auxetic');
auxetic.presets = AUXETIC.presets.filter((preset) => preset.id !== 'honeycomb');
auxetic.presetMatch = (s) => AUXETIC.presets.filter((preset) => preset.id !== 'honeycomb').find((preset) => Object.entries(preset.patch).every(([key, value]) => s[key] === value))?.id ?? null;

const WEB = defineControls({
  ranges: { ...SIZE, spacing: { min: 0.8, max: 8, step: 0.1 }, spokes: { min: 8, max: 48, step: 4 }, hub: { min: 0, max: 10, step: 0.1 }, tooth: { min: 0, max: 2, step: 0.25 } },
  defaults: { width: 100, height: 100, spacing: 4, spokes: 24, hub: 0.6, hubStyle: 'solid', tooth: 0, colorChange: false },
  enums: { hubStyle: ['solid', 'open'] },
  bools: ['colorChange'],
  presets: [
    { id: 'spiderweb', name: 'Spiderweb', blurb: 'Smooth turns, many spokes', patch: { spacing: 4, spokes: 24, tooth: 0 } },
    { id: 'toothed', name: 'Toothed', blurb: 'A sawtooth that locks to the spokes', patch: { spacing: 5, spokes: 20, tooth: 1 } },
    { id: 'wide', name: 'Wide net', blurb: 'Few spokes, open turns', patch: { spacing: 7, spokes: 12, tooth: 0 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm per turn`, spokes: `${s.spokes} spokes`, hub: `${r1(s.hub)} mm`, tooth: s.tooth === 0 ? 'Smooth' : `${r2(s.tooth)} mm` }),
});

MORE_DESIGNS.push(layered({
  id: 'web',
  shelf: 'layered', family: 'radial', support: 'self', state: 'untested',
  joins: "A spiral crossed by a radial zigzag.", sources: {},
  optimizeTravel: true,
  name: 'Spiderweb',
  blurb: 'A spiral crossed by a radial zigzag',
  about: 'One continuous spiral from the middle outwards, crossed by a zigzag that goes out along one spoke and back along the next. Every spoke crosses every turn at about a right angle, so the layers hold each other: soft along the radius, firm around.',
  file: 'web',
  c: WEB,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'hubStyle', title: 'Centre', options: [{ id: 'solid', label: 'Solid', hint: 'A small filled centre that holds the spokes' }, { id: 'open', label: 'Open', hint: 'Leave the centre open' }] },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Turn spacing', help: 'How far the spiral moves outwards each turn.', lo: 'Tight', hi: 'Open', unit: 'mm', edit: true },
        { key: 'spokes', label: 'Spokes', help: 'How many times the zigzag crosses a turn.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'hub', label: 'Centre radius', help: '0.4–1 mm gives a centre 0.8–2 mm across. Solid fills it; Open leaves a hole.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
        { key: 'tooth', label: 'Sawtooth', help: 'A small in-and-out wobble of each turn, lined up with the spokes.', lo: 'Smooth', hi: 'Toothed', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary, { bead } = {}) => webLayers(boundary, { spacing: s.spacing, spokes: s.spokes, hub: s.hub, hubStyle: s.hubStyle, tooth: s.tooth, strandWidth: bead }),
  summary: (result) => `a spiderweb of ${result.report.crossings} crossings`,
}));

const CHAINMAIL = defineControls({
  ranges: { ...SIZE, spacing: { min: 0.8, max: 10, step: 0.1 }, ratio: { min: 1.1, max: 1.8, step: 0.1 }, ringSize: { min: 3, max: 20, step: 0.5 }, overlap: { min: .45, max: 3, step: .05 } },
  defaults: { width: 100, height: 100, spacing: 6, ratio: 1.5, ringSize: 9, overlap: 3, lattice: 'hex', colorChange: false },
  enums: { lattice: ['hex', 'square'] },
  bools: ['colorChange'],
  presets: [
    { id: 'mail', name: 'Mail', blurb: 'Rings overlapping like chainmail', patch: { spacing: 6, ratio: 1.5, ringSize: 9, overlap: 3, lattice: 'hex' } },
    { id: 'fine', name: 'Fine mail', blurb: 'Small rings, close together', patch: { spacing: 4, ratio: 1.5, ringSize: 6, overlap: 2, lattice: 'hex' } },
    { id: 'loose', name: 'Loose rings', blurb: 'Barely overlapping, soft', patch: { spacing: 7, ratio: 1.2, ringSize: 8.4, overlap: 1.4, lattice: 'hex' } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart`, ratio: `${Math.round((s.ratio - 1) * 100)}% overlap` }),
});

MORE_DESIGNS.push(layered({
  id: 'chainmail',
  shelf: 'layered', family: 'rings', support: 'self', state: 'untested',
  variantGroup: 'rings',
  joins: "Rings on two layers overlap and fuse.", sources: {},
  optimizeTravel: true,
  name: 'Ring mail',
  blurb: 'Overlapping rings, two layers, a chainmail look',
  about: 'Overlapping rings on a hexagonal lattice, with a second layer of rings shifted into the triangular gaps. Each ring of the second layer crosses three rings of the first twice, so the layers hold each other with no straight run of strand: near the same in every direction, with good drape.',
  file: 'chainmail',
  c: CHAINMAIL,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Ring spacing', help: 'Distance between the centres of neighbouring rings.', lo: 'Fine', hi: 'Coarse', unit: 'mm', edit: true },
        { key: 'ratio', label: 'Ring overlap', help: 'How far each ring reaches into its neighbours. Rings of 130% to 170% read as chainmail.', lo: 'Touching', hi: 'Deep', unit: '', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => chainmailLayers(boundary, { spacing: s.spacing, ratio: s.ratio }),
  summary: (result) => `a ring mail of ${result.report.crossings} crossings`,
}));

const MEANDER = defineControls({
  ranges: { ...SIZE, cell: { min: 0.8, max: 14, step: 0.1 }, angle: { min: 15, max: 75, step: 5 }, spacing: { min: 0.8, max: 10, step: 0.1 }, seed: { min: 1, max: 999, step: 1 }, patternScale: { min: 0.5, max: 2, step: 0.25 }, backingDepth: { min: 0.2, max: 10, step: 0.1 }, backingLength: { min: 3, max: 40, step: 0.5 } },
  defaults: { width: 100, height: 100, curve: 'hilbert', cell: 6, backing: 'wave', backingDepth: 2, backingLength: 10, backingLayers: 'one', angle: 45, spacing: 5, seed: 1, pattern: 'none', patternScale: 1, colorChange: false },
  enums: { curve: CURVE_IDS, backing: BACKING_STYLES, backingLayers: BACKING_LAYER_COUNTS, pattern: withPicture(['none', ...FIELD_IDS]) },
  bools: ['colorChange'],
  presets: [
    { id: 'hilbert', name: 'Hilbert lace', blurb: 'Tight folds, hatched across', patch: { curve: 'hilbert', cell: 6, angle: 45, spacing: 5 } },
    { id: 'peano', name: 'Peano', blurb: 'Long serpentine folds', patch: { curve: 'peano', cell: 6, angle: 45, spacing: 5 } },
    { id: 'maze', name: 'Maze', blurb: 'A random walk round a maze', patch: { curve: 'maze', cell: 6, angle: 45, spacing: 5 } },
    { id: 'stipple', name: 'Stipple tour', blurb: 'One loop through graded dots', patch: { curve: 'tsp', cell: 6, angle: 45, spacing: 5, pattern: 'noise' } },
    { id: 'moore', name: 'Moore loop', blurb: 'A closed Hilbert loop', patch: { curve: 'moore', cell: 5, angle: 45, spacing: 5 } },
    { id: 'sierpinski', name: 'Sierpiński lace', blurb: 'Round holes in a diagonal lattice', patch: { curve: 'sierpinski', cell: 4, angle: 30, spacing: 5 } },
    { id: 'flowsnake', name: 'Flowsnake', blurb: 'Gosper folds, like fish scales', patch: { curve: 'gosper', cell: 3.5, angle: 60, spacing: 5 } },
    { id: 'open', name: 'Open meander', blurb: 'Large cells, wide hatch', patch: { curve: 'hilbert', cell: 10, angle: 60, spacing: 8 } },
  ],
  describe: (s) => ({ cell: `${r1(s.cell)} mm cells`, angle: `${s.angle}°`, spacing: `${r1(s.spacing)} mm apart`, seed: `#${s.seed}`, backingDepth: `${r1(s.backingDepth)} mm each way`, backingLength: `${r1(s.backingLength)} mm per wave` }),
});

const MEANDER_CARD = {
  id: 'meander', patternEffects: ['size'],
  shelf: 'layered', family: 'motif', support: 'auto', state: 'untested',
  joins: "A space-filling curve held by a backing.", sources: {},
  optimizeTravel: true,
  name: 'Meander',
  blurb: 'A space-filling curve held by a wavy backing',
  about: 'One continuous strand that folds across the fabric and never crosses itself, held by a backing laid over it at an angle, by default the wavy lines of a gyroid, which cross every fold at a different angle and can give along their length (or straight lines, if you prefer): a Hilbert, Moore, Peano, Sierpiński or Gosper curve, a random maze, or one loop through scattered dots (denser where a pattern is bright). The folds give hidden slack, so it stretches by unfolding and reads as lace.',
  file: 'meander',
  c: MEANDER,
  bundle: 'curve',
  patterns: withPicture(['none', ...FIELD_IDS]),
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'choice',
      key: 'curve',
      title: 'Curve',
      hint: 'The fold of the first layer.',
      options: CURVE_IDS.map((id) => ({ id, label: CURVES[id].label, hint: CURVES[id].hint })),
    },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'cell', label: 'Fold size', help: 'About how wide each fold of the curve is.', lo: 'Fine', hi: 'Coarse', unit: 'mm', edit: true },
        { key: 'angle', label: 'Backing angle', help: 'The angle of the lines laid across the curve.', lo: 'Shallow', hi: 'Steep', unit: '°', edit: true },
        { key: 'spacing', label: 'Backing spacing', help: 'Distance between the backing lines, as if they were straight and parallel.', lo: 'Dense', hi: 'Open', unit: 'mm', edit: true },
        { key: 'seed', label: 'Pattern number', help: 'Used by the maze and stipple curves: each number is different, and the same number repeats it.', lo: '1', hi: '999', unit: '', edit: true },
      ],
    },
    { kind: 'choice', key: 'backing', title: 'Backing', hint: 'The lines laid across the curve.', options: BACKING_STYLES.map((id) => ({ id, label: BACKING_LABELS[id].label, hint: BACKING_LABELS[id].hint })) },
    { kind: 'sliders', title: 'Backing wave', when: (s) => s.backing === 'wave', items: [
      { key: 'backingDepth', label: 'Wave depth', help: 'How far the backing lines swing to either side of their centre line.', lo: 'Shallow', hi: 'Deep', unit: 'mm', edit: true },
      { key: 'backingLength', label: 'Wave length', help: 'Length of one full wave of the backing.', lo: 'Tight', hi: 'Long', unit: 'mm', edit: true },
    ] },
    { kind: 'choice', key: 'backingLayers', title: 'Backing layers', hint: 'One backing makes two layers with the first; a second backing, turned across the first, is a third.', options: [
      { id: 'one', label: 'One', hint: 'The first layer and one backing: two layers' },
      { id: 'two', label: 'Two', hint: 'A third layer: a second backing turned across the first' },
    ] },
    { kind: 'pattern', key: 'pattern', title: 'Grade the dots', hint: 'Only the stipple tour uses it: dots are denser where the pattern is bright.', scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false }, picture: 'positive', pictureHint: 'With the stipple tour, the dots are denser where the picture is dark.' },
    COLOUR,
  ],
  build: (s, boundary, ctx) => meanderLayers(boundary, { ...s, bead:ctx?.bead??.45, tone: patternField(s.pattern, { scale: s.patternScale, picture: ctx?.picture }) }),
  summary: (result) => `a meander of ${result.report.crossings} crossings`,
};
MORE_DESIGNS.push(layered(MEANDER_CARD),layered({...MEANDER_CARD,id:'meander-legacy',name:'Meander (legacy)',file:'meander-legacy',hidden:true,build:(s,b,ctx)=>meanderLayers(b,{...s,legacy:true,tone:patternField(s.pattern,{scale:s.patternScale,picture:ctx?.picture})})}));

const HARMONOGRAPH = defineControls({
  ranges: { ...SIZE, a: { min: 2, max: 14, step: 1 }, b: { min: 2, max: 14, step: 1 }, phase: { min: 0, max: 90, step: 5 } },
  defaults: { width: 100, height: 100, a: 7, b: 6, phase: 30, second: true, colorChange: false },
  bools: ['second', 'colorChange'],
  presets: [
    { id: 'fine', name: 'Fine lattice', blurb: 'Seven by six, diamond cells', patch: { a: 7, b: 6, phase: 30 } },
    { id: 'coarse', name: 'Coarse lattice', blurb: 'Four by three, large diamonds', patch: { a: 4, b: 3, phase: 30 } },
    { id: 'lens', name: 'Lens', blurb: 'Three by two, one closed curve', patch: { a: 3, b: 2, phase: 45 } },
  ],
  describe: (s) => ({ a: `${s.a} across`, b: `${s.b} up`, phase: `${s.phase}°` }),
});

MORE_DESIGNS.push(layered({
  id: 'harmonograph',
  shelf: 'flat', family: 'curves', support: 'self', state: 'untested',
  joins: "One closed curve crosses itself in diamonds.", sources: {},
  optimizeTravel: true,
  name: 'Harmonograph',
  blurb: 'One closed curve that crosses itself in diamonds',
  about: 'A Lissajous curve: one closed strand that sweeps across the fabric and back, crossing itself in a diamond lattice with a dense band along the edge, a natural hem. A second curve with its phase turned crosses the first everywhere. It fills the whole swatch; an outline clips it rather than being followed.',
  file: 'harmonograph',
  c: HARMONOGRAPH,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'second', title: 'Structure', options: [
      { id: 'one', value: false, label: 'One curve', hint: 'One closed curve crosses itself in diamonds.' },
      { id: 'two', value: true, label: 'Two curves', hint: 'A second curve with its phase turned crosses the first everywhere.' },
    ] },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'a', label: 'Lobes across', help: 'How many times the curve swings across. Coprime pairs (7 and 6) make one unbroken curve.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'b', label: 'Lobes up', help: 'How many times the curve swings up the fabric.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'phase', label: 'Phase', help: 'Turns the curve: zero is a straight diagonal at the extreme, larger fills the diamond.', lo: 'Squeezed', hi: 'Open', unit: '°', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => lissajousLayers(boundary, { a: s.a, b: s.b, phase: s.phase, second: s.second }),
  summary: (result) => `a harmonograph of ${result.report.crossings} crossings`,
}));

const TRUCHET = defineControls({
  ranges: { ...SIZE, size: { min: 0.8, max: 12, step: 0.1 }, seed: { min: 1, max: 999, step: 1 } },
  defaults: { width: 100, height: 100, tile: 'arcs', size: 5, seed: 7, colorChange: false },
  enums: { tile: TILE_IDS },
  bools: ['colorChange'],
  presets: [
    { id: 'arcs', name: 'Arcs', blurb: 'Flowing curves', patch: { tile: 'arcs', size: 5 } },
    { id: 'diagonals', name: 'Diagonals', blurb: 'An X in every cell', patch: { tile: 'diagonals', size: 5 } },
    { id: 'big-arcs', name: 'Big arcs', blurb: 'Large, soft curves', patch: { tile: 'arcs', size: 8 } },
  ],
  describe: (s) => ({ size: `${r1(s.size)} mm tiles`, seed: `#${s.seed}` }),
});

const TRUCHET_CARD = {
  id: 'truchet',
  shelf: 'layered', family: 'tiles', support: 'self', state: 'needs-repair',
  joins: "Tile curves meet at tile edges; a shifted second layer crosses them.", sources: {},
  optimizeTravel: true,
  name: 'Truchet tiles',
  blurb: 'Random tiles that flow into curves',
  about: 'A grid where every cell holds one of two orientations of a simple tile, picked at random. Diagonals give an X in every cell; arcs flow into long curves, with the second layer a half tile over so it crosses the first. The same seed always makes the same pattern, so a swatch can be made again.',
  file: 'truchet',
  c: TRUCHET,
  bundle: 'tile',
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'choice',
      key: 'tile',
      title: 'Tile',
      hint: 'What each cell holds.',
      options: TILE_IDS.map((id) => ({ id, label: TILES[id].label, hint: TILES[id].hint })),
    },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'size', label: 'Tile size', help: 'Width of one cell.', lo: 'Fine', hi: 'Coarse', unit: 'mm', edit: true },
        { key: 'seed', label: 'Pattern number', help: 'Each number is a different random pattern; the same number always repeats it.', lo: '1', hi: '999', unit: '', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary, ctx) => truchetLayers(boundary, { tile: s.tile, size: s.size, seed: s.seed, bead:ctx?.bead??.45 }),
  summary: (result) => `a Truchet pattern of ${result.report.crossings} crossings`,
};
MORE_DESIGNS.push(layered(TRUCHET_CARD),layered({...TRUCHET_CARD,id:'truchet-legacy',name:'Truchet tiles (legacy)',file:'truchet-legacy',hidden:true,build:(s,b)=>truchetLegacyLayers(b,s)}));

export const VORONOI = defineControls({
  ranges: { ...SIZE, spacing: { min: 0.8, max: 14, step: 0.1 }, relax: { min: 0, max: 8, step: 1 }, seed: { min: 1, max: 999, step: 1 }, patternScale: { min: 0.5, max: 2, step: 0.25 } },
  defaults: { width: 100, height: 100, spacing: 8, relax: 5, seed: 11, pattern: 'none', patternScale: 1, border: true, colorChange: false },
  enums: { pattern: withPicture(['none', ...FIELD_IDS]) },
  bools: ['colorChange','border'],
  presets: [
    { id: 'lace', name: 'Lace', blurb: 'Even, round cells', patch: { spacing: 8, relax: 5, pattern: 'none' } },
    { id: 'scatter', name: 'Scatter', blurb: 'Random cells, no relaxing', patch: { spacing: 8, relax: 0, pattern: 'none' } },
    { id: 'graded', name: 'Graded', blurb: 'Smaller cells where a pattern is bright', patch: { spacing: 8, relax: 5, pattern: 'noise' } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm cells`, relax: s.relax === 0 ? 'Random' : `${s.relax} passes`, seed: `#${s.seed}`, patternScale: `${r2(s.patternScale)}×` }),
});

MORE_DESIGNS.push(layered({
  id: 'voronoi', patternEffects: ['size'],
  shelf: 'layered', family: 'cells', support: 'self', state: 'untested',
  settingsKey: 'voronoi',
  joins: "Triangle edges print first, then the cells over them.", sources: {},
  optimizeTravel: true,
  name: 'Voronoi lace',
  blurb: 'Even cells with their triangulation across',
  about: 'A relaxed Voronoi tessellation of round, even cells, with its Delaunay triangulation as the second layer. Every cell wall is the perpendicular bisector of a triangle edge, so the layers cross at about a right angle: lace-like, close to the same in every direction, and it can be graded with a pattern so the cells are smaller where it is bright.',
  file: 'voronoi',
  c: VORONOI,
  patterns: withPicture(['none', ...FIELD_IDS]),
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Cell size', help: 'About how far apart neighbouring cell centres are.', lo: 'Fine', hi: 'Coarse', unit: 'mm', edit: true },
        { key: 'relax', label: 'Evenness', help: 'How many times the cells are nudged towards a regular lace. Zero is a random scatter.', lo: 'Random', hi: 'Even', unit: '', edit: true },
        { key: 'seed', label: 'Pattern number', help: 'Each number is a different arrangement; the same number always repeats it.', lo: '1', hi: '999', unit: '', edit: true },
      ],
    },
    { kind: 'pattern', key: 'pattern', title: 'Grade with a pattern', hint: 'Cells are smaller where the pattern is bright and larger where it is dark.', scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false }, picture: 'positive', pictureHint: 'Cells are smaller and denser where the picture is dark, larger where it is light.' },
    COLOUR,
  ],
  build: (s, boundary, ctx) => voronoiLayers(boundary, { spacing: s.spacing, relax: s.relax, seed: s.seed, tone: patternField(s.pattern, { scale: s.patternScale, picture: ctx?.picture }) }),
  summary: (result) => `a Voronoi lace of ${result.sites} cells and ${result.report.crossings} crossings`,
}));

const TURING = defineControls({
  ranges: { ...SIZE, wavelength: { min: 4, max: 14, step: 0.5 }, seed: { min: 1, max: 999, step: 1 }, angle: { min: 15, max: 75, step: 5 }, spacing: { min: 0.8, max: 10, step: 0.1 }, backingDepth: { min: 0.2, max: 10, step: 0.1 }, backingLength: { min: 3, max: 40, step: 0.5 } },
  defaults: { width: 100, height: 100, wavelength: 7, seed: 5, backing: 'wave', backingDepth: 2, backingLength: 10, backingLayers: 'one', angle: 45, spacing: 5, colorChange: false },
  enums: { backing: BACKING_STYLES, backingLayers: BACKING_LAYER_COUNTS },
  bools: ['colorChange'],
  presets: [
    { id: 'fine', name: 'Fine stripes', blurb: 'Close, thin worms', patch: { wavelength: 5, spacing: 4 } },
    { id: 'coral', name: 'Coral', blurb: 'A balanced pattern', patch: { wavelength: 8, spacing: 5 } },
    { id: 'bold', name: 'Bold', blurb: 'Wide stripes, open hatch', patch: { wavelength: 12, spacing: 8 } },
  ],
  describe: (s) => ({ wavelength: `${r1(s.wavelength)} mm between stripes`, seed: `#${s.seed}`, angle: `${s.angle}°`, spacing: `${r1(s.spacing)} mm apart`, backingDepth: `${r1(s.backingDepth)} mm each way`, backingLength: `${r1(s.backingLength)} mm per wave` }),
});

const ROTATED_STACK = defineControls({
  ranges: { ...SIZE, layers: { min: 2, max: 8, step: 1 }, strand: { min: .4, max: .9, step: .05 }, gapFactor: { min: .5, max: 2, step: .25 },bundle:{min:1,max:5,step:1},bundleGap:{min:.1,max:1,step:.05} },
  defaults: { width: 100, height: 100, layers: 3, turn: 90, strand: .45, gapFactor: 1,bundle:1,bundleTouch:true,bundleGap:.3,colorChange: false },
  enums: { turn: STACK_TURNS },
  bools: ['colorChange','bundleTouch'],
  presets: [
    { id: 'wearable', name: "Lu's wearable mesh", blurb: '90° layers with a close, soft gap', patch: { turn: 90, gapFactor: .5, layers: 3 } },
    { id: 'open-60', name: 'Open 60°', blurb: 'Three directions with a wider gap', patch: { turn: 60, gapFactor: 1.5, layers: 3 } },
    { id: 'fine-45', name: 'Fine 45°', blurb: 'Four closely spaced planes', patch: { turn: 45, gapFactor: 1, layers: 4 } },
  ],
  describe: s => ({ layers: `${s.layers} layers`, turn: `${s.turn}° per layer`, strand: `${r2(s.strand)} mm thick`, gapFactor: `${r1(s.gapFactor)} × strand width` }),
});

const turnThumb = turn => `<svg viewBox="0 0 48 28" aria-hidden="true"><g fill="none" stroke="var(--accent)" stroke-width="1.2">${[0, Number(turn)].map(a => `<path d="M4 7H44M4 14H44M4 21H44" transform="rotate(${a} 24 14)"/>`).join('')}</g></svg>`;
const turnOptions = STACK_TURNS.map(turn => ({ id: turn, label: `${turn}°`, hint: `Each plane turns ${turn}° from the one below.`, thumb: turnThumb(turn) }));

MORE_DESIGNS.push(layered({
  id: 'rotated-stack', shelf: 'layered', family: 'grids', support: 'self', state: 'untested',
  joins: 'Straight parallel strands bond where each rotated plane crosses the one below.',
  sources: { papers: [69] },
  name: 'Rotated stack', blurb: 'Straight strands, turned plane by plane',
  about: "Layers of straight strands, each turned from the one below. The gap between strands is the main softness control: in Lu's 1.8 mm NinjaFlex meshes, doubling it from one to two strand widths cut stiffness by about 40%.",
  file: 'rotated-stack', c: ROTATED_STACK,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'turn', title: 'Structure', hint: 'Each printed plane turns from the one below.', options: turnOptions },
      { kind: 'sliders', title: 'Look and feel', items: [
        { key: 'layers', label: 'Layers', help: 'Each layer is a separate plane of straight strands.', lo: '2', hi: '8', unit: '', edit: true },
        { key: 'strand', label: 'Strand thickness', help: 'Sets extrusion width. A thicker strand makes a firmer mesh.', lo: 'Thin', hi: 'Thick', unit: 'mm', edit: true },
        { key: 'gapFactor', label: 'Gap between strands', help: 'The main softness control. Lu et al. measured lower stiffness with wider gaps in 1.8 mm NinjaFlex meshes.', lo: 'Close', hi: 'Open', unit: '× strand', edit: true },
        { key: 'bundle', label: 'Strands per bundle', help: 'Group parallel strands; 1 preserves the original mesh.', lo: 'Single', hi: 'Five', unit: '', edit: true, filenameWhen:s=>Number(s.bundle)>1 },
        { key: 'bundleGap', label: 'Gap inside bundle', help: 'Used only when bundle neighbours do not touch.', lo: 'Narrow', hi: 'Wide', unit: 'mm', edit: true, when:s=>Number(s.bundle)>1, filenameWhen:s=>Number(s.bundle)>1 },
      ] },
      {kind:'switch',key:'bundleTouch',when:s=>Number(s.bundle)>1,label:'Touch neighbours inside bundles',help:'When on, adjacent strands are 0.9 × bead width apart and fuse.'},
      COLOUR,
  ],
  build: (s, boundary, ctx) => {
    const built = rotatedStackLayers(boundary, s, { bead: ctx?.bead ?? .45 });
    return { layers: [...built], families: built.families, extra: built.extra };
  },
  summary: result => `${result.layerCount} rotated planes with ${result.report.crossings} crossings`,
}));

const MOIRE_BASE = defineControls({
  ranges: { ...SIZE, pitchA: { min: 1.2, max: 6, step: .1 }, pitchDiff: { min: 0, max: 1, step: .02 }, angleDiff: { min: 0, max: 15, step: .5 }, size: { min: 0, max: 2, step: .1 }, patternScale: { min: .5, max: 2, step: .25 } },
  defaults: { width: 100, height: 100, pitchA: 2, pitchDiff: .1, angleDiff: 3, size: 0, shape: 'wave', wavelength: 6, pattern: 'none', patternScale: 1, colorChange: false },
  enums: { shape: ['wave', 'zigzag'], pattern: ['none', ...FIELD_IDS, 'image'] },
  bools: ['colorChange','bundleTouch'],
  presets: [
    { id: 'fine-bands', name: 'Fine bands', blurb: 'Close pitches, gentle angle', patch: { pitchA: 2, pitchDiff: .1, angleDiff: 3, size: 0 } },
    { id: 'wide-bands', name: 'Wide bands', blurb: 'A larger difference between pitches', patch: { pitchA: 2, pitchDiff: .25, angleDiff: 2, size: 0 } },
    { id: 'wavy', name: 'Wavy interference', blurb: 'Soft waves make the bands wander', patch: { pitchA: 2.2, pitchDiff: .12, angleDiff: 4, size: 1, shape: 'wave' } },
  ],
  describe: s => ({ pitch: `${r1(s.pitchA)} / ${r1(s.pitchA + s.pitchDiff)} mm`, angle: `${r1(s.angleDiff)}° apart` }),
});
const MOIRE = { ...MOIRE_BASE, sanitize: raw => {
  const out = MOIRE_BASE.sanitize(raw);
  if (out.pitchDiff === 0 && out.angleDiff === 0) out.angleDiff = .5;
  return out;
} };

MORE_DESIGNS.push(layered({
  id: 'moire-net', shelf: 'layered', family: 'grids', support: 'self', state: 'untested',
  joins: 'Two close-pitched line families cross to make broad interference bands.',
  sources: { catalogue: ['M7'], papers: [43, 58, 61] },
  name: 'Moiré net', blurb: 'Interference bands from two close line pitches',
  about: 'Two straight or wavy families with slightly different pitch or angle make broad bands. The picture shifts the second family to draw an image in those bands. The cited papers mention moiré-like structures but do not measure this textile; its printability remains untested.',
  file: 'moire-net', c: MOIRE, patternEffects: ['phase'], patterns: withPicture(['none', ...FIELD_IDS]),
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'shape', title: 'Line shape', hint: 'Both families use the same line shape.', options: [
      { id: 'wave', label: 'Wave', hint: 'Rounded waves in both families.' },
      { id: 'zigzag', label: 'Zigzag', hint: 'Angular waves in both families.' },
    ] },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'pitchA', label: 'Gap between strands', help: 'The first family’s pitch; the second starts slightly wider.', lo: 'Close', hi: 'Open', unit: 'mm', edit: true },
      { key: 'pitchDiff', label: 'Pitch difference', help: 'A small difference makes wider bands. If pitches match, a slight angle difference is required.', lo: 'Same', hi: 'Different', unit: 'mm', edit: true },
      { key: 'angleDiff', label: 'Angle difference', help: 'The second family turns by this many degrees. Matching pitch and angle would make the families coincide.', lo: 'Parallel', hi: 'Turned', unit: '°', edit: true },
      { key: 'size', label: 'Wave depth', help: 'How far the strands wander. Zero keeps both families straight.', lo: 'Straight', hi: 'Wavy', unit: 'mm', edit: true },
    ] },
    { kind: 'pattern', key: 'pattern', title: 'Moiré image', hint: 'The picture shifts the second family to draw its tones in the bands.', picture: 'positive', pictureHint: 'Dark parts of the picture shift the second family by up to one pitch.', scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the picture or field across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false } },
    COLOUR,
  ],
  build: (s, boundary, ctx) => {
    const phaseField = patternField(s.pattern, { scale: s.patternScale, picture: ctx?.picture });
    const built = moireLayers(boundary, { pitchA: s.pitchA, pitchB: s.pitchA + s.pitchDiff, angleA: 0, angleB: s.angleDiff, shape: s.size > 0 ? s.shape : null, size: s.size, wavelength: s.wavelength, phaseField });
    return { layers: [...built], families: built.families, extra: built.extra, warnings: built.warnings };
  },
  summary: result => `Two interference families with ${result.report.crossings} crossings`,
}));

const TURING_CARD = {
  id: 'turing',
  shelf: 'layered', family: 'motif', support: 'auto', state: 'untested',
  joins: "Grown stripes held by a backing.", sources: {},
  optimizeTravel: true,
  name: 'Turing stripes',
  blurb: 'Grown stripes held by a wavy backing',
  about: 'The same chemistry that makes animal stripes and coral: a reaction-diffusion field grown from a few specks until it settles into winding stripes about one wavelength apart, whose edges are the first layer. A gyroid backing (or straight lines) across them is the second. Organic and near the same in every direction. Each number is a different pattern, and the same number always grows the same one.',
  file: 'turing',
  c: TURING,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'backing', title: 'Backing', hint: 'The lines laid across the stripes.', options: BACKING_STYLES.map((id) => ({ id, label: BACKING_LABELS[id].label, hint: BACKING_LABELS[id].hint })) },
    { kind: 'sliders', title: 'Backing wave', when: (s) => s.backing === 'wave', items: [
      { key: 'backingDepth', label: 'Wave depth', help: 'How far the backing lines swing to either side of their centre line.', lo: 'Shallow', hi: 'Deep', unit: 'mm', edit: true },
      { key: 'backingLength', label: 'Wave length', help: 'Length of one full wave of the backing.', lo: 'Tight', hi: 'Long', unit: 'mm', edit: true },
    ] },
    { kind: 'choice', key: 'backingLayers', title: 'Backing layers', hint: 'One backing makes two layers with the first; a second backing, turned across the first, is a third.', options: [
      { id: 'one', label: 'One', hint: 'The first layer and one backing: two layers' },
      { id: 'two', label: 'Two', hint: 'A third layer: a second backing turned across the first' },
    ] },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'wavelength', label: 'Stripe spacing', help: 'About how far apart neighbouring stripes are.', lo: 'Fine', hi: 'Bold', unit: 'mm', edit: true },
        { key: 'seed', label: 'Pattern number', help: 'Each number grows a different pattern; the same number always grows the same one.', lo: '1', hi: '999', unit: '', edit: true },
        { key: 'angle', label: 'Backing angle', help: 'The angle of the lines laid across the stripes.', lo: 'Shallow', hi: 'Steep', unit: '°', edit: true },
        { key: 'spacing', label: 'Backing spacing', help: 'Distance between the backing lines, as if they were straight and parallel.', lo: 'Dense', hi: 'Open', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary, ctx) => turingLayers(boundary, { ...s, bead:ctx?.bead??.45 }),
  summary: (result) => `Turing stripes of ${result.loops} loops and ${result.report.crossings} crossings`,
};
MORE_DESIGNS.push(layered(TURING_CARD),layered({...TURING_CARD,id:'turing-legacy',name:'Turing stripes (legacy)',file:'turing-legacy',hidden:true,build:(s,b)=>turingLayers(b,{...s,legacy:true})}));
