import test from 'node:test';
import assert from 'node:assert/strict';
import { zProfile, sampleFiber } from '../src/engine/fiber.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('every z profile is 0 at the ends and 1 in the middle', () => {
  for (const name of ['sin2', 'bell', 'smoothstep']) {
    near(zProfile(name, 0), 0);
    near(zProfile(name, 1), 0);
    near(zProfile(name, 0.5), 1);
    near(zProfile(name, -3), 0);
    near(zProfile(name, 7), 0);
  }
  assert.throws(() => zProfile('nope', 0.5), /Unknown z profile/);
});

const hairpin = { shape: 'hairpin', width: 6, length: 15, lift: 3, dwell: 1, profile: 'sin2', resolution: 0.4 };

test('hairpin: feet at y=0, legs width apart, arc length about 33.4 mm', () => {
  const { points, arcLength } = sampleFiber(hairpin);
  near(points[0].x, -3);
  near(points[0].y, 0);
  near(points[points.length - 1].x, 3);
  near(points[points.length - 1].y, 0);
  near(arcLength, 2 * 12 + Math.PI * 3, 0.05);
  const maxY = Math.max(...points.map((p) => p.y));
  near(maxY, 15, 1e-9);
});

test('hairpin: z is flat in the dwell, peaks at lift mid-way, symmetric', () => {
  const { points, arcLength } = sampleFiber(hairpin);
  for (const p of points) if (p.s <= 1) near(p.z, 0);
  const peak = Math.max(...points.map((p) => p.z));
  near(peak, 3, 1e-6);
  const mid = points.reduce((best, p) => (Math.abs(p.s - arcLength / 2) < Math.abs(best.s - arcLength / 2) ? p : best));
  near(mid.z, 3, 1e-6);
  for (let i = 0; i < points.length; i++) {
    const mirror = points[points.length - 1 - i];
    near(points[i].z, mirror.z, 1e-9);
  }
});

test('hairpin: z never decreases up to the peak and never increases after', () => {
  const { points } = sampleFiber(hairpin);
  let peakIndex = 0;
  points.forEach((p, i) => { if (p.z > points[peakIndex].z) peakIndex = i; });
  for (let i = 1; i <= peakIndex; i++) assert.ok(points[i].z >= points[i - 1].z - 1e-12);
  for (let i = peakIndex + 1; i < points.length; i++) assert.ok(points[i].z <= points[i - 1].z + 1e-12);
});

test('consecutive points are never farther apart than the resolution', () => {
  const { points } = sampleFiber(hairpin);
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    assert.ok(d <= 0.4 + 1e-9, `gap ${d} at ${i}`);
  }
});

test('peak slope with the defaults is about 17 degrees', () => {
  const { points } = sampleFiber(hairpin);
  let maxSlope = 0;
  for (let i = 1; i < points.length; i++) {
    const ds = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    maxSlope = Math.max(maxSlope, Math.abs(points[i].z - points[i - 1].z) / ds);
  }
  const deg = (Math.atan(maxSlope) * 180) / Math.PI;
  assert.ok(deg > 15.5 && deg < 18, `slope ${deg}`);
});

test('arch: a single strand from (0,0) to (0,length) with the same z profile', () => {
  const { points, arcLength } = sampleFiber({ ...hairpin, shape: 'arch' });
  near(points[0].y, 0);
  near(points[points.length - 1].y, 15);
  near(points[0].x, 0);
  near(arcLength, 15);
  near(Math.max(...points.map((p) => p.z)), 3, 1e-6);
});

test('unknown shape throws', () => {
  assert.throws(() => sampleFiber({ ...hairpin, shape: 'blob' }), /Unknown fiber shape/);
});
