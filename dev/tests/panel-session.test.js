import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPanelExport } from '../../site/src/ui/panel-ui.js';

const stats = { timeSec: 3600, bytes: 6 };
const cancelled = () => new DOMException('Picker dismissed', 'AbortError');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function panelHost(t, picker, filename = (width, height) => `panel-${width}x${height}.gcode`) {
  const globals = ['document', 'window', 'Worker'];
  const original = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => globals.forEach((key, i) => {
    if (original[i]) Object.defineProperty(globalThis, key, original[i]);
    else delete globalThis[key];
  }));

  const node = () => ({
    value: 0, hidden: false, disabled: false, open: false, listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
    checkValidity() { return true; },
    showModal() { this.open = true; },
    close() { this.open = false; this.listeners.close?.(); },
    setAttribute() {},
  });
  const ids = ['btn-panel', 'panel-dialog', 'panel-status', 'panel-start', 'panel-close', 'panel-cancel',
    'panel-progress', 'panel-width', 'panel-height', 'panel-repeat', 'panel-backing', 'panel-svg-note', 'export-filename'];
  const nodes = Object.fromEntries(ids.map((id) => [id, node()]));
  nodes['panel-width'].value = 200;
  nodes['panel-height'].value = 100;
  nodes['panel-repeat'].value = 50;
  nodes['panel-backing'].value = 5;
  globalThis.document = { getElementById: (id) => nodes[id] };
  globalThis.window = { showSaveFilePicker: picker };
  const workers = [];
  globalThis.Worker = class {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    emit(data) { return this.onmessage?.({ data }); }
  };
  const downloads = [], exports = [], errors = [];
  const settings = { spacing: 6 }, machine = { id: 'prusa-mk3s', name: 'Prusa MK3S' };
  bindPanelExport({
    options: () => ({ design: 'zigzag', settings, machine }),
    filename,
    download: (name, blob) => downloads.push({ name, blob }),
    onExport: (input, result) => exports.push({ input, result }),
    onError: (error) => errors.push(error),
    toast() {},
  });
  const click = (id) => nodes[id].listeners.click();
  click('btn-panel');
  return { nodes, click, settings, machine, workers, downloads, exports, errors };
}

test('panel export claims a pending save picker before another Start', async (t) => {
  const picker = deferred();
  const requested = [];
  const host = panelHost(t, (options) => { requested.push(options.suggestedName); return picker.promise; });
  const first = host.click('panel-start');
  const duplicate = host.click('panel-start');
  assert.equal(host.nodes['panel-start'].disabled, true);
  assert.deepEqual(requested, ['panel-200x100.gcode']);
  picker.reject(cancelled());
  await Promise.all([first, duplicate]);
  assert.equal(host.nodes['panel-start'].disabled, false);
  assert.equal(host.workers.length, 0);
  assert.equal(host.exports.length, 0);
  assert.equal(host.errors.length, 0);
  assert.match(host.nodes['panel-status'].textContent, /cancelled/i);
});

test('closing while the picker is pending prevents a late handle from opening', async (t) => {
  const picker = deferred();
  const host = panelHost(t, () => picker.promise);
  const pending = host.click('panel-start');
  host.click('panel-close');
  let opened = 0;
  picker.resolve({ createWritable: async () => { opened++; return { abort() {} }; } });
  await pending;
  assert.equal(opened, 0);
  assert.equal(host.workers.length, 0);
  assert.equal(host.exports.length, 0);
  assert.equal(host.nodes['panel-dialog'].open, false);
});

test('cancelling while opening a stream aborts a late writable without starting a worker', async (t) => {
  const writable = deferred();
  const opened = deferred();
  const host = panelHost(t, async () => ({ createWritable() { opened.resolve(); return writable.promise; } }));
  const pending = host.click('panel-start');
  await opened.promise;
  host.click('panel-close');
  let aborted = 0;
  writable.resolve({ abort() { aborted++; } });
  await pending;
  assert.equal(aborted, 1);
  assert.equal(host.workers.length, 0);
  assert.equal(host.nodes['panel-start'].disabled, false);
});

test('a delayed cancelled write cannot acknowledge or finish a replacement panel job', async (t) => {
  const write = deferred();
  let aborted = 0;
  const host = panelHost(t, async () => ({ createWritable: async () => ({
    write() { return write.promise; },
    abort() { aborted++; },
  }) }));
  await host.click('panel-start');
  const first = host.workers[0];
  const oldMessage = first.onmessage;
  const pending = first.emit({ type: 'chunk', text: 'stale\n' });
  await host.click('panel-cancel');
  assert.equal(aborted, 1);
  assert.equal(first.terminated, true);

  globalThis.window.showSaveFilePicker = undefined;
  await host.click('panel-start');
  const second = host.workers[1];
  write.resolve();
  await pending;
  assert.deepEqual(second.messages.map((message) => message.type), ['start']);
  const status = host.nodes['panel-status'].textContent;
  await oldMessage({ data: { type: 'progress', phase: 'texture', total: 10, done: 1 } });
  await oldMessage({ data: { type: 'error', message: 'stale error' } });
  await oldMessage({ data: { type: 'done', stats } });
  assert.equal(host.nodes['panel-status'].textContent, status);
  assert.equal(host.errors.length, 0);
  assert.equal(host.downloads.length, 0);
  assert.equal(host.exports.length, 0);
  assert.equal(second.terminated, undefined);

  await second.emit({ type: 'chunk', text: 'G1 X1\n' });
  await second.emit({ type: 'done', stats });
  assert.deepEqual(second.messages.map((message) => message.type), ['start', 'ack']);
  assert.equal(await host.downloads[0].blob.text(), 'G1 X1\n');
  assert.equal(host.downloads[0].name, 'panel-200x100.gcode');
  assert.equal(host.exports.length, 1);
});

test('a direct save acknowledges the write and reports one export after the close completes', async (t) => {
  const write = deferred(), close = deferred();
  const chunks = [], names = [];
  let closes = 0, aborts = 0;
  const host = panelHost(t, async ({ suggestedName }) => {
    names.push(suggestedName);
    return { createWritable: async () => ({
      write(text) { chunks.push(text); return write.promise; },
      close() { closes++; return close.promise; },
      abort() { aborts++; },
    }) };
  });
  const pendingStart = host.click('panel-start');
  host.settings.spacing = 99;
  host.nodes['panel-width'].value = 210;
  await pendingStart;
  const worker = host.workers[0];
  assert.deepEqual(names, ['panel-200x100.gcode']);
  const pendingWrite = worker.emit({ type: 'chunk', text: 'G1 X1\n' });
  assert.deepEqual(worker.messages.map((message) => message.type), ['start']);
  write.resolve();
  await pendingWrite;
  assert.deepEqual(worker.messages.map((message) => message.type), ['start', 'ack']);

  const pendingClose = worker.emit({ type: 'done', stats });
  const duplicateDone = worker.emit({ type: 'done', stats });
  assert.equal(closes, 1);
  assert.equal(host.nodes['panel-cancel'].disabled, true);
  await host.click('panel-cancel');
  assert.equal(aborts, 0);
  assert.equal(host.exports.length, 0);
  close.resolve();
  await Promise.all([pendingClose, duplicateDone]);
  assert.equal(host.exports.length, 1);
  assert.equal(host.exports[0].input.settings.spacing, 6);
  assert.equal(host.exports[0].input.width, 200);
  assert.deepEqual(chunks, ['G1 X1\n']);
  assert.equal(host.downloads.length, 0);
  assert.equal(worker.terminated, true);
  assert.equal(host.nodes['panel-start'].disabled, false);
  assert.match(host.nodes['panel-status'].textContent, /Saved panel-200x100\.gcode/);
});

test('write and close failures abort their own streams and let the next export succeed', async (t) => {
  const streams = [];
  const host = panelHost(t, async () => ({ createWritable: async () => {
    const id = streams.length;
    const stream = {
      aborted: 0,
      write() { if (id === 0) throw new Error('Write failed'); },
      close() { if (id === 1) throw new Error('Close failed'); },
      abort() { this.aborted++; },
    };
    streams.push(stream);
    return stream;
  } }));
  await host.click('panel-start');
  await host.workers[0].emit({ type: 'chunk', text: 'G1 X1\n' });
  assert.equal(streams[0].aborted, 1);
  assert.match(host.nodes['panel-status'].textContent, /Write failed/);

  await host.click('panel-start');
  await host.workers[1].emit({ type: 'done', stats });
  assert.equal(streams[1].aborted, 1);
  assert.match(host.nodes['panel-status'].textContent, /Close failed/);
  assert.equal(host.exports.length, 0);
  assert.equal(host.errors.length, 0);

  await host.click('panel-start');
  await host.workers[2].emit({ type: 'done', stats });
  assert.equal(streams[2].aborted, 0);
  assert.equal(host.exports.length, 1);
});

test('a worker crash reports one build failure and allows retry', async (t) => {
  const host = panelHost(t);
  await host.click('panel-start');
  const worker = host.workers[0];
  const oldError = worker.onerror;
  await oldError({ message: 'Worker crashed' });
  await oldError({ message: 'Late crash event' });
  assert.equal(worker.terminated, true);
  assert.equal(host.errors.length, 1);
  assert.equal(host.errors[0].message, 'Worker crashed');
  assert.equal(host.nodes['panel-start'].disabled, false);
  await host.click('panel-start');
  await host.workers[1].emit({ type: 'done', stats });
  assert.equal(host.exports.length, 1);
});

test('panel defaults use the captured printer and preserve a typed name', async (t) => {
  const requested = [];
  const host = panelHost(t, async (options) => {
    requested.push(options.suggestedName);
    throw cancelled();
  }, (width, height, repeat, backingSpacing, machine) =>
    [width, height, repeat, backingSpacing, machine?.id ?? 'live'].join('-') + '.gcode');
  assert.equal(host.nodes['export-filename'].value, '200-100-50-5-live.gcode');
  await host.click('panel-start');
  assert.equal(requested[0], '200-100-50-5-prusa-mk3s.gcode');

  host.nodes['export-filename'].value = 'my/panel';
  host.nodes['export-filename'].listeners.input();
  await host.click('panel-start');
  assert.equal(requested[1], 'my-panel.gcode');
});
