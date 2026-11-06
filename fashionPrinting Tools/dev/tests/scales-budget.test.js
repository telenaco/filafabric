import test from 'node:test';
import assert from 'node:assert/strict';
import { scalesLayers, SCALES_MAX_POINTS } from '../../site/src/engine/scales.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { ConfigError } from '../../site/src/engine/params.js';
import { designById } from '../../site/src/ui/designs.js';

// Every layer of the card is a solid fill, so a thick sheet is a great many points: past SCALES_MAX_POINTS the studio would sit on
// "Updating" for minutes and an export would run to hundreds of MB. Oversized settings are refused with a plain message.

const points = (layers) => layers.flat().reduce((n, line) => n + line.length, 0);

test('the card opens at 100 x 100 mm, like every card, inside the point limit', () => {
  const card = designById('scales'), d = card.defaults();
  assert.deepEqual([d.width, d.height], [100, 100]);
  const built = scalesLayers(boundaryFor(d.width, d.height), d);
  assert.ok(points(built) <= SCALES_MAX_POINTS, `${points(built)} points at ${d.width} x ${d.height} mm`);
});

test('the ticket recipe (2 carrier + 4 tile layers) fits a 100 mm swatch', () => {
  assert.ok(points(scalesLayers(boundaryFor(100, 100), { carrierLayers: 2, scaleLayers: 4 })) <= SCALES_MAX_POINTS);
});

test('a sheet past the limit is refused in plain words instead of being generated', () => {
  assert.throws(() => scalesLayers(boundaryFor(220, 220), { pitch: 4, carrierLayers: 3, scaleLayers: 10 }), (error) => error instanceof ConfigError && /thousand points/.test(error.errors.join(' ')) && /smaller swatch/.test(error.errors.join(' ')));
});

test('an open-net carrier and fewer layers bring a large swatch back inside the limit', () => {
  assert.ok(points(scalesLayers(boundaryFor(100, 100), { carrier: 'net', scaleLayers: 1, carrierLayers: 1 })) <= SCALES_MAX_POINTS);
});
