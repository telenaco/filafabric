import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPeriod, fitLanes, fitCells } from '../src/engine/repeats.js';
import { waveLines } from '../src/engine/wavegrid.js';
import { boundaryFor } from '../src/engine/layers.js';
import { packCircles, bubblesLayers } from '../src/engine/bubbles.js';
import { chainmailLayers } from '../src/engine/chainmail.js';
import { truchetLayers } from '../src/engine/truchet.js';
import { voronoiLayers } from '../src/engine/voronoi.js';
import { generateWeaveTextile } from '../src/engine/weave.js';
import { lanePoints, fillPitch } from '../src/engine/shapes.js';

test('a period is the nearest that fits a whole number of times; lanes and cells fill the span exactly', () => {
  assert.equal(fitPeriod(100, 6), 100 / 17, '16.7 waves become 17');
  assert.equal(fitPeriod(100, 10.6), 100 / 9, '9.4 become 9');
  assert.equal(fitPeriod(10, 40), 10, 'never fewer than one');
  const lanes = fitLanes(2, 98, 3);
  assert.equal(lanes[0], 2);
  assert.ok(Math.abs(lanes.at(-1) - 98) < 1e-9);
  assert.ok(Math.abs(lanes[1] - lanes[0] - 96 / 32) < 1e-9, '32 equal gaps of 3 mm');
  const cells = fitCells(0, 100, 8);
  assert.equal(cells.count, 13);
  assert.ok(Math.abs(cells.centres[0] - cells.size / 2) < 1e-9 && Math.abs(cells.centres.at(-1) - (100 - cells.size / 2)) < 1e-9);
});

test('the zigzag mesh is whole zigzags edge to edge: no wave cut part-way, no peak cut by the top or bottom', () => {
  for (const [w, h] of [[100, 100], [150, 120], [73, 41]]) {
    const b = boundaryFor(w, h);
    const lines = waveLines(b, { spacing: 3, amplitude: 2, wavelength: 6, shape: 'triangle' });
    const pts = lines.flat();
    // every peak is whole: nothing is flattened against the top or bottom edge (it would sit at 0.3 mm with others)
    assert.ok(Math.min(...pts.map((p) => p.y)) >= 0.3 - 1e-9 && Math.max(...pts.map((p) => p.y)) <= h - 0.3 + 1e-9);
    // a lane starts and ends on its centre line, at the left and the right edge: whole waves
    const lane = lines[0];
    const first = lane.find((p) => p.x < 1e-6), last = lane.find((p) => Math.abs(p.x - w) < 1e-6);
    assert.ok(first && last, `${w} x ${h}: the lane reaches both edges`);
    assert.ok(Math.abs(first.y - last.y) < 1e-6, `${w} x ${h}: it ends where it began, after whole waves`);
  }
});

test('a wavy lane is whole periods from end to end, with no straight lead-in or lead-out', () => {
  for (const shape of ['wave', 'zigzag', 'looped', 'figure8']) {
    const pitch = fillPitch(shape, 97, 6, 2);
    const pts = lanePoints({ shape, length: 97, pitch, size: 2, step: 0.2 });
    // the first point that leaves the centre line is right at the start
    const firstOff = pts.find((p) => Math.abs(p.v) > 0.05);
    assert.ok(firstOff.u < 1.5, `${shape}: it swings from the start (${firstOff.u.toFixed(2)})`);
    assert.ok(Math.abs(pitch - 6) < 0.6, `${shape}: ${pitch.toFixed(2)} mm is near the 6 asked for`);
  }
});

test('every bubble and every backing ring is whole inside the swatch, and the backing is denser than one ring per bubble', () => {
  const b = boundaryFor(80, 60);
  const bubbles = packCircles(b, { size: 4 });
  for (const c of bubbles) assert.ok(c.x - c.r >= 0.5 - 1e-6 && c.y - c.r >= 0.5 - 1e-6 && c.x + c.r <= 79.5 + 1e-6 && c.y + c.r <= 59.5 + 1e-6, 'a whole bubble');
  const { layers, extra } = bubblesLayers(b, { size: 4 });
  for (const p of layers.flat(2)) assert.ok(p.x > 0.3 && p.x < 79.7 && p.y > 0.3 && p.y < 59.7, `nothing cut at the edge: ${p.x}, ${p.y}`);
  assert.ok(extra.gaps > 1.3 * extra.bubbles, `${extra.gaps} backing rings for ${extra.bubbles} bubbles`);
});

test('joined into clusters, every bubble is still printed: a branch that cannot be bridged is toured on its own', () => {
  for (const [w, h, size] of [[60, 45, 5], [100, 60, 4]]) {
    const b = boundaryFor(w, h);
    const tour = bubblesLayers(b, { size, link: true }).layers[0].flat();
    // the strand runs along most of every bubble's rim (the bridges to its neighbours take the rest)
    const cell = 1, grid = new Map();
    for (const p of tour) { const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
    const nearTour = (x, y) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const p of grid.get(`${Math.floor(x / cell) + dx},${Math.floor(y / cell) + dy}`) ?? []) if (Math.hypot(p.x - x, p.y - y) < 0.4) return true;
      }
      return false;
    };
    for (const c of packCircles(b, { size })) {
      const on = Array.from({ length: 24 }, (_, k) => nearTour(c.x + c.r * Math.cos((k * Math.PI) / 12), c.y + c.r * Math.sin((k * Math.PI) / 12))).filter(Boolean).length;
      assert.ok(on >= 14, `${w} x ${h}: a bubble of ${c.r.toFixed(1)} mm at ${c.x.toFixed(0)}, ${c.y.toFixed(0)} has the strand on ${on} of 24 points of its rim`);
    }
  }
});

test('chainmail rings are all whole, and they reach the edges from inside', () => {
  const b = boundaryFor(70, 50);
  const { layers } = chainmailLayers(b, { spacing: 6, ratio: 1.5 });
  const pts = layers.flat(2);
  assert.ok(pts.every((p) => p.x >= 0.3 - 1e-6 && p.x <= 69.7 + 1e-6 && p.y >= 0.3 - 1e-6 && p.y <= 49.7 + 1e-6));
  assert.ok(Math.min(...pts.map((p) => p.x)) < 0.4 && Math.max(...pts.map((p) => p.x)) > 69.6, 'the outer rings touch the side edges');
});

test('Truchet tiles fill the swatch exactly, each way', () => {
  const r = truchetLayers(boundaryFor(73, 41), { tile: 'diagonals', size: 5 });
  assert.equal(r.extra.cols, 15);
  assert.equal(r.extra.rows, 8);
  const xs = r.layers.flat(2).map((p) => p.x);
  assert.ok(Math.min(...xs) < 1e-6 && Math.max(...xs) > 73 - 1e-6, 'diagonals from edge to edge');
});

test('the Voronoi lace closes its edge cells along the edge instead of leaving them open', () => {
  const r = voronoiLayers(boundaryFor(60, 40), { spacing: 8, relax: 4 });
  const walls = r.layers[1].flat();
  // a wall runs along each edge, 0.3 mm in
  for (const onEdge of [(p) => Math.abs(p.x - 0.3) < 1e-6, (p) => Math.abs(p.x - 59.7) < 1e-6, (p) => Math.abs(p.y - 0.3) < 1e-6, (p) => Math.abs(p.y - 39.7) < 1e-6]) {
    assert.ok(walls.filter(onEdge).length > 10, 'a wall along the edge');
  }
});

test('a weave has the same half-cell margin at every edge', () => {
  const r = generateWeaveTextile({ width: 50, height: 37, pitch: 4 });
  // warp pieces run up (one x), weft pieces across (one y)
  const along = (axis) => r.strands.filter((s) => s.pts.every((p) => Math.abs(p[axis] - s.pts[0][axis]) < 1e-6));
  const lowest = (axis) => Math.min(...along(axis).map((s) => s.pts[0][axis]));
  const px = 50 / Math.round(50 / 4), py = 37 / Math.round(37 / 4);
  // the first warp line is half a cell in from the left edge, the first weft line half a cell up from the bottom
  assert.ok(Math.abs(lowest('x') - px / 2) < 0.05, `warp ${lowest('x')}`);
  assert.ok(Math.abs(lowest('y') - py / 2) < 0.05, `weft ${lowest('y')}`);
});
