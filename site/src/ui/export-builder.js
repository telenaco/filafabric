const createSwatchWorker = () => new Worker(new URL('./swatch-worker.js?v=20261112-region-build', import.meta.url), { type: 'module' });
const abortError = () => new DOMException('Export cancelled', 'AbortError');
// Whole-piece patterns of colour regions, kept between jobs so that only a changed colour is generated again (newest last).
const patternCache = new Map(), PATTERN_CACHE_LIMIT = 8;

/**
 * Capture a full-size export job and release its worker on completion, failure or cancellation. `trace` adds the print order
 * (src/engine/trace.js) to the compact result, for the 2D view.
 */
export function buildSwatch(input, { signal, preview = false, trace = false, progress = () => {}, createWorker = createSwatchWorker } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    let worker, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(abortError());
    try {
      const snapshot = structuredClone(input);
      if (input.regions?.length && !input.image) snapshot.patternCache = Object.fromEntries(patternCache);
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') progress(data);
        else if (data.type === 'done') {
          if (!data.result || typeof data.result.gcode !== 'string') finish(new Error('Export worker returned no printable result.'));
          else {
            for (const [key, value] of Object.entries(data.result.patternCache ?? {})) {
              patternCache.delete(key); patternCache.set(key, value);
              if (patternCache.size > PATTERN_CACHE_LIMIT) patternCache.delete(patternCache.keys().next().value);
            }
            delete data.result.patternCache;
            finish(null, data.result);
          }
        } else if (data.type === 'error') {
          const error = new Error(data.message || 'Unable to generate export.');
          error.name = data.name || 'Error';
          if (Array.isArray(data.errors)) error.errors = data.errors;
          if (data.details) error.details = data.details;
          if (data.region) error.region = data.region;
          finish(error);
        }
      };
      worker.onerror = (event) => { event.preventDefault?.(); finish(new Error(event.message || 'Export worker failed.')); };
      worker.onmessageerror = () => finish(new Error('Unable to read the export worker result.'));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      worker.postMessage({ type: 'start', input: snapshot, preview, trace });
    } catch (error) { finish(error); }
  });
}
