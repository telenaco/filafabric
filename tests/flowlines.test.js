import test from 'node:test';
import assert from 'node:assert/strict';
import { flowLayers, evenStreamlines, singularPoints, FLOW_IDS } from '../src/engine/flowlines.js';
import { boundaryFor, crossingReport } from '../src/engine/layers.js';
import { createField } from '../src/engine/fields.js';

const report = (layers, area) => crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), area);

test('streamlines keep their distance from each other', () => {
  const b = boundaryFor(40, 40);
  const lines = evenStreamlines(b, (x, y) => 0.5 * Math.sin(y / 5), { dsep: 3 });
  assert.ok(lines.length > 8);
  let closest = Infinity;
  lines.forEach((a, i) => lines.forEach((c, j) => {
    if (j <= i) return;
    for (const p of a) for (const q of c) closest = Math.min(closest, Math.hypot(p.x - q.x, p.y - q.y));
  }));
  assert.ok(closest > 0.45 * 3, `closest ${closest}`);
});

test('the second layer crosses the first at right angles, for every flow', () => {
  for (const flow of FLOW_IDS) {
    const { layers } = flowLayers(boundaryFor(50, 50), { flow, spacing: 3, scale: 30 });
    const r = report(layers, 2500);
    assert.ok(r.between > 150, `${flow}: ${r.between} crossings`);
    assert.ok(r.minAngle > 70, `${flow}: angle ${r.minAngle}`);
    assert.ok(r.longestUncrossed < 25, `${flow}: longest ${r.longestUncrossed}`);
    for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5, flow);
  }
});

test('the eye of a whirl is found and left open', () => {
  const box = { minX: 0, minY: 0, maxX: 40, maxY: 40 };
  const swirl = singularPoints(box, (x, y) => Math.atan2(y - 20, x - 20) + Math.PI / 2, 1);
  assert.ok(swirl.length >= 1 && swirl.every((p) => Math.hypot(p.x - 20, p.y - 20) < 1.5), JSON.stringify(swirl));
  const { layers } = flowLayers(boundaryFor(40, 40), { flow: 'swirl', spacing: 3 });
  for (const p of layers[1].flat()) assert.ok(Math.hypot(p.x - 20, p.y - 20) > 1.4);
});

test('a pattern only bends the lines: no eyes or saddles', () => {
  for (const id of ['noise', 'hexagonCells', 'stripes']) {
    const { extra } = flowLayers(boundaryFor(50, 50), { flow: 'pattern', spacing: 3, tone: createField(id) });
    assert.equal(extra.singular, 0, id);
  }
});
