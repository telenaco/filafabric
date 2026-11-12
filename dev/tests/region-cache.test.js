import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { passesFor } from '../../site/src/engine/drawing.js';
import { regionsFromDrawing } from '../../site/src/engine/regions.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
const vector = {
  name: 'region-cache.svg', width: 40, height: 30,
  paths: [rect(1, 1, 39, 29), rect(10, 6, 30, 24), [{ x: 3, y: 15 }, { x: 37, y: 15 }]],
  styles: [
    { color: 'red', hex: '#ff0000', width: 0.4 },
    { color: 'blue', hex: '#0000ff', width: 0.4 },
    { color: 'other', hex: '#000000', width: 0.8 },
  ],
};

function inputForRegions({ separate = false, design = 'zigzag', settings = designById(design).defaults() } = {}) {
  const regions = regionsFromDrawing(vector, { currentCard: design, currentSettings: settings });
  return {
    ...defaultProfiles(), design, vector, width: vector.width, height: vector.height,
    settings: separate ? { ...settings, spacing: 4 } : settings, regions,
    shapeOutline: true, extraLayers: 0, brim: 0, seam: { enabled: false },
  };
}

test('identical region patterns are reused and changed layer or backing inputs miss the cache', () => {
  const input = inputForRegions({ separate: true });
  const original = generateDesignExport(input);
  assert.equal(Object.keys(original.patternCache).length, 1);
  const reused = generateDesignExport({ ...input, patternCache: original.patternCache });
  assert.deepEqual(reused.patternCache, {});
  assert.equal(reused.gcode, original.gcode);

  for (const options of [
    { extraLayers: 1 },
    { backing: { extra: true, spacing: 4, depth: 4, wavelength: 12 } },
    { extraLayers: undefined, layers: 2 },
  ]) {
    const expected = generateDesignExport({ ...input, ...options });
    assert.notEqual(expected.gcode, original.gcode, 'this setting changes the generated pattern');
    const actual = generateDesignExport({ ...input, ...options, patternCache: original.patternCache });
    assert.equal(Object.keys(actual.patternCache).length, 1, 'the new geometry is cached independently');
    assert.equal(actual.gcode, expected.gcode);
  }
});

test('picture pixels never reuse or populate the reusable region pattern cache', () => {
  const settings = { ...designById('zigzag').defaults(), pattern: 'image', patternEffect: 'depth' };
  const input = inputForRegions({ separate: true, settings });
  const without = generateDesignExport(input);
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]) };
  const expected = generateDesignExport({ ...input, image });
  const actual = generateDesignExport({ ...input, image, patternCache: without.patternCache });
  assert.notEqual(expected.gcode, without.gcode, 'pixels change the generated pattern');
  assert.equal(Object.keys(expected.patternCache).length, 0);
  assert.equal(Object.keys(actual.patternCache).length, 0);
  assert.equal(actual.gcode, expected.gcode);
});

test('legacy output is preserved for default controls and unchanged region order', () => {
  for (const shapeOutline of [true, false]) {
    const input = { ...inputForRegions(), shapeOutline };
    const original = generateDesignExport(input);
    const regions = input.regions.map((region, index) => ({ ...region, order: index + 1, lineLayers: 1, passSpacing: 0.8 }));
    const applied = generateDesignExport({ ...input, regions });
    assert.equal(applied.gcode, original.gcode);
    assert.equal(applied.patternCache, undefined, 'the legacy single-pattern path still applies');
    assert.ok(applied.strands.some((strand) => strand.fixed && strand.pts.every((p) => Math.abs(p.y - 15) < 1)
      && strand.pts.some((p) => p.x < 10) && strand.pts.some((p) => p.x > 30)), 'the dedicated line crosses the hole on the legacy path');
    assert.equal(applied.fabric.outsideSegments, 0);
  }
});

test('an explicit line width, layer count or pass spacing disables the legacy fast path', () => {
  const input = inputForRegions();
  for (const controls of [{ lineWidth: 2.4 }, { lineLayers: 3 }, { passSpacing: 0.6 }]) {
    const regions = input.regions.map((region) => region.role === 'line' ? { ...region, ...controls } : region);
    const result = generateDesignExport({ ...input, regions });
    const lineStrands = result.strands.filter((strand) => strand.regionId === regions[2].id);
    assert.ok(lineStrands.length, 'edited lines are built by the region pipeline');
    if (controls.lineWidth) assert.equal(lineStrands.length, passesFor(controls.lineWidth, result.cfg.t.extrusion_width));
    if (controls.lineLayers) assert.deepEqual([...new Set(lineStrands.map((s) => s.layer))], [0, 1, 2]);
  }
});

test('applying a region out of source order changes layer-zero print order', () => {
  const input = inputForRegions();
  const regions = input.regions.map((region, index) => ({ ...region, order: index === 2 ? 1 : index + 2 }));
  const result = generateDesignExport({ ...input, regions });
  const printed = [...new Set(result.strands.filter((strand) => strand.layer === 0).map((strand) => strand.regionId))];
  assert.deepEqual(printed, [regions[2].id, regions[0].id]);
});

test('Looped rows flat fits a tight printer bed after the temporary row turns are cut away', () => {
  const input = inputForRegions({ design: 'coil-flat', separate: true });
  const machine = { ...input.machine, bed: { ...input.machine.bed, width: input.width, depth: input.height } };
  const result = generateDesignExport({ ...input, machine });
  assert.ok(result.moves.some(move => move.extrude));
  assert.ok(result.moves.every(move => move.x >= -1e-6 && move.x <= input.width + 1e-6 &&
    move.y >= -1e-6 && move.y <= input.height + 1e-6));
});

test('the piece outline surrounds the exterior while a pattern outline can independently sit outside its region', () => {
  const input = inputForRegions();
  input.regions[0].seam = { enabled: true, width: .8, align: 'outside' };
  const regionOnly = generateDesignExport(input);
  assert.ok(!regionOnly.strands.some(s => s.role === 'outside-outline'));
  assert.ok(regionOnly.strands.some(s => s.role === 'seam' && s.pts.some(p => p.x < 1)));
  const result = generateDesignExport({ ...input, outsideOutline: { count: 2, align: 'inside' } });
  const outside = result.strands.filter(s => s.role === 'outside-outline');
  assert.equal(outside.length, 2, 'only the exterior gets the two passes, not the cutout');
  assert.ok(outside.every(s => s.pts.every(p => p.x > 1 && p.x < 39)));
  assert.ok(result.strands.some(s => s.role === 'seam' && s.pts.some(p => p.x < 1)));
});
