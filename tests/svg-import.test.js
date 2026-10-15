import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaths, outlineFromVector, composeSvgLines } from '../src/engine/svg-lines.js';
import { unflattenRings } from '../src/engine/outline.js';
import { sanitizeOutline } from '../src/ui/share.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const square = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
const circle = (cx, cy, r, n = 60) => Array.from({ length: n + 1 }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * (i % n)) / n), y: cy + r * Math.sin((2 * Math.PI * (i % n)) / n) }));

test('a path that comes back to its start is a shape; the rest are lines; specks are lines too', () => {
  const { closed, open } = classifyPaths([square(5, 5, 30, 20), [{ x: 0, y: 0 }, { x: 10, y: 10 }], square(1, 1, 0.1, 0.1), [{ x: 0, y: 0 }]]);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].length, 4, 'the repeated end point is dropped');
  assert.equal(open.length, 2, 'the line and the speck');
});

test('the shapes of a drawing become an outline that stays registered to its lines', () => {
  const vector = { name: 'badge.svg', width: 120, height: 80, paths: [square(10, 8, 100, 60), circle(60, 38, 14), [{ x: 0, y: 0 }, { x: 20, y: 5 }]] };
  const o = outlineFromVector(vector);
  assert.equal(o.name, 'badge.svg shapes');
  assert.deepEqual(o.page, [120, 80]);
  assert.equal(o.rings.length, 2, 'the square and the circle (the hole)');
  assert.ok(o.rings.flat().every((n) => n >= 0 && n <= 1));
  // measured in the longer side of the drawing: multiplying back gives the drawing's own millimetres
  const rings = unflattenRings(o.rings).map((r) => r.map((p) => ({ x: p.x * 120, y: p.y * 120 })));
  const xs = rings[0].map((p) => p.x), ys = rings[0].map((p) => p.y);
  assert.ok(Math.abs(Math.min(...xs) - 10) < 0.1 && Math.abs(Math.max(...xs) - 110) < 0.1);
  assert.ok(Math.abs(Math.min(...ys) - 8) < 0.1 && Math.abs(Math.max(...ys) - 68) < 0.1);
  assert.equal(outlineFromVector({ name: 'lines', width: 50, height: 50, paths: [[{ x: 0, y: 0 }, { x: 40, y: 40 }]] }), null);
});

test('a detailed drawing is simplified until its outline is small enough to save', () => {
  const wavy = Array.from({ length: 6001 }, (_, i) => {
    const t = (2 * Math.PI * (i % 6000)) / 6000;
    return { x: 50 + 40 * Math.cos(t) * (1 + 0.04 * Math.sin(40 * t)), y: 50 + 40 * Math.sin(t) * (1 + 0.04 * Math.sin(40 * t)) };
  });
  const o = outlineFromVector({ name: 'wavy', width: 100, height: 100, paths: [wavy] });
  assert.ok(o.rings.reduce((n, r) => n + r.length / 2, 0) <= 1800);
  assert.ok(sanitizeOutline(o) !== null, 'it survives being saved and shared');
});

test('a saved outline keeps the size of the drawing it is registered to, and drops a nonsense one', () => {
  const rings = [[0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9]];
  assert.deepEqual(sanitizeOutline({ name: 'x', rings, rotation: 0, page: [120, 80] }).page, [120, 80]);
  assert.equal(sanitizeOutline({ name: 'x', rings, rotation: 0, page: [0, 80] }).page, undefined);
  assert.equal(sanitizeOutline({ name: 'x', rings, rotation: 0, page: 'wide' }).page, undefined);
  assert.equal(sanitizeOutline({ name: 'x', rings, rotation: 0 }).page, undefined, 'older outlines are unchanged');
});

test('a drawing that is also the outline keeps the line along its own edge', () => {
  const { machine, material } = defaultProfiles();
  const vector = { name: 'edge', width: 40, height: 40, paths: [square(0, 0, 40, 40)] };
  const outline = [square(0, 0, 40, 40).slice(0, 4)];
  const card = designById('crosshatch');
  const result = card.generate(machine, material, { ...card.defaults(), width: 40, height: 40 }, { outline });
  assert.equal(composeSvgLines(result, vector, { clipLines: true }).vector.paths, 0, 'trimmed to the boundary it lies on');
  assert.equal(composeSvgLines(result, vector, { clipLines: false }).vector.paths, 1, 'kept whole');
});

test('a line across a hole of the drawing that is the outline is printed, not trimmed away', () => {
  const { machine, material } = defaultProfiles();
  const rings = [square(0, 0, 40, 40), square(10, 10, 20, 20)];
  const vector = { name: 'frame', width: 40, height: 40, paths: [...rings, [{ x: 5, y: 20 }, { x: 35, y: 20 }]], styles: [{ color: 'red', width: 0.25 }, { color: 'blue', width: 0.25 }, { color: 'other', width: 0.45 }] };
  const outline = outlineFromVector(vector);
  const card = designById('crosshatch');
  const placed = unflattenRings(outline.rings).map((r) => r.map((p) => ({ x: p.x * 40, y: p.y * 40 })));
  const result = card.generate(machine, material, { ...card.defaults(), width: 40, height: 40 }, { outline: placed });
  const trimmed = composeSvgLines(result, vector, { clipLines: true });
  const whole = composeSvgLines(result, vector, { clipLines: false });
  const lineLength = (r) => r.strands.filter((s) => s.name === 'Imported SVG lines' && !s.shape).reduce((n, s) => n + s.pts.slice(1).reduce((m, p, i) => m + Math.hypot(p.x - s.pts[i].x, p.y - s.pts[i].y), 0), 0);
  assert.ok(lineLength(whole) > 29, 'the whole 30 mm line is printed');
  assert.ok(lineLength(trimmed) < 12, 'trimmed to the frame it is only the two bits in the frame');
  assert.equal(whole.fabric.issues.some((i) => /leave the outline/.test(i)), false, 'a drawn line is not checked against the outline');
});
