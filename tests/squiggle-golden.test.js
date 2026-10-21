import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateSquiggle, SAMPLERS } from '../src/engine/squiggle.js';
import { defaultProfiles } from './helpers.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');

test('squiggle G-code stays byte-identical (cross and parallel)', () => {
  const { machine, material: foamy } = defaultProfiles();
  // (Foamy's settings changed on 2026-10-21: retraction on every travel, 238 C, a 0.2 mm lift, 180 mm/s travel, a 0.2 mm
  // seam gap; the geometry is pinned with the settings as they were before)
  const material = { ...foamy, temperature: { first_layer: 248, print: 248 }, travel_speed_hint: undefined, retraction: { ...foamy.retraction, length: 0, min_travel: 10, z_hop: 0, seam_gap: 0 } };
  const cross = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'cross', sampler: SAMPLERS.waves });
  const par = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'parallel', colorChange: true });
  // (whole repeats: the columns are a whole number of waves long, from 2026-10-15)
  // (row order: each layer keeps the order and direction it was laid in, from 2026-10-21; the same segments as before)
  assert.equal(hash(cross.gcode), '8f70beb9fcf324cf8aebf2a094e18a0bafaa7ed0f1030fe3ccb1a629a7f53ae7');
  assert.equal(hash(par.gcode), '56e1c9932466910c0ea3a639b993c3c9ea9cbf1f668538c3e308f37b6e8fd50f');
});
