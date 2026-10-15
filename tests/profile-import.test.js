import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importProfiles, parseConfigText, translateGcode, ProfileImportError } from '../src/engine/profile-import.js';
import { validateMachine, validateMaterial } from '../src/engine/profiles.js';
import { buildProfileIndex } from '../tools/profiles-index.mjs';
import { generateSquiggle } from '../src/engine/squiggle.js';
import { projectRoot } from './helpers.js';

const fixture = (name) => fs.readFileSync(path.join(projectRoot, 'tests', 'fixtures', name), 'utf8');

test('a PrusaSlicer config export gives a printer and a filament', () => {
  const got = importProfiles(fixture('prusa-config.ini'), 'my-config.ini');
  assert.equal(got.machines.length, 1);
  assert.equal(got.materials.length, 1);
  const m = got.machines[0], f = got.materials[0];
  assert.deepEqual(validateMachine(m), []);
  assert.deepEqual(validateMaterial(f), []);
  assert.deepEqual([m.bed.width, m.bed.depth, m.bed.max_z], [250, 210, 210]);
  assert.equal(m.name, 'My MK3S');
  assert.equal(m.accel_syntax, 'P_R_T');
  assert.equal(m.printer_model_check, 'MK3S');
  // two values are normal and stealth mode
  assert.equal(m.limits.modes.normal.max_feedrate.x, 200);
  assert.equal(m.limits.modes.stealth.max_feedrate.x, 100);
  assert.equal(m.limits.modes.normal.accel_extruding, 1250);
  assert.equal(f.name, 'My TPU 95A');
  assert.equal(f.filament_diameter, 1.75);
  assert.deepEqual(f.temperature, { first_layer: 245, print: 240 });
  assert.equal(f.flow.multiplier, 1.15);
  assert.equal(f.flow.max_volumetric_speed_nominal, 1.2);
  assert.equal(f.retraction.length, 0.8, 'a filament that says nil uses the printer\'s retraction');
  assert.equal(f.retraction.z_hop, 0.4);
  assert.equal(f.flow.foam_expansion, 1, 'what a slicer file cannot say gets a plain default');
});

test('the slicer\'s start G-code is kept where its placeholders can be filled, and the rest is left out', () => {
  const got = importProfiles(fixture('prusa-config.ini'), 'my-config.ini');
  const start = got.machines[0].start_gcode.join('\n');
  assert.match(start, /M104 S\{first_layer_temp\}/);
  assert.match(start, /M140 S\{bed_temp\}/);
  assert.match(start, /\{machine_limits\}/);
  // the printer's own intro line is kept, so this tool's prime line is not drawn on top of it
  assert.match(start, /intro line/);
  assert.doesNotMatch(start, /\{prime_line\}/);
  assert.doesNotMatch(start, /\{if /, 'a slicer macro never reaches the G-code');
  assert.doesNotMatch(start, /\[[a-z_]+\]/, 'no square-bracket placeholder is left');
  assert.ok(got.notes.some((n) => /slicer macros/.test(n)));
  assert.match(got.machines[0].end_gcode.join('\n'), /G1 Z\{raise_z\}/);
});

test('a config bundle gives one profile per section, named as in the slicer', () => {
  const got = importProfiles(fixture('prusa-bundle.ini'), 'bundle.ini');
  assert.deepEqual(got.machines.map((m) => m.name), ['Bench Printer']);
  assert.deepEqual(got.materials.map((m) => m.name), ['Bench TPU']);
  assert.equal(got.machines[0].bed.width, 300);
  assert.equal(got.machines[0].accel_syntax, 'S_T');
  assert.equal(Object.keys(got.machines[0].limits.modes).length, 1, 'one value is one mode');
  assert.equal(got.materials[0].filament_diameter, 2.85);
  assert.equal(got.machines[0].id, 'bench-printer');
});

test('a Bambu Studio printer and filament preset are read too', () => {
  const printer = importProfiles(fixture('bambu-printer.json'), 'bench-x1.json');
  assert.deepEqual([printer.machines[0].bed.width, printer.machines[0].bed.depth, printer.machines[0].bed.max_z], [256, 256, 250]);
  assert.equal(printer.materials.length, 0);
  assert.deepEqual(validateMachine(printer.machines[0]), []);
  assert.ok(printer.machines[0].start_gcode.some((l) => /G28/.test(l)));
  const filament = importProfiles(fixture('bambu-filament.json'), 'bench-tpu.json');
  const f = filament.materials[0];
  assert.deepEqual(validateMaterial(f), []);
  assert.deepEqual(f.temperature, { first_layer: 235, print: 230 });
  assert.equal(f.bed_temperature, 35);
  assert.equal(f.flow.multiplier, 0.98);
  assert.equal(f.flow.max_volumetric_speed_nominal, 3.2);
});

test('the config at the end of a sliced G-code file is a profile too', () => {
  const got = importProfiles(fixture('sliced.gcode'), 'part-0.2mm.gcode');
  assert.equal(got.machines.length, 1);
  assert.equal(got.materials.length, 1);
  assert.equal(got.machines[0].name, 'Sliced On My Printer');
  assert.equal(got.materials[0].temperature.print, 215);
  assert.equal(got.machines[0].bed.depth, 210);
});

test('this tool\'s own profiles go through unchanged', () => {
  const text = fs.readFileSync(path.join(projectRoot, 'profiles', 'machines', 'prusa-mk3s.json'), 'utf8');
  const got = importProfiles(text, 'prusa-mk3s.json');
  assert.deepEqual(got.machines[0], JSON.parse(text));
});

test('a file with nothing in it that is a profile is refused with a plain message', () => {
  assert.throws(() => importProfiles('hello world', 'x.txt'), ProfileImportError);
  assert.throws(() => importProfiles('{"hello": 1}', 'x.json'), /not a printer or filament profile/);
  assert.throws(() => importProfiles('infill_density = 15%\nperimeters = 2', 'print.ini'), /no printer or filament profile/);
  assert.throws(() => importProfiles('bed_shape = 0x0\nstart_gcode = G28', 'x.ini'), /no bed shape/);
});

test('G-code translation keeps what it can fill and drops the rest', () => {
  const { lines, dropped } = translateGcode('M104 S[first_layer_temperature]\nM140 S{first_layer_bed_temperature[0]}\n{if x}M1{endif}\nG28\nM117 [layer_z]');
  assert.deepEqual(lines, ['M104 S{first_layer_temp}', 'M140 S{bed_temp}', 'G28']);
  assert.equal(dropped.length, 2);
});

test('an imported printer and filament build a design end to end', () => {
  const printer = importProfiles(fixture('bambu-printer.json'), 'bench-x1.json').machines[0];
  const filament = importProfiles(fixture('bambu-filament.json'), 'bench-tpu.json').materials[0];
  const r = generateSquiggle(printer, filament, { width: 40, height: 40 });
  assert.ok(r.gcode.includes('; machine: bench-x1-0-4-nozzle'));
  assert.ok(r.moves.some((m) => m.extrude));
  // the prime line is inside this bed: no purge area in front of it
  const prime = r.gcode.split('\n').find((l) => /prime line/.test(l));
  assert.match(prime, /Y1 /);
});

test('the profiles folder index lists every file, and every file is a valid profile', () => {
  const index = buildProfileIndex(projectRoot);
  assert.ok(index.machines.includes('prusa-mk3s.json'));
  assert.ok(index.materials.includes('filaflex-95-foamy.json'));
  const listed = JSON.parse(fs.readFileSync(path.join(projectRoot, 'profiles', 'index.json'), 'utf8'));
  assert.deepEqual(listed, index, 'profiles/index.json is up to date: run node tools/profiles-index.mjs');
  for (const [kind, files] of Object.entries(index)) {
    for (const file of files) {
      const got = importProfiles(fs.readFileSync(path.join(projectRoot, 'profiles', kind, file), 'utf8'), file);
      assert.ok(got.machines.length + got.materials.length > 0, file);
    }
  }
});

test('parseConfigText reads sections and the config trailer of a G-code file', () => {
  const sections = parseConfigText(fixture('prusa-bundle.ini'));
  assert.deepEqual(sections.map((s) => `${s.kind}:${s.name}`), ['presets:', 'printer:Bench Printer', 'filament:Bench TPU']);
  assert.equal(sections[1].values.start_gcode.split('\n').length, 6, 'the \\n of a config line are newlines');
});
