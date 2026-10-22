import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { importProfiles, machineFromSettings } from '../src/engine/profile-import.js';
import { validateMachine } from '../src/engine/profiles.js';
import { resolveConfig } from '../src/engine/params.js';
import { writeGcode } from '../src/engine/gcode.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const { machine, material } = defaultProfiles();
const start = 'M104 S[first_layer_temperature]\\nM140 S[first_layer_bed_temperature]\\nM109 S[first_layer_temperature]\\nG28\\nM221 S{if layer_height<0.075}100{else}95{endif}\\n{if print_settings_id=~/.*(DETAIL @MK3|QUALITY @MK3).*/}M907 E430 ; set extruder motor current{endif}\\n{if print_settings_id=~/.*(SPEED @MK3|DRAFT @MK3).*/}M907 E538 ; set extruder motor current{endif}';
const end = 'M104 S0\\nM140 S0\\n{if print_settings_id=~/.*(DETAIL @MK3|QUALITY @MK3|@0.25 nozzle MK3).*/}M907 E538 ; reset extruder motor current{endif}\\nM84';
const source = (preset = '0.20mm SPEED @MK3', prefix = '') => prefix + `bed_shape = 0x0,250x0,250x210,0x210\nmax_print_height = 210\nnozzle_diameter = 0.4\nlayer_height = 0.2\nprinter_model = MK3S\nprinter_settings_id = Reference MK3S\nprint_settings_id = ${preset}\ngcode_flavor = marlin\nstart_gcode = ${start}\nend_gcode = ${end}\n`;
const imported = (text) => importProfiles(text, 'reference.ini').machines[0];
const body = [{ x: 0, y: 0, z: 0.2, cls: 'travel', extrude: false }, { x: 10, y: 0, z: 0.2, cls: 'base', extrude: true }];
const commands = (gcode, code) => gcode.split('\n').filter(l => new RegExp(`^${code}\\b`).test(l)).map(l => l.split(';')[0].trim());

test('MK3S current comes from its explicit profile and restores 538 deterministically', () => {
  assert.deepEqual(machine.motor_current, { command: 'M907', extruder: 538, restore_extruder: 538 });
  assert.equal(machine.extrusion.flow_multiplier, 0.95);
  const gcode = writeGcode(body, resolveConfig(machine, material));
  assert.deepEqual(commands(gcode, 'M907'), ['M907 E538', 'M907 E538']);
  const setup = JSON.parse(gcode.split('\n').find(l => l.startsWith('; resolved print setup ')).slice('; resolved print setup '.length));
  assert.deepEqual(setup.motorCurrent, machine.motor_current);
  assert.equal(setup.machineFlowMultiplier, 0.95);
  const changed = { ...machine, motor_current: { command: 'M907', extruder: 500, restore_extruder: 550 } };
  assert.deepEqual(commands(writeGcode(body, resolveConfig(changed, material)), 'M907'), ['M907 E500', 'M907 E550']);
});

test('config imports select SPEED and QUALITY current branches using the actual print preset', () => {
  const speed = imported(source());
  const quality = imported(source('0.20mm QUALITY @MK3'));
  assert.deepEqual(speed.motor_current, { command: 'M907', extruder: 538, restore_extruder: 538 });
  assert.deepEqual(quality.motor_current, { command: 'M907', extruder: 430, restore_extruder: 538 });
  assert.equal(speed.extrusion.flow_multiplier, 0.95);
  assert.deepEqual(commands(writeGcode(body, resolveConfig(speed, material)), 'M907'), ['M907 E538', 'M907 E538']);
  assert.deepEqual(commands(writeGcode(body, resolveConfig(quality, material)), 'M907'), ['M907 E430', 'M907 E538']);
  assert.equal(imported(source().replace('layer_height = 0.2', 'layer_height = 0.05')).extrusion.flow_multiplier, 1);
});

test('concrete sliced startup wins over conflicting footer macros and later reset commands', () => {
  const config = source('0.20mm QUALITY @MK3').trim().split('\n').map(l => '; ' + l).join('\n');
  const sliced = '; M907 E999 is only a comment\nM104 S240\nG28\nM907 E538 ; actual startup\nM221 S95\n;LAYER_CHANGE\nG1 X10 E1\nM907 E600 ; actual restore\n; prusaslicer_config = begin\n' + config + '\n; prusaslicer_config = end';
  const got = importProfiles(sliced, 'sliced.gcode').machines[0];
  assert.deepEqual(got.motor_current, { command: 'M907', extruder: 538, restore_extruder: 600 });
  assert.equal(got.extrusion.flow_multiplier, 0.95);
  assert.deepEqual(commands(writeGcode(body, resolveConfig(got, material)), 'M907'), ['M907 E538', 'M907 E600']);
});

test('active bundle print preset supplies the current condition context', () => {
  const bundle = '[presets]\nprinter = Bench\nprint = 0.20mm QUALITY @MK3\n[print:0.20mm QUALITY @MK3]\nlayer_height = 0.2\n[printer:Bench]\n' + source().replace(/^print_settings_id = .*\n/m, '');
  assert.equal(imported(bundle).motor_current.extruder, 430);
});

test('no explicit source M907 means no current command for generic or Bambu printers', () => {
  const unknown = imported(source('Unknown').replace(/^print_settings_id = .*\n/m, ''));
  assert.equal(unknown.motor_current, undefined);
  assert.deepEqual(commands(writeGcode(body, resolveConfig(unknown, material)), 'M907'), []);
  const bambu = importProfiles(fs.readFileSync(`${projectRoot}/tests/fixtures/bambu-printer.json`, 'utf8'), 'bambu.json').machines[0];
  assert.equal(bambu.motor_current, undefined);
  assert.deepEqual(commands(writeGcode(body, resolveConfig(bambu, material)), 'M907'), []);
});

test('machine settings API imports unconditional current and validates supported current format', () => {
  const values = Object.fromEntries(source().trim().split('\n').map(l => { const i = l.indexOf(' = '); return [l.slice(0, i), l.slice(i + 3).replaceAll('\\n', '\n')]; }));
  values.start_gcode = 'M104 S240\nM109 S240\nG28\nM907 E510';
  const got = machineFromSettings(values, { id: 'bench', name: 'Bench', source: 'test' }).machine;
  assert.equal(got.motor_current.extruder, 510);
  for (const motor_current of [null, {}, { command: 'M906', extruder: 538 }, { command: 'M907', extruder: -1 }, { command: 'M907', extruder: 538, restore_extruder: NaN }]) {
    assert.ok(validateMachine({ ...machine, motor_current }).some(e => /motor_current/.test(e)), JSON.stringify(motor_current));
  }
  assert.deepEqual(validateMachine({ ...machine, motor_current: undefined }), []);
});

test('material import keeps explicit first-layer width, zero retract and actual return speed', () => {
  const config = source() + 'filament_diameter = 1.75\ntemperature = 240\nextrusion_multiplier = 1.15\nfirst_layer_extrusion_width = 0.42\nfilament_retract_length = 0\nretract_length = 4\nretract_speed = 60\nderetract_speed = 25\nretract_lift = 0.2\n';
  const got = importProfiles(config, 'reference.ini').materials[0];
  assert.equal(got.print_defaults.extrusion_width, 0.42);
  assert.equal(got.retraction.length, 0);
  assert.equal(got.retraction.deretract_speed, 25);
  assert.equal(got.retraction.lift_on_retract_only, true);
  assert.equal(importProfiles(config + 'filament_deretract_speed = 20\n', 'reference.ini').materials[0].retraction.deretract_speed, 20);
  assert.equal(importProfiles(config.replace('deretract_speed = 25', 'deretract_speed = 0'), 'reference.ini').materials[0].retraction.deretract_speed, 60);
  for (const width of ['0', '120%']) assert.equal(importProfiles(config.replace('first_layer_extrusion_width = 0.42', `first_layer_extrusion_width = ${width}`), 'reference.ini').materials[0].print_defaults?.extrusion_width, undefined);
});

test('an imported numeric M221 is applied once in E while startup firmware flow stays at 100', () => {
  const config = source().replace('M221 S{if layer_height<0.075}100{else}95{endif}', 'M221 S95');
  const got = imported(config), gcode = writeGcode(body, resolveConfig(got, material));
  assert.equal(got.extrusion.flow_multiplier, 0.95);
  assert.deepEqual(commands(gcode, 'M221').filter(l => /\bS/.test(l)), ['M221 S100']);
  const noStartup = imported(config.replace(/^start_gcode = .*\n/m, 'start_gcode = M221 S95\n'));
  assert.equal(noStartup.extrusion.flow_multiplier, 0.95);
  assert.ok(noStartup.start_gcode.some(l => /^M221 S100\b/.test(l)));
});
