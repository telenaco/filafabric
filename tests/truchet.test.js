import test from 'node:test';
import assert from 'node:assert/strict';
import { truchetLayers, TILE_IDS } from '../src/engine/truchet.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const items = (layers) => layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k })));

test('diagonals: an X in every cell, so at least one crossing per cell (corners where diagonals meet count too)', () => {
  const { layers, extra } = truchetLayers(boundaryFor(40, 30), { tile: 'diagonals', size: 5, seed: 7 });
  assert.equal(extra.cols * extra.rows, 8 * 6);
  const r = crossingReport(items(layers), 1200);
  assert.ok(r.between >= 48, `${r.between}`);
});

test('the same seed gives the same pattern; another seed differs', () => {
  const b = boundaryFor(40, 30);
  const a = truchetLayers(b, { seed: 3 });
  assert.deepEqual(a, truchetLayers(b, { seed: 3 }));
  assert.notDeepEqual(a.layers[0], truchetLayers(b, { seed: 4 }).layers[0]);
});

test('tiles join into far fewer strands than cells', () => {
  for (const tile of TILE_IDS) {
    const { layers, extra } = truchetLayers(boundaryFor(50, 50), { tile, size: 5, seed: 2 });
    assert.ok(layers[0].length < extra.cols * extra.rows * 0.8, `${tile}: ${layers[0].length} strands for ${extra.cols * extra.rows} cells`);
  }
});

test('arcs flow: neighbouring arcs meet at the edge midpoints, and the layers cross', () => {
  const { layers } = truchetLayers(boundaryFor(40, 40), { tile: 'arcs', size: 5, seed: 5 });
  const longest = Math.max(...layers[0].map((pts) => pts.length));
  assert.ok(longest > 60, `a long curve: ${longest} points`);
  assert.ok(crossingReport(items(layers), 1600).between > 20);
});

test('everything stays inside the swatch and prints', () => {
  for (const tile of TILE_IDS) {
    const { layers } = truchetLayers(boundaryFor(40, 30), { tile, size: 5, seed: 1 });
    for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 40.5 && p.y > -0.5 && p.y < 30.5, tile);
    const r = layeredResult(machine, material, { width: 40, height: 30, layers });
    assert.ok(r.moves.some((m) => m.extrude), tile);
  }
});
