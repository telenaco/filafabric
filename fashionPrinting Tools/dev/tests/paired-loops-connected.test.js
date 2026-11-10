import test from 'node:test';
import assert from 'node:assert/strict';
import { pairedLoopsLayers } from '../../site/src/engine/paired-loops.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { findCrossings } from '../../site/src/engine/crossings.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

// T3.3 acceptance: every loop of family B crosses at least two loops of family A; one component; z.max about 2 x layerHeight.
// Loops of one family only touch each other (they are a hair apart), so nothing is lifted inside its plane and the only crossings
// are between the two planes. Before, loops of one family crossed each other: Z reached 0.65 mm, and at the ends of the sliders
// the card fell into up to 23 pieces.

const { machine, material } = defaultProfiles();
const CASES = [{}, { loopWidth: 2 }, { loopWidth: 10 }, { rowPitch: 15 }, { loopWidth: 2, rowPitch: 15 }, { aspect: 1.2, rowPitch: 15 }, { aspect: 2.6, loopWidth: 3 }, { offset: 0.25 }, { offset: 0.75 }];

test('every second-family loop crosses at least two first-family loops, whatever the settings', () => {
  const card = designById('paired-loops');
  for (const patch of [...CASES, { rowPitch: 2 }]) { // an explicit 2 mm row pitch overlaps rows within a plane, by choice
    const s = card.sanitize({ ...card.defaults(), width: 60, height: 60, ...patch });
    const [a, b] = pairedLoopsLayers(boundaryFor(60, 60), s);
    const { found } = findCrossings([...a, ...b].map((pts) => ({ pts })), { strandWidth: 0.45 });
    const hit = new Map(); // B loop -> the A loops it crosses
    for (const c of found) {
      const [lo, hi] = c.sa < c.sb ? [c.sa, c.sb] : [c.sb, c.sa];
      if (lo < a.length && hi >= a.length) { if (!hit.has(hi)) hit.set(hi, new Set()); hit.get(hi).add(lo); }
    }
    for (let k = 0; k < b.length; k++) assert.ok((hit.get(a.length + k)?.size ?? 0) >= 2, `${JSON.stringify(patch)}: loop B-${k} crosses ${hit.get(a.length + k)?.size ?? 0} loops of A`);
  }
});

test('the piece is one component without ties and its Z stays within two layers, at the defaults and at the ends of the sliders', () => {
  const card = designById('paired-loops');
  for (const patch of CASES) {
    const result = card.generate(machine, material, card.sanitize({ ...card.defaults(), width: 60, height: 60, ...patch }), {});
    assert.equal(result.construction.componentsWithoutTies, 1, `${JSON.stringify(patch)}: pieces without ties`);
    assert.ok(result.construction.z.max <= 2 * result.cfg.t.layer_height + 0.05, `${JSON.stringify(patch)}: Z max ${result.construction.z.max} mm`);
  }
});

test('loops of one family touch but do not cross, so nothing is lifted inside a plane', () => {
  const [a, b] = pairedLoopsLayers(boundaryFor(40, 40), { loopWidth: 4, aspect: 1.8 });
  for (const family of [a, b]) {
    const { found } = findCrossings(family.map((pts) => ({ pts })), { strandWidth: 0.45 });
    assert.equal(found.length, 0, 'no crossing inside one family');
  }
});
