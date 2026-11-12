import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { withContrast } from '../../site/src/engine/picture.js';
import { classifyBuildError, DiagnosticLog, suggestRecovery } from '../../site/src/ui/diagnostics.js';
import { designById } from '../../site/src/ui/designs.js';
import { resolveCrossings } from '../../site/src/engine/crossings.js';
import { lanePoints } from '../../site/src/engine/shapes.js';
import { defaultProfiles } from './helpers.js';
import { bindPanelExport } from '../../site/src/ui/panel-ui.js';

const crossingError = () => new Error('These lines cross each other more than 120,000 times: they overlap far too much.');
const memoryStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test('server error classification contains only allowlisted codes and numerical counts', () => {
  assert.deepEqual(classifyBuildError(crossingError()), { code: 'crossing-limit', limit: 120000 });
  assert.deepEqual(classifyBuildError(new Error('This layout would need about 546,700 moves; the limit is 400,000.')), { code: 'move-limit', limit: 400000, observed: 546700 });
  const error = new Error('<svg><path d="private drawing" /></svg>');
  error.details = { code: 'crossing-limit', limit: 100, observed: 101, source: error.message };
  assert.deepEqual(classifyBuildError(error), { code: 'crossing-limit', limit: 100, observed: 101 });
  error.details = { code: error.message, observed: error.message };
  assert.deepEqual(classifyBuildError(error), { code: 'unknown-build-error' });
  assert.deepEqual(classifyBuildError(new Error('Sample (900 x 900 mm) does not fit the bed (250 x 210 mm)')), { code: 'bed-fit' });
});

test('local diagnostics deduplicate consecutive settings and survive reload without retaining SVG geometry', () => {
  const storage = memoryStorage(), log = new DiagnosticLog(storage);
  const entry = { design: 'coil', settings: { width: 100, height: 100, size: 6, pitch: 0.2, svg: '<svg>secret</svg>', vector: { pts: [{ x: 1, y: 2 }] } }, dimensions: [100, 100], sourceComplexity: { paths: 3 }, error: crossingError() };
  assert.equal(log.record(entry), true);
  assert.equal(log.record({ ...entry, error: new Error('These lines cross each other more than 120,000 times: repeated render') }), false);
  assert.equal(log.record({ ...entry, settings: { ...entry.settings, pitch: 0.3 } }), true);
  assert.equal(log.record(entry), true, 'returning to an earlier configuration records another attempt');
  const saved = new DiagnosticLog(storage).export();
  assert.equal(saved.length, 3);
  assert.match(saved[0].error.message, /120,000/);
  assert.ok(saved[0].error.stack);
  assert.equal(saved[0].settings.svg, undefined);
  assert.equal(saved[0].settings.vector, undefined);
  saved[0].settings.pitch = 99;
  assert.equal(log.export()[0].settings.pitch, 0.2, 'export cannot mutate the log');
});

test('local diagnostics keep the last 50 attempts and handle unavailable storage', () => {
  const storage = memoryStorage(), log = new DiagnosticLog(storage);
  for (let pitch = 1; pitch <= 55; pitch++) log.record({ design: 'coil', settings: { pitch }, error: crossingError() });
  assert.equal(log.export().length, 50);
  assert.equal(log.export()[0].settings.pitch, 6);
  assert.equal(new DiagnosticLog(storage).export().length, 50);
  const blocked = new DiagnosticLog({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } });
  assert.equal(blocked.record({ design: 'coil', settings: { pitch: 1 }, error: crossingError() }), true);
  assert.equal(blocked.export().length, 1);
  assert.doesNotThrow(() => blocked.clear());
  assert.deepEqual(blocked.export(), []);
});

test('legacy move-limit diagnostics still offer recovery without changing dimensions or choices', () => {
  const module = designById('coil'), { machine, material } = defaultProfiles();
  const settings = { ...module.defaults(), width: 60, height: 60, size: 8, pitch: 0.2, rowOverlap: 95, shape: 'looped', pattern: 'stripes', patternScale: 0.75 };
  // Old locally saved errors remain readable, but the formerly rejected uncapped job must not be run as a unit fixture.
  const error = new Error('This layout would need about 2,000,000 moves; the limit is 400,000.');
  assert.equal(classifyBuildError(error).code, 'move-limit');
  const recovery = suggestRecovery(module, settings, error);
  assert.ok(recovery);
  assert.equal(recovery.label, 'Simplify this pattern');
  assert.equal(recovery.patch.width, undefined);
  assert.equal(recovery.patch.height, undefined);
  assert.equal(recovery.patch.shape, undefined);
  assert.equal(recovery.patch.pattern, undefined);
  const recovered = { ...settings, ...recovery.patch };
  assert.deepEqual([recovered.width, recovered.height, recovered.shape, recovered.pattern, recovered.patternScale], [60, 60, 'looped', 'stripes', 0.75]);
  const result = module.generate(machine, material, recovered);
  assert.ok(result.moves.some((move) => move.extrude));
});

test('a fast real crossing guard failure also offers a usable coil recovery', () => {
  const module = designById('coil'), { machine, material } = defaultProfiles();
  const settings = { ...module.defaults(), width: 30, height: 30, size: 6, pitch: 0.8, rowOverlap: 95 };
  const pts = lanePoints({ shape: 'looped', length: 30, size: 6, pitch: 0.8 }).map((p) => ({ x: p.u, y: p.v + 15, z: 0.2 }));
  let error;
  try { resolveCrossings([{ pts }], { maxCrossings: 100 }); } catch (e) { error = e; }
  assert.equal(classifyBuildError(error).code, 'crossing-limit');
  const recovery = suggestRecovery(module, settings, error);
  assert.ok(recovery);
  assert.ok(module.generate(machine, material, { ...settings, ...recovery.patch }).moves.some((move) => move.extrude));
});

test('recovery changes density controls but preserves shape and pattern choices across designs', () => {
  for (const id of ['rosette', 'spirograph', 'zigzag', 'svgdesign']) {
    const module = designById(id);
    assert.ok(module, id);
    const settings = { ...module.defaults() };
    for (const key of Object.keys(settings)) {
      if (/spacing|pitch|wavelength/i.test(key)) settings[key] = 0.1;
      if (['lobes', 'loops', 'loop', 'size', 'depth'].includes(key)) settings[key] = 100;
    }
    const recovery = suggestRecovery(module, settings, crossingError());
    assert.ok(recovery, id);
    for (const key of Object.keys(recovery.patch)) {
      assert.equal(typeof recovery.patch[key], 'number');
      assert.ok(!['width', 'height', 'shape', 'pattern'].includes(key));
    }
  }
  assert.equal(suggestRecovery(designById('coil'), { ...designById('coil').defaults(), width: 900 }, new Error('Sample does not fit the bed')), null);
  assert.equal(suggestRecovery({ defaults: () => ({ width: 100, height: 100 }) }, { width: 100, height: 100 }, crossingError()), null);
  assert.equal(suggestRecovery(designById('coil'), designById('coil').defaults(), new Error('Unexpected error')), null);
});

test('recovery preserves exact dimensions and unrelated numeric settings', () => {
  const module = designById('coil');
  const settings = { ...module.defaults(), width: 60.123456, height: 80.987654, size: 8, pitch: 0.2, rowOverlap: 95, lift: 0.25321, patternScale: 0.75123 };
  const recovery = suggestRecovery(module, settings, crossingError());
  const recovered = { ...settings, ...recovery.patch };
  for (const key of ['width', 'height', 'lift', 'patternScale']) assert.equal(recovered[key], settings[key], key);
});

// Run the actual UI action functions against a small host, without starting the browser-only studio/WebGL app.
const uiSource = readFileSync(new URL('../../site/src/ui/main.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
function uiFunction(name) {
  const body = uiSource.match(new RegExp(`^(?:async )?function ${name}\\([^]*?\\n}`, 'm'))?.[0];
  if (!body) throw new Error(`Missing UI function ${name}`);
  return body;
}

test('the UI recovery action keeps the exact failed attempt available through Undo', () => {
  const module = designById('coil');
  const settings = { ...module.defaults(), width: 60.12345, pitch: 0.2, size: 8, rowOverlap: 95 };
  const state = { design: 'coil', designs: { coil: settings }, machine: 'prusa-mk3s', material: 'filaflex-95-foamy', print: { layers: 1 }, error: crossingError() };
  const undoLog = { stack: [{ key: 'previous valid state', data: { designs: { coil: { ...settings, pitch: 5 } } }, picture: { image: null } }], cursor: 0 };
  const recovery = suggestRecovery(module, settings, state.error);
  let generated, restored, stored;
  const host = {
    state, undoLog, recovery,
    settingsOf: () => settings,
    syncControls() {}, renderControls() {}, renderHistoryButtons() {}, toast() {},
    schedule() { generated = { ...settings }; },
    rememberPrintSetup() { stored = { ...state.print }; },
    applySnapshot(data) { restored = JSON.parse(JSON.stringify(data)); },
    DENSITY_REVISION: 1, location: { hash: '' },
  };
  runInNewContext(['snapshot', 'snapshotKey', 'captureHistoryPicture', 'trimHistory', 'commit', 'restoreHistory', 'undo', 'applySettingsPatch', 'applyBuildRecovery'].map(uiFunction).join('\n') + '\napplyBuildRecovery(recovery); undo();', host);
  assert.equal(generated.pitch, recovery.patch.pitch);
  assert.equal(generated.width, 60.12345);
  assert.equal(stored.layers, 1);
  assert.equal(restored.designs.coil.pitch, 0.2);
  assert.equal(restored.designs.coil.size, 8);
  assert.equal(restored.designs.coil.rowOverlap, 95);
  assert.equal(undoLog.stack.length, 3);
});

test('error-log download includes the current drawing only in the explicitly downloaded local file', async () => {
  const current = { design: 'coil', vector: { width: 20, height: 10, paths: [[{ x: 1.123456, y: 2.654321 }, { x: 10, y: 5 }]] } };
  let saved, message;
  const host = {
    Blob, Date, state: { docName: 'My swatch', vector: current.vector },
    snapshot: () => current,
    diagnosticLog: { export: () => [{ design: 'coil', error: { code: 'crossing-limit', message: 'Local error details' } }] },
    download(name, blob) { saved = { name, blob }; }, toast(text) { message = text; },
    reportStudyExport() { throw new Error('A local error-log download must not upload the drawing'); },
  };
  runInNewContext(`${uiFunction('slug')}\n${uiFunction('saveErrorLog')}\nsaveErrorLog();`, host);
  assert.equal(saved.name, 'my-swatch-error-log.json');
  assert.equal(saved.blob.type, 'application/json');
  const data = JSON.parse(await saved.blob.text());
  assert.deepEqual(data.current.vector, current.vector);
  assert.equal(data.errors[0].error.message, 'Local error details');
  assert.match(data.note, /including the current drawing/);
  assert.match(message, /including the current drawing/);
});

function panelHost(t, picker) {
  const original = Object.fromEntries(['document', 'window', 'Worker'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const node = () => ({ hidden: false, disabled: false, value: 0, textContent: '', listeners: {}, children: [], addEventListener(type, callback) { this.listeners[type] = callback; }, append(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; }, checkValidity() { return true; }, showModal() {}, close() {}, querySelector() { return nodes.actions; } });
  const nodes = Object.fromEntries(['panel-dialog', 'panel-status', 'panel-start', 'panel-close', 'panel-cancel', 'panel-progress', 'panel-width', 'panel-height', 'panel-repeat', 'panel-backing', 'btn-export', 'panel-svg-note', 'actions'].map((id) => [id, node()]));
  nodes['panel-width'].value = 300;
  nodes['panel-height'].value = 200;
  nodes['panel-repeat'].value = 50;
  nodes['panel-backing'].value = 5;
  globalThis.document = { getElementById: (id) => nodes[id], createElement: node };
  globalThis.window = { ...(picker ? { showSaveFilePicker: picker } : {}) };
  const workers = [];
  globalThis.Worker = class { constructor() { workers.push(this); } terminate() { this.terminated = true; } postMessage(message) { this.message = message; } };
  return { nodes, workers };
}

test('panel worker build errors report the captured input and expose local error-log download', async (t) => {
  const { nodes, workers } = panelHost(t);
  const settings = { width: 100, height: 100, spacing: 0.1 };
  const vector = { width: 300, height: 200, paths: [[{ x: 1, y: 2 }, { x: 3, y: 4 }]] };
  const attempts = [];
  let downloads = 0;
  bindPanelExport({ options: () => ({ design: 'coil', settings, vector, machine: { id: 'gantry' }, material: { id: 'tpu' } }), filename: () => 'panel.gcode', onError: (error, input) => attempts.push({ error, input }), onDownloadErrorLog: () => { downloads++; } });
  await nodes['panel-start'].listeners.click();
  settings.spacing = 9;
  vector.paths[0][0].x = 99;
  await workers[0].onmessage({ data: { type: 'error', name: 'ConfigError', message: 'These lines cross each other more than 120,000 times.' } });
  assert.equal(attempts.length, 1);
  assert.equal(classifyBuildError(attempts[0].error).code, 'crossing-limit');
  assert.equal(attempts[0].input.width, 300);
  assert.equal(attempts[0].input.height, 200);
  assert.equal(attempts[0].input.settings.spacing, 0.1);
  assert.equal(attempts[0].input.vector.paths[0][0].x, 1);
  const button = nodes.actions.children.find((child) => child.textContent === 'Download error log');
  assert.ok(button && !button.hidden);
  button.listeners.click();
  assert.equal(downloads, 1);
});

test('panel cancellation and file permission failures do not become build diagnostics', async (t) => {
  const { nodes, workers } = panelHost(t);
  const attempts = [];
  bindPanelExport({ options: () => ({ design: 'coil', settings: {} }), filename: () => 'panel.gcode', onError: (error) => attempts.push(error) });
  await nodes['panel-start'].listeners.click();
  await workers[0].onmessage({ data: { type: 'error', name: 'AbortError', message: 'Cancelled' } });
  await nodes['panel-start'].listeners.click();
  await nodes['panel-cancel'].listeners.click();
  globalThis.window.showSaveFilePicker = async () => { throw new DOMException('File permission denied', 'NotAllowedError'); };
  await nodes['panel-start'].listeners.click();
  globalThis.window.showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async () => { throw new DOMException('Cannot write this file', 'NotAllowedError'); }, abort: async () => {} }) });
  await nodes['panel-start'].listeners.click();
  await workers.at(-1).onmessage({ data: { type: 'chunk', text: 'G1 X1' } });
  assert.equal(attempts.length, 0);
});

test('the shared failure recorder keeps panel metadata and study dimensions from its captured job', () => {
  const log = new DiagnosticLog(memoryStorage()), events = [];
  const input = {
    design: 'coil', width: 300, height: 200, repeat: 50, backingSpacing: 4, layers: 3,
    studySettings: { width: 100, height: 100, pitch: 0.2, rowOverlap: 95 },
    vector: { width: 300, height: 200, paths: [[{ x: 1, y: 2 }, { x: 3, y: 4 }]] },
    machine: { id: 'gantry' }, material: { id: 'tpu', print_defaults: { layer_height: 0.25 } },
  };
  const host = {
    input, error: crossingError(), classifyBuildError, diagnosticLog: log,
    $(selector) { assert.equal(selector, '#btn-error-log'); return downloadButton; },
    state: { design: 'zigzag', vector: null },
    settingsOf() { throw new Error('A captured panel must not use the newly selected design settings'); },
    reportStudyExport(type, options) { events.push({ type, options }); },
  };
  const downloadButton = { hidden: true };
  runInNewContext(`${uiFunction('recordBuildFailure')}\nrecordBuildFailure({ name: 'AbortError' }, input);`, host);
  assert.equal(downloadButton.hidden, true);
  runInNewContext(`${uiFunction('recordBuildFailure')}\nrecordBuildFailure(error, input); recordBuildFailure(error, input);`, host);
  assert.equal(downloadButton.hidden, false);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'build-error');
  assert.equal(events[0].options.design, 'coil');
  assert.equal(events[0].options.width, 300);
  assert.equal(events[0].options.height, 200);
  assert.equal(events[0].options.machine.id, 'gantry');
  assert.equal(events[0].options.error.code, 'crossing-limit');
  const entry = log.export()[0];
  assert.equal(entry.design, 'coil');
  assert.deepEqual(entry.dimensions, { width: 300, height: 200 });
  assert.equal(entry.settings.pitch, 0.2);
  assert.equal(entry.settings.repeat, 50);
  assert.equal(entry.settings.print.layerHeight, 0.25);
  assert.equal(entry.sourceComplexity.svgPointCount, 2);
  assert.equal(entry.vector, undefined);
});

function studio() {
  const saved = new Map();
  const state = {
    machine: 'first', material: 'tpu', design: 'zigzag', docName: 'Test piece',
    primary: {}, advanced: {}, designs: { zigzag: { pattern: 'image' } },
    print: { layerHeight: 0.2, nozzleTemp: 225 }, image: null, imageRevision: 0,
    machines: new Map([['first', {}], ['second', {}]]), materials: new Map([['tpu', {}]]),
  };
  const controls = {};
  const location = { hash: '', pathname: '/', search: '' };
  const host = {
    state, undoLog: { stack: [], cursor: -1 }, store: saved, STORAGE_KEY: 'setup', DENSITY_REVISION: 1,
    REGION_LIMIT: 20, PICTURE: 'image', PICTURE_CONTRAST: { min: 1, max: 5 }, nextImageRevision: 0,
    location, history: { replaceState() { location.hash = ''; } },
    documentRequest: 0, pictureRequest: 0, machineRequest: 0,
    $: id => controls[id] ??= {}, profiles: { useLibrary: async id => state.machines.get(id) },
    machinePicker: null, defaultLayerHeight: () => 0.3, toast() {},
    normalisePrint() {}, renderControls() {}, updateDialogNote() {}, schedule() {},
    resetRoles() {}, showDesign() {}, syncControls() {}, known() {}, withContrast,
    sanitizeState: data => structuredClone(data), sanitizeFilamentSettings: ({ nozzleTemp }) => ({ nozzleTemp }),
    DESIGNS: [{ id: 'zigzag', status: 'ready', defaults: () => ({ pattern: 'centerSpot' }) }],
    settingsOf: () => state.designs.zigzag,
  };
  runInNewContext([
    'snapshot', 'snapshotKey', 'printerSetupOnly', 'rememberPrintSetup', 'captureHistoryPicture',
    'trimHistory', 'commit', 'loadState', 'applySnapshot', 'restoreHistory', 'undo', 'redo',
    'renderHistoryButtons', 'chooseMachine', 'forgetPictureChoices', 'setPictureContrast', 'clearPicture',
  ].map(uiFunction).join('\n'), host);
  return {
    host, state, controls, saved,
    remembered: () => host.printerSetupOnly(JSON.parse(saved.get('setup'))),
  };
}

test('an accepted printer change is recorded while the previous build error is visible', async () => {
  const { host, state, remembered, controls } = studio();
  host.commit();
  state.buildFailure = { key: 'previous', error: new Error('previous build failed') };
  await host.chooseMachine('second');
  assert.equal(state.machine, 'second');
  assert.equal(remembered().machine, 'second');
  assert.equal(controls['#btn-undo'].disabled, false);
  host.undo();
  assert.equal(state.machine, 'first');
  host.redo();
  assert.equal(state.machine, 'second');
});

test('Undo and Redo persist the restored setup before the preview finishes', async () => {
  const { host, state, remembered, saved } = studio();
  host.commit();
  await host.chooseMachine('second');
  state.print.nozzleTemp = 235;
  host.commit();
  host.location.hash = '#s=shared-setup';
  host.undo();
  assert.equal(remembered().print.nozzleTemp, 225);
  assert.equal(host.location.hash, '');
  host.undo();
  assert.equal(state.machine, 'first');
  assert.equal(remembered().machine, 'first');
  assert.equal(remembered().print.layerHeight, 0.2);
  host.redo();
  host.redo();
  assert.equal(remembered().machine, 'second');
  assert.equal(remembered().print.layerHeight, 0.3);
  assert.equal(remembered().print.nozzleTemp, 235);
  assert.equal(JSON.parse(saved.get('setup')).designs, undefined);
  host.undo();
  state.print.nozzleTemp = 245;
  host.commit();
  host.redo();
  assert.equal(remembered().print.nozzleTemp, 245);
});

const image = (pixel, rotation = 0) => {
  const original = { width: 1, height: 1, data: new Uint8ClampedArray([pixel, pixel, pixel, 255]) };
  return { original, data: original, contrast: 1, rotation, name: 'local-artwork', px: [1, 1], thumb: { width: 1, height: 1 } };
};

test('history restores the specific artwork and contrast after replacement, clearing and redo', () => {
  const { host, state, saved } = studio();
  const first = image(32);
  state.image = first;
  state.imageRevision = ++host.nextImageRevision;
  host.commit();
  host.setPictureContrast(1.5);
  host.setPictureContrast(2);
  host.commit();
  const contrastRevision = state.imageRevision;
  const second = image(128, 90);
  state.image = second;
  state.imageRevision = ++host.nextImageRevision;
  host.commit();
  host.clearPicture();
  assert.equal(state.image, null);
  host.undo();
  assert.equal(state.image.original, second.original);
  assert.equal(state.image.rotation, 90);
  host.undo();
  assert.equal(state.image.original, first.original);
  assert.equal(state.image.contrast, 2);
  assert.equal(state.imageRevision, contrastRevision);
  host.undo();
  assert.equal(state.image.contrast, 1);
  host.setPictureContrast(3);
  host.commit();
  assert.ok(state.imageRevision > contrastRevision);
  host.redo();
  assert.equal(state.image.contrast, 3);
  host.clearPicture();
  host.undo();
  host.redo();
  assert.equal(state.image, null);
  assert.equal(state.designs.zigzag.pattern, 'centerSpot');
  assert.doesNotMatch(JSON.stringify(host.snapshot()), /local-artwork|imageRevision/);
  assert.doesNotMatch(saved.get('setup'), /local-artwork|imageRevision/);
});

test('a settings snapshot without its tab artwork falls back to the built-in pattern', () => {
  const { host, state } = studio();
  state.image = image(64);
  const saved = JSON.parse(JSON.stringify(host.snapshot()));
  const fresh = studio();
  fresh.host.applySnapshot(saved);
  assert.equal(fresh.state.image, null);
  assert.equal(fresh.state.designs.zigzag.pattern, 'centerSpot');
});

test('artwork history evicts oldest source pixels while keeping newer entries and shared contrast sources', () => {
  const { host, state } = studio();
  for (let revision = 1; revision <= 10; revision++) {
    state.image = image(revision);
    state.image.original.data = { byteLength: 4_000_000 };
    state.imageRevision = revision;
    host.commit();
  }
  const retained = host.undoLog.stack.length;
  assert.equal(retained, 8);
  assert.equal(host.undoLog.stack[0].picture.revision, 3);
  state.image.contrast = 2;
  state.imageRevision++;
  host.commit();
  assert.equal(host.undoLog.stack.length, retained + 1);
  assert.equal(host.undoLog.stack[0].picture.revision, 3);
});
