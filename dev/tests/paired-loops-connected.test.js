import test from 'node:test';
import assert from 'node:assert/strict';
import { pairedLoopsLayers } from '../../site/src/engine/paired-loops.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

// Neighbouring loops overlap by a fixed fraction, so the smallest loops only just touched and a wide row pitch left the rows
// apart: the card broke into up to 23 pieces at the ends of its sliders. Overlap now never drops below about 1.5 beads.

const { machine, material } = defaultProfiles();

test('paired loops stay one piece at the smallest and largest loop width and row pitch', () => {
  const card = designById('paired-loops');
  for (const patch of [{ loopWidth: 2 }, { loopWidth: 10 }, { rowPitch: 15 }, { loopWidth: 2, rowPitch: 15 }, { aspect: 1.2, rowPitch: 15 }, { aspect: 2.6, loopWidth: 3 }]) {
    const result = card.generate(machine, material, card.sanitize({ ...card.defaults(), width: 60, height: 60, ...patch }), {});
    assert.equal(result.construction.componentsWithoutTies, 1, `${JSON.stringify(patch)}: pieces without ties`);
  }
});

test('the default loop spacing is unchanged by the overlap floor', () => {
  const built = pairedLoopsLayers(boundaryFor(50, 50), { loopWidth: 4, aspect: 1.8 });
  const first = built[0][0], second = built[0][1];
  const xs = (loop) => loop.map((p) => p.x);
  const centre = (loop) => (Math.min(...xs(loop)) + Math.max(...xs(loop))) / 2;
  assert.ok(Math.abs(centre(second) - centre(first) - 3.2) < 1e-6, 'columns 0.8 loop widths apart, as before');
});
