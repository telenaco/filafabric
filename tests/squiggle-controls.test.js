import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SQ_RANGES, SQUIGGLE_DEFAULTS, SQ_PATTERNS, sanitizeSquiggle, describeSquiggle, sizeForAspect,
} from '../src/ui/squiggle-controls.js';
import { SAMPLERS } from '../src/engine/squiggle.js';

test('every procedural pattern the picker offers exists in the engine', () => {
  for (const p of SQ_PATTERNS) if (p !== 'image') assert.equal(typeof SAMPLERS[p], 'function', p);
});

test('sanitizeSquiggle clamps, coerces and drops unknown keys', () => {
  const s = sanitizeSquiggle({ width: 999, spacing: '3', amplitude: NaN, mode: 'spiral', pattern: 'waves', colorChange: 'yes', evil: 1 });
  assert.equal(s.width, SQ_RANGES.width.max);
  assert.equal(s.spacing, 3);
  assert.equal(s.amplitude, SQUIGGLE_DEFAULTS.amplitude);
  assert.equal(s.mode, SQUIGGLE_DEFAULTS.mode);
  assert.equal(s.pattern, 'waves');
  assert.equal(s.colorChange, false);
  assert.equal('evil' in s, false);
  assert.deepEqual(sanitizeSquiggle(null), SQUIGGLE_DEFAULTS);
  assert.deepEqual(sanitizeSquiggle([1, 2]), SQUIGGLE_DEFAULTS);
});

test('describeSquiggle gives plain read-outs', () => {
  assert.deepEqual(describeSquiggle(SQUIGGLE_DEFAULTS), { spacing: '2.5 mm apart', amplitude: '1.2 mm', wavelength: '4 mm' });
});

test('sizeForAspect keeps a picture\'s proportions with an 80 mm long side', () => {
  assert.deepEqual(sizeForAspect(1200, 800), [80, 53]);
  assert.deepEqual(sizeForAspect(800, 1200), [53, 80]);
  assert.deepEqual(sizeForAspect(500, 500), [80, 80]);
  assert.deepEqual(sizeForAspect(4000, 10), [80, 15], 'a thin strip is clamped to a printable height');
  assert.deepEqual(sizeForAspect(0, 10), [SQUIGGLE_DEFAULTS.width, SQUIGGLE_DEFAULTS.height]);
});
