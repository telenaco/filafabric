import test from 'node:test';
import assert from 'node:assert/strict';
import { stackStrands, stackLayers } from '../src/engine/stack.js';
import { generate } from '../src/engine/generate.js';
import { ConfigError } from '../src/engine/params.js';
import { toTextile, PRIMARY_DEFAULTS } from '../src/ui/controls.js';
import { DESIGNS, designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const line = (id, x0, y0, x1, y1, z = 0.2) => {
  const n = 20;
  return { id, kind: 'base', pts: Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, z })) };
};

test('stacking copies a flat strand a layer higher each time, in the same place', () => {
  const out = stackStrands([line('a', 0, 0, 10, 0)], 3, { layerHeight: 0.2 });
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((s) => Math.round(s.pts[0].z * 100) / 100), [0.2, 0.4, 0.6]);
  for (const s of out) assert.deepEqual([s.pts[0].x, s.pts[0].y, s.pts.at(-1).x], [0, 0, 10]);
  assert.equal(stackStrands([line('a', 0, 0, 10, 0)], 1).length, 1, 'one copy is the strands as they are');
});

test('where strands cross, the copies pile up one layer at a time and never pass through each other', () => {
  const out = stackStrands([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)], 2, { layerHeight: 0.2, strandWidth: 0.45 });
  const at = (s) => s.pts.reduce((best, p) => (Math.abs(p.x - 5) + Math.abs(p.y - 5) < Math.abs(best.x - 5) + Math.abs(best.y - 5) ? p : best)).z;
  const [a1, b1, a2, b2] = out.map(at);
  assert.ok(b1 >= a1 + 0.19, 'the second strand rides over the first');
  assert.ok(a2 >= b1 + 0.19, 'the second copy of the first strand rides over the first copy of the second');
  assert.ok(b2 >= a2 + 0.19);
});

test('a stacked result is a whole new print: more filament, more height, the same fabric', () => {
  const { machine, material } = defaultProfiles();
  const coil = designById('coil');
  const one = coil.generate(machine, material, { ...coil.defaults(), width: 40, height: 40 });
  const three = stackLayers(one, 3);
  assert.equal(three.stack.copies, 3);
  assert.ok(three.stats.filamentMm / one.stats.filamentMm > 2.9 && three.stats.filamentMm / one.stats.filamentMm < 3.2);
  assert.ok(Math.max(...three.strands.flatMap((s) => s.pts.map((p) => p.z))) > Math.max(...one.strands.flatMap((s) => s.pts.map((p) => p.z))) + 0.35);
  assert.equal(three.fabric.components, 1);
  assert.equal(three.fabric.reversedCrossings, 0);
  assert.match(three.gcode, /printed 3 times on top of itself/);
  assert.equal(stackLayers(one, 1), one, 'one layer is the result itself');
});

test('a design of raised loops keeps its own height', () => {
  const { machine, material } = defaultProfiles();
  const r = generate(machine, material, { ...toTextile(PRIMARY_DEFAULTS), sample_width: 30, sample_height: 30 });
  assert.ok(r.placements?.length > 0);
  assert.equal(stackLayers(r, 4), r);
});

test('too many layers of a big pattern are refused plainly', () => {
  const { machine, material } = defaultProfiles();
  const coil = designById('coil');
  const r = coil.generate(machine, material, { ...coil.defaults(), width: 100, height: 100, size: 1, pitch: 1.5 });
  assert.throws(() => stackLayers(r, 40), (e) => e instanceof ConfigError && /moves/.test(e.message));
});

test('the layer thickness chosen reaches every design through the material', () => {
  const { machine, material } = defaultProfiles();
  for (const height of [0.1, 0.3]) {
    const thick = { ...material, print_defaults: { layer_height: height } };
    for (const d of DESIGNS.filter((x) => x.status === 'ready' && !x.legacy)) {
      const s = { ...d.defaults() };
      d.setSize(s, 40, 40);
      const r = d.generate(machine, thick, s);
      assert.equal(r.cfg.t.layer_height, height, `${d.id} at ${height}`);
    }
  }
  const first = (id, h) => designById(id).generate(machine, { ...material, print_defaults: { layer_height: h } }, { ...designById(id).defaults(), width: 40, height: 40 }).strands[0].pts[0].z;
  assert.ok(Math.abs(first('coil', 0.3) - 0.3) < 1e-9, 'the first layer is one layer thick');
  assert.ok(Math.abs(first('coil', 0.1) - 0.1) < 1e-9);
});
