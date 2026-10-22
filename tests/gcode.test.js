import test from 'node:test';
import assert from 'node:assert/strict';
import { writeGcode, preflight, PreflightError, GcodeWriter } from '../src/engine/gcode.js';
import { resolveConfig } from '../src/engine/params.js';
import { plan } from '../src/engine/planner.js';
import { computeStats } from '../src/engine/stats.js';
import { defaultProfiles, retractingMaterial } from './helpers.js';
import { scene } from './scene.js';

test('sub-resolution extrusion is carried into the next moving segment instead of emitted as a stationary push', () => {
  const { machine, material } = defaultProfiles();
  const writer = new GcodeWriter(resolveConfig(machine, material));
  const move = (x, extrude) => ({ x, y: 10, z: .2, extrude, cls: extrude ? 'base' : 'travel' });
  writer.move(move(10, false));
  assert.deepEqual(writer.move(move(10.0003, true)), []);
  const line = writer.move(move(10.1, true)).find(line => line.startsWith('G1'));
  assert.match(line, /X/);
  const totalE = Number(/\bE([\d.]+)/.exec(line)[1]);
  const expected = .1 * .2 * (.42 - .2 * (1 - Math.PI / 4)) * 1.15 * .95 / (Math.PI * (1.75 / 2) ** 2);
  assert.ok(Math.abs(totalE - expected) < .000005, 'the tiny segment E is preserved in cumulative rounding');
});

test('printing temperature changes once when extrusion leaves the bed layer, never for a travel hop', () => {
  const { machine, material } = defaultProfiles();
  material.temperature = { first_layer: 215, print: 210 };
  const writer = new GcodeWriter(resolveConfig(machine, material));
  assert.ok(writer.header().some((line) => line.startsWith('M109 S215')));
  const move = (z, extrude = false) => ({ x: 10, y: 10, z, extrude, cls: extrude ? 'supported' : 'travel' });
  assert.ok(!writer.move(move(5)).some((line) => line.startsWith('M104')));
  assert.ok(!writer.move(move(0.2, true)).some((line) => line.startsWith('M104')));
  assert.ok(writer.move(move(0.4, true)).some((line) => line.startsWith('M104 S210')));
  assert.ok(!writer.move(move(0.6, true)).some((line) => line.startsWith('M104')));
  assert.ok(!writer.move(move(0.2, true)).some((line) => line.startsWith('M104')), 'does not toggle temperatures at crossings');
});

test('equal first-layer and printing temperatures produce no body temperature command', () => {
  const { machine, material } = defaultProfiles();
  const writer = new GcodeWriter(resolveConfig(machine, material));
  assert.ok(!writer.move({ x: 10, y: 10, z: 1, extrude: true, cls: 'supported' }).some((line) => line.startsWith('M104')));
});

function build(over = {}, profiles = {}) {
  const s = scene({ sample_width: 20, sample_height: 20, ...over }, profiles);
  const planned = plan(s.cfg, s.base, s.tiled.placements, s.boundary);
  const stats = computeStats(planned.moves, s.cfg, s.tiled.placements);
  return { ...s, moves: planned.moves, gcode: writeGcode(planned.moves, s.cfg, { stats }) };
}

/** Minimal G-code reader: absolute XYZ, relative E, modal F. */
function readBody(gcode) {
  const lines = gcode.split('\n');
  const start = lines.indexOf('; BODY START');
  const end = lines.indexOf('; BODY END');
  assert.ok(start >= 0 && end > start, 'body markers missing');
  let x = NaN, y = NaN, z = NaN, f = NaN;
  const out = [];
  for (const raw of lines.slice(start + 1, end)) {
    const line = raw.split(';')[0].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts[0] !== 'G1') { out.push({ cmd: parts[0], raw: line }); continue; }
    const g = {};
    for (const p of parts.slice(1)) g[p[0]] = Number(p.slice(1));
    const prev = { x, y, z };
    if (g.X !== undefined) x = g.X;
    if (g.Y !== undefined) y = g.Y;
    if (g.Z !== undefined) z = g.Z;
    if (g.F !== undefined) f = g.F;
    out.push({ cmd: 'G1', x, y, z, prev, e: g.E, f, moved: g.X !== undefined || g.Y !== undefined || g.Z !== undefined });
  }
  return out;
}

test('header limits, M221 S100 before any extrusion, S/T acceleration for the MK3S', () => {
  const { gcode } = build();
  assert.match(gcode, /^M201 X1000 Y1000 Z200 E5000/m);
  assert.match(gcode, /^M203 X200 Y200 Z12 E120/m);
  assert.match(gcode, /^M204 S1250 T1250/m);
  assert.match(gcode, /^M205 X8 Y8 Z0\.4 E4\.5/m);
  assert.match(gcode, /^M204 S800/m);
  assert.doesNotMatch(gcode, /M204 P/);
  assert.doesNotMatch(gcode, /M221 S95/);
  const lines = gcode.split('\n');
  const flow = lines.findIndex((l) => l.startsWith('M221 S100'));
  const firstE = lines.findIndex((l) => /^G1 .*E[0-9.]+/.test(l));
  assert.ok(flow >= 0 && firstE > flow);
  assert.match(gcode, /^M83 /m);
  assert.match(gcode, /^M862\.3 P "MK3S"/m);
});

test('every parameter and the seed are recorded as comments', () => {
  const { gcode } = build({ random_seed: 9 });
  assert.match(gcode, /^; param random_seed = 9$/m);
  assert.match(gcode, /^; param loop_width = 6$/m);
  assert.match(gcode, /^; machine: prusa-mk3s$/m);
  assert.match(gcode, /^; material: filaflex-95-foamy$/m);
});

test('output is deterministic', () => {
  assert.equal(build().gcode, build().gcode);
});

test('round trip: bounds, feedrates, Z-component limit and total E', () => {
  const { gcode, cfg, moves } = build();
  const body = readBody(gcode);
  const o = cfg.derived.origin;
  let totalE = 0;
  let maxF = 0;
  for (const g of body) {
    if (g.cmd !== 'G1' || !g.moved) continue;
    assert.ok(g.x >= o.x - 1e-3 && g.x <= o.x + 20 + 1e-3, `x ${g.x}`);
    assert.ok(g.y >= o.y - 1e-3 && g.y <= o.y + 20 + 1e-3, `y ${g.y}`);
    assert.ok(g.z <= 210);
    maxF = Math.max(maxF, g.f);
    const ds = Math.hypot(g.x - g.prev.x, g.y - g.prev.y, g.z - g.prev.z);
    if (ds > 1e-6) assert.ok(((g.f / 60) * Math.abs(g.z - g.prev.z)) / ds <= 12 + 0.1, `vz at z=${g.z}`);
    if (g.e !== undefined) totalE += g.e;
  }
  assert.ok(maxF <= 200 * 60);
  assert.ok(totalE > 0);
  assert.ok(moves.length > 0);
});

test('retract and unretract are emitted as relative E moves with the material speeds, the prime with its extra push', () => {
  const material = retractingMaterial(defaultProfiles().material);
  const { gcode } = build({ retraction_length: 2.5 }, { material });
  const lines = gcode.split('\n');
  assert.ok(lines.some((l) => /^G1 E-2\.5 F2400$/.test(l)));
  assert.ok(lines.some((l) => /^G1 E2\.5 F1200$/.test(l)), 'Foamy pushes back what it pulled');
  const s = scene({ sample_width: 20, sample_height: 20, retraction_length: 2.5 }, { material });
  s.cfg.derived.retraction = { ...s.cfg.derived.retraction, restartExtra: 0.3 };
  const pushed = writeGcode(plan(s.cfg, s.base, s.tiled.placements, s.boundary).moves, s.cfg).split('\n');
  assert.ok(pushed.some((l) => /^G1 E2\.8 F1200$/.test(l)), 'and an extra push on top when the filament asks for one');
});

test('fans: M106 only when a class asks for one, M107 otherwise', () => {
  const off = build().gcode.split('\n').filter((l) => l.startsWith('M106'));
  assert.equal(off.length, 0);
  const on = build({ fan_unsupported: 50 }).gcode.split('\n');
  assert.ok(on.some((l) => /^M106 S128/.test(l)));
  assert.ok(on.some((l) => l.startsWith('M107')));
});

test('Review Focus: a sample larger than the bed is refused with a clear message', () => {
  const s = scene({ sample_width: 300, sample_height: 20, include_loops: false });
  const planned = plan(s.cfg, s.base, [], s.boundary);
  assert.throws(() => writeGcode(planned.moves, s.cfg), (e) => {
    assert.ok(e instanceof PreflightError);
    assert.match(e.message, /does not fit the bed/);
    return true;
  });
});

test('Review Focus: an extreme lift is clamped on Z speed and stays inside max_z', () => {
  const { gcode, cfg } = build({ loop_z_lift: 30 });
  const body = readBody(gcode);
  let maxZ = 0;
  for (const g of body) {
    if (g.cmd !== 'G1' || !g.moved) continue;
    maxZ = Math.max(maxZ, g.z);
    const ds = Math.hypot(g.x - g.prev.x, g.y - g.prev.y, g.z - g.prev.z);
    if (ds > 1e-6) assert.ok(((g.f / 60) * Math.abs(g.z - g.prev.z)) / ds <= 12 + 0.1);
  }
  assert.ok(maxZ > 30 && maxZ <= cfg.machine.bed.max_z);
});

test('preflight catches out-of-range Z and bad temperatures', () => {
  const s = scene({ sample_width: 20, sample_height: 20 });
  const errors = preflight([{ x: 1, y: 1, z: 500, cls: 'base', extrude: true }], s.cfg);
  assert.ok(errors.some((e) => /printable volume/.test(e)));
});

test('Bambu-style P R T acceleration is emitted when the machine asks for it', () => {
  const s = scene({ sample_width: 20, sample_height: 20 }, {
    machine: { ...defaultProfiles().machine, accel_syntax: 'P_R_T' },
  });
  const planned = plan(s.cfg, s.base, s.tiled.placements, s.boundary);
  const gcode = writeGcode(planned.moves, s.cfg);
  assert.match(gcode, /^M204 P1250 R1250 T1500/m);
  assert.match(gcode, /^M204 P800/m);
});
