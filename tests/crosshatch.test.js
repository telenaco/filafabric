import test from 'node:test';
import assert from 'node:assert/strict';
import { crosshatchLayers, DIRECTIONS, DIRECTION_IDS } from '../src/engine/crosshatch.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { findCrossings } from '../src/engine/crossings.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const items = (layers) => layers.flatMap((layer, k) => layer.map((pts) => ({ pts, layer: k })));

test('every direction set gives one layer per angle', () => {
  const b = boundaryFor(40, 30);
  for (const id of DIRECTION_IDS) {
    const r = crosshatchLayers(b, { directions: id, spacing: 4 });
    assert.equal(r.layers.length, DIRECTIONS[id].angles.length, id);
    assert.ok(r.layers.every((l) => l.length >= 1), id);
  }
});

test('every pair of layers crosses, so the layers hold together', () => {
  const b = boundaryFor(40, 30);
  for (const id of DIRECTION_IDS) {
    const { layers } = crosshatchLayers(b, { directions: id, spacing: 4 });
    const report = crossingReport(items(layers), 1200);
    assert.ok(report.between > 20, `${id}: ${report.between}`);
  }
});

test('the usual crossing angle follows the direction set', () => {
  const b = boundaryFor(60, 60);
  // the short jogs that join one line to the next cross at other angles, so look at the typical crossing, not the least
  const typical = (id) => {
    const { layers } = crosshatchLayers(b, { directions: id, spacing: 5 });
    const { found } = findCrossings(items(layers).map((it) => ({ pts: it.pts })));
    const angles = found.map((c) => c.angle).sort((p, q) => p - q);
    return angles[Math.floor(angles.length / 2)];
  };
  assert.ok(Math.abs(typical('0-90') - 90) < 1);
  assert.ok(Math.abs(typical('60-120') - 60) < 1.5, 'lines 60 degrees apart');
  assert.ok(Math.abs(typical('0-60-120') - 60) < 1.5);
});

test('a wave size makes the lines wavy and keeps them in the swatch', () => {
  const b = boundaryFor(40, 30);
  const straight = crosshatchLayers(b, { directions: '0-90', spacing: 5, size: 0 }).layers[0][0];
  const wavy = crosshatchLayers(b, { directions: '0-90', spacing: 5, size: 1.2, shape: 'wave', pitch: 6 }).layers[0][0];
  assert.ok(wavy.length > straight.length);
  for (const p of wavy) assert.ok(p.x > -2 && p.x < 42 && p.y > -2 && p.y < 32);
});

test('an outline is respected and the result prints', () => {
  const ring = [[{ x: 2, y: 2 }, { x: 38, y: 2 }, { x: 38, y: 12 }, { x: 20, y: 12 }, { x: 20, y: 28 }, { x: 2, y: 28 }]];
  const b = boundaryFor(40, 30, ring);
  const { layers } = crosshatchLayers(b, { directions: '60-120', spacing: 4 });
  for (const pts of layers.flat()) for (const p of pts) assert.ok(b.contains(p.x, p.y) || b.contains(p.x + 0.4, p.y) || b.contains(p.x - 0.4, p.y) || b.contains(p.x, p.y + 0.4) || b.contains(p.x, p.y - 0.4), 'inside');
  const r = layeredResult(machine, material, { width: 40, height: 30, layers, outline: ring });
  assert.ok(r.moves.some((m) => m.extrude));
});

test('three ways prints three layers one layer height apart', () => {
  const { layers } = crosshatchLayers(boundaryFor(30, 30), { directions: '0-60-120', spacing: 5 });
  const r = layeredResult(machine, material, { width: 30, height: 30, layers });
  const zs = [...new Set(r.strands.map((s) => Number(s.pts[0].z.toFixed(3))))];
  assert.deepEqual(zs, [0.2, 0.4, 0.6]);
});
