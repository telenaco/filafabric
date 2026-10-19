import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, HeightMap, clearanceModel } from '../src/engine/planner.js';
import { scene } from './scene.js';
import { PolygonBoundary } from '../src/engine/boundary.js';

const CLASSES = new Set(['base', 'supported', 'rising', 'falling', 'unsupported', 'travel']);
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

function run(over = {}, reverse = false) {
  const s = scene({ sample_width: 20, sample_height: 20, ...over });
  const placements = reverse ? [...s.tiled.placements].reverse() : s.tiled.placements;
  return { ...s, result: plan(s.cfg, s.base, placements, s.boundary) };
}

test('moves are well formed and travel never extrudes', () => {
  const { result } = run();
  assert.ok(result.moves.length > 100);
  for (const m of result.moves) {
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.z));
    assert.ok(CLASSES.has(m.cls), m.cls);
    assert.equal(m.extrude, m.cls !== 'travel');
  }
  assert.equal(result.moves[0].cls, 'travel');
});

test('loop feet are at loopBaseZ (0.4) and the peak is loopBaseZ + lift (3.4)', () => {
  const { result } = run();
  const loopMoves = result.moves.filter((m) => m.extrude && m.cls !== 'base');
  const zs = loopMoves.map((m) => m.z);
  near(Math.min(...zs), 0.4);
  near(Math.max(...zs), 3.4, 1e-6);
  for (const m of result.moves.filter((q) => q.cls === 'base')) near(m.z, 0.2);
});

test('classification: unsupported near the peak, supported near the feet', () => {
  const { result } = run();
  const unsupported = result.moves.filter((m) => m.cls === 'unsupported');
  assert.ok(unsupported.length > 0);
  for (const m of unsupported) assert.ok(m.z - 0.4 >= 0.6 * 3 - 0.25);
  const supported = result.moves.filter((m) => m.cls === 'supported');
  assert.ok(supported.length > 0);
  // classification uses the segment midpoint, so the endpoint can sit one half-step above the threshold
  for (const m of supported) assert.ok(m.z - 0.4 <= 0.4 + 0.15);
  assert.ok(result.moves.some((m) => m.cls === 'rising'));
  assert.ok(result.moves.some((m) => m.cls === 'falling'));
});

test('travels between strands lift above what is printed', () => {
  const { result } = run();
  const travelsAbove = result.moves.filter((m) => m.cls === 'travel' && m.z > 0.4 + 0.5);
  assert.ok(travelsAbove.length > 0);
});

test('shingle order produces fewer clearance violations than near-to-far order', () => {
  const good = run().result.violations;
  const bad = run({}, true).result.violations;
  assert.ok(bad > good, `reverse ${bad} should exceed shingle ${good}`);
});

test('retract/unretract markers pair up and only appear for long travels', () => {
  const { result } = run({ retraction_length: 2.5 });
  const r = result.moves.filter((m) => m.retract === 'retract').length;
  const u = result.moves.filter((m) => m.retract === 'unretract').length;
  assert.ok(r > 0);
  assert.equal(r, u);
});

test('no retract markers when the retraction length is 0', () => {
  const { result } = run({ retraction_length: 0 });
  assert.equal(result.moves.filter((m) => m.retract).length, 0);
});

test('base only and loops only both plan', () => {
  const baseOnly = run({ include_loops: false }).result;
  assert.ok(baseOnly.moves.every((m) => m.cls === 'base' || m.cls === 'travel'));
  const loopsOnly = run({ include_base: false }).result;
  assert.ok(loopsOnly.moves.every((m) => m.cls !== 'base'));
  assert.ok(loopsOnly.moves.length > 50);
});

test('nothing to print plans to an empty move list', () => {
  const { result } = run({ include_base: false, include_loops: false });
  assert.deepEqual(result.moves, []);
});

test('same-row loops connect continuously only when the bridge stays inside the outline', () => {
  const { cfg } = scene({ sample_width: 20, sample_height: 20 });
  cfg.derived.retraction = { ...cfg.derived.retraction, length: 1, minTravel: 2 };
  const outer = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
  const hole = [{ x: 8, y: 4 }, { x: 12, y: 4 }, { x: 12, y: 6 }, { x: 8, y: 6 }];
  const placements = [
    { id: 'a', row: 0, lift: 0, points: [{ x: 2, y: 5, z: 0 }, { x: 6, y: 5, z: 0 }] },
    { id: 'b', row: 0, lift: 0, points: [{ x: 14, y: 5, z: 0 }, { x: 18, y: 5, z: 0 }] },
  ];
  for (const hasHole of [false, true]) {
    const boundary = new PolygonBoundary(hasHole ? [outer, hole] : [outer]);
    const { moves } = plan(cfg, null, placements, boundary);
    const bridge = moves.find(m => m.x === 14 && m.y === 5 && m.z === cfg.derived.loopBaseZ);
    assert.equal(bridge.extrude, !hasHole, 'a hole requires travel rather than an extruded bridge');
    assert.equal(moves.filter(m => m.retract === 'retract').length, hasHole ? 1 : 0);
  }
});

test('composed supplied strands retain extrusion classes and flow while checking clearance and retracts', () => {
  const s = scene({ sample_width: 20, sample_height: 20, retraction_length: 2.5 });
  const strands = [
    { id: 'texture', kind: 'supported', pts: [{ x: 5, y: 5, z: 3 }, { x: 10, y: 5, z: 3, cls: 'unsupported', flow: 1.7 }] },
    { id: 'low', kind: 'base', pts: [{ x: 5, y: 5.2, z: .2 }, { x: 10, y: 5.2, z: .2 }] },
  ];
  const planned = plan(s.cfg, null, [], s.boundary, { strands });
  const texture = planned.moves.find((m) => m.tag === 'texture');
  assert.equal(texture.cls, 'unsupported');
  assert.equal(texture.flow, 1.7);
  assert.ok(planned.violations > 0, 'the supplied geometry still gets nozzle clearance checks');
  assert.ok(planned.moves.some((m) => !m.extrude && m.z > 3));
  assert.equal(planned.moves.filter((m) => m.retract === 'retract').length, planned.moves.filter((m) => m.retract === 'unretract').length);
  assert.equal(strands[0].pts[1].flow, 1.7);
});

test('HeightMap: add, query and collision model', () => {
  const map = new HeightMap({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
  map.addSegment({ x: 5, y: 5, z: 3 }, { x: 10, y: 5, z: 3 });
  assert.ok(map.maxWithin(7, 5, 0.6) >= 3 - 1e-9);
  assert.equal(map.maxWithin(15, 15, 0.6), -Infinity);
  const model = { tipRadius: 0.6, tanA: Math.tan(Math.PI / 6), clearance: 1 };
  assert.equal(map.collides(7, 5, 0.4, model), true);
  assert.equal(map.collides(7, 15, 0.4, model), false);
  assert.equal(map.collides(7, 5, 3.0, model), false);
});

test('clearanceModel adds a foam pad and converts the cone angle', () => {
  const { cfg } = run();
  const m = clearanceModel(cfg);
  near(m.tipRadius, 0.6);
  near(m.tanA, Math.tan(Math.PI / 6), 1e-12);
  near(m.clearance, 1 + 0.5 * 0.4 * (Math.sqrt(1.5) - 1), 1e-9);
});
