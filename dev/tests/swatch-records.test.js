import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './helpers.js';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { parseSwatchRecord, qualifiesForTested, testedProblems } from '../../site/src/engine/swatch-records.js';

// T8.1: a card's state becomes 'tested' only with a good, approved physical record in docs/swatches/. No card is Tested yet.

const folder = path.join(projectRoot, 'docs', 'swatches');
const recordFiles = () => fs.readdirSync(folder).filter((name) => name.endsWith('.md') && !['TEMPLATE.md', 'comparisons.md', 'README.md'].includes(name));

const GOOD = `# Swatch record
- **Swatch code:** FF-abc
- **Card ID / variant:** bubbles
- **Settings hash:** 0123456789ab
- **Printed by:** Luis
- **Date (YYYY-MM-DD):** 2026-11-02
- **Print status:** success
- **Verdict:** good
- **Approved by:** Luis
`;

test('the template names every field the parser reads', () => {
  const template = fs.readFileSync(path.join(folder, 'TEMPLATE.md'), 'utf8');
  for (const label of ['Swatch code', 'Card ID / variant', 'Settings hash', 'Printed by', 'Date (YYYY-MM-DD)', 'Print status', 'Verdict', 'Approved by']) assert.ok(template.includes(`**${label}:**`), label);
});

test('a record is read from the template fields', () => {
  assert.deepEqual(parseSwatchRecord(GOOD), { swatchCode: 'FF-abc', card: 'bubbles', settingsHash: '0123456789ab', printedBy: 'Luis', date: '2026-11-02', printStatus: 'success', verdict: 'good', approvedBy: 'Luis' });
  assert.equal(parseSwatchRecord('- **Verdict:** usable with notes').verdict, 'usable');
  assert.equal(parseSwatchRecord('- **Verdict:** good / usable with notes / failed').verdict, null, 'the unfilled template is no verdict');
});

test('only a good, successful, dated, owner-approved record qualifies', () => {
  assert.equal(qualifiesForTested(parseSwatchRecord(GOOD)), true);
  for (const [from, to] of [['good', 'failed'], ['good', 'usable with notes'], ['success', 'partial'], ['Approved by:** Luis', 'Approved by:** '], ['2026-11-02', 'soon']]) {
    assert.equal(qualifiesForTested(parseSwatchRecord(GOOD.replace(from, to))), false, `${from} -> ${to}`);
  }
});

test('a Tested card needs a qualifying record, and a record must name a real card', () => {
  const cards = [{ id: 'bubbles', status: 'ready', state: 'tested' }, { id: 'coil', status: 'ready', state: 'untested' }];
  assert.deepEqual(testedProblems(cards, [parseSwatchRecord(GOOD)]), []);
  assert.deepEqual(testedProblems(cards, []), ['bubbles is marked Tested without a good, approved swatch record.']);
  assert.deepEqual(testedProblems(cards, [parseSwatchRecord(GOOD.replace('bubbles', 'nope')), parseSwatchRecord(GOOD)]), ['A swatch record names nope, which is not a card.']);
});

test('the records in docs/swatches back every Tested card', () => {
  const records = recordFiles().map((name) => parseSwatchRecord(fs.readFileSync(path.join(folder, name), 'utf8')));
  assert.deepEqual(testedProblems(DESIGNS, records), []);
});
