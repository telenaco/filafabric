import test from 'node:test';
import assert from 'node:assert/strict';
import { auxeticLayers, maxAuxeticAmplitude, CELL_IDS } from '../src/engine/auxetic.js';
import { boundaryFor, layeredResult, crossingReport } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
/** Lengths of the straight vertical runs (the struts) of the staircases. */
const struts = (layer2) => {
  const out = [];
  for (const pts of layer2) {
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].x - pts[i - 1].x) < 1e-9) run += Math.abs(pts[i].y - pts[i - 1].y);
      else { if (run > 1) out.push(run); run = 0; }
    }
    if (run > 1) out.push(run);
  }
  return out;
};

test('hexagon struts sit at the waists and re-entrant struts at the wide points', () => {
  const b = boundaryFor(60, 40);
  const opts = { rowPitch: 8, period: 10, amplitude: 2 };
  const hex = struts(auxeticLayers(b, { ...opts, cell: 'hexagon' }).layers[1]);
  const re = struts(auxeticLayers(b, { ...opts, cell: 'reentrant' }).layers[1]);
  assert.ok(hex.length > 10 && re.length > 10);
  for (const g of hex) assert.ok(Math.abs(g - (8 - 4)) < 0.2, `hexagon strut ${g}`);
  for (const g of re) assert.ok(Math.abs(g - (8 + 4)) < 0.2, `re-entrant strut ${g}`);
});

test('the zigzag is clamped so neighbouring rows never touch', () => {
  assert.ok(maxAuxeticAmplitude(6) < 3);
  const r = auxeticLayers(boundaryFor(40, 30), { rowPitch: 5, period: 8, amplitude: 4 });
  assert.ok(r.extra.amplitude <= maxAuxeticAmplitude(5) + 1e-9);
});

test('rows are one serpentine and the staircases cross them', () => {
  const { layers } = auxeticLayers(boundaryFor(48, 36), { rowPitch: 6, period: 8, amplitude: 2, cell: 'reentrant' });
  assert.equal(layers[0].length, 1, 'one serpentine of rows');
  assert.ok(layers[1].length >= 5 && layers[1].length <= 10, 'about one staircase per period');
  const items = layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k })));
  const report = crossingReport(items, 48 * 36);
  assert.ok(report.between > 20);
});

test('both cells print, with an outline too', () => {
  const ring = [[{ x: 3, y: 3 }, { x: 47, y: 3 }, { x: 47, y: 20 }, { x: 25, y: 20 }, { x: 25, y: 34 }, { x: 3, y: 34 }]];
  for (const cell of CELL_IDS) {
    const { layers } = auxeticLayers(boundaryFor(50, 36, ring), { rowPitch: 6, period: 8, amplitude: 2, cell });
    const r = layeredResult(machine, material, { width: 50, height: 36, layers, outline: ring });
    assert.ok(r.moves.some((m) => m.extrude), cell);
    assert.ok(r.report.between > 5, cell);
  }
});
