import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCED_GROUPS, FIELD_LABELS, fieldDefault, changedFields } from '../src/ui/param-schema.js';
import { PRIMARY_KEYS, ADVANCED_DEFAULTS } from '../src/ui/controls.js';
import { FILAMENT_FIELDS } from '../src/ui/filament-settings.js';
import { DEFAULT_TEXTILE } from '../src/engine/params.js';

const fields = ADVANCED_GROUPS.flatMap((g) => g.fields);

test('the Advanced drawer holds the 38 settings that are not primary controls', () => {
  assert.equal(fields.length, 38);
});

test('no Advanced field duplicates a primary control', () => {
  for (const f of fields) assert.equal(PRIMARY_KEYS.includes(f.key), false, f.key);
});

test('every Advanced field is a real engine setting and appears once', () => {
  const seen = new Set();
  for (const f of fields) {
    assert.ok(f.key in DEFAULT_TEXTILE || f.key in ADVANCED_DEFAULTS, `unknown key ${f.key}`);
    assert.equal(seen.has(f.key), false, `duplicate ${f.key}`);
    seen.add(f.key);
  }
});

test('every engine setting is reachable: a primary control, an Advanced field, or owned by a primary control', () => {
  const reachable = new Set([...PRIMARY_KEYS, ...fields.map((f) => f.key), ...FILAMENT_FIELDS.map((f) => f.engineKey).filter(Boolean), 'loop_start_z']);
  for (const key of Object.keys(DEFAULT_TEXTILE)) {
    assert.ok(reachable.has(key), `${key} cannot be changed from the UI`);
  }
});

test('error messages can name every field in plain words', () => {
  for (const f of fields) assert.ok(FIELD_LABELS[f.key], f.key);
});

test('changedFields lists only overrides that differ from the default', () => {
  const speeds = ADVANCED_GROUPS.find((g) => g.id === 'speeds');
  assert.deepEqual(changedFields(speeds, {}), []);
  assert.deepEqual(changedFields(speeds, { speed_base: fieldDefault('speed_base') }), []);
  assert.deepEqual(changedFields(speeds, { fan_travel: 1, speed_base: 99, layer_height: 0.3 }), ['speed_base', 'fan_travel']);
  assert.equal(fieldDefault('amp_xy'), ADVANCED_DEFAULTS.amp_xy);
  assert.equal(fieldDefault('speed_base'), DEFAULT_TEXTILE.speed_base);
});
