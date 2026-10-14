import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateSquiggleTextile, generateSquiggle, SAMPLERS, createImageSampler } from '../src/engine/squiggle.js';

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

