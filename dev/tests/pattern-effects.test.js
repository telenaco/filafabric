import test from 'node:test';
import assert from 'node:assert/strict';
import { thicknessAlong, PATTERN_EFFECTS } from '../../site/src/engine/pattern-effects.js';
import { waveLines } from '../../site/src/engine/wavegrid.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { defaultProfiles } from './helpers.js';
import { designById } from '../../site/src/ui/designs.js';
import { migrateState } from '../../site/src/ui/library.js';

test('thickness effect maps tone to flow and limits adjacent changes by distance', () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }];
  const result = thicknessAlong(points, (x) => x < 3 ? 0 : 1, { thin: 0.6, thick: 1.8, quantise: 0, maxChangePerMm: 0.25 });
  assert.deepEqual(result.map((point) => point.flow), [0.6, 0.6, 1.35, 1.6]);
  for (let i = 1; i < result.length; i++) {
    const distance = Math.hypot(result[i].x - result[i - 1].x, result[i].y - result[i - 1].y);
    assert.ok(Math.abs(result[i].flow - result[i - 1].flow) <= distance * 0.25 + 1e-9);
  }
});

test('flow over the second net is scaled to 0.85 of its bed value', () => {
  const point = [{ x: 1, y: 1 }], field = () => 1;
  const bed = thicknessAlong(point, field, { thin: 0.6, thick: 1.8, layer: 0 });
  const over = thicknessAlong(point, field, { thin: 0.6, thick: 1.8, layer: 1 });
  assert.ok(Math.abs(over[0].flow - bed[0].flow * 0.85) <= 0.025, 'the 0.05 flow quantisation is within half a step of the 0.85 over-net scale');
});

test('depth is applied per lane before clipping and chaining, not to the whole joined fabric', () => {
  const boundary = boundaryFor(40, 30);
  for (const angle of [0, 90]) {
    const options = { angle, spacing: 4, amplitude: 2, shape: 'triangle', clearance: 0.225 };
    const plain = waveLines(boundary, options);
    assert.deepEqual(waveLines(boundary, { ...options, depthAt: () => 1 }), plain);
    const shallow = waveLines(boundary, { ...options, depthAt: () => 0 });
    assert.notDeepEqual(shallow, plain);
    const points = shallow.flat();
    assert.ok(points.every((p) => boundary.contains(p.x, p.y)));
    const span = angle === 0 ? 'y' : 'x';
    assert.ok(Math.max(...points.map(p => p[span])) - Math.min(...points.map(p => p[span])) > 20, 'rows still cover the full swatch');
  }
});

test('thickness is a selectable effect for the wave and grid cards and sends flow to extrusion', () => {
  const { machine, material } = defaultProfiles();
  for (const id of ['squiggle', 'zigzag', 'crosshatch']) {
    const card = designById(id);
    assert.ok(card.patternEffects.includes('thickness'), id);
    const settings = card.sanitize({ ...card.defaults(), patternEffect: 'thickness', pattern: 'stripes' });
    const output = card.generate(machine, material, settings, {});
    assert.ok(output.gcode.includes('G1'), id);
    assert.ok(output.gcode.includes('E'), id);
    assert.ok(output.strands.flatMap((strand) => strand.pts).some((point) => point.flow !== undefined), `${id}: extrusion flow is carried by strands`);
  }
  assert.equal(PATTERN_EFFECTS.direction.label, 'Direction');
});

test('the legacy Halftone card is hidden but remains loadable from saved states', () => {
  const halftone = designById('halftone');
  assert.equal(halftone.hidden, true);
  assert.equal(halftone.status, 'ready');
  assert.equal(migrateState({ v: 4, design: 'halftone' }).design, 'halftone');
});
