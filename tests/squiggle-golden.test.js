import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateSquiggle, SAMPLERS } from '../src/engine/squiggle.js';
import { defaultProfiles } from './helpers.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');

test('squiggle G-code matches the comparison-profile snapshot (cross and parallel)', () => {
  const { machine, material: foamy } = defaultProfiles();
  // Retain this fixture's temperature/travel/seam overrides; flow and width follow the current comparison profile.
  const material = { ...foamy, temperature: { first_layer: 248, print: 248 }, travel_speed_hint: undefined, retraction: { ...foamy.retraction, length: 0, min_travel: 10, z_hop: 0, seam_gap: 0 } };
  const cross = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'cross', sampler: SAMPLERS.waves });
  const par = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'parallel', colorChange: true });
  // (whole repeats: the columns are a whole number of waves long, from 2026-10-15)
  // (row order: each layer keeps the order and direction it was laid in, from 2026-10-21; the same segments as before)
  // Prusa comparison alignment deliberately changes E, speed caps, width and printer-current commands.
  assert.equal(hash(cross.gcode), '5db27b2998139b1cafbbaaefc80892a2ce754adba7e411b13a78e48df69661bf');
  assert.equal(hash(par.gcode), 'd3ff09f62a0a5cb567e5e9cd484683fa9fd8b5aa538848fdd93ea330b0391215');
});
