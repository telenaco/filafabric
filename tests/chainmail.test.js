import test from 'node:test';
import assert from 'node:assert/strict';
import { chainmailLayers } from '../src/engine/chainmail.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const items = (layers) => layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k })));

test('rings have the requested radius and stay inside the swatch', () => {
  const { layers, extra } = chainmailLayers(boundaryFor(40, 30), { spacing: 6, ratio: 1.5 });
  assert.ok(Math.abs(extra.radius - 4.5) < 1e-9);
  for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 40.5 && p.y > -0.5 && p.y < 30.5);
  assert.equal(layers.length, 2);
});

test('each layer-2 ring crosses neighbouring layer-1 rings: the layers hold each other', () => {
  const { layers } = chainmailLayers(boundaryFor(48, 40), { spacing: 6, ratio: 1.5 });
  const r = crossingReport(items(layers), 48 * 40);
  // about one ring per 31 mm² in each layer, six crossings per ring pair set: far more than a handful
  assert.ok(r.between > 100, `${r.between}`);
  assert.ok(r.longestUncrossed < 25, `${r.longestUncrossed}`);
});

test('a larger ratio overlaps more, so there are more crossings', () => {
  const b = boundaryFor(40, 30);
  const count = (ratio) => crossingReport(items(chainmailLayers(b, { spacing: 6, ratio }).layers), 1200).crossings;
  assert.ok(count(1.7) > count(1.2));
});

test('it prints, one layer of rings lifting over its own earlier rings', () => {
  const { layers } = chainmailLayers(boundaryFor(36, 30), { spacing: 6, ratio: 1.5 });
  const r = layeredResult(machine, material, { width: 36, height: 30, layers });
  assert.ok(r.moves.some((m) => m.extrude));
  const z1 = r.strands.filter((s) => s.kind === 'base').flatMap((s) => s.pts.map((p) => p.z));
  assert.ok(Math.max(...z1) > 0.2 + 0.1, 'overlapping rings lift over each other');
});
