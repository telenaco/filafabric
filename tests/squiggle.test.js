import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateSquiggleTextile, generateSquiggle, SAMPLERS, createImageSampler, minCrossingAmplitude } from '../src/engine/squiggle.js';

const machine = JSON.parse(readFileSync('profiles/machines/prusa-mk3s.json', 'utf8'));
const material = JSON.parse(readFileSync('profiles/materials/generic-flex-mk3.json', 'utf8'));

test('Squiggle cross mode: generates two non-empty layers at proper Z heights', () => {
  const result = generateSquiggleTextile({
    width: 40,
    height: 40,
    mode: 'cross',
    spacing: 3,
    amplitude: 1.0,
    wavelength: 4.0,
    layerHeight: 0.2,
  });

  assert.ok(result.layer1.length > 50, 'layer 1 has points');
  assert.ok(result.layer2.length > 50, 'layer 2 has points');
  assert.equal(result.strands.length, 2);

  // Check Z heights
  for (const pt of result.layer1) {
    assert.equal(pt.z, 0.2);
  }
  for (const pt of result.layer2) {
    assert.equal(pt.z, 0.4);
  }
});

test('Squiggle parallel mode: generates two layers at z1 and z2 with anti-phase overlap', () => {
  const result = generateSquiggleTextile({
    width: 30,
    height: 30,
    mode: 'parallel',
    spacing: 2.5,
    amplitude: 1.2,
    layerHeight: 0.25,
  });

  assert.ok(result.layer1.length > 50);
  assert.ok(result.layer2.length > 50);
  assert.equal(result.layer1[0].z, 0.25);
  assert.equal(result.layer2[0].z, 0.50);
});

test('Continuous paths: no duplicate identical consecutive points in either layer', () => {
  const result = generateSquiggleTextile({
    width: 30,
    height: 30,
    mode: 'cross',
    spacing: 3,
  });

  for (let i = 1; i < result.layer1.length; i++) {
    const d = Math.hypot(result.layer1[i].x - result.layer1[i - 1].x, result.layer1[i].y - result.layer1[i - 1].y);
    assert.ok(d > 1e-6, `layer1 duplicate at ${i}`);
  }
  for (let i = 1; i < result.layer2.length; i++) {
    const d = Math.hypot(result.layer2[i].x - result.layer2[i - 1].x, result.layer2[i].y - result.layer2[i - 1].y);
    assert.ok(d > 1e-6, `layer2 duplicate at ${i}`);
  }
});

test('Procedural samplers return values in [0, 1]', () => {
  for (const [name, fn] of Object.entries(SAMPLERS)) {
    for (let x = 0; x <= 50; x += 10) {
      for (let y = 0; y <= 50; y += 10) {
        const val = fn(x, y, 50, 50);
        assert.ok(val >= 0 && val <= 1, `${name} returned ${val} at (${x}, ${y})`);
      }
    }
  }
});

test('createImageSampler samples dark and light pixels accurately', () => {
  // 2x2 mock image: [dark (0), white (255), white (255), dark (0)]
  const data = new Uint8ClampedArray([
    0, 0, 0, 255,        // (0,0) black -> darkness 1.0
    255, 255, 255, 255,  // (1,0) white -> darkness 0.0
    255, 255, 255, 255,  // (0,1) white -> darkness 0.0
    0, 0, 0, 255,        // (1,1) black -> darkness 1.0
  ]);
  const sampler = createImageSampler({ data, width: 2, height: 2 }, 10, 10);

  assert.ok(Math.abs(sampler(1, 1) - 1.0) < 0.05, 'top-left is dark');
  assert.ok(Math.abs(sampler(9, 1) - 0.0) < 0.05, 'top-right is light');
});

test('generateSquiggle: produces valid moves, stats, and G-code for MK3S', () => {
  const output = generateSquiggle(machine, material, {
    width: 40,
    height: 40,
    mode: 'cross',
    spacing: 3.0,
    amplitude: 1.2,
    colorChange: true,
  });

  assert.ok(output.moves.length > 100);
  assert.ok(output.stats.filamentMm > 0);
  assert.ok(output.gcode.includes('; Textile G-code generator v1'));
  assert.ok(output.gcode.includes('M600 ; Pause for filament color change'));
  assert.ok(output.gcode.includes('; BODY END'));
});


/** Groups a serpentine's points into its lanes (nearest nominal line), dropping the turnarounds past the edges. */
function lanesOf(points, first, pitch, count, width) {
  const lanes = Array.from({ length: count }, () => []);
  for (const p of points) {
    if (p.x < 0.5 || p.x > width - 0.5) continue;
    const k = Math.round((p.y - first) / pitch);
    if (k >= 0 && k < count) lanes[k].push(p);
  }
  return lanes.map((l) => l.sort((a, b) => a.x - b.x));
}

/** How many times polyline `a` crosses polyline `b` (both functions of x). */
function crossings(a, b) {
  const yAt = (pts, x) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].x >= x) {
        const p = pts[i - 1], q = pts[i];
        return p.y + ((q.y - p.y) * (x - p.x)) / Math.max(q.x - p.x, 1e-9);
      }
    }
    return pts[pts.length - 1].y;
  };
  let count = 0, prev = null;
  for (const p of a) {
    const d = Math.sign(p.y - yAt(b, p.x));
    if (prev !== null && d !== 0 && d !== prev) count++;
    if (d !== 0) prev = d;
  }
  return count;
}

test('parallel mode: layer 2 sits halfway between layer 1 lines and crosses both neighbours, even where the pattern is light', () => {
  const width = 30, height = 30, spacing = 2.5;
  for (const amplitude of [1.2, 0.4]) {
    const r = generateSquiggleTextile({ width, height, mode: 'parallel', spacing, amplitude, wavelength: 4, sampler: () => 0 });
    const rows = Math.floor(height / spacing), pitch = height / rows;
    const l1 = lanesOf(r.layer1, pitch / 2, pitch, rows, width);
    const l2 = lanesOf(r.layer2, pitch, pitch, rows - 1, width);
    assert.equal(r.strands.length, 2);
    for (let k = 0; k < rows - 1; k++) {
      const mid = l2[k].reduce((s, p) => s + p.y, 0) / l2[k].length;
      assert.ok(Math.abs(mid - (k + 1) * pitch) < 0.05, `layer 2 line ${k} centred between layer 1 lines`);
      assert.ok(crossings(l2[k], l1[k]) >= 6, `amplitude ${amplitude}: layer 2 line ${k} crosses the line below`);
      assert.ok(crossings(l2[k], l1[k + 1]) >= 6, `amplitude ${amplitude}: layer 2 line ${k} crosses the line above`);
    }
  }
});

test('the crossing depth: a quarter of the spacing plus half a strand', () => {
  assert.ok(Math.abs(minCrossingAmplitude(2.5, 0.45) - 0.85) < 1e-12);
  assert.ok(Math.abs(minCrossingAmplitude(4, 0.4) - 1.2) < 1e-12);
});

test('squiggle in an outline: both layers stay within reach of the shape and a concave shape splits into strands', () => {
  const circle = Array.from({ length: 64 }, (_, i) => ({ x: 20 + 18 * Math.cos((2 * Math.PI * i) / 64), y: 20 + 18 * Math.sin((2 * Math.PI * i) / 64) }));
  for (const mode of ['cross', 'parallel']) {
    const r = generateSquiggle(machine, material, { width: 40, height: 40, mode, amplitude: 1.2, outline: [circle] });
    assert.ok(r.moves.some((m) => m.extrude && m.cls === 'base') && r.moves.some((m) => m.extrude && m.cls === 'supported'), `${mode}: both layers print`);
    for (const m of r.moves) {
      if (m.extrude) assert.ok(Math.hypot(m.x - 20, m.y - 20) <= 18 + 1.2 + 0.6, `${mode}: ${m.x},${m.y} is near the outline`);
    }
  }
  const U = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 20, y: 30 }, { x: 20, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }, { x: 0, y: 30 }];
  const u = generateSquiggle(machine, material, { width: 30, height: 30, mode: 'parallel', outline: [U] });
  assert.ok(u.strands.filter((s) => s.kind === 'base').length >= 2, 'the notch splits layer 1');
  assert.equal(u.strands.filter((s) => s.pauseBefore).length, 0);
  const paused = generateSquiggle(machine, material, { width: 30, height: 30, mode: 'parallel', outline: [U], colorChange: true });
  assert.equal(paused.strands.filter((s) => s.pauseBefore).length, 1, 'one colour change, before the first layer 2 strand');
  assert.equal((paused.gcode.match(/^M600/gm) ?? []).length, 1);
});
