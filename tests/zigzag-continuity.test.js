import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../src/ui/designs.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { segmentInside } from '../src/engine/fabric.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const design = designById('zigzag');
const settings = { ...design.defaults(), width: 40, height: 30, depth: 1.5, spacing: 3 };
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

for (const mode of ['parallel', 'cross']) test(`plain ${mode} zigzag continues each mesh pass without row travels`, () => {
  const result = design.generate(machine, material, { ...settings, mode });
  assert.equal(result.strands.length, 2, 'only the change between the two passes needs a travel');
  assert.deepEqual(result.strands.map((s) => s.layer), [0, 1]);
  assert.ok(result.strands[1].pts.some((p) => p.z > result.cfg.t.layer_height + 0.1), 'crossing lifts remain');
  const boundary = new PolygonBoundary([rect(0, 0, 40, 30)]);
  for (const s of result.strands) for (let i = 1; i < s.pts.length; i++) {
    assert.ok(segmentInside(s.pts[i - 1], s.pts[i], boundary, result.cfg.t.extrusion_width / 2), 'the whole bead stays inside');
  }
});

test('zigzag keeps holes and disconnected pieces open when joining rows', () => {
  const outline = [rect(0, 0, 17, 30), rect(23, 0, 17, 30), rect(5, 10, 5, 8)];
  const result = design.generate(machine, material, settings, { outline });
  const boundary = new PolygonBoundary(outline);
  assert.ok(result.strands.length >= 4);
  for (const s of result.strands) for (let i = 1; i < s.pts.length; i++) {
    assert.ok(segmentInside(s.pts[i - 1], s.pts[i], boundary, result.cfg.t.extrusion_width / 2), 'no connector crosses a gap');
  }
});
