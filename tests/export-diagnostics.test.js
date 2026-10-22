import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/engine/params.js';
import { computeStats } from '../src/engine/stats.js';
import { writeGcode, GcodeWriter } from '../src/engine/gcode.js';
import { defaultProfiles } from './helpers.js';

test('export records resolved flow, temperatures and travel policy', () => {
  const { machine, material } = defaultProfiles(), cfg = resolveConfig(machine, material);
  const line = new GcodeWriter(cfg).header().find((s) => s.startsWith('; resolved print setup '));
  assert.ok(line, 'resolved profile values belong in the export');
  const data = JSON.parse(line.slice('; resolved print setup '.length));
  assert.equal(data.flowMultiplier, 0.73);
  assert.equal(data.temperatures.first, 238);
  assert.equal(data.retraction.minTravel, 2);
  assert.equal(data.retraction.liftOnRetractOnly, true);
});

test('motion diagnostics separate extrusion, travel and retract time and record actual heights', () => {
  const { machine, material } = defaultProfiles(), cfg = resolveConfig(machine, material, { sample_width: 20, sample_height: 20 });
  const moves = [
    { x: 1, y: 1, z: 0.2, cls: 'travel', extrude: false },
    { x: 11, y: 1, z: 0.2, cls: 'base', extrude: true, tag: 'a' },
    { x: 11, y: 1, z: 0.6, cls: 'travel', extrude: false, retract: 'retract' },
    { x: 1, y: 2, z: 0.4, cls: 'travel', extrude: false },
    { x: 11, y: 2, z: 0.4, cls: 'supported', extrude: true, tag: 'b', retract: 'unretract' },
  ];
  const stats = computeStats(moves, cfg, []);
  assert.equal(stats.retractions, 1);
  assert.equal(stats.travelMoves, 3);
  assert.deepEqual(stats.extrusionRangeZ, { min: 0.2, max: 0.4 });
  assert.ok(Math.abs(Object.values(stats.timeByKind).reduce((a, b) => a + b, 0) - stats.timeSec) < 1e-8);
  assert.ok(Math.abs(stats.timeByKind.retraction - 1 / 40) < 1e-9);
  const gcode = writeGcode(moves, cfg, { stats });
  const actualLine = gcode.split('\n').find((s) => s.startsWith('; actual motion summary '));
  const actual = JSON.parse(actualLine.slice('; actual motion summary '.length));
  assert.deepEqual(actual.timeByKind, stats.timeByKind);
  assert.deepEqual(actual.extrusionRangeZ, stats.extrusionRangeZ);
  assert.equal(actual.retractions, stats.retractions);
  assert.equal(actual.travelMoves, stats.travelMoves);
  assert.equal(actual.xyTravelMm, stats.travelMm);
  assert.ok(gcode.includes('; motion summary '));
  assert.ok(gcode.includes('; estimated time (no acceleration):'));
});

test('streamed panels record actual motion diagnostics and honor the travel threshold', async () => {
  const { exportPanel } = await import('../src/engine/panel.js');
  const { machine, material } = defaultProfiles();
  material.retraction.min_travel = 1000;
  let text = '';
  await exportPanel({ machine, material, design: 'zigzag', width: 20, height: 20, repeat: 20, brim: 0 }, { write: async (part) => { text += part; } });
  const body = text.split('; BODY START')[1].split('; BODY END')[0];
  assert.ok(!/^G1 E-/m.test(body), 'the streamed path respects the chosen minimum travel');
  const line = text.split('\n').find((s) => s.startsWith('; actual motion summary '));
  assert.ok(line, 'incremental exports include completed motion diagnostics');
  const data = JSON.parse(line.slice('; actual motion summary '.length));
  assert.equal(data.retractions, 0);
  assert.ok(data.extrusionRangeZ.max >= data.extrusionRangeZ.min);
  assert.ok(data.travelMoves > 0 && data.timeByKind.extrusion > 0);
});
