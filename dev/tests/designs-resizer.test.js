import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS_WIDTH, clampDesignsWidth } from '../../site/src/ui/designs-resizer.js';

// The design list can be dragged wider to show more cards side by side; the width stays inside sensible limits.

test('the width is kept between the narrowest and the widest the list allows', () => {
  assert.equal(clampDesignsWidth(100), DESIGNS_WIDTH.min);
  assert.equal(clampDesignsWidth(5000), DESIGNS_WIDTH.max);
  assert.equal(clampDesignsWidth(412.4), 412);
  assert.equal(clampDesignsWidth('not a number'), DESIGNS_WIDTH.standard);
});

test('at the widest, the cards fill four across or more; at the standard width, two', () => {
  const across = (aside) => Math.floor((aside - 28 + 8) / (104 + 8)); // the list's padding, the card minimum and the gap in styles.css
  assert.equal(across(DESIGNS_WIDTH.standard), 2);
  assert.ok(across(DESIGNS_WIDTH.max) >= 4);
});
