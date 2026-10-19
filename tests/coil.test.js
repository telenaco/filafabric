import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCoilTextile, generateCoil } from '../src/engine/coil.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { ConfigError } from '../src/engine/params.js';
import { MAX_MOVES } from '../src/engine/tiler.js';
import { defaultProfiles } from './helpers.js';

const base = { width: 50, height: 30, size: 3, pitch: 5, rowOverlap: 0.25 };

test('a rectangle is one continuous strand, one layer thick except at crossings', () => {
  const r = generateCoilTextile(base);
  assert.equal(r.strands.length, 1);
  const zs = r.strands[0].pts.map((p) => p.z);
  assert.equal(Math.min(...zs), 0.2);
  assert.ok(Math.max(...zs) <= 0.2 + 0.25 + 1e-9);
  assert.ok(r.crossings > 0 && r.loops > 0);
});

test('every point stays inside the swatch plus a short turn', () => {
  const r = generateCoilTextile(base);
  for (const p of r.strands[0].pts) {
    assert.ok(p.x >= -2 && p.x <= 52, `x ${p.x}`);
    assert.ok(p.y >= -0.01 && p.y <= 30.01, `y ${p.y}`);
  }
});

test('row overlap controls the row pitch and the number of crossings', () => {
  const open = generateCoilTextile({ ...base, rowOverlap: 0 });
  const tight = generateCoilTextile({ ...base, rowOverlap: 0.5 });
  assert.ok(tight.rows > open.rows);
  assert.ok(tight.crossings > open.crossings, 'overlapping rows add crossings between rows');
  assert.ok(tight.rowPitch < open.rowPitch);
});

test('each loop of a looped line crosses itself once', () => {
  // one row, loops far enough apart that neighbours do not touch (2 x size < pitch)
  const r = generateCoilTextile({ ...base, height: 6, rowOverlap: 0, pitch: 8 });
  assert.equal(r.rows, 1);
  assert.equal(r.loops, 5, 'room is kept for the last loop to swing forward');
  assert.equal(r.crossings, 5);
});

test('loops that cannot form are reported, not hidden', () => {
  const r = generateCoilTextile({ ...base, size: 0.8, pitch: 8 });
  assert.ok(r.warnings.some((w) => /loops close up/i.test(w)));
});

test('the lifts never exceed the slope budget', () => {
  const r = generateCoilTextile({ ...base, rowOverlap: 0.4 });
  assert.ok(r.maxSlopeDeg < 17, String(r.maxSlopeDeg));
});

test('an outline keeps every strand point within one loop radius of the inside', () => {
  const ring = [{ x: 5, y: 2 }, { x: 45, y: 2 }, { x: 45, y: 28 }, { x: 28, y: 28 }, { x: 28, y: 14 }, { x: 5, y: 14 }];
  const boundary = new PolygonBoundary([ring]);
  const r = generateCoilTextile({ ...base, boundary });
  assert.ok(r.strands.reduce((n, s) => n + s.pts.length, 0) > 100);
  const reach = base.size + 0.5;
  const nearInside = (p) => {
    if (boundary.contains(p.x, p.y)) return true;
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      if (boundary.contains(p.x + reach * Math.cos(a), p.y + reach * Math.sin(a))) return true;
    }
    return false;
  };
  for (const s of r.strands) for (const p of s.pts) assert.ok(nearInside(p), `point ${p.x.toFixed(1)}, ${p.y.toFixed(1)} is outside the outline`);
  // nothing prints across the notch: no strand segment is longer than a turn or a loop step
  for (const s of r.strands) {
    for (let i = 1; i < s.pts.length; i++) assert.ok(Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y) < 4, 'a jump across a gap');
  }
});

test('a swatch narrower than one loop says so', () => {
  const r = generateCoilTextile({ ...base, width: 4, height: 10, size: 2, pitch: 6 });
  assert.ok(r.warnings.some((w) => /narrower than one loop/i.test(w)));
  assert.equal(r.loops, 0);
});

test('coil shares the unbounded full-toolpath move policy', () => {
  assert.equal(MAX_MOVES, Infinity);
});

test('generateCoil returns moves, stats and G-code', () => {
  const { machine, material } = defaultProfiles();
  const r = generateCoil(machine, material, base);
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.stats.timeSec > 0 && r.stats.loops === r.coil.loops);
  assert.ok(r.stats.crossings === r.coil.crossings);
  assert.ok(r.gcode.includes('G1'));
  assert.deepEqual(generateCoil(machine, material, base).gcode, r.gcode, 'deterministic');
});

test('a field makes the loops vary in size', () => {
  const flat = generateCoilTextile(base);
  const varied = generateCoilTextile({ ...base, sizeAt: (x) => (x < 25 ? 0.5 : 1) });
  const reach = (r, lo, hi) => Math.max(...r.strands[0].pts.filter((p) => p.x >= lo && p.x < hi).map((p) => Math.abs(p.y - 15)));
  assert.notDeepEqual(varied.strands[0].pts, flat.strands[0].pts);
  assert.ok(reach(varied, 0, 20) < reach(varied, 30, 50) + 1e-9);
});
