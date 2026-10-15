import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mergeTouching, improveTravel } from '../src/engine/travel.js';
import { orderStrands, travelDistance } from '../src/engine/fabric.js';
import { parseSvg } from '../src/engine/svg-parse.js';
import { linePasses, interpretDrawing } from '../src/engine/drawing.js';
import { composeSvgLines } from '../src/engine/svg-lines.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const seg = (id, x0, y0, x1, y1, extra = {}) => ({ id, layer: 0, kind: 'base', name: 'Layer 1', pts: [{ x: x0, y: y0, z: 0.2 }, { x: x1, y: y1, z: 0.2 }], ...extra });
const poly = (id, pts, extra = {}) => ({ id, layer: 0, kind: 'base', name: 'Layer 1', pts: pts.map(([x, y]) => ({ x, y, z: 0.2 })), ...extra });
const total = (strands) => strands.reduce((n, s) => n + s.pts.slice(1).reduce((m, p, i) => m + Math.hypot(p.x - s.pts[i].x, p.y - s.pts[i].y), 0), 0);

// a small deterministic generator, so these cases are the same on every run
const random = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const scatter = (n, seed, { loops = 0 } = {}) => {
  const r = random(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = r() * 100, y = r() * 100, a = r() * Math.PI * 2, l = 2 + r() * 12;
    if (i < loops) out.push(poly(`c${i}`, [[x, y], [x + 4, y], [x + 4, y + 4], [x, y + 4], [x, y]]));
    else out.push(seg(`s${i}`, x, y, x + l * Math.cos(a), y + l * Math.sin(a)));
  }
  return out;
};

test('strands that touch end to end become one strand, with the short step across included', () => {
  const square = [seg('a', 0, 0, 10, 0), seg('b', 10, 0, 10, 10), seg('c', 10, 10, 0, 10)];
  const merged = mergeTouching(square, { within: 0.1 });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].pts.length, 4, "the shared points are printed once");
  assert.ok(Math.abs(total(merged) - 30) < 1e-9, 'no length is added when the ends meet exactly');
  // given in any order, and with one of them turned round
  const scrambled = mergeTouching([seg('c', 0, 10, 10, 10), seg('a', 0, 0, 10, 0), seg('b', 10, 0, 10, 10)], { within: 0.1 });
  assert.equal(scrambled.length, 1);
});

test('three passes of a wide line join into one back-and-forth stroke', () => {
  const passes = [0, 0.36, 0.72].map((dy, i) => seg(`p${i}`, 0, dy, 20, dy));
  const merged = mergeTouching(passes, { within: 0.45 * 1.1 });
  assert.equal(merged.length, 1);
  assert.ok(Math.abs(total(merged) - (60 + 0.72)) < 1e-9, 'three runs and two steps of 0.36 mm');
  assert.equal(mergeTouching(passes, { within: 0.1 }).length, 3, 'a tighter tolerance leaves them');
});

test('what must stay apart stays apart: other layers, closed shapes, ties, raised strands, pauses are kept', () => {
  const a = seg('a', 0, 0, 10, 0), up = seg('b', 10, 0, 20, 0, { layer: 1 });
  assert.equal(mergeTouching([a, up], { within: 0.5 }).length, 2, 'another layer');
  const ring = poly('r', [[0, 0], [5, 0], [5, 5], [0, 0]]);
  assert.equal(mergeTouching([ring, seg('x', 5, 5, 9, 9)], { within: 0.5 }).length, 2, 'a closed shape');
  const tie = seg('t', 10, 0, 14, 0, { name: 'Structural tie', layer: -1 });
  assert.equal(mergeTouching([a, tie], { within: 0.5 }).length, 2, 'a tie');
  const raised = { ...seg('h', 10, 0, 14, 0), pts: [{ x: 10, y: 0, z: 0.2 }, { x: 14, y: 0, z: 0.6 }] };
  assert.equal(mergeTouching([a, raised], { within: 0.5 }).length, 2, 'a raised strand');
  const paused = mergeTouching([a, seg('p', 10, 0, 20, 0, { pauseBefore: true })], { within: 0.5 });
  assert.equal(paused.length, 1);
  assert.equal(paused[0].pauseBefore, true, 'the pause survives the merge');
  assert.equal(mergeTouching([a, seg('far', 11, 0, 20, 0)], { within: 0.5 }).length, 2, 'a gap wider than the tolerance');
});

test('the improved order never travels further than the greedy one, and usually much less', () => {
  let better = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const strands = scatter(120, seed, { loops: 15 });
    const greedy = orderStrands(strands);
    const improved = orderStrands(strands, { improve: true });
    const g = travelDistance(greedy), i = travelDistance(improved);
    assert.ok(i <= g + 1e-6, `seed ${seed}: ${i.toFixed(1)} against ${g.toFixed(1)}`);
    if (i < g * 0.95) better++;
  }
  assert.ok(better >= 4, `${better} of 6 cases saved at least 5%`);
});

test('improving only reorders and turns strands: every strand is there, with its own points', () => {
  const strands = scatter(80, 9, { loops: 10 });
  const improved = orderStrands(strands, { improve: true });
  assert.equal(improved.length, strands.length);
  assert.deepEqual(improved.map((s) => s.id).sort(), strands.map((s) => s.id).sort());
  const key = (p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
  for (const s of improved) {
    const original = strands.find((t) => t.id === s.id);
    const closed = Math.hypot(original.pts[0].x - original.pts.at(-1).x, original.pts[0].y - original.pts.at(-1).y) < 1e-6;
    if (closed) {
      // the same ring, started somewhere else and closed again
      assert.deepEqual(new Set(s.pts.map(key)), new Set(original.pts.map(key)), s.id);
      assert.equal(key(s.pts[0]), key(s.pts.at(-1)), `${s.id} is still closed`);
    } else {
      const same = s.pts.map(key).join('|') === original.pts.map(key).join('|');
      const turned = s.pts.map(key).join('|') === [...original.pts].reverse().map(key).join('|');
      assert.ok(same || turned, `${s.id} keeps its points, turned or not`);
    }
  }
  assert.ok(Math.abs(total(improved) - total(strands)) < 1e-6, 'the length that is printed is unchanged');
});

test('layers stay in order and only the first strand of a layer carries its colour-change pause', () => {
  const strands = [...scatter(30, 3).map((s) => ({ ...s, layer: 1, pauseBefore: s.id === 's5' })), ...scatter(30, 4).map((s) => ({ ...s, id: `b${s.id}`, layer: 0 }))];
  const out = orderStrands(strands, { improve: true });
  const layers = out.map((s) => s.layer);
  assert.deepEqual(layers, [...layers].sort((a, b) => a - b), 'layer 0 entirely before layer 1');
  assert.equal(out.filter((s) => s.pauseBefore).length, 1);
  assert.equal(out.find((s) => s.pauseBefore).layer, 1);
  assert.equal(out.findIndex((s) => s.pauseBefore), 30, 'it is the first strand of layer 1');
});

test('the same strands always give the same order', () => {
  const strands = scatter(150, 11, { loops: 12 });
  const a = orderStrands(strands, { improve: true }).map((s) => s.id).join();
  const b = orderStrands(strands, { improve: true }).map((s) => s.id).join();
  assert.equal(a, b);
  assert.deepEqual(improveTravel(strands.slice(0, 1), { x: 0, y: 0 }), strands.slice(0, 1));
});

test('the imported example prints its ten wide lines as ten strokes, not thirty, with less travel', () => {
  const { machine, material } = defaultProfiles();
  const card = designById('rosette');
  const result = card.generate(machine, material, { ...card.defaults(), width: 100, height: 100 });
  const v = parseSvg(fs.readFileSync(path.join(projectRoot, 'tests', 'fixtures', 'red-blue-lines.svg'), 'utf8'));
  // fit the 210 x 297 page to a 100 mm swatch in the same proportions of the motif
  const small = { ...v, name: 'example', width: 100, height: 100, paths: v.paths.map((p) => p.map((q) => ({ x: (q.x - 70) * 1.4, y: (q.y - 120) * 1.4 + 10 }))), styles: v.styles.map((s) => ({ ...s, width: s.width })) };
  assert.equal(interpretDrawing(small).lines.length, 10);
  const passes = interpretDrawing(small).lines.reduce((n, l) => n + linePasses(l, 0.45).length, 0);
  const composed = composeSvgLines(result, small);
  const lineStrands = composed.strands.filter((s) => s.name === 'Imported SVG lines' && !s.shape);
  assert.ok(passes >= 20, `${passes} passes`);
  assert.ok(lineStrands.length < passes, `${lineStrands.length} strokes for ${passes} passes`);
  assert.ok(composed.routing.afterMm <= composed.routing.beforeMm + 1e-6);
});
