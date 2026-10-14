import test from 'node:test';
import assert from 'node:assert/strict';
import { packCircles, orthogonalCircle, bubblesLayers } from '../src/engine/bubbles.js';
import { boundaryFor, crossingReport } from '../src/engine/layers.js';

test('bubbles never overlap and leave no gap that would take another', () => {
  const b = boundaryFor(50, 50);
  const cs = packCircles(b, { size: 4, gap: 0.6 });
  cs.forEach((a, i) => cs.forEach((c, j) => {
    if (j > i) assert.ok(Math.hypot(a.x - c.x, a.y - c.y) - a.r - c.r > 0.6 - 1e-6, `${i} and ${j} overlap`);
  }));
  for (let y = 1; y < 50; y += 1.3) {
    for (let x = 1; x < 50; x += 1.3) {
      const room = Math.min(...cs.map((c) => Math.hypot(c.x - x, c.y - y) - c.r - 0.6));
      assert.ok(room < 1 + 1, `a gap of ${room} at ${x},${y}`);
    }
  }
});

test('the gap circle meets all three bubbles at a right angle', () => {
  const a = { x: 0, y: 0, r: 3 }, b = { x: 7, y: 0, r: 3.5 }, c = { x: 3, y: 6, r: 2.5 };
  const o = orthogonalCircle(a, b, c);
  for (const k of [a, b, c]) assert.ok(Math.abs((o.x - k.x) ** 2 + (o.y - k.y) ** 2 - k.r ** 2 - o.r ** 2) < 1e-9);
});

test('every bubble away from the edge is crossed by the second layer', () => {
  const b = boundaryFor(50, 50);
  const cs = packCircles(b, { size: 4 });
  const { layers } = bubblesLayers(b, { size: 4 });
  // points of the second layer that lie on each bubble's rim
  const rimHits = cs.map((c) => layers[1].flat().filter((p) => Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - c.r) < 0.3).length);
  const inner = cs.map((c, i) => ({ c, i })).filter(({ c }) => c.x - c.r > 3 && c.y - c.r > 3 && c.x + c.r < 47 && c.y + c.r < 47);
  const crossed = inner.filter(({ i }) => rimHits[i] > 0).length;
  assert.ok(crossed >= 0.95 * inner.length, `${crossed} of ${inner.length}`);
  const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
  assert.ok(r.longestUncrossed < 20, `longest ${r.longestUncrossed}`);
});

test('clusters print as one strand each', () => {
  const b = boundaryFor(40, 40);
  const joined = bubblesLayers(b, { size: 4, link: true });
  const apart = bubblesLayers(b, { size: 4, link: false });
  assert.ok(joined.layers[0].length < 0.5 * apart.layers[0].length, `${joined.layers[0].length} vs ${apart.layers[0].length}`);
});
