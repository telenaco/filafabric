import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBase } from '../src/engine/base.js';

const opts = { bbox: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, spacing: 5, cornerRadius: 1, z: 0.2, resolution: 0.4 };

test('100 x 100 at 5 mm spacing: starts at the origin, ends at the opposite corner', () => {
  const { points } = buildBase(opts);
  assert.deepEqual([points[0].x, points[0].y], [0, 0]);
  const last = points[points.length - 1];
  assert.ok(Math.abs(last.x - 100) < 1e-9 && Math.abs(last.y - 100) < 1e-9);
});

test('length is about 21 lines of 100 mm plus 20 edge steps, minus fillet savings', () => {
  const { length } = buildBase(opts);
  assert.ok(length > 2175 && length < 2200, `length ${length}`);
});

test('every point stays inside the bbox, at the requested z, with no duplicates', () => {
  const { points } = buildBase(opts);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    assert.ok(p.x >= -1e-9 && p.x <= 100 + 1e-9 && p.y >= -1e-9 && p.y <= 100 + 1e-9);
    assert.equal(p.z, 0.2);
    if (i > 0) assert.ok(Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1e-9);
  }
});

test('lines alternate direction: y=0 runs +x, y=5 runs -x', () => {
  const { points } = buildBase(opts);
  const row0 = points.filter((p) => Math.abs(p.y) < 1e-9);
  assert.ok(row0[row0.length - 1].x > row0[0].x);
  const row5 = points.filter((p) => Math.abs(p.y - 5) < 1e-9);
  assert.ok(row5[row5.length - 1].x < row5[0].x);
});

test('no fillets (radius 0) gives sharp turns and still one path', () => {
  const { points, length } = buildBase({ ...opts, cornerRadius: 0 });
  assert.ok(Math.abs(length - (21 * 100 + 20 * 5)) < 1e-6);
  assert.ok(points.length >= 2 * 21);
});

test('a single line when the height is less than the spacing', () => {
  const { points } = buildBase({ ...opts, bbox: { minX: 0, minY: 0, maxX: 20, maxY: 3 } });
  assert.equal(points.length, 2);
  assert.deepEqual([points[1].x, points[1].y], [20, 0]);
});

test('fillet radius is clamped to half the spacing', () => {
  const { points } = buildBase({ ...opts, cornerRadius: 10 });
  for (const p of points) assert.ok(p.x >= -1e-9 && p.x <= 100 + 1e-9);
});
