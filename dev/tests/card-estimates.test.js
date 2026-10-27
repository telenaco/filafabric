import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { CARD_ESTIMATES } from '../../site/src/ui/card-estimates.js';
import { estimateLine } from '../../site/src/ui/estimate-line.js';
import { defaultProfiles } from './helpers.js';
import { printTimeSeconds } from '../../site/src/ui/print-estimates.js';

// The library shows time, filament and layers for every card at once, from numbers worked out ahead of time at 100 x 100 mm.
// Regenerate with: node dev/tools/estimate-cards.mjs

const visible = DESIGNS.filter((card) => card.status === 'ready' && !card.hidden);

test('every visible card, and each of its presets, has an estimate', () => {
  for (const card of visible) {
    for (const key of [card.id, ...(card.presets ?? []).map((preset) => `${card.id}:${preset.id}`)]) {
      const entry = CARD_ESTIMATES[key];
      assert.ok(entry, `${key} has no estimate; run node dev/tools/estimate-cards.mjs`);
      assert.ok(entry.min === null || (entry.min > 0 && Number.isFinite(entry.min)), `${key} minutes`);
      assert.ok(entry.g > 0 && Number.isFinite(entry.g), `${key} grams`);
      assert.ok(Number.isInteger(entry.layers) && entry.layers >= 1, `${key} layers`);
    }
  }
  for (const key of Object.keys(CARD_ESTIMATES)) assert.ok(visible.some((card) => key === card.id || key.startsWith(`${card.id}:`)), `${key} belongs to no card`);
});

test('the numbers are what a fresh run gives (checked on two quick cards)', () => {
  const { machine, material } = defaultProfiles();
  for (const id of ['crosshatch', 'rings-flat']) {
    const card = designById(id), settings = card.defaults();
    card.setSize(settings, 100, 100);
    const result = card.generate(machine, material, settings, {});
    const seconds = printTimeSeconds(result.stats), entry = CARD_ESTIMATES[id];
    assert.ok(Math.abs(entry.min * 60 - seconds) <= Math.max(6, seconds * 0.01), `${id}: ${entry.min} min against ${seconds / 60}`);
    assert.ok(Math.abs(entry.g - result.stats.filamentGrams) <= 0.011, `${id}: ${entry.g} g against ${result.stats.filamentGrams}`);
  }
});

test('the estimate line reads in plain words, and says nothing when there is no estimate', () => {
  assert.equal(estimateLine({ min: 13, g: 1.1, layers: 2 }), '13 min · 1.1 g · 2 layers');
  assert.equal(estimateLine({ min: 1.5, g: 0.25, layers: 1 }), '1.5 min · 0.25 g · 1 layer');
  assert.equal(estimateLine({ min: 125, g: 12.04, layers: 3 }), '2 h 5 min · 12 g · 3 layers');
  assert.equal(estimateLine({ min: null, g: 4, layers: 2 }), '4 g · 2 layers');
  assert.equal(estimateLine(undefined), '');
});
