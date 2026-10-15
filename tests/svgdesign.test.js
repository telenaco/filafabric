import test from 'node:test';
import assert from 'node:assert/strict';
import { svgDesignLayers, splitPaths, sampleVector } from '../src/engine/svgdesign.js';
import { boundaryFor } from '../src/engine/layers.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { INFILL_IDS } from '../src/engine/infill.js';
import { DESIGNS, designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const card = designById('svgdesign');
const base = () => ({ ...card.defaults(), width: 100, height: 100 });
const square = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
const flatten = (lines) => lines.flatMap((pts) => pts);

test('the SVG design card is registered, works from the drawing and shows at its real size', () => {
  assert.ok(card, 'registered');
  assert.equal(card.status, 'ready');
  assert.equal(card.usesVector, true);
  assert.equal(card.fullSize, true);
  assert.equal(card.panel, true, 'the drawing can be exported at full garment size');
  assert.ok(DESIGNS.indexOf(card) > DESIGNS.findIndex((d) => d.id === 'fringe'));
});

test('paths are scaled to the swatch and told apart as closed shapes and open lines', () => {
  const sample = sampleVector();
  const { closed, open } = splitPaths(sample, 200, 100);
  assert.equal(closed.length, 2); // the heart and the ring
  assert.equal(open.length, 1); // the stem
  const xs = closed[0].map((p) => p.x);
  assert.ok(Math.max(...xs) > 150 && Math.max(...xs) < 200, 'x doubles with the width');
  const tiny = splitPaths({ width: 10, height: 10, paths: [square(1, 1, 0.1, 0.1), [{ x: 0, y: 0 }, { x: 5, y: 5 }]] }, 10, 10);
  assert.equal(tiny.closed.length, 0, 'a speck is not a shape');
  assert.equal(tiny.open.length, 2);
});

test('the design layer and each backing layer are separate layers', () => {
  const b = boundaryFor(100, 100);
  assert.equal(svgDesignLayers(b, { ...base(), backing: 'none' }).layers.length, 1);
  assert.equal(svgDesignLayers(b, { ...base(), backing: 'one' }).layers.length, 2);
  assert.equal(svgDesignLayers(b, { ...base(), backing: 'two' }).layers.length, 3);
});

test('fill stays inside the shapes and leaves the ring open', () => {
  const b = boundaryFor(100, 100);
  const { layers } = svgDesignLayers(b, { ...base(), mode: 'fill', designPattern: 'rectilinear', backing: 'none' });
  const { closed } = splitPaths(sampleVector(), 100, 100);
  const shape = new PolygonBoundary(closed);
  const fillPoints = flatten(layers[0]);
  assert.ok(fillPoints.length > 200);
  const stray = fillPoints.filter((p) => !shape.contains(p.x, p.y) && Math.hypot(p.x - 50, p.y - 50) > 0 && !(Math.abs(p.x - 50) < 0.6 && p.y > 10 && p.y < 48));
  assert.ok(stray.length / fillPoints.length < 0.02, `${stray.length} of ${fillPoints.length} points outside the shapes`);
  const inRing = fillPoints.filter((p) => Math.hypot(p.x - 50, p.y - 58) < 9 && !(Math.abs(p.x - 50) < 0.6));
  assert.equal(inRing.length, 0, 'nothing is printed in the hole');
});

test('lines mode prints every path as drawn and nothing else', () => {
  const { layers } = svgDesignLayers(boundaryFor(100, 100), { ...base(), mode: 'outline', backing: 'none' });
  assert.equal(layers[0].length, 3);
});

test('both prints the outline and the fill', () => {
  const b = boundaryFor(100, 100);
  const outline = svgDesignLayers(b, { ...base(), mode: 'outline', backing: 'none' }).layers[0].length;
  const both = svgDesignLayers(b, { ...base(), mode: 'both', backing: 'none' }).layers[0].length;
  assert.ok(both > outline);
});

test('backing can cover the swatch, the shapes or the drawing\'s box', () => {
  const b = boundaryFor(100, 100);
  const extent = (area) => {
    const pts = flatten(svgDesignLayers(b, { ...base(), backing: 'one', backingArea: area, backing1Pattern: 'rectilinear', backing1Spacing: 3 }).layers[1]);
    return { minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)), n: pts.length };
  };
  const swatch = extent('swatch'), box = extent('box'), shape = extent('shape');
  assert.ok(swatch.minX < 4 && swatch.maxX > 96, 'out to the edge');
  assert.ok(box.minX > 3 && box.maxX < 97, 'inside the drawing\'s box');
  assert.ok(shape.n < box.n && box.n < swatch.n, 'less line the smaller the area');
});

test('every infill pattern works as a design fill and as a backing', () => {
  const b = boundaryFor(60, 60);
  for (const id of INFILL_IDS) {
    const r = svgDesignLayers(b, { ...base(), width: 60, height: 60, mode: 'both', designPattern: id, backing: 'two', backing1Pattern: id, backing2Pattern: id });
    assert.ok(r.layers[0].length > 3, `${id} fill`);
    assert.ok(r.layers[1].length > 0 && r.layers[2].length > 0, `${id} backing`);
  }
});

test('a drawing with no closed shape falls back to its lines, with a note', () => {
  const vector = { name: 'open.svg', width: 50, height: 50, paths: [[{ x: 5, y: 5 }, { x: 25, y: 40 }, { x: 45, y: 8 }]] };
  const r = svgDesignLayers(boundaryFor(100, 100), { ...base(), mode: 'fill', backing: 'one', backingArea: 'shape' }, vector);
  assert.equal(r.extra.svgDesign.mode, 'outline');
  assert.ok(r.warnings.some((w) => /no closed shapes/.test(w)));
  assert.ok(r.layers[1].length > 0, 'the backing falls back to the drawing\'s box');
});

test('an imported drawing is scaled to the swatch and prints as one connected fabric', () => {
  const { machine, material } = defaultProfiles();
  const vector = { name: 'badge.svg', width: 60, height: 40, paths: [square(5, 5, 50, 30), square(20, 14, 20, 12)] };
  const s = { ...base(), width: 120, height: 80, mode: 'both', backing: 'one', backingArea: 'swatch' };
  const r = card.generate(machine, material, s, { vector });
  assert.equal(r.svgDesign.name, 'badge.svg');
  assert.equal(r.svgDesign.sample, false);
  assert.equal(r.svgDesign.closed, 2);
  assert.equal(r.fabric.components, 1);
  assert.equal(r.fabric.exportable, true);
  assert.ok(r.report.between > 0, 'the backing crosses the drawing');
  assert.ok(r.gcode.includes('G1'));
  const xs = r.strands.flatMap((st) => st.pts.map((p) => p.x));
  assert.ok(Math.max(...xs) > 100 && Math.max(...xs) <= 120.01, 'the drawing was doubled to the 120 mm swatch');
});

test('the backing pattern chosen is the pattern printed', () => {
  const b = boundaryFor(100, 100);
  const a = svgDesignLayers(b, { ...base(), backing: 'one', backing1Pattern: 'gyroid' }).layers[1];
  const c = svgDesignLayers(b, { ...base(), backing: 'one', backing1Pattern: 'hilbert' }).layers[1];
  assert.notEqual(JSON.stringify(a), JSON.stringify(c));
});

test('settings are sanitised: an unknown pattern or a shared bad value falls back', () => {
  const s = card.sanitize({ mode: 'sparkle', backing: 'three', backing1Pattern: 'plaid', designPattern: 'gyroid', backing1Spacing: -4, designAngle: 'x' });
  assert.equal(s.mode, 'both');
  assert.equal(s.backing, 'one');
  assert.equal(s.backing1Pattern, 'gyroid');
  assert.equal(s.designPattern, 'gyroid');
  assert.equal(s.backing1Spacing, 4);
  assert.equal(s.designAngle, 45);
});

test('the same settings give the same G-code', () => {
  const { machine, material } = defaultProfiles();
  const s = { ...base(), width: 60, height: 60, backing: 'two', backing1Pattern: 'lightning', backing2Pattern: 'cubic' };
  assert.equal(card.generate(machine, material, s).gcode, card.generate(machine, material, s).gcode);
});
