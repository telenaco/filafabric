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
  // the default (closed) centre: a wider solid core is one long strand that nothing crosses, so it is judged apart
  const { layers, extra } = sunflowerLayers(boundaryFor(50, 50), { spacing: 4 });
  const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
  assert.ok(r.between > 0.5 * extra.seeds * 0.6, `${r.between} crossings for ${extra.seeds} seeds`);
  assert.ok(r.longestUncrossed < 12, `longest ${r.longestUncrossed}`);
  for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5);
});

test('the open centre stays open', () => {
  const { layers } = sunflowerLayers(boundaryFor(50, 50), { spacing: 4, hub: 8, hubStyle: 'open' });
  for (const p of layers.flat(2)) assert.ok(Math.hypot(p.x - 25, p.y - 25) > 7, `${p.x},${p.y}`);
});

/* ---------- a closed centre, the way the spiderweb has one ---------- */
import { layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const fromCentre = (p, size) => Math.hypot(p.x - size / 2, p.y - size / 2);

test('the centre is closed by default: a filled core, and the line that reaches in starts from it', () => {
  const { layers, extra } = sunflowerLayers(boundaryFor(50, 50), { spacing: 4 });
  assert.equal(extra.hubStyle, 'solid');
  assert.ok(layers.flat().some((pts) => pts[0] && fromCentre(pts[0], 50) < 0.05), 'a line begins at the centre');
  // the core is a flat spiral: its turns are about 0.8 beads apart, so the middle holds many points close together
  const near = layers.flat(2).filter((p) => fromCentre(p, 50) < 0.7);
  assert.ok(near.length > 30, `${near.length} points inside the hub`);
});

test('a closed centre is one connected fabric, in order, inside, and low', () => {
  for (const hub of [0, 0.4, 0.6, 1, 3]) {
    const { layers } = sunflowerLayers(boundaryFor(50, 50), { spacing: 4, hub, strandWidth: 0.45 });
    const r = layeredResult(machine, material, { width: 50, height: 50, layers });
    assert.equal(r.fabric.components, 1, `hub ${hub}: connected`);
    assert.equal(r.fabric.reversedCrossings, 0, `hub ${hub}: ordered crossings`);
    assert.equal(r.fabric.outsideSegments, 0, `hub ${hub}: contained`);
    assert.ok(r.fabric.maxSlopeDeg <= 25.1, `hub ${hub}: slope ${r.fabric.maxSlopeDeg}`);
    assert.ok(Math.max(...r.strands.flatMap((s) => s.pts.map((p) => p.z))) < 3, `hub ${hub}: height`);
  }
});

test('the hub radius is honoured: nothing is left open inside it, and the open style still leaves a hole', () => {
  const solid = sunflowerLayers(boundaryFor(50, 50), { spacing: 4, hub: 3 });
  // every ring of the core up to its radius is there: some point lies in each 0.4 mm band
  for (let r = 0.4; r < 3; r += 0.8) assert.ok(solid.layers.flat(2).some((p) => Math.abs(fromCentre(p, 50) - r) < 0.4), `a bead near radius ${r}`);
  const open = sunflowerLayers(boundaryFor(50, 50), { spacing: 4, hub: 3, hubStyle: 'open' });
  for (const p of open.layers.flat(2)) assert.ok(fromCentre(p, 50) > 2.4);
});

test('a solid centre is clipped to a real hole in the outline', () => {
  const outline = [
    [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }],
    [{ x: 13, y: 13 }, { x: 17, y: 13 }, { x: 17, y: 17 }, { x: 13, y: 17 }],
  ];
  const boundary = boundaryFor(30, 30, outline);
  const { layers } = sunflowerLayers(boundary, { spacing: 4, hub: 0.6 });
  for (const pts of layers.flat()) for (const p of pts) assert.ok(boundary.contains(p.x, p.y));
});
