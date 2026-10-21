import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDesignExport } from '../src/engine/design-export.js';
import { waveLines } from '../src/engine/wavegrid.js';
import { boundaryFor } from '../src/engine/layers.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

// A wavy pattern is cut by every edge the same way, as fabric cut from a larger piece: the lanes lie half a spacing in
// from the top and bottom, so the edge there cuts the waves as the sides do, instead of the outermost lines staying a
// full swing in and leaving a row of open notches deeper than the cells inside.

const { machine, material } = defaultProfiles();

/** Every point along the lines, at most `step` mm apart. */
function sample(lines, step = 0.2) {
  const out = [];
  for (const pts of lines) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Along each edge, the furthest any point of it is from the pattern: the largest opening the edge leaves (corners left out). */
function edgeOpenings(points, W, H) {
  const near = (q) => {
    let d = 9;
    for (const p of points) if (Math.abs(p.x - q.x) < 6 && Math.abs(p.y - q.y) < 6) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
    return d;
  };
  const along = (at, length) => { let m = 0; for (let s = 3; s <= length - 3; s += 0.1) m = Math.max(m, near(at(s))); return m; };
  return {
    bottom: along((s) => ({ x: s, y: 0 }), W), top: along((s) => ({ x: s, y: H }), W),
    left: along((s) => ({ x: 0, y: s }), H), right: along((s) => ({ x: W, y: s }), H),
  };
}

function sameOnEverySide(openings, what) {
  const values = Object.values(openings);
  assert.ok(Math.max(...values) - Math.min(...values) < 0.05, `${what}: ${Object.entries(openings).map(([k, v]) => `${k} ${v.toFixed(2)} mm`).join(', ')}`);
  assert.ok(Math.max(...values) < 1.2, `${what}: no opening along an edge wider than the cells inside`);
}

test('the zigzag mesh meets the top and bottom edges as it meets the sides', () => {
  const r = generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: 100, height: 50, extraLayers: 0, brim: 0 });
  sameOnEverySide(edgeOpenings(sample(r.strands.map((s) => s.pts)), 100, 50), 'zigzag mesh');
});

test('the backing mesh meets every edge the same way too', () => {
  const r = generateDesignExport({ machine, material, design: 'coil', settings: designById('coil').defaults(), width: 80, height: 60, extraLayers: 0, brim: 0, backing: {} });
  sameOnEverySide(edgeOpenings(sample(r.strands.filter((s) => s.backingMesh).map((s) => s.pts)), 80, 60), 'backing mesh');
});

test('the lanes lie half a spacing in from the top and bottom, so a piece above or below carries the pattern on', () => {
  const W = 100, H = 50, spacing = 3, amplitude = 1;
  const ys = waveLines(boundaryFor(W, H), { spacing, amplitude, wavelength: 6, shape: 'triangle' }).flat().map((p) => p.y);
  const half = H / Math.round(H / spacing) / 2;
  assert.ok(Math.abs(Math.min(...ys) - (half - amplitude)) < 1e-6, `lowest ${Math.min(...ys).toFixed(3)} mm`);
  assert.ok(Math.abs(H - Math.max(...ys) - (half - amplitude)) < 1e-6, `highest ${Math.max(...ys).toFixed(3)} mm`);
});
