import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, stateToHash, hashToState, sanitizeState, sanitizeOutline, DESIGN_IDS } from '../src/ui/share.js';
import { SQUIGGLE_DEFAULTS } from '../src/ui/squiggle-controls.js';
import { COIL_DEFAULTS } from '../src/ui/coil-controls.js';
import { DESIGNS } from '../src/ui/designs.js';

const newerDefaults = () => Object.fromEntries(DESIGNS.filter((d) => d.status === 'ready' && !d.legacy).map((d) => [d.id, d.defaults()]));
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

test('sanitizeState keeps the design and the squiggle settings', () => {
  const s = sanitizeState({ design: 'squiggle', squiggle: { mode: 'parallel', spacing: 99 } }, known);
  assert.equal(s.design, 'squiggle');
  assert.equal(s.squiggle.mode, 'parallel');
  assert.equal(s.squiggle.spacing, 6);
});

test('a version 1 link without a design opens the loop pile with default squiggle settings', () => {
  const s = sanitizeState({ v: 1, machine: 'prusa-mk3s', primary: { pileHeight: 4 } }, known);
  assert.equal(s.design, DESIGN_IDS[0]);
  assert.equal(s.design, 'loop-pile');
  assert.equal(s.primary.pileHeight, 4);
  assert.deepEqual(s.squiggle, SQUIGGLE_DEFAULTS);
  assert.equal(sanitizeState({ design: 'nope' }, known).design, 'loop-pile');
});

test('an outline survives a link, and anything malformed or oversized is refused', () => {
  const outline = { name: 'heart.svg', rings: [[0, 0, 1, 0, 0.5, 0.8]], rotation: 30 };
  const s = sanitizeState({ outline }, known);
  assert.deepEqual(s.outline, outline);
  assert.deepEqual(decodeState(encodeState({ outline })).outline, outline);
  assert.equal(sanitizeState({}, known).outline, null);
  assert.equal(sanitizeOutline({ rings: [[0, 0, 1, 0]] }), null, 'a ring needs three points');
  assert.equal(sanitizeOutline({ rings: [[0, 0, 5, 0, 0.5, 0.8]] }), null, 'outside the unit box');
  assert.equal(sanitizeOutline({ rings: [[0, 0, 1, 0, 0.5, '0.8']] }), null, 'numbers only');
  assert.equal(sanitizeOutline({ rings: [Array.from({ length: 4002 }, () => 0.5)] }), null, 'too many points');
  assert.equal(sanitizeOutline({ rings: [[0, 0, 1, 0, 0.5, 0.8]], rotation: 999 }).rotation, 180);
  assert.equal(sanitizeOutline({ rings: [[0, 0, 1, 0, 0.5, 0.8]], name: 42 }).name, 'Outline');
});

test('v3 states carry per-design settings; unknown or planned designs fall back to the loop pile', () => {
  const s = sanitizeState({ v: 3, design: 'nope', designs: { nope: { a: 1 } } }, known);
  assert.equal(s.design, 'loop-pile');
  assert.equal(s.v, 3);
  assert.deepEqual(s.designs, newerDefaults(), 'an unknown design id adds nothing; every newer design still has its defaults');
});

test('a version 2 link (squiggle key, no designs) opens identically', () => {
  const s = sanitizeState({ v: 2, design: 'squiggle', squiggle: { mode: 'parallel', spacing: 4 } }, known);
  assert.equal(s.design, 'squiggle');
  assert.equal(s.squiggle.mode, 'parallel');
  assert.equal(s.squiggle.spacing, 4);
  assert.deepEqual(s.designs, newerDefaults());
  assert.deepEqual(s.designs.coil, COIL_DEFAULTS);
});

test('coil settings travel in a link and are sanitised', () => {
  const s = sanitizeState({ v: 3, design: 'coil', designs: { coil: { size: 4, rowOverlap: 999, shape: 'figure8', evil: 1 } } }, known);
  assert.equal(s.design, 'coil');
  assert.equal(s.designs.coil.size, 4);
  assert.equal(s.designs.coil.rowOverlap, 60);
  assert.equal(s.designs.coil.shape, 'figure8');
  assert.equal('evil' in s.designs.coil, false);
  const round = decodeState(encodeState({ v: 3, design: 'coil', designs: { coil: s.designs.coil } }));
  assert.deepEqual(sanitizeState(round, known).designs.coil, s.designs.coil);
});
