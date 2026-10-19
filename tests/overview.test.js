import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview, overviewShape, overviewSettings, useWholeOverview, canSimplifyPreview } from '../src/engine/overview.js';
import { DESIGNS, designById } from '../src/ui/designs.js';
import { toTextile } from '../src/ui/controls.js';
import { defaultProfiles } from './helpers.js';

const rectangle = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];

test('large or out-of-bed pieces automatically use the whole view, with an explicit detail override', () => {
  const { machine } = defaultProfiles();
  assert.equal(useWholeOverview(100, 100, machine), false);
  assert.equal(useWholeOverview(400, 700, machine), true);
  assert.equal(useWholeOverview(200, 240, machine), true, 'a preview is still possible when the printer cannot fit it');
  assert.equal(useWholeOverview(400, 700, machine, 'detail'), false);
  assert.equal(useWholeOverview(100, 100, machine, 'overview'), true);
});

test('full-piece geometry preserves the document size, off-centre shapes, holes and source strokes', () => {
  const vector = { width: 400, height: 700, paths: [rectangle(150, 200, 200, 450), rectangle(220, 300, 30, 50)], styles: [{ color: 'red', width: .45 }, { color: 'blue', width: .45 }] };
  const shape = overviewShape({ width: 400, height: 700, vector, shapeOutline: true });
  assert.equal(shape.width, 400);
  assert.equal(shape.height, 700);
  assert.equal(shape.rings.length, 2);
  assert.ok(shape.source[0].pts.some(p => p.x === 350 && p.y === 650));
  assert.ok(shape.rings.some(r => r.some(p => p.x === 220 && p.y === 300)));
  assert.throws(() => overviewShape({ width: Infinity, height: 700 }), /Preview dimensions/);
});

test('a skirt-size overview spans the complete piece and never changes printable settings or creates G-code', () => {
  const mod = designById('zigzag');
  const input = { ...defaultProfiles(), design: mod.id, settings: mod.defaults(), width: 400, height: 700,
    outline: [[{ x: 100, y: 700 }, { x: 300, y: 700 }, { x: 400, y: 0 }, { x: 0, y: 0 }]] };
  const before = JSON.stringify(input);
  const result = buildOverview(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.width, 400);
  assert.equal(result.height, 700);
  assert.ok(result.layers.some(s => s.pts.some(p => p.y > 600)));
  assert.ok(result.layers.some(s => s.pts.some(p => p.x > 300)));
  assert.ok(result.vertices <= 35000);
  assert.equal(result.gcode, undefined);
  assert.equal(result.cfg, undefined);
  assert.equal(result.simplified, true);
  assert.ok(result.spacingFactor > 1, 'coarsening is reported instead of silently changing the design');
  const finer = buildOverview(input, { fine: true });
  assert.ok(finer.spacingFactor < result.spacingFactor);
});

test('display simplification changes only geometric spacing, not dimensions, seed or layer controls', () => {
  assert.deepEqual(overviewSettings({ width: 400, height: 700, spacing: 3, depth: 2, colorChange: true, seed: 7, layers: 4 }, 2),
    { width: 400, height: 700, spacing: 6, depth: 4, colorChange: true, seed: 7, layers: 4 });
});

test('automatic simplification handles complexity limits without masking invalid print settings', () => {
  assert.equal(canSimplifyPreview(new Error('This layout would need about 500000 moves; the limit is 400000')), true);
  assert.equal(canSimplifyPreview(new Error('Too many loops (about 7000)')), true);
  assert.equal(canSimplifyPreview(new Error('speed_base must be at most 500')), false);
  assert.equal(canSimplifyPreview(new Error('temperature.first_layer must be in 1-300')), false);
});

test('every ready design can build a lightweight XY overview without print planning', () => {
  for (const mod of DESIGNS.filter(d => d.status === 'ready')) {
    const result = buildOverview({ ...defaultProfiles(), design: mod.id, width: 80, height: 60,
      settings: mod.id === 'loop-pile' ? toTextile(mod.defaults()) : mod.defaults() });
    assert.equal(result.shapeOnly, false, `${mod.id}: ${result.issue}`);
    assert.ok(result.layers.length > 0, mod.id);
  }
});
