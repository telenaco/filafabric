import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DESIGNS } from '../../site/src/ui/designs.js';

const html = readFileSync(new URL('../../site/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../site/src/ui/main.js', import.meta.url), 'utf8');

test('the library exposes four keyboard-accessible filters for a single card grid', () => {
  const buttons = [...html.matchAll(/<button[^>]+data-library-filter="([^"]+)"/g)];
  assert.deepEqual(buttons.map(match => match[1]), ['all', 'flat', 'layered', 'raised']);
  assert.match(html, /data-library-filter="all"[^>]+aria-pressed="true"/);
  assert.doesNotMatch(source, /class: `library-shelf shelf-/);
});

test('the gallery includes every visible card and keeps experimental cards available', async () => {
  const { galleryCards } = await import('../../site/src/ui/library.js');
  const visible = DESIGNS.filter(card => (card.status === 'ready' && !card.hidden) || card.status === 'preset');
  const cards = galleryCards();
  assert.deepEqual(cards.map(card => card.id).sort(), visible.map(card => card.id).sort());
  assert.deepEqual(cards.slice(0, 3).map(card => card.shelf), ['flat', 'layered', 'raised']);
  assert.ok(cards.some(card => card.shelf === 'experimental'));
});

test('name search intersects the selected category and All can find experiments', () => {
  const nodes = { '#design-filter': { value: 'wave' }, '#design-count': {}, '#design-filter-none': {} };
  const tiles = [
    { dataset: { shelf: 'flat', search: 'flat wave' } },
    { dataset: { shelf: 'layered', search: 'wave net' } },
    { dataset: { shelf: 'experimental', search: 'experiment slub' } },
  ];
  const match = source.match(/^function applyDesignFilter\(\) \{[^]*?\n}/m);
  const host = { $: selector => nodes[selector], $$: () => tiles, activeLibraryFilter: 'layered' };
  runInNewContext(match[0], host);
  host.applyDesignFilter();
  assert.deepEqual(tiles.map(tile => tile.hidden), [true, false, true]);
  assert.equal(nodes['#design-count'].textContent, '1 of 3');
  host.activeLibraryFilter = 'all';
  nodes['#design-filter'].value = 'slub';
  host.applyDesignFilter();
  assert.deepEqual(tiles.map(tile => tile.hidden), [true, true, false]);
  nodes['#design-filter'].value = 'missing';
  host.applyDesignFilter();
  assert.equal(nodes['#design-filter-none'].hidden, false);
});
