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
  // Motion-time metadata is deterministic and includes acceleration/startup without changing the playback clock.
  assert.equal(hash(cross.gcode), '6ca30c8154026c6562ed0819db645be8708a0e234160cc87ad0c3f79d2abb813');
  assert.equal(hash(par.gcode), '9659331e01836e412b4ff150180bc81502d3576f1d44efe375671052a110a8a1');
});
