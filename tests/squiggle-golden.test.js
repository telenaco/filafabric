import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateSquiggle, SAMPLERS } from '../src/engine/squiggle.js';
import { defaultProfiles } from './helpers.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');

test('squiggle G-code stays byte-identical (cross and parallel)', () => {
  const { machine, material } = defaultProfiles();
  const cross = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'cross', sampler: SAMPLERS.waves });
  const par = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'parallel', colorChange: true });
  // (whole repeats: the columns are a whole number of waves long, from 2026-10-15)
  // (row order: each layer keeps the order and direction it was laid in, from 2026-10-21; the same segments as before)
  assert.equal(hash(cross.gcode), '8f70beb9fcf324cf8aebf2a094e18a0bafaa7ed0f1030fe3ccb1a629a7f53ae7');
  assert.equal(hash(par.gcode), '56e1c9932466910c0ea3a639b993c3c9ea9cbf1f668538c3e308f37b6e8fd50f');
});
