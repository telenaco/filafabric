import test from 'node:test';
import assert from 'node:assert/strict';
import { webLayers } from '../src/engine/web.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('the spiral grows by one spacing per turn from the hub, and stays inside the swatch', () => {
  const b = boundaryFor(60, 60);
  const { layers } = webLayers(b, { spacing: 5, spokes: 24, hub: 4 });
  const spiral = layers[0].flat();
  const radius = (p) => Math.hypot(p.x - 30, p.y - 30);
  assert.ok(Math.abs(radius(spiral[0]) - 4) < 0.5, 'starts at the hub');
  // one turn on, the radius is one spacing further out
  const ahead = spiral.find((p) => Math.abs(Math.atan2(p.y - 30, p.x - 30)) < 0.05 && radius(p) > 8);
  assert.ok(ahead && Math.abs(radius(ahead) - 9) < 0.8, `a turn on: ${ahead && radius(ahead)}`);
  for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 60.5 && p.y > -0.5 && p.y < 60.5);
});

test('every spoke crosses the turns, so the layers hold each other', () => {
  const b = boundaryFor(60, 60);
  const { layers } = webLayers(b, { spacing: 5, spokes: 24, hub: 4 });
  const items = layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k })));
  const r = crossingReport(items, 3600);
  assert.ok(r.between > 150, `${r.between}`);
  assert.ok(r.longestUncrossed < 20, `longest ${r.longestUncrossed}`);
});

test('the sawtooth moves the turns in and out without breaking them', () => {
  const b = boundaryFor(50, 50);
  const plain = webLayers(b, { spacing: 5, spokes: 16, hub: 3, tooth: 0 }).layers[0].flat();
  const saw = webLayers(b, { spacing: 5, spokes: 16, hub: 3, tooth: 1 }).layers[0].flat();
  const rough = (pts) => pts.reduce((m, p, i) => (i ? Math.max(m, Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)) : m), 0);
  assert.ok(rough(saw) < 1.5, 'no jumps');
  assert.notDeepEqual(plain.slice(100, 110), saw.slice(100, 110));
});

test('the web prints as a few strands', () => {
  const { layers } = webLayers(boundaryFor(50, 50), { spacing: 4, spokes: 20, hub: 3 });
  const r = layeredResult(machine, material, { width: 50, height: 50, layers });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.strands.length < 30, `${r.strands.length} strands`);
});
