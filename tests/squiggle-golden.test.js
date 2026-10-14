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
  assert.equal(hash(cross.gcode), '548462231f979cefefdf35bba391782010389025ea83c57e2d9f80c9d6883059');
  assert.equal(hash(par.gcode), 'b669bb5e87a3ef03c79cd7711bf2772f5d48ba96e76f19da4dad7406f0f68a29');
});
