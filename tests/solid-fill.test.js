import test from 'node:test';
import assert from 'node:assert/strict';
import { solidKind, coilPath, zigzagPaths, solidLayer, longAxis, SOLID_OVERLAP } from '../src/engine/solid-fill.js';

const circle = (cx, cy, r, n = 160) => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) }));
const ellipse = (cx, cy, a, b, n = 160) => Array.from({ length: n }, (_, i) => ({ x: cx + a * Math.cos((2 * Math.PI * i) / n), y: cy + b * Math.sin((2 * Math.PI * i) / n) }));
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const star = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 6 : 14, a = (Math.PI * i) / 5 + Math.PI / 2; return { x: 20 + r * Math.cos(a), y: 20 + r * Math.sin(a) }; });
const bead = 0.45, pitch = bead * (1 - SOLID_OVERLAP);

function inside(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const segDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-12, dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const edgeDistance = (p, ring) => Math.min(...ring.map((a, i) => segDistance(p, a, ring[(i + 1) % ring.length])));

/** The share of points inside the shape, a strand width or more from its edge, that no printed bead covers. */
function uncovered(ring, paths, step = 0.17) {
  const segs = paths.flatMap((pts) => pts.slice(1).map((q, i) => [pts[i], q]));
  const xs = ring.map((p) => p.x), ys = ring.map((p) => p.y);
  let total = 0, bare = 0;
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
      const p = { x, y };
      if (!inside(x, y, ring) || edgeDistance(p, ring) < bead) continue;
      total++;
      if (!segs.some(([a, b]) => segDistance(p, a, b) <= bead / 2 + 0.02)) bare++;
    }
  }
  return bare / total;
}

test('round shapes coil, others zigzag', () => {
  assert.equal(solidKind(circle(0, 0, 10)), 'coil');
  assert.equal(solidKind(ellipse(0, 0, 12, 9)), 'coil');
  assert.equal(solidKind(rect(0, 0, 20, 10)), 'zigzag');
  assert.equal(solidKind(rect(0, 0, 10, 10)), 'zigzag');
  assert.equal(solidKind(star), 'zigzag');
  assert.equal(solidKind(ellipse(0, 0, 20, 8)), 'zigzag', 'a long ellipse is not round enough to coil well');
});

test('a coil is one strand from just inside the edge to the middle, its turns a pitch (80% of a strand) apart', () => {
  const ring = circle(20, 20, 8);
  const path = coilPath(ring, { bead });
  for (let i = 1; i < path.length - 2; i++) assert.ok(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) < 0.6, `a jump at ${i}`);
  const r = (p) => Math.hypot(p.x - 20, p.y - 20);
  assert.ok(Math.abs(r(path[0]) - (8 - bead / 2)) < 1e-6, 'starts half a strand inside the edge');
  assert.ok(path.every((p) => r(p) <= 8 - bead / 2 + 1e-6), 'never outside that');
  // each time round, the strand is one pitch further in (after a first turn that hugs the edge)
  const crossings = [];
  let turned = 0;
  for (let i = 1; i < path.length - 2; i++) {
    let d = Math.atan2(path[i].y - 20, path[i].x - 20) - Math.atan2(path[i - 1].y - 20, path[i - 1].x - 20);
    if (d < -Math.PI) d += 2 * Math.PI;
    if (d > Math.PI) d -= 2 * Math.PI;
    const before = Math.floor(turned / (2 * Math.PI) + 1e-9);
    turned += d;
    if (Math.floor(turned / (2 * Math.PI) + 1e-9) > before) crossings.push(r(path[i]));
  }
  assert.ok(crossings.length > 10);
  assert.ok(Math.abs(crossings[0] - (8 - bead / 2)) < 0.01, 'the first turn hugs the edge');
  // (and a last turn that closes round the middle)
  for (let k = 1; k < crossings.length - 1; k++) assert.ok(Math.abs(crossings[k - 1] - crossings[k] - pitch) < 0.02, `turn ${k}: ${(crossings[k - 1] - crossings[k]).toFixed(3)} mm in`);
  assert.ok(uncovered(ring, [path]) < 0.002, 'nothing left bare');
});

test('an ellipse coils too, leaving nothing bare in its middle', () => {
  const ring = ellipse(20, 20, 12, 9);
  assert.ok(uncovered(ring, solidLayer(ring, { bead })) < 0.003);
});

test('a zigzag is an edge pass and lines along the long side a pitch apart; the second layer turns a quarter turn', () => {
  const ring = rect(0, 0, 30, 12);
  assert.equal(longAxis(ring), 0);
  const first = zigzagPaths(ring, { bead });
  assert.equal(first.length, 1, 'the edge pass runs on into the zigzag: one strand');
  const second = solidLayer(ring, { bead, layer: 1 });
  const runs = (paths) => paths.flatMap((pts) => pts.slice(1).map((q, i) => [pts[i], q])).filter(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y) > 5);
  const firstRuns = runs(first).filter(([a, b]) => Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.y) > bead && Math.abs(a.y - 12) > bead);
  assert.ok(firstRuns.length > 20, 'lines along the 30 mm side');
  const ys = [...new Set(firstRuns.map(([a]) => Math.round(a.y * 1000) / 1000))].sort((p, q) => p - q);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] <= pitch + 1e-6, `lines ${ys[i] - ys[i - 1]} mm apart`);
  assert.ok(runs(second).some(([a, b]) => Math.abs(a.x - b.x) < 1e-6), 'the second layer runs across');
  for (const paths of [first, second]) {
    assert.ok(paths.flat().every((p) => p.x >= bead / 2 - 1e-6 && p.x <= 30 - bead / 2 + 1e-6 && p.y >= bead / 2 - 1e-6 && p.y <= 12 - bead / 2 + 1e-6), 'inside, half a strand in');
    assert.ok(uncovered(ring, paths) < 0.002);
  }
});

test('a turned rectangle zigzags along its own long side, and a star is filled in every point', () => {
  const a = 0.5, base = rect(-10, -3, 20, 6);
  const turned = base.map((p) => ({ x: 30 + p.x * Math.cos(a) - p.y * Math.sin(a), y: 30 + p.x * Math.sin(a) + p.y * Math.cos(a) }));
  assert.ok(Math.abs(longAxis(turned) - a) < 1e-6);
  assert.ok(uncovered(turned, solidLayer(turned, { bead })) < 0.002);
  assert.ok(uncovered(turned, solidLayer(turned, { bead, layer: 1 })) < 0.002);
  assert.ok(uncovered(star, solidLayer(star, { bead })) < 0.01);
});

test('perforated solid fill follows each branch continuously around curved windows', () => {
  const ring = rect(0, 0, 60, 30);
  const centres = [{ x: 15, y: 15 }, { x: 30, y: 15 }, { x: 45, y: 15 }];
  const holes = centres.map((c) => circle(c.x, c.y, 4));
  for (const layer of [0, 1]) {
    const paths = solidLayer(ring, { bead, holes, layer });
    assert.ok(paths.length < 30, `${paths.length} separate strokes for three windows on layer ${layer}`);
    for (const pts of paths) for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      for (const p of [a, b]) assert.ok(p.x >= bead / 2 - 1e-6 && p.x <= 60 - bead / 2 + 1e-6 && p.y >= bead / 2 - 1e-6 && p.y <= 30 - bead / 2 + 1e-6, 'a bead stays inside the outside edge');
      for (const c of centres) assert.ok(segDistance(c, a, b) >= 4 + bead / 2 - 0.005, 'a connection keeps a bead clear of a curved window');
    }
    // Interior points two bead widths away from the rims must still be covered: short fill pieces cannot simply be dropped.
    const segments = paths.flatMap((pts) => pts.slice(1).map((b, i) => [pts[i], b]));
    for (let y = 1; y < 29; y += 0.7) for (let x = 1; x < 59; x += 0.7) {
      if (centres.some((c) => Math.hypot(x - c.x, y - c.y) < 4 + 2 * bead)) continue;
      assert.ok(segments.some(([a, b]) => segDistance({ x, y }, a, b) <= bead / 2 + 0.02), `bare solid at ${x}, ${y} on layer ${layer}`);
    }
  }
});

test('solid fill preserves narrow windows when connecting adjacent rows', () => {
  const ring = rect(0, 0, 30, 18), hole = rect(14, 2, 0.15, 14);
  const paths = solidLayer(ring, { bead, holes: [hole] });
  for (const pts of paths) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    // Intersect with the open slot analytically along X; midpoint sampling can miss a 0.15 mm opening.
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-12) {
      assert.ok(!(a.x > 14 && a.x < 14.15 && Math.max(a.y, b.y) > 2 && Math.min(a.y, b.y) < 16));
    } else {
      const lo = Math.max(0, Math.min((14 - a.x) / dx, (14.15 - a.x) / dx));
      const hi = Math.min(1, Math.max((14 - a.x) / dx, (14.15 - a.x) / dx));
      if (hi > lo + 1e-9) {
        const ys = [lo, hi].map((t) => a.y + t * (b.y - a.y));
        assert.ok(!(Math.max(...ys) > 2 && Math.min(...ys) < 16), 'no extrusion cuts across the narrow slot');
      }
    }
  }
});
