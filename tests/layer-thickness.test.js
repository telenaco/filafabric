import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { layerHeightOptions, defaultLayerHeight, resolveConfig } from '../src/engine/params.js';
import { importProfiles } from '../src/engine/profile-import.js';
import { validateMachine } from '../src/engine/profiles.js';
import { SHAPE_IDS } from '../src/engine/shapes.js';
import { FIELD_IDS } from '../src/engine/fields.js';
import { SQUIGGLE_DEFAULTS, SQ_PATTERNS, sanitizeSquiggle } from '../src/ui/squiggle-controls.js';
import { SAMPLERS, generateSquiggle } from '../src/engine/squiggle.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const fixture = (name) => fs.readFileSync(path.join(projectRoot, 'tests', 'fixtures', name), 'utf8');

test('a 0.4 mm nozzle suggests layers of 0.10, 0.15, 0.20 and 0.25 mm by default', () => {
  assert.deepEqual(layerHeightOptions(0.4), [0.1, 0.15, 0.2, 0.25]);
  assert.deepEqual(layerHeightOptions(), [0.1, 0.15, 0.2, 0.25]);
  assert.deepEqual(layerHeightOptions(0.6), [0.15, 0.2, 0.25, 0.3, 0.35]);
  assert.deepEqual(layerHeightOptions(0.25), [0.1, 0.15]);
  assert.deepEqual(layerHeightOptions(0.8).at(-1), 0.5);
  assert.deepEqual(layerHeightOptions('nonsense'), [0.1, 0.15, 0.2, 0.25]);
  assert.deepEqual(layerHeightOptions(Infinity), [0.1, 0.15, 0.2, 0.25]);
  assert.deepEqual(layerHeightOptions(9), [0.1, 0.15, 0.2, 0.25]);
  assert.ok(layerHeightOptions(1).every((v) => v <= 0.625 && v >= 0.25));
});

test('printer defaults follow the nozzle, preserve exact imported thickness and allow explicit overrides', () => {
  const { machine, material } = defaultProfiles();
  for (const [nozzle_diameter, height] of [[0.4, 0.2], [0.6, 0.3], [0.9, 0.45]]) {
    const printer = { ...machine, nozzle_diameter };
    assert.equal(defaultLayerHeight(printer), height);
    assert.equal(resolveConfig(printer, material).t.layer_height, height);
    assert.ok(resolveConfig(printer, material).t.extrusion_width >= nozzle_diameter);
  }
  const printer = { ...machine, nozzle_diameter: 0.4, print_defaults: { layer_height: 0.28 } };
  assert.ok(layerHeightOptions(.4, .28).includes(.28));
  assert.equal(defaultLayerHeight(printer), .28);
  assert.equal(resolveConfig(printer, material).t.layer_height, .28);
  assert.equal(resolveConfig(printer, material, { layer_height: .15 }).t.layer_height, .15);
  assert.ok(validateMachine({ ...printer, print_defaults: { layer_height: .5 } }).some(e => /layer_height/.test(e)));
});

test('a printer profile can say what nozzle it has, and the print config follows', () => {
  const { machine, material } = defaultProfiles();
  assert.equal(resolveConfig(machine, material).t.nozzle_diameter, 0.4);
  assert.equal(resolveConfig({ ...machine, nozzle_diameter: 0.6 }, material).t.nozzle_diameter, 0.6);
  assert.equal(resolveConfig({ ...machine, nozzle_diameter: 0.6 }, material, { nozzle_diameter: 0.5 }).t.nozzle_diameter, 0.5, 'a design\'s own say wins');
  assert.ok(validateMachine({ ...machine, nozzle_diameter: 9 }).some((e) => /nozzle_diameter/.test(e)));
  assert.deepEqual(validateMachine({ ...machine, nozzle_diameter: 0.4 }), []);
});

test('a slicer export brings its nozzle with it', () => {
  assert.equal(importProfiles(fixture('prusa-config.ini'), 'a.ini').machines[0].nozzle_diameter, 0.4);
  assert.equal(importProfiles(fixture('prusa-bundle.ini'), 'b.ini').machines[0].nozzle_diameter, 0.6);
  assert.equal(importProfiles(fixture('bambu-printer.json'), 'c.json').machines[0].nozzle_diameter, 0.4);
});

test('strand shapes are listed from the plainest to the most involved, with the sine wave first', () => {
  assert.deepEqual([...SHAPE_IDS], ['wave', 'zigzag', 'square', 'honeycomb', 'figure8', 'ring', 'looped']);
});

test('squiggle patterns are listed plainest first, and the design opens as symmetric and undeformed', () => {
  assert.deepEqual([...SQ_PATTERNS.slice(0, 5)], ['uniform', 'gradientX', 'gradientY', 'centerSpot', 'waves']);
  assert.equal(SQ_PATTERNS.at(-1), 'image');
  assert.equal(SQUIGGLE_DEFAULTS.pattern, 'uniform');
  assert.equal(SQUIGGLE_DEFAULTS.shape, 'wave');
  assert.equal(SQUIGGLE_DEFAULTS.mode, 'cross');
  assert.deepEqual(FIELD_IDS.slice(0, 3), ['stripes', 'bumps', 'brick']);
  assert.equal(sanitizeSquiggle({}).pattern, 'uniform');
  // the same tone everywhere: every wave is as deep as every other
  const tone = SAMPLERS[SQUIGGLE_DEFAULTS.pattern];
  const values = new Set([[0, 0], [50, 50], [100, 20], [13, 87]].map(([x, y]) => tone(x, y, 100, 100)));
  assert.equal(values.size, 1);
});

test('the default squiggle swatch has the same wave on every line; a centre spot does not', () => {
  const { machine, material } = defaultProfiles();
  // how far each line of the first layer swings sideways: the same for every line when nothing deforms it
  const swings = (sampler) => {
    const r = generateSquiggle(machine, material, { width: 60, height: 60, sampler });
    return r.strands.filter((s) => s.layer === 0 && s.pts.length > 20).map((s) => {
      const xs = s.pts.map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    });
  };
  const spread = (list) => Math.max(...list) - Math.min(...list);
  const plain = swings(SAMPLERS[SQUIGGLE_DEFAULTS.pattern]);
  assert.ok(plain.length >= 10);
  assert.ok(spread(plain) < 0.2, `lines differ by ${spread(plain).toFixed(2)} mm`);
  assert.ok(spread(swings(SAMPLERS.centerSpot)) > 0.5, 'the centre spot deepens the waves in the middle');
});
