import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { bindPanelExport } from '../src/ui/panel-ui.js';
import { exportPanel } from '../src/engine/panel.js';
import { defaultProfiles } from './helpers.js';

const source = fs.readFileSync(new URL('../src/ui/main.js', import.meta.url), 'utf8');
const uiFunction = (name) => source.match(new RegExp(`function ${name}\\([^]*?\\n}`))[0];

test('a sampled large SVG is labelled and named with the size actually saved', () => {
  const state = { design: 'zigzag', result: { documentSize: [400, 400], cfg: { t: { sample_width: 100, sample_height: 100 } }, moves: [{}], gcode: 'G1 X1', stats: { timeSec: 120, filamentGrams: 0.4 } } };
  let named;
  const host = { state, designById: () => ({ name: 'Zigzag mesh' }), formatMinutes: String, exportName(size) { named = Array.from(size); return 'sample.gcode'; } };
  const info = runInNewContext(`${uiFunction('swatchFileName')}\n${uiFunction('swatchInfo')}\nswatchInfo();`, host);
  assert.deepEqual(named, [100, 100]);
  assert.equal(info.dims, '100 × 100 mm');
  assert.match(info.context, /complete 400 × 400 mm SVG/);
});

test('swatch G-code keeps exact design settings even when its readable name is shortened', async () => {
  const settings = { backing1Spacing: 5.12345, pattern: 'none' };
  let saved;
  const host = {
    Blob, state: { design: 'svgdesign', docName: 'Sample', machine: 'prusa-mk3s', material: 'tpu', print: { layerHeight: 0.2, layers: 2 }, result: { moves: [{}], gcode: '; Textile G-code generator v1\nG90\n' } },
    settingsOf: () => settings, currentSwatch: () => 'test', swatchFileName: () => 'short.gcode',
    download(name, blob) { saved = { name, blob }; }, reportStudyExport() {}, toast() {},
  };
  runInNewContext(`${uiFunction('exportGcode')}\nexportGcode();`, host);
  const line = (await saved.blob.text()).split('\n').find((s) => s.startsWith('; studio settings '));
  const metadata = JSON.parse(line.slice('; studio settings '.length));
  assert.deepEqual(metadata.settings, settings);
  assert.equal(metadata.print.layers, 2);
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
