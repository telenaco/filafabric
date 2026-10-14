import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, ConfigError } from '../src/engine/params.js';
import { generate } from '../src/engine/generate.js';
import { PreflightError } from '../src/engine/gcode.js';
import { writeGcode } from '../src/engine/gcode.js';
import { plan } from '../src/engine/planner.js';
import { tile } from '../src/engine/tiler.js';
import { createRng } from '../src/engine/rng.js';
import { defaultProfiles } from './helpers.js';
import { scene } from './scene.js';

const { machine, material } = defaultProfiles();

test('bounds: absurd or degenerate values are refused instead of hanging or exhausting memory', () => {
  const bad = [
    { nozzle_cone_half_angle: 90 },
    { nozzle_cone_half_angle: 120 },
    { curve_resolution: 0.002 },
    { sample_width: 5000 },
    { retraction_length: 60 },
    { retraction_speed: 500 },
    { speed_travel: 5000 },
  ];
  for (const over of bad) {
    assert.throws(() => resolveConfig(machine, material, over), ConfigError, JSON.stringify(over));
  }
  assert.doesNotThrow(() => resolveConfig(machine, material, { nozzle_cone_half_angle: 60, curve_resolution: 0.1, sample_width: 240 }));
});

test('the bed-fit check runs before tiling, so the message is about the bed', () => {
  assert.throws(
    () => generate(machine, material, { sample_width: 300, sample_height: 300 }),
    (e) => e instanceof PreflightError && /does not fit the bed/.test(e.message)
  );
  assert.throws(() => generate(machine, material, { sample_width: 10000, sample_height: 10000, include_loops: false }), ConfigError);
});

test('a tiny curve resolution is refused before any moves are generated', () => {
  const t0 = Date.now();
  assert.throws(
    () => generate(machine, material, { curve_resolution: 0.05 }),
    (e) => e instanceof ConfigError && /moves/.test(e.message)
  );
  assert.ok(Date.now() - t0 < 2000, 'refusal should be immediate');
});

test('the prime line purges a useful amount within the volumetric limit', () => {
  const s = scene({ sample_width: 20, sample_height: 20 });
  const planned = plan(s.cfg, s.base, s.tiled.placements, s.boundary);
  const gcode = writeGcode(planned.moves, s.cfg);
  const line = gcode.split('\n').find((l) => l.includes('; prime line'));
  const m = /^G1 X(\S+) Y(\S+) E(\S+) F(\S+)/.exec(line);
  assert.ok(m, `prime line not found: ${line}`);
  const e = Number(m[3]);
  const f = Number(m[4]);
  assert.ok(e >= 15, `prime extrudes only ${e} mm of filament`);
  const length = 100 - 20;
  const volumePerMm = (e * Math.PI * 0.875 ** 2) / length;
  assert.ok((f / 60) * volumePerMm <= s.cfg.derived.maxVolActual + 0.01, 'prime flow exceeds the material limit');
});

test('randomness that breaks the leg gap is reported, not silent', () => {
  const s = scene({ sample_width: 30, sample_height: 30, random_enabled: true, amp_xy: 0.5, include_loops: false });
  const { warnings } = tile(s.cfg, s.boundary, createRng(3));
  assert.ok(warnings.some((w) => /closer than the .* leg gap/i.test(w)), warnings.join(' | '));
});

test('the clearance warning names the usual causes so the count is read correctly', () => {
  const s = scene({ sample_width: 20, sample_height: 20 });
  const result = plan(s.cfg, s.base, s.tiled.placements, s.boundary);
  assert.ok(result.violations > 0);
  assert.ok(result.warnings.some((w) => /cross/i.test(w) && /nozzle tip/i.test(w)), result.warnings.join(' | '));
});
