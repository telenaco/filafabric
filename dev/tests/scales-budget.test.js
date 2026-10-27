import test from 'node:test';
import assert from 'node:assert/strict';
import { scalesLayers, SCALES_MAX_POINTS } from '../../site/src/engine/scales.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { ConfigError } from '../../site/src/engine/params.js';
import { designById } from '../../site/src/ui/designs.js';

// Every layer of the card is a solid fill, so six layers over 100 x 100 mm was about 440,000 points: the studio sat on
// "Updating" for minutes and an export would have run to hundreds of MB. Oversized settings are refused with a plain
// message, and the card opens at a size that is quick to generate.

const points = (layers) => layers.flat().reduce((n, line) => n + line.length, 0);

test('the card opens at 100 x 100 mm, like every card, inside the point limit', () => {
  const card = designById('scales'), d = card.defaults();
  assert.deepEqual([d.width, d.height], [100, 100]);
  const built = scalesLayers(boundaryFor(d.width, d.height), d);
  assert.ok(points(built) <= SCALES_MAX_POINTS, `${points(built)} points at ${d.width} x ${d.height} mm`);
});

test('a sheet past the limit is refused in plain words instead of being generated', () => {
  assert.ok(points(scalesLayers(boundaryFor(60, 60), {})) <= SCALES_MAX_POINTS, 'a 60 mm sheet with the default layers fits');
  assert.throws(() => scalesLayers(boundaryFor(100, 100), {}), (error) => error instanceof ConfigError && /thousand points/.test(error.errors.join(' ')) && /smaller swatch/.test(error.errors.join(' ')));
});

test('an open-net carrier and fewer layers bring a large swatch back inside the limit', () => {
  assert.ok(points(scalesLayers(boundaryFor(100, 100), { carrier: 'net', scaleLayers: 1, carrierLayers: 1 })) <= SCALES_MAX_POINTS);
});
