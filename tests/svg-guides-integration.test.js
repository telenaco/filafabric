import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../src/ui/designs.js';
import { applySvgGuides, hasNativeHeight } from '../src/engine/svg-guides.js';
import { composeSvgLines, vectorPatternRings, outlineFromVector } from '../src/engine/svg-lines.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { segmentInside } from '../src/engine/fabric.js';
import { defaultProfiles } from './helpers.js';
import { generate } from '../src/engine/generate.js';
import { generateSquiggle } from '../src/engine/squiggle.js';

const { machine, material } = defaultProfiles();
const circle = Array.from({ length: 49 }, (_, k) => ({ x: 20 + 5 * Math.cos(k * Math.PI / 24), y: 20 + 5 * Math.sin(k * Math.PI / 24) }));
const vector = { name: 'green.svg', width: 40, height: 40, paths: [circle], styles: [{ color: 'green', width: 1.2 }] };

test('green affects every ready nonlegacy design while original SVG wall passes remain undeformed', () => {
  for (const d of DESIGNS.filter((d) => d.status === 'ready' && !d.legacy)) {
    const raw = d.generate(machine, material, { ...d.defaults(), width: 40, height: 40 }, { vector: d.usesVector || d.vectorGuides ? vector : null, vectorSize: [40, 40], includeLines: false });
    const repelled = applySvgGuides(raw, vector);
    assert.equal(repelled.guideCount, 1, d.id);
    const boundary = new PolygonBoundary(repelled.outline);
    for (const s of repelled.strands) for (let i = 1; i < s.pts.length; i++) assert.ok(segmentInside(s.pts[i - 1], s.pts[i], boundary), `${d.id} stays outside green`);
    const composed = composeSvgLines(repelled, vector, { clipLines: false });
    const walls = composed.strands.filter((s) => s.id.startsWith('svg-'));
    assert.equal(walls.length, 3, `${d.id} keeps all three original wall passes`);
    assert.ok(walls.every((s) => s.pts.every((p) => p.z === 0.2)), d.id);
    assert.equal(composed.fabric.outsideSegments, 0, d.id);
    assert.equal(composed.fabric.reversedCrossings, 0, d.id);
    if (hasNativeHeight(raw)) {
      const highest = (r) => r.strands.reduce((z, s) => Math.max(z, ...s.pts.map((p) => p.z)), 0);
      assert.ok(highest(composed) >= highest(raw), `${d.id} retains its raised geometry`);
    }
  }
});

test('blue alone blocks the default page and red contains the selected pattern', () => {
  const blue = { ...vector, styles: [{ color: 'blue', width: 0.4 }] };
  const b = new PolygonBoundary(vectorPatternRings(blue));
  assert.equal(b.contains(20, 20), false);
  assert.equal(b.contains(2, 2), true);
  assert.ok(outlineFromVector(blue));
  const red = { ...vector, styles: [{ color: 'red', width: 0.4 }] };
  const r = new PolygonBoundary(vectorPatternRings(red));
  assert.equal(r.contains(20, 20), true);
  assert.equal(r.contains(2, 2), false);
});

test('a raised design without native outline support still respects SVG containment', () => {
  const d = DESIGNS.find((d) => d.id === 'fringe');
  const raw = d.generate(machine, material, { ...d.defaults(), width: 40, height: 40 });
  const red = { ...vector, styles: [{ color: 'red', width: 0.4 }] };
  const outline = vectorPatternRings(red), result = applySvgGuides(raw, red, { outline });
  const boundary = new PolygonBoundary(outline);
  assert.ok(result.strands.length);
  for (const s of result.strands) for (let i = 1; i < s.pts.length; i++) assert.ok(segmentInside(s.pts[i - 1], s.pts[i], boundary));
});

test('legacy loop pile and squiggle use the same green repulsion and source composition', () => {
  const results = [generate(machine, material, { sample_width: 40, sample_height: 40 }), generateSquiggle(machine, material, { width: 40, height: 40, spacing: 3, amplitude: 1, wavelength: 8 })];
  for (const raw of results) {
    const repelled = applySvgGuides(raw, vector), boundary = new PolygonBoundary(repelled.outline);
    const result = composeSvgLines(repelled, vector, { clipLines: false });
    assert.equal(result.guideCount, 1);
    assert.equal(result.fabric.outsideSegments, 0);
    for (const s of repelled.strands) for (let i = 1; i < s.pts.length; i++) assert.ok(segmentInside(s.pts[i - 1], s.pts[i], boundary));
    if (raw.placements?.length) assert.ok(result.moves.some((m) => m.cls === 'rising'), 'raised extrusion classes survive guide settlement');
  }
});

test('multipass SVG composition enforces its move budget before crossing analysis', () => {
  const d = DESIGNS.find((d) => d.id === 'crosshatch');
  const raw = d.generate(machine, material, { ...d.defaults(), width: 10, height: 10 });
  const large = { name: 'dense.svg', width: 10, height: 10, paths: [Array.from({ length: 51000 }, (_, i) => ({ x: 1 + 8 * i / 50999, y: 5 }))], styles: [{ color: 'other', width: 3.6 }] };
  assert.throws(() => composeSvgLines(raw, large), /SVG composition needs.*moves; the limit is/);
});
