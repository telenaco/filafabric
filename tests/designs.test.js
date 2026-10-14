import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById, READY_IDS, isReady } from '../src/ui/designs.js';

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

test('the library shows every structure on the way', () => {
  const planned = DESIGNS.filter((d) => d.status === 'planned').map((d) => d.id);
  assert.deepEqual(planned, ['weave', 'spiral', 'boucle', 'relief', 'fringe']);
});
