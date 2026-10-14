import test from 'node:test';
import assert from 'node:assert/strict';
import { spirographLayers, trochoidRing } from '../src/engine/spirograph.js';
import { boundaryFor, crossingReport } from '../src/engine/layers.js';

test('a ring closes on itself and swings n times a turn', () => {
  const pts = trochoidRing({ x: 0, y: 0 }, 10, 12, 1.5);
  assert.ok(Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-6);
  // count the outward peaks round the closed ring (its last point repeats the first)
  const ring = pts.slice(0, -1), n = ring.length;
  const r = (p) => Math.hypot(p.x, p.y);
  let outer = 0;
  for (let i = 0; i < n; i++) if (r(ring[i]) > r(ring[(i - 1 + n) % n]) && r(ring[i]) >= r(ring[(i + 1) % n]) && r(ring[i]) > 11) outer++;
  assert.equal(outer, 12);
});

test('rings of one layer never touch, and the second layer crosses them all', () => {
  for (const loop of [0.8, 1.5, 2.2]) {
    const b = boundaryFor(50, 50);
    const { layers, extra } = spirographLayers(b, { spacing: 4, loop });
    assert.ok(extra.swing <= 4 / 2 - 0.45 + 1e-9 && extra.swing >= 4 / 4 + 0.225 - 1e-9, `swing ${extra.swing}`);
    const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
    assert.ok(r.between > 100, `loop ${loop}: ${r.between}`);
    assert.ok(r.longestUncrossed < 40, `loop ${loop}: longest ${r.longestUncrossed}`);
    for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5);
  }
});
