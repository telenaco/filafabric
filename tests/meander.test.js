import test from 'node:test';
import assert from 'node:assert/strict';
import { hilbertCells, peanoCells, mazeCells, meanderLayers, curveOrder, CURVE_IDS } from '../src/engine/meander.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

const checkCurve = (cells, n) => {
  assert.equal(cells.length, n * n);
  assert.equal(new Set(cells.map((c) => `${c.x},${c.y}`)).size, n * n, 'visits every cell once');
  for (let i = 1; i < cells.length; i++) {
    assert.equal(Math.abs(cells[i].x - cells[i - 1].x) + Math.abs(cells[i].y - cells[i - 1].y), 1, `step ${i} is to a neighbour`);
  }
};

test('the Hilbert curve visits every cell once, always stepping to a neighbour', () => {
  for (const order of [1, 2, 3, 4]) checkCurve(hilbertCells(order), 1 << order);
});

test('the Peano curve visits every cell once, always stepping to a neighbour', () => {
  for (const order of [1, 2, 3]) checkCurve(peanoCells(order), 3 ** order);
});

test('the order follows the cell size', () => {
  assert.equal(curveOrder('hilbert', 64, 8), 3);
  assert.equal(curveOrder('hilbert', 64, 4), 4);
  assert.equal(curveOrder('peano', 54, 6), 2);
  assert.ok(curveOrder('hilbert', 1000, 1) <= 6, 'capped');
});

test('layer 1 never crosses itself and layer 2 crosses it everywhere', () => {
  for (const curve of CURVE_IDS) {
    const { layers } = meanderLayers(boundaryFor(60, 60), { curve, cell: 8, angle: 45, spacing: 5 });
    const single = crossingReport([...layers[0].map((pts) => ({ pts, layer: 0 }))], 3600);
    assert.equal(single.crossings, 0, `${curve} does not cross itself`);
    const both = crossingReport([...layers[0].map((pts) => ({ pts, layer: 0 })), ...layers[1].map((pts) => ({ pts, layer: 1 }))], 3600);
    assert.ok(both.between > 30, `${curve}: ${both.between}`);
  }
});

test('the curve is one strand for a rectangle, stays inside and prints', () => {
  const { layers } = meanderLayers(boundaryFor(48, 36), { curve: 'hilbert', cell: 6 });
  assert.equal(layers[0].length, 1);
  for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 48.5 && p.y > -0.5 && p.y < 36.5);
  const r = layeredResult(machine, material, { width: 48, height: 36, layers });
  assert.ok(r.moves.some((m) => m.extrude));
});

test('the maze meander is one closed cycle through every cell, and a seed repeats it', () => {
  for (const order of [2, 3, 4]) {
    const cells = mazeCells(order, 7);
    const n = 1 << order;
    assert.equal(cells.length, n * n);
    assert.equal(new Set(cells.map((c) => `${c.x},${c.y}`)).size, n * n, 'every cell once');
    for (let i = 1; i <= cells.length; i++) {
      const a = cells[i - 1], b = cells[i % cells.length];
      assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1, `step ${i} (and the closing step) is to a neighbour`);
    }
  }
  assert.deepEqual(mazeCells(3, 5), mazeCells(3, 5));
  assert.notDeepEqual(mazeCells(3, 5), mazeCells(3, 6));
});

test('the maze never crosses itself and prints', () => {
  const { layers } = meanderLayers(boundaryFor(48, 36), { curve: 'maze', cell: 6, seed: 3 });
  const single = crossingReport(layers[0].map((pts) => ({ pts, layer: 0 })), 1728);
  assert.equal(single.crossings, 0);
  const r = layeredResult(machine, material, { width: 48, height: 36, layers });
  assert.ok(r.moves.some((m) => m.extrude));
});
