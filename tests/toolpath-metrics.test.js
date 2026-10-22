import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';
import { analyzeToolpath, overlayScale, overlayColor } from '../src/ui/toolpath-metrics.js';

const config = (over = {}) => { const { machine, material } = defaultProfiles(); return resolveConfig(machine, material, over); };
const p = (x, y = 10, z = .2, extrude = false, more = {}) => ({ x, y, z, extrude, cls: extrude ? 'base' : 'travel', ...more });
const near = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('flow uses exported relative E once and speed uses rounded, volume-limited feedrate', () => {
  const cfg = config(), moves = [p(10), p(20, 10, .2, true)];
  const result = analyzeToolpath({ moves, cfg });
  near(result.segments[1].filamentMm, .34255);
  near(result.segments[1].speed, 955 / 60);
  near(result.segments[1].flow, .34255 * Math.PI * .875 ** 2 / (10 / (955 / 60)));
  near(result.segments[1].width, .42);
  assert.equal(result.segments[1].kind, 'extrusion');
});

test('adaptive widths remain physical widths; local area flow changes volume exactly once', () => {
  const cfg = config();
  const result = analyzeToolpath({ cfg, moves: [p(10), p(20, 10, .2, true), p(30, 10, .2, true, { width: .7970796326794897, flow: 2 })] });
  near(result.segments[2].width, .7970796326794897);
  near(result.segments[2].filamentMm, .68509);
  assert.equal(result.summary.flowChanges, 1);
  assert.ok(result.summary.maxFlowChange > 0, 'speed rounding is reflected even at the volume limit');
});

test('air width uses the foam model while input flow excludes foam expansion', () => {
  const cfg = config({ flow_unsupported: 200 });
  const s = analyzeToolpath({ cfg, moves: [p(10), p(20, 10, .2, true, { cls: 'unsupported', flow: .5 })] }).segments[1];
  near(s.width, .4 * Math.sqrt(1.5));
  near(s.filamentMm, .57078);
  assert.equal(s.widthEstimated, true);
});

test('quantized segments create no fake deposition and carry E into the next spatial segment', () => {
  const cfg = config();
  const result = analyzeToolpath({ cfg, moves: [p(10), p(10.0003, 10, .2, true), p(10.1, 10, .2, true)] });
  assert.equal(result.segments[1], null);
  near(result.segments[2].filamentMm, .00343);
  near(result.segments[2].length, .1);
});

test('travels group a lift, horizontal route and descent, excluding stationary retract and prime', () => {
  const cfg = config({ retraction_length: 1 });
  const moves = [p(10), p(20, 10, .2, true), p(20, 10, 1.2, false, { retract: 'retract' }), p(30, 10, 1.2), p(30), p(30, 10, .2, false, { retract: 'unretract' }), p(40, 10, .2, true)];
  const result = analyzeToolpath({ moves, cfg });
  assert.equal(result.segments[2].kind, 'lift');
  assert.equal(result.segments[3].kind, 'travel');
  assert.equal(result.segments[5], null);
  assert.equal(result.summary.travelRoutes, 1);
  near(result.summary.travelMm, 12);
  near(result.summary.maxLift, 1);
  assert.equal(result.summary.liftRoutes, 1);
  assert.equal(result.summary.flowChanges, 0, 'a travel breaks flow-change continuity');
});

test('width falls back to measured calibration geometry and analysis never mutates print data', () => {
  const { machine, material } = defaultProfiles();
  material.flow.measured_line_width = .55;
  const cfg = resolveConfig(machine, material), moves = [p(10), p(20, 10, .2, true)];
  const before = JSON.stringify({ moves, cfg });
  const s = analyzeToolpath({ moves, cfg }).segments[1];
  near(s.width, .55); near(s.filamentMm, .34255);
  assert.equal(JSON.stringify({ moves, cfg }), before);
});

test('empty and constant metrics have honest finite scales; travels have no deposited width or flow', () => {
  const cfg = config(), empty = analyzeToolpath({ cfg, moves: [] });
  assert.equal(overlayScale(empty, 'flow').min, null);
  const result = analyzeToolpath({ cfg, moves: [p(10), p(20, 10, .2, true), p(30)] });
  const scale = overlayScale(result, 'width');
  near(scale.min, .42); near(scale.max, .42);
  assert.equal(typeof overlayColor(.42, scale), 'number');
  assert.equal(result.segments[2].flow, null);
  assert.equal(result.segments[2].width, null);
  assert.equal(overlayScale(result, 'speed').min, 955 / 60, 'numeric scales describe extrusion, not hidden travels');
});
