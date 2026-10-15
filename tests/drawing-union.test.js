import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretDrawing, drawingPolylines } from '../src/engine/drawing.js';
import { PolygonBoundary } from '../src/engine/boundary.js';

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
const drawing = (paths, colours) => ({ width: 60, height: 40, paths, styles: colours.map((color) => ({ color, width: 0.45 })) });
const contains = (model, x, y) => new PolygonBoundary(model.rings).contains(x, y);

test('overlapping sibling red shapes are a filled union rather than an even-odd cancellation', () => {
  const vector = drawing([rect(5, 5, 35, 35), rect(25, 5, 55, 35)], ['red', 'red']);
  const model = interpretDrawing(vector);
  assert.equal(contains(model, 30, 20), true);
  assert.equal(contains(model, 10, 20), true);
  assert.equal(contains(model, 50, 20), true);
  assert.equal(contains(model, 2, 20), false);
  assert.equal(model.fills.length, 2, 'source fill descriptions are unchanged');
  assert.equal(model.shapes.length, 2, 'source walls are unchanged');
  assert.equal(drawingPolylines(vector, { edges: 'kept' }).whole.length, 2);
});

test('overlapping blue holes remain empty, with a nested red island restored', () => {
  const paths = [rect(2, 2, 58, 38), rect(10, 8, 32, 32), rect(25, 8, 48, 32), rect(14, 14, 20, 20)];
  const model = interpretDrawing(drawing(paths, ['red', 'blue', 'blue', 'red']));
  assert.equal(contains(model, 29, 24), false, 'blue overlap does not restore material');
  assert.equal(contains(model, 17, 17), true, 'red island inside its blue parent is filled');
  assert.equal(contains(model, 40, 20), false);
  assert.equal(contains(model, 5, 5), true);
});

test('union combines each red fill minus its own holes, including overlaps and nested red islands', () => {
  const paths = [rect(3, 3, 37, 37), rect(12, 10, 22, 30), rect(15, 16, 19, 24), rect(27, 5, 57, 35)];
  const model = interpretDrawing(drawing(paths, ['red', 'blue', 'red', 'red']));
  assert.equal(contains(model, 32, 20), true, 'sibling red overlap remains filled');
  assert.equal(contains(model, 13, 20), false);
  assert.equal(contains(model, 17, 20), true);
  assert.equal(contains(model, 50, 20), true);
});

test('ordinary disjoint fills and clean nested islands retain their original ring order and coordinates', () => {
  const paths = [rect(2, 2, 22, 38), rect(7, 7, 17, 33), rect(10, 12, 14, 26), rect(40, 5, 55, 35)];
  const model = interpretDrawing(drawing(paths, ['red', 'blue', 'red', 'red']));
  assert.deepEqual(model.rings, paths.map((p) => p.slice(0, -1)));
});

test('crossing concave red shapes use their real boundary rather than merged bounding boxes', () => {
  const a = [{ x: 5, y: 5 }, { x: 35, y: 5 }, { x: 35, y: 12 }, { x: 12, y: 12 }, { x: 12, y: 35 }, { x: 5, y: 35 }, { x: 5, y: 5 }];
  const b = [{ x: 25, y: 8 }, { x: 50, y: 8 }, { x: 50, y: 15 }, { x: 32, y: 15 }, { x: 32, y: 32 }, { x: 25, y: 32 }, { x: 25, y: 8 }];
  const model = interpretDrawing(drawing([a, b], ['red', 'red']));
  assert.equal(contains(model, 30, 10), true);
  assert.equal(contains(model, 20, 25), false, 'empty concavity is preserved');
  assert.equal(contains(model, 28, 25), true);
});
