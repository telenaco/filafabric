import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLaceLayers } from '../../site/src/engine/step-lace.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { findCrossings } from '../../site/src/engine/crossings.js';
import { designById } from '../../site/src/ui/designs.js';

// T3.2 acceptance: no base line has a free span longer than tieLength x 1.5 between crossings with the tie family. Measured on the
// engine's own lines (the generic pipeline later chains rows into one serpentine and adds edge jogs, which are not lines).

/** The longest stretch of any base line with no tie crossing it, the two ends included. */
function longestFreeSpan(layers) {
  const [lines, ties] = layers;
  const { found, arcs } = findCrossings([...lines, ...ties].map((pts) => ({ pts })), { strandWidth: 0.45 });
  const marks = lines.map(() => []);
  for (const c of found) {
    if (c.sa < lines.length && c.sb >= lines.length) marks[c.sa].push(c.arcA);
    else if (c.sb < lines.length && c.sa >= lines.length) marks[c.sb].push(c.arcB);
  }
  let longest = 0, where = null;
  lines.forEach((line, i) => {
    const total = arcs[i][arcs[i].length - 1], at = [0, ...marks[i].sort((a, b) => a - b), total];
    for (let k = 1; k < at.length; k++) if (at[k] - at[k - 1] > longest) { longest = at[k] - at[k - 1]; where = { line: i, from: +at[k - 1].toFixed(1), to: +at[k].toFixed(1), of: +total.toFixed(1) }; }
  });
  return { longest, where };
}

test('no base line has a free span longer than 1.5 times the tie length, for every tying pattern', () => {
  const card = designById('step-lace');
  for (const tie of ['step', 'hexagon', 'ripple', 'petal']) {
    for (const [tieLength, spacing] of [[6, 3], [3, 3], [12, 3], [20, 3], [6, 8], [6, 1.5], [3, 1.5], [20, 8]]) {
      const s = card.sanitize({ ...card.defaults(), width: 100, height: 100, tie, tieLength, spacing });
      const layers = stepLaceLayers(boundaryFor(100, 100), s);
      const { longest, where } = longestFreeSpan(layers);
      assert.ok(longest <= 1.5 * s.tieLength + 1e-6, `${tie}, tie length ${tieLength}, gap ${spacing}: a line runs ${longest.toFixed(1)} mm without a tie (limit ${(1.5 * s.tieLength).toFixed(1)}) ${JSON.stringify(where)}`);
    }
  }
});
