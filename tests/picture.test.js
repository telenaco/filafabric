import test from 'node:test';
import assert from 'node:assert/strict';
import { PICTURE, withPicture, pictureLevels, pictureDarkness, patternField } from '../src/engine/picture.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { DESIGNS, designById } from '../src/ui/designs.js';
import { toTextile } from '../src/ui/controls.js';
import { defaultProfiles } from './helpers.js';

/** A w x h picture whose grey at each pixel is grey(px, py), 0 black to 255 white. */
const picture = (w, h, grey) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const g = grey(x, y), k = (y * w + x) * 4;
    data[k] = data[k + 1] = data[k + 2] = g; data[k + 3] = 255;
  }
  return { data, width: w, height: h };
};
// the left half dark, the right half light
const halves = () => picture(40, 20, (x) => (x < 20 ? 20 : 235));

test('a flat photo is stretched to its own tones, so it still spans the whole range', () => {
  const dull = picture(20, 20, (x) => 100 + Math.round(x * 2.5)); // greys 100..148 only
  const { lo, hi } = pictureLevels(dull);
  assert.ok(lo > 0.35 && hi < 0.65, 'the picture only uses the middle tones');
  const dark = pictureDarkness(dull, 20, 20);
  assert.ok(dark(0.2, 10) > 0.9, 'its darkest part reads as dark');
  assert.ok(dark(19.8, 10) < 0.1, 'its lightest as light');
  const flat = pictureLevels(picture(4, 4, () => 128));
  assert.deepEqual(flat, { lo: 0, hi: 1 }, 'a picture of one tone is read as it is');
});

test('the picture covers the whole piece with its top at the top (y up), and a window takes its part', () => {
  const top = picture(10, 10, (x, y) => (y < 5 ? 0 : 255)); // the top half of the image is black
  const dark = pictureDarkness(top, 100, 50);
  assert.ok(dark(50, 45) > 0.9, 'near the top of the piece');
  assert.ok(dark(50, 5) < 0.1, 'near the bottom');
  const corner = pictureDarkness(top, 100, 50, { offsetX: 0, offsetY: 30 }); // a window starting 30 mm up
  assert.ok(corner(10, 15) > 0.9, 'the window at 45 mm up sees the dark top');
});

test('a pattern is a built-in field or the picture; positive reads dark as more, negative light as more', () => {
  assert.equal(patternField('none'), null);
  assert.equal(patternField(PICTURE), null, 'no picture loaded: the same as no pattern');
  assert.equal(typeof patternField('stripes'), 'function');
  const p = { image: halves(), size: [40, 20] };
  const positive = patternField(PICTURE, { picture: p }), negative = patternField(PICTURE, { picture: p, polarity: 'negative' });
  assert.ok(positive(5, 10) > 0.9 && positive(35, 10) < 0.1);
  assert.ok(negative(5, 10) < 0.1 && negative(35, 10) > 0.9);
  assert.deepEqual(withPicture(['none', 'stripes']), ['none', 'stripes', PICTURE]);
  assert.deepEqual(withPicture(['none', PICTURE]), ['none', PICTURE]);
});

const patterned = DESIGNS.filter((d) => d.status === 'ready' && !d.legacy && d.controls?.some((c) => c.kind === 'pattern'));

test('every design with a pattern offers the picture, keeps it when settings are reopened, and says how it reads it', () => {
  assert.ok(patterned.length >= 9, patterned.map((d) => d.id).join(', '));
  for (const mod of patterned) {
    const spec = mod.controls.find((c) => c.kind === 'pattern');
    assert.ok(mod.patterns.includes(PICTURE), `${mod.id} offers the picture`);
    assert.equal(mod.sanitize({ ...mod.defaults(), pattern: PICTURE }).pattern, PICTURE, `${mod.id} keeps it`);
    assert.ok(['positive', 'negative'].includes(spec.picture), `${mod.id} reads it one way or the other`);
    assert.ok(spec.pictureHint?.length > 20, `${mod.id} says how`);
  }
  assert.ok(patterned.some((d) => d.id === 'starlattice'), 'the star lattice has a pattern now');
});

test('the picture changes every design that offers it', () => {
  const { machine, material } = defaultProfiles();
  const image = halves();
  const make = (mod, settings, withImage) => generateDesignExport({ machine, material, design: mod.id, settings, width: 40, height: 20, image: withImage ? image : null, extraLayers: 0, brim: 0 }).gcode;
  for (const mod of patterned) {
    // two designs use the pattern in one mode only: the stipple tour of the meander and the pattern flow of the flow lines
    const mode = mod.id === 'meander' ? { curve: 'tsp' } : mod.id === 'flowlines' ? { flow: 'pattern' } : {};
    const settings = { ...mod.defaults(), ...mode, width: 40, height: 20 };
    const plain = make(mod, { ...settings, pattern: 'none' }, false);
    const pictured = make(mod, { ...settings, pattern: PICTURE }, true);
    assert.notEqual(pictured, plain, `${mod.id}: the picture makes a difference`);
  }
  // the loop pile and the squiggle take it too
  const pile = (pattern) => generateDesignExport({ machine, material, design: 'loop-pile', settings: toTextile(designById('loop-pile').defaults()), width: 40, height: 20, pilePattern: pattern, image, extraLayers: 0, brim: 0 }).gcode;
  assert.notEqual(pile(PICTURE), pile('none'), 'loop pile');
  const squiggle = (pattern) => generateDesignExport({ machine, material, design: 'squiggle', settings: { ...designById('squiggle').defaults(), pattern, width: 40, height: 20 }, width: 40, height: 20, image, extraLayers: 0, brim: 0 }).gcode;
  assert.notEqual(squiggle(PICTURE), squiggle('uniform'), 'squiggle');
});

test('dark is more: fuller coil loops and thicker halftone lines on the dark half of the picture', () => {
  const { machine, material } = defaultProfiles();
  const image = halves();
  const half = (r, left) => r.strands.filter((s) => s.name !== 'Structural tie').flatMap((s) => s.pts.slice(1).map((p, i) => [s.pts[i], p]))
    .filter(([a, b]) => ((a.x + b.x) / 2 < 20) === left);
  const coil = generateDesignExport({ machine, material, design: 'coil', settings: { ...designById('coil').defaults(), pattern: PICTURE, width: 40, height: 20 }, width: 40, height: 20, image, extraLayers: 0, brim: 0 });
  const length = (segs) => segs.reduce((n, [a, b]) => n + Math.hypot(b.x - a.x, b.y - a.y), 0);
  assert.ok(length(half(coil, true)) > length(half(coil, false)), 'more strand in the dark half (full-size loops)');
  const tone = generateDesignExport({ machine, material, design: 'halftone', settings: { ...designById('halftone').defaults(), pattern: PICTURE, width: 40, height: 20 }, width: 40, height: 20, image, extraLayers: 0, brim: 0 });
  const flow = (segs) => segs.reduce((n, [, b]) => n + (b.flow ?? 1), 0) / Math.max(1, segs.length);
  assert.ok(flow(half(tone, true)) > flow(half(tone, false)), 'thicker lines in the dark half');
});
