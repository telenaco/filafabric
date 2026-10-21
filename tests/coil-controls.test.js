import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COIL_RANGES, COIL_DEFAULTS, COIL_SHAPES, COIL_PATTERNS, COIL_PRESETS, sanitizeCoil, describeCoil, coilParams, presetMatch,
} from '../src/ui/coil-controls.js';
import { generateCoilTextile } from '../src/engine/coil.js';
import { FIELD_IDS } from '../src/engine/fields.js';

test('the defaults are a valid, printable coil', () => {
  const r = generateCoilTextile(coilParams(COIL_DEFAULTS));
  assert.ok(r.loops > 0 && r.crossings > 0);
  assert.deepEqual(sanitizeCoil(COIL_DEFAULTS), COIL_DEFAULTS);
});

test('shapes and patterns come from the engine libraries', () => {
  assert.deepEqual([...COIL_SHAPES].sort(), ['figure8', 'honeycomb', 'looped', 'ring', 'square', 'wave', 'zigzag']);
  assert.deepEqual(COIL_PATTERNS, ['none', ...FIELD_IDS, 'image'], 'and the uploaded picture');
});

test('sanitizeCoil preserves exact values, coerces and drops unknown keys', () => {
  const c = sanitizeCoil({ size: 99, pitch: -1, rowOverlap: '30', width: NaN, shape: 'spiral', pattern: 'nope', hacked: 1, lift: 0.3 });
  assert.equal(c.size, 99);
  assert.equal(c.pitch, COIL_DEFAULTS.pitch);
  assert.equal(c.rowOverlap, 30);
  assert.equal(c.width, COIL_DEFAULTS.width);
  assert.equal(c.shape, COIL_DEFAULTS.shape);
  assert.equal(c.pattern, COIL_DEFAULTS.pattern);
  assert.equal(c.lift, 0.3);
  assert.equal('hacked' in c, false);
  assert.deepEqual(sanitizeCoil(null), COIL_DEFAULTS);
  assert.deepEqual(sanitizeCoil([1, 2]), COIL_DEFAULTS);
});

test('every slider extreme is a valid engine layout', () => {
  for (const size of [COIL_RANGES.size.min, COIL_RANGES.size.max]) {
    for (const pitch of [COIL_RANGES.pitch.min, COIL_RANGES.pitch.max]) {
      for (const rowOverlap of [0, COIL_RANGES.rowOverlap.max]) {
        for (const shape of COIL_SHAPES) {
          const p = coilParams({ ...COIL_DEFAULTS, width: 30, height: 30, size, pitch, rowOverlap, shape });
          assert.doesNotThrow(() => generateCoilTextile(p), JSON.stringify({ size, pitch, rowOverlap, shape }));
        }
      }
    }
  }
});

test('read-outs say how much loops and rows overlap', () => {
  const d = describeCoil(COIL_DEFAULTS);
  assert.equal(d.size, '3 mm loops');
  assert.equal(d.pitch, '5 mm apart');
  assert.equal(d.overlap, 'loops overlap 17%');
  assert.equal(d.rowOverlap, '25% into the row above');
  assert.equal(d.lift, '0.25 mm');
  assert.equal(describeCoil({ ...COIL_DEFAULTS, pitch: 8 }).overlap, 'loops do not touch');
  assert.equal(describeCoil({ ...COIL_DEFAULTS, size: 1, pitch: 10 }).overlap, 'loops close up');
  assert.equal(describeCoil({ ...COIL_DEFAULTS, rowOverlap: 0 }).rowOverlap, 'rows just touch');
  assert.equal(describeCoil({ ...COIL_DEFAULTS, shape: 'wave' }).overlap, 'a plain wave');
});

test('presets are valid, distinct and detected', () => {
  assert.ok(COIL_PRESETS.length >= 3);
  const ids = new Set();
  for (const p of COIL_PRESETS) {
    assert.equal(ids.has(p.id), false);
    ids.add(p.id);
    const merged = sanitizeCoil({ ...COIL_DEFAULTS, ...p.patch });
    for (const [k, v] of Object.entries(p.patch)) assert.equal(merged[k], v, `${p.id}.${k} survives sanitising`);
    assert.equal(presetMatch(merged), p.id);
  }
  assert.equal(presetMatch({ ...COIL_DEFAULTS, size: 4.5, pitch: 13 }), null);
});

test('a pattern gives a sampler that shrinks some loops', () => {
  const plain = coilParams(COIL_DEFAULTS);
  assert.equal(plain.sampler, null);
  const patterned = coilParams({ ...COIL_DEFAULTS, pattern: 'diamondGrid' });
  assert.equal(typeof patterned.sampler, 'function');
  assert.equal(coilParams({ ...COIL_DEFAULTS, rowOverlap: 30 }).rowOverlap, 0.3);
});
