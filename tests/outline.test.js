import test from 'node:test';
import assert from 'node:assert/strict';
import { PolygonBoundary, RectBoundary } from '../src/engine/boundary.js';
import { serpentineChains, centredLanes } from '../src/engine/fill.js';
import {
  normalizeRings, rotateRings, fitRings, placeOutline, simplifyRing, ringsAspect, ringArea, flattenRings, unflattenRings,
} from '../src/engine/outline.js';
import { generate } from '../src/engine/generate.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const square = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const circle = (cx, cy, r, n = 64) => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) }));
/** A U: a 30 x 30 block with a 10 mm wide, 20 mm deep notch cut from the top. */
const U = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 20, y: 30 }, { x: 20, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }, { x: 0, y: 30 }];

test('polygon contains uses even-odd, so an inner ring is a hole', () => {
  const ring = new PolygonBoundary([square(0, 0, 20, 20), square(5, 5, 15, 15)]);
  assert.equal(ring.contains(2, 2), true);
  assert.equal(ring.contains(10, 10), false, 'inside the hole');
  assert.equal(ring.contains(25, 10), false);
  assert.deepEqual(ring.bbox(), { minX: 0, minY: 0, maxX: 20, maxY: 20 });
});

test('intervals: where a line crosses the outline, in order, around holes', () => {
  const ring = new PolygonBoundary([square(0, 0, 20, 20), square(5, 5, 15, 15)]);
  assert.deepEqual(ring.intervals('y', 10), [[0, 5], [15, 20]]);
  assert.deepEqual(ring.intervals('y', 2), [[0, 20]]);
  assert.deepEqual(ring.intervals('x', 10), [[0, 5], [15, 20]]);
  assert.deepEqual(ring.intervals('y', 30), []);
  assert.deepEqual(new RectBoundary(30, 10).intervals('y', 5), [[0, 30]]);
  assert.deepEqual(new RectBoundary(30, 10).intervals('x', 40), []);
});

test('a rectangle fills with one serpentine strand that alternates direction', () => {
  const strands = serpentineChains(new RectBoundary(30, 20), 'y', [0, 5, 10, 15, 20]);
  assert.equal(strands.length, 1);
  assert.deepEqual(strands[0].map((s) => [s.from, s.to]), [[0, 30], [30, 0], [0, 30], [30, 0], [0, 30]]);
});

test('a concave shape splits into strands instead of printing across the gap', () => {
  const b = new PolygonBoundary([U]);
  const strands = serpentineChains(b, 'y', centredLanes(0, 30, 5), { inset: 0.2, maxJog: 15 });
  assert.ok(strands.length >= 2, `${strands.length} strands`);
  for (const strand of strands) {
    for (const seg of strand) {
      // no segment crosses the notch, and every segment lies inside the shape
      const mid = (seg.from + seg.to) / 2;
      assert.ok(b.contains(mid, seg.c), `segment at y=${seg.c} from ${seg.from} to ${seg.to}`);
      if (seg.c > 10.5) assert.ok(Math.max(seg.from, seg.to) <= 10 || Math.min(seg.from, seg.to) >= 20, 'stays out of the notch');
    }
  }
});

test('centred lanes sit evenly inside the span', () => {
  assert.deepEqual(centredLanes(0, 30, 5), [0, 5, 10, 15, 20, 25, 30]);
  assert.deepEqual(centredLanes(0, 12, 5), [1, 6, 11]);
});

test('normalizeRings flips SVG y, scales the long side to 1 and drops specks', () => {
  // SVG coordinates: a 200 x 100 rectangle, y down, plus a tiny speck
  const rings = normalizeRings([square(100, 50, 300, 150), square(0, 0, 0.1, 0.1)]);
  assert.equal(rings.length, 1, 'the speck is dropped');
  const xs = rings[0].map((p) => p.x), ys = rings[0].map((p) => p.y);
  near(Math.min(...xs), 0); near(Math.max(...xs), 1);
  near(Math.min(...ys), 0); near(Math.max(...ys), 0.5);
  near(ringsAspect(rings), 2);
  // a point near the top of the SVG (small y) ends up near the top of the bed (large y)
  const tri = normalizeRings([[{ x: 0, y: 0 }, { x: 10, y: 100 }, { x: -10, y: 100 }]]);
  const apex = tri[0].find((p) => Math.abs(p.x - 0.1) < 1e-9);
  near(apex.y, 1);
  assert.throws(() => normalizeRings([]), /no closed shapes/);
});

test('fitRings keeps proportions, centres the shape and stays inside the swatch', () => {
  const unit = normalizeRings([square(0, 0, 200, 100)]);
  const fitted = fitRings(unit, 60, 60);
  const ys = fitted[0].map((p) => p.y), xs = fitted[0].map((p) => p.x);
  near(Math.min(...xs), 0); near(Math.max(...xs), 60);
  near(Math.min(...ys), 15); near(Math.max(...ys), 45);
});

test('rotateRings turns the shape about its centre; placeOutline rotates then fits', () => {
  const unit = normalizeRings([square(0, 0, 200, 100)]);
  near(ringsAspect(rotateRings(unit, 90)), 0.5, 1e-9);
  const placed = placeOutline(unit, { rotation: 90, width: 40, height: 40 });
  const ys = placed[0].map((p) => p.y);
  near(Math.max(...ys) - Math.min(...ys), 40, 1e-9);
});

test('simplifyRing keeps the corners of a square traced with many points', () => {
  const traced = [];
  for (let i = 0; i < 40; i++) traced.push({ x: i / 40, y: 0 });
  for (let i = 0; i < 40; i++) traced.push({ x: 1, y: i / 40 });
  for (let i = 0; i < 40; i++) traced.push({ x: 1 - i / 40, y: 1 });
  for (let i = 0; i < 40; i++) traced.push({ x: 0, y: 1 - i / 40 });
  const simple = simplifyRing(traced, 0.001);
  assert.ok(simple.length <= 6, `${simple.length} points`);
  near(ringArea(simple), 1, 1e-9);
});

test('flat ring arrays round-trip', () => {
  const rings = [square(0, 0, 0.5, 0.25)];
  assert.deepEqual(unflattenRings(flattenRings(rings)), rings);
});

test('loop pile in a circle: the base and every loop foot stay inside the outline', () => {
  const outline = [circle(20, 20, 20)];
  const r = generate(machine, material, { sample_width: 40, sample_height: 40 }, { outline });
  const b = new PolygonBoundary(outline);
  assert.ok(r.stats.loops > 10, `${r.stats.loops} loops`);
  for (const pts of r.base.strands) for (const p of pts) assert.ok(b.contains(p.x, p.y), `base point ${p.x},${p.y}`);
  for (const p of r.placements) {
    const a = p.points[0], z = p.points[p.points.length - 1];
    assert.ok(b.contains(a.x, a.y) && b.contains(z.x, z.y), 'feet inside');
  }
  assert.deepEqual(r.outline, outline);
});

test('loop pile in a U: rows sit on the base lines and nothing is laid across the notch', () => {
  const r = generate(machine, material, { sample_width: 30, sample_height: 30, boundary_policy: 'feet-only' }, { outline: [U] });
  assert.ok(r.base.strands.length >= 2, 'the notch splits the base');
  const lanes = new Set(r.base.strands.flat().map((p) => p.y.toFixed(6)));
  for (const p of r.placements) assert.ok(lanes.has(p.footY.toFixed(6)), `row at ${p.footY} is on a base line`);
  for (const m of r.moves) {
    if (m.cls !== 'base') continue;
    assert.ok(!(m.y > 10.5 && m.x > 10.3 && m.x < 19.7), `base move inside the notch at ${m.x},${m.y}`);
  }
});
