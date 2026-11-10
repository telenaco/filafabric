import test from 'node:test';
import assert from 'node:assert/strict';
import { regionsFromDrawing } from '../../site/src/engine/regions.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const square = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];

// A red page with a blue hole in the middle, and a black line that crosses the hole from edge to edge.
const vector = {
  name: 'bridge', width: 60, height: 60,
  paths: [square(1, 1, 59, 59), square(15, 15, 45, 45), [{ x: 5, y: 30 }, { x: 55, y: 30 }]],
  styles: [{ color: 'red', hex: '#ff0000', width: 0.4 }, { color: 'blue', hex: '#0000ff', width: 0.4 }, { color: 'other', hex: '#000000', width: 0.8 }],
};

function build(enabledRoles) {
  const zig = designById('zigzag');
  const regions = regionsFromDrawing(vector, { currentCard: 'zigzag', currentSettings: zig.defaults() })
    .map((r) => ({ ...r, enabled: enabledRoles.includes(r.role), settings: r.settings ?? zig.defaults() }));
  // the regions carry the default settings and the design card another spacing, so the build goes through the regions
  return generateDesignExport({ ...defaultProfiles(), design: 'zigzag', settings: { ...zig.defaults(), spacing: 4 }, width: 60, height: 60, outline: null, vector, regions, shapeOutline: false, extraLayers: 0, brim: 0 });
}

test('a line drawn across a hole is printed across it: it is what ties the island to the rest', () => {
  const result = build(['pattern', 'hole', 'line']);
  // the line is a straight stroke, so its strand is its two ends: it must reach both sides of the hole (x 15 to 45)
  const lineStrands = result.strands.filter((s) => /line/.test(String(s.id)));
  assert.ok(lineStrands.length > 0, 'the line is printed');
  assert.ok(lineStrands.some((s) => Math.min(...s.pts.map((p) => p.x)) < 10 && Math.max(...s.pts.map((p) => p.x)) > 50), 'it runs the whole way across, not only up to the hole');
  const spans = result.moves.some((m, i) => m.extrude && result.moves[i - 1] && Math.abs(m.y - 30) < 1 && result.moves[i - 1].x < 18 && m.x > 42);
  assert.ok(spans, 'and the printer is told to extrude across the hole in one move');
});

test('the pattern still stops at the hole: only lines cross it', () => {
  const result = build(['pattern', 'hole', 'line']);
  const patternInside = result.strands.filter((s) => !/line/.test(String(s.id)) && !/seam/.test(String(s.id)) && s.pts.some((p) => p.x > 18 && p.x < 42 && p.y > 18 && p.y < 42));
  assert.equal(patternInside.length, 0, 'no pattern strand inside the hole');
});
