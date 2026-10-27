import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../../site/src/ui/designs.js';

// The studio builds the panel of every card at start and asks each for its slider readouts (`describe`). A readout that
// throws (an undefined helper in one card's `describe`) stopped every panel from rendering, on every card, while no
// node test noticed: nothing here ever called it.

const cases = DESIGNS.filter((card) => typeof card.describe === 'function')
  .flatMap((card) => [{ card, label: 'default', settings: card.defaults() },
    ...(card.presets ?? []).map((preset) => ({ card, label: preset.id, settings: card.sanitize({ ...card.defaults(), ...preset.patch }) }))]);

test('every card has slider readouts, at its default and in every preset', () => {
  assert.ok(cases.length > 50, `${cases.length} readout cases`);
  for (const { card, label, settings } of cases) {
    const readouts = card.describe(settings);
    assert.equal(typeof readouts, 'object', `${card.id} / ${label}`);
    for (const [key, value] of Object.entries(readouts ?? {})) {
      assert.ok(!/undefined|NaN|\[object/.test(String(value)), `${card.id} / ${label}: readout "${key}" reads "${value}"`);
    }
  }
});

test('a slider that has no readout of its own shows its value, so no slider is left blank', () => {
  for (const card of DESIGNS.filter((c) => c.status === 'ready' && typeof c.describe === 'function')) {
    const settings = card.defaults(), readouts = card.describe(settings);
    for (const section of card.controls ?? []) {
      for (const item of section.items ?? []) {
        const shown = readouts[item.key] ?? settings[item.key];
        assert.ok(shown !== undefined && shown !== null && shown !== '', `${card.id}: slider "${item.key}" would show nothing`);
      }
    }
  }
});
