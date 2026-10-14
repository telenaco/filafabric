import test from 'node:test';
import assert from 'node:assert/strict';
import { reliefHeight, reliefPlacements, generateRelief } from '../src/engine/relief.js';
import { fringePlacements, generateFringe } from '../src/engine/fringe.js';
import { createField } from '../src/engine/fields.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { ConfigError } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('relief height is zero below the floor, smooth above it, and the full relief at 1', () => {
  assert.equal(reliefHeight(0, 2), 0);
  assert.equal(reliefHeight(0.3, 2), 0);
  assert.equal(reliefHeight(1, 2), 2);
  const mid = reliefHeight(0.65, 2);
  assert.ok(mid > 0.9 && mid < 1.1);
});

test('a rectangle is one strand of rows that rises with the pattern and lands on the bed at its edges', () => {
  const field = createField('bumps', { scale: 0.5 });
  const r = reliefPlacements({ width: 40, height: 20, field, relief: 2, rowPitch: 4 });
  assert.equal(r.placements.length, 1);
  assert.ok(r.peak > 1 && r.peak <= 2 + 1e-9);
  const pts = r.placements[0].points;
  assert.equal(pts[0].z, 0, 'starts on the bed');
  assert.equal(pts[pts.length - 1].z, 0, 'ends on the bed');
  assert.ok(pts.some((p) => p.z > 0.5) && pts.some((p) => p.z === 0));
  assert.ok(r.longestSpan > 0);
  assert.ok(r.maxSlopeDeg > 0);
});

test('no climb is steeper than the limit, and a bump too narrow to climb is cut down', () => {
  const narrow = reliefPlacements({ width: 40, height: 10, field: createField('stripes', { scale: 0.15 }), relief: 3, rowPitch: 4, maxSlopeDeg: 25 });
  assert.ok(narrow.maxSlopeDeg <= 25.5, `slope ${narrow.maxSlopeDeg}`);
  assert.ok(narrow.peak < 3 - 0.5, 'a 2.5 mm ridge cannot reach 3 mm at 25 degrees');
  const broad = reliefPlacements({ width: 80, height: 10, field: createField('stripes', { scale: 1.5 }), relief: 1, rowPitch: 4, maxSlopeDeg: 25 });
  assert.ok(broad.peak > 0.99, 'a broad ridge keeps its full height');
  for (const [pattern, scale] of [['bumps', 0.5], ['oceanWaves', 1], ['diamondGrid', 1], ['noise', 1], ['lightningBolts', 1]]) {
    const r = reliefPlacements({ width: 50, height: 20, field: createField(pattern, { scale }), relief: 3, rowPitch: 3 });
    assert.ok(r.maxSlopeDeg <= 25.5, `${pattern}: ${r.maxSlopeDeg}`);
  }
});

test('no raised stretch is longer than the span limit: a long run is anchored on the bed', () => {
  const field = () => 1; // a pattern that is high everywhere would be one 80 mm raised strand
  const r = reliefPlacements({ width: 80, height: 10, field, relief: 2, rowPitch: 4, maxSpan: 16 });
  assert.ok(r.longestSpan <= 16.5, `span ${r.longestSpan}`);
  assert.ok(r.peak > 1, 'and it still rises between the anchors');
  const bumps = reliefPlacements({ width: 50, height: 50, field: createField('bumps', { scale: 0.5 }), relief: 2, rowPitch: 3 });
  assert.ok(bumps.longestSpan <= 16.5, `bumps span ${bumps.longestSpan}`);
});

test('with no pattern every row is flat', () => {
  const r = reliefPlacements({ width: 30, height: 12, field: null, relief: 3, rowPitch: 4 });
  assert.equal(r.peak, 0);
  assert.equal(r.longestSpan, 0);
});

test('an outline gives strands inside it and no print across a gap', () => {
  const ring = [{ x: 3, y: 2 }, { x: 37, y: 2 }, { x: 37, y: 18 }, { x: 22, y: 18 }, { x: 22, y: 9 }, { x: 3, y: 9 }];
  const r = reliefPlacements({ width: 40, height: 20, field: createField('stripes'), relief: 1.5, rowPitch: 3, boundary: new PolygonBoundary([ring]) });
  assert.ok(r.placements.length >= 1);
  for (const p of r.placements) {
    for (let i = 1; i < p.points.length; i++) {
      assert.ok(Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y) < 4, 'no jump across the notch');
    }
  }
});

test('generateRelief returns moves in the air classes, stats and G-code, deterministically', () => {
  const params = { width: 40, height: 20, relief: 2, rowPitch: 4, field: createField('bumps', { scale: 0.5 }) };
  const r = generateRelief(machine, material, params);
  const classes = new Set(r.moves.filter((m) => m.extrude).map((m) => m.cls));
  assert.ok(classes.has('supported'), 'flat parts');
  assert.ok(classes.has('rising') || classes.has('unsupported'), 'raised parts');
  assert.ok(r.stats.timeSec > 0);
  assert.equal(r.stats.hops, 2, 'two crossed backing passes, then the relief');
  assert.equal(r.fabric.components, 1);
  assert.equal(generateRelief(machine, material, params).gcode, r.gcode);
});

test('an absurd relief layout is refused plainly', () => {
  assert.throws(() => generateRelief(machine, material, { width: 240, height: 200, relief: 2, rowPitch: 0.3 }), ConfigError);
});

test('fringe hairs stand on the base lines, rise, and end free; far rows print first', () => {
  const f = fringePlacements({ width: 40, height: 30, length: 12, lift: 3, spacing: 4, rowGap: 5 });
  assert.ok(f.hairs > 20);
  for (const h of f.placements) {
    assert.equal(h.points[0].z, 0, 'anchored on the base');
    const last = h.points[h.points.length - 1];
    assert.ok(Math.abs(last.z - h.lift) < 1e-9, 'ends at its full height');
    assert.ok(last.y <= 30 + 1e-9, 'inside the swatch');
  }
  assert.ok(f.placements[0].row >= f.placements[f.placements.length - 1].row);
  assert.equal(new Set(f.placements.map((h) => h.id)).size, f.hairs);
});

test('fringe variation is seeded: the same seed repeats, another seed differs', () => {
  const a = fringePlacements({ width: 30, height: 20, variation: 60, seed: 4 });
  const b = fringePlacements({ width: 30, height: 20, variation: 60, seed: 4 });
  const c = fringePlacements({ width: 30, height: 20, variation: 60, seed: 5 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.placements.map((h) => h.lift), c.placements.map((h) => h.lift));
  const even = fringePlacements({ width: 30, height: 20, variation: 0 }).placements;
  for (const row of new Set(even.map((p) => p.row))) assert.equal(new Set(even.filter((p) => p.row === row).map((p) => p.lift)).size, 1);
  assert.ok(even.every((p) => p.lift <= 3));
  assert.ok(even.some((p) => p.lift < even.at(-1).lift), 'edge-shortened hairs also become lower');
});

test('generateFringe returns a base, hairs, moves and G-code', () => {
  const r = generateFringe(machine, material, { width: 30, height: 20, length: 10, lift: 2.5, spacing: 4, rowGap: 5 });
  assert.ok(r.base);
  assert.equal(r.placements.length, r.fringe.hairs);
  assert.ok(r.moves.some((m) => m.cls === 'unsupported' || m.cls === 'rising'));
  assert.ok(r.stats.hops > 0);
  assert.ok(r.gcode.includes('G1'));
});

test('too many hairs gives the plain error', () => {
  assert.throws(() => generateFringe(machine, material, { width: 240, height: 200, spacing: 2, rowGap: 3 }), ConfigError);
});
