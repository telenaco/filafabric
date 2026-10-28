import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { variantsOf, variantDefaultErrors } from '../../site/src/ui/library.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';
import { defaultProfiles } from './helpers.js';

// Cards listed as Flat that printed as two layers now keep that card on the Layered (or Raised) shelf, and a truly flat card, in one
// layer, takes the Flat slot with the same settings. Five more cards come as a single layer without their backing.

const { machine, material } = defaultProfiles();
const PAIRS = [ // [flat id, the card it came from, the shelf that card now sits on]
  ['coil-flat', 'coil', 'raised'], ['figure8-rows-flat', 'figure8-rows', 'raised'],
  ['auxetic-flat', 'auxetic', 'layered'], ['honeycomb-planar', 'honeycomb-flat', 'layered'],
  ['starlattice-flat', 'starlattice', 'layered'], ['harmonograph-flat', 'harmonograph', 'layered'],
  ['squiggle-flat', 'squiggle', 'layered'], ['square-net-flat', 'square-net', 'layered'], ['figure8-net-flat', 'figure8-net', 'layered'], ['zigzag-flat', 'zigzag', 'layered'],
];
const NO_BACKING = ['truchet-flat', 'turing-flat', 'meander-flat', 'parquet-flat', 'boucle-flat'];
const run = (id, size = 60) => { const card = designById(id), s = card.defaults(); if (card.setSize) card.setSize(s, size, size); return card.generate(machine, material, s, {}); };

test('each style has a flat card and a layered or raised one, sharing their settings', () => {
  for (const [flatId, oldId, shelf] of PAIRS) {
    const flat = designById(flatId), old = designById(oldId);
    assert.equal(flat.shelf, 'flat', flatId);
    assert.equal(old.shelf, shelf, oldId);
    const variants = variantsOf(flatId).map((card) => card.id);
    assert.ok(variants.includes(flatId) && variants.includes(oldId), `${flatId} and ${oldId} are variants of one style`);
    assert.deepEqual(Object.keys(flat.defaults()).sort(), Object.keys(old.defaults()).sort(), `${flatId} carries the same settings`);
  }
  assert.deepEqual(variantDefaultErrors(), []);
});

test('the flat cards are one layer: every point at the first layer height, one piece, nothing lifted', () => {
  for (const [flatId] of PAIRS) {
    const result = run(flatId), lh = result.cfg.t.layer_height;
    assert.ok(result.construction.z.max <= lh + 0.011, `${flatId}: Z max ${result.construction.z.max} mm`);
    assert.equal(result.construction.componentsWithoutTies, 1 + (flatId.startsWith('coil') || flatId.startsWith('figure8-rows') ? 2 : 0), `${flatId}: pieces without ties`);
    assert.equal(result.fabric.exportable, true, `${flatId}: ${result.fabric.issues.join('; ')}`);
    assert.equal(shelfFromConstruction(result.construction, { layerHeight: lh }), 'flat', `${flatId} measures as flat`);
    assert.ok(result.strands.every((strand) => strand.pts.every((point) => !['rising', 'falling', 'unsupported'].includes(point.cls))), `${flatId}: no strand leaves the plane`);
  }
});

test('the two-layer cards still print two layers', () => {
  for (const [, oldId] of PAIRS) assert.ok(run(oldId).construction.z.max >= 0.35, `${oldId} keeps its second layer`);
});

test('the honeycomb and the re-entrant mesh join their struts to the rows, and the cells match their name', () => {
  const honeycomb = run('honeycomb-planar'), reentrant = run('auxetic-flat');
  for (const result of [honeycomb, reentrant]) {
    assert.ok(result.struts > 20, `${result.struts} struts`);
    assert.equal(result.construction.crossings.total, 0, 'nothing crosses');
    const struts = result.strands.filter((strand) => strand.family === 'struts' || /strut/.test(strand.id ?? ''));
    assert.ok(result.strands.length >= result.struts, 'every strut is printed');
    assert.ok(struts.length === 0 || struts.every((strand) => strand.pts.length >= 2));
  }
  // struts at the waists make hexagons, at the wide points bow-ties: the struts are longer in the re-entrant mesh
  const mean = (result) => { const lengths = result.strands.filter((s) => s.family === 'struts').map((s) => Math.hypot(s.pts.at(-1).x - s.pts[0].x, s.pts.at(-1).y - s.pts[0].y)); return lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length); };
  assert.ok(mean(reentrant) > mean(honeycomb) || mean(reentrant) === 0, 'bow-tie struts span the wide gaps');
});

test('the cards without a backing are one layer, say they need one, and carry no carrier', () => {
  for (const id of NO_BACKING) {
    const card = designById(id), result = run(id);
    assert.equal(card.shelf, 'flat', id);
    assert.equal(card.support, 'needs-backing', id);
    assert.ok(result.construction.z.max <= result.cfg.t.layer_height + 0.011, `${id}: Z max ${result.construction.z.max}`);
    assert.ok(!result.strands.some((strand) => strand.role === 'carrier'), `${id}: no backing is added`);
    assert.equal(result.fabric.exportable, true, `${id}: ${result.fabric.issues.join('; ')}`);
    assert.ok(!card.controls.some((section) => section.kind === 'support' || /^backing/.test(section.key ?? '')), `${id}: no backing controls yet`);
  }
});

test('Rings · flat is one plane too: every point at the first layer height, nothing crossing', () => {
  const result = run('rings-flat', 100), lh = result.cfg.t.layer_height;
  assert.ok(result.construction.z.max <= lh + 0.011, `Z max ${result.construction.z.max} mm`);
  assert.equal(result.construction.crossings.total, 0, 'overlapping rings are joined in the plane');
  assert.equal(shelfFromConstruction(result.construction, { layerHeight: lh }), 'flat');
});

test('every card has a picture, and a flat card does not borrow its layered or raised twin\'s', async () => {
  const { DESIGNS } = await import('../../site/src/ui/designs.js');
  const { THUMBS } = await import('../../site/src/ui/thumbs.js');
  const pictureOf = (id) => { const card = DESIGNS.find((entry) => entry.id === id); return card.thumb ?? THUMBS[id]; };
  for (const card of DESIGNS.filter((entry) => entry.status === 'ready' && !entry.hidden)) assert.ok(pictureOf(card.id), `${card.id} has no picture`);
  for (const [flatId, oldId] of [...PAIRS.map(([flat, old]) => [flat, old]), ['boucle-flat', 'boucle']]) assert.notEqual(pictureOf(flatId), pictureOf(oldId), `${flatId} draws its own picture`);
});

// The print order is the layered card's: the nozzle follows one line as far as the design allows, and each family prints whole before the
// next, so a flat card does not hop between a row, a few struts, the next row.
const hop = (a, b) => Math.hypot(b.pts[0].x - a.pts.at(-1).x, b.pts[0].y - a.pts.at(-1).y);

test('Honeycomb and Re-entrant mesh print every row first, then the struts a column at a time', () => {
  for (const id of ['honeycomb-planar', 'auxetic-flat']) {
    const { strands } = run(id, 100);
    const firstStrut = strands.findIndex((strand) => strand.family === 'struts');
    assert.ok(firstStrut > 0, `${id}: rows come first`);
    assert.ok(strands.slice(0, firstStrut).every((strand) => strand.family === 'rows'), `${id}: only rows before the first strut`);
    assert.ok(strands.slice(firstStrut).every((strand) => strand.family === 'struts'), `${id}: only struts after the first strut`);
    // a column of struts is walked up, the next one down: the nozzle never crosses the sheet between two struts of a column
    const struts = strands.slice(firstStrut), hops = struts.slice(1).map((strand, i) => hop(struts[i], strand)).sort((a, b) => a - b);
    assert.ok(hops[Math.floor(hops.length * 0.8)] < 9, `${id}: 80 % of the hops between struts are short (${hops[Math.floor(hops.length * 0.8)].toFixed(1)} mm)`);
    // and each row is one whole stroke across the sheet, alternating direction
    const rows = strands.slice(0, firstStrut);
    assert.ok(rows.every((row, i) => i === 0 || Math.sign(row.pts.at(-1).x - row.pts[0].x) === -Math.sign(rows[i - 1].pts.at(-1).x - rows[i - 1].pts[0].x)), `${id}: rows alternate direction`);
  }
});

test('the families of a flat card with two print directions print one after the other', () => {
  for (const id of ['squiggle-flat', 'square-net-flat', 'figure8-net-flat']) {
    const { strands } = run(id, 100), families = strands.map((strand) => strand.family);
    assert.equal(families.filter((family, i) => i && family !== families[i - 1]).length, 1, `${id}: one change of family`);
  }
});

test('strokesPerGroup joins lines that meet into one stroke and keeps the groups in order', async () => {
  const { strokesPerGroup } = await import('../../site/src/engine/flat-variants.js');
  const line = (...pts) => pts.map(([x, y]) => ({ x, y }));
  const square = [line([0, 0], [10, 0]), line([10, 0], [10, 10]), line([10, 10], [0, 10]), line([0, 10], [0, 0])];
  const apart = [line([40, 0], [50, 0]), line([40, 5], [50, 5])];
  const out = strokesPerGroup([...apart.map((l) => Object.assign(l, { g: 1 })), ...square.map((l) => Object.assign(l, { g: 0 }))], (l) => l.g);
  assert.equal(out.length, 3, 'four sides of a square are one stroke; two separate lines stay two');
  assert.deepEqual(out.map((stroke) => stroke.rowOrder), [0, 1, 2]);
  assert.equal(Math.round(out[0].reduce((n, p, i) => (i ? n + Math.hypot(p.x - out[0][i - 1].x, p.y - out[0][i - 1].y) : n), 0)), 40, 'the square is printed once round');
  assert.ok(out[0].every((p) => p.x <= 10), 'the first group prints first');
});

test('Rings · flat prints a row of rings as one line, not ring by ring', () => {
  const { strands } = run('rings-flat', 100);
  assert.ok(strands.length < 60, `${strands.length} strokes for the whole sheet`);
  const ring = Math.PI * 8;
  assert.ok(strands.some((strand) => strand.pts.reduce((n, p, i) => (i ? n + Math.hypot(p.x - strand.pts[i - 1].x, p.y - strand.pts[i - 1].y) : n), 0) > 4 * ring), 'a stroke runs through several rings');
});

test('the flat cards that join their lines stay in one plane and use fewer strokes', () => {
  const before = { 'spiral-cells': 300, 'arrowhead-band': 150, 'isohedral-tiles': 60, kirigami: 1000 };
  for (const [id, many] of Object.entries(before)) {
    const result = run(id, 100), lh = result.cfg.t.layer_height;
    assert.ok(result.strands.length < many, `${id}: ${result.strands.length} strokes`);
    assert.ok(result.construction.z.max <= lh + 0.011, `${id}: Z max ${result.construction.z.max} mm`);
    assert.deepEqual(result.fabric.issues, [], id);
  }
});
