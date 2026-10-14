import test from 'node:test';
import assert from 'node:assert/strict';
import { hilbertCells, peanoCells, mazeCells, tspTour, meanderLayers, curveOrder, CURVE_IDS } from '../src/engine/meander.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { findCrossings } from '../src/engine/crossings.js';
import { sites } from '../src/engine/voronoi.js';
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

test('the stipple tour visits every dot once and never crosses itself', () => {
  const dots = sites({ minX: 0, minY: 0, maxX: 50, maxY: 40 }, { spacing: 7, relax: 2, seed: 2 });
  const tour = tspTour(dots);
  assert.equal(tour.length, dots.length);
  assert.equal(new Set(tour.map((p) => `${p.x},${p.y}`)).size, dots.length);
  const closed = [...tour, tour[0]];
  assert.equal(findCrossings([{ pts: closed }], { strandWidth: 0.001 }).found.length, 0);
});

test('the tsp meander is one loop, denser where the tone is bright, and refuses too many dots', () => {
  const b = boundaryFor(60, 40);
  const bright = (x) => (x < 30 ? 1 : 0);
  const { layers } = meanderLayers(b, { curve: 'tsp', cell: 6, seed: 3, tone: bright });
  const pts = layers[0].flat();
  assert.ok(pts.filter((p) => p.x < 30).length > pts.length * 0.55);
  assert.throws(() => meanderLayers(boundaryFor(240, 200), { curve: 'tsp', cell: 4 }), (e) => e.name === 'ConfigError');
  const r = layeredResult(machine, material, { width: 60, height: 40, layers });
  assert.ok(r.moves.some((m) => m.extrude));
});

test('the L-system curves are closed loops or fill their island, and every fold is held', async () => {
  const { lsystemCurve } = await import('../src/engine/meander.js');
  const s = lsystemCurve('sierpinski', 3);
  assert.ok(Math.hypot(s[0].x - s[s.length - 1].x, s[0].y - s[s.length - 1].y) < 1e-6, 'Sierpiński closes');
  const m = lsystemCurve('moore', 3);
  assert.ok(Math.abs(Math.hypot(m[0].x - m[m.length - 1].x, m[0].y - m[m.length - 1].y) - 1) < 1e-6, 'Moore ends next to its start');
  assert.equal(lsystemCurve('gosper', 2).length, 7 ** 2 + 1);
  for (const [curve, angle] of [['moore', 45], ['sierpinski', 30], ['gosper', 60]]) {
    const { layers } = meanderLayers(boundaryFor(50, 50), { curve, cell: 4, angle, spacing: 5 });
    const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
    assert.ok(r.longestUncrossed < 35, `${curve}: ${r.longestUncrossed}`);
    for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5, curve);
  }
});
