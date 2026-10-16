import test from 'node:test';
import assert from 'node:assert/strict';
import { describeFabric, fixCandidates, problemScore, describeChanges } from '../src/ui/fix-geometry.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const clean = { exportable: true, components: 1, reversedCrossings: 0, maxSlopeDeg: 10, outsideSegments: 0, issues: [] };

test('the check\'s findings are said plainly, with what each means for the print', () => {
  assert.match(describeFabric({ ...clean, exportable: false, components: 3 }), /3 pieces that don't touch, so it would fall apart/);
  assert.match(describeFabric({ ...clean, exportable: false, maxSlopeDeg: 31.4 }), /climb at 31°, steeper than the 25°/);
  assert.match(describeFabric({ ...clean, exportable: false, outsideSegments: 1 }), /A bit of strand sticks out past the outline/);
  assert.match(describeFabric({ ...clean, exportable: false, outsideSegments: 4 }), /4 bits of strand stick out/);
  assert.match(describeFabric({ ...clean, exportable: false, reversedCrossings: 2 }), /2 crossings have to pass under a strand that is already printed/);
  assert.match(describeFabric({ ...clean, exportable: false }), /Nothing fits/);
});

test('a passing fabric scores 0, and fewer or smaller problems score lower', () => {
  assert.equal(problemScore(clean), 0);
  assert.equal(problemScore(null), Infinity);
  const pieces = problemScore({ ...clean, exportable: false, components: 3 });
  const onePiece = problemScore({ ...clean, exportable: false, components: 2 });
  const stray = problemScore({ ...clean, exportable: false, outsideSegments: 1 });
  assert.ok(pieces > onePiece && onePiece > stray && stray > 0);
  assert.ok(problemScore({ ...clean, exportable: false }) > 0, 'not exportable for an uncounted reason is still a problem');
});

const sliders = [{ key: 'spacing', label: 'Line spacing', unit: 'mm' }, { key: 'size', label: 'Loop size', unit: 'mm' }, { key: 'seed', label: 'Variation' }];
const ranges = { spacing: { min: 1, max: 9, step: 0.5 }, size: { min: 1, max: 5, step: 0.1 }, seed: { min: 1, max: 20, step: 1 } };
const values = { spacing: 5, size: 3, seed: 7 };
const options = { sliders, get: (k) => values[k], range: (k) => ranges[k] };

test('Fix it tries the smallest helpful change first, then more, then together, within each slider\'s range and step', () => {
  const outside = fixCandidates({ ...clean, exportable: false, outsideSegments: 2 }, options);
  // strands leaving the outline: smaller loops first, a quarter of the way to the minimum
  assert.deepEqual(outside[0].patch, { size: 2.5 });
  assert.deepEqual(outside[0].changes, [{ key: 'size', label: 'Loop size', from: 3, to: 2.5 }]);
  assert.deepEqual(outside[1].patch, { spacing: 4 }, 'spacing snapped to its 0.5 mm step');
  for (const c of outside) for (const [k, v] of Object.entries(c.patch)) {
    assert.ok(v >= ranges[k].min && v <= ranges[k].max, `${k} ${v} in range`);
  }
  assert.ok(outside.some((c) => Object.keys(c.patch).length === 2), 'and both sliders together');
  assert.ok(outside.some((c) => c.patch.size > 3), 'and the other way, in case this design answers differently');
  assert.ok(outside.some((c) => c.patch.seed === 8), 'a new random layout as a last try');
  assert.equal(new Set(outside.map((c) => JSON.stringify(c.patch))).size, outside.length, 'no try twice');
  assert.ok(outside.length <= 14);

  // pieces that don't touch: tighter spacing, bigger loops
  const separate = fixCandidates({ ...clean, exportable: false, components: 2 }, options);
  assert.ok(separate[0].patch.spacing < 5 || separate[0].patch.size > 3);
});

test('a slider already at its end is moved the other way, and sliders without a range are left alone', () => {
  const atMin = { spacing: 1, size: 5 };
  const c = fixCandidates({ ...clean, exportable: false, components: 2 }, { sliders, get: (k) => atMin[k], range: (k) => (k === 'seed' ? null : ranges[k]) });
  assert.ok(c.length > 0);
  assert.ok(c.some((x) => x.patch.spacing > 1), 'spacing at its minimum opens instead');
  assert.equal(c.some((x) => 'seed' in x.patch), false);
});

test('the change is described the way the panel names it', () => {
  assert.equal(describeChanges([{ key: 'size', label: 'Loop size', from: 3, to: 2.5 }, { key: 'spacing', label: 'Line spacing', from: 4, to: 6 }], (k) => 'mm'), 'Loop size 3 → 2.5 mm, Line spacing 4 → 6 mm');
});

test('on a real design, the search finds settings after which the check passes', () => {
  const { machine, material } = defaultProfiles();
  const mod = designById('conformal');
  const settings = { ...mod.defaults(), width: 100, height: 100, spacing: 0.8 };
  const build = (s) => generateDesignExport({ machine, material, design: 'conformal', settings: s, width: 100, height: 100, extraLayers: 0, brim: 2 }).fabric;
  const fabric = build(settings);
  assert.equal(fabric.exportable, false, 'the tightest cells leave pieces that do not touch');
  const items = mod.controls.filter((c) => c.kind === 'sliders').flatMap((c) => c.items);
  const fix = fixCandidates(fabric, { sliders: items, get: (k) => settings[k], range: (k) => mod.ranges[k] })
    .find((c) => problemScore(build({ ...settings, ...c.patch })) === 0);
  assert.ok(fix, 'one of the tries clears the warning');
});
