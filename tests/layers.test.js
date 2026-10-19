import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundaryFor, densify, clipPolyline, hatch, trailsFromEdges, crossingReport, layersToStrands, layeredResult, boundaryArea,
} from '../src/engine/layers.js';
import { findCrossings } from '../src/engine/crossings.js';
import { ConfigError } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const P = (x, y) => ({ x, y });

test('densify keeps the corners and never leaves a gap bigger than the step', () => {
  const d = densify([P(0, 0), P(3, 0), P(3, 2)], 0.5);
  assert.deepEqual(d[0], P(0, 0));
  assert.ok(d.some((p) => p.x === 3 && p.y === 0), 'the corner stays');
  for (let i = 1; i < d.length; i++) assert.ok(Math.hypot(d[i].x - d[i - 1].x, d[i].y - d[i - 1].y) <= 0.5 + 1e-9);
});

test('a polyline is clipped to the boundary and split where it leaves it', () => {
  const b = boundaryFor(10, 10);
  const parts = clipPolyline([P(-5, 5), P(15, 5)], b);
  assert.equal(parts.length, 1);
  assert.ok(parts[0][0].x >= 0 && parts[0][parts[0].length - 1].x <= 10);
  const notch = boundaryFor(10, 10, [[P(0, 0), P(10, 0), P(10, 4), P(5, 4), P(5, 6), P(10, 6), P(10, 10), P(0, 10)]]);
  assert.equal(clipPolyline([P(7, -1), P(7, 11)], notch).length, 2, 'the cut-out splits the line');
});

test('hatch lines at an angle stay inside the boundary and are one serpentine for a rectangle', () => {
  const b = boundaryFor(40, 30);
  for (const angle of [0, 45, 60, 90]) {
    const lines = hatch(b, { angle, spacing: 4 });
    assert.ok(lines.length >= 1, `angle ${angle}`);
    for (const pts of lines) for (const p of pts) assert.ok(p.x > -0.5 && p.x < 40.5 && p.y > -0.5 && p.y < 30.5, `${angle}: ${p.x},${p.y}`);
  }
  assert.equal(hatch(b, { angle: 0, spacing: 4 }).length, 1);
  const lines0 = hatch(b, { angle: 0, spacing: 4 })[0];
  const lines90 = hatch(b, { angle: 90, spacing: 4 })[0];
  assert.ok(lines0.some((p, i) => i && Math.abs(p.y - lines0[i - 1].y) < 1e-9), 'runs along x');
  assert.ok(lines90.some((p, i) => i && Math.abs(p.x - lines90[i - 1].x) < 1e-6), 'runs along y');
});

test('a wavy hatch swings about its line', () => {
  const lines = hatch(boundaryFor(40, 20), { angle: 0, spacing: 6, shape: 'wave', size: 1.5, pitch: 6 });
  const ys = lines[0].map((p) => p.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 6, 'many lines');
  const first = lines[0].filter((p) => p.x > 5 && p.x < 35).slice(0, 80);
  assert.ok(Math.max(...first.map((p) => p.y)) - Math.min(...first.map((p) => p.y)) > 2, 'wavy');
});

test('trails use every edge once, and a path graph is one trail', () => {
  const edges = [[P(0, 0), P(1, 0)], [P(1, 0), P(2, 0)], [P(2, 0), P(3, 0)]];
  assert.equal(trailsFromEdges(edges).length, 1);
  // a plus sign: four edges meeting at one vertex (degree 4, even): two trails of two edges, or one if closed up
  const star = [[P(0, 0), P(1, 0)], [P(0, 0), P(0, 1)], [P(0, 0), P(-1, 0)], [P(0, 0), P(0, -1)]];
  const t = trailsFromEdges(star);
  const total = t.reduce((n, trail) => n + trail.length - 1, 0);
  assert.equal(total, 4, 'every edge used once');
  assert.ok(t.length <= 2);
});

test('the crossing report counts crossings between layers, per cm², and the longest stretch without one', () => {
  const rows = [0, 1, 2, 3].map((k) => ({ pts: [P(0, 2 + k * 4), P(20, 2 + k * 4)], layer: 0 }));
  const cols = [0, 1, 2, 3].map((k) => ({ pts: [P(2 + k * 4, 0), P(2 + k * 4, 20)], layer: 1 }));
  const r = crossingReport([...rows, ...cols], 400);
  assert.equal(r.crossings, 16);
  assert.equal(r.between, 16);
  assert.ok(Math.abs(r.perCm2 - 4) < 1e-9);
  assert.ok(Math.abs(r.minAngle - 90) < 1e-6);
  assert.ok(Math.abs(r.longestUncrossed - 6) < 1e-6, `the last 6 mm of each line has no crossing: ${r.longestUncrossed}`);
  const parallel = crossingReport([{ pts: [P(0, 0), P(20, 0)], layer: 0 }, { pts: [P(0, 3), P(20, 3)], layer: 1 }], 100);
  assert.equal(parallel.crossings, 0);
  assert.equal(parallel.longestUncrossed, 20, 'a parallel pair never crosses: the failure the report exists to show');
});

test('crossing angles are reported as the acute angle', () => {
  const { found } = findCrossings([{ pts: [P(0, 0), P(10, 0)] }, { pts: [P(2, -3), P(8, 3)] }]);
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0].angle - 45) < 1e-6);
});

test('layers are stacked one layer height apart; the first strand of a later layer can pause', () => {
  const strands = layersToStrands([[[P(0, 0), P(10, 0)]], [[P(0, 5), P(10, 5)]], [[P(5, 0), P(5, 10)]]], { layerHeight: 0.2, colorChange: true });
  assert.deepEqual(strands.map((s) => Number(s.pts[0].z.toFixed(3))), [0.2, 0.4, 0.6]);
  assert.deepEqual(strands.map((s) => !!s.pauseBefore), [false, true, true]);
  assert.deepEqual(strands.map((s) => s.kind), ['base', 'supported', 'supported']);
});

test('a strand that crosses itself lifts over its own earlier pass within a layer', () => {
  const loop = densify([P(0, 0), P(10, 10), P(10, 0), P(0, 10)]);
  const [s] = layersToStrands([[loop]], { layerHeight: 0.2 });
  assert.ok(Math.max(...s.pts.map((p) => p.z)) > 0.2 + 0.1);
  assert.ok(s.pts.every((p) => p.cls === undefined));
});

test('layeredResult returns moves, stats, G-code and a report', () => {
  const b = boundaryFor(30, 30);
  const layers = [hatch(b, { angle: 0, spacing: 4 }), hatch(b, { angle: 90, spacing: 4 })];
  const r = layeredResult(machine, material, { width: 30, height: 30, layers });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.report.between > 20);
  assert.equal(r.stats.crossings, r.report.crossings);
  assert.ok(r.gcode.includes('G1'));
});

test('boundaryArea matches a rectangle', () => {
  assert.ok(Math.abs(boundaryArea(boundaryFor(40, 30)) - 1200) < 1);
});
