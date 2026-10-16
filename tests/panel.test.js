import test from 'node:test';
import assert from 'node:assert/strict';
import * as gcode from '../src/engine/gcode.js';
import { generate } from '../src/engine/generate.js';
import { defaultProfiles } from './helpers.js';
import { exportPanel } from '../src/engine/panel.js';
import { DESIGNS } from '../src/ui/designs.js';
import { toTextile } from '../src/ui/controls.js';

test('streaming prints a single full-outline brim before backing, and records its setting', async () => {
  const { machine, material } = defaultProfiles();
  const options = { machine, material, design: 'crosshatch', width: 60, height: 40, repeat: 20 };
  let text = '';
  const stats = await exportPanel(options, { write: async (s) => { text += s; } });
  assert.equal(stats.print.brim, 2);
  const tags = [...text.matchAll(/; brim run (brim-[^\n]+)/g)].map((m) => m[1]);
  assert.equal(tags.length, 2, 'two runs around the complete piece, never around each section');
  assert.ok(text.indexOf('; brim run brim-') < text.indexOf('; texture section '));
  let off = '';
  const noBrim = await exportPanel({ ...options, brim: 0 }, { write: async (s) => { off += s; } });
  assert.equal(noBrim.print.brim, 0);
  assert.ok(!off.includes('; brim run brim-'));
  assert.ok(stats.filamentMm > noBrim.filamentMm);
});

test('every design exports bounded texture sections with the appropriate row precedence', async () => {
  const { machine, material } = defaultProfiles();
  for (const d of DESIGNS.filter((d) => d.status === 'ready')) {
    let text = '';
    const settings = d.id === 'loop-pile' ? toTextile(d.defaults()) : d.defaults();
    const r = await exportPanel({ machine, material, design: d.id, settings, width: 60, height: 60, repeat: 30 }, { write: async (s) => { text += s; } });
    assert.equal(r.sections, 4, d.id);
    assert.match(text, /BODY END/, d.id);
    assert.match(text, ['loop-pile', 'relief', 'fringe'].includes(d.id) ? /texture section 1; origin 0,30/ : /texture section 1; origin 0,0/, d.id);
  }
});

test('panel export preserves layer, nozzle, free-strand classes and selected pile fields', async () => {
  const { machine, material } = defaultProfiles();
  const options = { machine, material, design: 'loop-pile', width: 30, height: 30, repeat: 30, settings: { layer_height: 0.4, nozzle_diameter: 0.8, extrusion_width: 0.9, boundary_policy: 'footprint' } };
  let normal = '', patterned = '';
  await exportPanel(options, { write: async (s) => { normal += s; } });
  await exportPanel({ ...options, pilePattern: 'diamondGrid' }, { write: async (s) => { patterned += s; } });
  assert.match(normal, /"layer_height":0.4/);
  assert.match(normal, /"nozzle_diameter":0.8/);
  assert.notEqual(patterned, normal);
});

test('full-panel squiggle uses the imported image sampler', async () => {
  const { machine, material } = defaultProfiles();
  const options = { machine, material, design: 'squiggle', width: 30, height: 30, repeat: 30, settings: { pattern: 'image' } };
  const render = async (tone) => { let text = ''; await exportPanel({ ...options, image: { width: 1, height: 1, data: new Uint8ClampedArray([tone, tone, tone, 255]) } }, { write: async (s) => { text += s; } }); return text; };
  assert.notEqual(await render(0), await render(255));
});

test('streamed G-code preserves extrusion, fan and retraction state across chunk boundaries', () => {
  assert.equal(typeof gcode.GcodeWriter, 'function');
  const { machine, material } = defaultProfiles();
  const result = generate(machine, material, { sample_width: 20, sample_height: 20 });
  const writer = new gcode.GcodeWriter(result.cfg);
  const lines = [...writer.header({ stats: result.stats })];
  for (const move of result.moves) lines.push(...writer.move(move));
  lines.push(...writer.footer());
  assert.equal(lines.join('\n') + '\n', gcode.writeGcode(result.moves, result.cfg, { stats: result.stats }));
});

test('a 1000 mm panel streams bounded sections without constructing a full move list', async () => {
  const { exportPanel } = await import('../src/engine/panel.js');
  const { machine, material } = defaultProfiles();
  const gantry = { ...machine, id: 'test-gantry', bed: { width: 1000, depth: 1000, max_z: 300 } };
  let bytes = 0, largest = 0, first = '', last = '';
  const stats = await exportPanel({ machine: gantry, material, design: 'crosshatch', settings: { directions: '0-90', spacing: 8, size: 0 }, width: 1000, height: 1000, repeat: 50 }, {
    write: async (text) => { bytes += text.length; largest = Math.max(largest, text.length); first ||= text; last = text; },
  });
  assert.ok(bytes > 100000);
  assert.ok(largest < 270000);
  assert.ok(stats.sections >= 400);
  assert.ok(stats.peakSectionMoves < 10000);
  assert.match(first, /1000 x 1000/);
  assert.match(last, /BODY END/);
});

test('panel cancellation stops generation without an end block', async () => {
  const { exportPanel } = await import('../src/engine/panel.js');
  const { machine, material } = defaultProfiles(), controller = new AbortController();
  let ended = false;
  await assert.rejects(exportPanel({ machine, material, design: 'crosshatch', settings: {}, width: 100, height: 100, repeat: 50 }, {
    write: async (text) => { if (text.includes('BODY END')) ended = true; }, signal: controller.signal,
    progress: ({ phase }) => { if (phase === 'texture') controller.abort(); },
  }), { name: 'AbortError' });
  assert.equal(ended, false);
});

test('panel outlines clip texture first, then tie every remaining region to the backing', async () => {
  const { machine, material } = defaultProfiles();
  const outer = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }];
  const hole = [{ x: 24, y: 24 }, { x: 36, y: 24 }, { x: 36, y: 36 }, { x: 24, y: 36 }];
  const concave = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 60 }, { x: 0, y: 60 }];
  for (const outline of [[outer, hole], [concave]]) {
    let ended = false;
    const r = await exportPanel({ machine, material, design: 'crosshatch', settings: {}, width: 60, height: 60, repeat: 20, outline }, { write: async (s) => { ended ||= s.includes('BODY END'); } });
    assert.equal(r.sections, 9);
    assert.equal(ended, true);
  }
});

test('a picture spans the whole panel: each section is its own window onto it, not the picture again', async () => {
  const { machine, material } = defaultProfiles();
  // 2 x 1 px: black on the left, white on the right
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]) };
  let text = '';
  await exportPanel({ machine, material, design: 'squiggle', width: 60, height: 30, repeat: 30, settings: { pattern: 'image', mode: 'cross', width: 60, height: 30, spacing: 3, amplitude: 1.2, wavelength: 4 }, image }, { write: async (s) => { text += s; } });
  const parts = text.split(/; texture section \d+; origin [\d.,]+\n/);
  assert.equal(parts.length >= 3, true, 'two sections');
  const filament = (chunk) => [...chunk.matchAll(/ E(-?\d+\.\d+)/g)].reduce((n, m) => n + Math.max(0, Number(m[1])), 0);
  const left = filament(parts[1]), right = filament(parts[2]);
  assert.ok(left > right * 1.03, `the dark left half uses more line than the light right half (${left.toFixed(1)} vs ${right.toFixed(1)})`);
});
