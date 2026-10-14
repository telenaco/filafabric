import test from 'node:test';
import assert from 'node:assert/strict';
import { growField, turingLayers } from '../src/engine/turing.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const box = { minX: 0, minY: 0, maxX: 50, maxY: 50 };

test('the field settles into a pattern: some cells high, most low, and it repeats for a seed', () => {
  const a = growField(box, { wavelength: 7, seed: 3 });
  const b = growField(box, { wavelength: 7, seed: 3 });
  assert.deepEqual(a.data, b.data);
  const c = growField(box, { wavelength: 7, seed: 4 });
  assert.notDeepEqual(a.data, c.data);
  const max = Math.max(...a.data);
  assert.ok(max > 0.1, `the pattern grew (max ${max})`);
  const high = [...a.data].filter((v) => v > max / 2).length / a.data.length;
  assert.ok(high > 0.05 && high < 0.7, `a share of the field is stripe: ${high}`);
});

test('stripes are about one wavelength apart', () => {
  const wavelength = 8;
  const f = growField(box, { wavelength, seed: 5 });
  const max = Math.max(...f.data);
  // count threshold crossings along the middle row: each stripe gives two
  const y = Math.floor(f.ny / 2);
  let crossings = 0;
  for (let x = 1; x < f.nx; x++) {
    if ((f.data[y * f.nx + x - 1] > max / 2) !== (f.data[y * f.nx + x] > max / 2)) crossings++;
  }
  const stripes = crossings / 2;
  const expected = 50 / wavelength;
  assert.ok(stripes > expected * 0.4 && stripes < expected * 2.5, `${stripes} stripes along 50 mm at wavelength ${wavelength}`);
});

test('layer 1 is closed contours inside the swatch and layer 2 crosses them', () => {
  const { layers, extra } = turingLayers(boundaryFor(50, 50), { wavelength: 7, seed: 2, angle: 45, spacing: 5 });
  assert.ok(extra.loops >= 2, `${extra.loops} loops`);
  for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5);
  const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
  assert.ok(r.between > 30, `${r.between}`);
});

test('it prints, in reasonable time', () => {
  const started = Date.now();
  const { layers } = turingLayers(boundaryFor(80, 60), { wavelength: 7, seed: 1 });
  const r = layeredResult(machine, material, { width: 80, height: 60, layers });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(Date.now() - started < 8000, `${Date.now() - started} ms`);
});
