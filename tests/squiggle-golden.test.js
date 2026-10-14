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
  assert.equal(hash(cross.gcode), '993fe7f51777d6dac9e13e8847d4686358943425992bb90a0d702d6d91019912');
  assert.equal(hash(par.gcode), '21471e238c5886172b5078c1640b12c19db7f24ae649b082a242246b8efe5cfa');
});
