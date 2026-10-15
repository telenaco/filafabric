import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { bindPanelExport } from '../src/ui/panel-ui.js';
import { exportPanel } from '../src/engine/panel.js';
import { defaultProfiles } from './helpers.js';

const source = fs.readFileSync(new URL('../src/ui/main.js', import.meta.url), 'utf8');
const uiFunction = (name) => source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`))[0];

test('a sampled large SVG is named with the complete selected size', () => {
  const state = { design: 'zigzag' };
  let named;
  const host = { state, BINDINGS: { zigzag: { size: { get: () => [400, 400] } } }, exportName(size) { named = Array.from(size); return 'design.gcode'; } };
  runInNewContext(`${uiFunction('swatchFileName')}\nswatchFileName();`, host);
  assert.deepEqual(named, [400, 400]);
});

test('the design identifier uses selected dimensions rather than a sampled preview', () => {
  let size;
  const host = {
    state: { design: 'crosshatch', designs: { crosshatch: { width: 400, height: 300 } }, print: {}, result: { cfg: { t: { sample_width: 100, sample_height: 100 } } } },
    designById: () => ({ id: 'crosshatch', file: 'crosshatch', size: (s) => [s.width, s.height] }),
    swatchCode(file, settings, options) { size = Array.from(options.size); return 'code'; },
  };
  runInNewContext(`${uiFunction('currentSwatch')}\ncurrentSwatch();`, host);
  assert.deepEqual(size, [400, 300]);
});

function exportHost({ size = 200, previewSize = 100, pending = null, timer = null, fail = false } = {}) {
  const result = (width) => ({ cfg: { t: { sample_width: width, sample_height: width } }, moves: [{}], gcode: '; Textile G-code generator v1\nG90\n', stats: { moves: 1, timeSec: 123 } });
  const host = {
    Blob, AbortController, DOMException, structuredClone,
    exporting: false, exportController: null, exportLabel: '', genTimer: timer,
    previewBuild: pending, state: { design: 'svgdesign', docName: 'Sample', print: { layerHeight: 0.2, layers: 2 }, resultKey: 'current', result: result(previewSize) },
    exportOptions: () => ({ design: 'svgdesign', width: size, height: size, machine: { id: 'printer' }, material: { id: 'tpu' }, studySettings: { backing1Spacing: 5.12345, pattern: 'none' } }),
    snapshotKey: () => 'current', currentSwatch: () => 'test', swatchFileName: () => 'short.gcode',
    renderBusy() {}, renderExport() {}, render() {}, toast() {},
    async buildSwatch(input) { host.built = input; if (fail) throw new Error('Too large'); return result(input.width); },
    download(name, blob) { host.saved = { name, blob }; },
    reportStudyExport(type, input, stats) { host.recorded = { type, input, stats }; },
    recordBuildFailure(error, input) { host.failure = { error, input }; },
  };
  host.run = () => runInNewContext(`${uiFunction('exportGcode')}\nexportGcode();`, host);
  return host;
}

test('Export builds the selected size directly and preserves exact settings in the header', async () => {
  const settings = { backing1Spacing: 5.12345, pattern: 'none' };
  const host = exportHost();
  await host.run();
  assert.equal(host.built.width, 200);
  assert.equal(host.recorded.input.cfg.t.sample_width, 200);
  const line = (await host.saved.blob.text()).split('\n').find((s) => s.startsWith('; studio settings '));
  const metadata = JSON.parse(line.slice('; studio settings '.length));
  assert.deepEqual(metadata.settings, settings);
  assert.equal(metadata.print.layers, 2);
});

test('Export reuses a matching full-size preview', async () => {
  const host = exportHost({ previewSize: 200 });
  await host.run();
  assert.ok(host.saved);
  assert.equal(host.built, undefined);
});

test('Export waits for the current full-size preview instead of saving stale geometry', async () => {
  let complete;
  const promise = new Promise((resolve) => { complete = resolve; });
  const host = exportHost({ pending: { key: 'current', promise } });
  const run = host.run();
  assert.equal(host.saved, undefined);
  complete({ cfg: { t: { sample_width: 200 } }, gcode: '; Textile G-code generator v1\n', moves: [{}], stats: {} });
  await run;
  assert.ok(host.saved);
  assert.equal(host.built, undefined);
});

test('scheduled edits prevent reuse of the previous preview', async () => {
  const host = exportHost({ previewSize: 200, timer: 1 });
  await host.run();
  assert.equal(host.built.width, 200);
});

test('generation errors are logged and never download a smaller fallback', async () => {
  const host = exportHost({ fail: true });
  await host.run();
  assert.equal(host.saved, undefined);
  assert.equal(host.failure.input.operation, 'design-export');
  assert.equal(host.exporting, false);
});

test('changed settings cancel a pending export without a download', async () => {
  const host = exportHost();
  host.buildSwatch = async () => { host.snapshotKey = () => 'changed'; return {}; };
  await host.run();
  assert.equal(host.saved, undefined);
  assert.equal(host.failure, undefined);
});

test('input errors are caught and recorded before a worker is started', async () => {
  const host = exportHost();
  host.exportOptions = () => { throw new Error('Invalid outline'); };
  await host.run();
  assert.equal(host.saved, undefined);
  assert.equal(host.failure.error.message, 'Invalid outline');
  assert.equal(host.exporting, false);
});

test('export modes retain separate custom names across toggles, dimensions and setup reopening', async (t) => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => { if (old) Object.defineProperty(globalThis, 'document', old); else delete globalThis.document; });
  const node = () => ({ value: '', hidden: false, listeners: {}, setAttribute() {}, addEventListener(type, fn) { this.listeners[type] = fn; }, showModal() {}, close() {} });
  const ids = ['panel-dialog', 'panel-status', 'panel-start', 'panel-close', 'panel-cancel', 'panel-progress', 'panel-width', 'panel-height', 'panel-repeat', 'panel-backing', 'btn-export', 'panel-svg-note', 'export-filename', 'export-mode', 'export-mode-swatch', 'export-mode-panel', 'export-swatch-fields', 'export-panel-fields', 'export-design', 'export-dims', 'export-estimate', 'export-fit', 'export-setup-name', 'export-setup-sub', 'export-change-setup', 'export-window-note'];
  const nodes = Object.fromEntries(ids.map((id) => [id, node()]));
  nodes['panel-width'].value = nodes['panel-height'].value = 100;
  let swatchName = 'default.gcode', saved;
  globalThis.document = { getElementById: (id) => nodes[id] };
  let panelNaming;
  bindPanelExport({ options: () => ({ design: 'zigzag' }), filename: (w, h, repeat, backingSpacing) => { panelNaming = { w, h, repeat, backingSpacing }; return `panel_${w}x${h}.gcode`; }, swatchInfo: () => ({ name: swatchName, dims: '100 × 100 mm' }), saveSwatch: (name) => { saved = name; }, openSetup() {} });
  nodes['btn-export'].listeners.click();
  assert.equal(nodes['export-filename'].value, 'default.gcode');
  nodes['export-filename'].value = 'my swatch'; nodes['export-filename'].listeners.input();
  nodes['export-mode-panel'].listeners.click();
  assert.equal(nodes['export-filename'].value, 'panel_100x100.gcode');
  nodes['panel-repeat'].value = 40; nodes['panel-repeat'].listeners.input();
  nodes['panel-backing'].value = 3; nodes['panel-backing'].listeners.input();
  assert.equal(panelNaming.repeat, 40);
  assert.equal(panelNaming.backingSpacing, 3);
  nodes['export-filename'].value = 'my panel'; nodes['export-filename'].listeners.input();
  nodes['panel-width'].value = 200; nodes['panel-width'].listeners.input();
  assert.equal(nodes['export-filename'].value, 'my panel');
  nodes['export-mode-swatch'].listeners.click();
  assert.equal(nodes['export-filename'].value, 'my swatch');
  nodes['export-change-setup'].listeners.click(); swatchName = 'different-setup.gcode'; nodes['btn-export'].listeners.click();
  assert.equal(nodes['export-filename'].value, 'my swatch');
  await nodes['panel-start'].listeners.click();
  assert.equal(saved, 'my swatch.gcode');
  nodes['btn-export'].listeners.click(); nodes['export-mode-panel'].listeners.click();
  assert.equal(nodes['export-filename'].value, 'my panel');
});

test('single-filament panel headers describe the settings actually printed', async () => {
  const { machine, material } = defaultProfiles();
  let text = '';
  const settings = { width: 20, height: 20, spacing: 4, size: 0, directions: '0-90', colorChange: true };
  await exportPanel({ machine, material, design: 'crosshatch', settings, width: 20, height: 20, repeat: 20, backingSpacing: 5 }, { write: (s) => { text += s; } });
  const line = text.split('\n').find((s) => s.startsWith('; studio settings '));
  const metadata = JSON.parse(line.slice('; studio settings '.length));
  assert.equal(metadata.settings.colorChange, false);
  assert.equal(metadata.width, 20);
  assert.equal(metadata.repeat, 20);
  assert.equal(settings.colorChange, true, 'the source settings were not mutated');
  assert.doesNotMatch(text, /^M600/m);
});
