import test from 'node:test';
import assert from 'node:assert/strict';
import { emitStrands } from '../src/engine/emit.js';
import { resolveConfig } from '../src/engine/params.js';
import { writeGcode } from '../src/engine/gcode.js';
import { computeStats } from '../src/engine/stats.js';
import { defaultProfiles } from './helpers.js';

// How a strand ends before a travel (emit.js `seam`): a gap before a loop's own start, coasting, and a wipe that pulls
// the retraction in as it goes over what was just printed.

const { machine, material } = defaultProfiles();
const cfg = resolveConfig(machine, material, { sample_width: 60, sample_height: 40 });
const retraction = cfg.derived.retraction;
const square = (x, y, s = 10) => ({ id: `sq-${x}`, kind: 'base', pts: [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]].map(([px, py]) => ({ x: px, y: py, z: 0.2 })) });
const line = (x, y) => ({ id: `line-${x}`, kind: 'base', pts: [{ x, y, z: 0.2 }, { x: x + 20, y, z: 0.2 }] });
const length = (moves) => moves.reduce((n, m, i) => (i ? n + Math.hypot(m.x - moves[i - 1].x, m.y - moves[i - 1].y) : 0), 0);
const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

test('with no seam set, or all of it 0, the moves are as they were; with none set the filament\'s seam gap applies', () => {
  const strands = [square(0, 0), square(20, 0), line(0, 30)];
  const closesAsDrawn = { ...retraction, seamGap: 0 };
  const plain = emitStrands(strands, { retraction: closesAsDrawn });
  assert.deepEqual(emitStrands(strands, { retraction: closesAsDrawn, seam: { gap: 0, coast: 0, wipe: 0 } }), plain);
  // Filaflex's own: its loops stop 0.2 mm short of their start before a travel
  assert.equal(retraction.seamGap, 0.2);
  const loop = emitStrands(strands, { retraction }).filter((m) => m.tag === 'sq-0');
  assert.ok(Math.abs(loop.at(-1).y - 0.2) < 1e-9 && loop.at(-1).x === 0, 'the first square ends at (0, 0.2)');
});

test('a gap stops a loop short of its own start, and a coast moves over the last of it without pushing filament', () => {
  const moves = emitStrands([square(0, 0), square(20, 0)], { retraction, seam: { gap: 0.5, coast: 1 } });
  const loop = moves.filter((m) => m.tag === 'sq-0');
  const printed = loop.filter((m) => m.extrude), coasted = loop.filter((m) => !m.extrude);
  // 40 mm round: 38.5 printed (from its start), 1 coasted, 0.5 left open before the start
  assert.ok(Math.abs(length([{ x: 0, y: 0 }, ...printed]) - 38.5) < 1e-6);
  assert.ok(Math.abs(length([printed.at(-1), ...coasted]) - 1) < 1e-6);
  assert.ok(Math.abs(coasted.at(-1).y - 0.5) < 1e-6 && coasted.at(-1).x === 0, 'it ends 0.5 mm short of (0, 0)');
  assert.ok(coasted.every((m) => m.cls === 'base'), 'coasting at the loop\'s own speed');
  assert.equal(moves.find((m) => m.retract === 'retract')?.retract, 'retract', 'the travel still retracts');
});

test('a wipe goes on round the loop over its start, pulling the whole retraction in, and the lift retracts nothing more', () => {
  const moves = emitStrands([square(0, 0), square(20, 0)], { retraction, seam: { wipe: 3 } });
  const k = moves.findIndex((m) => m.pull > 0);
  const wipe = moves.filter((m) => m.pull > 0);
  assert.ok(wipe.length > 0);
  assert.ok(Math.abs(wipe.reduce((n, m) => n + m.pull, 0) - retraction.length) < 1e-9, 'all of the retraction, over the wipe');
  assert.ok(Math.abs(length([moves[k - 1], ...wipe]) - 3) < 1e-6, '3 mm of wipe');
  assert.ok(near(wipe.at(-1), { x: 3, y: 0 }), 'on round the loop: over its start at (0, 0) to (3, 0)');
  assert.equal(moves.filter((m) => m.retract === 'retract').length, 0, 'the lift pulls nothing more');
  assert.equal(moves.filter((m) => m.retract === 'unretract').length, 1, 'and the next strand primes it back');
  const lift = moves[k + wipe.length];
  assert.ok(near(lift, wipe.at(-1)) && lift.z > 0.2, 'the lift goes up where the wipe ended');
});

test('a line is wiped back along itself', () => {
  const moves = emitStrands([line(0, 0), line(0, 20)], { retraction, seam: { wipe: 2 } });
  const wipe = moves.filter((m) => m.pull > 0);
  assert.ok(near(wipe.at(-1), { x: 18, y: 0 }), `back from (20, 0) to (18, 0), not (${wipe.at(-1).x}, ${wipe.at(-1).y})`);
});

test('the last strand, and a strand too short for its ending, are left as they are', () => {
  const tiny = { id: 'tiny', kind: 'base', pts: [{ x: 0, y: 0, z: 0.2 }, { x: 1.2, y: 0, z: 0.2 }] };
  const moves = emitStrands([tiny, square(20, 0)], { retraction, seam: { gap: 0.5, coast: 1, wipe: 3 } });
  assert.equal(moves.filter((m) => m.tag === 'tiny' && !m.extrude).length, 0, 'not coasted: it would keep less than 1 mm');
  assert.equal(moves.filter((m) => m.tag === 'sq-20' && !m.extrude).length, 0, 'the last strand closes as drawn');
  assert.ok(moves.slice(-1)[0].extrude && near(moves.at(-1), { x: 20, y: 0 }));
});

test('in the G-code the wipe pulls the filament in at the retraction speed while it moves, and it is all primed back', () => {
  const moves = emitStrands([square(0, 0), square(20, 0)], { retraction, seam: { gap: 0.5, coast: 1, wipe: 3 } });
  const gcode = writeGcode(moves, cfg);
  const body = gcode.split('; BODY START')[1].split('; BODY END')[0].split('\n');
  const pulls = body.filter((l) => /^G1 X[\d.]+.* E-[\d.]+/.test(l) || /^G1 Y[\d.]+.* E-[\d.]+/.test(l));
  assert.ok(pulls.length > 0, 'wipe moves carry E-');
  assert.ok(Math.abs(pulls.reduce((n, l) => n - Number(/E(-[\d.]+)/.exec(l)[1]), 0) - retraction.length) < 1e-4);
  assert.equal(body.filter((l) => /^G1 E-/.test(l)).length, 0, 'no separate retraction');
  assert.ok(body.some((l) => l === `G1 E${retraction.length + retraction.restartExtra} F${Math.round(retraction.deretractSpeed * 60)}`), 'primed back with its extra');
  // 3 mm of wipe pulling 4 mm at 65 mm/s: 48.75 mm/s along it
  const f = Number(/F(\d+)/.exec(pulls.find((l) => /F\d+/.test(l)))[1]);
  assert.equal(f, Math.round(((3 * retraction.speed) / retraction.length) * 60));
  const stats = computeStats(moves, cfg, []);
  assert.ok(stats.timeSec > computeStats(emitStrands([square(0, 0), square(20, 0)], { retraction }), cfg, []).timeSec - 1, 'timed');
});
