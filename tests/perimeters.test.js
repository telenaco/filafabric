import test from 'node:test';
import assert from 'node:assert/strict';
import { zigzagPaths, solidLayer } from '../src/engine/solid-fill.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { segmentInside, segmentContact } from '../src/engine/fabric.js';
import { exportPanel } from '../src/engine/panel.js';
import { sanitizePrint } from '../src/ui/share.js';
import { defaultProfiles } from './helpers.js';

const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const closed = (p) => Math.hypot(p[0].x - p.at(-1).x, p[0].y - p.at(-1).y) < 1e-7;
const distance = (p, paths) => Math.min(...paths.flatMap((pts) => pts.slice(1).map((b, i) => segmentContact(p, p, pts[i], b).distance)));

test('two perimeters reserve the solid core and overlap its infill instead of growing outward', () => {
  const paths = zigzagPaths(rect(0, 0, 20, 12), { perimeters: 2 });
  assert.equal(paths.filter(closed).length, 2);
  const walls = paths.slice(0, 2);
  assert.ok(Math.abs(Math.min(...walls[0].map((p) => p.x)) - 0.225) < 1e-7);
  assert.ok(Math.abs(Math.min(...walls[1].map((p) => p.x)) - 0.585) < 1e-7);
  const inside = paths.slice(2);
  assert.ok(inside.length > 0);
  assert.ok(inside.flat().every((p) => p.x >= 0.945 - 1e-4 && p.y >= 0.945 - 1e-4));
  assert.ok(Math.abs(distance(inside[0][0], [walls[1]]) - 0.36) < 0.01);
});

test('zero perimeters fills to the bead-safe edge without a separate outline', () => {
  const paths = zigzagPaths(rect(0, 0, 20, 12), { perimeters: 0 });
  assert.equal(paths.filter(closed).length, 0);
  assert.ok(Math.min(...paths.flat().map((p) => p.x)) <= 0.226);
});

test('perimeters around holes stay on the material side and never bridge windows', () => {
  const outer = rect(0, 0, 20, 20), hole = rect(7, 6, 6, 8);
  const paths = zigzagPaths(outer, { perimeters: 2, holes: [hole] });
  assert.equal(paths.filter(closed).length, 4);
  const boundary = new PolygonBoundary([outer, hole]);
  for (const pts of paths) for (let i = 1; i < pts.length; i++) assert.ok(segmentInside(pts[i - 1], pts[i], boundary, 0.225));
});

test('additional perimeters keep previously covered narrow branches', () => {
  const ring = [{x:0,y:0},{x:8,y:0},{x:8,y:3.3},{x:13,y:3.3},{x:13,y:0},{x:21,y:0},{x:21,y:8},{x:13,y:8},{x:13,y:4.7},{x:8,y:4.7},{x:8,y:8},{x:0,y:8}];
  const before = solidLayer(ring, { perimeters: 1 }), after = solidLayer(ring, { perimeters: 2 });
  for (const pts of before) for (const p of pts) if (p.x > 8 && p.x < 13) assert.ok(distance(p, after) <= 0.225 + 1e-3, 'narrow connector keeps its fill');
});

test('saved legacy brim counts and explicit perimeter counts select the same control', () => {
  assert.equal(sanitizePrint({ perimeters: 3 }).brim, 3);
  assert.equal(sanitizePrint({ brim: 1 }).brim, 1);
  assert.equal(sanitizePrint({ brim: 1, perimeters: 2 }).brim, 2);
});

test('export perimeters remain independent of one solid layer and two non-planar mesh passes', () => {
  const out = generateDesignExport({ ...defaultProfiles(), design: 'zigzag', width: 40, height: 30, settings: { depth: 1.5 }, perimeters: 2, solidLayers: 1, extraLayers: 0 });
  assert.equal(out.perimeters.count, 2);
  const pattern = out.strands.filter((s) => !s.brim && !s.connection);
  assert.equal(pattern.length, 2);
  assert.equal(out.layerPlan.patternLayers, 2);
  assert.ok(pattern[1].pts.some((p) => p.z > 0.3));
  assert.ok(pattern.flatMap((s) => s.pts).every((p) => p.x >= 0.945 - 1e-4 && p.y >= 0.945 - 1e-4));
  assert.ok(out.gcode.includes('Perimeters: 2'));
});

test('single-layer imported solid honors the perimeter count', () => {
  const ring = rect(3, 3, 24, 16);
  const vector = { name: 'solid.svg', width: 30, height: 22, paths: [[...ring, ring[0]]], styles: [{ color: 'green', width: 0.2 }] };
  const out = generateDesignExport({ ...defaultProfiles(), design: 'zigzag', width: 30, height: 22, vector, perimeters: 2, solidLayers: 1, extraLayers: 0 });
  assert.equal(out.solid.layers, 1);
  assert.equal(out.solid.perimeters, 2);
  assert.ok(out.strands.filter((s) => s.solid).every((s) => s.pts.every((p) => p.z === 0.2)));
});

test('streamed panels record selected perimeters and use one whole-panel border', async () => {
  let code = '';
  const result = await exportPanel({ ...defaultProfiles(), design: 'zigzag', width: 30, height: 20, repeat: 15, perimeters: 1, solidLayers: 1, extraLayers: 0 }, { write: async (s) => { code += s; } });
  assert.equal(result.print.perimeters, 1);
  assert.equal((code.match(/; perimeter run /g) ?? []).length, 1);
});

test('narrow-detail fallback never restores unsafe legacy fill beside a near-edge hole', () => {
  for (const x of [0.1, 0.5]) for (const perimeters of [0, 1, 2]) {
    const outer = rect(0, 0, 20, 20), hole = rect(x, 4, 10, 12);
    const boundary = new PolygonBoundary([outer, hole]);
    const paths = zigzagPaths(outer, { perimeters, holes: [hole] });
    for (const pts of paths) for (let i = 1; i < pts.length; i++) assert.ok(segmentInside(pts[i - 1], pts[i], boundary, 0.225 - 1e-5), 'every fallback segment retains full bead clearance');
  }
});

test('streamed whole-panel perimeter clearance retains continuous zigzag passes', async () => {
  for (const perimeters of [1, 2]) {
    let code = '';
    await exportPanel({ ...defaultProfiles(), design: 'zigzag', width: 40, height: 40, repeat: 40, perimeters, extraLayers: 0, settings: { depth: 1.5, spacing: 3 } }, { write: async (s) => { code += s; } });
    const texture = code.split('; texture section 1;')[1].split('; actual print')[0];
    assert.ok((texture.match(/^G1 E-/gm) ?? []).length <= 2, 'each mesh pass keeps its row turnarounds');
  }
});

test('explicit zero and all-solid perimeter choices remain recorded without duplicate borders', () => {
  const base = { ...defaultProfiles(), design: 'zigzag', width: 30, height: 22, extraLayers: 0, solidLayers: 1 };
  const off = generateDesignExport({ ...base, perimeters: 0 });
  assert.equal(off.perimeters.count, 0);
  assert.ok(off.gcode.includes('Perimeters: 0'));
  const ring = rect(3, 3, 24, 16);
  const vector = { name: 'solid.svg', width: 30, height: 22, paths: [[...ring, ring[0]]], styles: [{ color: 'green', width: 0.2 }] };
  const filled = generateDesignExport({ ...base, vector, perimeters: 2 });
  assert.equal(filled.perimeters.count, 2);
  assert.ok(!filled.strands.some((s) => s.brim), 'solid walls are sufficient; no duplicate bed border');
});

test('perimeter filenames retain count zero and single solid layer', async () => {
  const { exportFileName, parseFileName } = await import('../src/ui/file-name.js');
  const { designById } = await import('../src/ui/designs.js');
  const design = designById('zigzag');
  for (const perimeters of [0, 1, 2]) {
    const name = exportFileName(design, design.defaults(), ['mode','spacing','depth','wavelength'], { size: [40,30], print: { perimeters, solidLayers: 1, extraLayers: 0, layerHeight: 0.2 }, material: 'filaflex-95-foamy' });
    const decoded = parseFileName(name);
    assert.equal(decoded.perimeters, perimeters);
    assert.equal(decoded.solidLayers, 1);
  }
});

test('invalid perimeter counts are rejected before planning', () => {
  for (const perimeters of [-1, 51, 1.5, NaN, '2']) assert.throws(() => generateDesignExport({ ...defaultProfiles(), design:'zigzag', width:30, height:22, perimeters }), /perimeters/i);
});

test('dense curved perimeters avoid tiny redundant commands while keeping full bead clearance', async () => {
  const { buildBrimStrands } = await import('../src/engine/brim.js');
  const ring = Array.from({ length: 2000 }, (_, i) => { const a = i * 2 * Math.PI / 2000; return { x:10+5*Math.cos(a), y:10+5*Math.sin(a) }; });
  const boundary = new PolygonBoundary([ring]);
  const paths = buildBrimStrands([ring], { count:2 });
  assert.ok(paths.reduce((n,s) => n+s.pts.length,0) < 400, 'sub-bead curve detail does not become thousands of tiny G1 commands');
  for (const s of paths) for (let i=1;i<s.pts.length;i++) assert.ok(segmentInside(s.pts[i-1],s.pts[i],boundary,0.225));
});

test('bounded simplification refuses a shortcut across a narrow opening', async () => {
  const { simplifyStrands } = await import('../src/engine/fabric.js');
  const boundary = new PolygonBoundary([rect(0,0,10,10),rect(4.9995,4.9995,0.001,0.001)]);
  const pts = [{x:4,y:5,z:0.2},{x:5,y:5.004,z:0.2},{x:6,y:5,z:0.2}];
  const [out] = simplifyStrands([{pts}],0.005,{allowSegment:(a,b)=>segmentInside(a,b,boundary)});
  assert.equal(out.pts.length,3,'the critical corner survives even below simplification tolerance');
});
