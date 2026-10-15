import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../src/ui/designs.js';
import { hatch, boundaryFor } from '../src/engine/layers.js';
import { clipStrands } from '../src/engine/fabric.js';
import { halftoneLayers } from '../src/engine/halftone.js';
import { defaultProfiles } from './helpers.js';

const card = designById('halftone');
const ring = (cx, cy, rx, ry, n = 72) => Array.from({ length: n }, (_, i) => ({ x: cx + rx * Math.cos((2 * Math.PI * i) / n), y: cy + ry * Math.sin((2 * Math.PI * i) / n) }));

test('hatch with a clearance is not cut by a later clip: slanting edges and waves keep one line', () => {
  const b = boundaryFor(100, 100);
  const asStrands = (lines) => lines.map((pts, i) => ({ id: `s${i}`, pts: pts.map((p) => ({ ...p, z: 0.2 })) }));
  for (const [angle, shape] of [[30, null], [45, null], [60, 'wave'], [45, 'zigzag'], [0, 'wave']]) {
    const lines = hatch(b, { angle, spacing: 3, anchor: { x: 50, y: 50 }, shape, size: 1.5, pitch: 8, maxJog: Infinity, keepInside: 0.25 });
    assert.equal(lines.length, 1, `${angle}° ${shape ?? 'straight'}: one chain`);
    assert.equal(clipStrands(asStrands(lines), b, 0.225).length, 1, `${angle}° ${shape ?? 'straight'}: not cut by the clip`);
    for (const p of lines[0]) assert.ok(p.x > 0.2 && p.x < 99.8 && p.y > 0.2 && p.y < 99.8, 'inside the swatch');
  }
  // without the clearance the same hatch is cut into many pieces: the reason for the option
  const plain = hatch(b, { angle: 45, spacing: 3, anchor: { x: 50, y: 50 } });
  assert.ok(clipStrands(asStrands(plain), b, 0.225).length > 10);
});

test('every layer of a halftone net is one continuous line, whatever the line shape and the grid angle', () => {
  const { machine, material } = defaultProfiles();
  for (const [width, height] of [[100, 100], [80, 60], [150, 40]]) {
    for (const shape of ['straight', 'wave', 'zigzag']) {
      for (const angle of [0, 15, 30, 45, 75, 90]) {
        const r = card.generate(machine, material, { ...card.defaults(), width, height, shape, angle });
        assert.equal(r.strands.length, 2, `${width}×${height} ${shape} at ${angle}°: one line per layer, not ${r.strands.length}`);
        assert.equal(r.fabric.issues.length, 0);
      }
    }
  }
});

test('a net inside a round outline is still one line per layer', () => {
  const { machine, material } = defaultProfiles();
  for (const outline of [[ring(50, 50, 45, 45)], [ring(50, 50, 48, 25)]]) {
    for (const [shape, angle] of [['straight', 0], ['wave', 30], ['zigzag', 45]]) {
      const r = card.generate(machine, material, { ...card.defaults(), width: 100, height: 100, shape, angle }, { outline });
      assert.equal(r.strands.length, 2, `${shape} at ${angle}°`);
    }
  }
});

test('the picture carries the thickness without ever cutting a line', () => {
  const { machine, material } = defaultProfiles();
  const counts = new Set();
  for (const pattern of ['stripes', 'bumps', 'noise', 'lightningBolts', 'oceanWaves']) {
    const r = card.generate(machine, material, { ...card.defaults(), pattern, shape: 'wave', angle: 30, thin: 0.3, thick: 2.5 });
    counts.add(r.strands.length);
    assert.ok(r.halftone.lo >= 0.3 - 1e-9 && r.halftone.hi <= 2.5 + 1e-9);
  }
  assert.deepEqual([...counts], [2]);
});

test('a dense net with deep short waves is built (its flow range is read without spreading a huge list)', () => {
  const b = boundaryFor(100, 100);
  const r = halftoneLayers(b, { spacing: 1.5, shape: 'wave', size: 3, pitch: 3, angle: 30 });
  const points = r.layers.flat().reduce((n, pts) => n + pts.length, 0);
  assert.ok(points > 20000, `${points} points`);
  assert.ok(r.extra.halftone.hi >= r.extra.halftone.lo);
});
