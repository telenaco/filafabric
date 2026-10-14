import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';

test('same seed gives the same sequence, different seed differs', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const sa = Array.from({ length: 5 }, () => a.next());
  const sb = Array.from({ length: 5 }, () => b.next());
  const sc = Array.from({ length: 5 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('values stay in [0, 1) and symmetric stays within +-amp', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
  }
  const s = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = s.symmetric(2.5);
    assert.ok(v >= -2.5 && v <= 2.5);
  }
});

test('symmetric(0) is zero but still advances the stream', () => {
  const a = createRng(1), b = createRng(1);
  assert.ok(a.symmetric(0) === 0);
  b.next();
  assert.equal(a.next(), b.next());
});
