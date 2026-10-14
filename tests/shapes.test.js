import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, SHAPE_IDS, shapeAt, lanePoints, loopCount, loopsClose } from '../src/engine/shapes.js';

const opts = { pitch: 6, size: 3 };

test('the five shapes are registered with labels', () => {
  assert.deepEqual([...SHAPE_IDS].sort(), ['figure8', 'looped', 'square', 'wave', 'zigzag']);
  for (const id of SHAPE_IDS) assert.ok(SHAPES[id].label && SHAPES[id].hint, id);
});

test('every shape starts at the lane centre with no shift', () => {
  for (const id of SHAPE_IDS) {
    const { v, du } = shapeAt(id, 0, opts);
    assert.ok(Math.abs(v) < 1e-9 && Math.abs(du) < 1e-9, id);
  }
});

test('lateral offset never exceeds the size', () => {
  for (const id of SHAPE_IDS) {
    for (let s = 0; s < 40; s += 0.1) assert.ok(Math.abs(shapeAt(id, s, opts).v) <= 3.0001, id);
  }
});

test('lanePoints runs from 0 to length, ends on the centre, and steps stay small', () => {
  for (const id of SHAPE_IDS) {
    const pts = lanePoints({ shape: id, length: 50, ...opts });
    assert.ok(Math.abs(pts[0].u) < 1e-9 && Math.abs(pts[0].v) < 1e-9, `${id} start`);
    const last = pts[pts.length - 1];
    assert.ok(Math.abs(last.u - 50) < 1e-6 && Math.abs(last.v) < 1e-6, `${id} end`);
    for (let i = 1; i < pts.length; i++) {
      assert.ok(Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v) <= 0.5, `${id} step ${i}`);
    }
  }
});

test('looped goes backwards in u inside each loop; a wave never does', () => {
  const back = (shape) => {
    const pts = lanePoints({ shape, length: 40, ...opts });
    return pts.some((p, i) => i > 0 && p.u < pts[i - 1].u - 1e-9);
  };
  assert.equal(back('looped'), true);
  assert.equal(back('wave'), false);
});

test('loops close up when the size is below pitch / 2π', () => {
  assert.equal(loopsClose(6, 0.9), true);
  assert.equal(loopsClose(6, 1.0), false);
  assert.equal(loopCount(50, 6), 8);
  assert.equal(loopCount(5, 6), 0);
});

test('sizeAt modulates the loop size along the lane', () => {
  const pts = lanePoints({ shape: 'wave', length: 60, pitch: 6, size: 3, sizeAt: (u) => (u < 30 ? 0.4 : 1) });
  const amp = (lo, hi) => Math.max(...pts.filter((p) => p.u >= lo && p.u < hi).map((p) => Math.abs(p.v)));
  assert.ok(amp(0, 30) < 1.4 && amp(30, 60) > 2.8);
});

test('a lane shorter than one period is a plain straight line', () => {
  const pts = lanePoints({ shape: 'looped', length: 4, pitch: 6, size: 3 });
  assert.ok(pts.every((p) => Math.abs(p.v) < 1e-9));
  assert.ok(Math.abs(pts[pts.length - 1].u - 4) < 1e-9);
});
