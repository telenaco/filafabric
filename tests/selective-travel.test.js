import test from 'node:test';
import assert from 'node:assert/strict';
import { emitStrands, travelLiftOf } from '../src/engine/emit.js';
import { resolveConfig } from '../src/engine/params.js';
import { withFilamentSettings } from '../src/ui/filament-settings.js';
import { sanitizePrint } from '../src/ui/share.js';
import { defaultProfiles } from './helpers.js';
const p = (x, y, z = 0.2) => ({ x, y, z });
const strand = (id, pts, more = {}) => ({ id, name: id, kind: 'base', pts, ...more });
const r = { length: 1, speed: 40, deretractSpeed: 20, minTravel: 2, zHop: 0.2, liftOnRetractOnly: true, clearance: 0.2 };
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
  assert.equal(configured.minTravel, 2);
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
