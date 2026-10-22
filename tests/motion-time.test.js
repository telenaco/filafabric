import test from 'node:test';
import assert from 'node:assert/strict';
import * as motion from '../src/engine/motion-time.js';
import { defaultProfiles } from './helpers.js';
import { resolveConfig } from '../src/engine/params.js';
import { computeStats } from '../src/engine/stats.js';
import { writeGcode, GcodeWriter } from '../src/engine/gcode.js';

const limits = { max_feedrate: { x: 1000, y: 1000, z: 1000, e: 1000 }, max_accel: { x: 100, y: 100, z: 100, e: 100 }, accel_extruding: 100, accel_travel: 100, accel_retracting: 100, jerk: { x: 0, y: 0, z: 0, e: 0 } };
const options = { limits, accelSyntax: 'P_R_T' };
const estimate = (code, over = {}) => motion.estimateGcodeTime(code, { ...options, ...over });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('rest-to-rest timing matches analytic trapezoidal and triangular motion', () => {
  near(estimate('G1 X100 F600').estimatedTimeSec, 10.1);
  near(estimate('G1 X1 F6000').estimatedTimeSec, .2);
});

test('lookahead preserves straight segmentation and stops at zero-jerk corners', () => {
  const long = estimate('G1 X100 F600');
  const chunks = estimate(Array.from({ length: 1000 }, (_, i) => `G1 X${(i + 1) / 10} F600`).join('\n'));
  near(chunks.estimatedTimeSec, long.estimatedTimeSec);
  near(estimate('G1 X100 F600\nG1 Y100').estimatedTimeSec, 20.2);
  near(estimate('G1 X100 F600\nG1 X0').estimatedTimeSec, 20.2);
});

test('per-axis acceleration and feed limits apply to 3D motion', () => {
  const limited = { ...limits, max_feedrate: { ...limits.max_feedrate, z: 1 }, max_accel: { ...limits.max_accel, z: 1 } };
  near(estimate('G1 X3 Z4 F6000', { limits: limited }).estimatedTimeSec, 5);
});

test('parser handles modal feed, coordinate modes, G92, units and extrusion modes', () => {
  const a = estimate('G90\nM83\nG1 X10 F600\nG91\nM83\nG1 X10\nG92 X0\nG90\nM83\nG1 X10');
  near(a.estimatedTimeSec, estimate('G1 X30 F600').estimatedTimeSec);
  near(estimate('G20\nG1 X1 F60').estimatedTimeSec, estimate('G1 X25.4 F1524').estimatedTimeSec);
  near(estimate('M83\nG1 E1 F60\nG1 E1').estimatedTimeSec, 2.01);
  near(estimate('M82\nG1 E1 F60\nG1 E2').estimatedTimeSec, 2.01);
});

test('flow and speed overrides affect E limits and feed without scaling path coordinates', () => {
  const limited = { ...limits, max_feedrate: { ...limits.max_feedrate, e: 1 } };
  const code = 'M83\nG1 X10 E2 F600';
  assert.ok(estimate('M221 S200\n' + code, { limits: limited }).estimatedTimeSec > estimate(code, { limits: limited }).estimatedTimeSec);
  assert.ok(estimate('M220 S50\nG1 X10 F600').estimatedTimeSec > estimate('G1 X10 F600').estimatedTimeSec);
});

test('dwell and barriers stop motion; heating, homing and unsupported moves are disclosed', () => {
  near(estimate('G1 X10 F600\nG4 P500\nG1 X20').estimatedTimeSec, 2.7);
  const r = estimate('M109 S200\nG28\nG80\nG2 X10 I5 F600');
  assert.ok(r.warnings.some(x => /heat/i.test(x)));
  assert.ok(r.warnings.some(x => /hom/i.test(x)));
  assert.ok(r.warnings.some(x => /G2/.test(x)));
});

test('M204 dialects and M201/M203/M205 use emitted machine settings', () => {
  near(estimate('M204 S25 T50\nG1 X1 F600', { accelSyntax: 'S_T' }).estimatedTimeSec, .4);
  near(estimate('M204 P25 T100\nG1 X1 E1 F600').estimatedTimeSec, .4);
  near(estimate('M201 X25\nG1 X1 F600').estimatedTimeSec, .4);
  near(estimate('M203 X1\nG1 X1 F600').estimatedTimeSec, 1.01);
  assert.ok(estimate('M205 X8 Y8\nG1 X10 F600\nG1 Y10').estimatedTimeSec < estimate('G1 X10 F600\nG1 Y10').estimatedTimeSec);
});

test('streamed multiline commands match whole-file parsing with bounded planner memory', () => {
  const timer = new motion.MotionTimeEstimator(options);
  timer.write(['M83\nG1 X10 F600\nG4 S1', 'G1 X20']);
  near(timer.finish().estimatedTimeSec, estimate('M83\nG1 X10 F600\nG4 S1\nG1 X20').estimatedTimeSec);
  const long = Array.from({ length: 2000 }, (_, i) => `G1 X${i % 2} Y${i + 1} F600`);
  const stream = new motion.MotionTimeEstimator(options);
  for (const line of long) { stream.write([line]); assert.ok(stream.queue.length <= 256); }
  const result = stream.finish();
  near(result.estimatedTimeSec, estimate(long.join('\n')).estimatedTimeSec);
  assert.ok(result.estimatedTimeSec >= result.commandedMotionTimeSec);
});

test('absolute E and flow overrides do not alter later E coordinates; zero-padded arcs are disclosed', () => {
  near(estimate('M82\nM221 S200\nG1 E1 F60\nM221 S100\nG1 E2').estimatedTimeSec, 3.01);
  assert.equal(estimate('G02 X10 I5 F600').complete, false);
});

test('human pauses are disclosed and unknown motion cannot appear complete', () => {
  const result = estimate('G1 X10 F600\nM600\nG1 X20\nM0\nG123 X30');
  assert.equal(result.complete, false);
  assert.ok(result.warnings.some(w => /human|pause/i.test(w)));
  assert.ok(result.warnings.some(w => /G123/.test(w)));
  near(result.estimatedTimeSec, 2.2);
});

test('stats and streamed writer estimate rounded emitted startup/body/end moves and preserve playback clock', () => {
  const { machine, material } = defaultProfiles(), cfg = resolveConfig(machine, material, { sample_width: 20, sample_height: 20 });
  const moves = [{ x: 1, y: 1, z: .2, cls: 'travel', extrude: false }, { x: 11, y: 1, z: .2, cls: 'base', extrude: true }];
  const stats = computeStats(moves, cfg, []), code = writeGcode(moves, cfg, { stats });
  const expected = estimate(code, { limits: cfg.derived.limits, accelSyntax: machine.accel_syntax });
  near(stats.estimatedTimeSec, expected.estimatedTimeSec);
  assert.ok(stats.motionEstimate.bodyTimeSec > 0 && stats.motionEstimate.startupMotionTimeSec > 0 && stats.motionEstimate.endMotionTimeSec > 0);
  near(stats.timeSec, Object.values(stats.timeByKind).reduce((a, b) => a + b));
  assert.equal(stats.moveStartSec[0], 0);
  const writer = new GcodeWriter(cfg); writer.header(); for (const m of moves) writer.move(m); writer.footer();
  near(writer.motionSummary().estimatedTimeSec, stats.estimatedTimeSec);
  assert.match(code, /acceleration-aware motion estimate/);
});
