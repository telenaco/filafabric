import test from 'node:test';
import assert from 'node:assert/strict';
import { packTrace, traceBuffers, indexAtTime, forEachRun, TRACE_KINDS } from '../../site/src/engine/trace.js';
import { traceToSvg } from '../../site/src/engine/trace-svg.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { buildSwatch } from '../../site/src/ui/export-builder.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const build = (design, extra = {}) => generateDesignExport({ ...defaultProfiles(), design, settings: designById(design).defaults(), width: 60, height: 40, extraLayers: 0, brim: 0, ...extra });

/** A hand-made trace: a 10 mm base strand, two travel moves, then a 5 mm strand in the air. Points 0..4 */
const small = () => ({
  count: 5, xy: new Float32Array([0, 0, 10, 0, 10, 5, 20, 5, 25, 5]), kind: new Uint8Array([0, 1, 0, 0, 4]), time: new Float32Array([0, 1, 2, 3, 4]),
  timeSec: 5, width: 30, height: 10, widths: [0, 0.45, 0.45, 0.5, 0.5, 0.45], rings: null,
});

test('a trace holds every move of the finished result, in print order, on the clock the 3D scrubber uses', () => {
  const result = build('zigzag');
  const trace = packTrace(result);
  assert.equal(trace.count, result.moves.length);
  assert.equal(trace.xy.length, trace.count * 2);
  assert.equal(trace.timeSec, result.stats.timeSec);
  assert.deepEqual([trace.width, trace.height], [60, 40]);
  for (let i = 1; i < trace.count; i++) assert.ok(trace.time[i] >= trace.time[i - 1], 'time never runs backwards');
  for (let i = 1; i < trace.count; i++) assert.equal(trace.kind[i] > 0, !!result.moves[i].extrude, `move ${i} is drawn exactly when it prints`);
  assert.equal(trace.kind[0], 0, 'the first move has no segment before it');
  assert.ok(trace.kind.some((k) => k > 0), 'the design prints something');
  assert.ok(trace.widths[1] >= 0.4 && trace.widths[4] >= trace.widths[1], 'strands in the air are at least as wide as the base');
  assert.equal(trace.tone, undefined, 'a design with one colour carries no tones');
  for (const t of [0, 0.2, 0.5, 0.91, 1]) {
    assert.equal(indexAtTime(trace.time, t * trace.timeSec), indexAtTime(result.stats.moveStartSec, t * trace.timeSec), `the same move is reached at ${t * 100}% in 2D and 3D`);
  }
});

test('the printed length in a trace is the printed length of the result (flat, as seen from above)', () => {
  const result = build('coil');
  const trace = packTrace(result);
  let fromTrace = 0, fromMoves = 0;
  for (let i = 1; i < trace.count; i++) {
    if (trace.kind[i]) fromTrace += Math.hypot(trace.xy[2 * i] - trace.xy[2 * i - 2], trace.xy[2 * i + 1] - trace.xy[2 * i - 1]);
    if (result.moves[i].extrude) fromMoves += Math.hypot(result.moves[i].x - result.moves[i - 1].x, result.moves[i].y - result.moves[i - 1].y);
  }
  assert.ok(Math.abs(fromTrace - fromMoves) < fromMoves * 1e-4, `${fromTrace} vs ${fromMoves}`);
});

test('a design that changes colour keeps its preview colours as tones', () => {
  const result = build('zigzag', { settings: { ...designById('zigzag').defaults(), colorChange: true } });
  if (!result.moves.some((m) => m.previewColour)) return; // this design does not colour its strands in the preview
  const trace = packTrace(result);
  assert.ok(trace.tones.length > 0 && trace.tone.length === trace.count);
  assert.ok(trace.tone.every((t, i) => t === 0 || trace.kind[i] > 0), 'only drawn segments carry a tone');
});

test('the buffers a worker hands over are the trace arrays', () => {
  const trace = small();
  assert.equal(traceBuffers(trace).length, 3);
  assert.equal(traceBuffers({ ...trace, tone: new Uint8Array(5) }).length, 4);
});

test('runs split where the nozzle stops printing or the role changes', () => {
  const trace = { ...small(), kind: new Uint8Array([0, 1, 1, 4, 4]) };
  const runs = [];
  forEachRun(trace, (kind, tone, pts) => runs.push([kind, tone, [...pts]]));
  assert.deepEqual(runs, [[1, 0, [0, 0, 10, 0, 10, 5]], [4, 0, [10, 5, 20, 5, 25, 5]]]);
  const upTo = [];
  forEachRun(trace, (kind, tone, pts) => upTo.push(pts.length / 2), 3);
  assert.deepEqual(upTo, [3], 'only the moves before the limit');
});

test('indexAtTime counts the moves started by a time', () => {
  const times = Float32Array.from([0, 1, 1, 4]);
  assert.equal(indexAtTime(times, -1), 0);
  assert.equal(indexAtTime(times, 0), 1);
  assert.equal(indexAtTime(times, 1), 3);
  assert.equal(indexAtTime(times, 3.9), 3);
  assert.equal(indexAtTime(times, 100), 4);
});

test('the SVG is the piece at true size in millimetres, strands as paths at their printed width, back of the bed at the top', () => {
  const svg = traceToSvg(small(), { title: 'A & B', description: 'five <moves>' });
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="30mm" height="10mm" viewBox="0 0 30 10">/);
  assert.match(svg, /<title>A &amp; B<\/title>/);
  assert.match(svg, /<desc>five &lt;moves&gt;<\/desc>/);
  assert.match(svg, /<path id="base" stroke="#27366b" stroke-width="0.45" d="M0 10 10 10"\/>/, 'y is flipped: the strand along y = 0 sits on the bottom edge');
  assert.match(svg, /<path id="free" stroke="#b0316f" stroke-width="0.5" d="M20 5 25 5"\/>/);
  assert.match(svg, /<path id="outline" fill="none" stroke="#34469a" stroke-width="0.3" d="M0 10 30 10 30 0 0 0Z"\/>/, 'with no outline the piece is its rectangle');
  assert.ok(svg.endsWith('</svg>\n'));
});

test('the SVG of a real design keeps every printed strand inside the piece and its length intact', () => {
  const result = build('zigzag');
  const trace = packTrace(result);
  const svg = traceToSvg(trace);
  const strands = svg.slice(svg.indexOf('<g id="strands"'));
  let printed = 0;
  for (let i = 1; i < trace.count; i++) if (trace.kind[i]) printed += Math.hypot(trace.xy[2 * i] - trace.xy[2 * i - 2], trace.xy[2 * i + 1] - trace.xy[2 * i - 1]);
  let drawn = 0;
  for (const [, d] of strands.matchAll(/ d="([^"]+)"/g)) {
    // every subpath starts with M; the points after the first are line-to
    for (const sub of d.split('M').filter(Boolean)) {
      const n = sub.trim().split(/\s+/).map(Number);
      assert.ok(n.every(Number.isFinite));
      for (let i = 0; i < n.length; i += 2) { assert.ok(n[i] >= -0.5 && n[i] <= 60.5 && n[i + 1] >= -0.5 && n[i + 1] <= 40.5, `point ${n[i]},${n[i + 1]} is on the page`); if (i) drawn += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]); }
    }
  }
  assert.ok(Math.abs(drawn - printed) < printed * 0.01, `${drawn} mm drawn of ${printed} mm printed`);
});

test('the 2D build asks the worker for the print order', async () => {
  const stub = { terminated: 0, postMessage(m) { this.message = m; }, terminate() { this.terminated++; } };
  const pending = buildSwatch({ width: 60 }, { trace: true, createWorker: () => stub });
  assert.equal(stub.message.trace, true);
  assert.equal(stub.message.preview, false, 'the compact result only: no 3D geometry crosses back');
  stub.onmessage({ data: { type: 'done', result: { gcode: 'G1', trace: small() } } });
  assert.equal((await pending).trace.count, 5);
  const plain = buildSwatch({ width: 60 }, { createWorker: () => stub });
  assert.equal(stub.message.trace, false);
  stub.onmessage({ data: { type: 'done', result: { gcode: 'G1' } } });
  await plain;
});

test('the trace kinds are the 3D roles plus travel', () => {
  assert.deepEqual([...TRACE_KINDS], ['travel', 'base', 'anchored', 'lifting', 'free', 'channel']);
});
