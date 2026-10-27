import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../../site/src/ui/designs.js';

test('T1.9 updates look-and-feel wording without changing any setting keys', () => {
  const waves = new Set(['squiggle', 'square-net', 'zigzag', 'crosshatch-wavy', 'honeycomb-layered']);
  for (const card of DESIGNS) for (const section of card.controls ?? []) {
    for (const item of section.items ?? []) {
      if (waves.has(card.id) && item.key === 'spacing') assert.equal(item.label, 'Gap between strands', card.id);
      if (waves.has(card.id) && item.key === 'amplitude') assert.equal(item.label, 'Wave depth', card.id);
      if (waves.has(card.id) && item.key === 'wavelength') assert.equal(item.label, 'Wave length', card.id);
      if (['overlap', 'rowOverlap'].includes(item.key)) assert.equal(item.label, 'Overlap', `${card.id}:${item.key}`);
      assert.ok(item.key, `${card.id} slider key remains stable`);
    }
  }
  assert.ok(DESIGNS.some(card => card.controls?.some(section => section.kind === 'choice' && section.title === 'Directions')));
});
