import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { bindPanelExport } from '../../site/src/ui/panel-ui.js';
import { exportPanel } from '../../site/src/engine/panel.js';
import { defaultProfiles } from './helpers.js';

const source = fs.readFileSync(new URL('../../site/src/ui/main.js', import.meta.url), 'utf8');
const uiFunction = (name) => source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`))[0];
// a colour ticked but not yet applied must be applied before the piece exports
const applyRequirement = ['workingRegions', 'requiresApply'].map((name) => source.match(new RegExp(`^const ${name} = .*;$`, 'm'))[0]).join('\n');

test('a sampled large SVG is named with the complete selected size', () => {
  const state = { design: 'zigzag' };
  let named;
  const host = { state, BINDINGS: { zigzag: { size: { get: () => [400, 400] } } }, exportName(size) { named = Array.from(size); return 'design.gcode'; } };
  runInNewContext(`${uiFunction('swatchFileName')}\nswatchFileName();`, host);
  assert.deepEqual(named, [400, 400]);
});

test('a bounded preview places a custom outline at full size before cropping it to match its brim', () => {
  let placement, crop;
  const placed = [[{ x: 20, y: 20 }]], cropped = [[{ x: 20, y: 20 }, { x: 100, y: 20 }]];
  const host = {
    state: { outline: { rings: [], rotation: 15 } },
    unflattenRings: () => [],
    placeOutline(rings, options) { placement = options; return placed; },
    windowRings(rings, width, height) { crop = { rings, width, height }; return cropped; },
  };
  const actual = runInNewContext(`${uiFunction('placedOutline')}\nplacedOutline(100,100,400,300);`, host);
  assert.equal(placement.width, 400);
  assert.equal(placement.height, 300);
  assert.equal(placement.rotation, 15);
  assert.equal(crop.width, 100);
  assert.equal(crop.height, 100);
  assert.equal(crop.rings, placed);
  assert.equal(actual, cropped);
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

function exportHost({ size = 200, previewSize = 100, pending = null, timer = null, fail = false, ready = null } = {}) {
  const result = (width) => ({ cfg: { t: { sample_width: width, sample_height: width } }, moves: [{}], gcode: '; Textile G-code generator v1\nG90\n', stats: { moves: 1, timeSec: 123 } });
  const host = {
    Blob, AbortController, DOMException, structuredClone,
    exporting: false, exportController: null, exportLabel: '', genTimer: timer, overviewTrace: null, referenceResult: null,
    previewBuild: pending, readyGcode: ready, state: { design: 'svgdesign', docName: 'Sample', print: { layerHeight: 0.2, layers: 2 }, resultKey: 'current', result: result(previewSize) },
    exportOptions: () => ({ design: 'svgdesign', width: size, height: size, machine: { id: 'printer' }, material: { id: 'tpu' }, studySettings: { backing1Spacing: 5.12345, pattern: 'none' } }),
    buildKey: () => 'current', currentSwatch: () => 'test', swatchFileName: () => 'short.gcode',
    renderBusy() {}, renderExport() {}, render() {}, toast(message) { host.message=message; }, printEstimates: { put() {} },
    async buildSwatch(input) { host.built = input; if (fail) throw new Error('Too large'); return result(input.width); },
    assertConstructionExportable() {},
    download(name, blob) { host.saved = { name, blob }; },
    reportStudyExport(type, input, stats) { host.recorded = { type, input, stats }; },
    recordBuildFailure(error, input) { host.failure = { error, input }; },
  };
  host.run = () => runInNewContext(`${applyRequirement}\n${uiFunction('currentBuildError')}\n${uiFunction('exportGcode')}\nexportGcode();`, host);
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

test('Export records the actual original, extra and total passes in its header and study event', async () => {
  const host = exportHost({ previewSize: 200 });
  host.state.print = { layerHeight: 0.2, extraLayers: 1, brim: 2 };
  host.state.result.layerPlan = { nativeLayers: 2, extraLayers: 1, totalLayers: 3 };
  await host.run();
  const line = (await host.saved.blob.text()).split('\n').find((s) => s.startsWith('; studio settings '));
  const metadata = JSON.parse(line.slice('; studio settings '.length));
  assert.deepEqual(metadata.print, { layerHeight: 0.2, extraLayers: 1, brim: 2, nativeLayers: 2, totalLayers: 3 });
  assert.deepEqual(host.recorded.input.layerPlan, host.state.result.layerPlan);
});

test('raised export headers identify backing reinforcement and one texture copy', async () => {
  const host = exportHost({ previewSize: 200 });
  host.state.print = { layerHeight: 0.2, extraLayers: 2, brim: 2 };
  host.state.result.layerPlan = { mode: 'backing', nativeLayers: null, extraLayers: 2, totalLayers: null, backingLayers: 2, totalBackingLayers: 4 };
  await host.run();
  const line = (await host.saved.blob.text()).split('\n').find((s) => s.startsWith('; studio settings '));
  const metadata = JSON.parse(line.slice('; studio settings '.length));
  assert.equal(metadata.print.backingLayers, 2);
  assert.equal(metadata.print.totalBackingLayers, 4);
  assert.equal(metadata.print.textureCopies, 1);
  assert.equal(metadata.print.totalLayers, null);
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

test('Export saves G-code already generated for these exact settings, without building it again', async () => {
  const ready = { key: 'current', result: { cfg: { t: { sample_width: 200, sample_height: 200 } }, gcode: '; Textile G-code generator v1\nG1 X1\n', moveCount: 5, stats: { timeSec: 60 } } };
  const host = exportHost({ ready });
  await host.run();
  assert.equal(host.built, undefined, 'no second build');
  assert.match(await host.saved.blob.text(), /G1 X1/);
});

test('G-code generated for other settings is never saved', async () => {
  const host = exportHost({ ready: { key: 'older', result: { gcode: '; old\n', moveCount: 1, cfg: { t: {} }, stats: {} } } });
  await host.run();
  assert.equal(host.built.width, 200, 'built afresh');
  assert.doesNotMatch(await host.saved.blob.text(), /; old/);
});

test('scheduled edits prevent reuse of the previous preview', async () => {
  const host = exportHost({ previewSize: 200, timer: 1 });
  await host.run();
  assert.equal(host.built.width, 200);
});

test('multi-pattern edits require Apply and never save the stale piece', async () => {
  const host=exportHost({previewSize:200});
  host.state.regions=[{role:'pattern',enabled:true},{role:'pattern',enabled:true}];
  host.state.resultKey='previous';
  await host.run();
  assert.equal(host.saved,undefined);
  assert.equal(host.built,undefined);
  assert.match(host.message,/Apply the whole piece/);
});

test('an applied multi-pattern piece exports without rebuilding', async () => {
  const host=exportHost({previewSize:200});
  host.state.regions=[{role:'pattern',enabled:true,applied:true},{role:'pattern',enabled:true,applied:true}];
  await host.run();
  assert.ok(host.saved);
  assert.equal(host.built,undefined);
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
  host.buildSwatch = async () => { host.buildKey = () => 'changed'; return {}; };
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

test('replacing a printer under the same ID discards prepared G-code', async () => {
  const { machine, material } = defaultProfiles();
  const host = exportHost();
  Object.assign(host.state, {
    machine: machine.id, material: material.id,
    machines: new Map([[machine.id, machine]]), materials: new Map([[material.id, material]]),
  });
  host.buildKey = () => runInNewContext(
    [uiFunction('snapshotKey'), uiFunction('buildKey'), 'buildKey();'].join('\n'),
    { state: host.state },
  );
  host.readyGcode = { key: host.buildKey(), result: { gcode: '; obsolete printer\n', moveCount: 1, cfg: { t: {} }, stats: {} } };
  host.state.machines.set(machine.id, { ...machine, bed: { ...machine.bed, width: machine.bed.width - 20 } });
  await host.run();
  assert.ok(host.built, 'the replacement profile needs a fresh build');
  assert.doesNotMatch(await host.saved.blob.text(), /obsolete printer/);
});

test('an obsolete construction failure cannot disable the current Export button', () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { getAttribute: () => null });
    return nodes.get(selector);
  };
  const state = {
    design: 'zigzag', print: {}, resultKey: 'older',
    result: { moves: [{}], construction: { errors: ['obsolete failure'] } },
  };
  runInNewContext(uiFunction('currentBuildError') + '\n' + uiFunction('renderExport') + '\nrenderExport();', {
    $, state, exporting: false, overviewActive: false, readyGcode: null,
    buildKey: () => 'current', snapshotKey: () => 'current', currentPrintSizeProblem: () => '',
    requiresApply: () => false, isReady: () => true, experimentalPrinter: () => false,
  });
  assert.equal($('#btn-export').disabled, false);
});


test('the latest settings-file selection wins if an earlier read finishes later', async () => {
  const applied = [];
  const host = { documentRequest: 0, machineRequest: 0, applySnapshot(data) { applied.push(data.name); }, commit() {}, toast() {} };
  runInNewContext(uiFunction('openFile'), host);
  let resolveA, resolveB;
  const a = host.openFile({ text: () => new Promise(resolve => { resolveA = resolve; }) });
  const b = host.openFile({ text: () => new Promise(resolve => { resolveB = resolve; }) });
  resolveB('{"name":"new"}');
  await b;
  resolveA('{"name":"old"}');
  await a;
  assert.deepEqual(applied, ['new']);
});

test('a pending SVG import cannot put a removed drawing back', async () => {
  let resolveSvg;
  let drawingControls;
  const state = { vector: { name: 'previous' }, regions: [], selectedRegion: null, print: { outsideOutline: { count: 2 } } };
  const host = {
    documentRequest: 0, state, previewChoice: 'full',
    readSvgLines: () => new Promise(resolve => { resolveSvg = resolve; }),
    bedSizeLimits: () => ({ width: 100, height: 100 }), printOverhang: () => 0,
    regionsFromDrawing: () => [], REGION_LIMIT: 12, sanitizeSeam: () => ({}),
    settingsOf: () => ({}), selectRegion() {}, shapesOf: () => null, followVectorSize() {},
    showDesign() {}, openDrawingSettings() {}, syncControls() {}, schedule() {}, commit() {}, toast() {},
    renderRegions() { drawingControls = state.regions; },
    $: () => ({}), bedFitSize: () => null,
  };
  state.machines = new Map();
  runInNewContext([uiFunction('importSvg'), uiFunction('removeSvg')].join('\n'), host);
  const pending = host.importSvg({ name: 'obsolete.svg' });
  host.removeSvg();
  assert.equal(drawingControls, null, 'removing the SVG clears the drawing controls immediately');
  assert.equal(state.print.outsideOutline, undefined);
  resolveSvg({ name: 'obsolete', width: 25, height: 25 });
  await pending;
  assert.equal(state.vector, null);
});

test('Apply waits for the matching preview and preserves its toolpath key once colours are applied', () => {
  const regions = [{ id: 'red', applied: true, enabled: false, order: 1 }, { id: 'green', enabled: true }, { id: 'blue', enabled: true }];
  const state = { regions, machines: new Map(), materials: new Map(), design: 'zigzag', print: {} };
  let commits = 0;
  let exportUpdates = 0;
  const host = {
    state, previewBuild: null, pendingRegionApply: null, exporting: false,
    captureRegionSettings() {}, settingsOf: () => ({}), currentBuildError: () => null,
    pieceRegions: () => regions.map(({ applied, ...r }) => ({ ...r, enabled: r.enabled || applied })),
    workingRegions: () => regions.filter(r => r.enabled && !r.applied),
    renderRegions() {}, commit() { commits++; }, renderExport() { exportUpdates++; },
    previewAtSelectedSize() { throw new Error('Apply should reuse the running preview'); },
  };
  runInNewContext(['buildKey', 'applyPiece', 'finishRegionApply'].map(uiFunction).join('\n'), host);
  const key = host.buildKey();
  host.previewBuild = { key };
  host.applyPiece();
  host.finishRegionApply('obsolete key');
  assert.equal(regions[1].applied, undefined);
  assert.equal(commits, 0);
  host.finishRegionApply(key);
  assert.deepEqual(regions.map(r => [r.applied, r.order]), [[true, 1], [true, 2], [true, 3]]);
  assert.equal(host.buildKey(), key);
  assert.equal(commits, 1);
  assert.equal(exportUpdates, 1, 'applying a cached preview also enables the export action');
});

test('scheduling a preview retires the old epoch before the next worker starts', () => {
  let cleared = false;
  const host = {
    state: { buildFailure: { key: 'previous', error: new Error('previous build failed') } },
    regenerationEpoch: 3, genTimer: null, readyGcode: null, referenceResult: null, overviewTrace: null, pendingRegionApply: null,
    traceProblem: null, fixJob: null, previewBuild: null, overview: null, exportController: null,
    captureRegionSettings() {}, buildKey: () => 'current',
    clearTimeout() {}, setTimeout: () => 5, regenerate() {}, stopPlay() {}, renderCheck() {}, renderBusy() {}, renderExport() {}, renderPreviewMode() {}, renderPlayback() {},
    renderErrors() { cleared = true; },
  };
  runInNewContext(uiFunction('schedule') + '\nschedule();', host);
  assert.equal(host.regenerationEpoch, 4);
  assert.equal(host.genTimer, 5);
  assert.equal(host.state.buildFailure, null);
  assert.equal(cleared, true);
});

test('only a build failure for the active inputs is shown while a new preview is queued', () => {
  const error = new Error('build failed');
  const host = { state: { buildFailure: { key: 'old', error } }, buildKey: () => 'current' };
  runInNewContext(uiFunction('currentBuildError'), host);
  assert.equal(host.currentBuildError(), null);
  host.state.buildFailure.key = 'current';
  assert.equal(host.currentBuildError(), error);
});


test('variant generation captures setup and the printer filename once for the entire batch', async () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { open: false, replaceChildren() {}, showModal() { this.open = true; } });
    return nodes.get(selector);
  };
  const cards = [{ id: 'first', name: 'First', family: 'zigzag' }, { id: 'second', name: 'Second', family: 'zigzag' }];
  const machine = { id: 'prusa-mk3s', name: 'Prusa MK3S' };
  const material = { id: 'tpu' };
  const inputs = [];
  let captureCount = 0;
  let namedFor;
  let combinedPrint;
  const host = {
    $, AbortController, DOMException, structuredClone, exporting: false, exportController: null, exportLabel: '',
    variantExportReady: null, variantJob: null, buildKey: () => 'current',
    variantsOf: () => cards, BINDINGS: { first: { size: { get: () => [20, 20] } } },
    state: { machine: machine.id, machines: new Map([[machine.id, machine]]), print: { layerHeight: 0.2 } },
    printMaterial: () => material, planVariantLayout: () => ({
      width: 20, height: 20, positions: [{ x: 0, y: 0 }, { x: 22, y: 0 }], totalWidth: 42, totalHeight: 20, gap: 2,
    }),
    settingsOf: () => ({}), placedOutline: () => null,
    exportOptions() { captureCount++; return { machine, material, setup: captureCount }; },
    async buildSwatch(input) { inputs.push(input); host.state.print.layerHeight = 0.3; return {}; },
    combineVariantResults(_results, options) { combinedPrint = options.print; return { gcode: '', settingsHash: 'abcd', pieces: cards.map((c, i) => ({ card: c.id, index: i + 1, width: 20, height: 20, x: 22 * i, y: 0 })) }; },
    variantsFileName(_family, _hash, target) { namedFor = target; return 'variants.gcode'; },
    drawVariantPreview() {}, el() {}, renderBusy() {}, render() {}, toast() {}, recordBuildFailure(error) { throw error; },
  };
  await runInNewContext(uiFunction('exportAllVariants') + "\nexportAllVariants('first');", host);
  assert.equal(captureCount, 1);
  assert.deepEqual(inputs.map(input => input.setup), [1, 1]);
  assert.equal(namedFor.id, machine.id);
  assert.equal(combinedPrint.layerHeight, 0.2);
});

test('clipboard rejection after an edit does not install an obsolete share link', async () => {
  let reject;
  let addressReplaced = false;
  let key = 'before';
  const host = {
    shareRequest: 0, snapshotKey: () => key, snapshot: () => ({}),
    state: { design: 'zigzag' }, stateToHash: () => '#s=before',
    location: { origin: 'http://localhost', pathname: '/' },
    settingsOf: () => ({}), PICTURE: 'image', toast() {},
    navigator: { clipboard: { writeText: () => new Promise((_, failure) => { reject = failure; }) } },
    history: { replaceState() { addressReplaced = true; } },
  };
  runInNewContext(uiFunction('shareLink'), host);
  const pending = host.shareLink();
  key = 'after';
  reject(new Error('clipboard unavailable'));
  await pending;
  assert.equal(addressReplaced, false);
});


test('Export rebuilds an equal-size 3D sample using the whole-piece generator', async () => {
  const host = exportHost({ previewSize: 200 });
  host.state.result.samplePreview = true;
  await host.run();
  assert.ok(host.built, 'a sample remains a sample even when dimensions match the whole piece');
  assert.ok(host.saved);
});

test('failure of a retired adaptive preview cannot change the new preview', async () => {
  let rejectKernel;
  let failure;
  const host = {
    state: { machines: new Map(), vector: {}, design: 'zigzag', print: { brim: 2 } },
    genTimer: null, regenerationEpoch: 0, previewBuild: null, previewChoice: 'sample',
    overviewActive: false, overview: { cancel() {} },
    BINDINGS: { zigzag: { size: { get: () => [60, 60] } } },
    printMaterial: () => ({}), designById: () => ({}), followVectorSize() {}, buildKey: () => 'current',
    useWholeOverview: () => false, currentPrintSizeProblem: () => '',
    renderPreviewMode() {}, renderBusy() {}, render() {},
    recordBuildFailure(error) { failure = error; }, console: { error() {} },
    prepareAdaptiveSolids: () => new Promise((_, reject) => { rejectKernel = reject; }),
  };
  runInNewContext(uiFunction('regenerate'), host);
  const pending = host.regenerate();
  host.regenerationEpoch++;
  rejectKernel(new Error('old preview failed'));
  await pending;
  assert.equal(failure, undefined);
  assert.equal(host.state.buildFailure, undefined);
});

test('the studio bead width follows a replaced filament profile with the same ID', () => {
  const machine = { nozzle_diameter: 0.4 };
  const host = {
    state: { machine: 'm', material: 'f', machines: new Map([['m', machine]]),
      materials: new Map([['f', { width: 0.45 }]]), print: {} },
    beadMemo: {}, beadWidth: (_machine, material) => material.width,
    withFilamentSettings: material => material,
  };
  runInNewContext(uiFunction('beadNow'), host);
  assert.equal(host.beadNow(), 0.45);
  host.state.materials.set('f', { width: 0.56 });
  assert.equal(host.beadNow(), 0.56);
});
