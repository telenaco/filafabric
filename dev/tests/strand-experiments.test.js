import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { experimentalLayers, EXPERIMENT_IDS } from '../../site/src/engine/experimental-textiles.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { DIRECTIONS, crosshatchLayers } from '../../site/src/engine/crosshatch.js';
import { bridgeCrossings } from '../../site/src/engine/crossings.js';
import { shapeAt } from '../../site/src/engine/shapes.js';
import { defaultProfiles } from './helpers.js';
const { machine, material } = defaultProfiles();
const run = (id, patch = {}) => { const card = designById(id); return card.generate(machine, material, card.sanitize({ ...card.defaults(), width: 40, height: 40, ...patch }), {}); };

test('sliding loop controls produce channels; fused control produces none', () => {
  for (const id of ['sliding-squares', 'sliding-circles']) {
    const fused = run(id, { width: 100, height: 100, arrangement: 'fused' }), sliding = run(id, { width: 100, height: 100 });
    assert.equal(fused.construction.channels?.count ?? 0, 0);
    assert.ok(sliding.construction.channels.count > 0, id);
    assert.ok(sliding.construction.z.max > fused.construction.z.max + 1);
    assert.ok(sliding.strands.filter(s => s.role === 'channel').every(s => s.channelId), 'split channel feet retain identity');
    assert.ok(!/NaN|Infinity/.test(sliding.gcode));
    const mixed = run(id, { width: 100, height: 100, arrangement: 'mixed' });
    assert.ok(mixed.fusedCrossings > 0 && mixed.slidingCrossings > 0, 'mixed arrangement has both joint types');
    assert.equal(mixed.clearance.conflicts.length, 0, 'default mixed loops have a collision-free order');
  }
});

test('independent bridge height keeps the same apex when rounding changes', () => {
  const strands = [{ pts: [{x:0,y:5,z:.2},{x:10,y:5,z:.2}] }, { pts: [{x:5,y:0,z:.2},{x:5,y:10,z:.2}] }];
  const a = bridgeCrossings(strands, {height:1,filletRadius:.5}), b = bridgeCrossings(strands, {height:1,filletRadius:3});
  const peak = r => Math.max(...r.strands.flatMap(s => s.pts.map(p => p.z)));
  assert.equal(peak(a), peak(b));
  assert.ok(peak(bridgeCrossings(strands, {height:1.5})) > peak(a));
});

test('localized waves return to straight junctions, and four-direction grids produce four passes', () => {
  for (const x of [0, 8, 16]) assert.equal(shapeAt('trapezoid', x, {pitch:8,size:1}).v, 0);
  assert.equal(shapeAt('trapezoid', 4, {pitch:8,size:1}).v, 1);
  assert.deepEqual(DIRECTIONS['0-45-90-135'].angles, [0,45,90,135]);
  assert.equal(crosshatchLayers(boundaryFor(40,40), {directions:'0-45-90-135'}).layers.length,4);
  assert.notEqual(run('strain-wave-cells',{waves:1}).gcode, run('strain-wave-cells',{waves:2}).gcode);
});

test('experimental paths are finite, carrier-attached, in bounds and retain flow/Z in G-code', () => {
  for (const experiment of EXPERIMENT_IDS) {
    const result = run(`experiment-${experiment}`);
    assert.ok(result.strands.some(s => s.role === 'carrier'));
    assert.ok(result.strands.some(s => s.family === 'texture'));
    assert.ok(result.moves.some(m => m.extrude));
    assert.ok(!/NaN|Infinity/.test(result.gcode));
    for (const p of result.strands.flatMap(s => s.pts)) {
      assert.ok([p.x,p.y,p.z].every(Number.isFinite));
      assert.ok(p.x >= 0 && p.x <= 40 && p.y >= 0 && p.y <= 40);
      assert.ok(p.z >= .2 - 1e-7 && p.z <= 2.6 + 1e-7);
    }
    assert.equal(result.fabric.exportable, true, `${experiment}: ${result.fabric.issues}`);
  }
  assert.ok(run('experiment-slub').moves.some(m => m.flow > 1));
  assert.ok(run('experiment-drawn').moves.some(m => m.flow < .5));
  assert.ok(run('experiment-tuck').construction.z.max > .8);
  assert.ok(run('experiment-pearls',{amount:2}).stats.filamentGrams > run('experiment-pearls',{amount:1}).stats.filamentGrams);
});

test('experimental generation refuses excessive feature counts before allocating the paths', () => {
  assert.throws(() => experimentalLayers(boundaryFor(1000,1000), {spacing:4}), /Too many experimental deposits/);
});
