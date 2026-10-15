import test from 'node:test';
import assert from 'node:assert/strict';
import { repelGuideStrands, conformalGuideRegion } from '../src/engine/conformal.js';
import { boundaryFor } from '../src/engine/layers.js';
import { clipStrands, segmentInside, contactGraph } from '../src/engine/fabric.js';
import { resolveCrossings } from '../src/engine/crossings.js';

const ellipse = (x, y, rx, ry = rx) => Array.from({ length: 64 }, (_, k) => ({ x: x + rx * Math.cos(k * Math.PI / 32), y: y + ry * Math.sin(k * Math.PI / 32) }));
const strand = (id, pts) => ({ id, layer: 0, kind: 'base', pts: pts.map((p) => ({ z: 0.2, ...p })) });
const check = (strands, boundary) => {
  assert.ok(strands.length);
  for (const s of strands) for (let i = 1; i < s.pts.length; i++) assert.ok(segmentInside(s.pts[i - 1], s.pts[i], boundary), `${s.id} segment ${i} avoids the actual opening`);
};

test('green contours bend through-lines continuously whereas blue clipping only stops them', () => {
  const b = boundaryFor(60, 50), guides = [{ ring: ellipse(30, 25, 7), width: 0.45 }];
  const input = [strand('line', [{ x: 0, y: 25 }, { x: 60, y: 25 }])], region = conformalGuideRegion(b, guides);
  const blue = clipStrands(input, region, 0);
  assert.equal(blue.length, 2);
  const green = repelGuideStrands(input, guides, { boundary: b });
  assert.equal(green.length, 1, 'a green guide routes the line around its wall');
  assert.ok(green[0].pts.some((p) => Math.abs(p.y - 25) > 7));
  assert.deepEqual(green[0].pts[0], input[0].pts[0]);
  assert.deepEqual(green[0].pts.at(-1), input[0].pts.at(-1));
  check(green, region);
});

test('nearby waves bend while distant geometry stays fixed', () => {
  const b = boundaryFor(60, 50), guides = [{ ring: ellipse(30, 25, 7, 4), width: 0.45 }];
  const pts = Array.from({ length: 61 }, (_, i) => ({ x: i, y: 19 + Math.sin(i / 4), z: 0.2 }));
  const far = strand('far', [{ x: 0, y: 0 }, { x: 60, y: 0 }]);
  const result = repelGuideStrands([strand('wave', pts), far], guides, { boundary: b });
  assert.ok(result[0].pts.some((p) => p.x > 25 && p.x < 35 && 19 + Math.sin(p.x / 4) - p.y > 0.3));
  assert.deepEqual(result.find((s) => s.id.startsWith('far')).pts, far.pts);
  check(result, conformalGuideRegion(b, guides));
});

test('concave guide routing uses real contour edges and preserves a raised strand’s Z and flow transitions', () => {
  const ring = [{ x: 20, y: 15 }, { x: 40, y: 15 }, { x: 40, y: 22 }, { x: 28, y: 22 }, { x: 28, y: 38 }, { x: 20, y: 38 }];
  const guides = [{ ring, width: 0.9 }], b = boundaryFor(60, 50);
  const input = [strand('raised', [{ x: 0, y: 18, z: 0.2, flow: 0.5, cls: 'supported' }, { x: 30, y: 18, z: 4, flow: 1.5, cls: 'rising' }, { x: 60, y: 18, z: 0.2, flow: 0.5, cls: 'falling' }])];
  const result = repelGuideStrands(input, guides, { boundary: b });
  check(result, conformalGuideRegion(b, guides));
  assert.ok(result.flatMap((s) => s.pts).some((p) => Math.abs(p.z - 4) < 1e-6));
  assert.ok(result.flatMap((s) => s.pts).some((p) => p.flow === 1.5 && p.cls === 'rising'));
  assert.ok(result.flatMap((s) => s.pts).some((p) => p.flow === 0.5 && p.cls === 'falling'));
  assert.equal(conformalGuideRegion(b, guides).contains(35, 30), true, 'the concavity remains material');
});

test('grid repulsion remains bounded and can settle crossings without a mass of collapsed rim paths', () => {
  const b = boundaryFor(60, 50), guides = [{ ring: ellipse(30, 25, 7), width: 0.45 }];
  const input = [];
  for (let k = 2; k < 50; k += 3) input.push(strand(`h${k}`, [{ x: 0, y: k }, { x: 60, y: k }]));
  for (let k = 2; k < 60; k += 3) input.push({ ...strand(`v${k}`, [{ x: k, y: 0 }, { x: k, y: 50 }]), layer: 1 });
  const result = repelGuideStrands(input, guides, { boundary: b });
  assert.ok(result.reduce((n, s) => n + s.pts.length, 0) < 15000);
  const settled = resolveCrossings(result, { follow: true, lift: 0.2, strandWidth: 0.45 }).strands;
  check(settled, conformalGuideRegion(b, guides));
  assert.ok(contactGraph(settled).components < 4);
});

test('multiple overlapping guides leave their union empty after generic repulsion', () => {
  const b = boundaryFor(60, 50), guides = [{ ring: ellipse(25, 25, 8) }, { ring: ellipse(36, 25, 8) }];
  const input = [strand('through', [{ x: 0, y: 25 }, { x: 60, y: 25 }])];
  check(repelGuideStrands(input, guides, { boundary: b }), conformalGuideRegion(b, guides));
});

test('a motif wholly inside an opening moves intact rather than collapsing onto the border', () => {
  const b = boundaryFor(60, 50), guides = [{ ring: ellipse(30, 25, 7) }];
  const input = [strand('motif', [...ellipse(30, 25, 1, 1).slice(0, 64), { x: 31, y: 25 }])];
  const result = repelGuideStrands(input, guides, { boundary: b });
  check(result, conformalGuideRegion(b, guides));
  assert.equal(result.length, 1);
  const xs = result[0].pts.map((p) => p.x), ys = result[0].pts.map((p) => p.y);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 2) < 1e-6);
  assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 2) < 1e-6);
});

test('enclosed motifs at different depths do not collapse onto the same rim position', () => {
  const b = boundaryFor(60, 50), guides = [{ ring: ellipse(30, 25, 10) }];
  const input = [24, 27].map((x) => strand(`motif-${x}`, [...ellipse(x, 25, 0.75), { x: x + 0.75, y: 25 }]));
  const result = repelGuideStrands(input, guides, { boundary: b });
  check(result, conformalGuideRegion(b, guides));
  assert.equal(result.length, 2);
  assert.ok(Math.hypot(result[0].pts[0].x - result[1].pts[0].x, result[0].pts[0].y - result[1].pts[0].y) > 0.5);
});

test('a wide opening leaves no void: the pattern comes up to its wall, and far pattern stays where it is', () => {
  const b = boundaryFor(100, 100), ring = ellipse(50, 50, 12), guides = [{ ring, width: 1.4 }];
  const input = [];
  for (let k = 1.5; k < 100; k += 3) input.push(strand(`h${k}`, [{ x: 0, y: k }, { x: 100, y: k }]));
  for (let k = 1.5; k < 100; k += 3) input.push({ ...strand(`v${k}`, [{ x: k, y: 0 }, { x: k, y: 100 }]), layer: 1 });
  const out = repelGuideStrands(input, guides, { boundary: b });
  const away = (p) => {
    let m = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], dx = c.x - a.x, dy = c.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      m = Math.min(m, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
    return m;
  };
  const pts = out.flatMap((s) => s.pts);
  check(out, conformalGuideRegion(b, guides));
  // the old push was a third of the opening: nothing came within a millimetre and a third of the wall
  assert.ok(Math.min(...pts.map(away)) < 0.8, 'lines end at the wall');
  assert.ok(pts.filter((p) => away(p) < 1.5).length > 60, 'a band of pattern lies against the wall, so it is bonded to it');
  // where nothing is bent, the lines are exactly the lines that were given
  const onGrid = (v) => Math.abs(((v - 1.5) % 3 + 3) % 3) < 1e-6 || Math.abs(((v - 1.5) % 3 + 3) % 3 - 3) < 1e-6;
  for (const p of pts.filter((q) => away(q) > 20)) assert.ok(onGrid(p.x) || onGrid(p.y), `${p.x}, ${p.y} is still on its line`);
});

test('only as many lines are routed round an opening as its band holds; the deeper ones end at the wall', () => {
  const b = boundaryFor(100, 100), guides = [{ ring: ellipse(50, 50, 20), width: 1.4 }];
  const input = [];
  for (let k = 31.5; k < 70; k += 1.5) input.push(strand(`h${k}`, [{ x: 0, y: k }, { x: 100, y: k }]));
  const out = repelGuideStrands(input, guides, { boundary: b });
  // 26 lines cross the opening. The ones routed round it are whole lines; the rest are cut in two by it.
  const whole = out.filter((s) => s.pts[0].x === 0 && s.pts.at(-1).x === 100).length;
  const cut = out.filter((s) => !(s.pts[0].x === 0 && s.pts.at(-1).x === 100)).length;
  assert.ok(whole >= 4 && whole <= 16, `${whole} routed round`);
  assert.ok(cut >= 12, `${cut} ends at the wall`);
  check(out, conformalGuideRegion(b, guides));
});
