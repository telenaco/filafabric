import test from 'node:test';
import assert from 'node:assert/strict';
import { bedSizeLimits, printSizeProblem } from '../src/ui/bed-size.js';
import { defaultProfiles } from './helpers.js';

test('print dimensions are constrained to the real selected printer, not a preview or tile size', () => {
  const { machine } = defaultProfiles();
  assert.deepEqual(bedSizeLimits(machine), { width: 250, height: 210 });
  assert.equal(printSizeProblem(250, 210, machine), '');
  assert.match(printSizeProblem(251, 210, machine), /does not fit/);
  assert.match(printSizeProblem(100, 211, machine), /does not fit/);
  assert.match(printSizeProblem(Infinity, 100, machine), /finite/);
  assert.match(printSizeProblem(0, 100, machine), /positive/);
  const gantry = { ...machine, bed: { width: 1000, depth: 1000 } };
  assert.equal(printSizeProblem(400, 700, gantry), '', 'larger real hardware permits a large garment');
});

test('intentional loop overhang reserves bed depth instead of allowing extrusion off the back', () => {
  const { machine } = defaultProfiles();
  assert.deepEqual(bedSizeLimits(machine, 15), { width: 250, height: 195 });
  assert.equal(printSizeProblem(250, 195, machine, 15), '');
  assert.match(printSizeProblem(250, 196, machine, 15), /loop overhang/);
});
