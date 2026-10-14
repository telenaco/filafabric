import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, stateToHash, hashToState, sanitizeState } from '../src/ui/share.js';
import { PRIMARY_DEFAULTS } from '../src/ui/controls.js';

const known = { machines: ['prusa-mk3s'], materials: ['filaflex-95-foamy', 'generic-flex-mk3'] };

test('state survives an encode/decode round trip', () => {
  const state = { v: 1, machine: 'prusa-mk3s', material: 'generic-flex-mk3', primary: { ...PRIMARY_DEFAULTS, swatch: 'full', roomy: true }, advanced: { speed_base: 12 } };
  assert.deepEqual(decodeState(encodeState(state)), state);
});

test('the token is url safe', () => {
  const token = encodeState({ v: 1, advanced: { note: '??>>~~' } });
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test('hash helpers', () => {
  const state = { v: 1, machine: 'prusa-mk3s', material: 'filaflex-95-foamy', primary: PRIMARY_DEFAULTS, advanced: {} };
  const hash = stateToHash(state);
  assert.ok(hash.startsWith('#s='));
  assert.deepEqual(hashToState(hash), state);
  assert.equal(hashToState(''), null);
  assert.equal(hashToState('#other=1'), null);
  assert.equal(hashToState('#s=%%%not-base64'), null);
});

test('decodeState returns null for garbage rather than throwing', () => {
  assert.equal(decodeState('???'), null);
  assert.equal(decodeState(''), null);
  assert.equal(decodeState(encodeState(42)), null);
});

test('sanitizeState keeps only known profiles, clamped primary values and known advanced keys', () => {
  const s = sanitizeState(
    { v: 1, machine: 'nope', material: 'generic-flex-mk3', primary: { pileHeight: 50, evil: 1 }, advanced: { speed_base: 9, not_a_param: 1, loop_z_lift: 99 } },
    known
  );
  assert.equal(s.machine, 'prusa-mk3s');
  assert.equal(s.material, 'generic-flex-mk3');
  assert.equal(s.primary.pileHeight, 6);
  assert.equal('evil' in s.primary, false);
  assert.equal(s.advanced.speed_base, 9);
  assert.equal('not_a_param' in s.advanced, false);
  assert.equal('loop_z_lift' in s.advanced, false, 'primary-owned keys are not accepted as advanced overrides');
});

test('sanitizeState tolerates null and wrong shapes', () => {
  const s = sanitizeState(null, known);
  assert.deepEqual(s.primary, PRIMARY_DEFAULTS);
  assert.deepEqual(s.advanced, {});
  const t = sanitizeState({ primary: 'x', advanced: [1, 2] }, known);
  assert.deepEqual(t.advanced, {});
});
