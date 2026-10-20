import test from 'node:test';
import assert from 'node:assert/strict';
import { applySvgSolids, vectorSolids, topOver, SOLID_LAYERS } from '../src/engine/svg-solids.js';
import { exportPanel } from '../src/engine/panel.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { boundaryFor } from '../src/engine/layers.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { defaultProfiles } from './helpers.js';

const profiles = defaultProfiles();
const circle = (cx, cy, r, n = 64) => [...Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) })), { x: cx + r, y: cy }];
const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }, { x, y }];
const drawing = { name: 'solid.svg', width: 80, height: 60, paths: [circle(20, 20, 6), square(45, 30, 12)], styles: [{ color: 'green', width: 0.5 }, { color: 'green', width: 0.5 }] };

test('a result without green shapes is returned as it is', () => {
  const r = generateDesignExport({ ...profiles, design: 'crosshatch', width: 40, height: 40, brim: 0 });
  const vector = { name: 'lines.svg', width: 40, height: 40, paths: [[{ x: 1, y: 1 }, { x: 30, y: 9 }]], styles: [{ color: 'other', width: 0.4 }] };
  assert.equal(applySvgSolids(r, vector), r);
});

test('the fill lies on the highest strand under each shape, the native path is kept, and the fill comes last', () => {
  const base = generateDesignExport({ ...profiles, design: 'crosshatch', width: 80, height: 60, brim: 0 });
  const out = applySvgSolids(base, drawing);
  assert.deepEqual(out.moves.slice(0, base.moves.length), base.moves, 'every move of the pattern is unchanged');
  const h = base.cfg.t.layer_height;
  for (const [i, ring] of [circle(20, 20, 6), square(45, 30, 12)].entries()) {
    const top = topOver(base.strands, ring);
    assert.ok(top > 0, 'the pattern is under the shape');
    const fill = out.strands.filter((s) => s.name === 'Solid shape' && s.id.startsWith(`solid-${i + 1}-`));
    assert.deepEqual([...new Set(fill.map((s) => s.solidLayer))], [0, 1]);
    for (const s of fill) for (const p of s.pts) assert.ok(Math.abs(p.z - (top + (s.solidLayer + 1) * h)) < 1e-9);
  }
  assert.equal(out.solid.count, 2);
  assert.equal(out.solid.coils, 1);
  assert.equal(out.solid.layers, SOLID_LAYERS);
  // nothing prints after the fill, and the lift to it clears everything printed before
  const firstFill = out.moves.findIndex((m) => m.extrude && /^solid-/.test(m.tag));
  assert.ok(out.moves.slice(firstFill).every((m) => !m.extrude || /^solid-/.test(m.tag)));
  const highest = Math.max(...base.moves.map((m) => m.z));
  assert.ok(out.moves.slice(base.moves.length, firstFill).some((m) => !m.extrude && m.z > highest + 2), 'travels in clear of the print');
  assert.match(out.gcode, /; Solid shapes: 2 green \(1 coiled, 1 zigzag\)/);
});

test('green shapes are placed in the drawing and cut to the window being printed', () => {
  // a 40 x 40 window starting at (30, 20) of the drawing: the square (45..57, 30..42) is inside it, the circle is not
  const solids = vectorSolids(drawing, 80, 60, 30, 20);
  assert.ok(solids[1].ring.every((p) => p.x >= 15 - 1e-9 && p.x <= 27 + 1e-9 && p.y >= 10 - 1e-9 && p.y <= 22 + 1e-9));
  const base = generateDesignExport({ ...profiles, design: 'crosshatch', width: 40, height: 40, brim: 0 });
  const out = applySvgSolids(base, drawing, { fullWidth: 80, fullHeight: 60, offsetX: 30, offsetY: 20 });
  assert.equal(out.solid.count, 2);
  const fill = out.strands.filter((s) => s.name === 'Solid shape');
  assert.ok(fill.length > 0);
  assert.ok(fill.every((s) => s.pts.every((p) => p.x >= -1e-9 && p.x <= 40 + 1e-9 && p.y >= -1e-9 && p.y <= 40 + 1e-9)), 'nothing outside the window');
});

test('a drawing scaled to a larger size scales its solid shapes with it', () => {
  const solids = vectorSolids(drawing, 160, 120);
  const xs = solids[0].ring.map((p) => p.x);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 24) < 0.1, 'the 12 mm circle becomes 24 mm');
});

test('a repeating panel prints the green shapes once, on top, after every section', async () => {
  let text = '';
  const stats = await exportPanel({ ...profiles, design: 'crosshatch', width: 80, height: 60, repeat: 40, vector: drawing, brim: 0 }, { write: async (s) => { text += s; } });
  assert.equal(stats.solidCount, 2);
  const at = text.indexOf('; solid shapes: 2 green');
  assert.ok(at > text.lastIndexOf('; texture section '), 'after the last section');
  // the fill is the highest thing printed under the shapes
  const zs = [...text.slice(at).matchAll(/^G1 [^\n]*Z([\d.]+)[^\n]*E/gm)].map((m) => +m[1]);
  const before = [...text.slice(0, at).matchAll(/^G1 [^\n]*Z([\d.]+)/gm)].map((m) => +m[1]);
  assert.ok(zs.length === 0 || Math.min(...zs) > 0, 'the fill prints');
  assert.ok(Math.max(...before) > 0);
});
