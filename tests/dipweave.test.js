import test from 'node:test';
import assert from 'node:assert/strict';
import { dipweaveLayers, MIN_DIP_PITCH } from '../src/engine/dipweave.js';
import { boundaryFor, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('warp and weft are one layer, warp first', () => {
  const { layers } = dipweaveLayers(boundaryFor(40, 30), { warpPitch: 4, weftPitch: 5 });
  assert.equal(layers.length, 1);
  assert.ok(layers[0].length >= 2);
});

test('the weft lies over every warp and dips back to the bed between them', () => {
  const { layers } = dipweaveLayers(boundaryFor(40, 30), { warpPitch: 4, weftPitch: 5 });
  const r = layeredResult(machine, material, { width: 40, height: 30, layers, ramp: 0.8 });
  const zs = r.strands.flatMap((s) => s.pts.map((p) => Number(p.z.toFixed(3))));
  assert.equal(Math.min(...zs), 0.2);
  assert.ok(Math.max(...zs) > 0.2 + 0.2 && Math.max(...zs) <= 0.2 + 0.25 + 1e-9, 'a crossing is one layer or so up');
  const warp = r.strands[0];
  assert.ok(warp.pts.every((p) => Math.abs(p.z - 0.2) < 1e-9), 'the warp stays on the bed');
  const onBed = zs.filter((z) => z === 0.2).length / zs.length;
  assert.ok(onBed > 0.7, `most of the strand is on the bed (${onBed})`);
  assert.ok(r.report.crossings > 40);
});

test('a finer pitch gives more crossings; the floor is a real number', () => {
  const b = boundaryFor(40, 30);
  const crossings = (p) => layeredResult(machine, material, { width: 40, height: 30, layers: dipweaveLayers(b, { warpPitch: p, weftPitch: p }).layers }).report.crossings;
  assert.ok(crossings(3) > crossings(5) * 2);
  assert.ok(MIN_DIP_PITCH >= 2 && MIN_DIP_PITCH <= 3);
});
