import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSwatch } from '../src/ui/export-builder.js';
import { defaultProfiles } from './helpers.js';

class WorkerStub {
  terminated = 0;
  postMessage(message) { this.message = message; }
  terminate() { this.terminated++; }
  receive(data) { this.onmessage({ data }); }
}

test('full-size builder snapshots the input and terminates its worker after a compact result', async () => {
  const worker = new WorkerStub();
  const input = { width: 200, settings: { seed: 7 }, image: { data: new Uint8ClampedArray([10]) } };
  const pending = buildSwatch(input, { createWorker: () => worker });
  input.settings.seed = 99;
  input.image.data[0] = 20;
  assert.equal(worker.message.type, 'start');
  assert.equal(worker.message.preview, false);
  assert.equal(worker.message.input.settings.seed, 7);
  assert.equal(worker.message.input.image.data[0], 10);
  const result = { gcode: 'G1 X200', cfg: {}, stats: {}, moveCount: 1, fabric: {}, warnings: [] };
  worker.receive({ type: 'done', result });
  assert.deepEqual(await pending, result);
  assert.equal(worker.terminated, 1);
});

test('full preview jobs request retained geometry and preserve their selected dimensions', async () => {
  const worker = new WorkerStub();
  const pending = buildSwatch({ width: 200, height: 200 }, { preview: true, createWorker: () => worker });
  assert.equal(worker.message.preview, true);
  assert.equal(worker.message.input.width, 200);
  const result = { gcode: 'G1 X200', cfg: { t: { sample_width: 200, sample_height: 200 } }, moves: [{ x: 190, y: 180 }], strands: [{ pts: [{ x: 190, y: 180 }] }], stats: { moveStartSec: [0] } };
  worker.receive({ type: 'done', result });
  assert.deepEqual(await pending, result);
  assert.equal(worker.terminated, 1);
});

test('worker generation errors preserve their names and close the worker', async () => {
  const worker = new WorkerStub();
  const pending = buildSwatch({}, { createWorker: () => worker });
  worker.receive({ type: 'error', name: 'ConfigError', message: 'Move budget exceeded' });
  await assert.rejects(pending, { name: 'ConfigError', message: 'Move budget exceeded' });
  assert.equal(worker.terminated, 1);
});

test('worker runtime errors close the worker', async () => {
  const worker = new WorkerStub();
  const pending = buildSwatch({}, { createWorker: () => worker });
  worker.onerror({ message: 'Unable to load worker', preventDefault() {} });
  await assert.rejects(pending, /Unable to load worker/);
  assert.equal(worker.terminated, 1);
});

test('aborting rejects with AbortError and releases the worker without returning late output', async () => {
  const worker = new WorkerStub(), controller = new AbortController();
  const pending = buildSwatch({}, { signal: controller.signal, createWorker: () => worker });
  const lateCallback = worker.onmessage;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  lateCallback({ data: { type: 'done', result: { gcode: 'late' } } });
  assert.equal(worker.terminated, 1);
});

test('an already aborted export never creates a worker', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(buildSwatch({}, { signal: controller.signal, createWorker: () => { throw new Error('Must not create worker'); } }), { name: 'AbortError' });
});

test('postMessage failures terminate the worker', async () => {
  const worker = new WorkerStub(); worker.postMessage = () => { throw new Error('Cannot clone job'); };
  await assert.rejects(buildSwatch({}, { createWorker: () => worker }), /Cannot clone job/);
  assert.equal(worker.terminated, 1);
});

test('completion without a result rejects and releases the worker', async () => {
  const worker = new WorkerStub();
  const pending = buildSwatch({}, { createWorker: () => worker });
  worker.receive({ type: 'done' });
  await assert.rejects(pending, /result/i);
  assert.equal(worker.terminated, 1);
});

test('worker message decoding errors release the worker', async () => {
  const worker = new WorkerStub();
  const pending = buildSwatch({}, { createWorker: () => worker });
  worker.onmessageerror();
  await assert.rejects(pending, /read.*result/i);
  assert.equal(worker.terminated, 1);
});

test('worker generation protocol returns compact output and serializes preflight failures', async () => {
  const messages = [];
  globalThis.self = { postMessage: (message) => messages.push(message) };
  try {
    await import('../src/ui/swatch-worker.js');
    await self.onmessage({ data: { type: 'start', input: { ...defaultProfiles(), design: 'crosshatch', width: 20, height: 20 } } });
    const done = messages.shift();
    assert.equal(done.type, 'done');
    assert.equal(done.result.moves, undefined);
    assert.equal(done.result.strands, undefined);
    assert.equal(done.result.placements, undefined);
    assert.equal(done.result.outline, undefined);
    assert.equal(done.result.stats.moveStartSec, undefined);
    assert.ok(done.result.gcode.includes('G1'));
    await self.onmessage({ data: { type: 'start', input: { ...defaultProfiles(), design: 'crosshatch', width: 300, height: 200 } } });
    assert.equal(messages[0].type, 'error');
    assert.equal(messages[0].name, 'PreflightError');
    assert.equal(typeof messages[0].message, 'string');
    messages.length = 0;
    await self.onmessage({ data: { type: 'start', preview: true, input: { ...defaultProfiles(), design: 'loop-pile', width: 30, height: 20 } } });
    const preview = messages[0];
    assert.equal(preview.type, 'done');
    assert.equal(preview.result.cfg.t.sample_width, 30);
    assert.equal(preview.result.cfg.t.sample_height, 20);
    assert.ok(preview.result.moves.length);
    assert.ok(preview.result.strands.length);
    assert.ok(preview.result.placements.length);
    assert.ok(preview.result.stats.moveStartSec.length);
    assert.ok(preview.result.moves.some((m) => m.extrude && m.cls === 'rising'));
  } finally { delete globalThis.self; }
});
