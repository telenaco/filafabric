import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCrossings } from '../src/engine/crossings.js';

const line = (id, x0, y0, x1, y1, z = 0.2, n = 60) => ({
  id,
  kind: 'base',
  pts: Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, z })),
});
const zAt = (strand, x, y) => strand.pts.reduce((best, p) => (Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best)).z;

test('the later strand lifts over the earlier one at a crossing and nowhere else', () => {
  const r = resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)], { lift: 0.25 });
  assert.equal(r.crossings, 1);
  assert.ok(Math.abs(zAt(r.strands[1], 5, 5) - 0.45) < 1e-9);
  assert.equal(zAt(r.strands[1], 5, 0), 0.2);
  assert.equal(zAt(r.strands[1], 5, 10), 0.2);
  assert.ok(r.strands[0].pts.every((p) => p.z === 0.2), 'the earlier strand is untouched');
  assert.ok(Math.abs(r.maxLift - 0.25) < 1e-9);
});

test('the lift ramps smoothly: the default stays under the 17 degree budget', () => {
  const r = resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10, 0.2, 200)], { lift: 0.25 });
  assert.ok(r.maxSlopeDeg < 17, `slope ${r.maxSlopeDeg}`);
  assert.ok(r.maxSlopeDeg > 5, 'and it does ramp');
});

test('lifted points are marked so the preview and the speeds treat them as supported', () => {
  const r = resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)]);
  const lifted = r.strands[1].pts.filter((p) => p.z > 0.2 + 1e-9);
  assert.ok(lifted.length > 3);
  assert.ok(lifted.every((p) => p.cls === 'supported'));
  assert.ok(r.strands[1].pts.filter((p) => p.z === 0.2).every((p) => p.cls === undefined));
});

test('parallel and non-touching strands are left alone', () => {
  const r = resolveCrossings([line('a', 0, 0, 10, 0), line('b', 0, 3, 10, 3)]);
  assert.equal(r.crossings, 0);
  assert.equal(r.maxLift, 0);
});

test('a strand crossing itself lifts its later pass', () => {
  // out along the diagonal, round a loop, and back across the first leg
  const corners = [[0, 0], [8, 8], [8, 0], [4, 4.0001], [0, 8]];
  const pts = [{ x: 0, y: 0, z: 0.2 }];
  for (let c = 1; c < corners.length; c++) {
    const [px, py] = corners[c - 1];
    const [x, y] = corners[c];
    for (let k = 1; k <= 20; k++) pts.push({ x: px + ((x - px) * k) / 20, y: py + ((y - py) * k) / 20, z: 0.2 });
  }
  const r = resolveCrossings([{ id: 's', kind: 'base', pts }]);
  assert.equal(r.crossings, 1);
  assert.ok(r.strands[0].pts.some((p) => p.z > 0.2 && p.cls === 'supported'));
});

test('neighbouring segments of one strand are not crossings (a tight turn)', () => {
  const pts = [{ x: 0, y: 0, z: 0.2 }, { x: 5, y: 0, z: 0.2 }, { x: 5.2, y: 0.4, z: 0.2 }, { x: 0, y: 0.8, z: 0.2 }];
  assert.equal(resolveCrossings([{ id: 's', kind: 'base', pts }]).crossings, 0);
});

test('earlier-over arches the earlier strand instead (weave)', () => {
  const r = resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)], { decide: () => 'earlier-over', arch: 1, archSpan: 3 });
  assert.ok(Math.abs(zAt(r.strands[0], 5, 5) - 1.2) < 1e-9);
  assert.ok(Math.abs(zAt(r.strands[0], 6.2, 5) - 1.2) < 1e-9, 'the plateau spans the arch');
  assert.ok(r.strands[1].pts.every((p) => p.z === 0.2));
});

test('decide sees which strands cross and where', () => {
  const seen = [];
  resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)], { decide: (info) => { seen.push(info); return 'later-over'; } });
  assert.equal(seen.length, 1);
  assert.deepEqual([seen[0].a, seen[0].b], [0, 1]);
  assert.ok(Math.abs(seen[0].x - 5) < 1e-6 && Math.abs(seen[0].y - 5) < 1e-6);
});

test('deterministic, and the input is not mutated', () => {
  const input = [line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)];
  const copy = JSON.stringify(input);
  const a = resolveCrossings(input);
  const b = resolveCrossings(input);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(input), copy);
});

test('a grid of rows over columns finds every crossing once', () => {
  const columns = Array.from({ length: 4 }, (_, i) => line(`c${i}`, 2 + i * 3, 0, 2 + i * 3, 12));
  const rows = Array.from({ length: 3 }, (_, j) => line(`r${j}`, 0, 2 + j * 4, 12, 2 + j * 4));
  assert.equal(resolveCrossings([...columns, ...rows]).crossings, 12);
});

test('a layout with more crossings than the limit is refused plainly instead of being lifted over for minutes', async () => {
  const { resolveCrossings, MAX_CROSSINGS } = await import('../src/engine/crossings.js');
  const { ConfigError } = await import('../src/engine/params.js');
  // a comb of 30 vertical lines crossed by 30 horizontal ones: 900 crossings
  const lines = [];
  for (let i = 0; i < 30; i++) {
    lines.push({ id: `v${i}`, pts: [{ x: i, y: 0, z: 0.2 }, { x: i, y: 29, z: 0.2 }] });
    lines.push({ id: `h${i}`, pts: [{ x: 0, y: i, z: 0.2 }, { x: 29, y: i, z: 0.2 }] });
  }
  assert.ok(MAX_CROSSINGS >= 100000);
  assert.ok(resolveCrossings(lines, { lift: 0.2, strandWidth: 0.45 }).crossings > 800, 'within the limit it works as before');
  assert.throws(() => resolveCrossings(lines, { lift: 0.2, strandWidth: 0.45, maxCrossings: 100 }), (e) => e instanceof ConfigError && /cross each other more than 100 times/.test(e.message));
});
