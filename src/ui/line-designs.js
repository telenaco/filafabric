// More layered designs from the line-algorithm research: each layer-2 rule guarantees the layers cross.
// Same shape as more-designs.js: a small `layered({...})` description per card; the studio needs no other code.
import { layered } from './more-designs.js';
import { defineControls, r1, r2 } from './structure-controls.js';
import { conformalLayers, MAPS, MAP_IDS } from '../engine/conformal.js';
import { sunflowerLayers } from '../engine/sunflower.js';
import { rosetteLayers } from '../engine/rosette.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
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
