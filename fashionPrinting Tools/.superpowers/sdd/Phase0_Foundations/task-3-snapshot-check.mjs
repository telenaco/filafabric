// T0.3 authorization permits families-only metadata corrections, after every
// existing case proves identical printing fields against the T0.2 snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DESIGNS } from '../../../site/src/ui/designs.js';
import { generateDesignSummaries } from '../../../dev/tools/update-design-snapshots.mjs';
import { projectRoot } from '../../../dev/tests/helpers.js';

const changes = [];
let count = 0;
for (const card of DESIGNS.filter((card) => card.status === 'ready')) {
  const file = path.join(projectRoot, 'dev/tests/snapshots/designs', `${card.id}.json`);
  const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
  const current = generateDesignSummaries(card);
  const cases = Array.isArray(previous) ? previous : previous.cases;
  assert.equal(current.length, cases.length, card.id);
  current.forEach((actual, i) => {
    const { families: before, ...expected } = cases[i];
    const { families: after, ...printed } = actual;
    assert.deepEqual(printed, expected, `${card.id}/${actual.preset}: printing changed`);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ file, item: cases[i], families: after, card: card.id, preset: actual.preset, previous: before });
    }
    count++;
  });
  console.log(`Checked ${card.id}: ${current.length} unchanged printing cases`);
}
assert.equal(count, 133);
// Nothing is written before all 133 printing-field checks pass.
const files = new Map();
for (const change of changes) {
  if (!files.has(change.file)) files.set(change.file, JSON.parse(fs.readFileSync(change.file, 'utf8')));
  const data = files.get(change.file);
  const cases = Array.isArray(data) ? data : data.cases;
  cases.find((item) => item.preset === change.preset).families = change.families;
  console.log('Families only:', change.card, change.preset, change.previous, '→', change.families);
}
for (const [file, data] of files) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`All ${count} printing summaries unchanged; ${changes.length} families-only cases updated in ${files.size} files.`);
