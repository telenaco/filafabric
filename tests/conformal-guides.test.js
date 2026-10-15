import test from 'node:test';
import assert from 'node:assert/strict';
import { conformalLayers } from '../src/engine/conformal.js';
import { guidePotential, conformalGuideRegion } from '../src/engine/conformal-guides.js';
import { boundaryFor, crossingReport, layeredResult } from '../src/engine/layers.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { segmentInside } from '../src/engine/fabric.js';
import { defaultProfiles } from './helpers.js';

const ellipse = (x, y, rx, ry = rx, n = 64) => Array.from({ length: n }, (_, k) => ({ x: x + rx * Math.cos(k * 2 * Math.PI / n), y: y + ry * Math.sin(k * 2 * Math.PI / n) }));
const guide = (ring, width = 0.45) => ({ ring, width, index: 0 });
const concave = [{ x: 19, y: 15 }, { x: 39, y: 15 }, { x: 39, y: 22 }, { x: 27, y: 22 }, { x: 27, y: 37 }, { x: 19, y: 37 }];
const checkRegion = (built, w, h) => {
  const region = new PolygonBoundary(built.outline);
  assert.ok(built.layers.every((family) => family.length));
  for (const line of built.layers.flat()) for (let i = 1; i < line.length; i++) {
    assert.ok(segmentInside(line[i - 1], line[i], region), 'every complete segment stays outside the supplied opening');
    assert.ok(line[i].x >= -1e-6 && line[i].x <= w + 1e-6 && line[i].y >= -1e-6 && line[i].y <= h + 1e-6);
  }
  return region;
};

test('guides replace built-in holes, preserve their actual location and leave the unguided maps unchanged', () => {
  const b = boundaryFor(60, 50);
  assert.deepEqual(conformalLayers(b, { map: 'twin', guides: [] }), conformalLayers(b, { map: 'twin' }));
  const ring = ellipse(16, 18, 5);
  const built = conformalLayers(b, { guides: [guide(ring)], guideHems: false });
  const region = checkRegion(built, 60, 50);
  assert.equal(built.extra.guideCount, 1);
  assert.equal(built.outline.length, 2);
  assert.deepEqual(built.outline[1], ring);
  assert.equal(region.contains(16, 18), false);
  assert.equal(region.contains(30, 25), true, 'the old central default hole is absent');
});

test('noncircular and concave openings retain the contour rather than a bounding circle', () => {
  for (const ring of [ellipse(30, 25, 12, 4), concave]) {
    const built = conformalLayers(boundaryFor(60, 50), { spacing: 3, guides: [guide(ring)], guideHems: false });
    const region = checkRegion(built, 60, 50);
    assert.deepEqual(built.outline[1], ring);
    assert.equal(region.contains(32, 30), true, 'material beside the narrow or concave part is retained');
  }
});

test('circle potential is exact and arbitrary contour potentials remain analytic outside their poles', () => {
  const exact = guidePotential([guide(ellipse(20, 23, 6))]);
  for (const p of ellipse(20, 23, 6)) assert.ok(Math.abs(exact.at(p.x, p.y)[1] - 23) < 1e-7);
  for (const ring of [ellipse(30, 25, 12, 4), concave]) {
    const potential = guidePotential([guide(ring)]);
    assert.ok(potential.fitError < 1.5, `boundary fitting error ${potential.fitError} mm`);
    for (const [x, y] of [[8, 9], [50, 39], [45, 12]]) {
      const e = 1e-4, xp = potential.at(x + e, y), xm = potential.at(x - e, y), yp = potential.at(x, y + e), ym = potential.at(x, y - e);
      const ux = (xp[0] - xm[0]) / (2 * e), vx = (xp[1] - xm[1]) / (2 * e);
      const uy = (yp[0] - ym[0]) / (2 * e), vy = (yp[1] - ym[1]) / (2 * e);
      assert.ok(Math.abs(ux - vy) < 1e-5 && Math.abs(uy + vx) < 1e-5, 'Cauchy–Riemann equations');
    }
  }
});

test('multiple contours produce crossing families and already-excluded guides are not added twice', () => {
  const rings = [ellipse(17, 23, 5), ellipse(43, 27, 7, 4)];
  const guides = rings.map((ring) => guide(ring));
  const b = new PolygonBoundary([...boundaryFor(60, 50).rings, ...rings]);
  const built = conformalLayers(b, { guides, guideHems: false });
  checkRegion(built, 60, 50);
  assert.equal(built.outline.length, 3);
  const report = crossingReport(built.layers.flatMap((family, layer) => family.map((pts) => ({ pts, layer }))), 3000);
  assert.ok(report.between > 100);
  assert.ok(report.minAngle > 75, `minimum crossing angle ${report.minAngle}`);
});

test('distant guides affect the field without expanding the preview or its clipping rings', () => {
  const built = conformalLayers(boundaryFor(50, 40), { guides: [guide(ellipse(80, 20, 15))], guideHems: false });
  checkRegion(built, 50, 40);
  assert.equal(built.outline.length, 1);
  assert.deepEqual(new PolygonBoundary(built.outline).bbox(), boundaryFor(50, 40).bbox());
  const potential = guidePotential([guide(ellipse(80, 20, 15))]);
  assert.ok(Math.abs(potential.at(40, 20)[0] - 40) > 1);
});

test('guided geometry remains a coherent printable result without crossing the opening', () => {
  const { machine, material } = defaultProfiles();
  const built = conformalLayers(boundaryFor(50, 50), { guides: [guide(ellipse(24, 25, 7, 4))], guideHems: false });
  const result = layeredResult(machine, material, { width: 50, height: 50, ...built });
  assert.ok(result.moves.some((m) => m.extrude));
  assert.equal(result.fabric.outsideSegments, 0);
  assert.equal(result.fabric.components, 1);
});

test('guide hems follow actual contours and wider strokes add wall passes', () => {
  const b = boundaryFor(50, 50), ring = ellipse(25, 25, 7, 4);
  const plain = conformalLayers(b, { guides: [guide(ring, 1.35)], guideHems: false });
  const hemmed = conformalLayers(b, { guides: [guide(ring, 1.35)], guideHems: true, strandWidth: 0.45 });
  assert.equal(hemmed.layers[0].length - plain.layers[0].length, 3);
});

test('a guide covering the whole preview removes material instead of being deduplicated against the exterior', () => {
  const guides = [guide(ellipse(25, 25, 100))];
  const region = conformalGuideRegion(boundaryFor(50, 50), guides);
  assert.equal(region.contains(25, 25), false);
  assert.throws(() => conformalLayers(boundaryFor(50, 50), { guides }), /openings fill/i);
});

test('overlapping and nested green openings are subtracted as a union', () => {
  const b = boundaryFor(60, 50);
  const guides = [guide(ellipse(24, 25, 10)), guide(ellipse(36, 25, 10)), guide(ellipse(24, 25, 3))];
  const region = conformalGuideRegion(b, guides);
  assert.equal(region.contains(30, 25), false, 'overlap does not become material');
  assert.equal(region.contains(24, 25), false, 'nested contour does not restore material');
  assert.equal(region.contains(5, 5), true);
  const built = conformalLayers(b, { guides, guideHems: false });
  checkRegion(built, 60, 50);
});

test('a guide overlapping an existing garment hole does not restore either opening', () => {
  const hole = ellipse(25, 25, 8), g = guide(ellipse(35, 25, 8));
  const boundary = new PolygonBoundary([...boundaryFor(60, 50).rings, hole]);
  const region = conformalGuideRegion(boundary, [g]);
  assert.equal(region.contains(30, 25), false);
  assert.equal(region.contains(25, 25), false);
  assert.equal(region.contains(35, 25), false);
});

test('a guide matching a second garment island removes that island rather than treating it as an existing hole', () => {
  const first = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
  const second = [{ x: 30, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 20 }, { x: 30, y: 20 }];
  const region = conformalGuideRegion(new PolygonBoundary([first, second]), [guide(second)]);
  assert.equal(region.contains(10, 10), true);
  assert.equal(region.contains(40, 10), false);
});

test('invalid spacing and excessive sampling are rejected before grid allocation', () => {
  const g = [guide(ellipse(25, 25, 5))];
  for (const spacing of [0, -1, NaN, Infinity]) assert.throws(() => conformalLayers(boundaryFor(50, 50), { guides: g, spacing }), /spacing/i);
  assert.throws(() => conformalLayers(boundaryFor(1000, 1000), { guides: g, spacing: 0.5 }), /large|grid|smaller/i);
});
