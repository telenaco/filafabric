import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById, READY_IDS, isReady } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('loop pile and squiggle come first and are ready', () => {
  assert.deepEqual(READY_IDS.slice(0, 2), ['loop-pile', 'squiggle']);
  assert.equal(designById('loop-pile').legacy, true);
  assert.equal(designById('squiggle').legacy, true);
});

test('every module is complete', () => {
  const ids = new Set();
  for (const d of DESIGNS) {
    assert.equal(ids.has(d.id), false, `duplicate ${d.id}`);
    ids.add(d.id);
    for (const k of ['name', 'blurb', 'file']) assert.ok(d[k], `${d.id}.${k}`);
    assert.ok(['ready', 'planned', 'preset'].includes(d.status), d.id);
    if (d.status === 'preset') {
      assert.ok(isReady(d.opens.design), `${d.id} opens a design that exists`);
      const target = designById(d.opens.design);
      const merged = target.sanitize({ ...target.defaults(), ...d.opens.patch });
      for (const [k, v] of Object.entries(d.opens.patch)) assert.equal(merged[k], v, `${d.id}.${k} survives sanitising`);
    }
    if (d.status === 'ready') {
      assert.equal(typeof d.defaults, 'function', `${d.id}.defaults`);
      assert.equal(typeof d.sanitize, 'function', `${d.id}.sanitize`);
      assert.ok(d.roles && d.roles.base, `${d.id} needs role labels`);
    }
  }
});

test('defaults survive their own sanitiser', () => {
  for (const d of DESIGNS.filter((x) => x.status === 'ready')) {
    assert.deepEqual(d.sanitize(d.defaults()), d.defaults(), d.id);
  }
});

test('planned and preset tiles are not loadable designs, unknown ids are not ready', () => {
  assert.equal(isReady('loop-pile'), true);
  assert.equal(isReady('nope'), false);
  for (const d of DESIGNS.filter((x) => x.status !== 'ready')) assert.equal(isReady(d.id), false, d.id);
  assert.equal(designById('nope'), undefined);
});

test('the library holds every structure of the catalogue, all of them ready', () => {
  const ready = DESIGNS.filter((d) => d.status === 'ready').map((d) => d.id);
  assert.deepEqual(ready.slice(0, 8), ['loop-pile', 'squiggle', 'coil', 'weave', 'spiral', 'boucle', 'relief', 'fringe']);
  assert.deepEqual(DESIGNS.filter((d) => d.status === 'planned'), []);
});

test('every newer design describes itself completely, so the studio needs no per-design code', () => {
  for (const d of DESIGNS.filter((x) => x.status === 'ready' && !x.legacy)) {
    for (const k of ['about', 'ranges', 'size', 'setSize', 'describe', 'controls', 'generate', 'verdict', 'figure', 'summary']) assert.ok(d[k], `${d.id}.${k}`);
    const s = d.defaults();
    const [w, h] = d.size(s);
    assert.ok(w > 0 && h > 0);
    d.setSize(s, 60, 40);
    assert.deepEqual(d.size(s), [60, 40]);
    for (const c of d.controls) assert.ok(['presets', 'size', 'shape', 'choice', 'sliders', 'pattern', 'switch'].includes(c.kind), `${d.id} control ${c.kind}`);
    for (const c of d.controls.filter((x) => x.kind === 'sliders')) {
      for (const item of c.items) assert.ok(d.ranges[item.key], `${d.id} slider ${item.key} has a range`);
    }
    for (const c of d.controls.filter((x) => x.kind === 'pattern')) assert.ok(Array.isArray(d.patterns) && d.patterns.length > 0, `${d.id} patterns`);
  }
});

test('every newer design prints its defaults, and again from every preset, with a verdict and a figure', () => {
  const { machine, material } = defaultProfiles();
  for (const d of DESIGNS.filter((x) => x.status === 'ready' && !x.legacy)) {
    const runs = [d.defaults(), ...(d.presets ?? []).map((p) => d.sanitize({ ...d.defaults(), ...p.patch }))];
    for (const s of runs) {
      const r = d.generate(machine, material, s, { outline: null });
      assert.ok(r.moves.some((m) => m.extrude), `${d.id} prints something`);
      assert.ok(r.gcode.includes('G1'));
      assert.equal(r.fabric.exportable, true, `${d.id}: ${JSON.stringify(s)}: ${r.fabric.issues.join('; ')}`);
      assert.ok(['ok', 'info', 'heads-up'].includes(d.verdict(r, s).level), `${d.id} verdict`);
      const f = d.figure(r);
      assert.ok(f.label && f.value !== undefined, `${d.id} figure`);
      assert.ok(typeof d.summary(r) === 'string' && d.summary(r).length > 5);
    }
  }
});
