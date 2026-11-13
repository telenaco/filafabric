import test from 'node:test';
import assert from 'node:assert/strict';
import { regionsFromDrawing } from '../../site/src/engine/regions.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { PolygonBoundary } from '../../site/src/engine/boundary.js';
import { analyzeFabric, segmentContact } from '../../site/src/engine/fabric.js';

const square = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];

// A red page with a blue hole in the middle, and a black line that crosses the hole from edge to edge.
const vector = {
  name: 'bridge', width: 60, height: 60,
  paths: [square(1, 1, 59, 59), square(15, 15, 45, 45), [{ x: 5, y: 30 }, { x: 55, y: 30 }]],
  styles: [{ color: 'red', hex: '#ff0000', width: 0.4 }, { color: 'blue', hex: '#0000ff', width: 0.4 }, { color: 'other', hex: '#000000', width: 0.8 }],
};

function build(enabledRoles, drawing = vector) {
  const zig = designById('zigzag');
  const regions = regionsFromDrawing(drawing, { currentCard: 'zigzag', currentSettings: zig.defaults() })
    .map((r) => ({ ...r, enabled: enabledRoles.includes(r.role), settings: r.settings ?? zig.defaults() }));
  // the regions carry the default settings and the design card another spacing, so the build goes through the regions
  return generateDesignExport({ ...defaultProfiles(), design: 'zigzag', settings: { ...zig.defaults(), spacing: 4 }, width: 60, height: 60, outline: null, vector: drawing, regions, shapeOutline: false, extraLayers: 0, brim: 0 });
}

test('a line drawn across a hole is printed across it: it is what ties the island to the rest', () => {
  const result = build(['pattern', 'hole', 'line']);
  // the line is a straight stroke, so its strand is its two ends: it must reach both sides of the hole (x 15 to 45)
  const lineStrands = result.strands.filter((s) => /line/.test(String(s.id)));
  assert.ok(lineStrands.length > 0, 'the line is printed');
  assert.ok(lineStrands.some((s) => Math.min(...s.pts.map((p) => p.x)) < 10 && Math.max(...s.pts.map((p) => p.x)) > 50), 'it runs the whole way across, not only up to the hole');
  const spans = result.moves.some((m, i) => m.extrude && result.moves[i - 1] && Math.abs(m.y - 30) < 1 && result.moves[i - 1].x < 18 && m.x > 42);
  assert.ok(spans, 'and the printer is told to extrude across the hole in one move');
  assert.equal(result.fabric.outsideSegments, 0, 'the bridge is inside the page');
});

test('an open stroke in the Pattern role still respects the hole boundary', () => {
  const result = build(['pattern', 'hole'], { ...vector, styles: [...vector.styles.slice(0, 2), { ...vector.styles[0] }] });
  const lines = result.strands.filter((s) => /line/.test(String(s.id)));
  assert.ok(lines.length > 0, 'the open stroke is still printed outside the hole');
  assert.ok(lines.every((s) => s.pts.every((p) => p.x <= 15) || s.pts.every((p) => p.x >= 45)));
});

test('per-strand page checks still report Line segments that leave the page', () => {
  const boundary = new PolygonBoundary([square(0, 0, 60, 60), square(15, 15, 45, 45)]);
  const page = new PolygonBoundary([square(0, 0, 60, 60)]);
  const strand = (id, x0, x1) => ({ id, pts: [{ x: x0, y: 30, z: 0.2 }, { x: x1, y: 30, z: 0.2 }] });
  const bridge = strand('bridge', 5, 55);
  const beyondPage = strand('beyond-page', 5, 65);
  const pattern = strand('pattern', 5, 55);
  const report = analyzeFabric([bridge, beyondPage, pattern], {
    boundary,
    boundaryForStrand: (s) => s === pattern ? boundary : page,
  });
  assert.equal(report.outsideSegments, 2, 'only the off-page line and the pattern crossing the hole are outside');
});

test('the pattern still stops at the hole: only lines cross it', () => {
  const result = build(['pattern', 'hole', 'line']);
  const patternInside = result.strands.filter((s) => !/line/.test(String(s.id)) && !/seam/.test(String(s.id)) && s.pts.some((p) => p.x > 18 && p.x < 42 && p.y > 18 && p.y < 42));
  assert.equal(patternInside.length, 0, 'no pattern strand inside the hole');
});

test('an SVG cutout and its enclosed red island get printed rims without filling the gap', () => {
  const drawing = { ...vector, paths: [...vector.paths, square(24, 24, 36, 36)],
    styles: [vector.styles[0], { ...vector.styles[1], width: 1 }, vector.styles[2], vector.styles[0]] };
  const result = build(['pattern', 'hole'], drawing);
  const rims = result.strands.filter(s => s.role === 'hole-rim');
  const outer = rims.filter(s => s.pts.some(p => p.x < 15));
  const island = rims.filter(s => s.pts.every(p => p.x > 24 && p.x < 36 && p.y > 24 && p.y < 36));
  for (const outlines of [outer, island]) {
    assert.ok(outlines.length, 'each side of the cutout has its own outline');
    assert.ok(outlines.some(rim => result.strands.some(s => s.role === 'native' && s.layer === rim.layer &&
      [s.pts[0], s.pts.at(-1)].some(end => rim.pts.slice(1).some((p, i) =>
        segmentContact(end, end, rim.pts[i], p).distance < result.cfg.t.extrusion_width / 2)))),
    'pattern endpoints reach their rim');
  }
  assert.ok(rims.every(s => s.pts.every(p => p.width === result.cfg.t.extrusion_width)));
  assert.ok(result.moves.some(m => m.extrude && m.tag.startsWith('hole-rim-') && m.width > 0));
  assert.ok(result.strands.every(s => s.pts.every(p => !(p.x > 16 && p.x < 23 && p.y > 16 && p.y < 44))));
  assert.match(result.gcode, /; Hole rims:/);
});

test('a hole stays open with its rim set to zero', () => {
  const mod = designById('zigzag');
  const settings = mod.defaults();
  const regions = regionsFromDrawing(vector, { currentCard: mod.id, currentSettings: settings });
  regions.find(r => r.role === 'hole').holeRimWidth = 0;
  const result = generateDesignExport({ ...defaultProfiles(), design: mod.id, settings, vector, regions, width: 60, height: 60 });
  assert.ok(!result.strands.some(s => s.role === 'hole-rim'));
  assert.ok(result.strands.filter(s => !s.id.includes('line')).every(s => s.pts.every(p => !(p.x > 16 && p.x < 44 && p.y > 16 && p.y < 44))));
});

test('a fill-only SVG cutout receives a one-pass rim by default', () => {
  const drawing = { ...vector, styles: [vector.styles[0], { ...vector.styles[1], width: 0 }, vector.styles[2]] };
  const result = build(['pattern', 'hole'], drawing);
  const rims = result.strands.filter(s => s.role === 'hole-rim');
  const layers = new Set(rims.map(s => s.layer));
  assert.ok(layers.size > 0);
  assert.equal(rims.length, layers.size);
});
