import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MOVES, MAX_LOOPS } from '../src/engine/tiler.js';
import { MAX_CROSSINGS } from '../src/engine/crossings.js';
import { layeredResult } from '../src/engine/layers.js';
import { emitStrands } from '../src/engine/emit.js';
import { defaultProfiles } from './helpers.js';

test('full toolpaths have no fixed move, loop or default crossing-count ceiling', () => {
  assert.equal(MAX_MOVES, Infinity);
  assert.equal(MAX_LOOPS, Infinity);
  assert.equal(MAX_CROSSINGS, Infinity);
});

test('the reported 1,287,158-point layout is accepted without changing its selected dimensions', () => {
  const { machine, material } = defaultProfiles();
  const pts = Array.from({ length: 1287158 }, (_, i) => ({ x: 1 + 18 * i / 1287157, y: 10 }));
  const result = layeredResult(machine, material, { width: 20, height: 20, layers: [[pts]] });
  assert.equal(result.cfg.t.sample_width, 20);
  assert.equal(result.cfg.t.sample_height, 20);
  assert.ok(result.gcode.includes('; BODY END'));
});

test('move emission can produce more than 400000 real moves without a quota', () => {
  const pts = Array.from({ length: 400002 }, (_, i) => ({ x: i / 4000, y: 1, z: .2 }));
  assert.equal(emitStrands([{ id: 'large', kind: 'base', pts }]).length, 400003);
});
