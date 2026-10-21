import test from 'node:test';
import assert from 'node:assert/strict';
import { waveLines, waveValue, WAVE_SHAPES } from '../src/engine/wavegrid.js';
import { generateCoilTextile } from '../src/engine/coil.js';
import { backingLines, backingStack } from '../src/engine/backing.js';
import { meanderLayers } from '../src/engine/meander.js';
import { boundaryFor } from '../src/engine/layers.js';
import { findCrossings } from '../src/engine/crossings.js';
import { fitLanes } from '../src/engine/repeats.js';
import { DESIGNS, ESSENTIALS, designById, galleryGroups } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const box = boundaryFor(60, 60);
const flat = (lines) => lines.flatMap((pts) => pts);

test('the three waves swing between -1 and 1 and a half-wave on is the mirror of the wave', () => {
  for (const shape of WAVE_SHAPES) {
    let hi = -Infinity, lo = Infinity;
    for (let t = 0; t < 1; t += 0.01) {
      const v = waveValue(shape, t);
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
      assert.ok(Math.abs(waveValue(shape, t + 0.5) + v) < 1e-9, `${shape} at ${t}`);
    }
    assert.ok(hi > 0.99 && lo < -0.99, shape);
  }
});

test('a lane swings by exactly the amplitude, and a square wave steps straight up and down', () => {
  for (const shape of WAVE_SHAPES) {
    const lines = waveLines(box, { spacing: 20, amplitude: 2, wavelength: 8, shape });
    // away from the ends, where the lanes are joined by short jogs
    const ys = flat(lines).filter((p) => p.x > 3 && p.x < 57).map((p) => p.y);
    assert.ok(lines.length >= 1);
    // lanes about 20 mm apart from one edge to the other, a full swing in: each swings 2 mm either side of its centre
    const lanes = fitLanes(0.3 + 2, 60 - 0.3 - 2, 20);
    for (const c of lanes) {
      const near = ys.filter((y) => Math.abs(y - c) < 3);
      assert.ok(Math.max(...near) - c > 1.9 && Math.max(...near) - c < 2.05, `${shape} up at ${c}`);
      assert.ok(c - Math.min(...near) > 1.9 && c - Math.min(...near) < 2.05, `${shape} down at ${c}`);
    }
  }
  const square = waveLines(box, { spacing: 20, amplitude: 2, wavelength: 8, shape: 'square' });
  const steps = flat(square).filter((p, i, all) => i > 0 && Math.abs(p.x - all[i - 1].x) < 1e-6 && Math.abs(p.y - all[i - 1].y) > 0.3);
  assert.ok(steps.length > 10, 'vertical steps');
});

test('with every other lane half a wave along, the peaks meet at half the spacing and cross beyond it', () => {
  const cross = (amplitude) => {
    const lines = waveLines(box, { spacing: 4, amplitude, wavelength: 8, shape: 'triangle', laneShift: 0.5 });
    return findCrossings(lines.map((pts) => ({ pts })), { strandWidth: 0.45, mergeDistance: 1e-6 }).found.length;
  };
  assert.ok(cross(2.6) > 30, 'beyond half the spacing: they cross');
  assert.ok(cross(1.4) === 0, 'short of half the spacing: they never meet');
});

test('lines stay inside an outline, and lanes are joined into long strands', () => {
  const outline = [Array.from({ length: 48 }, (_, i) => ({ x: 30 + 25 * Math.cos((2 * Math.PI * i) / 48), y: 30 + 25 * Math.sin((2 * Math.PI * i) / 48) }))];
  const b = boundaryFor(60, 60, outline);
  const lines = waveLines(b, { spacing: 3, amplitude: 1.8, wavelength: 6, shape: 'sine', laneShift: 0.5 });
  const pts = flat(lines);
  assert.ok(pts.length > 500);
  assert.ok(pts.filter((p) => !b.contains(p.x, p.y)).length / pts.length < 0.02);
  assert.ok(lines.length < 12, `${lines.length} strands: lanes were not joined`);
});

test('Zigzag mesh: two layers that cross each other, side by side or crossed', () => {
  const card = designById('zigzag');
  const { machine, material } = defaultProfiles();
  assert.ok(card && card.status === 'ready');
  assert.equal(card.controls.some((c) => c.kind === 'pattern'), false, 'no patterns');
  assert.equal(card.controls.some((c) => c.kind === 'shape'), false, 'no strand shapes');
  assert.equal(card.controls.some((c) => c.key === 'direction'), false, 'which way it lies on the plate is not a choice');
  for (const mode of ['parallel', 'cross']) {
    const r = card.generate(machine, material, { ...card.defaults(), width: 60, height: 60, mode });
    assert.equal(r.layerCount, 2);
    assert.ok(r.report.between > 20, `${mode}: the layers cross`);
    assert.equal(r.fabric.components, 1);
    assert.equal(r.fabric.exportable, true);
  }
  // the way the lines run: over stretches of about 15 mm, do they travel further in x or in y?
  const dominant = (lines) => {
    let along = 0, across = 0;
    for (const pts of lines) {
      for (let i = 0; i + 30 < pts.length; i += 30) {
        const win = pts.slice(i, i + 30);
        const xs = win.map((p) => p.x), ys = win.map((p) => p.y);
        along += Math.max(...xs) - Math.min(...xs);
        across += Math.max(...ys) - Math.min(...ys);
      }
    }
    return along > across ? 'x' : 'y';
  };
  // side by side both layers run along x; crossed the second runs along y
  const runs = (mode, layer) => {
    const strands = card.generate(machine, material, { ...card.defaults(), width: 60, height: 60, mode }).strands;
    return dominant(strands.filter((st) => st.layer === layer).map((st) => st.pts));
  };
  assert.equal(runs('parallel', 0), 'x');
  assert.equal(runs('parallel', 1), 'x');
  assert.equal(runs('cross', 0), 'x');
  assert.equal(runs('cross', 1), 'y');
});

test('a single layer of zigzag rows that meet is the Coil with a zigzag shape: neighbouring rows sit half a wave apart', () => {
  for (const shape of ['zigzag', 'wave', 'square']) {
    const touching = generateCoilTextile({ width: 60, height: 60, shape, size: 1.5, pitch: 6, rowOverlap: 0 });
    const crossing = generateCoilTextile({ width: 60, height: 60, shape, size: 1.5, pitch: 6, rowOverlap: 0.2 });
    assert.equal(touching.strands.length, 1, `${shape}: one strand`);
    // rows of a lane 3 mm apart: the peaks of one row reach the troughs of the next, never short of them
    const pts = touching.strands[0].pts;
    const centre = (y) => Math.round((y - touching.rowPitch / 2) / touching.rowPitch);
    const rows = new Map();
    for (const p of pts) {
      const k = centre(p.y);
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k).push(p);
    }
    const keys = [...rows.keys()].sort((p, q) => p - q);
    const mid = keys[Math.floor(keys.length / 2)];
    let nearest = Infinity;
    for (const p of rows.get(mid)) for (const q of rows.get(mid + 1) ?? []) {
      if (Math.abs(p.x - q.x) < 6) nearest = Math.min(nearest, Math.hypot(p.x - q.x, p.y - q.y));
    }
    assert.ok(nearest < 0.45, `${shape}: neighbouring rows come within a bead of each other (${nearest.toFixed(2)} mm)`);
    assert.ok(crossing.crossings > touching.crossings, `${shape}: more overlap, more crossings`);
    assert.ok(crossing.crossings > 100, `${shape}: the rows cross`);
  }
  const card = designById('coil');
  const preset = card.presets.find((p) => p.id === 'zigzag-cells');
  assert.ok(preset, 'the Coil offers it as a preset');
  assert.equal(preset.patch.shape, 'zigzag');
  assert.equal(designById('zigzag-single'), undefined, 'no separate single-layer card');
});

test('the essentials are real, ready cards and come first', () => {
  assert.deepEqual([...ESSENTIALS], ['zigzag', 'squiggle', 'coil', 'starlattice', 'dipweave', 'halftone', 'meander', 'turing', 'svgdesign', 'bubbles', 'voronoi']);
  // Crosshatch & isogrid is kept in the code and left out of the list
  assert.equal(designById('crosshatch').hidden, true);
  assert.equal(designById('crosshatch').status, 'ready');
  assert.equal(ESSENTIALS.includes('crosshatch'), false);
  for (const id of ESSENTIALS) assert.equal(designById(id)?.status, 'ready', id);
});

test('a hidden card leaves the gallery but still opens: Drawing & infill, for now', () => {
  const { essentials, others } = galleryGroups();
  const shown = [...essentials, ...others].map((d) => d.id);
  assert.equal(designById('svgdesign').hidden, true);
  assert.equal(designById('svgdesign').status, 'ready', 'a link or a saved file still opens it');
  assert.equal(shown.includes('svgdesign'), false);
  assert.equal(shown.includes('crosshatch'), false);
  assert.deepEqual(essentials.map((d) => d.id), ESSENTIALS.filter((id) => id !== 'svgdesign'), 'the other essentials keep their order');
  assert.ok(others.length > 10 && others.every((d) => !ESSENTIALS.includes(d.id)));
  assert.equal(designById('zigzag-mesh').name, 'Advanced zigzag mesh');
  assert.equal(designById('zigzag-mesh').status, 'preset');
});

test('where a Start-from row only repeated a choice, the choice carries the companions and the row is gone', () => {
  for (const id of ['meander', 'starlattice', 'conformal', 'truchet', 'parquet', 'flowlines', 'crosshatch', 'auxetic']) {
    const card = designById(id);
    assert.equal(card.controls.some((c) => c.kind === 'presets'), false, `${id} still has a Start-from row`);
    assert.ok(card.presets.length > 0, `${id} keeps its presets for tests and saved settings`);
  }
  const star = designById('starlattice').controls.find((c) => c.key === 'tiling');
  assert.deepEqual(star.options.find((o) => o.id === 'hexagon').patch, { size: 6, angle: 60 });
  assert.deepEqual(star.options.find((o) => o.id === 'octagon').patch, { size: 5, angle: 67.5 });
  const meander = designById('meander').controls.find((c) => c.key === 'curve');
  assert.equal(meander.options.find((o) => o.id === 'tsp').patch.pattern, 'noise');
  assert.equal(meander.options.find((o) => o.id === 'gosper').patch.angle, 60);
  // the cards that kept their recipes still have the row
  for (const id of ['coil', 'halftone', 'svgdesign', 'spacer']) assert.equal(designById(id).controls.some((c) => c.kind === 'presets'), true, id);
});

test('the meander and Turing stripes are held by a gyroid backing unless straight lines are asked for', () => {
  const b = boundaryFor(60, 60);
  const gyroid = backingLines(b, { style: 'gyroid', angle: 45, spacing: 5 });
  const straight = backingLines(b, { style: 'straight', angle: 45, spacing: 5 });
  assert.notEqual(JSON.stringify(gyroid), JSON.stringify(straight));
  // a gyroid line is not straight: its direction keeps changing
  const turns = (lines) => lines.filter((pts) => {
    let min = Infinity, max = -Infinity;
    for (let i = 2; i < pts.length; i++) {
      const a = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x), c = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const d = Math.abs(Math.atan2(Math.sin(c - a), Math.cos(c - a)));
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    return max > 0.02;
  }).length;
  assert.ok(turns(gyroid) > 0 && turns(straight) < turns(gyroid) + 1);
  // the engine's own default is unchanged, so saved results and tests that call it keep their numbers
  assert.equal(JSON.stringify(meanderLayers(b, { curve: 'hilbert' }).layers[1]), JSON.stringify(meanderLayers(b, { curve: 'hilbert', backing: 'straight' }).layers[1]));
  for (const id of ['meander', 'turing']) {
    const card = designById(id);
    assert.equal(card.defaults().backing, 'wave', id);
    assert.ok(card.controls.some((c) => c.kind === 'choice' && c.key === 'backing'), id);
    assert.equal(card.sanitize({ backing: 'plaid' }).backing, 'wave');
    assert.equal(card.sanitize({ backing: 'gyroid' }).backing, 'gyroid');
    assert.equal(card.sanitize({ backing: 'straight' }).backing, 'straight');
  }
});

test('every tile has a card or a preset target, and the list can be built from the registry', () => {
  const ids = new Set(DESIGNS.map((d) => d.id));
  for (const id of ESSENTIALS) assert.ok(ids.has(id));
  assert.ok(DESIGNS.some((d) => d.id === 'zigzag-mesh' && d.opens.design === 'squiggle'));
});

test('the backing wave has a depth and a length you set, and a second backing is a third layer', () => {
  const b = boundaryFor(60, 60);
  const swing = (depth) => {
    const lines = backingLines(b, { style: 'wave', angle: 0, spacing: 20, depth, wavelength: 8 });
    const ys = lines.flat().filter((p) => p.x > 3 && p.x < 57).map((p) => p.y);
    // around one lane in the middle (whole repeats place the lanes from one edge to the other, a full swing in)
    const lanes = fitLanes(0.3 + depth, 60 - 0.3 - depth, 20);
    const mid = lanes[Math.floor(lanes.length / 2)];
    const near = ys.filter((y) => Math.abs(y - mid) < depth + 1);
    return Math.max(...near) - Math.min(...near);
  };
  assert.ok(swing(3) > swing(1) + 3, 'a deeper wave swings further');
  assert.ok(Math.abs(swing(1.5) - 3) < 0.15, 'twice the depth from crest to trough');
  const one = backingStack(b, { style: 'wave', angle: 45, spacing: 5, depth: 2, wavelength: 10 }, 'one');
  const two = backingStack(b, { style: 'wave', angle: 45, spacing: 5, depth: 2, wavelength: 10 }, 'two');
  assert.equal(one.length, 1);
  assert.equal(two.length, 2);
  assert.notEqual(JSON.stringify(two[0]), JSON.stringify(two[1]));
  for (const id of ['meander', 'turing']) {
    const card = designById(id);
    const { machine, material } = defaultProfiles();
    const layers = (s) => card.generate(machine, material, { ...card.defaults(), width: 60, height: 60, ...s }).layerCount;
    assert.equal(layers({ backingLayers: 'one' }), 2, id + ': the first layer and one backing');
    assert.equal(layers({ backingLayers: 'two' }), 3, id + ': a third layer');
    const depthOf = (backingDepth) => JSON.stringify(card.generate(machine, material, { ...card.defaults(), width: 60, height: 60, backingDepth }).strands.slice(-3).map((s) => s.pts.length));
    assert.notEqual(depthOf(1), depthOf(5), id + ': the depth changes the backing');
    assert.ok(card.controls.some((c) => c.kind === 'sliders' && typeof c.when === 'function'), id + ': wave depth shows only for a wave');
  }
});
