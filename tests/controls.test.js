import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIMARY_DEFAULTS, RANGES, ADVANCED_DEFAULTS, PRIMARY_KEYS, sampleSize, toTextile, sanitizePrimary, describePrimary, overlapPercent,
} from '../src/ui/controls.js';
import { validateTextile, DEFAULT_TEXTILE } from '../src/engine/params.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('the defaults open on a 30 x 30 test swatch with the specified loop geometry', () => {
  const t = toTextile(PRIMARY_DEFAULTS);
  assert.equal(t.sample_width, 30);
  assert.equal(t.sample_height, 30);
  assert.equal(t.loop_z_lift, 3);
  assert.equal(t.loop_width, 6);
  assert.equal(t.loop_length, 15);
  assert.equal(t.loop_pitch, 3);
  assert.equal(t.leg_gap, 0.6);
  assert.equal(t.clearance, 1);
  assert.equal(t.base_spacing, 5);
  assert.equal(t.random_enabled, false);
});

test('full and custom swatches', () => {
  assert.deepEqual(sampleSize({ ...PRIMARY_DEFAULTS, swatch: 'full' }), [100, 100]);
  assert.deepEqual(sampleSize({ ...PRIMARY_DEFAULTS, swatch: 'custom', customWidth: 80, customHeight: 45 }), [80, 45]);
});

test('roomy changes both leg gap and clearance', () => {
  const t = toTextile({ ...PRIMARY_DEFAULTS, roomy: true });
  assert.equal(t.leg_gap, 1.5);
  assert.equal(t.clearance, 0.5);
});

test('loop size scales width and length together and keeps them one decimal', () => {
  const t = toTextile({ ...PRIMARY_DEFAULTS, loopSize: 1.4 });
  near(t.loop_width, 8.4);
  near(t.loop_length, 21);
});

test('variation switches randomness on and scales every amplitude', () => {
  const half = toTextile({ ...PRIMARY_DEFAULTS, variation: 50 });
  assert.equal(half.random_enabled, true);
  near(half.amp_xy, ADVANCED_DEFAULTS.amp_xy * 0.5, 1e-6);
  near(half.amp_orientation, ADVANCED_DEFAULTS.amp_orientation * 0.5, 1e-6);
  const off = toTextile({ ...PRIMARY_DEFAULTS, variation: 0 });
  assert.equal(off.random_enabled, false);
  assert.equal(off.amp_xy, 0);
});

test('advanced amplitudes are the values at 100% variation', () => {
  const t = toTextile({ ...PRIMARY_DEFAULTS, variation: 100 }, { amp_xy: 1 });
  assert.equal(t.amp_xy, 1);
});

test('advanced settings pass through but can never override a primary control', () => {
  const t = toTextile(PRIMARY_DEFAULTS, { speed_base: 9, loop_z_lift: 99, sample_width: 5, leg_gap: 7 });
  assert.equal(t.speed_base, 9);
  assert.equal(t.loop_z_lift, 3);
  assert.equal(t.sample_width, 30);
  assert.equal(t.leg_gap, 0.6);
});

test('every combination of slider extremes is a valid engine configuration', () => {
  const R = RANGES;
  for (const swatch of ['test', 'full']) {
    for (const pileHeight of [R.pileHeight.min, R.pileHeight.max]) {
      for (const loopSize of [R.loopSize.min, R.loopSize.max]) {
        for (const loopSpacing of [R.loopSpacing.min, R.loopSpacing.max]) {
          for (const baseGap of [R.baseGap.min, R.baseGap.max]) {
            for (const variation of [0, 100]) {
              for (const roomy of [false, true]) {
                const p = { ...PRIMARY_DEFAULTS, swatch, pileHeight, loopSize, loopSpacing, baseGap, variation, roomy };
                const errors = validateTextile({ ...DEFAULT_TEXTILE, ...toTextile(p) });
                assert.deepEqual(errors, [], JSON.stringify(p));
              }
            }
          }
        }
      }
    }
  }
});

test('sanitizePrimary clamps, coerces and drops unknown keys', () => {
  const p = sanitizePrimary({ pileHeight: 99, loopSize: -4, loopSpacing: '4', baseGap: NaN, variation: 'lots', swatch: 'huge', roomy: 'yes', hacked: 1 });
  assert.equal(p.pileHeight, RANGES.pileHeight.max);
  assert.equal(p.loopSize, RANGES.loopSize.min);
  assert.equal(p.loopSpacing, 4);
  assert.equal(p.baseGap, PRIMARY_DEFAULTS.baseGap);
  assert.equal(p.variation, PRIMARY_DEFAULTS.variation);
  assert.equal(p.swatch, PRIMARY_DEFAULTS.swatch);
  assert.equal(p.roomy, PRIMARY_DEFAULTS.roomy);
  assert.equal('hacked' in p, false);
  assert.deepEqual(sanitizePrimary(null), PRIMARY_DEFAULTS);
});

test('describePrimary gives plain read-outs', () => {
  const d = describePrimary(PRIMARY_DEFAULTS);
  assert.equal(d.pileHeight, '3 mm');
  assert.equal(d.loopSize, '6 × 15 mm');
  assert.equal(d.loopSpacing, '3 mm apart');
  assert.equal(d.baseGap, '5 mm');
  assert.equal(d.variation, 'Off');
  assert.equal(describePrimary({ ...PRIMARY_DEFAULTS, variation: 40 }).variation, '40%');
});

test('PRIMARY_KEYS lists every engine key the primary controls own', () => {
  for (const k of ['sample_width', 'sample_height', 'loop_z_lift', 'loop_width', 'loop_length', 'loop_pitch', 'leg_gap', 'clearance', 'base_spacing', 'random_enabled']) {
    assert.ok(PRIMARY_KEYS.includes(k), k);
  }
});

test('the spacing read-out says how much neighbouring loops overlap', () => {
  assert.equal(overlapPercent(PRIMARY_DEFAULTS), 50);
  assert.equal(describePrimary(PRIMARY_DEFAULTS).overlap, '50% overlap');
  assert.equal(overlapPercent({ ...PRIMARY_DEFAULTS, loopSize: 0.6, loopSpacing: 6 }), 0);
  assert.equal(describePrimary({ ...PRIMARY_DEFAULTS, loopSize: 0.6, loopSpacing: 6 }).overlap, 'loops don\'t touch');
  assert.equal(describePrimary({ ...PRIMARY_DEFAULTS, roomy: true }).roomy, '1.5 mm at the feet');
});
