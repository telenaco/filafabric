import test from 'node:test';
import assert from 'node:assert/strict';
import { lissajousCurve, lissajousLayers } from '../src/engine/lissajous.js';
import { boundaryFor, layeredResult, crossingReport } from '../src/engine/layers.js';
import { findCrossings } from '../src/engine/crossings.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const box = { minX: 0, minY: 0, maxX: 60, maxY: 60 };

test('the curve is closed and fills the box to within the margin', () => {
  const pts = lissajousCurve(box, { a: 5, b: 4, phase: 30, margin: 1 });
  const first = pts[0], last = pts[pts.length - 1];
  assert.ok(Math.hypot(first.x - last.x, first.y - last.y) < 1e-6);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  assert.ok(Math.min(...xs) >= 0.9 && Math.max(...xs) <= 59.1);
  assert.ok(Math.max(...xs) > 58 && Math.max(...ys) > 58);
});

test('a coprime a:b curve crosses itself 2ab - a - b times', () => {
  for (const [a, b] of [[3, 2], [5, 4], [5, 3]]) {
    const pts = lissajousCurve(box, { a, b, phase: 25 });
    const { found } = findCrossings([{ pts }]);
    assert.equal(found.length, 2 * a * b - a - b, `${a}:${b}`);
  }
});

test('the second layer crosses the first', () => {
  const { layers } = lissajousLayers(boundaryFor(60, 60), { a: 5, b: 4, phase: 30, second: true });
  assert.equal(layers.length, 2);
  const items = layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k })));
  assert.ok(crossingReport(items, 3600).between > 20);
  assert.equal(lissajousLayers(boundaryFor(60, 60), { second: false }).layers.length, 1);
});

test('it prints, with self crossings lifted, and is clipped inside an outline', () => {
  const ring = [[{ x: 5, y: 5 }, { x: 55, y: 5 }, { x: 55, y: 25 }, { x: 30, y: 25 }, { x: 30, y: 55 }, { x: 5, y: 55 }]];
  const b = boundaryFor(60, 60, ring);
  const { layers } = lissajousLayers(b, { a: 5, b: 4, phase: 30, second: true });
  for (const p of layers.flat(2)) assert.ok(b.contains(p.x, p.y) || b.contains(p.x + 0.3, p.y) || b.contains(p.x - 0.3, p.y) || b.contains(p.x, p.y + 0.3) || b.contains(p.x, p.y - 0.3));
  const r = layeredResult(machine, material, { width: 60, height: 60, layers, outline: ring });
  assert.ok(r.moves.some((m) => m.extrude));
});
