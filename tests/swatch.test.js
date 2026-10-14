import test from 'node:test';
import assert from 'node:assert/strict';
import { swatchCode, fingerprint } from '../src/ui/swatch.js';

test('the same settings give the same code, whatever order they were set in', () => {
  const a = swatchCode('coil', { size: 3, pitch: 5, shape: 'looped' }, { size: [50, 50], preset: 'overlapping' });
  const b = swatchCode('coil', { shape: 'looped', pitch: 5, size: 3 }, { size: [50, 50], preset: 'overlapping' });
  assert.equal(a, b);
  assert.match(a, /^coil-overlapping-50x50-[0-9a-f]{6}$/);
});

test('any change to a setting, the size or the outline changes the code', () => {
  const base = swatchCode('coil', { size: 3 }, { size: [50, 50] });
  assert.notEqual(base, swatchCode('coil', { size: 3.5 }, { size: [50, 50] }));
  assert.notEqual(base, swatchCode('coil', { size: 3 }, { size: [60, 50] }));
  const outline = { name: 'heart.svg', rotation: 0, rings: [[0, 0, 1, 0, 0.5, 1]] };
  assert.notEqual(base, swatchCode('coil', { size: 3 }, { size: [50, 50], outline }));
  assert.notEqual(swatchCode('coil', { size: 3 }, { size: [50, 50], outline }), swatchCode('coil', { size: 3 }, { size: [50, 50], outline: { ...outline, rotation: 45 } }));
});

test('a custom swatch says so, and the fingerprint is six hex digits', () => {
  assert.match(swatchCode('looppile', { pileHeight: 3 }, { size: [30, 30] }), /^looppile-custom-30x30-[0-9a-f]{6}$/);
  assert.match(fingerprint({ a: [1, { b: 2 }] }), /^[0-9a-f]{6}$/);
});
