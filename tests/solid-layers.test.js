import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDesignExport } from '../src/engine/design-export.js';
import { solidStrands } from '../src/engine/svg-solids.js';
import { exportPanel } from '../src/engine/panel.js';
import { sanitizePrint, encodeState, decodeState } from '../src/ui/share.js';
import { defaultProfiles } from './helpers.js';

const ring = [{ x: 4, y: 4 }, { x: 16, y: 4 }, { x: 16, y: 16 }, { x: 4, y: 16 }];
const vector = { name: 'solid.svg', width: 20, height: 20, paths: [[...ring, ring[0]]], styles: [{ color: 'green', width: 0.2 }] };
const input = { ...defaultProfiles(), design: 'zigzag', width: 20, height: 20, vector, extraLayers: 0, brim: 0 };

test('a solid defaults to one infill layer independently of the mesh', () => {
  const r = generateDesignExport(input);
  const fill = r.strands.filter((s) => s.solid !== undefined);
  assert.deepEqual([...new Set(fill.map((s) => s.solidLayer))], [0]);
  assert.ok(fill.every((s) => s.pts.every((p) => Math.abs(p.z - 0.2) < 1e-9)));
  assert.equal(r.solid.layers, 1);
});

test('two solid layers can be requested without repeating the mesh', () => {
  const r = generateDesignExport({ ...input, solidLayers: 2 });
  assert.equal(r.solid.layers, 2);
  assert.deepEqual([...new Set(r.strands.filter((s) => s.solid !== undefined).map((s) => s.solidLayer))], [0, 1]);
});

test('solid layer count survives a saved-state round trip', () => {
  assert.equal(sanitizePrint({}).solidLayers, 1);
  const saved = decodeState(encodeState({ print: sanitizePrint({ solidLayers: 3 }) }));
  assert.equal(sanitizePrint(saved.print).solidLayers, 3);
  for (const solidLayers of [0, -1, 1.5, 9, null, '']) assert.equal(sanitizePrint({ solidLayers }).solidLayers, 1);
});

test('the engine rejects invalid solid layer counts', () => {
  for (const layers of [0, -1, 1.5, 9, NaN]) assert.throws(() => solidStrands([{ ring }], [], { layers }), /solid layers/i);
});

test('streamed panel exports honor the selected solid layer count', async () => {
  for (const solidLayers of [1, 2]) {
    let text = '';
    await exportPanel({ ...input, solidLayers, repeat: 20 }, { write: async (chunk) => { text += chunk; } });
    assert.ok(text.includes(`solid shapes: 1 green, ${solidLayers} layer`));
  }
});

test('changing solid layers preserves both mesh passes and their non-planar geometry', () => {
  const window = [{ x: 6, y: 6 }, { x: 14, y: 6 }, { x: 14, y: 14 }, { x: 6, y: 14 }, { x: 6, y: 6 }];
  const mixed = { ...vector, paths: [...vector.paths, window], styles: [...vector.styles, { color: 'red', width: 0.2 }] };
  const one = generateDesignExport({ ...input, vector: mixed, solidLayers: 1 });
  const two = generateDesignExport({ ...input, vector: mixed, solidLayers: 2 });
  const mesh = (r) => r.strands.filter((s) => s.solid === undefined);
  assert.equal(one.layerPlan.patternLayers, 2);
  assert.equal(two.layerPlan.patternLayers, 2);
  assert.deepEqual(mesh(one), mesh(two), 'solid thickness does not flatten, repeat or reroute the mesh');
  assert.ok(mesh(one).some((s) => s.pts.some((p) => p.z > one.cfg.t.layer_height + 1e-6)), 'raised crossings remain');
});
