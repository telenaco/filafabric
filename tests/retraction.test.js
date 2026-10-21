import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/engine/params.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('Filaflex Foamy retracts 4 mm at 65 mm/s on every travel, however short, and pushes the same 4 mm back', () => {
  const r = resolveConfig(machine, material).derived.retraction;
  assert.equal(r.length, 4);
  assert.equal(r.restartExtra, 0, 'an extra push left a blob at every start (6 out, 7 back)');
  assert.equal(r.speed, 65, 'Recreus\'s Foamy speed');
  assert.equal(r.minTravel, 0);
});

test('every travel between strands of a design retracts first and primes again before printing', () => {
  const r = generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: 40, height: 40, extraLayers: 0, brim: 0 });
  let travels = 0, open = false;
  for (let i = 1; i < r.moves.length; i++) {
    const m = r.moves[i], prev = r.moves[i - 1];
    if (!m.extrude && prev.extrude) {
      travels++;
      assert.equal(m.retract, 'retract', `the travel after move ${i - 1} retracts`);
    }
    if (m.retract === 'retract') { assert.ok(!open, 'no second retraction before priming'); open = true; }
    if (m.retract === 'unretract') { assert.ok(open, 'a prime follows a retraction'); open = false; }
    if (m.extrude && prev && !prev.extrude && i > 2) assert.ok(!open, `move ${i} prints with the filament primed`);
  }
  assert.ok(travels > 10, 'the mesh has travels to check');
  assert.match(r.gcode, /^G1 E-4 F3900$/m);
  assert.match(r.gcode, /^G1 E4 F1500$/m);
});
