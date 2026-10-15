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
  assert.equal(hash(cross.gcode), '29ac21ff7f02689b4b3bec470da85d05e81ecfc9369545932cac7e604a988c99');
  assert.equal(hash(par.gcode), '691376ba5e9c168a56030f037205c666ed53263b1d614bd47742e2b6ab6ba5a9');
});
