import test from 'node:test';
import assert from 'node:assert/strict';
import { tiles, parquetLayers, TILING_IDS } from '../src/engine/parquet.js';
import { boundaryFor, crossingReport } from '../src/engine/layers.js';

test('blocks and planks cover the floor exactly once', () => {
  const box = { minX: -13, minY: 7, maxX: 61, maxY: 49 };
  for (const [tiling, ratio] of [['basket', 2], ['herringbone', 2], ['herringbone', 3], ['herringbone', 4]]) {
    const ts = tiles(tiling, box, { block: 5, ratio });
    for (let y = box.minY + 0.13; y < box.maxY; y += 1.1) {
      for (let x = box.minX + 0.17; x < box.maxX; x += 1.3) {
        const n = ts.filter((t) => x > t.x && x < t.x + t.w && y > t.y && y < t.y + t.h).length;
        assert.equal(n, 1, `${tiling} ${ratio} at ${x},${y}`);
      }
    }
  }
});

test('neighbouring planks are turned a quarter turn', () => {
  const ts = tiles('herringbone', { minX: 0, minY: 0, maxX: 30, maxY: 30 }, { block: 5, ratio: 2 });
  assert.ok(ts.some((t) => t.along === 'x') && ts.some((t) => t.along === 'y'));
  for (const t of ts) assert.equal(t.along === 'x' ? t.w / t.h : t.h / t.w, 2);
});

test('every floor is a right-angle mesh that stays inside', () => {
  for (const tiling of TILING_IDS) {
    for (const turn of [0, 45]) {
      const { layers } = parquetLayers(boundaryFor(50, 50), { tiling, block: 8, spacing: 2, turn });
      const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2500);
      assert.ok(r.between > 300, `${tiling} ${turn}: ${r.between}`);
      assert.ok(r.minAngle > 85, `${tiling} ${turn}: angle ${r.minAngle}`);
      // a chevron turned 45° runs in steps, and a step along the edge can miss the other layer for a band or so
      assert.ok(r.longestUncrossed < (tiling === 'chevron' ? 16 : 8), `${tiling} ${turn}: longest ${r.longestUncrossed}`);
      for (const p of layers.flat(2)) assert.ok(p.x > -0.5 && p.x < 50.5 && p.y > -0.5 && p.y < 50.5);
    }
  }
});
