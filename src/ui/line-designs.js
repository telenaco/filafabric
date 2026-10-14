// More layered designs from the line-algorithm research: each layer-2 rule guarantees the layers cross.
// Same shape as more-designs.js: a small `layered({...})` description per card; the studio needs no other code.
import { layered } from './more-designs.js';
import { defineControls, r1, r2 } from './structure-controls.js';
import { conformalLayers, MAPS, MAP_IDS } from '../engine/conformal.js';
import { sunflowerLayers } from '../engine/sunflower.js';
import { rosetteLayers } from '../engine/rosette.js';
import { flowLayers, FLOWS, FLOW_IDS } from '../engine/flowlines.js';
import { bubblesLayers } from '../engine/bubbles.js';
import { parquetLayers, TILINGS, TILING_IDS } from '../engine/parquet.js';
import { FIELD_IDS, createField } from '../engine/fields.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const PATTERN_SCALE = { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false };
const toneFor = (s) => (s.pattern === 'none' ? null : createField(s.pattern, { scale: s.patternScale }));
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };

export const LINE_DESIGNS = [];

const CONFORMAL = defineControls({
  ranges: { ...SIZE, spacing: { min: 2, max: 8, step: 0.5 }, feature: { min: 0.15, max: 0.6, step: 0.05 }, arms: { min: 8, max: 55, step: 1 }, twist: { min: 3, max: 34, step: 1 } },
  defaults: { width: 50, height: 50, map: 'hole', spacing: 3, feature: 0.35, arms: 21, twist: 13, colorChange: false },
  enums: { map: MAP_IDS },
  bools: ['colorChange'],
  presets: [
    { id: 'buttonhole', name: 'Buttonhole', blurb: 'A grid that bends round one hole', patch: { map: 'hole', feature: 0.35 } },
    { id: 'two-holes', name: 'Two holes', blurb: 'Flow round two holes', patch: { map: 'twin', feature: 0.35 } },
    { id: 'magnet', name: 'Magnet', blurb: 'Rings round two poles, arcs through both', patch: { map: 'dipole', feature: 0.35 } },
    { id: 'nautilus', name: 'Nautilus', blurb: 'Two families of spirals at right angles', patch: { map: 'nautilus', arms: 21, twist: 13 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm cells`, feature: `${Math.round(s.feature * 100)}%`, arms: `${s.arms} lines`, twist: `${s.twist} lines` }),
});

LINE_DESIGNS.push(layered({
  id: 'conformal',
  name: 'Conformal mesh',
  blurb: 'A square grid that bends round holes and poles',
  about: 'The two layers are the level lines of the two halves of one complex function, so wherever the grid bends they still cross at exactly 90° and the cells stay square, only larger or smaller. Bend it round a buttonhole, round two holes, round two poles like the field of a magnet, or into two families of spirals. Every hole gets a ring round it, a hem, held by the lines that run into it.',
  file: 'conformal',
  c: CONFORMAL,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'map', title: 'Map', hint: 'How the grid bends.', options: MAP_IDS.map((id) => ({ id, label: MAPS[id].label, hint: MAPS[id].hint })) },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Cell size', help: 'Distance between neighbouring lines where the grid is least stretched.', lo: 'Fine', hi: 'Coarse', unit: 'mm', edit: true },
        { key: 'feature', label: 'Hole size', help: 'How big the holes are, or how far apart the poles. Not used by the nautilus.', lo: 'Small', hi: 'Large', unit: '', edit: false },
        { key: 'arms', label: 'Spiral lines', help: 'Nautilus only: how many lines of one family go once round.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'twist', label: 'Twist', help: 'Nautilus only: how many lines of the other family go once round. Equal numbers turn at 45°.', lo: 'Gentle', hi: 'Tight', unit: '', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => conformalLayers(boundary, { map: s.map, spacing: s.spacing, feature: s.feature, arms: s.arms, twist: s.twist }),
  summary: (result) => `a conformal mesh with ${result.report.crossings} right-angle crossings`,
}));

const SUNFLOWER = defineControls({
  ranges: { ...SIZE, spacing: { min: 2.5, max: 8, step: 0.5 }, hub: { min: 0, max: 15, step: 0.5 } },
  defaults: { width: 50, height: 50, spacing: 4, hub: 3, colorChange: false },
  bools: ['colorChange'],
  presets: [
    { id: 'sunflower', name: 'Sunflower', blurb: 'Even seeds, a small centre', patch: { spacing: 4, hub: 3 } },
    { id: 'fine', name: 'Fine seeds', blurb: 'Close spirals', patch: { spacing: 3, hub: 2 } },
    { id: 'open', name: 'Open head', blurb: 'Large cells, a wide centre', patch: { spacing: 6, hub: 8 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart`, hub: s.hub === 0 ? 'Closed' : `${r1(s.hub)} mm` }),
});

LINE_DESIGNS.push(layered({
  id: 'sunflower',
  name: 'Sunflower',
  blurb: 'Two families of seed spirals, one each way',
  about: 'Seeds placed the way a sunflower places them, turned by the golden angle each time, so they are spread evenly at every radius. Every seed sits on two spirals, one turning each way; the first layer follows the spirals one way and the second the other way, so both pass through every seed and cross there. Towards the edge the spirals split into more, as they do in the flower, so the cells keep their size. Best for round pieces.',
  file: 'sunflower',
  c: SUNFLOWER,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Seed spacing', help: 'Distance between neighbouring seeds.', lo: 'Fine', hi: 'Coarse', unit: 'mm', edit: true },
        { key: 'hub', label: 'Open centre', help: 'Radius of the open middle, where the spirals start.', lo: 'Closed', hi: 'Wide', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => sunflowerLayers(boundary, { spacing: s.spacing, hub: s.hub }),
  summary: (result) => `a sunflower of ${result.seeds} seeds and ${result.report.crossings} crossings`,
}));

const ROSETTE = defineControls({
  ranges: { ...SIZE, spacing: { min: 2.5, max: 8, step: 0.5 }, lobes: { min: 6, max: 48, step: 1 }, depth: { min: 0.5, max: 3, step: 0.1 }, hub: { min: 0, max: 20, step: 0.5 } },
  defaults: { width: 50, height: 50, spacing: 4, lobes: 18, depth: 1.4, hub: 4, colorChange: false },
  bools: ['colorChange'],
  presets: [
    { id: 'rosette', name: 'Rosette', blurb: 'Eighteen lobes a turn', patch: { spacing: 4, lobes: 18, depth: 1.4 } },
    { id: 'lace', name: 'Lace', blurb: 'Fine and close', patch: { spacing: 3, lobes: 30, depth: 1 } },
    { id: 'bold', name: 'Bold', blurb: 'Few, deep lobes', patch: { spacing: 6, lobes: 12, depth: 2.2 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm a turn`, lobes: `${s.lobes} a turn`, depth: `${r2(s.depth)} mm`, hub: s.hub === 0 ? 'As small as it can be' : `${r1(s.hub)} mm` }),
});

LINE_DESIGNS.push(layered({
  id: 'rosette',
  name: 'Rosette',
  blurb: 'Guilloché: two wavy spirals in opposite phase',
  about: 'The parallel squiggle mesh wrapped round a centre, like guilloché engraving. Each layer is one continuous spiral that swings in and out a whole number of times per turn, so every turn stays in step with the next; the second spiral runs half a turn further out and swings the opposite way, so it crosses the turns on both sides. The swing never drops below the depth that guarantees those crossings. For round pieces: hats, cups, yokes.',
  file: 'rosette',
  c: ROSETTE,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Turn spacing', help: 'How far each spiral moves out per turn.', lo: 'Dense', hi: 'Airy', unit: 'mm', edit: true },
        { key: 'lobes', label: 'Lobes', help: 'How many times each turn swings in and out.', lo: 'Few', hi: 'Many', unit: '', edit: true },
        { key: 'depth', label: 'Swing', help: 'How far the spiral swings in and out; raised if needed so the layers always cross.', lo: 'Subtle', hi: 'Deep', unit: 'mm', edit: true },
        { key: 'hub', label: 'Open centre', help: 'Radius of the open middle; widened so no wave gets too short.', lo: 'Small', hi: 'Wide', unit: 'mm', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => rosetteLayers(boundary, { spacing: s.spacing, lobes: s.lobes, depth: s.depth, hub: s.hub }),
  summary: (result) => `a rosette of ${Math.round(result.turns)} turns and ${result.report.crossings} crossings`,
}));

const FLOW = defineControls({
  ranges: { ...SIZE, spacing: { min: 2, max: 8, step: 0.5 }, scale: { min: 10, max: 80, step: 5 }, bend: { min: 0.1, max: 1, step: 0.05 }, patternScale: { min: 0.5, max: 2, step: 0.25 } },
  defaults: { width: 50, height: 50, flow: 'waves', spacing: 3, scale: 25, bend: 0.6, pattern: 'noise', patternScale: 1, colorChange: false },
  enums: { flow: FLOW_IDS, pattern: ['none', ...FIELD_IDS] },
  bools: ['colorChange'],
  presets: [
    { id: 'ripples', name: 'Ripples', blurb: 'A grid that ripples both ways', patch: { flow: 'waves', scale: 25, bend: 0.6 } },
    { id: 'whirlpool', name: 'Whirlpool', blurb: 'Rings and spokes round the centre', patch: { flow: 'swirl', bend: 0.6 } },
    { id: 'eddies', name: 'Eddies', blurb: 'A grid of whirls', patch: { flow: 'vortices', scale: 40 } },
    { id: 'marble', name: 'Marble', blurb: 'Lines turned by a noise pattern', patch: { flow: 'pattern', pattern: 'noise', bend: 0.5 } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart`, scale: `${s.scale} mm`, bend: `${Math.round(s.bend * 100)}%`, patternScale: `${r2(s.patternScale)}×` }),
});

LINE_DESIGNS.push(layered({
  id: 'flowlines',
  name: 'Flow lines',
  blurb: 'Evenly spaced lines along a flow, crossed at 90°',
  about: 'Each layer is a set of evenly spaced lines that follow a flow: ripples, a whirlpool, a grid of eddies, or a pattern that turns the lines. The second layer follows the same flow turned a quarter turn, so at every point it runs at a right angle to the first, however the lines bend. Lines are spaced by growing each one until it comes too close to another and starting the next one a spacing to the side (Jobard and Lefer). Where a flow has no direction, at the eye of a whirl, a small hole is left open.',
  file: 'flowlines',
  c: FLOW,
  patterns: ['none', ...FIELD_IDS],
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'flow', title: 'Flow', hint: 'What the lines follow.', options: FLOW_IDS.map((id) => ({ id, label: FLOWS[id].label, hint: FLOWS[id].hint })) },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines of one layer.', lo: 'Dense', hi: 'Open', unit: 'mm', edit: true },
        { key: 'scale', label: 'Wave size', help: 'Ripples and eddies: how large one ripple or whirl is.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
        { key: 'bend', label: 'Bend', help: 'How far the lines lean: the ripple depth, the twist of the whirlpool, or how far a pattern turns them.', lo: 'Gentle', hi: 'Strong', unit: '', edit: false },
      ],
    },
    { kind: 'pattern', key: 'pattern', title: 'Turn with a pattern', hint: 'Only the pattern flow uses it: the lines turn one way where it is bright, the other where it is dark.', scale: PATTERN_SCALE },
    COLOUR,
  ],
  build: (s, boundary) => flowLayers(boundary, { flow: s.flow, spacing: s.spacing, scale: s.scale, bend: s.bend, tone: toneFor(s) }),
  summary: (result) => `flow lines with ${result.report.crossings} right-angle crossings`,
}));

const BUBBLES = defineControls({
  ranges: { ...SIZE, size: { min: 2.5, max: 10, step: 0.5 }, seed: { min: 1, max: 999, step: 1 }, patternScale: { min: 0.5, max: 2, step: 0.25 } },
  defaults: { width: 50, height: 50, size: 4, seed: 1, link: true, pattern: 'none', patternScale: 1, colorChange: false },
  enums: { pattern: ['none', ...FIELD_IDS] },
  bools: ['link', 'colorChange'],
  presets: [
    { id: 'foam', name: 'Foam', blurb: 'Mixed bubbles, joined in clusters', patch: { size: 4, link: true, pattern: 'none' } },
    { id: 'froth', name: 'Froth', blurb: 'Small and close', patch: { size: 2.5, link: true, pattern: 'none' } },
    { id: 'big', name: 'Big bubbles', blurb: 'Large rings', patch: { size: 7, link: true, pattern: 'none' } },
    { id: 'graded', name: 'Graded', blurb: 'Smaller where a pattern is bright', patch: { size: 6, link: true, pattern: 'noise' } },
  ],
  describe: (s) => ({ size: `up to ${r1(s.size)} mm`, seed: `#${s.seed}`, patternScale: `${r2(s.patternScale)}×` }),
});

LINE_DESIGNS.push(layered({
  id: 'bubbles',
  name: 'Bubbles',
  blurb: 'Packed rings, held by a ring in every gap',
  about: 'Rings of mixed sizes packed until no gap would take another. Neighbouring rings are joined where they nearly touch by a short double bridge, so one strand tours a whole cluster. The second layer puts a small ring in each gap between three bubbles, centred where it meets all three at a right angle (their radical centre), so every bubble is held by the rings in the gaps round it. Reads as foam or lace.',
  file: 'bubbles',
  c: BUBBLES,
  patterns: ['none', ...FIELD_IDS],
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'size', label: 'Bubble size', help: 'Radius of the largest bubbles; smaller ones fill the gaps.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
        { key: 'seed', label: 'Pattern number', help: 'Each number packs the bubbles differently; the same number repeats it.', lo: '1', hi: '999', unit: '', edit: true },
      ],
    },
    { kind: 'switch', key: 'link', label: 'Join bubbles into clusters', help: 'One strand tours each cluster of touching bubbles, with fewer starts and stops. Off: every bubble is its own ring.' },
    { kind: 'pattern', key: 'pattern', title: 'Grade with a pattern', hint: 'Bubbles are smaller where the pattern is bright.', scale: PATTERN_SCALE },
    COLOUR,
  ],
  build: (s, boundary) => bubblesLayers(boundary, { size: s.size, seed: s.seed, link: s.link, tone: toneFor(s) }),
  summary: (result) => `${result.bubbles} bubbles held by ${result.gaps} rings`,
}));

const PARQUET = defineControls({
  ranges: { ...SIZE, block: { min: 4, max: 20, step: 0.5 }, ratio: { min: 2, max: 4, step: 1 }, spacing: { min: 1.5, max: 5, step: 0.25 }, turn: { min: 0, max: 90, step: 15 } },
  defaults: { width: 50, height: 50, tiling: 'herringbone', block: 8, ratio: 2, spacing: 2, turn: 45, colorChange: false },
  enums: { tiling: TILING_IDS },
  bools: ['colorChange'],
  presets: [
    { id: 'herringbone', name: 'Herringbone', blurb: 'Planks in a zigzag, turned 45°', patch: { tiling: 'herringbone', block: 8, ratio: 2, turn: 45 } },
    { id: 'long-planks', name: 'Long planks', blurb: 'Herringbone of planks three long', patch: { tiling: 'herringbone', block: 5, ratio: 3, turn: 0 } },
    { id: 'basket', name: 'Basket weave', blurb: 'Square blocks, alternating', patch: { tiling: 'basket', block: 8, turn: 0 } },
    { id: 'chevron', name: 'Chevron', blurb: 'Slanted bands meeting in points', patch: { tiling: 'chevron', block: 8, turn: 0 } },
  ],
  describe: (s) => ({ block: `${r1(s.block)} mm`, ratio: `${s.ratio} long`, spacing: `${r2(s.spacing)} mm apart`, turn: `${s.turn}°` }),
});

LINE_DESIGNS.push(layered({
  id: 'parquet',
  name: 'Parquet',
  blurb: 'Blocks of 90° mesh, each turned from the next',
  about: 'The fabric is cut into blocks or planks like a parquet floor. In every block the first layer runs one way and the second the other, so every part of it is a plain right-angle mesh; neighbouring blocks are turned a quarter turn, so the layer on top changes direction from block to block. Printed in two colours it shows a basket weave, a herringbone or chevron bands. Each block is one serpentine strand per layer.',
  file: 'parquet',
  c: PARQUET,
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'tiling', title: 'Floor', hint: 'How the blocks are laid.', options: TILING_IDS.map((id) => ({ id, label: TILINGS[id].label, hint: TILINGS[id].hint })) },
    {
      kind: 'sliders',
      title: 'Look and feel',
      items: [
        { key: 'block', label: 'Block size', help: 'The side of a block, or the width of a plank or band.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
        { key: 'ratio', label: 'Plank length', help: 'Herringbone only: how many widths long each plank is.', lo: '2', hi: '4', unit: '', edit: false },
        { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring lines within a block.', lo: 'Dense', hi: 'Open', unit: 'mm', edit: true },
        { key: 'turn', label: 'Turn', help: 'Turns the whole floor.', lo: '0°', hi: '90°', unit: '°', edit: true },
      ],
    },
    COLOUR,
  ],
  build: (s, boundary) => parquetLayers(boundary, { tiling: s.tiling, block: s.block, ratio: s.ratio, spacing: s.spacing, turn: s.turn }),
  summary: (result) => `a ${TILINGS[result.tiling]?.label.toLowerCase() ?? 'parquet'} of ${result.report.crossings} crossings`,
}));
