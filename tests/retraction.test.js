import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/engine/params.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, retractingMaterial } from './helpers.js';

const { machine, material } = defaultProfiles();

test('Filaflex Foamy disables retraction in the filament profile and retains the supplied reference speeds', () => {
  const r = resolveConfig(machine, material).derived.retraction;
  assert.equal(r.length, 0);
  assert.equal(r.restartExtra, 0);
  assert.equal(r.speed, 35);
  assert.equal(r.deretractSpeed, 25);
  assert.equal(r.minTravel, 1);
});

test('choosing a zero threshold retracts before every separated strand and primes before printing', () => {
  // Islands require real travels now that a plain rectangle keeps both mesh passes continuous.
  const outline = Array.from({ length: 6 }, (_, i) => { const x = i * 6.5; return [{ x, y: 0 }, { x: x + 3.5, y: 0 }, { x: x + 3.5, y: 40 }, { x, y: 40 }]; });
  const active = retractingMaterial(material);
  const r = generateDesignExport({ machine, material: { ...active, retraction: { ...active.retraction, min_travel: 0 } }, design: 'zigzag', settings: designById('zigzag').defaults(), width: 40, height: 40, outline, extraLayers: 0, brim: 0 });
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
  assert.match(r.gcode, /^G1 E-1 F2400$/m);
  assert.match(r.gcode, /^G1 E1 F1200$/m);
});

test('a move can carry its own retraction, so swatches with different settings can share one print', async () => {
  const { writeGcode } = await import('../src/engine/gcode.js');
  const { computeStats } = await import('../src/engine/stats.js');
  const cfg = resolveConfig(machine, retractingMaterial(material), { sample_width: 40, sample_height: 20 });
  const own = { ...cfg.derived.retraction, length: 3, speed: 50, restartExtra: 0.5 };
  const moves = [
    { x: 0, y: 0, z: 0.2, cls: 'travel', extrude: false },
    { x: 10, y: 0, z: 0.2, cls: 'base', extrude: true, tag: 'a' },
    { x: 10, y: 0, z: 3, cls: 'travel', extrude: false, retract: 'retract', retraction: own },
    { x: 20, y: 0, z: 0.2, cls: 'travel', extrude: false, retraction: own },
    { x: 30, y: 0, z: 0.2, cls: 'base', extrude: true, tag: 'b', retract: 'unretract', retraction: own },
    { x: 30, y: 0, z: 3, cls: 'travel', extrude: false, retract: 'retract' },
    { x: 35, y: 10, z: 0.2, cls: 'travel', extrude: false },
    { x: 38, y: 10, z: 0.2, cls: 'base', extrude: true, tag: 'c', retract: 'unretract' },
  ];
  const gcode = writeGcode(moves, cfg);
  assert.match(gcode, /^G1 E-3 F3000$/m, 'its own: 3 mm at 50 mm/s');
  assert.match(gcode, /^G1 E3\.5 F1200$/m, 'pushed back 3 + 0.5');
  assert.match(gcode, /^G1 E-1 F2400$/m, 'the filament\'s again for a move without its own');
  assert.match(gcode, /^G1 E1 F1200$/m);
  const plain = computeStats(moves.map(({ retraction, ...m }) => m), cfg, []), mixed = computeStats(moves, cfg, []);
  assert.ok(Math.abs(mixed.filamentMm - plain.filamentMm - 0.5) < 1e-9, 'its extra push counts as filament (0.5 mm, where the filament has none)');
});
