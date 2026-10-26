import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { SQUIGGLE, SQUIGGLE_DEFAULTS, sanitizeSquiggle } from '../../site/src/ui/squiggle-controls.js';
import { generateSquiggle, SAMPLERS } from '../../site/src/engine/squiggle.js';
import { defaultProfiles } from './helpers.js';
import { panelOrderErrors } from '../../site/src/ui/panels.js';

const shapes = [
  ['squiggle', 'wave'], ['square-net', 'square'], ['honeycomb-layered', 'honeycomb'],
  ['figure8-net', 'figure8'], ['looped-net', 'looped'], ['squiggle-rings', 'ring'], ['squiggle-zigzag', 'zigzag'],
];

test('registry Squiggle controls sanitize exactly like the legacy contract', () => {
  const cases = [undefined, null, [], {}, SQUIGGLE_DEFAULTS,
    { width: 42.5, height: 31.5, mode: 'parallel', shape: 'zigzag', pattern: 'waves', spacing: 3.1, colorChange: true },
    { width: 'nonsense', height: Infinity, mode: 'bad', shape: 'bad', pattern: 'bad', spacing: -1, colorChange: 'yes' }];
  for (const raw of cases) assert.deepEqual(SQUIGGLE.sanitize(raw), sanitizeSquiggle(raw));
});

test('each Squiggle card forces its shape and preserves legacy G-code in both structures', () => {
  const { machine, material } = defaultProfiles();
  for (const [id, shape] of shapes) {
    const card = DESIGNS.find((entry) => entry.id === id);
    assert.ok(card, `missing ${id}`);
    assert.equal(card.sanitize({ shape: 'wave' }).shape, shape);
    const settings = card.sanitize({ ...card.defaults(), width: 40, height: 30, mode: 'cross', pattern: 'uniform' });
    for (const mode of ['cross', 'parallel']) {
      settings.mode = mode;
      const expected = generateSquiggle(machine, material, { ...settings, shape, sampler: SAMPLERS[settings.pattern] });
      const actual = card.generate(machine, material, settings, {});
      assert.equal(actual.gcode, expected.gcode, `${id} / ${mode}`);
    }
    if (!card.hidden && id !== 'looped-net') {
      assert.ok(card.controls.some((section) => section.kind === 'pattern'));
      assert.ok(card.controls.some((section) => section.kind === 'switch' && section.key === 'colorChange'));
    }
  }
});

test('visible Squiggle cards use the library panel template without a shape picker', () => {
  for (const [id] of shapes.slice(0, 5)) {
    const card = DESIGNS.find((entry) => entry.id === id);
    assert.ok(!card.controls.some((section) => section.kind === 'shape'), id);
    assert.ok(panelOrderErrors(card.controls).every((error) => error.includes('colorChange')), id);
  }
});

test('the former hand-built Squiggle panel and handlers are gone', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../../site/src/ui/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="(?:panel-squiggle|sq-[^"]+)"/);
  assert.doesNotMatch(main, /(?:sq-(?:mode|shape|patterns|sliders|size|color-change)|state\.squiggle|renderSquiggleChoices|bindSquiggle)/);
});
