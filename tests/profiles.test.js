import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateMachine, validateMaterial } from '../src/engine/profiles.js';
import { projectRoot, loadProfile } from './helpers.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { moveSpeed, volumePerMm } from '../src/engine/extrusion.js';

const index = JSON.parse(fs.readFileSync(path.join(projectRoot, 'profiles', 'index.json'), 'utf8'));

const stem = (file) => file.replace(/\.[^.]+$/, '');

test('every machine in profiles/index.json is valid', () => {
  assert.ok(index.machines.length >= 1);
  for (const id of index.machines.map(stem)) {
    const errors = validateMachine(loadProfile('machines', id));
    assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
  }
});

test('every material in profiles/index.json is valid', () => {
  assert.ok(index.materials.length >= 2);
  for (const id of index.materials.map(stem)) {
    const errors = validateMaterial(loadProfile('materials', id));
    assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
  }
});

test('the added filaments load through the public index and apply heat, cooling, retraction, and flow limits', () => {
  const machine = loadProfile('machines', 'prusa-mk3s');
  for (const [id, first, printing, bed, fan, retract] of [
    ['ninjatek-ninjaflex-85a', 238, 238, 50, 60, 2.5],
    ['generic-tpe', 240, 240, 50, 0, 0],
    ['generic-pla', 215, 210, 60, 100, 0.8],
  ]) {
    assert.ok(index.materials.includes(`${id}.json`), `${id} is selectable`);
    const material = loadProfile('materials', id);
    const { cfg, gcode } = generateDesignExport({ machine, material, design: 'crosshatch', width: 20, height: 20 });
    assert.match(gcode, new RegExp(`M109 S${first}\\b`), id);
    assert.match(gcode, new RegExp(`M190 S${bed}\\b`), id);
    if (first !== printing) assert.match(gcode.split('; BODY START')[1], new RegExp(`M104 S${printing}\\b`), id);
    assert.equal(cfg.t.fan_base, 0, 'the bed paths retain adhesion');
    assert.equal(cfg.t.fan_supported, fan);
    if (fan) assert.ok(gcode.includes(`M106 S${Math.round(fan * 255 / 100)}`), `${id} actually enables cooling`);
    else assert.ok(!gcode.includes('M106'), `${id} keeps cooling disabled`);
    assert.equal(cfg.derived.retraction.length, retract);
    if (retract) assert.match(gcode, new RegExp(`G1 E-${retract}\\b`), id);
    else assert.ok(!gcode.includes('G1 E-'), `${id} keeps retraction disabled`);
    for (const cls of ['base', 'supported', 'rising', 'unsupported']) {
      const volume = moveSpeed(cls, 1, 0, 0, cfg) * volumePerMm(cls, cfg);
      assert.ok(volume <= cfg.derived.maxVolActual + 1e-9, `${id} ${cls} respects its flow cap`);
    }
    assert.equal(material.flow.foam_expansion, 1);
    assert.equal(material.provenance.physically_verified, false);
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
