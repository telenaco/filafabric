import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSvg } from '../src/engine/svg-parse.js';
import { interpretDrawing } from '../src/engine/drawing.js';
import { vectorPatternRings } from '../src/engine/svg-lines.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { solidLayer } from '../src/engine/solid-fill.js';
import { solidOnly } from '../src/engine/svg-solids.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const lace = () => parseSvg(fs.readFileSync(path.join(projectRoot, 'samples', 'lace-sample.svg'), 'utf8'), 'lace-sample.svg');
const inside = (p, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const distance = (p, ring) => Math.min(...ring.map((a, i) => {
  const b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}));
const circle = (x, y, r, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: x + r * Math.cos((2 * Math.PI * i) / n), y: y + r * Math.sin((2 * Math.PI * i) / n) }));
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
const drawing = (shapes, width = 100, height = 100) => ({ width, height, paths: shapes.map((s) => s.pts), styles: shapes.map((s) => ({ color: s.color, width: 0.5 })) });

test('the innermost shape decides: a lace body is its green outline less its blue cut-outs and red windows', () => {
  const m = interpretDrawing(lace());
  assert.equal(m.solids.length, 2, 'the lace body and the dot');
  const body = m.solids.find((s) => s.holes.length);
  assert.equal(body.holes.length, 19, '12 eyelets, 6 petals and the centre');
  assert.equal(body.edged.filter(Boolean).length, 7, 'the red windows have their edges printed; the eyelets do not');
  assert.equal(m.fills.length, 7, 'the red windows are filled with the pattern');
  assert.equal(m.fills.filter((f) => f.holes.length === 1).length, 1, 'the blue hole in the red centre is a hole in the pattern');
  assert.equal(m.solids.find((s) => !s.holes.length).holes.length, 0, 'the green dot inside a petal is a solid of its own');
});

test('a lace prints its body solid on the bed round the openings, the pattern only in the red windows, a green dot on top', () => {
  const { machine, material } = defaultProfiles();
  const vector = lace(), m = interpretDrawing(vector);
  const r = generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: vector.width, height: vector.height,
    vector, outline: vectorPatternRings(vector), shapeOutline: true, extraLayers: 0, brim: 2 });
  const h = r.cfg.t.layer_height;
  const body = m.solids.find((s) => s.holes.length), dot = m.solids.find((s) => !s.holes.length);
  const pattern = r.strands.filter((s) => /^pattern-/.test(s.id) && s.name !== 'Structural tie');
  const solids = r.strands.filter((s) => s.name === 'Solid shape');
  const bodySolid = solids.filter((s) => !inside(s.pts[0], dot.ring)), dotSolid = solids.filter((s) => inside(s.pts[0], dot.ring));
  assert.ok(pattern.length > 0 && bodySolid.length > 0 && dotSolid.length > 0);
  // the pattern stays in the windows (its ends may touch their edges)
  const windows = m.fills;
  for (const p of pattern.flatMap((s) => s.pts)) {
    const ok = windows.some((f) => inside(p, f.ring) && !f.holes.some((hole) => inside(p, hole)))
      || windows.some((f) => [f.ring, ...f.holes].some((ring) => distance(p, ring) < 0.6));
    assert.ok(ok, `pattern point (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) outside the red windows`);
  }
  // the solid body never enters an opening, and lies on the bed
  for (const p of bodySolid.flatMap((s) => s.pts)) assert.ok(!body.holes.some((hole) => inside(p, hole)), 'solid inside an opening');
  assert.equal(Math.min(...bodySolid.flatMap((s) => s.pts.map((p) => p.z))), h, 'the body starts on the first layer');
  assert.ok(Math.min(...dotSolid.flatMap((s) => s.pts.map((p) => p.z))) > Math.min(...pattern.flatMap((s) => s.pts.map((p) => p.z))), 'the dot sits on the pattern');
  // the body prints before the pattern and the dot after it
  const at = (list) => r.strands.indexOf(list[0]);
  assert.ok(at(bodySolid) < at(pattern) && at(pattern) < at(dotSolid));
  assert.equal(r.warnings.filter((w) => /leave the outline|pass below/.test(w)).length, 0, r.warnings.join('; '));
});

test('overlapping openings in a solid are one opening, so its fill never runs across where they overlap', () => {
  const vector = drawing([
    { color: 'green', pts: rect(10, 10, 80, 80) },
    { color: 'red', pts: circle(45, 50, 12) },
    { color: 'blue', pts: circle(60, 50, 10) },
  ]);
  const body = interpretDrawing(vector).solids[0];
  assert.equal(body.holes.length, 1, 'the red window and the blue cut-out overlap: one opening');
  const openings = [circle(45, 50, 12), circle(60, 50, 10)];
  for (const layer of [0, 1]) {
    for (const p of solidLayer(body.ring, { holes: body.holes, edged: body.edged, layer }).flat()) {
      assert.ok(!openings.some((o) => inside(p, o)), `solid at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) inside an opening`);
    }
  }
});

test('green is solid wherever it is the innermost shape: in a blue cut-out a disc on the bed, on red a solid on the pattern', () => {
  const { machine, material } = defaultProfiles();
  const vector = drawing([
    { color: 'red', pts: rect(5, 5, 90, 70) },
    { color: 'blue', pts: circle(28, 40, 14) },
    { color: 'green', pts: circle(28, 40, 7) },
    { color: 'green', pts: circle(70, 40, 7) },
  ], 100, 80);
  const r = generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: 100, height: 80,
    vector, outline: vectorPatternRings(vector), shapeOutline: true, extraLayers: 0, brim: 2 });
  const h = r.cfg.t.layer_height, near = (p, x, y, d) => Math.hypot(p.x - x, p.y - y) < d;
  const solids = r.strands.filter((s) => s.name === 'Solid shape');
  const pattern = r.strands.filter((s) => /^pattern-/.test(s.id) && s.name !== 'Structural tie');
  const zMin = (list) => Math.min(...list.flatMap((s) => s.pts.map((p) => p.z)));
  const inHole = solids.filter((s) => near(s.pts[0], 28, 40, 7)), onRed = solids.filter((s) => near(s.pts[0], 70, 40, 7));
  assert.ok(inHole.length && onRed.length);
  assert.equal(zMin(inHole), h, 'the disc in the cut-out lies on the bed');
  assert.ok(zMin(onRed) > zMin(pattern), 'the circle on red sits on the pattern');
  assert.equal(pattern.flatMap((s) => s.pts).filter((p) => near(p, 28, 40, 13.5) && !near(p, 28, 40, 7.5)).length, 0, 'the ring of the cut-out round the disc stays empty');
  assert.ok(!r.warnings.some((w) => /leave the outline/.test(w)), 'the disc is part of the piece');
  assert.ok(r.warnings.some((w) => /separate fabric regions/.test(w)), 'and it is loose: nothing ties it to the rest, which the check says');
});

test('coil loops are laid whole and cut by the shape: windows too small for a loop still get the part that falls in them', () => {
  const { machine, material } = defaultProfiles();
  const windows = [[20, 20, 1.5], [35, 22, 2], [50, 20, 3], [70, 25, 4], [25, 45, 2.5], [55, 48, 6]];
  const vector = drawing([{ color: 'green', pts: rect(5, 5, 90, 60) }, ...windows.map(([x, y, r]) => ({ color: 'red', pts: circle(x, y, r) }))], 100, 70);
  const r = generateDesignExport({ machine, material, design: 'coil', settings: designById('coil').defaults(), width: 100, height: 70,
    vector, outline: vectorPatternRings(vector), shapeOutline: true, extraLayers: 0, brim: 0 });
  const pattern = r.strands.filter((s) => /^pattern-/.test(s.id) && s.name !== 'Structural tie').flatMap((s) => s.pts);
  // (a window smaller than a loop's own opening, 3 mm here, can sit wholly inside one: the cut leaves it as the loop is)
  for (const [x, y, rad] of windows.filter(([, , wr]) => 2 * wr >= 4)) {
    const inWindow = pattern.filter((p) => Math.hypot(p.x - x, p.y - y) < rad);
    assert.ok(inWindow.length > 0, `the ${2 * rad} mm window at (${x}, ${y}) has loops in it`);
  }
  assert.ok(pattern.every((p) => windows.some(([wx, wy, wr]) => Math.hypot(p.x - wx, p.y - wy) < wr + 0.6)), 'nothing outside the windows');
});

test('a drawing all green and blue prints its solid alone: no pattern and no brim, the green outline is the piece', () => {
  const { machine, material } = defaultProfiles();
  const vector = drawing([{ color: 'green', pts: rect(10, 10, 60, 40) }, { color: 'blue', pts: circle(30, 30, 6) }, { color: 'blue', pts: circle(50, 30, 6) }], 80, 60);
  assert.equal(solidOnly(vector), true);
  const rings = vectorPatternRings(vector);
  assert.equal(rings.length, 3, 'the green outline and its two openings');
  const r = generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: 80, height: 60, vector, outline: rings, shapeOutline: true, extraLayers: 0, brim: 2 });
  assert.equal(r.strands.filter((s) => /^pattern-/.test(s.id)).length, 0, 'no pattern');
  assert.ok(r.strands.some((s) => s.name === 'Solid shape'));
  assert.equal(r.brim, undefined, 'no brim over the solid edge');
  assert.ok(r.moves.some((m) => m.extrude));
  assert.equal(solidOnly(lace()), false, 'a lace with red windows has a pattern');
});
