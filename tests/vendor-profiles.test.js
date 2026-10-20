import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translateGcode, machineFromSettings } from '../src/engine/profile-import.js';
import { validateMachine } from '../src/engine/profiles.js';
import { searchMachines } from '../src/ui/machine-search.js';
import { projectRoot } from './helpers.js';

const LIBRARY = path.join(projectRoot, 'profiles', 'library');
const read = (file) => JSON.parse(fs.readFileSync(path.join(LIBRARY, file), 'utf8'));

const base = {
  bed_shape: '0x0,220x0,220x220,0x220', max_print_height: '250', gcode_flavor: 'marlin2', nozzle_diameter: '0.4',
  end_gcode: 'M104 S0\nM140 S0\nM84',
};

test('no line of a conditional block is kept: every branch would run otherwise', () => {
  const { lines } = translateGcode('G28\n{if nozzle_diameter[0]==0.6}\nM221 S95\n{elsif nozzle_diameter[0]==0.8}\nM221 S90\n{else}\nM221 S100\n{endif}\nG1 Z5\nM104 S200{if is_extruder_used[1]} T1{endif}');
  assert.deepEqual(lines, ['G28', 'G1 Z5']);
});

test('Bambu Studio\'s temperature placeholders are filled like PrusaSlicer\'s', () => {
  const { lines } = translateGcode('M140 S[bed_temperature_initial_layer_single]\nM109 S{nozzle_temperature_initial_layer[initial_extruder]}\nM190 S[hot_plate_temp_initial_layer]');
  assert.deepEqual(lines, ['M140 S{bed_temp}', 'M109 S{first_layer_temp}', 'M190 S{bed_temp}']);
});

test('a Klipper printer keeps its start macro with the temperatures, and its limits stay in its own config', () => {
  const { machine } = machineFromSettings({ ...base, gcode_flavor: 'klipper', start_gcode: 'PRINT_START EXTRUDER=[first_layer_temperature[initial_extruder]] BED=[first_layer_bed_temperature] CHAMBER=[chamber_temperature]\nSYNC_EXTRUDER_MOTION EXTRUDER=slot[initial_tool]', end_gcode: 'PRINT_END' }, { id: 'k', name: 'Klipper box', source: 'test' });
  assert.equal(machine.start_gcode.find((l) => l.startsWith('PRINT_START')), 'PRINT_START EXTRUDER={first_layer_temp} BED={bed_temp}');
  assert.ok(!machine.start_gcode.some((l) => l.startsWith('SYNC_EXTRUDER_MOTION')), 'a macro that would lose an argument it may need is left out');
  assert.deepEqual(machine.end_gcode, ['PRINT_END']);
  assert.equal(machine.limits.emit_to_gcode, false);
});

test('a start block without a purge of its own gets this tool\'s prime line; one with a purge does not', () => {
  const plain = machineFromSettings({ ...base, start_gcode: 'M140 S[first_layer_bed_temperature]\nM104 S[first_layer_temperature]\nM190 S[first_layer_bed_temperature]\nM109 S[first_layer_temperature]\nG28' }, { id: 'a', name: 'A', source: 'test' });
  assert.ok(plain.machine.start_gcode.includes('{prime_line}'));
  const purging = machineFromSettings({ ...base, start_gcode: 'M140 S[first_layer_bed_temperature]\nM190 S[first_layer_bed_temperature]\nM109 S[first_layer_temperature]\nG28\nG1 X2 Y140 E10 F1500 ; prime the nozzle' }, { id: 'b', name: 'B', source: 'test' });
  assert.ok(!purging.machine.start_gcode.includes('{prime_line}'));
});

test('an end block that would travel before lifting (its lift was conditional) rises first', () => {
  const { machine } = machineFromSettings({ ...base, start_gcode: 'M190 S[first_layer_bed_temperature]\nM109 S[first_layer_temperature]\nG28', end_gcode: '{if max_layer_z < max_print_height}G1 Z{z_offset+min(max_layer_z+1, max_print_height)} F720{endif}\nM104 S0\nM140 S0\nG1 X241 Y170 F3600 ; park\nM84' }, { id: 'p', name: 'P', source: 'test' });
  assert.equal(machine.end_gcode[0], 'G1 Z{raise_z} F720 ; lift clear of the print');
  const lifted = machineFromSettings({ ...base, start_gcode: 'M190 S60\nM109 S200\nG28\nG1 X0', end_gcode: 'G1 Z{max_layer_z} F600\nM104 S0\nM140 S0\nG1 X0 Y200' }, { id: 'q', name: 'Q', source: 'test' });
  assert.notEqual(lifted.machine.end_gcode[0], 'G1 Z{raise_z} F720 ; lift clear of the print', 'a block that lifts by itself is left as it is');
});

test('Bambu Studio\'s speed limits (machine_max_speed_*) are read as feed rates', () => {
  const { machine } = machineFromSettings({ ...base, printable_area: ['0x0', '256x0', '256x256', '0x256'], bed_shape: undefined, machine_max_speed_x: ['500', '200'], machine_start_gcode: 'M190 S[bed_temperature_initial_layer_single]\nM109 S[nozzle_temperature_initial_layer]\nG28\nG1 X0' }, { id: 'c', name: 'C', source: 'test' });
  assert.equal(machine.limits.modes.normal.max_feedrate.x, 500);
  assert.equal(machine.limits.modes.stealth.max_feedrate.x, 200);
});

test('the printer library lists only printers its vendor files hold, each one valid, with unique ids', () => {
  const index = read('index.json');
  assert.ok(index.machines.length >= 40, `${index.machines.length} printers`);
  const ids = new Set();
  for (const vendor of index.vendors) {
    const lib = read(vendor.file);
    const byId = new Map(lib.machines.map((m) => [m.id, m]));
    for (const entry of index.machines.filter((m) => m.vendor === vendor.id)) {
      const machine = byId.get(entry.id);
      assert.ok(machine, `${entry.id} is in ${vendor.file}`);
      assert.deepEqual(validateMachine(machine), [], entry.id);
      assert.ok(!ids.has(entry.id), `${entry.id} is listed once`);
      ids.add(entry.id);
      assert.ok(!machine.start_gcode.some((l) => /\{\s*if\b|\[[a-z_]+\]/.test(l)), `${entry.id}: no slicer macro in its start G-code`);
      const travel = machine.end_gcode.findIndex((l) => /^\s*G[01]\b.*\b[XY]-?\d/i.test(l.replace(/;.*$/, '')));
      if (travel >= 0) assert.ok(machine.end_gcode.slice(0, travel + 1).some((l) => /^\s*G[01]\b.*\bZ/i.test(l)), `${entry.id}: the head rises before it parks`);
    }
  }
});

test('the popular printers are there, and a search finds them however they are typed', () => {
  const index = read('index.json');
  const names = (q) => searchMachines(index.machines, q, index.vendors).map((m) => m.name);
  for (const [query, expected] of [
    ['core one', 'Prusa CORE One 0.4 nozzle'],
    ['coreone', 'Prusa CORE One 0.4 nozzle'],
    ['prusa mini', 'Original Prusa MINI & MINI+ Input Shaper'],
    ['x1c', 'Bambu Lab X1 Carbon 0.4 nozzle'],
    ['a1 mini', 'Bambu Lab A1 mini 0.4 nozzle'],
    ['p1s', 'Bambu Lab P1S 0.4 nozzle'],
    ['mk4s', 'Original Prusa MK4S 0.4 nozzle'],
    ['bambu h2d', 'Bambu Lab H2D 0.4 nozzle'],
    ['ender3', 'Creality Ender-3 (0.4 mm nozzle)'],
    ['ender 3 v2', 'Creality Ender-3 V2 (0.4 mm nozzle)'],
    ['ender 3 pro', 'Creality Ender-3 Pro (0.4 mm nozzle)'],
    ['ender 3 s1', 'Creality Ender-3 S1 (0.4 mm nozzle)'],
  ]) assert.ok(names(query).includes(expected), `"${query}" finds ${expected}: ${names(query).slice(0, 5).join(', ')}`);
  // the 0.4 mm nozzle comes before the larger ones of the same printer
  const a1 = names('a1 mini');
  assert.ok(a1.indexOf('Bambu Lab A1 mini 0.4 nozzle') < a1.indexOf('Bambu Lab A1 mini 0.6 nozzle'));
  assert.equal(names('no such printer zzz').length, 0);
});
