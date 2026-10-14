import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, ConfigError, DEFAULT_TEXTILE, startPosition, PRIME } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('defaults resolve against MK3S + Foamy', () => {
  const cfg = resolveConfig(machine, material);
  assert.equal(cfg.derived.rowPitch, 5);
  assert.ok(Math.abs(cfg.derived.maxVolActual - 3.65) < 1e-9);
  assert.equal(cfg.derived.loopBaseZ, 0.4);
  assert.deepEqual(cfg.derived.origin, { x: 75, y: 55 });
  assert.equal(cfg.derived.limitsMode, 'normal');
  assert.equal(cfg.derived.limits.max_feedrate.z, 12);
  assert.equal(cfg.derived.freeDiameter, 0.4);
  assert.equal(cfg.derived.retraction.length, 0);
  assert.equal(cfg.derived.temperatures.first, 248);
});

test('overrides win and nulls fall back to the material', () => {
  const cfg = resolveConfig(machine, material, { retraction_length: 4, free_strand_diameter: 0.5, limits_mode: 'stealth' });
  assert.equal(cfg.derived.retraction.length, 4);
  assert.equal(cfg.derived.freeDiameter, 0.5);
  assert.equal(cfg.derived.limitsMode, 'stealth');
  assert.equal(cfg.derived.limits.max_feedrate.x, 100);
});

test('start position is the end of the prime line in sample coordinates', () => {
  const cfg = resolveConfig(machine, material);
  assert.deepEqual(startPosition(cfg), { x: PRIME.x1 - 75, y: PRIME.y - 55, z: PRIME.liftZ });
});

test('a sample bigger than the bed still resolves (preflight rejects it later)', () => {
  const cfg = resolveConfig(machine, material, { sample_width: 300 });
  assert.equal(cfg.derived.origin.x, -25);
});

test('invalid parameters throw ConfigError listing every problem', () => {
  assert.throws(
    () => resolveConfig(machine, material, { loop_pitch: 0, sample_width: -5, z_profile: 'nope', loop_width: NaN, random_seed: 1.5 }),
    (e) => {
      assert.ok(e instanceof ConfigError);
      for (const key of ['loop_pitch', 'sample_width', 'z_profile', 'loop_width', 'random_seed']) {
        assert.ok(e.errors.some((m) => m.includes(key)), `missing error for ${key}: ${e.errors.join(' | ')}`);
      }
      return true;
    }
  );
});

test('relationship checks: cap needs room, dwell must fit', () => {
  assert.throws(() => resolveConfig(machine, material, { loop_length: 2, loop_width: 6 }), /loop_length/);
  assert.throws(() => resolveConfig(machine, material, { anchor_dwell: 8 }), /anchor_dwell/);
});

test('blank UI values (null/undefined/strings) are rejected, not coerced', () => {
  assert.throws(() => resolveConfig(machine, material, { base_spacing: null }), /base_spacing/);
  assert.throws(() => resolveConfig(machine, material, { base_spacing: '5' }), /base_spacing/);
  assert.throws(() => resolveConfig(machine, material, { include_base: 'yes' }), /include_base/);
});

test('DEFAULT_TEXTILE is frozen', () => {
  assert.ok(Object.isFrozen(DEFAULT_TEXTILE));
});

test('flow in the air defaults to 100 % and must stay between 50 and 300 %', () => {
  const cfg = resolveConfig(machine, material, {});
  assert.equal(cfg.t.flow_nonplanar, 100);
  assert.equal(cfg.t.flow_unsupported, 100);
  for (const bad of [49, 301, NaN, '120', null]) {
    assert.throws(() => resolveConfig(machine, material, { flow_unsupported: bad }), (e) => e instanceof ConfigError && /flow_unsupported/.test(e.message), String(bad));
  }
  assert.doesNotThrow(() => resolveConfig(machine, material, { flow_nonplanar: 50, flow_unsupported: 300 }));
});

test('loops that reach past the back edge are centred on the bed with the swatch, and refused when they cannot fit', async () => {
  const { bedFitErrors } = await import('../src/engine/gcode.js');
  const { machine, material } = (await import('./helpers.js')).defaultProfiles();
  const inside = resolveConfig(machine, material, { sample_width: 200, sample_height: 190, boundary_policy: 'feet-only', loop_length: 15 });
  assert.equal(inside.derived.overhang, 15);
  assert.equal(inside.derived.origin.y, (210 - 190 - 15) / 2);
  assert.deepEqual(bedFitErrors(inside), []);
  const flat = resolveConfig(machine, material, { sample_width: 200, sample_height: 200, boundary_policy: 'footprint' });
  assert.equal(flat.derived.overhang, 0);
  assert.deepEqual(bedFitErrors(flat), []);
  const over = resolveConfig(machine, material, { sample_width: 200, sample_height: 200, boundary_policy: 'feet-only', loop_length: 15 });
  assert.match(bedFitErrors(over)[0], /15 mm past the back edge/);
});
