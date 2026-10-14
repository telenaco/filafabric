import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, FIELD_IDS, createField, fieldSlope } from '../src/engine/fields.js';

const grid = (f, w = 100, h = 100, step = 1.3) => {
  const out = [];
  for (let y = 0; y <= h; y += step) for (let x = 0; x <= w; x += step) out.push(f(x, y, w, h));
  return out;
};

test('the ten Blender patterns plus noise and bumps are registered', () => {
  for (const id of ['deepSpiral', 'brick', 'diamondGrid', 'tribalFeathers', 'circuitBoard', 'oceanWaves', 'hexagonCells', 'mountainPeaks', 'lotusPetals', 'lightningBolts', 'noise', 'bumps', 'stripes']) {
    assert.ok(FIELDS[id], id);
    assert.ok(FIELDS[id].label && FIELDS[id].hint, id);
  }
  assert.equal(FIELD_IDS.length, 13);
});

test('every field stays in 0..1, is deterministic, and is not flat', () => {
  for (const id of FIELD_IDS) {
    const a = grid(createField(id));
    const b = grid(createField(id));
    assert.deepEqual(a, b, id);
    assert.ok(a.every((v) => v >= 0 && v <= 1 && Number.isFinite(v)), `${id} range`);
    assert.ok(Math.max(...a) - Math.min(...a) > 0.3, `${id} is flat`);
  }
});

test('narrow swatches give finite values too', () => {
  for (const id of FIELD_IDS) {
    const f = createField(id);
    for (const v of grid(f, 10, 10, 0.7)) assert.ok(v >= 0 && v <= 1, id);
  }
});

test('deepSpiral matches the Blender formula at known points', () => {
  const f = createField('deepSpiral');
  assert.ok(Math.abs(f(0, 0) - 0.5) < 1e-9);
  assert.ok(Math.abs(f(100 / 24, 0) - 1) < 1e-9, 'sin = 1 at a quarter of a cell');
  assert.ok(Math.abs(f(0, 100 / 12) - 1) < 1e-9, 'zn·fz·π = π/2 at zn = 1/12');
});

test('thresholded patterns are continuous: no jump between points 0.05 mm apart', () => {
  for (const id of ['brick', 'circuitBoard', 'lightningBolts']) {
    const f = createField(id);
    let worst = 0;
    for (let y = 0; y <= 60; y += 0.37) for (let x = 0; x < 60; x += 0.05) worst = Math.max(worst, Math.abs(f(x + 0.05, y) - f(x, y)));
    for (let x = 0; x <= 60; x += 0.37) for (let y = 0; y < 60; y += 0.05) worst = Math.max(worst, Math.abs(f(x, y + 0.05) - f(x, y)));
    assert.ok(worst < 0.25, `${id} jumps by ${worst}`);
  }
});

test('thresholded patterns still reach both ends of the range', () => {
  for (const id of ['brick', 'circuitBoard', 'lightningBolts']) {
    const v = grid(createField(id), 100, 100, 0.5);
    assert.ok(Math.max(...v) > 0.95, `${id} never reaches the top`);
    assert.ok(Math.min(...v) < 0.05, `${id} never reaches the bottom`);
  }
});

test('gradients stay printable at the default scale', () => {
  for (const id of FIELD_IDS) assert.ok(fieldSlope(createField(id), 100, 100) <= 2.5, id);
});

test('scale stretches the pattern; seed changes noise only', () => {
  const a = createField('diamondGrid', { scale: 2 });
  const b = createField('diamondGrid');
  assert.ok(Math.abs(a(20, 10) - b(10, 5)) < 1e-9);
  assert.notDeepEqual(grid(createField('noise', { seed: 1 })), grid(createField('noise', { seed: 2 })));
  assert.deepEqual(grid(createField('deepSpiral', { seed: 1 })), grid(createField('deepSpiral', { seed: 9 })));
});

test('smooth widens the ramps of a thresholded pattern', () => {
  const sharp = fieldSlope(createField('circuitBoard', { smooth: 0.5 }), 100, 100, 0.25);
  const soft = fieldSlope(createField('circuitBoard', { smooth: 2 }), 100, 100, 0.25);
  assert.ok(soft < sharp);
});

test('an unknown field is an error, not a silent flat pattern', () => {
  assert.throws(() => createField('nope'), /Unknown field/);
});
