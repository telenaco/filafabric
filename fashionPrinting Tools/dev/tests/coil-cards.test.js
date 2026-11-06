import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { COIL_DEFAULTS, COIL_PRESETS, coilParams, sanitizeCoil } from '../../site/src/ui/coil-controls.js';
import { generateCoil } from '../../site/src/engine/coil.js';
import { migrateState } from '../../site/src/ui/library.js';
import { defaultProfiles } from './helpers.js';

test('Coil is fixed to looped rows; the Figure-8 card has its own settings key', () => {
  const coil = designById('coil'), figure8 = designById('figure8-rows');
  assert.equal(coil.name, 'Looped rows · raised');
  assert.equal(coil.sanitize({ shape: 'zigzag' }).shape, 'looped');
  assert.equal(coil.controls.some((section) => section.kind === 'shape'), false);
  assert.deepEqual(coil.presets.map((preset) => preset.id), ['open-chain', 'overlapping', 'dense']);
  assert.equal(figure8.settingsKey, 'figure8-rows');
  assert.equal(figure8.defaults().shape, 'figure8');
  assert.equal(figure8.sanitize({ ...COIL_DEFAULTS, shape: 'wave' }).shape, 'figure8');
  assert.equal(figure8.joins, 'One strand in rows of figure-8s; each touches the next row.');
});

test('new Coil cards preserve the former generator output for their fixed shapes', () => {
  const { machine, material } = defaultProfiles();
  for (const [id, shape] of [['coil', 'looped'], ['figure8-rows', 'figure8']]) {
    const card = designById(id);
    const settings = card.sanitize({ ...COIL_DEFAULTS, width: 60, height: 40, shape, pattern: 'none' });
    const before = generateCoil(machine, material, coilParams({ ...sanitizeCoil(settings), shape }));
    const after = card.generate(machine, material, settings, {});
    assert.equal(after.gcode, before.gcode, id);
  }
});

test('old Coil links route to the fixed or compatibility card by their shape', () => {
  const expected = new Map([
    ['looped', 'coil'], ['figure8', 'figure8-rows'], ['wave', 'coil-shapes'], ['zigzag', 'coil-shapes'],
    ['square', 'coil-shapes'], ['honeycomb', 'coil-shapes'], ['ring', 'coil-shapes'],
  ]);
  for (const [shape, design] of expected) {
    const migrated = migrateState({ v: 4, design: 'coil', designs: { coil: { shape, size: 3 } } });
    assert.equal(migrated.design, design, shape);
    assert.equal(migrated.designs[design].shape, shape === 'looped' ? 'looped' : shape, shape);
  }
  const hidden = designById('coil-shapes');
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.sanitize({ shape: 'ring' }).shape, 'ring');
  assert.ok(DESIGNS.includes(hidden));
});

test('every hidden legacy shape remains supported with byte-identical generator output', () => {
  const { machine, material } = defaultProfiles();
  for (const shape of ['wave', 'zigzag', 'square', 'honeycomb', 'ring']) {
    const card = designById('coil-shapes');
    assert.ok(card.shapes.includes(shape), shape);
    const settings = card.sanitize({ ...COIL_DEFAULTS, shape, width: 55, height: 35 });
    const hash = (result) => createHash('sha256').update(result.gcode).digest('hex');
    assert.equal(hash(card.generate(machine, material, settings, {})),
      hash(generateCoil(machine, material, coilParams(sanitizeCoil(settings)))), shape);
  }
  assert.ok(COIL_PRESETS.some((preset) => preset.id === 'zigzag-cells'));
});
