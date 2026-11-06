import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { CARD_ESTIMATES } from '../../site/src/ui/card-estimates.js';
import { GRAMS_BAND, DENSITY_EXCEPTIONS, FLAT_DENSITY, LAYERED_DENSITY, TARGET_GRAMS, retuneC } from '../../site/src/ui/density.js';
import { defaultProfiles } from './helpers.js';

// Every card opens at about the same weight, so cards can be compared and a sheet is a fabric that holds. Luis set the standard on
// 28 October 2026 from the Wave net, Square-wave net, Figure-8 net and Zigzag mesh (1.13 to 1.17 g): 1.2 g at 100 x 100 mm, a tenth either way.

const { machine, material } = defaultProfiles();
const flat = DESIGNS.filter((card) => card.status === 'ready' && !card.hidden && card.shelf === 'flat');
test('retuned Layered defaults stay in the weight band or record an explicit exception', () => {
  for (const id of Object.keys(LAYERED_DENSITY)) {
    if (DENSITY_EXCEPTIONS[id]) continue;
    assert.ok(CARD_ESTIMATES[id].g >= GRAMS_BAND[0] - .005 && CARD_ESTIMATES[id].g <= GRAMS_BAND[1] + .005, id);
  }
});

test('every Flat card opens at about 1.2 g on a 100 x 100 mm sheet, or is a listed exception', () => {
  for (const card of flat) {
    const estimate = CARD_ESTIMATES[card.id];
    assert.ok(estimate, `${card.id} has an estimate`);
    if (DENSITY_EXCEPTIONS[card.id]) continue;
    assert.ok(estimate.g >= GRAMS_BAND[0] - 0.005 && estimate.g <= GRAMS_BAND[1] + 0.005, `${card.id} opens at ${estimate.g} g, outside ${GRAMS_BAND.map((g) => g.toFixed(2)).join(' to ')} g`);
  }
});

test('each exception is a visible card and says why', () => {
  for (const [id, reason] of Object.entries(DENSITY_EXCEPTIONS)) {
    assert.ok(DESIGNS.some((card) => card.id === id && !card.hidden), `${id} is in the library`);
    assert.ok(reason.length > 40, `${id} gives a reason`);
  }
});

test('the weight is the one the estimate says: a card builds what its table entry claims', () => {
  for (const id of ['rotating-squares', 'honeycomb-planar', 'kirigami']) {
    const card = designById(id), settings = card.defaults();
    card.setSize(settings, 100, 100);
    const grams = card.generate(machine, material, settings, {}).stats.filamentGrams;
    assert.ok(Math.abs(grams - CARD_ESTIMATES[id].g) < 0.02, `${id}: built ${grams.toFixed(2)} g, table says ${CARD_ESTIMATES[id].g}`);
    assert.ok(Math.abs(grams / TARGET_GRAMS - 1) <= 0.12, `${id}: ${grams.toFixed(2)} g`);
  }
});

test('retuning changes the defaults, scales the presets with them and keeps them matching', () => {
  const card = designById('rings-flat');
  assert.equal(card.defaults().ringSize, FLAT_DENSITY['rings-flat'].set.ringSize);
  assert.equal(card.sanitize({}).ringSize, 4.5, 'what is missing from a saved setting takes the new default');
  const open = card.presets.find((preset) => preset.id === 'open');
  assert.ok(open.patch.ringSize < 8 && open.patch.ringSize > card.defaults().ringSize, 'the open preset stays larger than the default, at the new scale');
  assert.equal(card.presetMatch({ ...card.defaults(), ...open.patch }), 'open');
  // the card's twin on another shelf keeps the settings it had
  assert.equal(designById('rings-raised').defaults().ringSize, 8);
});

test('a retuned preset stays on the slider\'s grid and above its minimum', () => {
  const base = { defaults: { size: 8 }, ranges: { size: { min: 0.8, max: 20, step: 0.1 } }, presets: [{ id: 'small', patch: { size: 1 } }, { id: 'big', patch: { size: 16 } }], sanitize: (raw) => raw, presetMatch: () => null };
  const tuned = retuneC(base, { set: { size: 2.5 } });
  assert.equal(tuned.presets.find((p) => p.id === 'small').patch.size, 0.8, 'not below the minimum');
  assert.equal(tuned.presets.find((p) => p.id === 'big').patch.size, 5, 'twice the default stays twice the default');
});

test('a flat pattern fills the whole swatch: it reaches all four edges, and the edge cuts the cells that run past it', () => {
  for (const [id, preset] of [['rotating-squares', 'broad'], ['rotating-triangles', null], ['spiral-cells', null], ['arrowhead-band', null], ['rings-flat', null], ['turing-flat', null], ['kirigami', 'open']]) {
    const card = designById(id), settings = card.sanitize({ ...card.defaults(), ...(preset ? card.presets.find((p) => p.id === preset).patch : {}) });
    card.setSize(settings, 60, 60);
    const { strands } = card.generate(machine, material, settings, {});
    const xs = strands.flatMap((s) => s.pts.map((p) => p.x)), ys = strands.flatMap((s) => s.pts.map((p) => p.y));
    const span = (values) => values.reduce((hi, v) => Math.max(hi, v), -Infinity) - values.reduce((lo, v) => Math.min(lo, v), Infinity);
    // what the edge leaves loose is taken away, so the pattern can stop a cell short of the edge, but no more
    assert.ok(span(xs) >= 57 && span(ys) >= 57, `${id}${preset ? ` · ${preset}` : ''} spans ${span(xs).toFixed(1)} x ${span(ys).toFixed(1)} mm of 60`);
  }
});

test('a line cut by the swatch edge ends at it: a free end near the outline is a cut end, not a loose one', () => {
  const card = designById('rotating-triangles'), settings = card.sanitize({ ...card.defaults(), width: 40, height: 30, angle: 0 });
  const result = card.generate(machine, material, settings, {});
  assert.equal(result.construction.danglingEnds, 0, 'every end is joined or at the edge');
});

test('the Arrowhead band has no side rails, and its columns and rows are centred on the swatch', async () => {
  const { arrowheadLayers } = await import('../../site/src/engine/arrowhead.js');
  const { boundaryFor } = await import('../../site/src/engine/layers.js');
  const layers = arrowheadLayers(boundaryFor(80, 80), { columns: 4, cellHeight: 12 });
  assert.deepEqual(layers.families, ['arrows']);
  assert.ok(layers[0].every((path) => path.family === 'arrows'));
  const card = designById('arrowhead-band');
  assert.equal('rail' in card.defaults(), false, 'no rail setting');
  assert.ok(!card.controls.some((section) => section.items?.some((item) => item.key === 'rail')), 'no rail slider');
});

test('the flat Zigzag opens at Luis\'s settings and has a Backing dropdown: none, side by side or crossed', () => {
  const card = designById('zigzag-flat'), defaults = card.defaults();
  assert.deepEqual([defaults.spacing, defaults.depth, defaults.wavelength], [4, 4, 12]);
  const backing = card.controls.find((section) => section.key === 'mode');
  assert.equal(backing.title, 'Backing');
  assert.deepEqual(backing.options.map((option) => option.id), ['none', 'parallel', 'cross']);
  assert.equal(card.sanitize({ mode: 'none' }).mode, 'none');
  assert.equal(card.sanitize({ mode: 'anything else' }).mode, 'parallel', 'an unknown choice falls back to the default');
  assert.equal(card.sanitize({}).spacing, 4, 'what is missing from a saved setting takes the new default');
  assert.equal(designById('zigzag').defaults().spacing, 3, 'the layered zigzag keeps its own settings');
  const grams = (mode) => { const s = { ...defaults, mode }; card.setSize(s, 100, 100); return card.generate(machine, material, s, {}); };
  const loose = grams('none'), side = grams('parallel'), crossed = grams('cross');
  assert.ok(loose.stats.filamentGrams < side.stats.filamentGrams * 0.6, 'the first layer alone is about half the weight');
  assert.ok(side.construction.z.max <= side.cfg.t.layer_height + 0.011 && loose.construction.z.max <= loose.cfg.t.layer_height + 0.011, 'one layer either way');
  assert.equal(crossed.fabric.exportable, true);
  assert.equal(loose.fabric.exportable, true);
});
