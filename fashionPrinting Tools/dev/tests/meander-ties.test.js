import test from 'node:test';
import assert from 'node:assert/strict';
import { meanderTiesLayers } from '../../site/src/engine/meander.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

const pathLength = (pts) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

/** True when segments p1-p2 and p3-p4 cross at a point inside both; touching at an end does not count. */
function cross(p1, p2, p3, p4) {
  const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return side(p3, p4, p1) * side(p3, p4, p2) < 0 && side(p1, p2, p3) * side(p1, p2, p4) < 0;
}

/** How far a point is from the nearest part of the given paths. */
function distanceTo(point, paths) {
  let best = Infinity;
  for (const pts of paths) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y;
      const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(a.x + u * dx - point.x, a.y + u * dy - point.y));
    }
  }
  return best;
}

test('meander ties are a distinct native family on a backing-free output', () => {
  const built = meanderTiesLayers(boundaryFor(50, 50), { curve: 'hilbert', cell: 6, tieInterval: 6 });
  assert.deepEqual(built.families, ['curve', 'ties-designed']);
  assert.ok(built[0].some((p) => p.family === 'curve'));
  assert.ok(built[0].some((p) => p.family === 'ties-designed'));
  assert.ok(built[0].filter((p) => p.family === 'ties-designed').every((p) => p.role === 'native'));
});

test('ties are spaced by the tie interval along the curve, not placed at every rounded corner', () => {
  for (const tieInterval of [3, 6, 12]) {
    const built = meanderTiesLayers(boundaryFor(100, 100), { curve: 'hilbert', cell: 6, tieInterval });
    const curve = built[0].filter((p) => p.family === 'curve'), ties = built[0].filter((p) => p.family === 'ties-designed');
    const length = curve.reduce((sum, run) => sum + pathLength(run), 0);
    assert.ok(ties.length > 0, `interval ${tieInterval}: has ties`);
    assert.ok(ties.length <= Math.ceil(length / tieInterval), `interval ${tieInterval}: ${ties.length} ties along ${length.toFixed(0)} mm`);
  }
});

test('a tie runs straight across the gap between two folds, ends on the curve and crosses nothing', () => {
  const built = meanderTiesLayers(boundaryFor(100, 100), { curve: 'hilbert', cell: 6, tieInterval: 6 });
  const curve = built[0].filter((p) => p.family === 'curve'), ties = built[0].filter((p) => p.family === 'ties-designed');
  for (const [k, tie] of ties.entries()) {
    assert.equal(tie.length, 2, 'a tie is one straight piece');
    for (const end of tie) assert.ok(distanceTo(end, curve) < 1e-6, `tie ${k} ends on the curve`);
    const a = { x: tie[0].x + (tie[1].x - tie[0].x) * 0.01, y: tie[0].y + (tie[1].y - tie[0].y) * 0.01 };
    const b = { x: tie[1].x - (tie[1].x - tie[0].x) * 0.01, y: tie[1].y - (tie[1].y - tie[0].y) * 0.01 };
    for (const run of curve) for (let i = 1; i < run.length; i++) assert.ok(!cross(a, b, run[i - 1], run[i]), `tie ${k} crosses the curve`);
    for (const other of ties.slice(k + 1)) assert.ok(!cross(a, b, other[0], other[1]), `tie ${k} crosses another tie`);
  }
});

test('ties declare their joints, so the default prints in one flat layer held together without automatic ties', () => {
  const card = designById('meander-ties');
  const settings = card.sanitize({ ...card.defaults(), width: 100, height: 100 });
  const { construction: report, strands } = card.generate(machine, material, settings);
  assert.equal(report.crossings.total, 0, 'a tie that meets the curve end-on is a join, not a crossing');
  assert.ok(report.z.max <= 0.2 + 1e-9, `every bead lies at one layer height, not ${report.z.max} mm`);
  assert.equal(report.ties.count, 0, 'no automatic ties');
  assert.equal(report.componentsWithoutTies, 1, 'the designed ties alone hold it in one piece');
  assert.equal(shelfFromConstruction(report, { layerHeight: 0.2 }), card.shelf);
  assert.ok(strands.filter((s) => s.family === 'ties-designed').every((s) => s.role === 'native'));
});

test('every run longer than twice the tie interval has a tie', () => {
  const built = meanderTiesLayers(boundaryFor(100, 100), { curve: 'hilbert', cell: 6, tieInterval: 6 });
  const runs = built[0].filter((p) => p.family === 'curve');
  for (const run of runs) {
    if (pathLength(run) > 12) assert.ok(run.joints?.length, `run ${run.runId} (${pathLength(run).toFixed(0)} mm) has a tie`);
  }
});

test('card exports stable, non-empty G-code for the available curve presets', () => {
  const card = designById('meander-ties');
  for (const preset of card.presets) {
    const settings = card.sanitize({ ...card.defaults(), ...preset.patch });
    const a = card.generate(machine, material, settings), b = card.generate(machine, material, settings);
    assert.ok(a.strands.length);
    assert.equal(a.gcode, b.gcode);
  }
});
