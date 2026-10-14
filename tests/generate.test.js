import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/engine/generate.js';
import { ConfigError } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('20 x 20 default sample: 10 loops, stats are populated', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.equal(r.stats.loops, 10);
  assert.ok(r.stats.filamentMm > 0);
  assert.ok(r.stats.timeSec > 0);
  assert.ok(r.stats.filamentGrams > 0);
  assert.ok(r.stats.maxSlopeDeg > 15 && r.stats.maxSlopeDeg < 18, `${r.stats.maxSlopeDeg}`);
  assert.ok(r.stats.lengthByClass.unsupported > 0);
  assert.match(r.gcode, /; BODY START/);
  assert.equal(r.stats.moves, r.moves.length);
});

test('stats header lines agree with the stats object', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.match(r.gcode, new RegExp(`loops: ${r.stats.loops}\\b`));
  assert.match(r.gcode, /^; estimated time \(no acceleration\): [0-9.]+ min$/m);
});

test('base only has zero loops', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20, include_loops: false });
  assert.equal(r.stats.loops, 0);
  assert.equal(r.stats.maxSlopeDeg, 0);
});

test('Review Focus: a 5 x 5 sample prints the base only, with a warning', () => {
  const r = generate(machine, material, { sample_width: 5, sample_height: 5 });
  assert.equal(r.stats.loops, 0);
  assert.ok(r.warnings.some((w) => /no loops fit/i.test(w)));
  assert.ok(r.moves.length > 0);
});

test('nothing selected still returns a valid (empty) result with a warning', () => {
  const r = generate(machine, material, { include_base: false, include_loops: false });
  assert.equal(r.moves.length, 0);
  assert.ok(r.warnings.some((w) => /nothing to print/i.test(w)));
});

test('Review Focus: invalid parameters surface as ConfigError, not a crash', () => {
  assert.throws(() => generate(machine, material, { base_spacing: NaN }), ConfigError);
});

test('same inputs give byte-identical G-code; a changed seed with randomness on changes it', () => {
  const a = generate(machine, material, { sample_width: 20, sample_height: 20 });
  const b = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.equal(a.gcode, b.gcode);
  const over = { sample_width: 20, sample_height: 20, random_enabled: true, amp_xy: 0.4, amp_length: 1 };
  const c = generate(machine, material, { ...over, random_seed: 1 });
  const d = generate(machine, material, { ...over, random_seed: 2 });
  assert.notEqual(c.gcode, d.gcode);
});
