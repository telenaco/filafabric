import test from 'node:test';
import assert from 'node:assert/strict';
import { emitStrands, travelLiftOf } from '../src/engine/emit.js';
import { resolveConfig } from '../src/engine/params.js';
import { withFilamentSettings } from '../src/ui/filament-settings.js';
import { sanitizePrint } from '../src/ui/share.js';
import { defaultProfiles } from './helpers.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
const p = (x, y, z = 0.2) => ({ x, y, z });
const strand = (id, pts, more = {}) => ({ id, name: id, kind: 'base', pts, ...more });
const r = { length: 1, speed: 40, deretractSpeed: 20, minTravel: 2, zHop: 0.2, liftOnRetractOnly: true, clearance: 0.2, nozzleTipRadius: 0.2, nozzleConeSlope: 0, geometryClearance: 0, airRadii: { rising: 0.2, falling: 0.2, unsupported: 0.2 } };
const pair = (distance, options = {}) => emitStrands([strand('a', [p(0, 0), p(5, 0)]), strand('b', [p(5, distance), p(0, distance)])], { retraction: r, ...options });

test('short planar travel omits the optional hop and retraction', () => {
  const moves = pair(0.5), next = moves.slice(moves.findIndex((m) => m.extrude) + 1);
  assert.ok(next.filter((m) => !m.extrude).every((m) => Math.abs(m.z - 0.2) < 1e-9));
  assert.equal(moves.filter((m) => m.retract).length, 0);
});
test('a travel at the threshold retains a balanced retract and hop', () => {
  const moves = pair(2);
  assert.equal(moves.filter((m) => m.retract === 'retract').length, 1);
  assert.equal(moves.filter((m) => m.retract === 'unretract').length, 1);
  assert.ok(moves.some((m) => !m.extrude && m.z >= 0.4));
});
test('short travel still clears previously raised geometry and filament-change pauses', () => {
  const raised = emitStrands([strand('a', [p(0, 0), p(1, 0, 0.6), p(2, 0)]), strand('b', [p(2.5, 0), p(3, 0)])], { retraction: r });
  assert.ok(raised.slice(4).some((m) => !m.extrude && m.z >= 0.8 - 1e-9));
  const paused = emitStrands([strand('a', [p(0, 0), p(5, 0)]), strand('b', [p(5, 0), p(6, 0)], { pauseBefore: true })], { retraction: r });
  assert.ok(paused.find((m) => m.customGcode?.startsWith('M600')).z >= 0.4);
  assert.equal(paused.filter((m) => m.retract === 'retract').length, 1);
  assert.equal(paused.filter((m) => m.retract === 'unretract').length, 1);
});
test('zero optional lift is honored instead of becoming a three millimetre hop', () => {
  assert.equal(travelLiftOf({ zHop: 0 }), 0);
  assert.ok(pair(3, { retraction: { ...r, zHop: 0 } }).filter((m) => !m.extrude).every((m) => m.z === 0.2));
});
test('travel threshold uses the nozzle position after a seam gap', () => {
  const moves = emitStrands([strand('a', [p(0, 0), p(5, 0), p(5, 5), p(0, 5), p(0, 0)]), strand('b', [p(0, 2.1), p(5, 2.1)])], { retraction: r, seam: { gap: 0.2 } });
  assert.equal(moves.filter((m) => m.retract).length, 0, 'the actual travel is 1.9 mm');
});
test('wipe and subsequent travel share one balanced retraction based on the wipe end', () => {
  const moves = emitStrands([strand('a', [p(0, 0), p(5, 0)]), strand('b', [p(6, 0), p(10, 0)])], { retraction: r, seam: { wipe: 1 } });
  assert.equal(moves.filter((m) => m.retract === 'unretract').length, 1);
  assert.ok(Math.abs(moves.reduce((n, m) => n + (m.pull ?? 0) + (m.retract === 'retract' ? r.length : 0), 0) - 1) < 1e-9);
});
test('Foamy selective travel threshold is adjustable and survives saved print settings', () => {
  const { machine, material } = defaultProfiles();
  const configured = resolveConfig(machine, material).derived.retraction;
  assert.equal(configured.minTravel, 1);
  assert.equal(configured.liftOnRetractOnly, true);
  const print = sanitizePrint({ retractMinTravel: 3.5, travelLift: 0 });
  const changed = resolveConfig(machine, withFilamentSettings(material, print)).derived.retraction;
  assert.equal(changed.minTravel, 3.5);
  assert.equal(changed.zHop, 0);
});

test('a wipe ending at the next start does not leave filament retracted', () => {
  const moves = emitStrands([strand('a', [p(0, 0), p(5, 0)]), strand('b', [p(4, 0), p(10, 0)])], { retraction: { ...r, minTravel: 0 }, seam: { wipe: 1 } });
  assert.equal(moves.reduce((n, m) => n + (m.pull ?? 0), 0), 0);
  assert.equal(moves.filter((m) => m.retract).length, 0);
});

test('distant raised material does not force hops on unrelated short planar travel', () => {
  const moves = emitStrands([strand('high', [p(0, 0), p(1, 0, 3), p(2, 0)]), strand('flat', [p(20, 0), p(25, 0)]), strand('next', [p(25, 0.5), p(20, 0.5)])], { retraction: r });
  const from = moves.findIndex(m => m.tag === 'flat');
  const to = moves.findIndex(m => m.tag === 'next');
  assert.ok(moves.slice(from + 1, to).filter(m => !m.extrude).every(m => m.z === 0.2));
});

test('a short travel crossing raised material still lifts above the local printed height', () => {
  const moves = emitStrands([strand('ridge', [p(0, -1), p(0, 0, 0.8), p(0, 1)]), strand('flat', [p(-2, 0), p(-0.5, 0)]), strand('next', [p(0.5, 0), p(2, 0)])], { retraction: r });
  const from = moves.findIndex(m => m.tag === 'flat'), to = moves.findIndex(m => m.tag === 'next');
  assert.ok(moves.slice(from + 1, to).some(m => !m.extrude && m.z >= 1 - 1e-9));
});

test('a short travel across a known void retracts and clears it', () => {
  const moves = pair(0.5, { allowTravel: () => false });
  assert.equal(moves.filter(m => m.retract === 'retract').length, 1);
  assert.equal(moves.filter(m => m.retract === 'unretract').length, 1);
  assert.ok(moves.slice(3).some(m => !m.extrude && m.z >= 0.4));
});

test('an empty planar opening does not cause a cosmetic hop when filament retraction is disabled', () => {
  const moves = pair(.5, { allowTravel: () => false, retraction: { ...r, length: 0, zHop: 0 } });
  const lastA = moves.findLastIndex(m => m.tag === 'a'), firstB = moves.findIndex(m => m.tag === 'b');
  assert.ok(moves.slice(lastA+1, firstB).every(m => m.z === .2));
  assert.equal(moves.filter(m => m.retract).length, 0);
});

test('zero retraction still clears raised material and filament-change pauses across an opening', () => {
  for (const pauseBefore of [false, true]) {
    const moves=emitStrands([strand('ridge',[p(0,-1),p(0,0,.8),p(0,1)]),strand('a',[p(-2,0),p(-.5,0)]),strand('b',[p(.5,0),p(2,0)],{pauseBefore})],{retraction:{...r,length:0,zHop:0},allowTravel:()=>false});
    const a=moves.findLastIndex(m=>m.tag==='a'),b=moves.findIndex(m=>m.tag==='b');
    assert.ok(moves.slice(a+1,b).some(m=>m.z>=1-1e-9),'actual printed obstacle clearance remains');
    assert.equal(moves.filter(m=>m.retract).length,0);
  }
});

test('the travel sweep accounts for the nozzle and a variable-width printed bead', () => {
  const ridge = strand('ridge', [p(0, -1), { ...p(0, 0, 0.8), width: 1.4 }, { ...p(0, 1), width: 1.4 }]);
  const moves = emitStrands([ridge, strand('flat', [p(-2, 1.7), p(-0.5, 1.7)]), strand('next', [p(0.5, 1.7), p(2, 1.7)])], { retraction: { ...r, nozzleRadius: 0.2, travelRadius: 0.425 } });
  const from = moves.findIndex(m => m.tag === 'flat'), to = moves.findIndex(m => m.tag === 'next');
  assert.ok(moves.slice(from + 1, to).some(m => !m.extrude && m.z >= 1 - 1e-9), '0.7 mm gap is within the 0.9 mm nozzle-plus-bead envelope');
  assert.deepEqual(moves.filter(m => m.tag === 'ridge').map(m => m.width), [1.4, 1.4], 'preview retains the physical bead width');
});

test('per-strand boundaries force clearance and a balanced retract across a narrow opening', () => {
  const ring = (x0, y0, x1, y1) => [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];
  const boundary = new PolygonBoundary([ring(0, 0, 5, 5), ring(2.2, 1, 2.3, 4)]);
  const moves = emitStrands([strand('a', [p(1, 2), p(2, 2)]), strand('b', [p(2.5, 2), p(4, 2)], { travelBoundary: boundary })], { retraction: { ...r, zHop: 0 } });
  assert.equal(moves.filter(m => m.retract === 'retract').length, 1);
  assert.equal(moves.filter(m => m.retract === 'unretract').length, 1);
  assert.ok(moves.slice(3).some(m => !m.extrude && m.z >= 0.4), 'zero cosmetic lift cannot remove required clearance');
});

const travelPastRidge = (retraction, ridgeY, ridgeZ, point = {}) => {
  const moves = emitStrands([
    strand('ridge', [{ ...p(-1, ridgeY, ridgeZ), cls: 'unsupported', ...point }, { ...p(1, ridgeY, ridgeZ), cls: 'unsupported', ...point }]),
    strand('flat', [p(-2, 0), p(-0.25, 0)]), strand('next', [p(0.25, 0), p(2, 0)]),
  ], { retraction, seam: { gap: 0, coast: 0, wipe: 0 } });
  const from = moves.findIndex(m => m.tag === 'flat'), to = moves.findIndex(m => m.tag === 'next');
  return moves.slice(from + 1, to).filter(m => !m.extrude);
};

test('travel clears a thick free strand even when the flat bead is narrower', () => {
  const { machine, material } = defaultProfiles();
  const cfg = resolveConfig(machine, { ...material, flow: { ...material.flow, foam_expansion: 1 } }, { free_strand_diameter: 1.2, nozzle_tip_radius: 0, nozzle_cone_half_angle: 0.001, clearance: 0 });
  const moves = travelPastRidge(cfg.derived.retraction, 0.6, 0.8);
  assert.ok(moves.some(m => m.z >= 1.6 - 1e-9), 'lift clears the 0.6 mm round strand radius above its 0.8 mm centerline');
});

test('raised travel clearance includes foam, class flow and square-root local flow', () => {
  const { machine, material } = defaultProfiles();
  const cfg = resolveConfig(machine, material, { flow_nonplanar: 150, flow_unsupported: 200, nozzle_tip_radius: 0, nozzle_cone_half_angle: 0.001, clearance: 0 });
  assert.ok(Math.abs(cfg.derived.retraction.airRadii?.rising - 0.2 * 1.5) < 1e-9);
  assert.ok(Math.abs(cfg.derived.retraction.airRadii?.unsupported - 0.2 * Math.sqrt(3)) < 1e-9);
  const moves = travelPastRidge(cfg.derived.retraction, 0.6, 0.8, { flow: 2, width: 0.1 });
  assert.ok(moves.some(m => m.z >= 1 + 0.2 * Math.sqrt(6) - 1e-9), 'flat width metadata cannot shrink a round raised strand');
});

test('a nozzle cone beside a tall strand cannot pass at a lower travel height', () => {
  const { machine, material } = defaultProfiles();
  const cfg = resolveConfig(machine, { ...material, flow: { ...material.flow, foam_expansion: 1 } }, { free_strand_diameter: 0.4, nozzle_tip_radius: 0.6, nozzle_cone_half_angle: 45, clearance: 0.3 });
  const moves = travelPastRidge(cfg.derived.retraction, 2, 2);
  assert.ok(moves.some(m => m.z >= 2.4 - 1e-9), 'the cone reaches 2 mm sideways above a 0.2 mm nozzle-tip plane');
});

test('an emitter without physical nozzle metadata retains conservative global-height clearance', () => {
  const moves = travelPastRidge({ length: 1, minTravel: 2, zHop: 0.2, liftOnRetractOnly: true }, 20, 2);
  assert.ok(moves.some(m => m.z >= 2.2 - 1e-9), 'unknown cone dimensions cannot justify a lower local travel');
});
