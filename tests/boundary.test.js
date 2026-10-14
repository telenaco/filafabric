import test from 'node:test';
import assert from 'node:assert/strict';
import { RectBoundary } from '../src/engine/boundary.js';

test('bbox and contains for a 100 x 100 rectangle', () => {
  const b = new RectBoundary(100, 100);
  assert.deepEqual(b.bbox(), { minX: 0, minY: 0, maxX: 100, maxY: 100 });
  assert.ok(b.contains(0, 0));
  assert.ok(b.contains(100, 100));
  assert.ok(b.contains(50, 50));
  assert.ok(!b.contains(100.01, 50));
  assert.ok(!b.contains(-0.01, 50));
});

test('containsPolyline policies', () => {
  const b = new RectBoundary(10, 10);
  const pts = [{ x: 1, y: 1 }, { x: 5, y: 12 }, { x: 9, y: 1 }];
  assert.equal(b.containsPolyline(pts, 'footprint'), false);
  assert.equal(b.containsPolyline(pts, 'feet-only'), true);
  assert.equal(b.containsPolyline([{ x: 1, y: 1 }, { x: 9, y: 9 }], 'footprint'), true);
  assert.equal(b.containsPolyline([], 'footprint'), true);
});

test('float noise at the edge is tolerated', () => {
  const b = new RectBoundary(100, 100);
  assert.ok(b.contains(100 + 1e-12, 100 + 1e-12));
});
