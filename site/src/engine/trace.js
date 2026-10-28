// Display-only print-order trace of a finished G-code result: the toolpath as flat arrays, for the 2D view to play
// back and to export as SVG. It never enters an exporter; the G-code text is the printable result.
import { airStrandDiameter } from './extrusion.js';

/** What a segment of the trace is. 0 is a move that prints nothing (travel or a nozzle lift); the rest are the 3D view's roles. */
export const TRACE_KINDS = Object.freeze(['travel', 'base', 'anchored', 'lifting', 'free', 'channel']);
const KIND_OF_CLASS = { base: 1, supported: 2, rising: 3, falling: 3, unsupported: 4 };

/**
 * Packs a result's moves, in print order. Segment i runs from point i - 1 to point i and is drawn when kind[i] is not 0;
 * `time[i]` is when move i starts on the playback clock (the one the 3D scrubber uses), so both views play the same print.
 * `tone[i]` indexes `tones` (a preview colour) when the design colours its strands, and is absent otherwise.
 */
export function packTrace(result) {
  const { moves, stats, cfg } = result;
  const count = moves.length;
  const xy = new Float32Array(count * 2), kind = new Uint8Array(count), time = new Float32Array(count);
  const tones = [];
  let tone = null;
  for (let i = 0; i < count; i++) {
    const m = moves[i];
    xy[2 * i] = m.x; xy[2 * i + 1] = m.y;
    time[i] = stats.moveStartSec[i];
    if (i === 0 || !m.extrude) continue;
    kind[i] = m.role === 'channel' ? 5 : KIND_OF_CLASS[m.cls] ?? 1;
    if (m.previewColour) {
      let at = tones.indexOf(m.previewColour);
      if (at < 0 && tones.length < 255) { tones.push(m.previewColour); at = tones.length - 1; }
      if (at >= 0) { tone ??= new Uint8Array(count); tone[i] = at + 1; }
    }
  }
  const base = cfg.t.extrusion_width;
  const [width, height] = result.documentSize ?? [cfg.t.sample_width, cfg.t.sample_height];
  return {
    count, xy, kind, time, timeSec: stats.timeSec, width, height,
    widths: [0, base, base, airStrandDiameter('rising', cfg), airStrandDiameter('unsupported', cfg), base],
    rings: result.outline ?? null,
    ...(tone ? { tone, tones } : {}),
  };
}

/** The buffers of a trace, for a transfer list: the worker hands them over instead of copying them. */
export const traceBuffers = (trace) => [trace.xy.buffer, trace.kind.buffer, trace.time.buffer, ...(trace.tone ? [trace.tone.buffer] : [])];

/** How many moves have started by time t (the number of entries at or before t in the sorted `times`). */
export function indexAtTime(times, t) {
  let lo = 0, hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The strands of a trace as runs of points, grouped by kind and tone, calling `emit(kind, tone, points)` for every run in
 * print order. A run ends where the nozzle stops printing or the kind changes. `upTo` limits it to the moves before it.
 */
export function forEachRun(trace, emit, upTo = trace.count) {
  const { xy, kind, tone } = trace;
  const end = Math.min(upTo, trace.count);
  let run = null, runKind = 0, runTone = 0;
  const flush = () => { if (run) emit(runKind, runTone, run); run = null; };
  for (let i = 1; i < end; i++) {
    const k = kind[i], t = tone ? tone[i] : 0;
    if (!k) { flush(); continue; }
    if (!run || k !== runKind || t !== runTone) {
      flush();
      runKind = k; runTone = t;
      run = [xy[2 * i - 2], xy[2 * i - 1]];
    }
    run.push(xy[2 * i], xy[2 * i + 1]);
  }
  flush();
}
