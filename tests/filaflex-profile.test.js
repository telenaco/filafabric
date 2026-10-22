import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/engine/params.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, loadProfile, retractingMaterial } from './helpers.js';

// Current defaults follow the user's supplied Prusa comparison. Retraction mechanics opt in explicitly below.

const { machine, material } = defaultProfiles();
const zigzag = (mat = material, outline = null) => generateDesignExport({ machine, material: mat, design: 'zigzag', settings: designById('zigzag').defaults(), width: 40, height: 30, outline, extraLayers: 0, brim: 2 });

test('Filaflex Foamy follows the Prusa reference: 240 C, no filament retraction or optional hop, travel 180 mm/s, seam gap 0.2 mm', () => {
  const cfg = resolveConfig(machine, material);
  assert.deepEqual(cfg.derived.temperatures, { first: 240, print: 240, bed: 50 });
  const r = cfg.derived.retraction;
  assert.deepEqual({ length: r.length, speed: r.speed, deretractSpeed: r.deretractSpeed, restartExtra: r.restartExtra, zHop: r.zHop, minTravel: r.minTravel, seamGap: r.seamGap },
    { length: 0, speed: 35, deretractSpeed: 25, restartExtra: 0, zHop: 0, minTravel: 1, seamGap: 0.2 });
  assert.equal(cfg.t.speed_travel, 180, 'the profile\'s travel speed');
  assert.equal(resolveConfig(machine, material, { speed_travel: 120 }).t.speed_travel, 120, 'a design\'s own travel speed still wins');
});

test('required travels retain clearance and short flat travels can omit the optional hop', () => {
  const outline = Array.from({ length: 6 }, (_, i) => { const x = i * 7; return [{ x, y: 0 }, { x: x + 5, y: 0 }, { x: x + 5, y: 30 }, { x, y: 30 }]; });
  const r = zigzag(retractingMaterial(material), outline);
  let top = -Infinity;
  const over = [];
  for (let i = 1; i < r.moves.length; i++) {
    const m = r.moves[i], prev = r.moves[i - 1];
    if (prev.extrude) top = Math.max(top, prev.z);
    // the lift that starts each travel (not the approach from the prime line, before anything is printed)
    if (!m.extrude && prev.extrude && r.moves[i + 1] && !r.moves[i + 1].extrude) over.push(m.z - top);
  }
  assert.ok(over.length > 5);
  // (the one move from the brim into the pattern starts from the pattern's own approach, 0.2 mm up: 0.4 mm over)
  assert.ok(over.every((d) => d >= -1e-9 && d < 0.4 + 1e-9), `lifts of ${[...new Set(over.map((d) => d.toFixed(2)))].join(', ')} mm`);
  assert.ok(over.some((d) => Math.abs(d - 0.2) < 1e-9), 'required lifts retain 0.2 mm clearance');
  assert.ok(Math.max(...r.moves.filter((m) => !m.extrude).slice(2).map((m) => m.z)) < 3, 'no 3 mm lifts');
  assert.match(r.gcode, /^G1 X[\d.]+ Y[\d.]+ F10800$/m, 'travels at 180 mm/s');
  assert.match(r.gcode, /^M109 S240/m);
  assert.match(r.gcode, /^G1 E-1 F2400$/m);
  assert.match(r.gcode, /^G1 E1 F1200$/m);
});

test('a closed loop stops 0.2 mm short of its own start before a travel (the brim\'s loops here)', () => {
  const r = zigzag();
  const brim = r.strands.filter((s) => s.brim);
  assert.ok(brim.length >= 2);
  const loop = r.moves.filter((m) => m.tag === brim[0].id && m.extrude);
  const start = brim[0].pts[0], end = loop.at(-1);
  assert.ok(Math.abs(Math.hypot(end.x - start.x, end.y - start.y) - 0.2) < 0.02, `ends ${Math.hypot(end.x - start.x, end.y - start.y).toFixed(3)} mm from its start`);
});

test('a filament that explicitly sets zero lift does not gain a 3 mm hop, and one with no travel speed of its own keeps 150 mm/s', () => {
  const ninja = loadProfile('materials', 'ninjatek-ninjaflex-85a');
  assert.equal(ninja.retraction.z_hop, 0);
  const cfg = resolveConfig(machine, ninja);
  assert.equal(cfg.t.speed_travel, ninja.travel_speed_hint);
  const r = zigzag(ninja);
  assert.ok(!r.moves.some((m) => !m.extrude && m.z > 3), 'zero optional lift does not become 3 mm');
  assert.equal(cfg.derived.retraction.seamGap, 0, 'and its loops close as drawn');
  const noHint = { ...ninja, travel_speed_hint: undefined };
  assert.equal(resolveConfig(machine, noHint).t.speed_travel, 150, 'the studio\'s own default');
});
