import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './helpers.js';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { bindSwatchLab } from '../../site/src/ui/swatch-lab.js';
import { parseSwatchRecord, qualifiesForTested, testedProblems } from '../../site/src/engine/swatch-records.js';

// T8.1: a card's state becomes 'tested' only with a good, approved physical record in docs/swatches/. No card is Tested yet.

const folder = path.join(projectRoot, 'docs', 'swatches');
const recordFiles = () => fs.readdirSync(folder).filter((name) => name.endsWith('.md') && !['TEMPLATE.md', 'comparisons.md', 'README.md'].includes(name));

const GOOD = `# Swatch record
- **Swatch code:** FF-abc
- **Card ID / variant:** bubbles
- **Settings hash:** 0123456789ab
- **Printed by:** Luis
- **Date (YYYY-MM-DD):** 2026-11-02
- **Print status:** success
- **Verdict:** good
- **Approved by:** Luis
`;

test('the template names every field the parser reads', () => {
  const template = fs.readFileSync(path.join(folder, 'TEMPLATE.md'), 'utf8');
  for (const label of ['Swatch code', 'Card ID / variant', 'Settings hash', 'Printed by', 'Date (YYYY-MM-DD)', 'Print status', 'Verdict', 'Approved by']) assert.ok(template.includes(`**${label}:**`), label);
});

test('a record is read from the template fields', () => {
  assert.deepEqual(parseSwatchRecord(GOOD), { swatchCode: 'FF-abc', card: 'bubbles', settingsHash: '0123456789ab', printedBy: 'Luis', date: '2026-11-02', printStatus: 'success', verdict: 'good', approvedBy: 'Luis' });
  assert.equal(parseSwatchRecord('- **Verdict:** usable with notes').verdict, 'usable');
  assert.equal(parseSwatchRecord('- **Verdict:** good / usable with notes / failed').verdict, null, 'the unfilled template is no verdict');
});

test('only a good, successful, dated, owner-approved record qualifies', () => {
  assert.equal(qualifiesForTested(parseSwatchRecord(GOOD)), true);
  for (const [from, to] of [['good', 'failed'], ['good', 'usable with notes'], ['success', 'partial'], ['Approved by:** Luis', 'Approved by:** '], ['2026-11-02', 'soon']]) {
    assert.equal(qualifiesForTested(parseSwatchRecord(GOOD.replace(from, to))), false, `${from} -> ${to}`);
  }
});

test('a Tested card needs a qualifying record, and a record must name a real card', () => {
  const cards = [{ id: 'bubbles', status: 'ready', state: 'tested' }, { id: 'coil', status: 'ready', state: 'untested' }];
  assert.deepEqual(testedProblems(cards, [parseSwatchRecord(GOOD)]), []);
  assert.deepEqual(testedProblems(cards, []), ['bubbles is marked Tested without a good, approved swatch record.']);
  assert.deepEqual(testedProblems(cards, [parseSwatchRecord(GOOD.replace('bubbles', 'nope')), parseSwatchRecord(GOOD)]), ['A swatch record names nope, which is not a card.']);
});

test('the records in docs/swatches back every Tested card', () => {
  const records = recordFiles().map((name) => parseSwatchRecord(fs.readFileSync(path.join(folder, name), 'utf8')));
  assert.deepEqual(testedProblems(DESIGNS, records), []);
});

function labHost(t) {
  const globals = ['document', 'Worker'];
  const originals = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => globals.forEach((key, i) => {
    if (originals[i]) Object.defineProperty(globalThis, key, originals[i]);
    else delete globalThis[key];
  }));

  const nodes = [];
  const pendingClose = [];
  function node(tag) {
    const element = {
      tag, attributes: {}, listeners: {}, children: [], value: '', open: false, disabled: false, hidden: false,
      setAttribute(name, value) {
        this.attributes[name] = value;
        if (name === 'value') this.value = value;
        if (name === 'hidden') this.hidden = true;
      },
      addEventListener(type, listener) { this.listeners[type] = listener; },
      append(child) { this.children.push(child); },
      showModal() { this.open = true; },
      close() {
        this.open = false;
        pendingClose.push(() => this.listeners.close?.());
      },
    };
    nodes.push(element);
    return element;
  }

  globalThis.document = { createElement: node, body: node('body') };
  const workers = [], downloads = [];
  globalThis.Worker = class {
    constructor() { workers.push(this); }
    postMessage({ input }) { this.input = input; }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage?.({ data }); }
  };
  const button = node('button');
  const machine = { name: 'Prusa MK3S', id: 'prusa-mk3s' };
  let captures = 0;
  bindSwatchLab({
    button,
    options: () => { captures++; return { machine, material: { id: 'tpu' } }; },
    download: (name, blob) => downloads.push({ name, blob }),
    toast() {},
  });
  const picker = nodes.find((element) => element.tag === 'select');
  picker.value = 'waves';
  const status = nodes.find((element) => element.attributes.role === 'status');
  const start = nodes.find((element) => element.textContent === 'Build and download ZIP');
  const cancel = nodes.find((element) => element.textContent === 'Close');
  const dialog = nodes.find((element) => element.tag === 'dialog');
  button.listeners.click();

  return { machine, workers, downloads, picker, status, start, cancel, dialog, pendingClose,
    open: () => button.listeners.click(), captureCount: () => captures };
}

const gcode = '; BODY START\nG1 X1\n';
const built = { type: 'done', result: { gcode, construction: {} } };
const complete = async (worker) => { worker.emit(built); await Promise.resolve(); };

async function readArchive(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const files = new Map();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, decoder.decode(bytes.subarray(start, start + size)));
    offset = start + size;
  }
  return files;
}

test('Swatch Lab builds one captured set and names the archive and print files for its printer', async (t) => {
  const host = labHost(t);
  const run = host.start.listeners.click();
  const duplicate = host.start.listeners.click();
  assert.equal(host.workers.length, 1);
  assert.equal(host.captureCount(), 1);
  host.machine.name = 'Changed during build';
  host.machine.id = 'changed';
  host.picker.value = 'rings';

  await complete(host.workers[0]);
  await complete(host.workers[1]);
  await Promise.all([run, duplicate]);
  assert.deepEqual(host.workers.map((worker) => worker.input.design), ['squiggle', 'wave-bridged']);
  assert.deepEqual(host.workers.map((worker) => worker.input.machine.id), ['prusa-mk3s', 'prusa-mk3s']);
  assert.equal(host.downloads.length, 1);
  const [{ name, blob }] = host.downloads;
  assert.match(name, /^filafabric-waves-printer-prusa-mk3s-.*\.zip$/);
  const files = await readArchive(blob);
  const prints = [...files.keys()].filter((file) => file.endsWith('.gcode'));
  assert.equal(prints.length, 2);
  for (const print of prints) {
    assert.match(print, /^\d{2}-printer-prusa-mk3s-.*\.gcode$/);
    const record = 'records/' + print.replace(/\.gcode$/, '.md');
    assert.match(files.get(record), /Not printed — untested/);
    assert.match(files.get(print), /; swatch .*?\n; BODY START\nG1 X1\n$/);
  }
  assert.equal(JSON.parse(files.get('manifest.json')).printed, false);
});

test('a cancelled Swatch Lab run and its queued close cannot clear a reopened run', async (t) => {
  const host = labHost(t);
  const oldRun = host.start.listeners.click();
  const oldMessage = host.workers[0].onmessage;
  host.cancel.listeners.click();

  host.open();
  const replacement = host.start.listeners.click();
  host.pendingClose.shift()();
  oldMessage({ data: built });
  await oldRun;
  assert.equal(host.start.disabled, true);
  assert.match(host.status.textContent, /Building 1 of 2/);
  assert.equal(host.workers[0].terminated, true);
  assert.equal(host.workers[1].terminated, undefined);
  assert.equal(host.downloads.length, 0);

  await complete(host.workers[1]);
  await complete(host.workers[2]);
  await replacement;
  assert.equal(host.downloads.length, 1);
  assert.equal(host.start.disabled, false);
});

test('a native dialog close blocks a Swatch Lab download before the close event runs', async (t) => {
  const host = labHost(t);
  const run = host.start.listeners.click();
  await complete(host.workers[0]);
  host.dialog.close();
  await complete(host.workers[1]);
  await run;
  assert.equal(host.downloads.length, 0);
  host.pendingClose.shift()();
  host.open();
  assert.equal(host.start.disabled, false);
});

test('a failed comparison piece leaves no partial archive and allows a full retry', async (t) => {
  const host = labHost(t);
  const failure = host.start.listeners.click();
  await complete(host.workers[0]);
  host.workers[1].emit({ type: 'error', message: 'Piece exceeds printer limits' });
  await failure;
  assert.equal(host.downloads.length, 0);
  assert.equal(host.start.disabled, false);
  assert.match(host.status.textContent, /Piece exceeds printer limits/);

  const retry = host.start.listeners.click();
  await complete(host.workers[2]);
  await complete(host.workers[3]);
  await retry;
  assert.equal(host.downloads.length, 1);
  assert.equal(host.start.disabled, false);
});
