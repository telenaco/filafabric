import test from 'node:test';
import assert from 'node:assert/strict';
import { FILAMENT_FIELDS, filamentValue, withFilamentSettings, sanitizeFilamentSettings, setFilamentSetting } from '../src/ui/filament-settings.js';
import { sanitizePrint } from '../src/ui/share.js';
import { resolveConfig } from '../src/engine/params.js';
import { writeGcode } from '../src/engine/gcode.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('each setting shows the filament\'s own value until it is changed', () => {
  assert.deepEqual(FILAMENT_FIELDS.map((f) => [f.key, filamentValue(material, {}, f.key)]), [
    ['firstLayerTemp', 238], ['nozzleTemp', 238], ['bedTemp', 50], ['retraction', 1], ['retractSpeed', 40], ['primeExtra', 0], ['seamGap', 0.2], ['travelLift', 0.2],
  ]);
  assert.equal(withFilamentSettings(material, {}), material, 'nothing changed: the same filament');
});

test('changed temperatures and retraction reach the G-code', () => {
  const changed = withFilamentSettings(material, { firstLayerTemp: 245, nozzleTemp: 240, bedTemp: 60, retraction: 3, retractSpeed: 50, primeExtra: 0.3 });
  assert.equal(material.temperature.print, 238, 'the profile itself is untouched');
  const cfg = resolveConfig(machine, changed);
  assert.deepEqual(cfg.derived.temperatures, { first: 245, print: 240, bed: 60 });
  assert.equal(cfg.derived.retraction.length, 3);
  assert.equal(cfg.derived.retraction.restartExtra, 0.3);
  assert.equal(cfg.derived.retraction.speed, 50);
  const gcode = writeGcode([
    { x: 0, y: 0, z: 0.2, cls: 'travel', extrude: false },
    { x: 10, y: 0, z: 0.2, cls: 'base', extrude: true },
    { x: 10, y: 0, z: 3, cls: 'travel', extrude: false, retract: 'retract' },
    { x: 20, y: 0, z: 0.2, cls: 'travel', extrude: false },
    { x: 30, y: 0, z: 0.2, cls: 'base', extrude: true, retract: 'unretract' },
    { x: 30, y: 10, z: 0.4, cls: 'supported', extrude: true },
  ], cfg);
  assert.match(gcode, /^M109 S245/m);
  assert.match(gcode, /^M190 S60/m);
  assert.match(gcode, /^M104 S240 ; printing temperature$/m);
  assert.match(gcode, /^G1 E-3 F3000$/m, '3 mm at 50 mm/s');
  assert.match(gcode, /^G1 E3\.3 F1200$/m, 'pushed back 3 + 0.3 mm, at Foamy\'s 20 mm/s');
});

test('a value the same as the filament\'s, empty or out of range, is no change', () => {
  let print = {};
  print = setFilamentSetting(print, material, 'nozzleTemp', 230);
  assert.equal(print.nozzleTemp, 230);
  print = setFilamentSetting(print, material, 'nozzleTemp', 238);
  assert.equal('nozzleTemp' in print, false, 'back to the filament\'s value');
  print = setFilamentSetting(print, material, 'retraction', 0);
  assert.equal(print.retraction, 0, 'retraction can be switched off');
  assert.equal('bedTemp' in setFilamentSetting({}, material, 'bedTemp', null), false);
  assert.deepEqual(sanitizeFilamentSettings({ firstLayerTemp: 400, nozzleTemp: '235', bedTemp: -1, retraction: 99, other: 1 }), { nozzleTemp: 235 });
});

test('the changes travel in a link or a saved file with the rest of the print setup', () => {
  const clean = sanitizePrint({ layerHeight: 0.2, extraLayers: 0, brim: 2, nozzleTemp: 240, retraction: 3 });
  assert.equal(clean.nozzleTemp, 240);
  assert.equal(clean.retraction, 3);
  assert.equal('bedTemp' in sanitizePrint({}), false, 'nothing changed: nothing stored');
});
