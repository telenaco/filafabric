import test from 'node:test';
import assert from 'node:assert/strict';
import { infillLines, totalLength, INFILL_IDS, INFILL_PATTERNS } from '../src/engine/infill.js';
import { boundaryFor, boundaryArea } from '../src/engine/layers.js';
import { findCrossings } from '../src/engine/crossings.js';

const ring = (n, r, cx, cy) => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) }));
const square = boundaryFor(100, 100);
const donut = boundaryFor(100, 100, [ring(72, 46, 50, 50), ring(48, 16, 50, 50)]);

test('there are the 17 PrusaSlicer infill patterns, each with a label and hint', () => {
  assert.equal(INFILL_IDS.length, 17);
  for (const id of INFILL_IDS) {
    assert.ok(INFILL_PATTERNS[id].label.length > 1, id);
    assert.ok(INFILL_PATTERNS[id].hint.length > 10, id);
  }
});

test('every pattern fills a square and an outline with a hole, staying inside', () => {
  for (const id of INFILL_IDS) {
    for (const [name, boundary] of [['square', square], ['donut', donut]]) {
      const lines = infillLines(id, boundary, { spacing: 3.5, angle: 20, layer: 0 });
      assert.ok(lines.length > 0, `${id} on ${name} made no lines`);
      let points = 0, outside = 0;
      for (const pts of lines) {
        assert.ok(pts.length >= 2, id);
        for (const p of pts) {
          points++;
          if (!boundary.contains(p.x, p.y)) outside++;
        }
      }
      // connectors between lines may graze the edge; the lines themselves never leave
      assert.ok(outside / points < 0.02, `${id} on ${name}: ${outside} of ${points} points outside`);
    }
  }
});

test('patterns that promise an equivalent spacing use about that much line', () => {
  const area = boundaryArea(square);
  const ids = ['rectilinear', 'aligned', 'grid', 'triangles', 'stars', 'cubic', 'line', 'concentric', 'honeycomb', 'honeycomb3d', 'gyroid', 'hilbert', 'archimedean'];
  for (const id of ids) {
    for (const layer of [0, 1]) {
      const eq = area / totalLength(infillLines(id, square, { spacing: 4, layer }));
      assert.ok(eq > 3 && eq < 5.2, `${id} layer ${layer}: area / length = ${eq.toFixed(2)} mm for spacing 4`);
    }
  }
});

test('a smaller spacing is always more line', () => {
  for (const id of INFILL_IDS) {
    const wide = totalLength(infillLines(id, square, { spacing: 6 }));
    const tight = totalLength(infillLines(id, square, { spacing: 3 }));
    assert.ok(tight > wide * 1.2, `${id}: ${tight.toFixed(0)} mm at 3 vs ${wide.toFixed(0)} mm at 6`);
  }
});

test('angle turns a parallel pattern', () => {
  const along = (lines) => lines.flatMap((pts) => pts.slice(1).map((p, i) => ({ dx: p.x - pts[i].x, dy: p.y - pts[i].y }))).filter((d) => Math.hypot(d.dx, d.dy) > 0.3);
  const flat = along(infillLines('aligned', square, { spacing: 5, angle: 0 }));
  const steep = along(infillLines('aligned', square, { spacing: 5, angle: 90 }));
  const horizontal = (steps) => steps.filter((d) => Math.abs(d.dy) < 0.05 * Math.abs(d.dx)).length / steps.length;
  const vertical = (steps) => steps.filter((d) => Math.abs(d.dx) < 0.05 * Math.abs(d.dy)).length / steps.length;
  assert.ok(horizontal(flat) > 0.9, 'at 0° the lines run along x');
  assert.ok(vertical(steep) > 0.9, 'at 90° the lines run along y');
});

test('rectilinear turns 90° on every layer; aligned stays put but shifts half a gap', () => {
  const dominant = (lines) => {
    let h = 0, v = 0;
    for (const pts of lines) for (let i = 1; i < pts.length; i++) { h += Math.abs(pts[i].x - pts[i - 1].x); v += Math.abs(pts[i].y - pts[i - 1].y); }
    return h > v ? 'x' : 'y';
  };
  assert.notEqual(dominant(infillLines('rectilinear', square, { spacing: 5, layer: 0 })), dominant(infillLines('rectilinear', square, { spacing: 5, layer: 1 })));
  assert.equal(dominant(infillLines('aligned', square, { spacing: 5, layer: 0 })), dominant(infillLines('aligned', square, { spacing: 5, layer: 1 })));
  // the rows the lines run along (not the short jogs that join them at the ends)
  const rows = (lines) => new Set(lines.flatMap((pts) => pts.filter((p, i) => i > 0 && Math.abs(p.y - pts[i - 1].y) < 1e-6).map((p) => Math.round(p.y * 10) / 10)));
  const l0 = rows(infillLines('aligned', square, { spacing: 5, layer: 0 }));
  const l1 = rows(infillLines('aligned', square, { spacing: 5, layer: 1 }));
  const shared = [...l0].filter((y) => l1.has(y)).length;
  assert.ok(shared < l0.size * 0.1, 'the second layer lies between the first layer\'s lines');
});

test('triangles meet three at a point, stars never do, and cubic opens from layer to layer', () => {
  const triples = (id, layer) => {
    const lines = infillLines(id, square, { spacing: 3, layer });
    const { found } = findCrossings(lines.map((pts) => ({ pts })), { strandWidth: 0.45, mergeDistance: 1e-6 });
    const at = new Map();
    for (const c of found) at.set(`${Math.round(c.x / 0.4)},${Math.round(c.y / 0.4)}`, (at.get(`${Math.round(c.x / 0.4)},${Math.round(c.y / 0.4)}`) ?? 0) + 1);
    return [...at.values()].filter((n) => n >= 3).length;
  };
  assert.ok(triples('triangles', 0) > 30);
  assert.equal(triples('stars', 0), 0);
  assert.ok(triples('cubic', 0) > 30);
  assert.equal(triples('cubic', 1), 0);
});

test('3D patterns give a different slice on each layer', () => {
  const sig = (lines) => lines.slice(0, 6).map((pts) => `${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)},${pts.length}`).join('|');
  for (const id of ['gyroid', 'honeycomb3d', 'cubic', 'adaptive', 'support']) {
    assert.notEqual(sig(infillLines(id, square, { spacing: 4, layer: 0 })), sig(infillLines(id, square, { spacing: 4, layer: 1 })), id);
  }
});

test('infill is deterministic and lightning grows from the edge', () => {
  for (const id of INFILL_IDS) {
    const a = JSON.stringify(infillLines(id, donut, { spacing: 4, angle: 10, layer: 1, seed: 3 }));
    const b = JSON.stringify(infillLines(id, donut, { spacing: 4, angle: 10, layer: 1, seed: 3 }));
    assert.equal(a, b, id);
  }
  const lines = infillLines('lightning', square, { spacing: 4 });
  const nearEdge = lines.filter((pts) => pts.some((p) => Math.min(p.x, p.y, 100 - p.x, 100 - p.y) < 3.5)).length;
  assert.ok(nearEdge >= lines.length * 0.5, 'most trails reach the edge');
});

test('an unknown pattern is an error, and a tiny outline does not crash', () => {
  assert.throws(() => infillLines('plaid', square), /Unknown infill pattern/);
  const tiny = boundaryFor(4, 4);
  for (const id of INFILL_IDS) assert.doesNotThrow(() => infillLines(id, tiny, { spacing: 3 }), id);
});
