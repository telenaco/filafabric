import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSvg } from '../src/engine/svg-parse.js';
import { interpretDrawing, sanitizeSvgLines, drawingPolylines } from '../src/engine/drawing.js';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="40mm" viewBox="0 0 60 40">${body}</svg>`;

test('green closed SVG strokes retain their contour and wall width, with red and blue semantics intact', () => {
  const v = parseSvg(svg('<rect x="1" y="1" width="58" height="38" fill="none" stroke="red"/><circle cx="15" cy="20" r="4" fill="none" stroke="blue"/><circle cx="40" cy="20" r="6" fill="none" stroke="#00ff00" stroke-width="1.2"/>'), 'coloured.svg');
  assert.deepEqual(v.styles.map((s) => s.color), ['red', 'blue', 'green']);
  const m = interpretDrawing(v);
  assert.equal(m.fills.length, 1);
  assert.equal(m.fills[0].holes.length, 1);
  assert.equal(m.guides.length, 1);
  assert.equal(m.guides[0].width, 1.2);
  assert.ok(m.guides[0].ring.every((p) => Math.abs(Math.hypot(p.x - 40, p.y - 20) - 6) < 0.03));
  assert.equal(interpretDrawing(v, { scaleX: 2, scaleY: 2 }).guides[0].width, 2.4);
  assert.equal(sanitizeSvgLines(v).styles[2].color, 'green');
  assert.equal(drawingPolylines(v).clipped.filter((p) => !p.shape).length, 3, 'three printable wall passes');
});

test('CSS green and lime are guides, including a white-filled circle with a green outline', () => {
  const v = parseSvg(svg('<circle cx="15" cy="20" r="5" fill="white" stroke="green"/><circle cx="40" cy="20" r="6" fill="none" stroke="lime"/>'));
  assert.deepEqual(v.styles.map((s) => s.color), ['green', 'green']);
  assert.equal(interpretDrawing(v).guides.length, 2);
});

test('an open green line stays printable and never becomes an opening', () => {
  const v = parseSvg(svg('<path d="M 2 3 L 20 8" fill="none" stroke="green" stroke-width="0.8"/>'));
  const m = interpretDrawing(v);
  assert.equal(m.guides.length, 0);
  assert.equal(m.lines.length, 1);
  assert.equal(drawingPolylines(v).clipped.length, 2);
});
