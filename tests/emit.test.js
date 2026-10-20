import test from 'node:test';
import assert from 'node:assert/strict';
import { emitStrands } from '../src/engine/emit.js';

const strand = (id, kind, pts, extra = {}) => ({ id, kind, pts, name: id, ...extra });
const P = (x, y, z = 0.2) => ({ x, y, z });

test('the first strand starts with a lift to start height and a drop; strands print in order', () => {
  const m = emitStrands([strand('a', 'base', [P(0, 0), P(5, 0), P(5, 5)])]);
  assert.deepEqual(m.slice(0, 2).map((q) => [q.cls, q.z]), [['travel', 5.2], ['travel', 0.2]]);
  const printed = m.filter((q) => q.extrude);
  assert.equal(printed.length, 2);
  assert.ok(printed.every((q) => q.cls === 'base' && q.tag === 'a'));
});

test('between strands the nozzle lifts above both, travels, and drops', () => {
  const m = emitStrands([strand('a', 'base', [P(0, 0), P(5, 0)]), strand('b', 'supported', [P(0, 9, 0.4), P(5, 9, 0.4)])]);
  const travels = m.filter((q) => !q.extrude).slice(2);
  assert.deepEqual(travels.map((q) => [q.x, q.y, q.z]), [[5, 0, 3.4], [0, 9, 3.4], [0, 9, 0.4]]);
  assert.equal(m.filter((q) => q.extrude && q.tag === 'b')[0].cls, 'supported');
});

test('a point class overrides the strand kind, and pauseBefore inserts M600 once', () => {
  const pts = [P(0, 0), { ...P(1, 0), cls: 'supported' }, P(2, 0)];
  const m = emitStrands([strand('a', 'base', pts), strand('b', 'supported', [P(0, 5), P(3, 5)], { pauseBefore: true })]);
  assert.deepEqual(m.filter((q) => q.extrude && q.tag === 'a').map((q) => q.cls), ['supported', 'base']);
  assert.equal(m.filter((q) => q.customGcode?.startsWith('M600')).length, 1);
});

test('strands with fewer than two points are skipped', () => {
  assert.equal(emitStrands([strand('a', 'base', [P(0, 0)])]).length, 0);
});

test('touching endpoints stay continuous without lifts or retractions and retain classes and flow', () => {
  const m = emitStrands([
    strand('a', 'base', [P(0, 0), P(5, 0)]),
    strand('b', 'supported', [P(5, 0), { ...P(5, 5), flow: 1.4 }]),
  ], { retraction: { length: 1, minTravel: 0 } });
  assert.equal(m.filter(q => !q.extrude).length, 2, 'initial approach only');
  assert.equal(m.filter(q => q.retract).length, 0);
  assert.deepEqual(m.filter(q => q.extrude).map(q => [q.tag, q.cls, q.flow]), [['a', 'base', undefined], ['b', 'supported', 1.4]]);
});

test('touching XY still lifts for a height change or a filament-change pause', () => {
  for (const b of [strand('b', 'supported', [P(5, 0, .4), P(5, 5, .4)]), strand('b', 'supported', [P(5, 0), P(5, 5)], { pauseBefore: true })]) {
    const m = emitStrands([strand('a', 'base', [P(0, 0), P(5, 0)]), b]);
    assert.ok(m.slice(3).some(q => !q.extrude && q.z > 3));
    assert.equal(m.filter(q => q.customGcode?.startsWith('M600')).length, b.pauseBefore ? 1 : 0);
  }
});

test('with a retraction, a long travel retracts first and primes at the next strand; a short one does not', () => {
  const retraction = { length: 1, minTravel: 2 };
  const m = emitStrands([strand('a', 'base', [P(0, 0), P(5, 0)]), strand('b', 'base', [P(0, 9), P(5, 9)]), strand('c', 'base', [P(5, 9.5), P(0, 9.5)])], { retraction });
  assert.equal(m.filter((q) => q.retract === 'retract').length, 1, 'only the 9 mm travel retracts');
  assert.equal(m.filter((q) => q.retract === 'unretract').length, 1);
  const retractAt = m.findIndex((q) => q.retract === 'retract');
  const unretractAt = m.findIndex((q) => q.retract === 'unretract');
  assert.ok(retractAt < unretractAt && m[unretractAt].extrude && m[unretractAt].tag === 'b');
  assert.equal(emitStrands([strand('a', 'base', [P(0, 0), P(5, 0)]), strand('b', 'base', [P(0, 9), P(5, 9)])]).filter((q) => q.retract).length, 0, 'off by default');
});
