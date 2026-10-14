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
    assert.ok(r.longestUncrossed < 8, `longest ${r.longestUncrossed}`);
  }
});

test('the centre is opened so no wave is shorter than 3 mm', () => {
  const { extra } = rosetteLayers(boundaryFor(60, 60), { spacing: 4, lobes: 40, depth: 1, hub: 0 });
  assert.ok((2 * Math.PI * extra.open) / 40 >= 3 - 1e-9, `open ${extra.open}`);
});

test('a rosette prints as a few strands', () => {
  const { layers } = rosetteLayers(boundaryFor(40, 40), { spacing: 4, lobes: 18, depth: 1.4 });
  const r = layeredResult(machine, material, { width: 40, height: 40, layers });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.strands.length < 60, `${r.strands.length}`);
});
