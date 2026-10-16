import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDesignExport, compactDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { generate } from '../src/engine/generate.js';
import { generateSquiggle, createImageSampler } from '../src/engine/squiggle.js';
import { createField } from '../src/engine/fields.js';
import { defaultProfiles } from './helpers.js';

const profiles = defaultProfiles();

test('Bubbles export generates one full-size seeded design beyond the bounded preview', () => {
  const settings = { size: 5, seed: 7, link: true };
  const input = { ...profiles, design: 'bubbles', settings, width: 200, height: 200, brim: 0 };
  const start = performance.now();
  const result = generateDesignExport(input);
  console.log(`Bubbles 200: ${(performance.now() - start).toFixed(0)} ms, ${result.moves.length} moves`);
  const direct = designById('bubbles').generate(profiles.machine, profiles.material, { ...designById('bubbles').defaults(), ...settings, width: 200, height: 200 });
  const preview = generateDesignExport({ ...input, width: 100, height: 100 });
  assert.equal(result.cfg.t.sample_width, 200);
  assert.equal(result.cfg.t.sample_height, 200);
  assert.equal(result.gcode, direct.gcode, 'the selected generator runs at full size without tiling or extra backing');
  assert.ok(result.moves.some((m) => m.extrude && m.x > 150 && m.y > 150));
  assert.ok(result.moves.length > preview.moves.length * 2);
  assert.ok(!result.strands.some((s) => /section-|backing-/.test(s.id)));
  // a loop, not a spread: a dense design has more coordinates than one call can take
  let lo = Infinity, hi = -Infinity;
  for (const m of result.gcode.matchAll(/\bX(-?\d+(?:\.\d+)?)/g)) { const x = Number(m[1]); if (x < lo) lo = x; if (x > hi) hi = x; }
  assert.ok(hi - lo > 150, 'G-code spans the selected size, including machine offset');
  assert.equal(generateDesignExport(input).gcode, result.gcode, 'same full-size seed and settings are repeatable');
});

test('export compaction excludes all toolpath arrays and timeline storage', () => {
  const result = generateDesignExport({ ...profiles, design: 'bubbles', settings: { size: 5, seed: 7, link: true }, width: 20, height: 20 });
  const compact = compactDesignExport(result);
  assert.deepEqual(Object.keys(compact).sort(), ['cfg', 'fabric', 'gcode', 'moveCount', 'stats', 'warnings']);
  assert.equal(compact.moveCount, result.moves.length);
  assert.equal(compact.gcode, result.gcode);
  assert.equal(compact.stats.moveStartSec, undefined);
  assert.ok(result.stats.moveStartSec.length);
});

test('SVG guides retain original coordinates and all three green wall passes once', () => {
  const ring = Array.from({ length: 33 }, (_, i) => ({ x: 40 + 4 * Math.cos(i * Math.PI / 16), y: 20 + 4 * Math.sin(i * Math.PI / 16) }));
  const vector = { name: 'green.svg', width: 60, height: 40, paths: [ring], styles: [{ color: 'green', width: 1.2 }] };
  const outline = [[{ x: 5, y: 3 }, { x: 55, y: 3 }, { x: 55, y: 37 }, { x: 5, y: 37 }]];
  const result = generateDesignExport({ ...profiles, design: 'crosshatch', width: 60, height: 40, outline, vector });
  assert.equal(result.guideCount, 1);
  assert.equal(result.vector.width, 60);
  assert.equal(result.vector.height, 40);
  const walls = result.strands.filter((s) => s.id.startsWith('svg-'));
  assert.equal(walls.length, 3);
  assert.ok(walls.every((s) => s.pts.every((p) => p.x > 34 && p.x < 46 && p.z === result.cfg.t.layer_height)));
  assert.ok(result.moves.some((m) => m.extrude && m.x > 50));
});

test('legacy image sampler and pile fields use full selected dimensions and keep raised classes', () => {
  const image = { width: 2, height: 2, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]) };
  const settings = { pattern: 'image', spacing: 3, amplitude: 1, wavelength: 8 };
  const squiggle = generateDesignExport({ ...profiles, design: 'squiggle', settings, image, width: 25, height: 20, brim: 0 });
  const directSquiggle = generateSquiggle(profiles.machine, profiles.material, { ...settings, width: 25, height: 20, sampler: createImageSampler(image, 25, 20, { yUp: true }) });
  assert.equal(squiggle.gcode, directSquiggle.gcode);
  const field = createField('bumps', { scale: 2 });
  const pile = generateDesignExport({ ...profiles, design: 'loop-pile', width: 25, height: 20, pilePattern: 'bumps', pilePatternScale: 2, brim: 0 });
  const directPile = generate(profiles.machine, profiles.material, { sample_width: 25, sample_height: 20 }, { liftAt: (x, y) => 0.3 + 0.7 * field(x, y) });
  assert.equal(pile.gcode, directPile.gcode);
  assert.ok(pile.moves.some((m) => m.extrude && m.cls === 'rising'));
});

test('full-size preflight rejects a design that fits the preview but exceeds the printer bed', () => {
  assert.throws(() => generateDesignExport({ ...profiles, design: 'bubbles', width: 300, height: 200 }), { name: 'PreflightError' });
});

test('Rosette export follows the selected full-size spirals beyond 100 mm', () => {
  const start = performance.now();
  const result = generateDesignExport({ ...profiles, design: 'rosette', width: 200, height: 200 });
  assert.equal(result.cfg.t.sample_width, 200);
  assert.equal(result.cfg.t.sample_height, 200);
  assert.ok(result.moves.some((m) => m.extrude && m.x > 190));
  assert.ok(result.moves.some((m) => m.extrude && m.y > 190));
  assert.ok(result.turns > 20);
  console.log(`Rosette 200: ${(performance.now() - start).toFixed(0)} ms, ${result.moves.length} moves`);
});

test('full-size export retains the generator budget instead of shrinking to fit', () => {
  assert.throws(() => generateDesignExport({ ...profiles, design: 'bubbles', width: 200, height: 200, settings: { size: 1 } }), /limit is 8000/);
});

test('SVG design composes the imported drawing once and legacy pile retains raised classes with a vector', () => {
  const ring = Array.from({ length: 25 }, (_, i) => ({ x: 15 + 4 * Math.cos(i * Math.PI / 12), y: 15 + 4 * Math.sin(i * Math.PI / 12) }));
  const vector = { name: 'green.svg', width: 30, height: 30, paths: [ring], styles: [{ color: 'green', width: 1.2 }] };
  const svg = generateDesignExport({ ...profiles, design: 'svgdesign', vector, width: 30, height: 30 });
  assert.equal(svg.strands.filter((s) => s.id.startsWith('svg-')).length, 3);
  const pile = generateDesignExport({ ...profiles, design: 'loop-pile', vector, width: 30, height: 30 });
  assert.ok(pile.moves.some((m) => m.extrude && m.cls === 'rising'));
  assert.ok(pile.moves.some((m) => m.extrude && m.cls === 'unsupported'));
});

test('direct export adds two inside brim runs once, before the repeated fabric, and can disable them', () => {
  const input = { ...profiles, design: 'crosshatch', width: 30, height: 20, layers: 2 };
  const plain = generateDesignExport({ ...input, brim: 0 });
  const framed = generateDesignExport(input);
  assert.equal(framed.brim.count, 2);
  assert.equal(framed.brim.overlap, 0.2);
  assert.equal(framed.strands.filter((s) => s.brim && !s.connection).length, 2);
  assert.ok(framed.moves.find((m) => m.extrude).tag.startsWith('brim-'));
  const body = framed.moves.slice(-plain.moves.length);
  assert.deepEqual(body.map(({ retract, ...move }) => move), plain.moves.map(({ retract, ...move }) => move), 'the native fabric path is preserved');
  for (let i = 0; i < body.length; i++) {
    if (body[i].retract === plain.moves[i].retract) continue;
    assert.equal(i, plain.moves.findIndex((m) => m.extrude));
    assert.equal(body[i].retract, 'unretract', 'only a balanced first-extrusion prime can be added');
  }
  assert.ok(framed.stats.filamentMm > plain.stats.filamentMm);
  assert.equal(framed.cfg.t.sample_width, 30);
  assert.equal(plain.brim, undefined);
});
