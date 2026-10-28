import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_BEAD, FINEST_BEAD, FINEST_NOZZLE, BEAD_SIZES, NOT_IN_BEADS, minForBead, inBeads, nozzleRange, applyBeadSizes } from '../../site/src/ui/nozzle-limits.js';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { beadWidth, resolveConfig } from '../../site/src/engine/params.js';
import { loadProfile } from './helpers.js';

test('the finest bead is the nozzle × 1.125, half the standard one', () => {
  assert.equal(STANDARD_BEAD, 0.45);
  assert.equal(FINEST_BEAD, FINEST_NOZZLE * 1.125);
  assert.equal(FINEST_BEAD * 2, STANDARD_BEAD);
});

test('a minimum that counts in beads follows the bead on its own grid of steps', () => {
  const ring = { min: 3, max: 20, step: 0.5, standardMin: 3 };
  assert.equal(minForBead(ring, STANDARD_BEAD), 3, 'the standard bead gives back the shipped minimum');
  assert.equal(minForBead(ring, FINEST_BEAD), 1.5, 'half as large for the finest nozzle');
  assert.equal(minForBead(ring, 0.675), 4.5, 'a third larger for a 0.6 mm nozzle');
  assert.equal(minForBead(ring, 0.5), 3.5, 'between two steps it rounds up, so the bead always has its room');
  const parquet = { min: 1.05, max: 20, step: 0.1, standardMin: 1.35 };
  assert.equal(minForBead(parquet, STANDARD_BEAD), 1.35, 'a minimum off the grid of 0 keeps its own grid');
  assert.equal(minForBead(parquet, 0.4), 1.25);
});

test('inBeads keeps the shipped minimum as standardMin and gives the floor as min; nozzleRange never goes below the floor', () => {
  const range = { min: 3, max: 20, step: 0.5 };
  assert.deepEqual(inBeads(range), { min: 1.5, max: 20, step: 0.5, standardMin: 3 });
  assert.deepEqual(inBeads(range, 2), { min: 2, max: 20, step: 0.5, standardMin: 3 });
  const counted = inBeads(range, 2);
  assert.equal(nozzleRange(counted, STANDARD_BEAD).min, 3);
  assert.equal(nozzleRange(counted, FINEST_BEAD).min, 2, 'the floor holds when the formula would go lower');
  assert.equal(nozzleRange(counted, 0.1).min, 2);
  assert.equal(nozzleRange(counted, 0.675).min, 4.5);
  assert.equal(nozzleRange(counted, undefined), counted, 'no bead width known: the range as it is');
  const plain = { min: 0.8, max: 6, step: 0.1 };
  assert.equal(nozzleRange(plain, FINEST_BEAD), plain, 'a range that does not count in beads is left alone');
  assert.equal(nozzleRange(undefined, FINEST_BEAD), undefined);
});

test('applyBeadSizes rewrites only the named ranges, on copies', () => {
  const cards = [{ id: 'a', ranges: Object.freeze({ cell: { min: 5, max: 25, step: 0.5 }, other: { min: 1, max: 2, step: 0.1 } }) }, { id: 'b', ranges: { cell: { min: 5, max: 25, step: 0.5 } } }];
  applyBeadSizes(cards, { a: { cell: null, missing: null } });
  assert.deepEqual(cards[0].ranges.cell, { min: 2.5, max: 25, step: 0.5, standardMin: 5 });
  assert.deepEqual(cards[0].ranges.other, { min: 1, max: 2, step: 0.1 });
  assert.equal(cards[1].ranges.cell.standardMin, undefined, 'a card that is not listed keeps its range');
});

test('every size that counts in beads is a real slider range, and reproduces the shipped minimum at the standard bead', () => {
  for (const [id, keys] of Object.entries(BEAD_SIZES)) {
    const card = designById(id);
    assert.ok(card?.status === 'ready', `${id} is a ready card`);
    for (const [key, floor] of Object.entries(keys)) {
      const range = card.ranges[key];
      assert.ok(range?.standardMin > 0, `${id}.${key} counts in beads`);
      assert.ok(range.min <= range.standardMin, `${id}.${key}: the floor is not above the shipped minimum`);
      assert.equal(nozzleRange(range, STANDARD_BEAD).min, range.standardMin, `${id}.${key} is unchanged for the standard nozzle`);
      assert.equal(nozzleRange(range, FINEST_BEAD).min, floor ?? minForBead(range, FINEST_BEAD), `${id}.${key} at the finest nozzle`);
      assert.ok(card.defaults()[key] >= range.standardMin, `${id}.${key}: the default stays inside the range for any nozzle`);
    }
  }
});

test('every length of 0.8 mm or more is either in beads or says why not', () => {
  const unlisted = [];
  for (const card of DESIGNS.filter((d) => d.status === 'ready' && d.controls)) {
    const items = card.controls.filter((c) => c.kind === 'sliders').flatMap((c) => c.items);
    const scale = card.controls.find((c) => c.kind === 'pattern')?.scale;
    for (const item of [...items, ...(scale ? [scale] : [])]) {
      const range = card.ranges[item.key];
      if (item.unit !== 'mm' || !range || (range.standardMin ?? range.min) <= 0.8) continue;
      if (!(item.key in (BEAD_SIZES[card.id] ?? {})) && !(`${card.id}.${item.key}` in NOT_IN_BEADS)) unlisted.push(`${card.id}.${item.key}`);
    }
  }
  assert.deepEqual(unlisted, [], 'a new length slider counts in beads (BEAD_SIZES) or says why not (NOT_IN_BEADS)');
  for (const name of Object.keys(NOT_IN_BEADS)) {
    const [id, key] = name.split('.');
    assert.ok(designById(id)?.ranges[key], `${name} names a real slider`);
    assert.ok(!(key in (BEAD_SIZES[id] ?? {})), `${name} is in only one list`);
  }
});

test('the bead width is what the config uses, for any printer and filament', () => {
  const machine = loadProfile('machines', 'prusa-mk3s');
  for (const nozzle of [undefined, 0.2, 0.4, 0.6]) {
    for (const id of ['filaflex-95-foamy', 'generic-pla', 'generic-flex-mk3']) {
      const m = nozzle ? { ...machine, nozzle_diameter: nozzle } : machine, material = loadProfile('materials', id);
      assert.equal(beadWidth(m, material), resolveConfig(m, material).t.extrusion_width, `${id} on ${nozzle ?? 'default'} mm`);
    }
  }
  const measured = { ...loadProfile('materials', 'generic-pla') };
  measured.flow = { ...measured.flow, measured_line_width: 0.31, calibration_line_width: 0.45, calibration_layer_height: 0.2 };
  assert.equal(beadWidth({ ...machine, nozzle_diameter: 0.2 }, measured), 0.31, 'a measured bead width wins, as it does for the engine');
  assert.equal(beadWidth({ ...machine, nozzle_diameter: 0.2 }, loadProfile('materials', 'generic-pla')), 0.225);
  assert.equal(beadWidth(undefined, undefined), 0.45, 'no printer: the standard bead');
});

// The floors are only floors if the engine still builds a connected, exportable fabric there. A 0.2 mm nozzle is the one
// they are for; a small piece keeps the run short.
test('every floor builds a connected, exportable fabric with a 0.2 mm nozzle', { timeout: 600000 }, () => {
  const machine = { ...loadProfile('machines', 'prusa-mk3s'), nozzle_diameter: FINEST_NOZZLE }, material = loadProfile('materials', 'generic-pla');
  const [width, height] = [24, 20];
  let built = 0;
  for (const [id, keys] of Object.entries(BEAD_SIZES)) {
    const card = designById(id);
    for (const key of Object.keys(keys)) {
      const settings = { ...card.defaults(), width, height, [key]: card.ranges[key].min };
      let result;
      assert.doesNotThrow(() => { result = generateDesignExport({ machine, material, design: id, settings, width, height, extraLayers: 0, brim: 0 }); }, `${id}.${key} = ${card.ranges[key].min}`);
      assert.equal(result.cfg.t.extrusion_width, FINEST_BEAD);
      assert.ok(result.strands.length > 0, `${id}.${key} prints something`);
      assert.equal(result.construction.components, 1, `${id}.${key} = ${card.ranges[key].min} is one connected fabric`);
      assert.deepEqual(result.construction.lostFamilies, [], `${id}.${key} loses no family`);
      assert.notEqual(result.fabric?.exportable, false, `${id}.${key} is exportable`);
      built++;
    }
  }
  assert.ok(built > 40);
});
