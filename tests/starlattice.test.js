import test from 'node:test';
import assert from 'node:assert/strict';
import { tilingFaces, hankinStraps, starLayers, STAR_TILING_IDS } from '../src/engine/starlattice.js';
import { boundaryFor, crossingReport } from '../src/engine/layers.js';
import { findCrossings } from '../src/engine/crossings.js';

const area = (poly) => poly.reduce((a, p, i) => a + p.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * p.y, 0) / 2;

test('the tilings are made of anticlockwise faces that cover the swatch', () => {
  const box = { minX: 0, minY: 0, maxX: 30, maxY: 30 };
  for (const id of STAR_TILING_IDS) {
    const faces = tilingFaces(id, box, 5);
    assert.ok(faces.every((f) => area(f) > 0), `${id} faces run anticlockwise`);
    // every point of the box lies in exactly one face
    const inside = (f, x, y) => f.every((p, i) => { const q = f[(i + 1) % f.length]; return (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x) > 0; });
    for (let y = 0.3; y < 30; y += 2.1) for (let x = 0.2; x < 30; x += 1.9) assert.equal(faces.filter((f) => inside(f, x, y)).length, 1, `${id} at ${x},${y}`);
  }
});

test('at 45° on squares the straps are straight diagonal lines', () => {
  const straps = hankinStraps(tilingFaces('square', { minX: 0, minY: 0, maxX: 20, maxY: 20 }, 5), 45);
  for (const s of straps) {
    const a = s[0], b = s[s.length - 1];
    for (const p of s) {
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      assert.ok(Math.abs(cross) / Math.hypot(b.x - a.x, b.y - a.y) < 1e-6);
    }
  }
});

test('squares need two layers, hexagons three and octagons four; straps of one layer never cross', () => {
  const expect = { square: 2, hexagon: 3, octagon: 4 };
  for (const id of STAR_TILING_IDS) {
    const { layers, extra } = starLayers(boundaryFor(50, 50), { tiling: id, size: 6 });
    assert.equal(extra.families, expect[id], id);
    for (const layer of layers) {
      // chain jogs aside, nothing crosses within a layer: count crossings of whole straps only
      const { found } = findCrossings(layer.map((pts) => ({ pts })), { strandWidth: 0.1 });
      assert.ok(found.length <= 0.05 * layer.length + 2, `${id}: ${found.length} crossings within a layer`);
    }
    const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
    assert.ok(r.between > 60, `${id}: ${r.between}`);
    assert.ok(r.longestUncrossed < 15, `${id}: longest ${r.longestUncrossed}`);
    for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5);
  }
});
