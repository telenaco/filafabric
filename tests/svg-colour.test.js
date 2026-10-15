import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSvg, parseXml, pathSubpaths, parseTransform } from '../src/engine/svg-parse.js';
import { interpretDrawing, passesFor, offsetPolyline, linePasses, drawingPolylines, sanitizeSvgLines, summariseDrawing, describeDrawing, cropToDrawing } from '../src/engine/drawing.js';
import { svgDesignLayers } from '../src/engine/svgdesign.js';
import { outlineFromVector, composeSvgLines } from '../src/engine/svg-lines.js';
import { boundaryFor } from '../src/engine/layers.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const fixture = (name) => fs.readFileSync(path.join(projectRoot, 'tests', 'fixtures', name), 'utf8');
const svg = (body, attrs = 'width="100mm" height="100mm" viewBox="0 0 100 100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
const rect = (x, y, w, h, colour, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="fill:none;stroke:${colour};stroke-width:0.25" ${extra}/>`;
const FILL = { fill: 'none' };

/* ---------- the file ---------- */

test('the user\'s example drawing: red square, blue star inside it, red circle inside that, ten red lines', () => {
  const v = parseSvg(fixture('red-blue-lines.svg'), 'example.svg');
  assert.deepEqual([v.width, v.height], [210, 297]);
  assert.equal(v.paths.length, 13);
  assert.deepEqual(v.styles.map((s) => s.color), ['red', 'blue', 'red', ...Array(10).fill('red')]);
  assert.ok(v.styles.slice(3).every((s) => Math.abs(s.width - 1.2) < 1e-9), 'the lines are 1.2 mm wide');
  // the square is 59.75 mm, placed on the page with y up
  const xs = v.paths[0].map((p) => p.x), ys = v.paths[0].map((p) => p.y);
  assert.ok(Math.abs(Math.min(...xs) - 75.1251) < 1e-3 && Math.abs(Math.max(...xs) - 134.8749) < 1e-3);
  assert.ok(Math.abs(Math.min(...ys) - (297 - 118.6251 - 59.7498)) < 1e-2);

  const m = interpretDrawing(v);
  assert.deepEqual(m.shapes.map((s) => [s.color, s.role, s.depth]), [['red', 'fill', 0], ['blue', 'hole', 1], ['red', 'fill', 2]]);
  assert.equal(m.fills.length, 2, 'the square less the star, and the circle inside the star');
  assert.deepEqual(m.fills.map((f) => f.holes.length), [1, 0]);
  assert.equal(m.lines.length, 10);
  assert.ok(m.lines.every((l) => !l.closed));
});

test('the filled area is the square less the star, plus the circle: the innermost shape decides', () => {
  const v = parseSvg(fixture('red-blue-lines.svg'));
  const region = new PolygonBoundary(interpretDrawing(v).rings);
  const flip = (y) => 297 - y;
  assert.equal(region.contains(80, flip(125)), true, 'in the square, outside the star');
  assert.equal(region.contains(105, flip(135)), false, 'in the star: a hole');
  assert.equal(region.contains(105, flip(148.5)), true, 'in the circle inside the star: filled again');
  assert.equal(region.contains(20, flip(20)), false, 'outside everything');
});

test('a line as wide as the extrusion is one pass and a wider one is several side by side', () => {
  assert.deepEqual([0, 0.2, 0.4, 0.45, 0.8, 1.2, 1.8].map((w) => passesFor(w, 0.45)), [1, 1, 1, 1, 2, 3, 4]);
  assert.equal(passesFor(1.2, 0.4), 3);
  assert.equal(passesFor(50, 0.45), 8, 'capped');
  const v = parseSvg(fixture('red-blue-lines.svg'));
  const line = interpretDrawing(v).lines[0];
  const passes = linePasses(line, 0.45);
  assert.equal(passes.length, 3);
  // side by side: 20% overlap of a 0.45 mm bead, centred on the drawing, same length
  const mid = (p) => ({ x: (p[0].x + p.at(-1).x) / 2, y: (p[0].y + p.at(-1).y) / 2 });
  const [a, b, c] = passes.map(mid);
  assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 0.36) < 1e-6);
  assert.ok(Math.abs(Math.hypot(b.x - c.x, b.y - c.y) - 0.36) < 1e-6);
  const centre = mid(line.pts);
  assert.ok(Math.hypot(b.x - centre.x, b.y - centre.y) < 1e-6);
  assert.ok(Math.abs(Math.hypot(passes[0][0].x - passes[0].at(-1).x, passes[0][0].y - passes[0].at(-1).y) - Math.hypot(line.pts[0].x - line.pts.at(-1).x, line.pts[0].y - line.pts.at(-1).y)) < 1e-6);
});

test('the design layer prints the lines three passes wide and fills only the red area', () => {
  const v = parseSvg(fixture('red-blue-lines.svg'));
  const b = boundaryFor(210, 297);
  const base = { width: 210, height: 297, designPattern: 'rectilinear', designSpacing: 2, designAngle: 0, backing: 'none' };
  const lines = svgDesignLayers(b, { ...base, mode: 'outline' }, v).layers[0];
  // three shapes' edges and ten lines of three passes
  assert.equal(lines.length, 3 + 10 * 3);
  const filled = svgDesignLayers(b, { ...base, mode: 'fill' }, v);
  assert.equal(filled.extra.svgDesign.filled, 2);
  assert.equal(filled.extra.svgDesign.holes, 1);
  const fillOnly = filled.layers[0].slice(0, filled.layers[0].length - 30);
  const region = new PolygonBoundary(interpretDrawing(v).rings);
  const stray = fillOnly.flat().filter((p) => !region.contains(p.x, p.y));
  assert.ok(fillOnly.flat().length > 100, 'the red area is filled');
  assert.ok(stray.length / fillOnly.flat().length < 0.03, `${stray.length} of ${fillOnly.flat().length} fill points are outside the red area`);
  // nothing of the fill is in the star's blue ring (between the star and the circle), well away from the lines
  const inStar = fillOnly.flat().filter((p) => Math.abs(p.x - 105) < 3 && Math.abs(p.y - (297 - 160)) < 2);
  assert.equal(inStar.length, 0, 'the star is a hole');
});

/* ---------- the rules ---------- */

const paths = (shapes) => ({ name: 't', width: 100, height: 100, paths: shapes.map((s) => s.pts), styles: shapes.map((s) => ({ color: s.color, width: s.width ?? 0.25 })) });
const sq = (x, y, w, h = w) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];

test('blue inside red is a hole, red inside that is filled again, and blue alone changes nothing', () => {
  const m = interpretDrawing(paths([
    { pts: sq(5, 5, 90), color: 'red' },
    { pts: sq(15, 15, 70), color: 'blue' },
    { pts: sq(25, 25, 50), color: 'red' },
    { pts: sq(35, 35, 30), color: 'blue' },
  ]));
  assert.deepEqual(m.fills.map((f) => f.holes.length), [1, 1]);
  const region = new PolygonBoundary(m.rings);
  assert.equal(region.contains(10, 10), true);
  assert.equal(region.contains(20, 20), false);
  assert.equal(region.contains(30, 30), true);
  assert.equal(region.contains(50, 50), false);
  const alone = interpretDrawing(paths([{ pts: sq(5, 5, 40), color: 'blue' }]));
  assert.equal(alone.fills.length, 0);
  assert.equal(alone.rings.length, 0);
});

test('red inside red adds nothing, and the hole in the inner one is a hole in the whole', () => {
  const m = interpretDrawing(paths([
    { pts: sq(5, 5, 90), color: 'red' },
    { pts: sq(20, 20, 60), color: 'red' },
    { pts: sq(35, 35, 30), color: 'blue' },
  ]));
  assert.equal(m.fills.length, 1);
  const region = new PolygonBoundary(m.rings);
  assert.equal(region.contains(25, 25), true, 'filled once, not cancelled out');
  assert.equal(region.contains(50, 50), false);
});

test('a shape that is not closed is never filled, and other colours print as lines', () => {
  const open = [{ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 60, y: 60 }, { x: 10, y: 60 }]; // a square with its last side missing
  const m = interpretDrawing(paths([
    { pts: open, color: 'red' },
    { pts: sq(70, 70, 20), color: 'other', width: 0.9 },
  ]));
  assert.equal(m.fills.length, 0);
  assert.equal(m.lines.length, 2);
  assert.equal(m.lines[1].closed, true, 'a black square is a line that comes back to its start');
  assert.equal(linePasses(m.lines[1], 0.45).length, 2);
});

test('a drawing with no colours keeps the old rule: closed paths alternate fill and hole', () => {
  const m = interpretDrawing({ name: 'old', width: 100, height: 100, paths: [sq(5, 5, 90), sq(20, 20, 60), sq(35, 35, 30), [{ x: 0, y: 0 }, { x: 5, y: 5 }]] });
  assert.equal(m.styled, false);
  assert.deepEqual(m.shapes.map((s) => s.role), ['fill', 'hole', 'fill']);
  assert.equal(m.lines.length, 1);
  assert.equal(m.lines[0].width, 0);
});

test('a drawing placed at another size takes its stroke widths with it', () => {
  const v = paths([{ pts: [{ x: 0, y: 10 }, { x: 50, y: 10 }], color: 'other', width: 0.4 }]);
  assert.equal(interpretDrawing(v, { scaleX: 2, scaleY: 2 }).lines[0].width, 0.8);
  assert.equal(interpretDrawing(v, { scaleX: 1, scaleY: 1 }).lines[0].width, 0.4);
});

test('a sideways copy of a line is the same length and as far off as asked, corners included', () => {
  const l = offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0.4);
  assert.deepEqual(l.map((p) => [p.x, +p.y.toFixed(9)]), [[0, 0.4], [10, 0.4]]);
  const corner = offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], -1);
  assert.ok(Math.abs(corner[1].x - 11) < 1e-9 && Math.abs(corner[1].y - -1) < 1e-9, 'a right-angle corner stays a right-angle corner');
  const ring = offsetPolyline(sq(0, 0, 10), 1);
  assert.deepEqual([ring[0].x, ring[0].y], [ring.at(-1).x, ring.at(-1).y], 'a closed line stays closed');
});

/* ---------- the file reader ---------- */

test('colour and width come from attributes, a style attribute, a style sheet and enclosing groups', () => {
  const v = parseSvg(svg(`
    <style>.mark { fill: none; stroke: #0000ff; stroke-width: 0.5 } #top { stroke: red }</style>
    <g fill="none" stroke="#ff0000" stroke-width="0.4"><path d="M0 0L10 0"/><path d="M0 5L10 5" stroke="#00f"/></g>
    <path class="mark" d="M0 10L10 10"/>
    <path id="top" class="mark" d="M0 12L10 12" style="stroke-width:3"/>
    <path d="M0 14L10 14" fill="none" stroke="rgb(255, 0, 0)" stroke-width="0.1mm"/>
    <path d="M0 16L10 16" fill="#ff0000" stroke="none"/>
    <path d="M0 18L10 18" fill="none" stroke="#e8001c"/>
  `));
  const got = v.styles.map((s) => [s.color, +s.width.toFixed(3)]);
  assert.deepEqual(got, [['red', 0.4], ['blue', 0.4], ['blue', 0.5], ['red', 3], ['red', 0.1], ['red', 0], ['other', 1]]);
});

test('what is hidden or only defined, and what is neither filled nor stroked, is not read', () => {
  const v = parseSvg(svg(`
    <defs><path d="M0 0L10 0" stroke="red"/></defs>
    <g display="none"><path d="M0 1L10 1" stroke="red"/></g>
    <path d="M0 2L10 2" style="display:none;stroke:red"/>
    <path d="M0 3L10 3" fill="none" stroke="none"/>
    <clipPath id="c"><rect width="5" height="5"/></clipPath>
    <path d="M0 4L10 4" stroke="red"/>
  `));
  assert.equal(v.paths.length, 1);
  assert.equal(v.paths[0][0].y, 96, 'y is up: 100 - 4');
});

test('the page is the viewBox: size in mm, units, transforms and nested groups', () => {
  const v = parseSvg(svg(`<g transform="translate(10,20) scale(2)"><g transform="rotate(90)"><path d="M0 0L5 0" stroke="red" stroke-width="1"/></g></g>`, 'width="50mm" height="50mm" viewBox="0 0 25 25"'));
  assert.deepEqual([v.width, v.height], [50, 50]);
  // 25 units on 50 mm is 2 mm per unit; the point (0,0) → (10,20) → page (20, 40 from the top → 10 from the bottom)
  const [a, b] = v.paths[0];
  assert.ok(Math.abs(a.x - 20) < 1e-6 && Math.abs(a.y - 10) < 1e-6, `${a.x},${a.y}`);
  // rotated 90°, 5 long, doubled, then doubled again by the page: 20 mm, along page-y (down), so up-y decreases
  assert.ok(Math.abs(b.x - 20) < 1e-6 && Math.abs(b.y - -10) < 1e-6, `${b.x},${b.y}`);
  assert.ok(Math.abs(v.styles[0].width - 4) < 1e-9, 'the stroke is scaled by the transform and the page: 1 × 2 × 2');
});

test('rectangles (rounded too), circles, ellipses, polygons, polylines and lines are read', () => {
  const v = parseSvg(svg(`
    <rect x="10" y="10" width="20" height="10" stroke="red" fill="none"/>
    <rect x="40" y="10" width="20" height="10" rx="3" stroke="red" fill="none"/>
    <circle cx="20" cy="50" r="8" stroke="blue" fill="none"/>
    <ellipse cx="60" cy="50" rx="10" ry="5" stroke="blue" fill="none"/>
    <polygon points="10,80 30,80 20,95" stroke="red" fill="none"/>
    <polyline points="40,80 50,95 60,80" stroke="black" fill="none"/>
    <line x1="70" y1="80" x2="90" y2="90" stroke="black"/>
  `));
  assert.equal(v.paths.length, 7);
  const m = interpretDrawing(v);
  assert.equal(m.shapes.length, 5, 'the rectangles, circle, ellipse and polygon are closed');
  assert.equal(m.lines.length, 2, 'the polyline and the line are open');
  const circle = v.paths[2], xs = circle.map((p) => p.x);
  assert.ok(Math.abs(Math.min(...xs) - 12) < 0.01 && Math.abs(Math.max(...xs) - 28) < 0.01);
  assert.ok(circle.length > 100, 'a smooth curve is sampled finely');
});

test('path data: subpaths, relative and implicit commands, curves, arcs with run-together flags', () => {
  const two = pathSubpaths('M 0 0 L 10 0 m 5 5 l 10 0');
  assert.equal(two.length, 2);
  assert.deepEqual(two[1].pts[0], [15, 5], 'a relative moveto continues from where the last subpath ended');
  assert.ok(two.every((s) => !s.closed), 'open lines are not closed');
  const closed = pathSubpaths('M0 0 10 0 10 10z');
  assert.equal(closed[0].closed, true);
  assert.deepEqual(closed[0].pts.at(-1), [0, 0]);
  const arc = pathSubpaths('M0 0a5 5 0 1010 0', 1)[0].pts; // flags written together: 1 and 0
  assert.ok(arc.length > 8);
  assert.ok(Math.abs(arc.at(-1)[0] - 10) < 1e-9 && Math.abs(arc.at(-1)[1]) < 1e-9);
  assert.ok(Math.max(...arc.map((p) => Math.abs(p[1]))) > 4.9, 'a half circle of radius 5');
  const cubic = pathSubpaths('M0 0C0 10 10 10 10 0S20 -10 20 0', 1)[0].pts;
  assert.deepEqual(cubic.at(-1), [20, 0]);
  const quad = pathSubpaths('M0 0Q5 10 10 0T20 0', 1)[0].pts;
  assert.deepEqual(quad.at(-1), [20, 0]);
  assert.throws(() => pathSubpaths('M0 0 X5 5'), /Unsupported SVG path command/);
  assert.throws(() => pathSubpaths('M0 0 L5'), /Incomplete SVG path/);
});

test('transforms compose left to right', () => {
  assert.deepEqual(parseTransform('translate(10 20)'), [1, 0, 0, 1, 10, 20]);
  const m = parseTransform('translate(10,0) scale(2)');
  assert.deepEqual([m[0] * 3 + m[4], m[3] * 4 + m[5]], [16, 8]);
  assert.deepEqual(parseTransform('matrix(1 2 3 4 5 6)'), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseTransform('nonsense'), [1, 0, 0, 1, 0, 0]);
});

test('the reader is tolerant of an Inkscape or Illustrator file and strict about nonsense', () => {
  const xml = parseXml('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "boom">]><!-- c --><svg><g id="a&amp;b"><![CDATA[x]]></g></svg>');
  assert.equal(xml.children[0].children[0].attrs.id, 'a&b');
  assert.throws(() => parseSvg('hello'), /not readable SVG/);
  assert.throws(() => parseSvg(svg('<text>words</text>')), /No printable paths/);
  assert.throws(() => parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="5000mm" height="10mm"><path d="M0 0L5 5" stroke="red"/></svg>'), /0–1000 mm/);
});

test('a saved drawing keeps its colours only when they line up with its paths', () => {
  const raw = { name: 'x', width: 10, height: 10, paths: [[{ x: 0, y: 0 }, { x: 5, y: 5 }]] };
  assert.deepEqual(sanitizeSvgLines({ ...raw, styles: [{ color: 'red', width: 1.23456 }] }).styles, [{ color: 'red', width: 1.235 }]);
  assert.equal(sanitizeSvgLines({ ...raw, styles: [] }).styles, undefined);
  assert.equal(sanitizeSvgLines({ ...raw, styles: [{ color: 'purple', width: 1 }] }).styles, undefined);
  assert.equal(sanitizeSvgLines({ ...raw, styles: [{ color: 'red', width: -1 }] }).styles, undefined);
  assert.equal('styles' in sanitizeSvgLines(raw), false, 'an older drawing is unchanged');
});

/* ---------- through the studio ---------- */

test('the drawing is the outline: its red area, less the blue hole, in the drawing\'s own millimetres', () => {
  const v = parseSvg(fixture('red-blue-lines.svg'));
  const o = outlineFromVector(v);
  assert.equal(o.rings.length, 3, 'the square, the star hole and the circle');
  assert.deepEqual(o.page, [210, 297]);
  const blueOnly = { name: 'b', width: 100, height: 100, paths: [sq(10, 10, 50)], styles: [{ color: 'blue', width: 0.25 }] };
  assert.ok(outlineFromVector(blueOnly), 'blue blocks the default rectangular page even without a red container');
  const blackOnly = { name: 'k', width: 100, height: 100, paths: [sq(10, 10, 50)], styles: [{ color: 'other', width: 0.25 }] };
  assert.equal(outlineFromVector(blackOnly), null);
});

test('the SVG design card prints a drawing at its own size: wide lines take more passes, the hole stays empty', () => {
  const { machine, material } = defaultProfiles();
  const card = designById('svgdesign');
  const v = parseSvg(svg(`
    ${rect(10, 10, 80, 80, '#ff0000')}
    ${rect(25, 25, 50, 50, '#0000ff')}
    ${rect(40, 40, 20, 20, '#ff0000')}
    <path d="M12 95L88 95" style="fill:none;stroke:#000000;stroke-width:1.2"/>
    <path d="M12 5L88 5" style="fill:none;stroke:#000000;stroke-width:0.4"/>
  `), 'nested.svg');
  const s = { ...card.defaults(), width: 100, height: 100, mode: 'both', backing: 'one', designSpacing: 2 };
  const r = card.generate(machine, material, s, { vector: v });
  assert.equal(r.svgDesign.filled, 2);
  assert.equal(r.svgDesign.holes, 1);
  assert.equal(r.svgDesign.lines, 2);
  assert.equal(r.fabric.exportable, true);
  assert.ok(r.gcode.includes('G1'));
  // the 1.2 mm line is three passes and the 0.4 mm line is one: two extra passes of 76 mm
  const narrow = card.generate(machine, material, s, { vector: { ...v, styles: v.styles.map((x) => ({ ...x, width: 0.45 })) } });
  const extra = r.stats.lengthByClass.base - narrow.stats.lengthByClass.base;
  assert.ok(extra > 2 * 76 * 0.9 && extra < 2 * 76 * 1.1, `${extra.toFixed(1)} mm more for two extra passes of 76 mm`);
  // the design layer prints nothing in the blue square, between its edge and the red one inside
  const design = svgDesignLayers(boundaryFor(100, 100), { ...s, backing: 'none' }, v).layers[0];
  const inHole = design.flat().filter((p) => p.x > 27 && p.x < 38 && p.y > 27 && p.y < 73);
  assert.equal(inHole.length, 0, 'the blue square is left empty');
  assert.ok(design.flat().some((p) => p.x > 41 && p.x < 59 && p.y > 41 && p.y < 59), 'the red square inside it is filled again');
  const warned = card.generate(machine, material, { ...s, mode: 'fill' }, { vector: { ...v, styles: v.styles.map((x) => ({ ...x, color: 'other' })) } });
  assert.ok(warned.warnings.some((w) => /no red closed shape/.test(w)), 'a drawing with no red shape says how to fill one');
});

test('imported drawing lines print their passes on the first layer under any pattern', () => {
  const { machine, material } = defaultProfiles();
  const card = designById('rosette');
  const result = card.generate(machine, material, { ...card.defaults(), width: 60, height: 60 });
  const v = { name: 'wide', width: 60, height: 60, paths: [[{ x: 5, y: 30 }, { x: 55, y: 30 }]], styles: [{ color: 'other', width: 1.2 }] };
  const composed = composeSvgLines(result, v);
  const first = composed.strands.filter((s) => s.name === 'Imported SVG lines');
  assert.equal(first.length, 3, 'three passes');
  const ys = first.map((s) => s.pts[0].y).sort((a, b) => a - b);
  assert.ok(Math.abs(ys[1] - ys[0] - 0.36) < 1e-6 && Math.abs(ys[2] - ys[1] - 0.36) < 1e-6);
});

test('a small motif on a big page is cut down to the drawing, with its lines and colours unchanged', () => {
  const v = parseSvg(fixture('red-blue-lines.svg'));
  const c = cropToDrawing(v);
  // the square is 59.75 mm; its widest line is 1.2 mm, so 3 + 0.6 on each side
  assert.ok(Math.abs(c.width - 67) < 0.15 && Math.abs(c.height - 67) < 0.15, `${c.width} × ${c.height}`);
  assert.deepEqual(c.styles, v.styles);
  assert.equal(c.paths.length, v.paths.length);
  const xs = c.paths.flat().map((p) => p.x), ys = c.paths.flat().map((p) => p.y);
  assert.ok(Math.min(...xs) > 3 && Math.min(...ys) > 3 && Math.max(...xs) < c.width - 3 && Math.max(...ys) < c.height - 3);
  // the same drawing: the same shapes and passes
  assert.deepEqual(summariseDrawing(c), summariseDrawing(v));
  assert.equal(cropToDrawing({ name: 'x', width: 10, height: 10, paths: [] }).width, 10);
});

test('the import card describes what a drawing will print', () => {
  const s = summariseDrawing(parseSvg(fixture('red-blue-lines.svg')), { bead: 0.45 });
  assert.deepEqual([s.fills, s.holes, s.lines, s.passes], [2, 1, 10, 3]);
  assert.equal(describeDrawing(s), '2 filled shapes with 1 hole, 10 lines (up to 3 passes)');
  assert.equal(describeDrawing({ fills: 1, holes: 0, lines: 1, passes: 1 }), '1 filled shape, 1 line');
  assert.equal(describeDrawing({ fills: 0, holes: 0, lines: 0, passes: 1 }), 'nothing to print yet');
  const edges = drawingPolylines(parseSvg(fixture('red-blue-lines.svg')), { edges: 'kept' });
  assert.equal(edges.whole.length, 3, 'a drawing that is the outline keeps the edges of its filled shapes whole');
});
