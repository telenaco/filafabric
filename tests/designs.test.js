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
    assert.ok(['ready', 'planned'].includes(d.status), d.id);
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

test('planned designs are not selectable, unknown ids are not ready', () => {
  assert.equal(isReady('loop-pile'), true);
  assert.equal(isReady('nope'), false);
  for (const d of DESIGNS.filter((x) => x.status === 'planned')) assert.equal(isReady(d.id), false, d.id);
  assert.equal(designById('nope'), undefined);
});
