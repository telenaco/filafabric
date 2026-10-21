import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSvg } from '../src/engine/svg-parse.js';
import { vectorPatternRings } from '../src/engine/svg-lines.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, projectRoot } from './helpers.js';

// A drawing with a flat design prints layer by layer, as a slicer would: the drawing's lines, the green's first layer and
// the pattern's first layer lie on the bed, and the green's second layer comes once nothing lower is left to print.

const { machine, material } = defaultProfiles();
const lace = () => parseSvg(fs.readFileSync(path.join(projectRoot, 'samples', 'lace-sample.svg'), 'utf8'), 'lace-sample.svg');
const zMin = (s) => Math.min(...s.pts.map((p) => p.z));

function laceZigzag(extraLayers = 0) {
  const vector = lace();
  return generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: vector.width, height: vector.height,
    vector, outline: vectorPatternRings(vector), shapeOutline: true, extraLayers, brim: 0 });
}

test('with a drawing, the pattern keeps its own layers: its first layer lies on the bed beside the drawing\'s lines', () => {
  const r = laceZigzag(), h = r.cfg.t.layer_height;
  const pattern = r.strands.filter((s) => /^pattern-/.test(s.id) && s.name !== 'Structural tie');
  const first = pattern.filter((s) => s.layer === 1), second = pattern.filter((s) => s.layer === 2);
  assert.ok(first.length && second.length, 'both zigzag layers are there');
  assert.ok(Math.abs(Math.min(...first.map(zMin)) - h) < 1e-9, 'the first zigzag layer is on the bed');
  // (its ends rise onto the edges of the windows they finish on)
  let length = 0, flat = 0;
  for (const s of first) for (let i = 1; i < s.pts.length; i++) {
    const a = s.pts[i - 1], b = s.pts[i], d = Math.hypot(b.x - a.x, b.y - a.y);
    length += d;
    if (Math.abs(a.z - h) < 1e-9 && Math.abs(b.z - h) < 1e-9) flat += d;
  }
  assert.ok(flat / length > 0.75, `most of the first layer lies on the bed (${Math.round((100 * flat) / length)}%)`);
});

test('the green on the bed prints layer by layer with the pattern, not both its layers before it', () => {
  const r = laceZigzag(), h = r.cfg.t.layer_height;
  const isGreen = (m, k) => m.extrude && new RegExp(`^solid-\\d+-${k}-`).test(m.tag) && Math.abs(m.z - k * h) < 1e-9;
  const isPattern = (m) => m.extrude && /^pattern-/.test(m.tag);
  const index = (pred) => r.moves.findIndex(pred), lastIndex = (pred) => r.moves.findLastIndex(pred);
  const layerOf = (m) => r.strands.find((s) => s.id === m.tag)?.layer;
  const greenFirst = index((m) => isGreen(m, 1)), greenTop = index((m) => isGreen(m, 2));
  assert.ok(greenFirst >= 0 && greenTop >= 0, 'the green body prints two layers on the bed');
  assert.ok(lastIndex((m) => isGreen(m, 1)) < index((m) => isPattern(m) && layerOf(m) === 1), 'the green\'s first layer, then the pattern\'s first');
  assert.ok(lastIndex((m) => isPattern(m) && layerOf(m) === 1) < greenTop, 'then the green\'s second layer');
  assert.ok(lastIndex((m) => isGreen(m, 2)) < index((m) => isPattern(m) && layerOf(m) === 2), 'then the pattern\'s second');
  // the green dot on top of a petal still prints last, on the pattern
  const dot = r.strands.filter((s) => s.name === 'Solid shape' && !s.ground);
  assert.ok(dot.length && r.strands.indexOf(dot[0]) > r.strands.findLastIndex((s) => /^pattern-/.test(s.id)));
});

test('the print never comes down beside green already printed higher up', () => {
  for (const extra of [0, 2]) {
    const r = laceZigzag(extra);
    const green = [];
    for (const [i, m] of r.moves.entries()) {
      if (!m.extrude) continue;
      if (/^solid-/.test(m.tag) && r.strands.find((s) => s.id === m.tag)?.ground) { green.push(m); continue; }
      // a pattern move within a bead of a green move printed before it, and lower than it
      const clash = green.find((g) => g.z > m.z + 1e-6 && Math.hypot(g.x - m.x, g.y - m.y) < 0.45);
      assert.ok(!clash, `move ${i} (${m.tag}) at z ${m.z.toFixed(2)} beside green at z ${clash?.z.toFixed(2)} (${extra} extra layers)`);
    }
  }
});
