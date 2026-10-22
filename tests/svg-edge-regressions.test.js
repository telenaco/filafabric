import test from 'node:test';
import assert from 'node:assert/strict';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { clipPolyline } from '../src/engine/layers.js';
import { waveLines } from '../src/engine/wavegrid.js';
import { contactGraph, connectStrands, finishAtPrintedBoundary, segmentInside, clipStrands } from '../src/engine/fabric.js';
import { stackStrands } from '../src/engine/stack.js';
import { importProfiles } from '../src/engine/profile-import.js';
import { defaultProfiles } from './helpers.js';
import { DESIGNS } from '../src/ui/designs.js';
import { composeSvgLines } from '../src/engine/svg-lines.js';
import { exportPanel } from '../src/engine/panel.js';
import { normalizeStartModes } from '../src/engine/gcode-modes.js';

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const edgeDistance = (p, rings) => Math.min(...rings.flatMap((r) => r.map((a, i) => {
  const b = r[(i + 1) % r.length], dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
})));

test('polyline clipping reaches the exact edge and retains both sides of a narrow hole', () => {
  const b = new PolygonBoundary([rect(2.13, 0, 7.87, 10), rect(4.11, 4, 4.19, 6)]);
  const parts = clipPolyline([{ x: 0, y: 5 }, { x: 10, y: 5 }], b, 0);
  assert.equal(parts.length, 2);
  assert.ok(Math.abs(parts[0][0].x - 2.13) < 1e-6);
  assert.ok(Math.abs(parts[0].at(-1).x - 4.11) < 1e-6);
  assert.ok(Math.abs(parts[1][0].x - 4.19) < 1e-6);
  assert.ok(Math.abs(parts[1].at(-1).x - 7.87) < 1e-6);
});

test('zigzag waves reach slanted outlines rather than ending at the straight lane intersection', () => {
  const rings = [[{ x: 0, y: 10 }, { x: 15, y: 0 }, { x: 30, y: 10 }, { x: 15, y: 20 }]];
  const lines = waveLines(new PolygonBoundary(rings), { spacing: 3, amplitude: 3, wavelength: 6, shape: 'triangle' });
  assert.ok(lines.length);
  for (const pts of lines) for (const p of [pts[0], pts.at(-1)]) assert.ok(edgeDistance(p, rings) < 1e-6, JSON.stringify(p));
});

test('thin flow strands have real gaps and receive a full-width structural tie', () => {
  const strands = [2, 2.3].map((y, i) => ({ id: `thin-${i}`, pts: [{ x: 1, y, z: 0.2, flow: 0.25 }, { x: 9, y, z: 0.2, flow: 0.25 }] }));
  assert.equal(contactGraph(strands).components, 2);
  const repaired = connectStrands(strands, new PolygonBoundary([rect(0, 0, 10, 10)]));
  assert.ok(repaired.ties > 0);
  assert.equal(contactGraph(repaired.strands).components, 1);
  for (const s of repaired.strands.filter((s) => s.name === 'Structural tie')) assert.ok(s.pts.every((p) => (p.flow ?? 1) === 1));
  assert.equal(contactGraph(strands.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, flow: 1 })) }))).components, 1);
});

test('open paths overlap printed outer and hole borders without crossing to the other side', () => {
  const b = new PolygonBoundary([rect(0, 0, 20, 20), rect(8, 8, 12, 12)]);
  const line = { id: 'short', pts: [{ x: 0.225, y: 10, z: 0.4 }, { x: 7.775, y: 10, z: 0.4 }] };
  const [out] = finishAtPrintedBoundary([line], b);
  assert.ok(Math.abs(out.pts[0].x) < 1e-6);
  assert.ok(Math.abs(out.pts.at(-1).x - 8) < 1e-6);
  assert.ok(segmentInside(out.pts[0], out.pts.at(-1), b));
  const closed = { pts: [...rect(2, 2, 5, 5), { x: 2, y: 2 }] };
  assert.equal(finishAtPrintedBoundary([closed], b)[0], closed);
});

test('composed zigzag ends reach the SVG border after the shared inset step', () => {
  const { machine, material } = defaultProfiles(), d = DESIGNS.find((d) => d.id === 'zigzag');
  const rings = [[{ x: 1, y: 15 }, { x: 15, y: 1 }, { x: 29, y: 15 }, { x: 15, y: 29 }]];
  const vector = { name: 'diamond.svg', width: 30, height: 30, paths: [[...rings[0], rings[0][0]]], styles: [{ color: 'red', width: 0.45 }] };
  const r = composeSvgLines(d.generate(machine, material, { ...d.defaults(), width: 30, height: 30 }, { outline: rings }), vector, { clipLines: false });
  const ends = r.strands.filter((s) => s.id.startsWith('pattern-')).flatMap((s) => [s.pts[0], s.pts.at(-1)]);
  assert.equal(ends.length, 4, 'one continuous strand per mesh pass, two ends each');
  assert.ok(ends.every((p) => edgeDistance(p, rings) < 1e-6));
  assert.ok(r.strands.filter((s) => s.id.startsWith('pattern-')).every((s) => s.pts.slice(1).every((p, i) => segmentInside(s.pts[i], p, new PolygonBoundary(rings)))));
});

test('SVG bridges update the connectivity report and remove obsolete separate-piece warnings', () => {
  const { machine, material } = defaultProfiles(), d = DESIGNS.find((d) => d.id === 'zigzag');
  const rings = [rect(1, 1, 12, 29), rect(18, 1, 29, 29)];
  const vector = { name: 'joined-islands.svg', width: 30, height: 30, paths: [...rings.map((r) => [...r, r[0]]), [{ x: 8, y: 15 }, { x: 22, y: 15 }]], styles: [{ color: 'red', width: 0.45 }, { color: 'red', width: 0.45 }, { color: 'other', width: 0.45 }] };
  const before = d.generate(machine, material, { ...d.defaults(), width: 30, height: 30 }, { outline: rings });
  assert.equal(before.report.components, 2);
  const after = composeSvgLines(before, vector, { clipLines: false });
  assert.equal(after.fabric.components, 1);
  assert.equal(after.report.components, 1);
  assert.ok(!after.warnings.some((s) => /separate fabric regions/.test(s)));
});

test('direct stacking rejects an excessive or non-finite copy count before allocating', () => {
  const s = [{ id: 'one', pts: [{ x: 1, y: 1, z: 0.2 }, { x: 2, y: 1, z: 0.2 }] }];
  for (const count of [1e12, Infinity, NaN]) assert.throws(() => stackStrands(s, count), /layers|moves/i);
  assert.deepEqual(stackStrands([], 1e12), []);
});

test('a rejected thick-flow segment does not reconnect adjacent thin-flow runs', () => {
  const b = new PolygonBoundary([rect(0, 0, 10, 10)]);
  const s = { pts: [0.25, 0.25, 1.8, 0.25].map((flow, i) => ({ x: i + 1, y: 0.1, z: 0.2, flow })) };
  const clipped = clipStrands([s], b, 0.225);
  assert.equal(clipped.length, 2);
  assert.deepEqual(clipped.map((s) => s.pts.map((p) => p.x)), [[1, 2], [3, 4]]);
});

test('imported startup restores absolute XYZ and relative E before prime and body', () => {
  const input = 'bed_shape = 0x0,200x0,200x200,0x200\nmax_print_height = 200\nnozzle_diameter = 0.4\nstart_gcode = G90\\nM83\\nG28\\nM109 S[first_layer_temperature]\\nG91\\nM82\nend_gcode = M104 S0\\nM140 S0';
  const { machines } = importProfiles(input, 'modal.ini');
  const lines = machines[0].start_gcode;
  const prime = lines.indexOf('{prime_line}');
  const lastMode = (list, pattern) => list.filter((l) => pattern.test(l)).at(-1).trim().split(/\s/)[0];
  assert.equal(lastMode(lines.slice(0, prime), /^\s*G9[01]\b/), 'G90');
  assert.equal(lastMode(lines.slice(0, prime), /^\s*M8[23]\b/), 'M83');
  assert.equal(lastMode(lines, /^\s*G9[01]\b/), 'G90');
  assert.equal(lastMode(lines, /^\s*M8[23]\b/), 'M83');
});

test('an existing prime macro and later modal changes are both normalized', () => {
  const lines = normalizeStartModes(['G91', 'M82', '{prime_line}', 'G91', 'M82']);
  assert.deepEqual(lines, ['G91', 'M82', 'G90 ; absolute coordinates', 'M83 ; relative E', '{prime_line}', 'G91', 'M82', 'G90 ; absolute coordinates', 'M83 ; relative E']);
  const safe = ['G90', 'M83', '{prime_line}'];
  assert.deepEqual(normalizeStartModes(safe), safe);
});

test('SVG design preview crops a full-size drawing without shrinking its coordinates', () => {
  const { machine, material } = defaultProfiles(), d = DESIGNS.find((d) => d.id === 'svgdesign');
  const vector = { name: 'wide.svg', width: 1000, height: 1000, paths: [[{ x: 10, y: 20 }, { x: 900, y: 20 }], [{ x: 700, y: 700 }, { x: 900, y: 700 }]] };
  const r = d.generate(machine, material, { ...d.defaults(), width: 100, height: 100, mode: 'outline', backing: 'none' }, { vector, vectorSize: [1000, 1000] });
  assert.equal(r.svgDesign.sample, false);
  assert.ok(r.strands.length > 0);
  assert.ok(r.strands.every((s) => s.pts.every((p) => Math.abs(p.y - 20) < 1e-7)));
  assert.ok(r.strands.some((s) => s.pts.some((p) => p.x > 99)));
});

test('SVG design panel exports the actual document once instead of sample hearts in every section', async () => {
  const { machine, material } = defaultProfiles(), d = DESIGNS.find((d) => d.id === 'svgdesign');
  const vector = { name: 'single-line.svg', width: 60, height: 30, paths: [[{ x: 2, y: 7 }, { x: 58, y: 7 }]] };
  let text = '';
  const r = await exportPanel({ machine, material, design: 'svgdesign', settings: { ...d.defaults(), mode: 'outline', backing: 'none' }, brim: 0, width: 60, height: 30, repeat: 30, vector }, { write: async (s) => { text += s; } });
  assert.equal(r.sections, 2);
  const sections = text.slice(text.indexOf('; texture section 1'), text.indexOf('; BODY END'));
  assert.doesNotMatch(sections, /\bE\d/, 'no sample geometry in either texture section');
  // The 60 x 30 mm document is centred on the 250 x 210 mm bed: its one line remains (2,7) to (58,7).
  // Zero filament retraction means no optional hop on this unobstructed approach.
  assert.match(text, /; BODY START\nG1 X97 Y97 Z0\.2 F10800\nG1 X153 E/);
});
