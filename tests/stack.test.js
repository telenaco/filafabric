import test from 'node:test';
import assert from 'node:assert/strict';
import { stackStrands, stackLayers, addExtraLayers, nativeLayerInfo } from '../src/engine/stack.js';
import { layeredResult } from '../src/engine/layers.js';
import { generate } from '../src/engine/generate.js';
import { ConfigError } from '../src/engine/params.js';
import { toTextile, PRIMARY_DEFAULTS } from '../src/ui/controls.js';
import { DESIGNS, designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { MAX_MOVES } from '../src/engine/tiler.js';

const line = (id, x0, y0, x1, y1, z = 0.2) => {
  const n = 20;
  return { id, kind: 'base', pts: Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, z })) };
};

test('extra layers continue A-B-A-B one pass at a time and keep the original result with zero extras', () => {
  const { machine, material } = defaultProfiles();
  const r = layeredResult(machine, material, { width: 20, height: 20, layers: [[[{ x: 1, y: 10 }, { x: 19, y: 10 }]], [[{ x: 10, y: 1 }, { x: 10, y: 19 }]]], extra: { layerCount: 2 } });
  const zero = addExtraLayers(r, 0);
  assert.equal(zero.gcode, r.gcode);
  assert.equal(zero.moves, r.moves);
  assert.equal(zero.layerPlan.nativeLayers, 2);
  const three = addExtraLayers(r, 1), four = addExtraLayers(r, 2);
  assert.equal(three.strands.length, r.strands.length + 1);
  assert.equal(four.strands.length, r.strands.length + 2);
  assert.deepEqual(four.layerPlan.sequence, [0, 1, 0, 1]);
  assert.equal(three.layerPlan.totalLayers, 3);
  assert.equal(four.layerPlan.totalLayers, 4);
  const [a, b] = four.strands.slice(-2);
  assert.equal(a.pts[0].y, a.pts.at(-1).y);
  assert.equal(b.pts[0].x, b.pts.at(-1).x);
  assert.equal(four.fabric.reversedCrossings, 0);
});

test('one native layer alternates 90-degree extra passes across the full rectangular footprint', () => {
  const { machine, material } = defaultProfiles();
  const build = (w, h) => layeredResult(machine, material, { width: w, height: h, layers: [[[{ x: 0.25, y: h / 2 }, { x: w - 0.25, y: h / 2 }]]] });
  const r = build(30, 20), rotated = build(20, 30);
  const out = addExtraLayers(r, 2, { rotatedResult: () => rotated });
  assert.deepEqual(out.layerPlan.rotations, [0, 90, 0]);
  const first = out.strands.find((s) => s.extraLayer === 1), second = out.strands.find((s) => s.extraLayer === 2);
  assert.equal(first.pts[0].x, 15);
  assert.ok(Math.min(...first.pts.map((p) => p.y)) < 0.3);
  assert.ok(Math.max(...first.pts.map((p) => p.y)) > 19.7);
  assert.equal(second.pts[0].y, 10);
  assert.ok(out.strands.every((s) => s.pts.every((p) => p.x >= 0 && p.x <= 30 && p.y >= 0 && p.y <= 20)));
  assert.equal(out.fabric.components, 1);
});

test('native layer counting excludes structural ties and counts imported fixed paths only once', () => {
  const { machine, material } = defaultProfiles();
  const r = designById('truchet').generate(machine, material, { ...designById('truchet').defaults(), width: 30, height: 30 });
  assert.equal(nativeLayerInfo(r).patternLayers, 2);
  const fixed = { ...line('svg-0', 1, 1, 29, 1), fixed: true, layer: 0 };
  const withSvg = { ...r, strands: [fixed, ...r.strands] };
  const out = addExtraLayers(withSvg, 1);
  assert.equal(out.strands.filter((s) => s.fixed).length, 1);
  assert.equal(out.layerPlan.nativeLayers, 3);
  assert.equal(out.layerPlan.totalLayers, 4);
});

test('raised textures repeat their backing only and invalid extra counts fail clearly', () => {
  const { machine, material } = defaultProfiles();
  const raised = generate(machine, material, { sample_width: 30, sample_height: 30 });
  assert.equal(nativeLayerInfo(raised).repeatable, true);
  assert.equal(nativeLayerInfo(raised).mode, 'backing');
  assert.equal(nativeLayerInfo(raised).backingLayers, 2);
  assert.equal(addExtraLayers(raised, 0).moves, raised.moves);
  const reinforced = addExtraLayers(raised, 1);
  assert.equal(reinforced.placements.length, raised.placements.length);
  assert.equal(reinforced.layerPlan.totalBackingLayers, 3);
  assert.deepEqual(reinforced.layerPlan.sequence, [0, 0, 1]);
  const noBacking = generate(machine, material, { sample_width: 30, sample_height: 30, include_base: false });
  assert.equal(nativeLayerInfo(noBacking).repeatable, false);
  assert.throws(() => addExtraLayers(noBacking, 1), /backing/i);
  for (const n of [-1, 251, NaN, Infinity, 1.2]) assert.throws(() => addExtraLayers(raised, n), ConfigError);
});

test('all raised designs add only backing, preserving native XY, classes, flow and relative heights', () => {
  const { machine, material } = defaultProfiles();
  for (const id of ['loop-pile', 'fringe', 'relief', 'spacer', 'pillarweave']) {
    const d = designById(id);
    const native = id === 'loop-pile' ? generate(machine, material, { sample_width: 20, sample_height: 20 })
      : d.generate(machine, material, { ...d.defaults(), width: 20, height: 20 });
    for (const count of [1, 2, 3]) {
      const out = addExtraLayers(native, count);
      assert.equal(out.layerPlan.mode, 'backing', id);
      assert.equal(out.layerPlan.extraLayers, count);
      assert.equal(out.layerPlan.totalBackingLayers, out.layerPlan.backingLayers + count);
      const body = out.strands.filter((s) => !s.extraLayer);
      assert.equal(body.length, native.strands.length, `${id} original strands print once`);
      for (let i = 0; i < body.length; i++) {
        assert.deepEqual(body[i].pts.map(({z,...p})=>p), native.strands[i].pts.map(({z,...p})=>p), `${id} geometry and classes`);
        for (let j = 0; j < body[i].pts.length; j++) assert.ok(Math.abs(body[i].pts[j].z-native.strands[i].pts[j].z-count*.2)<1e-8, `${id} uniform texture shift`);
      }
      assert.ok(out.strands.filter((s)=>s.extraLayer).every((s)=>s.kind==='base' && s.name!=='Pillars'));
      assert.equal(out.fabric.reversedCrossings, native.fabric.reversedCrossings, `${id} no new inverted crossings`);
      assert.ok(out.fabric.components<=native.fabric.components, `${id} backing remains connected`);
      assert.ok(out.stats.violations<=native.stats.violations, `${id} no new clearance violations`);
      assert.ok(out.stats.filamentMm>native.stats.filamentMm);
    }
  }
});

test('extra passes bond to actual native heights, including repeated cycles of crossing patterns', () => {
  const { machine, material } = defaultProfiles();
  for (const id of ['spiral', 'boucle', 'rosette', 'parquet', 'starlattice']) {
    const d = designById(id), settings = d.defaults();
    d.setSize(settings, 30, 20);
    const native = d.generate(machine, material, settings);
    assert.equal(native.fabric.components, 1, `${id} original`);
    for (const count of [1, 2, 4]) {
      const out = addExtraLayers(native, count);
      assert.equal(out.fabric.components, 1, `${id} +${count}: all extra strands remain bonded`);
      assert.equal(out.fabric.reversedCrossings, 0, `${id} +${count}: safe print order`);
      assert.equal(out.fabric.outsideSegments, 0, `${id} +${count}: same outline`);
    }
  }
});

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

test('stacking shares the unbounded move policy while runtime-capacity checks remain', () => {
  assert.equal(MAX_MOVES, Infinity);
  assert.throws(() => stackStrands([line('a', 0, 0, 1, 0)], 1e12), /JavaScript array capacity/);
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
