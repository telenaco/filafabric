import test from 'node:test';
import assert from 'node:assert/strict';
import { polygonRegion } from '../src/engine/polygon-region.js';
import { PolygonBoundary } from '../src/engine/boundary.js';

test('disjoint edges sharing spatial cells do not exhaust the polygon interaction budget', () => {
  const rings = Array.from({ length: 600 }, (_, i) => {
    const x = i * 0.00015, w = 0.00003;
    return [{ x, y: 0 }, { x: x + w, y: 0 }, { x: x + w, y: w }, { x, y: w }];
  });
  const material = new PolygonBoundary(rings);
  const result = polygonRegion(rings, (x, y) => material.contains(x, y));
  assert.equal(result.length, 600);
});

test('polygon side probes retain narrow intermediate slivers instead of skipping their long edges', () => {
  const ring = [{x:0,y:0},{x:0.000004,y:0},{x:0.000004,y:1},{x:0,y:1}];
  const boundary = new PolygonBoundary([ring]);
  const result = polygonRegion([ring], (x, y) => boundary.contains(x, y));
  assert.equal(result.length, 1);
  assert.equal(result[0].length, 4);
});
