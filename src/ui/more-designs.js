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
import { dipweaveLayers, MIN_DIP_PITCH } from '../engine/dipweave.js';
import { webLayers } from '../engine/web.js';
import { chainmailLayers } from '../engine/chainmail.js';
import { meanderLayers, CURVES, CURVE_IDS } from '../engine/meander.js';
import { lissajousLayers } from '../engine/lissajous.js';
import { truchetLayers, TILES, TILE_IDS } from '../engine/truchet.js';

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
        ramp: def.ramp ?? 1.6,
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

const DIPWEAVE = defineControls({
  ranges: { ...SIZE, warpPitch: { min: 2, max: 8, step: 0.5 }, weftPitch: { min: 2, max: 8, step: 0.5 } },
  defaults: { width: 50, height: 50, warpPitch: 3.5, weftPitch: 3.5 },
  presets: [
    { id: 'fine', name: 'Fine', blurb: 'Close lines, many crossings', patch: { warpPitch: 3, weftPitch: 3 } },
    { id: 'open', name: 'Open', blurb: 'Airy mesh', patch: { warpPitch: 5, weftPitch: 5 } },
    { id: 'ribbed', name: 'Ribbed', blurb: 'Close warp, wide weft', patch: { warpPitch: 2.5, weftPitch: 6 } },
  ],
  describe: (s) => ({ warpPitch: `${r1(s.warpPitch)} mm apart`, weftPitch: `${r1(s.weftPitch)} mm apart` }),
});

MORE_DESIGNS.push(layered({
  id: 'dipweave',
  name: 'Dip weave',
  blurb: 'Weft rides over each warp, dips between',
  about: 'Warp lines straight on the bed and weft lines printed after them that ride over each warp and dip back to the bed between, so the fabric is one layer thick except at the crossings. Nothing is printed in mid-air, but the nozzle tip needs room to drop between warps.',
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

const WEB = defineControls({
  ranges: { ...SIZE, spacing: { min: 2, max: 8, step: 0.5 }, spokes: { min: 8, max: 48, step: 4 }, hub: { min: 1, max: 10, step: 0.5 }, tooth: { min: 0, max: 2, step: 0.25 } },
  defaults: { width: 50, height: 50, spacing: 4, spokes: 24, hub: 3, tooth: 0, colorChange: false },
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
  name: 'Spiderweb',
  blurb: 'A spiral crossed by a radial zigzag',
  about: 'One continuous spiral from the middle outwards, crossed by a zigzag that goes out along one spoke and back along the next. Every spoke crosses every turn at about a right angle, so the layers hold each other: soft along the radius, firm around.',
  file: 'web',
  c: WEB,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Turn spacing', help: 'How far the spiral moves outwards each turn.', lo: 'Tight', hi: 'Open', unit: 'mm', edit: true },
        { key: 'spokes', label: 'Spokes', help: 'How many times the zigzag crosses a turn.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'hub', label: 'Hub hole', help: 'Radius left empty in the middle, where spokes would crowd.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
        { key: 'tooth', label: 'Sawtooth', help: 'A small in-and-out wobble of each turn, lined up with the spokes.', lo: 'Smooth', hi: 'Toothed', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => webLayers(boundary, { spacing: s.spacing, spokes: s.spokes, hub: s.hub, tooth: s.tooth }),
  summary: (result) => `a spiderweb of ${result.report.crossings} crossings`,
}));

const CHAINMAIL = defineControls({
  ranges: { ...SIZE, spacing: { min: 3, max: 10, step: 0.5 }, ratio: { min: 1.1, max: 1.8, step: 0.1 } },
  defaults: { width: 50, height: 50, spacing: 6, ratio: 1.5, colorChange: false },
  bools: ['colorChange'],
  presets: [
    { id: 'mail', name: 'Mail', blurb: 'Rings overlapping like chainmail', patch: { spacing: 6, ratio: 1.5 } },
    { id: 'fine', name: 'Fine mail', blurb: 'Small rings, close together', patch: { spacing: 4, ratio: 1.5 } },
    { id: 'loose', name: 'Loose rings', blurb: 'Barely overlapping, soft', patch: { spacing: 7, ratio: 1.2 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart`, ratio: `${Math.round((s.ratio - 1) * 100)}% overlap` }),
});

MORE_DESIGNS.push(layered({
  id: 'chainmail',
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
  ranges: { ...SIZE, cell: { min: 3, max: 14, step: 0.5 }, angle: { min: 15, max: 75, step: 5 }, spacing: { min: 3, max: 10, step: 0.5 } },
  defaults: { width: 50, height: 50, curve: 'hilbert', cell: 6, angle: 45, spacing: 5, colorChange: false },
  enums: { curve: CURVE_IDS },
  bools: ['colorChange'],
  presets: [
    { id: 'hilbert', name: 'Hilbert lace', blurb: 'Tight folds, hatched across', patch: { curve: 'hilbert', cell: 6, angle: 45, spacing: 5 } },
    { id: 'peano', name: 'Peano', blurb: 'Long serpentine folds', patch: { curve: 'peano', cell: 6, angle: 45, spacing: 5 } },
    { id: 'open', name: 'Open meander', blurb: 'Large cells, wide hatch', patch: { curve: 'hilbert', cell: 10, angle: 60, spacing: 8 } },
  ],
  describe: (s) => ({ cell: `${r1(s.cell)} mm cells`, angle: `${s.angle}°`, spacing: `${r1(s.spacing)} mm apart` }),
});

MORE_DESIGNS.push(layered({
  id: 'meander',
  name: 'Meander',
  blurb: 'A space-filling curve crossed by a hatch',
  about: 'One continuous strand that folds across the fabric (a Hilbert or Peano curve) and never crosses itself, held by a straight hatch laid over it at an angle. The folds give hidden slack, so it stretches by unfolding and reads as lace.',
  file: 'meander',
  c: MEANDER,
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
        { key: 'angle', label: 'Hatch angle', help: 'The angle of the lines laid across the curve.', lo: 'Shallow', hi: 'Steep', unit: '°', edit: true },
        { key: 'spacing', label: 'Hatch spacing', help: 'Distance between the hatch lines.', lo: 'Dense', hi: 'Open', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => meanderLayers(boundary, { curve: s.curve, cell: s.cell, angle: s.angle, spacing: s.spacing }),
  summary: (result) => `a meander of ${result.report.crossings} crossings`,
}));

const HARMONOGRAPH = defineControls({
  ranges: { ...SIZE, a: { min: 2, max: 14, step: 1 }, b: { min: 2, max: 14, step: 1 }, phase: { min: 0, max: 90, step: 5 } },
  defaults: { width: 50, height: 50, a: 7, b: 6, phase: 30, second: true, colorChange: false },
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
  name: 'Harmonograph',
  blurb: 'One closed curve that crosses itself in diamonds',
  about: 'A Lissajous curve: one closed strand that sweeps across the fabric and back, crossing itself in a diamond lattice with a dense band along the edge, a natural hem. A second curve with its phase turned crosses the first everywhere. It fills the whole swatch; an outline clips it rather than being followed.',
  file: 'harmonograph',
  c: HARMONOGRAPH,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'a', label: 'Lobes across', help: 'How many times the curve swings across. Coprime pairs (7 and 6) make one unbroken curve.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'b', label: 'Lobes up', help: 'How many times the curve swings up the fabric.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'phase', label: 'Phase', help: 'Turns the curve: zero is a straight diagonal at the extreme, larger fills the diamond.', lo: 'Squeezed', hi: 'Open', unit: '°', edit: true },
      ],
    },
    { kind: 'switch', key: 'second', label: 'Second curve', help: 'A copy with its phase turned, which crosses the first everywhere.' },
    COLOUR,
  ],
  build: (s, boundary) => lissajousLayers(boundary, { a: s.a, b: s.b, phase: s.phase, second: s.second }),
  summary: (result) => `a harmonograph of ${result.report.crossings} crossings`,
}));

const TRUCHET = defineControls({
  ranges: { ...SIZE, size: { min: 3, max: 12, step: 0.5 }, seed: { min: 1, max: 999, step: 1 } },
  defaults: { width: 50, height: 50, tile: 'arcs', size: 5, seed: 7, colorChange: false },
  enums: { tile: TILE_IDS },
  bools: ['colorChange'],
  presets: [
    { id: 'arcs', name: 'Arcs', blurb: 'Flowing curves', patch: { tile: 'arcs', size: 5 } },
    { id: 'diagonals', name: 'Diagonals', blurb: 'An X in every cell', patch: { tile: 'diagonals', size: 5 } },
    { id: 'big-arcs', name: 'Big arcs', blurb: 'Large, soft curves', patch: { tile: 'arcs', size: 8 } },
  ],
  describe: (s) => ({ size: `${r1(s.size)} mm tiles`, seed: `#${s.seed}` }),
});

MORE_DESIGNS.push(layered({
  id: 'truchet',
  name: 'Truchet tiles',
  blurb: 'Random tiles that flow into curves',
  about: 'A grid where every cell holds one of two orientations of a simple tile, picked at random. Diagonals give an X in every cell; arcs flow into long curves, with the second layer a half tile over so it crosses the first. The same seed always makes the same pattern, so a swatch can be made again.',
  file: 'truchet',
  c: TRUCHET,
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
  build: (s, boundary) => truchetLayers(boundary, { tile: s.tile, size: s.size, seed: s.seed }),
  summary: (result) => `a Truchet pattern of ${result.report.crossings} crossings`,
}));
