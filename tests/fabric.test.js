import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryFor, crossingReport, layersToStrands } from '../src/engine/layers.js';
import { buildLayeredVerdict } from '../src/ui/verdict.js';
import { emitStrands } from '../src/engine/emit.js';
import { findCrossings, resolveCrossings } from '../src/engine/crossings.js';
import { DESIGNS } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { generate } from '../src/engine/generate.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import * as routing from '../src/engine/fabric.js';
import { sanitizeSquiggle } from '../src/ui/squiggle-controls.js';
import { sanitizeCoil } from '../src/ui/coil-controls.js';
import { sanitizePrimary } from '../src/ui/controls.js';

const P = (x, y, z = 0.2) => ({ x, y, z });
const line = (a, b) => Array.from({ length: 41 }, (_, i) => P(a.x + (b.x - a.x) * i / 40, a.y + (b.y - a.y) * i / 40, a.z + (b.z - a.z) * i / 40));

test('two separate crossing-rich islands are not reported as one fabric', () => {
  const items = [
    { layer: 0, pts: [P(0, 5), P(10, 5)] }, { layer: 1, pts: [P(5, 0, 0.4), P(5, 10, 0.4)] },
    { layer: 0, pts: [P(20, 5), P(30, 5)] }, { layer: 1, pts: [P(25, 0, 0.4), P(25, 10, 0.4)] },
  ];
  const report = crossingReport(items, 300);
  assert.equal(report.components, 2);
  assert.notEqual(buildLayeredVerdict({ report, layerCount: 2, stats: { hops: 3 } }).level, 'ok');
});

test('crossings with a vertical gap do not join separate strands', () => {
  const report = crossingReport([{ layer: 0, pts: [P(0, 5), P(10, 5)] }, { layer: 1, pts: [P(5, 0, 2), P(5, 10, 2)] }], 100);
  assert.equal(report.components, 2);
});

test('collinear butt joints and strand-width contact connect the graph', () => {
  const report = crossingReport([
    { layer: 0, pts: [P(0, 1), P(5, 1)] }, { layer: 0, pts: [P(5, 1), P(10, 1)] },
    { layer: 0, pts: [P(10.3, 1), P(15, 1)] },
  ], 30);
  assert.equal(report.components, 1);
});

test('support-following crossing heights stack above an already raised pass', () => {
  const strands = [
    { pts: line(P(0, 5), P(10, 5)) }, { pts: line(P(5, 0), P(5, 10)) },
    { pts: line(P(0, 0), P(10, 10)) },
  ];
  const r = resolveCrossings(strands, { lift: 0.2, follow: true });
  assert.ok(Math.abs(r.strands[2].pts[20].z - 0.6) < 1e-8);
});

test('layered fabrication connects islands inside a boundary and settles all crossings in print order', () => {
  const layers = [[[P(2, 5), P(10, 5)], [P(13, 5), P(20, 5)]], [[P(6, 2), P(6, 8)], [P(16, 2), P(16, 8)]]];
  const strands = layersToStrands(layers, { boundary: boundaryFor(24, 10), coherent: true });
  const report = crossingReport(strands.map((s) => ({ pts: s.pts, layer: 0 })), 240);
  assert.equal(report.components, 1);
  assert.ok(strands.length > 4, 'ties are printed, rather than merely claimed by the report');
});

test('travel clearance includes the previously printed interior peak', () => {
  const moves = emitStrands([
    { id: 'peak', kind: 'base', pts: [P(0, 0), P(5, 5, 12), P(10, 0)] },
    { id: 'next', kind: 'base', pts: [P(0, 10), P(10, 10)] },
  ]);
  assert.ok(moves.some((m) => !m.extrude && m.x === 0 && m.y === 10 && m.z >= 15));
});

test('loop pile has interior cross-row backing connections', () => {
  const { machine, material } = defaultProfiles();
  const r = generate(machine, material, { sample_width: 30, sample_height: 30 });
  assert.ok(r.base.strands?.some((pts) => pts.some((p, i) => i && p.x > 1 && p.x < 29 && Math.abs(p.x - pts[i - 1].x) < 1e-8 && Math.abs(p.y - pts[i - 1].y) > 0.1)));
});

test('every default design exposes a final 3D fabric report', () => {
  const { machine, material } = defaultProfiles();
  for (const d of DESIGNS.filter((d) => d.status === 'ready' && !d.legacy)) {
    const r = d.generate(machine, material, d.defaults());
    assert.ok(r.fabric, `${d.id}: missing report`);
    assert.equal(r.fabric.components, 1, `${d.id}: separate regions`);
    assert.equal(r.fabric.reversedCrossings, 0, `${d.id}: crossing heights reversed`);
    assert.equal(r.fabric.outsideSegments, 0, `${d.id}: extrusion leaves the shape`);
    assert.ok(r.fabric.maxSlopeDeg <= 25.001, `${d.id}: slope ${r.fabric.maxSlopeDeg}`);
  }
});

test('bouclé preserves a garment cutout after shaping the strands', () => {
  const { machine, material } = defaultProfiles();
  const outline = [[P(0, 0), P(50, 0), P(50, 50), P(0, 50)], [P(20, 20), P(30, 20), P(30, 30), P(20, 30)]];
  const boundary = new PolygonBoundary(outline), d = DESIGNS.find((d) => d.id === 'boucle');
  const r = d.generate(machine, material, { ...d.defaults(), width: 50, height: 50 }, { outline });
  for (let i = 1; i < r.moves.length; i++) if (r.moves[i].extrude) {
    const a = r.moves[i - 1], b = r.moves[i];
    assert.ok(boundary.contains((a.x + b.x) / 2, (a.y + b.y) / 2), 'an extruded segment enters the cutout');
  }
});

test('planar paths start bottom-left and continue to the nearest end without changing layer order', () => {
  assert.equal(typeof routing.orderStrands, 'function');
  const paths = [
    { id: 'far', layer: 0, pts: [P(20, 20), P(21, 20)] },
    { id: 'near-reversed', layer: 0, pts: [P(4, 0), P(2, 0)] },
    { id: 'start', layer: 0, pts: [P(0, 0), P(1, 0)] },
    { id: 'later-layer', layer: 1, pts: [P(0, 0), P(0, 1)] },
  ];
  const out = routing.orderStrands(paths);
  assert.deepEqual(out.map((p) => p.id), ['start', 'near-reversed', 'far', 'later-layer']);
  assert.equal(out[1].pts[0].x, 2);
});

test('closed circles rotate their seam to the nearest point on the next circle', () => {
  assert.equal(typeof routing.orderStrands, 'function');
  const a = { id: 'a', layer: 0, pts: [P(0, 0), P(1, 0)] };
  const b = { id: 'circle', layer: 0, pts: [P(5, 0), P(4, 1), P(3, 0), P(4, -1), P(5, 0)] };
  const out = routing.orderStrands([b, a]);
  assert.equal(out[0].id, 'a');
  assert.deepEqual(out[1].pts[0], P(3, 0));
  assert.deepEqual(out[1].pts.at(-1), P(3, 0));
});

test('pile routing reduces travel while preserving far-to-near rows and fringe anchor starts', () => {
  assert.equal(typeof routing.orderPlacements, 'function');
  const placements = [2, 1, 0].flatMap((row) => [0, 5, 10].map((x) => ({ id: `${row}-${x}`, row, points: [P(x, row * 5), P(x + 1, row * 5)] })));
  const out = routing.orderPlacements(placements, { reverse: true });
  assert.deepEqual(out.map((p) => p.row), [2, 2, 2, 1, 1, 1, 0, 0, 0]);
  assert.ok(out[3].points[0].x >= 10, 'the next row starts at the near end');
  const anchored = routing.orderPlacements(placements, { reverse: false });
  for (const p of anchored) assert.equal(p.points[0].x, placements.find((q) => q.id === p.id).points[0].x);
});

test('all gallery designs open at a consistent 100 by 100 mm', () => {
  for (const d of DESIGNS.filter((d) => d.status === 'ready')) {
    const s = d.defaults();
    assert.deepEqual(d.id === 'loop-pile' ? (s.swatch === 'full' ? [100, 100] : [s.customWidth, s.customHeight]) : [s.width, s.height], [100, 100], d.id);
  }
});

test('curve simplification removes redundant moves below a 0.02 mm geometric tolerance', () => {
  assert.equal(typeof routing.simplifyStrands, 'function');
  const circle = Array.from({ length: 721 }, (_, i) => P(5 * Math.cos(i * Math.PI / 360), 5 * Math.sin(i * Math.PI / 360)));
  const [s] = routing.simplifyStrands([{ pts: circle }], 0.02);
  assert.ok(s.pts.length < 100);
  for (let i = 1; i < s.pts.length; i++) {
    const a = s.pts[i - 1], b = s.pts[i];
    assert.ok(5 - Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2) < 0.0201);
  }
});

test('crossings at numerically rounded segment ends are retained for height planning', () => {
  const { found } = findCrossings([{ pts: [P(0, 0), P(1, 1)] }, { pts: [P(1, 1 + 1e-12), P(2, 0)] }]);
  assert.equal(found.length, 1);
});

test('manual values beyond a slider range survive saving and restoring', () => {
  assert.equal(sanitizeSquiggle({ spacing: 0.8, amplitude: 6 }).spacing, 0.8);
  assert.equal(sanitizeSquiggle({ amplitude: 6 }).amplitude, 6);
  assert.equal(sanitizeCoil({ pitch: 0.8, size: 9 }).size, 9);
  assert.equal(sanitizeCoil({ pitch: 0.8 }).pitch, 0.8);
  assert.equal(sanitizePrimary({ loopSpacing: 0.8, airFlow: 250 }).loopSpacing, 0.8);
  assert.equal(sanitizePrimary({ airFlow: 250 }).airFlow, 250);
  const d = DESIGNS.find((d) => d.id === 'rosette');
  assert.equal(d.sanitize({ spacing: 0.8, lobes: 64 }).spacing, 0.8);
  assert.equal(d.sanitize({ lobes: 64 }).lobes, 64);
});

test('printability ranks have one assessed entry per selectable gallery tile', async () => {
  const { PRINTABILITY } = await import('../src/ui/printability-data.js');
  assert.deepEqual(PRINTABILITY.map((d) => d.id).sort(), DESIGNS.filter((d) => ['ready', 'preset'].includes(d.status)).map((d) => d.id).sort());
  for (let i = 1; i < PRINTABILITY.length; i++) assert.ok(PRINTABILITY[i].score >= PRINTABILITY[i - 1].score);
  assert.ok(PRINTABILITY.every((d) => d.physicallyVerified === false));
});

test('long segments on the bed are fully supported, regardless of vertex density', () => {
  const report = routing.analyzeFabric([{ pts: [P(0, 0, 0.2), P(100, 0, 0.2)] }]);
  assert.equal(report.longestUnsupported, 0);
});
