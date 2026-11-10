import test from 'node:test';
import assert from 'node:assert/strict';
import { clearanceOrder } from '../../site/src/engine/order.js';

// Rings · raised with 3 mm rings crashed ("Maximum call stack size exceeded"): the highest point was found by spreading every
// point of every strand into Math.max. (The card-level checks for the same two defects are in rings-raised-limits.test.js.)

test('clearance ordering copes with strands of more points than a function call can take as arguments', () => {
  const long = { id: 'long', pts: Array.from({ length: 300000 }, (_, i) => ({ x: i * 0.001, y: 0, z: 0.2 })) };
  const high = { id: 'high', pts: [{ x: 10, y: -1, z: 0.4 }, { x: 10, y: 1, z: 0.4 }] };
  const result = clearanceOrder([high, long]);
  assert.equal(result.strands.length, 2);
  assert.equal(result.strands[0].id, 'long', 'the low strand is laid before the high one that crosses it');
});
