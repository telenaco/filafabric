import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateMachine, validateMaterial } from '../src/engine/profiles.js';
import { projectRoot, loadProfile } from './helpers.js';

const index = JSON.parse(fs.readFileSync(path.join(projectRoot, 'profiles', 'index.json'), 'utf8'));

test('every machine in profiles/index.json is valid', () => {
  assert.ok(index.machines.length >= 1);
  for (const id of index.machines) {
    const errors = validateMachine(loadProfile('machines', id));
    assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
  }
});

test('every material in profiles/index.json is valid', () => {
  assert.ok(index.materials.length >= 2);
  for (const id of index.materials) {
    const errors = validateMaterial(loadProfile('materials', id));
    assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
  }
});

test('validators reject broken profiles', () => {
  const m = loadProfile('machines', 'prusa-mk3s');
  m.bed.width = -1;
  m.extrusion.relative_e = false;
  delete m.limits.modes.normal.max_feedrate.z;
  const errors = validateMachine(m);
  assert.ok(errors.some((e) => /bed\.width/.test(e)));
  assert.ok(errors.some((e) => /relative_e/.test(e)));
  assert.ok(errors.some((e) => /max_feedrate\.z/.test(e)));

  const mat = loadProfile('materials', 'filaflex-95-foamy');
  mat.flow.multiplier = 0;
  mat.temperature.print = 999;
  const matErrors = validateMaterial(mat);
  assert.ok(matErrors.some((e) => /flow\.multiplier/.test(e)));
  assert.ok(matErrors.some((e) => /temperature\.print/.test(e)));
});
