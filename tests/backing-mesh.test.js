import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { addBackingMesh, BACKING_MESH } from '../src/engine/backing.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { parseSvg } from '../src/engine/svg-parse.js';
import { vectorPatternRings } from '../src/engine/svg-lines.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const { machine, material } = defaultProfiles();
const zMin = (s) => Math.min(...s.pts.map((p) => p.z));
const length = (list) => list.reduce((n, s) => n + s.pts.slice(1).reduce((m, p, i) => m + Math.hypot(p.x - s.pts[i].x, p.y - s.pts[i].y), 0), 0);
const coil = (backing, mat = material) => generateDesignExport({ machine, material: mat, design: 'coil', settings: designById('coil').defaults(), width: 60, height: 50, extraLayers: 0, brim: 0, backing });

test('the standard backing is the zigzag mesh the studio was tuned with: 3.7 mm apart, 2 mm deep, 6 mm waves', () => {
  assert.deepEqual({ ...BACKING_MESH }, { spacing: 3.7, depth: 2, wavelength: 6, pause: false });
});

test('a backing mesh prints first, two flat zigzag layers, and the design lies two layers up on it', () => {
  const plain = coil(null), backed = coil({});
  const h = backed.cfg.t.layer_height;
  const mesh = backed.strands.filter((s) => s.backingMesh);
  // (each layer is one strand, its lines joined at the edges; 50 mm of lanes about 3.7 mm apart, each longer than 60 mm)
  assert.ok(length(mesh) > 2 * 12 * 60, `the mesh is there (${Math.round(length(mesh))} mm)`);
  assert.deepEqual(backed.strands.slice(0, mesh.length), mesh, 'it prints before anything else');
  const first = mesh.filter((s) => zMin(s) < 1.5 * h), second = mesh.filter((s) => zMin(s) > 1.5 * h);
  assert.ok(first.length && second.length, 'two layers');
  assert.ok(first.every((s) => s.pts.every((p) => Math.abs(p.z - h) < 1e-9)), 'the first lies flat on the bed');
  assert.ok(second.every((s) => Math.abs(zMin(s) - 2 * h) < 1e-9), 'the second lies flat on the first');
  // the design is the same, two layers higher
  const design = backed.strands.slice(mesh.length);
  assert.equal(design.length, plain.strands.length);
  design.forEach((s, i) => s.pts.forEach((p, j) => assert.ok(Math.abs(p.z - plain.strands[i].pts[j].z - 2 * h) < 1e-9)));
  // the mesh stays within the swatch, and is said in the G-code
  const swatch = new PolygonBoundary([[{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 50 }, { x: 0, y: 50 }]]);
  assert.ok(mesh.every((s) => s.pts.every((p) => swatch.contains(p.x, p.y) || p.x <= 60 + 1e-6)));
  assert.match(backed.gcode, /^; Backing mesh: 2 zigzag layers, 3\.7 mm apart, 2 mm deep, 6 mm waves/m);
  assert.deepEqual(backed.backingMesh, { layers: 2, spacing: 3.7, depth: 2, wavelength: 6, pause: false });
  assert.ok(backed.moves.length > plain.moves.length);
});

test('its look can be changed, and it can pause for another colour once it is down', () => {
  const open = coil({ spacing: 6, depth: 1.5, wavelength: 8 }), standard = coil({});
  assert.ok(length(open.strands.filter((s) => s.backingMesh)) < 0.75 * length(standard.strands.filter((s) => s.backingMesh)), 'wider spacing, fewer lines');
  const paused = coil({ pause: true });
  const at = paused.gcode.indexOf('M600');
  assert.ok(at > 0, 'a colour change');
  const lastMesh = paused.moves.findLastIndex((m) => m.extrude && /^backing-/.test(m.tag));
  const firstDesign = paused.moves.findIndex((m) => m.extrude && !/^backing-/.test(m.tag));
  assert.ok(lastMesh < firstDesign);
  assert.ok(paused.moves.slice(lastMesh, firstDesign).some((m) => /M600/.test(m.customGcode ?? '')), 'between the mesh and the design');
  assert.equal(coil({}).gcode.includes('M600'), false, 'no pause unless asked');
});

test('a zero threshold retracts before every travel, mesh and design alike', () => {
  const r = coil({}, { ...material, retraction: { ...material.retraction, min_travel: 0 } });
  for (let i = 1; i < r.moves.length; i++) if (!r.moves[i].extrude && r.moves[i - 1].extrude) assert.equal(r.moves[i].retract, 'retract', `travel after move ${i - 1}`);
});

test('a lace gets the mesh under its whole piece, green body and windows, and keeps its layer order on top', () => {
  const vector = parseSvg(fs.readFileSync(path.join(projectRoot, 'samples', 'lace-sample.svg'), 'utf8'), 'lace-sample.svg');
  const r = generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: vector.width, height: vector.height,
    vector, outline: vectorPatternRings(vector), shapeOutline: true, solidLayers: 2, extraLayers: 0, brim: 0, backing: {} });
  const h = r.cfg.t.layer_height;
  const mesh = r.strands.filter((s) => s.backingMesh);
  const piece = new PolygonBoundary(r.pieceOutline);
  assert.ok(length(mesh) > 1000);
  const pts = mesh.flatMap((s) => s.pts);
  assert.ok(pts.filter((p) => piece.contains(p.x, p.y)).length / pts.length > 0.97, 'the mesh lies in the piece');
  const solids = r.strands.filter((s) => s.name === 'Solid shape' && s.ground);
  assert.ok(Math.abs(Math.min(...solids.map(zMin)) - 3 * h) < 1e-9, 'the green body starts on top of the mesh');
  const order = r.strands.filter((s) => !s.backingMesh).map((s) => (s.name === 'Solid shape' && s.ground ? `G${s.solidLayer}` : null)).filter(Boolean);
  assert.ok(order.indexOf('G1') > order.lastIndexOf('G0'), 'the green still prints layer by layer');
});

test('a raised design stands on its own base: the mesh is left out, and the check says so', () => {
  const r = generateDesignExport({ machine, material, design: 'loop-pile', settings: { sample_width: 30, sample_height: 30 }, width: 30, height: 30, extraLayers: 0, brim: 0, backing: {} });
  assert.equal(r.strands?.some((s) => s.backingMesh) ?? false, false);
  assert.ok(r.warnings.some((w) => /backing mesh is left out/.test(w)));
});

test('without a backing nothing changes', () => {
  const r = coil(null);
  assert.equal(addBackingMesh(r, null), r);
});

test('the backing travels in links and saved files only while it is on', async () => {
  const { sanitizePrint } = await import('../src/ui/share.js');
  assert.equal('backing' in sanitizePrint({}), false);
  assert.equal('backing' in sanitizePrint({ backing: null }), false);
  assert.deepEqual(sanitizePrint({ backing: true }).backing, { spacing: 3.7, depth: 2, wavelength: 6, pause: false });
  assert.deepEqual(sanitizePrint({ backing: { spacing: '5', depth: -1, wavelength: 8, pause: true } }).backing, { spacing: 5, depth: 2, wavelength: 8, pause: true });
});
