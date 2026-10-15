import test from 'node:test';
import assert from 'node:assert/strict';
import { halftoneLayers } from '../src/engine/halftone.js';
import { spacerStrands, pillarWeaveStrands, generateSpacer, generatePillarWeave, MAX_RINGS } from '../src/engine/pillars.js';
import { boundaryFor, layeredResult } from '../src/engine/layers.js';
import { simplifyStrands } from '../src/engine/fabric.js';
import { segmentE, moveSpeed } from '../src/engine/extrusion.js';
import { resolveConfig, ConfigError } from '../src/engine/params.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const flows = (layers) => layers.map((layer) => layer.flatMap((pts) => pts.map((p) => p.flow)));

test('a halftone net carries its picture in flow, within the range asked for, on both layers', () => {
  const b = boundaryFor(80, 60);
  const tone = (x) => x / 80;
  const { layers, extra } = halftoneLayers(b, { spacing: 3, tone, thin: 0.5, thick: 2 });
  assert.equal(layers.length, 2);
  for (const list of flows(layers)) {
    assert.ok(list.length > 100);
    assert.ok(Math.min(...list) >= 0.5 - 1e-9 && Math.max(...list) <= 2 + 1e-9);
    assert.ok(Math.max(...list) - Math.min(...list) > 1, 'the flow follows the tone across the swatch');
  }
  assert.ok(extra.halftone.lo < 0.7 && extra.halftone.hi > 1.8);
  // the same tone, the same flow: left to right it thickens
  const line = layers[0].find((pts) => pts.length > 20);
  const xs = line.map((p) => p.x);
  const fs = line.map((p) => p.flow);
  const left = fs.filter((_, i) => xs[i] < 20), right = fs.filter((_, i) => xs[i] > 60);
  if (left.length && right.length) assert.ok(right.reduce((a, c) => a + c, 0) / right.length > left.reduce((a, c) => a + c, 0) / left.length);
});

test('the complement second layer is thick where the first is thin', () => {
  const b = boundaryFor(60, 60);
  const same = flows(halftoneLayers(b, { spacing: 4, tone: () => 1, thin: 0.5, thick: 2, second: 'same' }).layers);
  const comp = flows(halftoneLayers(b, { spacing: 4, tone: () => 1, thin: 0.5, thick: 2, second: 'complement' }).layers);
  assert.ok(same[0].every((f) => f === 2) && same[1].every((f) => f === 2));
  assert.ok(comp[0].every((f) => f === 2) && comp[1].every((f) => f === 0.5));
});

test('flow reaches the G-code: thicker lines use proportionally more filament and run no faster', () => {
  const { machine, material } = defaultProfiles();
  const make = (flow) => {
    const { layers } = halftoneLayers(boundaryFor(40, 40), { spacing: 4, tone: () => 0.5, thin: flow, thick: flow });
    return layeredResult(machine, material, { width: 40, height: 40, layers });
  };
  const one = make(1), two = make(2);
  assert.ok(one.moves.every((m) => m.flow === undefined), 'nominal flow adds nothing');
  assert.ok(two.moves.some((m) => m.extrude && m.flow === 2));
  const ratio = two.stats.filamentMm / one.stats.filamentMm;
  assert.ok(ratio > 1.9 && ratio < 2.05, `filament ratio ${ratio.toFixed(3)}`);
  assert.ok(two.stats.timeSec >= one.stats.timeSec - 1e-6);
  assert.notEqual(one.gcode, two.gcode);

  const cfg = resolveConfig(machine, material, { sample_width: 40, sample_height: 40 });
  assert.equal(segmentE(10, 'base', cfg, 2), 2 * segmentE(10, 'base', cfg));
  assert.ok(moveSpeed('base', 10, 0, 0, cfg, 3) <= moveSpeed('base', 10, 0, 0, cfg));
});

test('simplifying a strand keeps the points where its flow changes', () => {
  const pts = Array.from({ length: 21 }, (_, i) => ({ x: i, y: 0, z: 0.2, flow: i < 8 ? 1 : i < 14 ? 1.5 : 2 }));
  const [s] = simplifyStrands([{ pts }]);
  assert.ok(s.pts.length >= 6 && s.pts.length < 21);
  const kept = s.pts.map((p) => p.flow);
  assert.ok(kept.includes(1) && kept.includes(1.5) && kept.includes(2));
  const plain = simplifyStrands([{ pts: pts.map(({ flow, ...p }) => p) }])[0];
  assert.equal(plain.pts.length, 2, 'without flow a straight line is two points');
});

test('the halftone card works from its pattern and is a real card', () => {
  const card = designById('halftone');
  assert.ok(card && card.status === 'ready');
  assert.ok(card.patterns.length > 5);
  const { machine, material } = defaultProfiles();
  const r = card.generate(machine, material, { ...card.defaults(), width: 60, height: 60 });
  assert.ok(r.moves.some((m) => m.flow !== undefined && m.flow !== 1));
  assert.equal(r.fabric.exportable, true);
  assert.match(card.summary(r), /halftone net/);
});

test('a spacer net: pillars on the nodes, a bottom net below and a top net above, printed layer by layer', () => {
  const b = boundaryFor(60, 60);
  const r = spacerStrands(b, { pitch: 6, layers: 4, radius: 1 });
  assert.ok(r.pillars > 50);
  assert.equal(r.rings, r.pillars * 4);
  const z = (s) => Math.min(...s.pts.map((p) => p.z));
  const order = r.strands.map(z);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1] - 0.21, `strand ${i} dips ${order[i - 1]} -> ${order[i]}`);
  const rings = r.strands.filter((s) => s.name === 'Pillars');
  assert.equal(rings.length, r.rings);
  for (const s of rings) {
    assert.ok(Math.hypot(s.pts[0].x - s.pts.at(-1).x, s.pts[0].y - s.pts.at(-1).y) < 1e-9, 'a ring is closed');
    assert.ok(new Set(s.pts.map((p) => p.z)).size === 1, 'a ring is flat');
  }
  const tops = r.strands.filter((s) => s.name === 'Top net');
  assert.ok(tops.length > 0);
  const topZ = Math.min(...tops.flatMap((s) => s.pts.map((p) => p.z)));
  const ringZ = Math.max(...rings.flatMap((s) => s.pts.map((p) => p.z)));
  assert.ok(Math.abs(topZ - ringZ - 0.2) < 1e-6, 'the top net lies one layer above the last ring');
});

test('with a pillar on every second node the top net only runs along lines of pillars', () => {
  const b = boundaryFor(60, 60);
  const every1 = spacerStrands(b, { pitch: 5, layers: 3, radius: 1, every: 1 });
  const every2 = spacerStrands(b, { pitch: 5, layers: 3, radius: 1, every: 2 });
  assert.ok(every2.pillars < every1.pillars / 3);
  assert.ok(every2.top < every1.top);
  assert.equal(every2.bottom, every1.bottom, 'the bottom net is on the bed, so it stays whole');
});

test('a spacer net prints as one fabric with nothing passing below a printed strand', () => {
  const { machine, material } = defaultProfiles();
  const r = generateSpacer(machine, material, { width: 60, height: 60, pitch: 6, layers: 4, radius: 1 });
  assert.equal(r.fabric.components, 1);
  assert.equal(r.fabric.reversedCrossings, 0);
  assert.equal(r.fabric.outsideSegments, 0);
  assert.equal(r.fabric.exportable, true);
  assert.ok(r.fabric.maxSlopeDeg <= 25);
  assert.ok(r.stats.loops > 20);
  assert.ok(r.report.crossings > 0 && r.report.between > 0);
});

test('a pillar weave locks fibres round pillars: the side alternates from layer to layer and row to row', () => {
  const b = boundaryFor(60, 60);
  const w = pillarWeaveStrands(b, { pitch: 6, layers: 3, radius: 0.8 });
  assert.ok(w.pillars > 40);
  const fibre = (k) => w.strands.filter((s) => s.name === 'Fibre' && Math.abs(s.pts[0].z - (k + 1) * 0.2) < 1e-9);
  assert.equal(fibre(0).length, fibre(1).length);
  // pick a pillar and read the side each layer's fibre passes it on
  const ring = w.strands.find((s) => s.name === 'Pillars' && s.pts[0].z < 0.25);
  const cx = ring.pts.reduce((a, p) => a + p.x, 0) / ring.pts.length, cy = ring.pts.reduce((a, p) => a + p.y, 0) / ring.pts.length;
  const side = (k) => {
    let best = null;
    for (const s of fibre(k)) for (const p of s.pts) {
      if (Math.abs(p.x - cx) < 0.3 && Math.abs(p.y - cy) < 3 && (!best || Math.abs(p.x - cx) < Math.abs(best.x - cx))) best = p;
    }
    return Math.sign(best.y - cy);
  };
  assert.notEqual(side(0), 0);
  assert.equal(side(0), -side(1));
  assert.equal(side(1), -side(2));
});

test('a pillar weave prints as one fabric, layer by layer, and refuses an impossible number of rings', () => {
  const { machine, material } = defaultProfiles();
  const r = generatePillarWeave(machine, material, { width: 60, height: 60, pitch: 5, layers: 4 });
  assert.equal(r.fabric.components, 1);
  assert.equal(r.fabric.reversedCrossings, 0);
  assert.equal(r.fabric.exportable, true);
  const lows = r.strands.map((s) => s.pts[0].z);
  for (let i = 1; i < lows.length; i++) assert.ok(lows[i] >= lows[i - 1] - 1e-9, 'the nozzle never goes back down');
  assert.throws(() => generatePillarWeave(machine, material, { width: 240, height: 200, pitch: 3, layers: 14 }), (e) => e instanceof ConfigError && /rings/.test(e.message));
  assert.ok(MAX_RINGS >= 5000);
});

test('an outline keeps pillars and fibre inside it', () => {
  const { machine, material } = defaultProfiles();
  const outline = [Array.from({ length: 48 }, (_, i) => ({ x: 30 + 26 * Math.cos((2 * Math.PI * i) / 48), y: 30 + 26 * Math.sin((2 * Math.PI * i) / 48) }))];
  for (const make of [generateSpacer, generatePillarWeave]) {
    const r = make(machine, material, { width: 60, height: 60, pitch: 6, layers: 3, outline });
    assert.equal(r.fabric.outsideSegments, 0);
    assert.ok(r.stats.loops > 5);
  }
});
