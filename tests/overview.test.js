import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview, overviewShape, overviewSettings, useWholeOverview, canSimplifyPreview, rawLayers, thinPolyline, packLines, OVERVIEW_FACTORS } from '../src/engine/overview.js';
import { generateDesignExport } from '../src/engine/design-export.js';
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
  assert.equal(useWholeOverview(400, 700, { ...machine, bed: { width: 1000, depth: 1000 } }), false, 'a fitting large piece tries full 3D before reducing detail');
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

test('a skirt-size overview spans the complete piece at the size it prints, without G-code', () => {
  const mod = designById('zigzag');
  const input = { ...defaultProfiles(), design: mod.id, settings: mod.defaults(), width: 400, height: 700,
    outline: [[{ x: 100, y: 700 }, { x: 300, y: 700 }, { x: 400, y: 0 }, { x: 0, y: 0 }]] };
  const before = JSON.stringify(input);
  const result = buildOverview(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.width, 400);
  assert.equal(result.height, 700);
  assert.equal(result.factor, 1, 'true scale: the pattern is not enlarged to make the drawing lighter');
  const { xy } = result.packed;
  let maxX = 0, maxY = 0;
  for (let i = 0; i < xy.length; i += 2) { maxX = Math.max(maxX, xy[i]); maxY = Math.max(maxY, xy[i + 1]); }
  assert.ok(maxY > 600 && maxX > 300, 'the texture reaches the far corners of the piece');
  assert.equal(result.gcode, undefined);
  assert.equal(result.cfg, undefined);
  assert.ok(result.strandWidth > 0.4);
});

test('the 2D drawing of a garment-size coil has the same strand density as the real toolpath', () => {
  const { machine, material } = defaultProfiles();
  const settings = { ...designById('coil').defaults(), size: 1.8 };
  const length = (pts) => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
  const big = buildOverview({ machine, material, design: 'coil', settings, width: 460, height: 408 });
  assert.equal(big.factor, 1);
  const { xy, starts } = big.packed;
  let drawn = 0;
  for (let i = 0; i + 1 < starts.length; i++) for (let k = starts[i] + 1; k < starts[i + 1]; k++) drawn += Math.hypot(xy[2 * k] - xy[2 * k - 2], xy[2 * k + 1] - xy[2 * k - 1]);
  const printed = generateDesignExport({ machine, material, design: 'coil', settings, width: 100, height: 100, extraLayers: 0, brim: 0 });
  const strands = printed.strands.filter((s) => s.kind !== 'travel').reduce((n, s) => n + length(s.pts), 0);
  const ratio = (drawn / (460 * 408)) / (strands / (100 * 100));
  assert.ok(ratio > 0.8 && ratio < 1.25, `2D shows ${ratio.toFixed(2)}× the printed strand per mm²: loops would look the wrong size`);
});

test('a design that cannot build the whole piece at once is drawn larger, and the drawing says by how much', () => {
  const mod = designById('bubbles');
  const result = buildOverview({ ...defaultProfiles(), design: mod.id, settings: mod.defaults(), width: 460, height: 408 });
  assert.ok(result.factor > 1, 'more bubbles than the design allows at true scale');
  assert.ok(OVERVIEW_FACTORS.includes(result.factor));
  assert.match(result.issue, /bubbles/);
  const capped = buildOverview({ ...defaultProfiles(), design: 'zigzag', settings: designById('zigzag').defaults(), width: 400, height: 400 }, { maxVertices: 2000 });
  assert.ok(capped.shapeOnly || capped.factor > 1, 'too many points: larger pattern, or the outline alone');
});

test('the 2D drawing keeps every line of the pattern: nothing is dropped to save points', () => {
  const mod = designById('chainmail');
  const input = { ...defaultProfiles(), design: mod.id, settings: mod.defaults(), width: 150, height: 120 };
  const raw = rawLayers(input, overviewShape(input), 1).flat().filter((pts) => pts.length >= 2);
  assert.equal(buildOverview(input).lines, raw.length);
});

test('thinning keeps the ends and every real corner, and drops points on straight runs', () => {
  const straight = Array.from({ length: 101 }, (_, i) => ({ x: i, y: 0 }));
  assert.deepEqual(thinPolyline(straight, 0.05), [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  const zig = Array.from({ length: 41 }, (_, i) => ({ x: i, y: i % 2 }));
  assert.equal(thinPolyline(zig, 0.05).length, zig.length, 'a zigzag is all corners');
  const packed = packLines([{ layer: 0, pts: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }, { layer: 1, pts: [{ x: 5, y: 6 }, { x: 7, y: 8 }, { x: 9, y: 10 }] }]);
  assert.deepEqual([...packed.starts], [0, 2, 5]);
  assert.deepEqual([...packed.layer], [0, 1]);
  assert.deepEqual([...packed.xy.slice(4, 6)], [5, 6]);
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
    assert.ok(result.lines > 0, mod.id);
  }
});
