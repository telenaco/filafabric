import test from 'node:test';
import assert from 'node:assert/strict';
import { rosetteLayers } from '../src/engine/rosette.js';
import { minCrossingAmplitude } from '../src/engine/squiggle.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('each second-layer turn crosses the turns on both sides, even when the swing asked for is too small', () => {
  for (const depth of [1.5, 0.5]) {
    const { layers, extra } = rosetteLayers(boundaryFor(60, 60), { spacing: 4, lobes: 16, depth });
    assert.ok(extra.swing >= minCrossingAmplitude(4) - 1e-9, `swing ${extra.swing}`);
    const items = layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k })));
    const r = crossingReport(items, 3600);
    // a full turn of layer 2 meets the turn inside and the turn outside twice per lobe
    assert.ok(r.between > 2 * 16 * (extra.turns - 2) * 0.8, `depth ${depth}: ${r.between} crossings over ${extra.turns.toFixed(1)} turns`);
    // Inner turns deliberately become smooth where a full wave will not fit. Keep the original crossing
    // requirement for the fully formed mesh outside that transition, including clipped exterior fragments.
    const outer = items.map((it) => ({ ...it, pts: it.pts.slice(it.pts.findIndex((p) => Math.hypot(p.x - 30, p.y - 30) >= 12)) }));
    const outerReport = crossingReport(outer, 3600);
    assert.ok(outerReport.longestUncrossed < 8, `longest ${outerReport.longestUncrossed}`);
  }
});

test('short inner waves taper towards a smooth spiral without widening the centre', () => {
  const { layers, extra } = rosetteLayers(boundaryFor(60, 60), { spacing: 4, lobes: 40, depth: 1, hub: 0 });
  assert.equal(extra.open, 0);
  assert.ok(Math.hypot(layers[0][0][0].x - 30, layers[0][0][0].y - 30) < 1e-9);
  let previous = 0, theta = 0, innerSwing = 0, outerSwing = 0;
  for (const p of layers[0][0]) {
    const a = Math.atan2(p.y - 30, p.x - 30);
    let delta = a - previous;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    theta += delta;
    previous = a;
    const base = 4 * theta / (2 * Math.PI);
    const swing = Math.abs(Math.hypot(p.x - 30, p.y - 30) - base);
    if (base < 2) innerSwing = Math.max(innerSwing, swing);
    if (base > 21 && base < 25) outerSwing = Math.max(outerSwing, swing);
  }
  assert.ok(innerSwing < 0.1, `inner swing ${innerSwing}`);
  assert.ok(outerSwing > 1, `full-depth outer swing ${outerSwing}`);
});

test('a rosette prints as a few strands', () => {
  const { layers } = rosetteLayers(boundaryFor(40, 40), { spacing: 4, lobes: 18, depth: 1.4 });
  const r = layeredResult(machine, material, { width: 40, height: 40, layers });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.strands.length < 60, `${r.strands.length}`);
});
