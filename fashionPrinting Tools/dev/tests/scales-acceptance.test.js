import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleTiles } from '../../site/src/engine/scales.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

// T3.4 acceptance: the gap between neighbouring tiles is at least 0.4 mm (the minimum distance between tile outlines), every tile lies
// fully on the carrier, and the Z envelope is (carrierLayers + scaleLayers) x layer height.

const { machine, material } = defaultProfiles();

function segmentDistance(a, b, c, d) {
  const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return 0; // proper crossing
  const toSegment = (p, s, e) => {
    const dx = e.x - s.x, dy = e.y - s.y, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / len2)) : 0;
    return Math.hypot(p.x - (s.x + t * dx), p.y - (s.y + t * dy));
  };
  return Math.min(toSegment(a, c, d), toSegment(b, c, d), toSegment(c, a, b), toSegment(d, a, b));
}
const edges = (ring) => ring.map((p, i) => [p, ring[(i + 1) % ring.length]]);
const bounds = (ring) => ({ minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)), minY: Math.min(...ring.map((p) => p.y)), maxY: Math.max(...ring.map((p) => p.y)) });

/** The smallest distance between any two different tile outlines, and which pair it is. */
function smallestGap(tiles) {
  const boxes = tiles.map(bounds), edgeLists = tiles.map(edges);
  let best = Infinity, pair = null;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.minX > b.maxX + 3 || b.minX > a.maxX + 3 || a.minY > b.maxY + 3 || b.minY > a.maxY + 3) continue; // far apart
    for (const [p, q] of edgeLists[i]) for (const [r, s] of edgeLists[j]) {
      const d = segmentDistance(p, q, r, s);
      if (d < best) { best = d; pair = [i, j]; }
    }
  }
  return { best, pair };
}

const SIZES = [[100, 100], [60, 45]];
const SHAPES = ['hex', 'square', 'triangle'];

test('the gap between neighbouring tiles is at least the gap setting, for every tile shape, pitch and gap', () => {
  for (const [w, h] of SIZES) for (const tile of SHAPES) for (const pitch of [4, 8, 13, 20]) for (const gap of [0.4, 0.8, 2]) {
    const tiles = scaleTiles(boundaryFor(w, h), { tile, pitch, gap });
    if (tiles.length < 2) continue;
    const { best, pair } = smallestGap(tiles);
    assert.ok(best >= gap - 1e-6, `${tile}, pitch ${pitch}, gap ${gap} on ${w} x ${h}: tiles ${pair} are ${best.toFixed(3)} mm apart`);
    assert.ok(best <= gap + 1e-6, `${tile}, pitch ${pitch}, gap ${gap}: neighbours stand ${best.toFixed(3)} mm apart, so the tiling is not tight`);
  }
});

test('every tile lies fully on the carrier', () => {
  for (const [w, h] of SIZES) for (const tile of SHAPES) {
    const boundary = boundaryFor(w, h);
    const tiles = scaleTiles(boundary, { tile, pitch: 8, gap: 0.4 });
    assert.ok(tiles.length > 3, `${tile}: ${tiles.length} tiles`);
    for (const ring of tiles) for (const p of ring) assert.ok(boundary.contains(p.x, p.y), `${tile}: a tile corner at ${p.x.toFixed(2)}, ${p.y.toFixed(2)} is off the carrier`);
  }
});

test('the Z envelope is (carrier layers + tile layers) x layer height', () => {
  const card = designById('scales');
  for (const patch of [{}, { carrierLayers: 2, scaleLayers: 4, width: 40, height: 40 }, { carrierLayers: 3, scaleLayers: 3, tile: 'triangle', width: 40, height: 40 }, { carrier: 'net', carrierLayers: 2, scaleLayers: 2, tile: 'square', width: 40, height: 40 }]) {
    const s = card.sanitize({ ...card.defaults(), ...patch });
    const result = card.generate(machine, material, s, {});
    const expected = (s.carrierLayers + s.scaleLayers) * result.cfg.t.layer_height;
    assert.ok(Math.abs(result.construction.z.max - expected) <= 0.05, `${JSON.stringify(patch)}: Z max ${result.construction.z.max} mm, expected ${expected.toFixed(2)}`);
  }
});
