import test from 'node:test';
import assert from 'node:assert/strict';
import { tile, countLegGapViolations, MAX_LOOPS } from '../src/engine/tiler.js';
import { ConfigError } from '../src/engine/params.js';
import { RectBoundary } from '../src/engine/boundary.js';
import { createRng } from '../src/engine/rng.js';
import { scene } from './scene.js';

function setup(over = {}) {
  const s = scene({ ...over, include_loops: false });
  return { cfg: s.cfg, boundary: s.boundary };
}

test('default 100 x 100 tile: 18 rows, 567 loops, far rows first', () => {
  const { cfg, boundary } = setup();
  const { placements, counts } = tile(cfg, boundary, createRng(1));
  assert.equal(placements.length, 567);
  assert.equal(counts.kept, 567);
  assert.equal(new Set(placements.map((p) => p.row)).size, 18);
  assert.equal(placements[0].row, 17);
  assert.equal(placements[placements.length - 1].row, 0);
  assert.equal(placements.filter((p) => p.row === 0).length, 32);
  assert.equal(placements.filter((p) => p.row === 1).length, 31);
  for (let i = 1; i < placements.length; i++) {
    const a = placements[i - 1], b = placements[i];
    assert.ok(a.row > b.row || (a.row === b.row && a.col < b.col));
  }
});

test('feet sit on the foot line and legs are width apart', () => {
  const { cfg, boundary } = setup();
  const { placements } = tile(cfg, boundary, createRng(1));
  const p = placements.find((q) => q.row === 0 && q.col === 0);
  assert.ok(Math.abs(p.points[0].y - 0) < 1e-9);
  assert.ok(Math.abs(p.points[0].x - 0) < 1e-9);
  assert.ok(Math.abs(p.points[p.points.length - 1].x - 6) < 1e-9);
  assert.equal(p.footY, 0);
  assert.equal(p.lift, 3);
});

test('leg gap invariant holds on the default tile', () => {
  const { cfg, boundary } = setup();
  const { placements, warnings } = tile(cfg, boundary, createRng(1));
  assert.equal(countLegGapViolations(placements, 0.6), 0);
  assert.deepEqual(warnings, []);
  // coincident legs would be 0 apart; the nudge pattern is 0,0,+g,+g along the row
  const row0 = placements.filter((p) => p.row === 0).sort((a, b) => a.col - b.col);
  const left = row0.slice(0, 6).map((p) => +p.points[0].x.toFixed(3));
  assert.deepEqual(left, [0, 3, 6.6, 9.6, 12, 15]);
});

test('20 x 20 sample holds 10 loops (2 rows of 5)', () => {
  const { cfg, boundary } = setup({ sample_width: 20, sample_height: 20 });
  const { placements } = tile(cfg, boundary, createRng(1));
  assert.equal(placements.length, 10);
});

test('randomness off never touches the rng', () => {
  const { cfg, boundary } = setup({ sample_width: 30, sample_height: 30 });
  const exploding = { next() { throw new Error('rng used'); }, symmetric() { throw new Error('rng used'); } };
  assert.doesNotThrow(() => tile(cfg, boundary, exploding));
});

test('same seed gives identical tiles, a different seed differs', () => {
  const over = {
    sample_width: 30, sample_height: 30, random_enabled: true,
    amp_length: 1, amp_width: 0.5, amp_lift: 0.5, amp_xy: 0.5, amp_orientation: 5, amp_spacing: 0.3,
  };
  const { cfg, boundary } = setup(over);
  const a = tile(cfg, boundary, createRng(7));
  const b = tile(cfg, boundary, createRng(7));
  const c = tile(cfg, boundary, createRng(8));
  assert.deepEqual(a.placements, b.placements);
  assert.notDeepEqual(a.placements, c.placements);
});

test('a sample smaller than one loop yields zero loops and a warning', () => {
  const { cfg, boundary } = setup({ sample_width: 5, sample_height: 5 });
  const { placements, warnings } = tile(cfg, boundary, createRng(1));
  assert.equal(placements.length, 0);
  assert.ok(warnings.some((w) => /no loops fit/i.test(w)));
});

test('an unresolvable leg gap terminates with a warning', () => {
  const { cfg, boundary } = setup({ sample_width: 20, sample_height: 20, loop_pitch: 0.5 });
  const { placements, warnings } = tile(cfg, boundary, createRng(1));
  assert.ok(placements.length > 0);
  assert.ok(warnings.some((w) => /leg gap/i.test(w)));
});

test('loop counts beyond the former 6000-loop ceiling can be generated', () => {
  const { cfg, boundary } = setup({ loop_pitch: .3, base_spacing: 4, curve_resolution: 5 });
  const { counts } = tile(cfg, boundary, createRng(1));
  assert.ok(counts.candidates > 6000);
  assert.equal(MAX_LOOPS, Infinity);
});

test('loops that leave the boundary are dropped', () => {
  const { cfg } = setup({ sample_width: 30, sample_height: 30 });
  const small = new RectBoundary(30, 18);
  const { placements, counts } = tile(cfg, small, createRng(1));
  assert.ok(counts.dropped > 0);
  for (const p of placements) for (const q of p.points) assert.ok(q.y <= 18 + 1e-9);
});

test('liftAt scales the pile height of each loop from where it sits', () => {
  const { cfg, boundary } = setup({ sample_width: 40, sample_height: 20 });
  const flat = tile(cfg, boundary, createRng(1));
  const shaped = tile(cfg, boundary, createRng(1), { liftAt: (x) => (x < 20 ? 0.4 : 1) });
  const peak = (p) => Math.max(...p.points.map((q) => q.z));
  const left = shaped.placements.filter((p) => p.points[0].x < 18);
  const right = shaped.placements.filter((p) => p.points[0].x > 22);
  assert.ok(left.length > 0 && right.length > 0);
  assert.ok(Math.max(...left.map(peak)) < Math.max(...right.map(peak)) - 0.5);
  assert.ok(Math.abs(Math.max(...right.map(peak)) - Math.max(...flat.placements.map(peak))) < 1e-9, 'a factor of 1 leaves the loop alone');
});
