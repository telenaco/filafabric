import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/engine/params.js';
import {
  filamentArea, roundedRectArea, roundArea, strandArea, volumePerMm, segmentE, classTargetSpeed, moveSpeed, EXTRUDING,
  airStrandDiameter,
} from '../src/engine/extrusion.js';
import { defaultProfiles, loadProfile } from './helpers.js';

const { machine, material } = defaultProfiles();
const cfgFor = (over = {}, mat = material) => resolveConfig(machine, mat, over);
const near = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('areas', () => {
  near(filamentArea(1.75), 2.405282, 1e-5);
  near(roundedRectArea(0.45, 0.2), 0.2 * (0.45 - 0.2 * (1 - Math.PI / 4)), 1e-9);
  near(roundArea(0.4), Math.PI * 0.04, 1e-9);
});

test('E matches the real PrusaSlicer move: 100 mm, 0.42 x 0.2, multiplier 1.15 => E3.60574', () => {
  const generic = loadProfile('materials', 'generic-flex-mk3');
  const cfg = cfgFor({ extrusion_width: 0.42 }, generic);
  near(segmentE(100, 'base', cfg), 3.60574, 1e-4);
});

test('E uses true 3D distance', () => {
  const cfg = cfgFor();
  const perMm = segmentE(1, 'rising', cfg);
  near(segmentE(Math.hypot(3, 0, 4), 'rising', cfg), 5 * perMm, 1e-9);
  assert.ok(segmentE(5, 'rising', cfg) > segmentE(3, 'rising', cfg));
});

test('strand area per class', () => {
  const cfg = cfgFor();
  assert.equal(strandArea('base', cfg), strandArea('supported', cfg));
  near(strandArea('unsupported', cfg), roundArea(0.4), 1e-9);
  near(volumePerMm('base', cfg), roundedRectArea(0.45, 0.2) * 0.73, 1e-9);
});

test('class target speeds come from the parameters', () => {
  const t = cfgFor().t;
  assert.equal(classTargetSpeed('base', t), 15);
  assert.equal(classTargetSpeed('supported', t), 12);
  assert.equal(classTargetSpeed('rising', t), 8);
  assert.equal(classTargetSpeed('falling', t), 8);
  assert.equal(classTargetSpeed('unsupported', t), 5);
  assert.equal(classTargetSpeed('travel', t), 180, 'the travel speed Foamy asks for (travel_speed_hint)');
});

test('an easy move runs at the class target', () => {
  assert.equal(moveSpeed('base', 10, 0, 0, cfgFor()), 15);
});

test('volumetric ceiling clamps a fast base move', () => {
  const cfg = cfgFor({ speed_base: 100 });
  const expected = cfg.derived.maxVolActual / volumePerMm('base', cfg);
  near(moveSpeed('base', 10, 0, 0, cfg), expected, 1e-9);
  assert.ok(expected < 100);
});

test('machine Z limit clamps steep moves (Review Focus: extreme lift)', () => {
  const cfg = cfgFor({ speed_unsupported: 50 });
  const v = moveSpeed('unsupported', 0.1, 0, 1, cfg);
  const ds = Math.hypot(0.1, 0, 1);
  near(v, (12 * ds) / 1, 1e-9);
  assert.ok(v * (1 / ds) <= 12 + 1e-9);
});

test('machine XY limit clamps travel, stealth mode lowers it', () => {
  assert.equal(moveSpeed('travel', 100, 0, 0, cfgFor({ speed_travel: 400 })), 200);
  assert.equal(moveSpeed('travel', 100, 0, 0, cfgFor({ speed_travel: 400, limits_mode: 'stealth' })), 100);
});

test('a pure Z travel is limited to the Z feedrate', () => {
  assert.equal(moveSpeed('travel', 0, 0, 5, cfgFor({ speed_travel: 150 })), 12);
});

test('a zero-length move returns the class target', () => {
  assert.equal(moveSpeed('base', 0, 0, 0, cfgFor()), 15);
});

test('EXTRUDING covers every extruding class and not travel', () => {
  for (const c of ['base', 'supported', 'rising', 'falling', 'unsupported']) assert.ok(EXTRUDING.has(c));
  assert.ok(!EXTRUDING.has('travel'));
});

test('extra flow in the air scales only the rising, falling and free-hanging strands', () => {
  const plain = cfgFor();
  const boosted = cfgFor({ flow_nonplanar: 130, flow_unsupported: 150 });
  near(volumePerMm('rising', boosted), 1.3 * volumePerMm('rising', plain), 1e-12);
  near(volumePerMm('falling', boosted), 1.3 * volumePerMm('falling', plain), 1e-12);
  near(volumePerMm('unsupported', boosted), 1.5 * volumePerMm('unsupported', plain), 1e-12);
  near(volumePerMm('base', boosted), volumePerMm('base', plain), 1e-12);
  near(volumePerMm('supported', boosted), volumePerMm('supported', plain), 1e-12);
  near(segmentE(10, 'unsupported', boosted), 1.5 * segmentE(10, 'unsupported', plain), 1e-12);
});

test('extra flow never pushes a move past the volumetric limit: the speed drops instead', () => {
  const cfg = cfgFor({ speed_unsupported: 400, flow_unsupported: 300 });
  const v = moveSpeed('unsupported', 10, 0, 0, cfg);
  assert.ok(v * volumePerMm('unsupported', cfg) <= cfg.derived.maxVolActual + 1e-9);
});

test('the foamed air strand grows with the square root of the flow', () => {
  const plain = cfgFor();
  near(airStrandDiameter('unsupported', plain), 0.4 * Math.sqrt(1.5), 1e-9);
  near(airStrandDiameter('unsupported', cfgFor({ flow_unsupported: 200 })), 0.4 * Math.sqrt(3), 1e-9);
  near(airStrandDiameter('rising', cfgFor({ flow_nonplanar: 120 })), 0.4 * Math.sqrt(1.8), 1e-9);
});
