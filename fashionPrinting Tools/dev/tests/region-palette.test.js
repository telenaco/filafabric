import test from 'node:test';
import assert from 'node:assert/strict';
import { REGION_PALETTE, paletteColour, paletteName, regionsFromDrawing, colourBarModel } from '../../site/src/engine/regions.js';
import { parseSvg } from '../../site/src/engine/svg-parse.js';

// The colours a drawing is made in: black, red, green, blue, yellow, magenta and cyan, pure RGB.

const rect = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z`;
const svgOf = (colours) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20" viewBox="0 0 80 20">${colours.map((c, i) => `<path d="${rect(i * 10 + 1, 1, 8, 8)}" fill="none" stroke="${c}"/>`).join('')}</svg>`;

test('the palette is exactly the seven colours, as pure RGB', () => {
  assert.deepEqual(REGION_PALETTE.map((c) => [c.name, c.hex]), [
    ['Black', '#000000'], ['Red', '#ff0000'], ['Green', '#00ff00'], ['Blue', '#0000ff'], ['Yellow', '#ffff00'], ['Magenta', '#ff00ff'], ['Cyan', '#00ffff'],
  ]);
});

test('each palette colour is named, and a hair off (export rounding) is read as its colour', () => {
  for (const c of REGION_PALETTE) assert.equal(paletteName(c.hex), c.name);
  assert.equal(paletteName('#FE0000'), 'Red');
  assert.equal(paletteName('#020202'), 'Black');
  assert.equal(paletteColour('#00fefe').hex, '#00ffff');
  for (const other of ['#e53935', '#00aa00', '#808080', '#ff8000', 'red', null]) assert.equal(paletteName(other), null, String(other));
});

test('a drawing in the seven colours gives seven regions with the roles the colours always had', () => {
  const vector = parseSvg(svgOf(REGION_PALETTE.map((c) => c.hex)));
  const regions = regionsFromDrawing(vector, { currentCard: 'weave', currentSettings: {} });
  assert.deepEqual(regions.map((r) => [r.hex, r.role]), [
    ['#000000', 'line'], ['#ff0000', 'pattern'], ['#00ff00', 'solid'], ['#0000ff', 'hole'], ['#ffff00', 'solid'], ['#ff00ff', 'line'], ['#00ffff', 'line'],
  ]);
});

test('two near-identical shades of one palette colour are one region', () => {
  const regions = regionsFromDrawing(parseSvg(svgOf(['#ff0000', '#fe0000', '#00ffff', '#01ffff'])), { currentCard: 'weave', currentSettings: {} });
  assert.deepEqual(regions.map((r) => r.hex), ['#ff0000', '#00ffff']);
});

test('shades that are not in the palette stay distinct, as before', () => {
  const regions = regionsFromDrawing(parseSvg(svgOf(['#e53935', '#cc3322'])), { currentCard: 'weave', currentSettings: {} });
  assert.deepEqual(regions.map((r) => r.hex), ['#e53935', '#cc3322']);
});

test('the colour bar names each palette colour', () => {
  const regions = regionsFromDrawing(parseSvg(svgOf(REGION_PALETTE.map((c) => c.hex))), { currentCard: 'weave', currentSettings: {} });
  const labels = colourBarModel(regions).map((chip) => chip.label.split(' ')[0]);
  assert.deepEqual(labels, REGION_PALETTE.map((c) => c.name));
});
