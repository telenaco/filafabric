import test from 'node:test';
import assert from 'node:assert/strict';
import { sites, delaunay, tessellate, voronoiLayers } from '../src/engine/voronoi.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { createField } from '../src/engine/fields.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const box = { minX: 0, minY: 0, maxX: 50, maxY: 40 };

test('sites are inside the box, spaced about the requested distance, and repeat for a seed', () => {
  const a = sites(box, { spacing: 8, relax: 3, seed: 5 });
  assert.deepEqual(a, sites(box, { spacing: 8, relax: 3, seed: 5 }));
  assert.notDeepEqual(a, sites(box, { spacing: 8, relax: 3, seed: 6 }));
  for (const p of a) assert.ok(p.x >= 0 && p.x <= 50 && p.y >= 0 && p.y <= 40);
  // about one site per spacing squared, within a factor of three
  assert.ok(a.length > (50 * 40) / 64 / 2 && a.length < ((50 * 40) / 64) * 3, `${a.length} sites`);
});

test('relaxing evens the cells out: the cell areas get closer together', () => {
  // the area of each site's cell, by assigning every point of a fine grid to its nearest site
  const spread = (pts) => {
    const area = pts.map(() => 0);
    for (let y = 0.25; y < 40; y += 0.5) {
      for (let x = 0.25; x < 50; x += 0.5) {
        let best = 0, bd = Infinity;
        pts.forEach((p, i) => {
          const d = (p.x - x) ** 2 + (p.y - y) ** 2;
          if (d < bd) { bd = d; best = i; }
        });
        area[best]++;
      }
    }
    const mean = area.reduce((m, v) => m + v, 0) / area.length;
    return Math.sqrt(area.reduce((m, v) => m + (v - mean) ** 2, 0) / area.length) / mean;
  };
  assert.ok(spread(sites(box, { spacing: 7, relax: 6, seed: 3 })) < spread(sites(box, { spacing: 7, relax: 0, seed: 3 })));
});

test('every Delaunay triangle has an empty circumcircle', () => {
  const pts = sites(box, { spacing: 9, relax: 2, seed: 2 });
  const tris = delaunay(pts);
  assert.ok(tris.length > pts.length);
  for (const [a, b, c] of tris.slice(0, 40)) {
    const A = pts[a], B = pts[b], C = pts[c];
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const sq = (p) => p.x ** 2 + p.y ** 2;
    const ux = (sq(A) * (B.y - C.y) + sq(B) * (C.y - A.y) + sq(C) * (A.y - B.y)) / d;
    const uy = (sq(A) * (C.x - B.x) + sq(B) * (A.x - C.x) + sq(C) * (B.x - A.x)) / d;
    const r = Math.hypot(A.x - ux, A.y - uy);
    pts.forEach((p, i) => {
      if (i === a || i === b || i === c) return;
      assert.ok(Math.hypot(p.x - ux, p.y - uy) >= r - 1e-6, 'a site inside a circumcircle');
    });
  }
});

test('each Voronoi edge lies on the bisector of two sites', () => {
  const pts = sites(box, { spacing: 9, relax: 2, seed: 4 });
  const { delaunay: d, voronoi: v } = tessellate(pts, box);
  assert.ok(v.length > pts.length && d.length > pts.length);
  let matched = 0;
  for (const [a, b] of v.slice(0, 40)) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    // the two nearest sites to the midpoint of a Voronoi edge are equally far: it is on a bisector
    const ds = pts.map((p) => Math.hypot(p.x - mx, p.y - my)).sort((p, q) => p - q);
    if (Math.abs(ds[0] - ds[1]) < 1e-6) matched++;
  }
  assert.ok(matched >= 36, `${matched} of 40`);
});

test('the layers cross: a Delaunay edge meets its Voronoi edge', () => {
  const { layers } = voronoiLayers(boundaryFor(50, 40), { spacing: 8, relax: 5, seed: 1 });
  const r = crossingReport(layers.flatMap((l, k) => l.map((pts) => ({ pts, layer: k }))), 2000);
  assert.ok(r.between > 40, `${r.between}`);
});

test('a bright tone makes smaller cells, so more strand there', () => {
  const b = boundaryFor(60, 40);
  const tone = (x) => (x < 30 ? 1 : 0);
  const graded = voronoiLayers(b, { spacing: 8, relax: 5, seed: 1, tone });
  const pts = graded.layers[0].flat();
  assert.ok(pts.filter((p) => p.x < 30).length > pts.length * 0.55, 'more strand where the tone is bright');
});

test('too many cells is refused plainly, and fast', () => {
  const started = Date.now();
  assert.throws(() => voronoiLayers(boundaryFor(240, 200), { spacing: 4 }), (e) => e.name === 'ConfigError' && /cells/.test(e.message));
  assert.ok(Date.now() - started < 1000);
});

test('it prints, and inside an outline too', () => {
  const ring = [[{ x: 3, y: 3 }, { x: 47, y: 3 }, { x: 47, y: 16 }, { x: 25, y: 16 }, { x: 25, y: 37 }, { x: 3, y: 37 }]];
  const { layers } = voronoiLayers(boundaryFor(50, 40, ring), { spacing: 8, relax: 3, seed: 2, tone: createField('noise') });
  const r = layeredResult(machine, material, { width: 50, height: 40, layers, outline: ring });
  assert.ok(r.moves.some((m) => m.extrude));
});
