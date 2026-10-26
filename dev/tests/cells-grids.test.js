import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { migrateState } from '../../site/src/ui/library.js';
import { defaultProfiles } from './helpers.js';

test('Auxetic is fixed to Re-entrant and flat honeycomb has its own cell settings', () => {
  const auxetic = designById('auxetic'), honeycomb = designById('honeycomb-flat');
  assert.equal(auxetic.name, 'Re-entrant mesh');
  assert.equal(auxetic.defaults().cell, 'reentrant');
  assert.equal(auxetic.sanitize({ cell: 'hexagon' }).cell, 'reentrant');
  assert.deepEqual(auxetic.presets.map((preset) => preset.id), ['re-entrant', 'deep-auxetic']);
  assert.equal(honeycomb.settingsKey, 'honeycomb-flat');
  assert.equal(honeycomb.defaults().cell, 'hexagon');
  assert.equal(honeycomb.sanitize({ cell: 'reentrant' }).cell, 'hexagon');
  assert.equal(honeycomb.joins, 'Hexagon cells share their walls in one pass.');
  assert.notEqual(honeycomb.controls, designById('honeycomb-layered').controls);
});

test('Grid & isogrid is visible and straight; old wavy settings retain the hidden compatibility card', () => {
  const grid = designById('crosshatch'), legacy = designById('crosshatch-wavy');
  assert.equal(grid.hidden, false);
  assert.equal(grid.settingsKey, 'grid');
  assert.equal(grid.controls.some((section) => section.key === 'shape' || section.items?.some((item) => ['size', 'pitch'].includes(item.key))), false);
  assert.equal(grid.sanitize({ shape: 'wave', size: 1.25 }).size, 0);
  assert.equal(legacy.hidden, true);
  assert.equal(legacy.sanitize({ shape: 'wave', size: 1.25 }).size, 1.25);
  assert.equal(migrateState({ v: 4, design: 'crosshatch', designs: { crosshatch: { shape: 'wave', size: 1.25 } } }).design, 'crosshatch-wavy');
});

test('Harmonograph uses a Structure choice while Starlattice puts Pattern after Look and feel', () => {
  const harmonograph = designById('harmonograph');
  const structure = harmonograph.controls.find((section) => section.key === 'second');
  assert.equal(structure.kind, 'choice');
  assert.deepEqual(structure.options.map(({ label, value }) => [label, value]), [['One curve', false], ['Two curves', true]]);
  assert.equal(harmonograph.shelf, 'flat');
  const star = designById('starlattice');
  assert.ok(star.controls.findIndex((section) => section.kind === 'sliders') < star.controls.findIndex((section) => section.kind === 'pattern'));
});

test('fixed cells cards still generate printable meshes', () => {
  const { machine, material } = defaultProfiles();
  for (const id of ['auxetic', 'honeycomb-flat', 'crosshatch']) {
    const card = designById(id), result = card.generate(machine, material, card.defaults(), {});
    assert.ok(result.gcode.includes('G1'), id);
  }
});
