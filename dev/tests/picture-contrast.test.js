import test from 'node:test';
import assert from 'node:assert/strict';
import { withContrast, pictureDarkness, PICTURE_CONTRAST } from '../../site/src/engine/picture.js';

/** A one-row picture of the given greys (0 black to 255 white). */
const greys = (...values) => {
  const data = new Uint8ClampedArray(values.length * 4);
  values.forEach((v, i) => { data.set([v, v, v, 255], i * 4); });
  return { data, width: values.length, height: 1 };
};

test('picture contrast 1 leaves the picture as it is', () => {
  const image = greys(0, 100, 150, 255);
  assert.equal(withContrast(image, 1), image);
  assert.equal(PICTURE_CONTRAST.min, 1);
});

test('picture contrast pushes close greys apart and keeps the ends', () => {
  // mostly close mid-greys between black and white areas
  const image = greys(...Array(10).fill(0), ...Array(50).fill(120), ...Array(50).fill(136), ...Array(10).fill(255));
  const before = pictureDarkness(image, image.width, 1);
  const raised = withContrast(image, 3);
  const after = pictureDarkness(raised, raised.width, 1);
  const at = (field, i) => field(i + 0.5, 0.5);
  const gapBefore = at(before, 10) - at(before, 60);
  const gapAfter = at(after, 10) - at(after, 60);
  assert.ok(gapAfter > gapBefore * 2, `gap ${gapBefore} -> ${gapAfter}`);
  assert.ok(at(after, 0) > 1 - 1e-9); // black stays darkest
  assert.ok(at(after, 119) < 1e-9); // white stays lightest
  assert.equal(raised.width, image.width);
  assert.equal(raised.data.length, image.data.length);
});
