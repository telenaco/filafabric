import test from 'node:test';
import assert from 'node:assert/strict';
import { conformalLayers, MAP_IDS } from '../src/engine/conformal.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { sampleGrid, isoLines } from '../src/engine/isolines.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const report = (layers, area) => crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), area);

test('isoLines walks open lines whole and closes closed ones', () => {
  const box = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  const ramp = isoLines(sampleGrid(box, 0.5, (x) => x), 0.25);
  assert.equal(ramp.length, 1, 'one straight open line');
  assert.ok(Math.abs(ramp[0][0].y - ramp[0][ramp[0].length - 1].y) > 15, 'it runs the full height');
  const ring = isoLines(sampleGrid(box, 0.5, (x, y) => Math.hypot(x, y)), 5);
  assert.equal(ring.length, 1);
  const r = ring[0];
  assert.deepEqual(r[0], r[r.length - 1], 'a circle comes back to its start');
  for (const p of r) assert.ok(Math.abs(Math.hypot(p.x, p.y) - 5) < 0.1);
  const cut = isoLines(sampleGrid(box, 0.5, (x, y) => (x < 0 ? NaN : x)), 3);
  assert.equal(cut.length, 1, 'missing values end lines instead of making false ones');
});

test('every map crosses its two layers at right angles, many times over', () => {
  for (const map of MAP_IDS) {
    const { layers } = conformalLayers(boundaryFor(50, 50), { map, spacing: 3 });
    const r = report(layers, 2500);
    assert.ok(r.between > 90, `${map}: ${r.between} crossings`);
    if (map !== 'nautilus') assert.ok(r.minAngle > 75, `${map}: angle ${r.minAngle}`);
    for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5, `${map} stays in the swatch`);
  }
});

test('the buttonhole leaves its hole open, hemmed, and the potential lines run into the hem', () => {
  const { layers } = conformalLayers(boundaryFor(50, 50), { map: 'hole', spacing: 3, feature: 0.4 });
  const r = 0.4 * 25; // hole radius: feature x half the shorter side
  for (const p of layers.flat(2)) assert.ok(Math.hypot(p.x - 25, p.y - 25) > r - 0.1, 'nothing inside the hole');
  const hem = layers[1][0];
  assert.ok(hem.every((p) => Math.abs(Math.hypot(p.x - 25, p.y - 25) - r - 0.3) < 0.1), 'the hem rings the hole');
  const held = report([layers[0], [hem]], 2500).between;
  assert.ok(held >= 8, `the hem is crossed by ${held} lines`);
});

test('the nautilus spirals carry on across the branch cut instead of breaking into pieces', () => {
  const { layers } = conformalLayers(boundaryFor(50, 50), { map: 'nautilus', arms: 21, twist: 13 });
  assert.ok(layers[0].length < 40 && layers[1].length < 40, `${layers[0].length}+${layers[1].length} strands`);
});

test('a conformal mesh prints', () => {
  const { layers } = conformalLayers(boundaryFor(40, 40), { map: 'twin', spacing: 3 });
  const r = layeredResult(machine, material, { width: 40, height: 40, layers });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.report.between > 50);
});
