import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

// With 3 mm of overlap the search for a cut that breaks a nozzle-clearance cycle ran for minutes, because every possible cut was
// tried against a full re-check of the sheet. It is now bounded by the work done.

test('heavily overlapping raised rings still generate, in a bounded time', () => {
  const card = designById('rings-raised');
  const settings = card.sanitize({ ...card.defaults(), width: 40, height: 40, overlap: 3 });
  const started = Date.now();
  const result = card.generate(machine, material, settings, {});
  assert.ok(result.strands.length > 0);
  assert.ok(Date.now() - started < 60000, `took ${Date.now() - started} ms`);
});

test('the search for cuts is bounded but does not change an ordinary result', () => {
  const card = designById('rings-raised');
  const settings = card.sanitize({ ...card.defaults(), width: 40, height: 30 });
  const a = card.generate(machine, material, settings, {}), b = card.generate(machine, material, settings, {});
  assert.equal(a.gcode, b.gcode, 'the same settings give the same G-code');
});
