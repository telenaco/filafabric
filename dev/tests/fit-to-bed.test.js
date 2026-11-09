import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleDrawing, fitToBed } from '../../site/src/engine/drawing.js';

test('fitToBed fills the bed less a margin, or the largest piece at a proportion', () => {
  const bed = { width: 250, height: 210 };
  assert.deepEqual(fitToBed(bed), [240, 200]);
  assert.deepEqual(fitToBed(bed, { w: 1000, h: 500 }), [240, 120]); // wide: the width limits it
  assert.deepEqual(fitToBed(bed, { w: 300, h: 600 }), [100, 200]); // tall: the depth limits it
  assert.deepEqual(fitToBed(bed, { w: 10, h: 10, margin: 0 }), [210, 210]);
});

test('scaleDrawing scales the page, every path and the line widths together', () => {
  const drawing = { name: 'big', width: 500, height: 400, paths: [[{ x: 0, y: 0 }, { x: 500, y: 400 }]], styles: [{ color: 'red', width: 2 }] };
  const half = scaleDrawing(drawing, 0.5);
  assert.deepEqual([half.width, half.height], [250, 200]);
  assert.deepEqual(half.paths[0][1], { x: 250, y: 200 });
  assert.equal(half.styles[0].width, 1);
  assert.equal(half.name, 'big');
  assert.equal(scaleDrawing(drawing, 1), drawing);
  assert.equal(drawing.width, 500); // the original is left as it was
});
