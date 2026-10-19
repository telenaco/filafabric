import test from 'node:test';
import assert from 'node:assert/strict';
import { PrintEstimates } from '../src/ui/print-estimates.js';

const result = (width, height, timeSec = 600) => ({ cfg: { t: { sample_width: width, sample_height: height } }, stats: { timeSec, filamentGrams: 2.5, filamentMm: 800 }, moves: Array(1000), gcode: 'large' });

test('sample estimates remain explicitly sampled and are never extrapolated to a garment', () => {
  const cache = new PrintEstimates();
  cache.put('settings', result(100, 100), 500, 450);
  assert.deepEqual(cache.get('settings'), { width: 100, height: 100, full: false, timeSec: 600, filamentGrams: 2.5, filamentMm: 800 });
  assert.equal(cache.get('different-settings'), null, 'a changed size, printer or setting cannot reuse old estimates');
});

test('a matching full-piece estimate survives switching back to a smaller 3D sample', () => {
  const cache = new PrintEstimates();
  cache.put('same', result(500, 450, 7200), 500, 450);
  cache.put('same', result(100, 100, 600), 500, 450);
  assert.equal(cache.get('same').full, true);
  assert.equal(cache.get('same').timeSec, 7200);
  assert.equal(cache.get('same').moves, undefined);
  assert.equal(cache.get('same').gcode, undefined);
});

test('estimate history stays small and ignores failed builds', () => {
  const cache = new PrintEstimates();
  for (let i = 0; i < 20; i++) cache.put(String(i), result(10, 10), 10, 10);
  assert.equal(cache.entries.size, 8);
  cache.put('bad', {}, 10, 10);
  assert.equal(cache.get('bad'), null);
});
