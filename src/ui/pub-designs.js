// Cards that come from the 3D-printed-textile literature in reference/publications:
//   Halftone net     Gispan, Ariel & Sterman, "Halftoning for 3D Printed Textile Nets": a picture carried by line thickness
//   Spacer net       Kim & Lee, "Modeling and development of continuous textile structures utilizing 3D printing"
//   Pillar weave     Takahashi & Kim, "3D Printed Fabric: Techniques for Design and 3D Weaving Programmable Textiles"
// Each is described like the other cards: controls here, geometry in src/engine.
import { defineControls, r1, r2 } from './structure-controls.js';
import { layered } from './more-designs.js';
import { buildLayeredVerdict } from './verdict.js';
import { thumbFromLayers, shapeThumb } from './thumbs.js';
import { boundaryFor } from '../engine/layers.js';
import { FIELD_IDS, createField } from '../engine/fields.js';
import { halftoneLayers, NET_SHAPES, SECOND_LAYERS } from '../engine/halftone.js';
import { generateSpacer, generatePillarWeave, spacerStrands, pillarWeaveStrands } from '../engine/pillars.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };
const PATTERN_SCALE = { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false };

const straightThumb = '<svg class="shape-thumb" width="48" height="28" viewBox="0 0 48 28" fill="none" aria-hidden="true"><path d="M2 14H46" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/></svg>';
const netShapeOptions = () => [
  { id: 'straight', label: 'Straight', hint: 'Straight lines: an orthogonal grid', thumb: straightThumb },
  { id: 'wave', label: 'Wave', hint: 'Sine-wave lines: a curvilinear grid that can stretch along its lines', thumb: shapeThumb('wave') },
  { id: 'zigzag', label: 'Zigzag', hint: 'Zigzag lines: a chevron grid', thumb: shapeThumb('zigzag') },
];

/* ---------- Halftone net ---------- */

const HALFTONE = defineControls({
  ranges: {
    ...SIZE,
    spacing: { min: 1.5, max: 8, step: 0.1 },
    angle: { min: 0, max: 90, step: 5 },
    size: { min: 0, max: 3, step: 0.25 },
    pitch: { min: 3, max: 20, step: 0.5 },
    thin: { min: 0.3, max: 1, step: 0.05 },
    thick: { min: 1, max: 2.5, step: 0.05 },
    patternScale: { min: 0.25, max: 2, step: 0.05 },
  },
  defaults: { width: 100, height: 100, spacing: 3, angle: 0, shape: 'straight', size: 1.5, pitch: 8, thin: 0.6, thick: 1.8, second: 'same', pattern: 'bumps', patternScale: 1, colorChange: false },
  enums: { shape: NET_SHAPES, second: SECOND_LAYERS, pattern: FIELD_IDS },
  bools: ['colorChange'],
  presets: [
    { id: 'soft', name: 'Soft', blurb: 'A gentle swing in thickness', patch: { thin: 0.8, thick: 1.4, second: 'same', shape: 'straight', angle: 0, colorChange: false } },
    { id: 'strong', name: 'Strong', blurb: 'Hairlines to heavy lines', patch: { thin: 0.5, thick: 2, second: 'same', shape: 'straight', angle: 0, colorChange: false } },
    { id: 'colour-swap', name: 'Colour swap', blurb: 'Two colours that trade thickness', patch: { thin: 0.6, thick: 1.8, second: 'complement', shape: 'straight', angle: 0, colorChange: true } },
    { id: 'diagonal', name: 'Diagonal', blurb: 'On the bias, so it gives along the sides', patch: { thin: 0.6, thick: 1.8, second: 'same', shape: 'straight', angle: 45, colorChange: false } },
    { id: 'curvilinear', name: 'Curvilinear', blurb: 'Wavy lines that can stretch', patch: { thin: 0.6, thick: 1.8, second: 'same', shape: 'wave', angle: 0, colorChange: false } },
  ],
  describe: (s) => ({
    spacing: `${r1(s.spacing)} mm apart`,
    angle: `${Math.round(s.angle)}°`,
    size: s.size === 0 ? 'Straight' : `${r2(s.size)} mm`,
    pitch: `${r1(s.pitch)} mm`,
    thin: `${r2(s.thin)}× flow`,
    thick: `${r2(s.thick)}× flow`,
    patternScale: `${r2(s.patternScale)}×`,
  }),
});

export const PUBLICATION_DESIGNS = [
  layered({
    id: 'halftone',
    name: 'Halftone net',
    blurb: 'The same crossed net, with line thickness carrying a pattern',
    about: 'Two layers of lines cross as a plain net, like Crosshatch. The pattern is carried by how thick each line is, not by where the lines are, so the net holds together the same everywhere and the picture is a change of flow along every line (and a slower print where the bead is thick). With two colours and the second layer set to the complement, the layers trade thickness and the pattern shows as the colours swap. The thickness range is a material test: print a small swatch first.',
    file: 'halftone',
    c: HALFTONE,
    patterns: FIELD_IDS,
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      { kind: 'choice', key: 'shape', title: 'Line shape', hint: 'Straight is an orthogonal grid; waves and zigzags give a net that stretches along its lines.', options: netShapeOptions() },
      {
        kind: 'choice',
        key: 'second',
        title: 'Second layer',
        hint: 'Thick where the first layer is thick, or thick where it is thin.',
        options: [
          { id: 'same', label: 'Same', hint: 'Both layers thick in the same places: a darker patch' },
          { id: 'complement', label: 'Complement', hint: 'The second layer is thick where the first is thin: the net stays the same thickness and the colours swap' },
        ],
      },
      { kind: 'pattern', key: 'pattern', title: 'Picture', hint: 'Lines are thick where the pattern is bright and thin where it is dark.', scale: PATTERN_SCALE },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines in a layer.', lo: 'Dense', hi: 'Airy', unit: 'mm', edit: true },
          { key: 'thin', label: 'Thinnest line', help: 'Flow where the pattern is dark (1× is a normal bead).', lo: 'Hairline', hi: 'Normal', unit: '×', edit: true },
          { key: 'thick', label: 'Thickest line', help: 'Flow where the pattern is bright. Thick lines print slower.', lo: 'Normal', hi: 'Heavy', unit: '×', edit: true },
          { key: 'angle', label: 'Grid angle', help: 'Turns the whole net.', lo: '0°', hi: '90°', unit: '°', edit: true },
          { key: 'size', label: 'Wave size', help: 'How far the lines swing. Only used for wave and zigzag lines.', lo: 'Straight', hi: 'Deep', unit: 'mm', edit: true },
          { key: 'pitch', label: 'Wave length', help: 'Length of one full wave.', lo: 'Tight', hi: 'Long', unit: 'mm', edit: true },
        ],
      },
      COLOUR,
    ],
    build: (s, boundary, { bead } = {}) => halftoneLayers(boundary, {
      bead,
      spacing: s.spacing,
      angle: s.angle,
      crossing: 90,
      shape: s.shape,
      size: s.size,
      pitch: s.pitch,
      thin: s.thin,
      thick: s.thick,
      second: s.second,
      tone: createField(s.pattern, { scale: s.patternScale }),
    }),
    verdict: (result) => buildLayeredVerdict(result),
    figure: (result) => ({ value: `${result.halftone.lo.toFixed(2)}–${result.halftone.hi.toFixed(2)}`, unit: '×', label: 'Line thickness' }),
    summary: (result) => `a halftone net with line flow from ${result.halftone.lo.toFixed(2)}× to ${result.halftone.hi.toFixed(2)}× and ${result.report.crossings} crossings`,
  }),
];

/* ---------- the pillar structures: not layered lines, so a small card builder of their own ---------- */

function structure(def) {
  const { c } = def;
  let thumb = '';
  try { thumb = thumbFromLayers(def.thumbLayers(36, 22), 36, 22); } catch { /* a tile without a picture still works */ }
  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    about: def.about,
    file: def.file,
    status: 'ready',
    thumb,
    roles: def.roles,
    defaults: () => ({ ...c.defaults }),
    sanitize: c.sanitize,
    ranges: c.ranges,
    presets: c.presets,
    presetMatch: c.presetMatch,
    describe: c.describe,
    size: (s) => [s.width, s.height],
    setSize: (s, w, h) => { s.width = w; s.height = h; },
    controls: def.controls,
    generate: (machine, material, s, { outline = null } = {}) => def.generate(machine, material, s, outline),
    verdict: (result) => buildLayeredVerdict(result),
    figure: (result) => ({ value: result.stats.loops.toLocaleString('en'), unit: '', label: 'Pillars' }),
    summary: (result) => def.summary(result),
  };
}

/** Rings and lines of a strand list as thumbnail layers: nets and fibres first, pillars second. */
const thumbOf = (strands) => [
  strands.filter((s) => s.name !== 'Pillars').map((s) => s.pts),
  strands.filter((s) => s.name === 'Pillars' && s.layer <= 1).map((s) => s.pts),
];

const SPACER = defineControls({
  ranges: { ...SIZE, pitch: { min: 3, max: 12, step: 0.5 }, layers: { min: 2, max: 14, step: 1 }, radius: { min: 0.5, max: 2.5, step: 0.1 }, every: { min: 1, max: 3, step: 1 } },
  defaults: { width: 100, height: 100, pitch: 6, layers: 6, radius: 1, every: 1 },
  presets: [
    { id: 'thin', name: 'Thin', blurb: 'Four layers of pillar', patch: { pitch: 6, layers: 4, radius: 1, every: 1 } },
    { id: 'standard', name: 'Standard', blurb: 'About two millimetres of space', patch: { pitch: 6, layers: 6, radius: 1, every: 1 } },
    { id: 'airy', name: 'Airy', blurb: 'Pillars on every second node', patch: { pitch: 4, layers: 6, radius: 1, every: 2 } },
    { id: 'thick', name: 'Thick', blurb: 'Tall pillars, wide net', patch: { pitch: 8, layers: 10, radius: 1.2, every: 1 } },
  ],
  describe: (s) => ({
    pitch: `${r1(s.pitch)} mm net`,
    layers: `${s.layers} layers, about ${r1((s.layers + 3) * 0.2)} mm thick`,
    radius: `${r1(s.radius)} mm`,
    every: s.every === 1 ? 'Every node' : `Every ${s.every === 2 ? 'second' : 'third'} node`,
  }),
});

const PILLAR_WEAVE = defineControls({
  ranges: { ...SIZE, pitch: { min: 3, max: 12, step: 0.2 }, layers: { min: 2, max: 14, step: 1 }, radius: { min: 0.5, max: 2, step: 0.1 } },
  defaults: { width: 100, height: 100, pitch: 5, layers: 5, radius: 0.8 },
  presets: [
    { id: 'close', name: 'Close', blurb: 'Pillars near together: a firm fabric', patch: { pitch: 4, layers: 5, radius: 0.8 } },
    { id: 'standard', name: 'Standard', blurb: 'The default weave', patch: { pitch: 5, layers: 5, radius: 0.8 } },
    { id: 'open', name: 'Open', blurb: 'Wide spacing, taller', patch: { pitch: 7, layers: 8, radius: 1 } },
  ],
  describe: (s) => ({ pitch: `${r1(s.pitch)} mm apart`, layers: `${s.layers} layers of fibre`, radius: `${r1(s.radius)} mm` }),
});

PUBLICATION_DESIGNS.push(
  structure({
    id: 'spacer',
    name: 'Spacer net',
    blurb: 'Two nets held apart by small pillars',
    about: 'A net on the bed, a pillar of stacked rings on its nodes, and a second net on the pillars\' tops: the shape of a spacer fabric, which is thick, springy and breathable. The pillars print layer by layer with the nets, so the nozzle is never below something it has to pass. The top net only runs along lines of pillars. This is a geometry study: print a small swatch first and see whether the foam holds the top net.',
    file: 'spacer',
    c: SPACER,
    roles: { base: 'Bottom net', anchored: 'Pillars and top net' },
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'pitch', label: 'Net spacing', help: 'Distance between the net\'s lines, and between pillars.', lo: 'Fine', hi: 'Open', unit: 'mm', edit: true },
          { key: 'layers', label: 'Pillar height', help: 'Layers of ring in each pillar: this is how far apart the two nets are.', lo: 'Low', hi: 'Tall', unit: 'layers', edit: true },
          { key: 'radius', label: 'Pillar radius', help: 'Radius of each pillar\'s ring.', lo: 'Slim', hi: 'Stout', unit: 'mm', edit: true },
          { key: 'every', label: 'Pillar every', help: 'A pillar on every node, or on every second or third.', lo: 'Every', hi: 'Third', unit: 'node', edit: true, readout: (d) => d.every },
        ],
      },
    ],
    thumbLayers: (w, h) => thumbOf(spacerStrands(boundaryFor(w, h), { pitch: 6, layers: 3, radius: 1 }).strands),
    generate: (machine, material, s, outline) => generateSpacer(machine, material, { ...s, outline }),
    summary: (result) => `a spacer net with ${result.spacer.pillars} pillars of ${result.spacer.layers} layers and ${result.report.crossings} crossings`,
  }),
  structure({
    id: 'pillarweave',
    name: 'Pillar weave',
    blurb: 'Fibre locked round pillars, layer by layer',
    about: 'Short pillars stand on a grid and one continuous fibre runs between them, passing a pillar on one side on one layer and on the other side on the next, so the fibre layers lock round the pillars the way a weft locks round warps. Neighbouring rows and neighbouring layers all alternate, which makes it a plain weave in three dimensions. The pillars print as stacks of small rings, layer by layer with the fibre.',
    file: 'pillarweave',
    c: PILLAR_WEAVE,
    roles: { base: 'First layer', anchored: 'Pillars and fibre' },
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'sliders',
        title: 'Look and feel',
        items: [
          { key: 'pitch', label: 'Pillar spacing', help: 'Distance between pillars along a row, and between rows.', lo: 'Close', hi: 'Open', unit: 'mm', edit: true },
          { key: 'layers', label: 'Layers', help: 'Layers of fibre, which is also how tall the pillars stand.', lo: 'Few', hi: 'Many', unit: 'layers', edit: true },
          { key: 'radius', label: 'Pillar radius', help: 'Radius of each pillar\'s ring.', lo: 'Slim', hi: 'Stout', unit: 'mm', edit: true },
        ],
      },
    ],
    thumbLayers: (w, h) => thumbOf(pillarWeaveStrands(boundaryFor(w, h), { pitch: 5, layers: 2, radius: 0.8 }).strands),
    generate: (machine, material, s, outline) => generatePillarWeave(machine, material, { ...s, outline }),
    summary: (result) => `a pillar weave of ${result.pillarWeave.pillars} pillars and ${result.pillarWeave.layers} layers of fibre`,
  }),
);
