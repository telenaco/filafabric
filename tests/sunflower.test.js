import test from 'node:test';
import assert from 'node:assert/strict';
import { sunflowerLayers } from '../src/engine/sunflower.js';
import { boundaryFor, crossingReport } from '../src/engine/layers.js';

/** Total turning (radians) a polyline makes round the centre, per mm it moves outwards. */
function twist(pts, c) {
  let dTheta = 0, dR = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = Math.atan2(pts[i - 1].y - c, pts[i - 1].x - c), b = Math.atan2(pts[i].y - c, pts[i].x - c);
    let d = b - a;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    const ra = Math.hypot(pts[i - 1].x - c, pts[i - 1].y - c), rb = Math.hypot(pts[i].x - c, pts[i].y - c);
    dTheta += d * Math.sign(rb - ra);
    dR += Math.abs(rb - ra);
  }
  return dTheta / Math.max(dR, 1e-9);
}

test('the two layers are spirals turning opposite ways', () => {
  const { layers } = sunflowerLayers(boundaryFor(60, 60), { spacing: 4, hub: 3 });
  const longest = (layer) => layer.reduce((a, b) => (b.length > a.length ? b : a));
  const t0 = twist(longest(layers[0]), 30), t1 = twist(longest(layers[1]), 30);
  assert.ok(Math.sign(t0) !== Math.sign(t1), `twists ${t0} and ${t1}`);
});

test('both layers pass through the seeds, so they cross all over', () => {
  const { layers, extra } = sunflowerLayers(boundaryFor(50, 50), { spacing: 4, hub: 3 });
  const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
  assert.ok(r.between > 0.5 * extra.seeds * 0.6, `${r.between} crossings for ${extra.seeds} seeds`);
  assert.ok(r.longestUncrossed < 12, `longest ${r.longestUncrossed}`);
  for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5);
});

test('the open centre stays open', () => {
  const { layers } = sunflowerLayers(boundaryFor(50, 50), { spacing: 4, hub: 8 });
  for (const p of layers.flat(2)) assert.ok(Math.hypot(p.x - 25, p.y - 25) > 7, `${p.x},${p.y}`);
});
