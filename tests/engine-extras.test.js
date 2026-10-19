import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/engine/generate.js';
import { resolveConfig } from '../src/engine/params.js';
import { heightMapMargin } from '../src/engine/planner.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('stats count hops, travel length, strands and extruding moves', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  // independent recount straight from the moves
  let hops = 0, travel = 0, extruding = 0, prev = null, prevExtrude = false;
  const tags = new Set();
  for (const m of r.moves) {
    if (m.extrude) { extruding++; tags.add(m.tag); }
    if (prev && !m.extrude) {
      travel += Math.hypot(m.x - prev.x, m.y - prev.y);
      if (prevExtrude) hops++;
    }
    prevExtrude = m.extrude;
    prev = m;
  }
  assert.equal(r.stats.hops, hops);
  assert.equal(r.stats.extrudingMoves, extruding);
  assert.equal(r.stats.strands, tags.size);
  assert.ok(Math.abs(r.stats.travelMm - travel) < 1e-6);
  assert.equal(r.stats.hops, 3, 'hops occur between backing passes and loop rows only');
  assert.equal(r.stats.strands, r.stats.loops + r.base.strands.length, 'both backing passes are counted');
});

test('a loops-only print starts on the bed layer instead of floating above a missing base', () => {
  const withBase = resolveConfig(machine, material, {});
  const loopsOnly = resolveConfig(machine, material, { include_base: false });
  assert.equal(withBase.derived.loopBaseZ, 0.4);
  assert.equal(loopsOnly.derived.loopBaseZ, 0.2);
  const explicit = resolveConfig(machine, material, { include_base: false, loop_start_z: 0.6 });
  assert.equal(explicit.derived.loopBaseZ, 0.6);
});

test('the clearance height map reaches as far out as a loop can lean', () => {
  const cfg = resolveConfig(machine, material, { loop_length: 30 });
  assert.ok(heightMapMargin(cfg) >= 30);
  assert.ok(heightMapMargin(resolveConfig(machine, material, {})) >= 10);
});

test('stats expose when each move starts, so a scrubber can speak in minutes', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  const t = r.stats.moveStartSec;
  assert.equal(t.length, r.moves.length);
  assert.equal(t[0], 0);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] >= t[i - 1], `time went backwards at ${i}`);
  assert.ok(t[t.length - 1] <= r.stats.timeSec + 1e-9);
  assert.ok(t[t.length - 1] > r.stats.timeSec * 0.99, 'the last move starts near the end of the print');
});
