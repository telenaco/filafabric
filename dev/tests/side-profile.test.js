import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { sideProfile, defaultSection } from '../../site/src/engine/side-profile.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const design = (id) => DESIGNS.find((mod) => mod.id === id);
const generated = (id) => {
  const mod = design(id), settings = { ...mod.defaults(), width: 40, height: 30 };
  return mod.generate(machine, material, settings, {});
};

test('a crosshatch side profile shows both settled Z levels', () => {
  const result = generated('crosshatch');
  const profile = sideProfile(result.strands, defaultSection(result));
  assert.ok(new Set(profile.map((p) => p.z.toFixed(3))).size >= 2);
});

test('a relief side profile spans the relief height', () => {
  const result = generated('relief');
  const profile = sideProfile(result.strands, defaultSection(result));
  assert.ok(Math.max(...profile.map((p) => p.z)) - Math.min(...profile.map((p) => p.z)) > 0.5);
});

test('a flat net has one Z level and section samples stay inside the swatch', () => {
  const result = generated('starlattice');
  const section = defaultSection(result);
  const profile = sideProfile([{ family: 'L1', role: 'native', pts: [{ x: 0, y: 15, z: 0.2 }, { x: 40, y: 15, z: 0.2 }] }], section);
  assert.equal(new Set(profile.map((p) => p.z.toFixed(3))).size, 1);
  assert.ok(profile.every((p) => p.s >= 0 && p.s <= 20));
});

test('a zero-length section returns no samples', () => {
  assert.deepEqual(sideProfile([{ pts: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }] }], { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }), []);
});
