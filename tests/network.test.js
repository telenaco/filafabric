import test from 'node:test';
import assert from 'node:assert/strict';
import { joinNetwork } from '../src/engine/network.js';
import { joinStrokes } from '../src/engine/travel.js';
import { orderStrands } from '../src/engine/fabric.js';

const line = (id, pts, extra = {}) => ({ id, layer: 0, kind: 'base', name: 'Layer 1', pts: pts.map(([x, y]) => ({ x, y, z: 0.2 })), ...extra });
const length = (strands) => strands.reduce((n, s) => n + s.pts.slice(1).reduce((m, p, i) => m + Math.hypot(p.x - s.pts[i].x, p.y - s.pts[i].y), 0), 0);
/** Every unit of a drawing as undirected 1 mm pieces, to compare what is printed whatever the strokes. */
const pieces = (strands) => {
  const out = new Map();
  for (const s of strands) {
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
      for (let k = 0; k < n; k++) {
        const p = [a.x + (b.x - a.x) * (k + 0.5) / n, a.y + (b.y - a.y) * (k + 0.5) / n];
        const key = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
        out.set(key, (out.get(key) ?? 0) + 1);
      }
    }
  }
  return out;
};

test('a plus sign drawn as two lines that cross is two strokes, not four, and nothing is printed twice', () => {
  const plus = [line('h', [[0, 5], [10, 5]]), line('v', [[5, 0], [5, 10]])];
  const out = joinNetwork(plus);
  // the crossing has four lines meeting: the four ends are odd, so two strokes
  assert.equal(out.length, 2);
  assert.ok(Math.abs(length(out) - 20) < 1e-6, 'every line once');
  assert.deepEqual([...pieces(out).values()].every((n) => n === 1), true);
});

test('a T is one stroke when its ends are arranged the way a trail needs, and its length is unchanged', () => {
  const t = [line('bar', [[0, 10], [20, 10]]), line('stem', [[10, 10], [10, 0]])];
  const out = joinNetwork(t);
  // three ends are odd (the two ends of the bar and the stem's foot) and the junction is odd: 4 odd nodes, 2 strokes
  assert.equal(out.length, 2);
  assert.ok(Math.abs(length(out) - 30) < 1e-6);
});

test('a star of spokes on a ring needs half as many strokes as it has spokes', () => {
  const ring = Array.from({ length: 49 }, (_, i) => [50 + 20 * Math.cos((i * Math.PI) / 24), 50 + 20 * Math.sin((i * Math.PI) / 24)]);
  const spokes = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    return line(`s${k}`, [[50 + 20 * Math.cos(a), 50 + 20 * Math.sin(a)], [50, 50]]);
  });
  const input = [line('ring', ring), ...spokes];
  const out = joinNetwork(input);
  // 8 spoke ends on the ring and 8 at the hub: the hub has degree 8 (even); the ring nodes have degree 3 (odd): 8 odd nodes, 4 strokes
  assert.equal(out.length, 4, `${out.length} strokes`);
  assert.ok(Math.abs(length(out) - length(input)) < 1e-6, 'the same length is printed');
});

test('separate pieces stay separate and a closed shape on its own is one stroke', () => {
  const out = joinNetwork([line('a', [[0, 0], [5, 0]]), line('b', [[20, 20], [25, 20]]), line('c', [[40, 0], [50, 0], [50, 10], [40, 10], [40, 0]])]);
  assert.equal(out.length, 3);
});

test('a line end that stops a hair short of another line is joined to it by a short step that is allowed', () => {
  const input = [line('bar', [[0, 10], [20, 10]]), line('stem', [[10, 9.7], [10, 0]])];
  const alone = joinNetwork(input, { within: 0.5 });
  const total = length(input);
  // joined: the stem is part of the network, so there are two strokes from three line ends... and the step is printed
  assert.equal(alone.length, 2);
  assert.ok(Math.abs(length(alone) - (total + 0.3)) < 1e-6, 'the 0.3 mm step is added');
  const refused = joinNetwork(input, { within: 0.5, allow: () => false });
  assert.equal(refused.length, 2);
  assert.ok(Math.abs(length(refused) - total) < 1e-6, 'a refused step is not printed');
  assert.equal(joinNetwork(input, { within: 0.1 }).length, 2, 'out of reach, nothing joins');
});

test('strands that are raised, carry flow or belong to another layer are not rebuilt', () => {
  const flat = line('a', [[0, 5], [10, 5]]);
  const raised = { ...line('b', [[5, 0], [5, 10]]), pts: [{ x: 5, y: 0, z: 0.2 }, { x: 5, y: 10, z: 0.6 }] };
  const flow = line('c', [[0, 2], [10, 2]]);
  flow.pts.forEach((p) => { p.flow = 1.4; });
  const upper = line('d', [[5, 0], [5, 10]], { layer: 1 });
  const out = joinNetwork([flat, raised, flow, upper]);
  assert.equal(out.length, 4);
  assert.ok(out.includes(raised) && out.includes(flow) && out.includes(upper));
});

test('a colour-change pause stays on the first stroke of the layer', () => {
  const out = joinNetwork([line('a', [[0, 5], [10, 5]], { pauseBefore: true }), line('b', [[5, 0], [5, 10]])]);
  assert.equal(out.filter((s) => s.pauseBefore).length, 1);
});

test('a lattice exported as separate unit segments becomes a few long strokes, each segment printed once', () => {
  // 8 x 8 cells of 5 mm, every side its own path, as a vector editor writes a wireframe
  const sides = [];
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j < 8; j++) {
      sides.push(line(`h${i}-${j}`, [[j * 5, i * 5], [(j + 1) * 5, i * 5]]));
      sides.push(line(`v${i}-${j}`, [[i * 5, j * 5], [i * 5, (j + 1) * 5]]));
    }
  }
  assert.equal(sides.length, 144);
  const plain = orderStrands(sides, { improve: true });
  const joined = orderStrands(joinStrokes(sides, { within: 0.5 }), { improve: true });
  // 28 border nodes have three sides meeting (odd), so 14 strokes is the least there can be
  assert.ok(joined.length <= 16, `${joined.length} strokes`);
  assert.ok(joined.length >= 14);
  assert.ok(Math.abs(length(joined) - length(sides)) < 1e-6, 'the same drawing');
  assert.deepEqual([...new Set(pieces(joined).values())], [1], 'every unit printed once');
  assert.ok(plain.length >= 100, 'ordered alone they are still a hundred strokes or more');
});

test('a drawing too large to treat is left as it was', () => {
  const many = Array.from({ length: 30 }, (_, k) => line(`l${k}`, [[0, k], [100, k + 0.5]]));
  const out = joinNetwork(many, { maxSegments: 10 });
  assert.equal(out.length, 30);
});
