import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { generate } from '../src/engine/generate.js';
import { composeSvgLines } from '../src/engine/svg-lines.js';

test('intersecting SVG strokes remain on the first layer and preserve native pile extrusion classes', () => {
  const { machine, material } = defaultProfiles();
  const result = generate(machine, material, { sample_width: 30, sample_height: 30, boundary_policy: 'footprint' });
  const pairs = [[1, 1, 29, 29], [1, 29, 29, 1], [1, 15, 29, 15], [15, 1, 15, 29], [1, 5, 29, 5]];
  const vector = { name: 'crossing-strokes.svg', width: 30, height: 30, paths: pairs.map(([x, y, x2, y2]) => [{ x, y }, { x: x2, y: y2 }]) };
  const r = composeSvgLines(result, vector);
  for (const s of r.strands.filter((s) => s.name === 'Imported SVG lines')) assert.ok(s.pts.every((p) => p.z === 0.2));
  for (const cls of ['rising', 'falling', 'unsupported']) assert.equal(r.moves.filter((m) => m.extrude && m.cls === cls).length, result.moves.filter((m) => m.extrude && m.cls === cls).length, cls);
  assert.equal(r.fabric.reversedCrossings, 0);
  assert.equal(r.fabric.components, 1);
});

test('SVG physical units and viewBox retain the document size, including margins', async () => {
  const { svgDimensions } = await import('../src/engine/svg-lines.js');
  assert.deepEqual(svgDimensions({ width: '210mm', height: '297mm', viewBox: '0 0 210 297' }), { width: 210, height: 297 });
  assert.deepEqual(svgDimensions({ width: '8.5in', height: '11in' }), { width: 215.9, height: 279.4 });
  assert.deepEqual(svgDimensions({ viewBox: '10 20 96 192' }), { width: 25.4, height: 50.8 });
});

test('multiple open subpaths stay separate and relative movetos retain their position', async () => {
  const { splitSvgSubpaths } = await import('../src/engine/svg-lines.js');
  const parts = splitSvgSubpaths('M 0 0 L 10 0 m 5 5 l 10 0');
  assert.equal(parts.length, 2);
  assert.match(parts[1], /^M 15 5 /);
  assert.ok(parts.every((d) => !/[zZ]/.test(d)), 'open lines must not be closed');
});

test('SVG strokes are extruded before the selected rosette pattern', async () => {
  const { composeSvgLines } = await import('../src/engine/svg-lines.js');
  const { machine, material } = defaultProfiles(), rosette = DESIGNS.find((d) => d.id === 'rosette');
  const result = rosette.generate(machine, material, { ...rosette.defaults(), width: 30, height: 30 });
  const vector = { name: 'Plotter lines', width: 30, height: 30, paths: [[{ x: 2, y: 8 }, { x: 28, y: 8 }], [{ x: 2, y: 22 }, { x: 28, y: 22 }]] };
  const composed = composeSvgLines(result, vector);
  assert.equal(composed.strands[0].name, 'Imported SVG lines');
  assert.ok(composed.moves.some((m) => m.extrude && m.tag.startsWith('svg-')));
  assert.ok(composed.strands.some((s) => s.name !== 'Imported SVG lines'));
  assert.equal(composed.fabric.components, 1);
  assert.equal(composed.fabric.reversedCrossings, 0);
});
