const createSwatchWorker = () => new Worker(new URL('./swatch-worker.js', import.meta.url), { type: 'module' });
const abortError = () => new DOMException('Export cancelled', 'AbortError');

/** Capture a full-size export job and release its worker on completion, failure or cancellation. */
export function buildSwatch(input, { signal, preview = false, createWorker = createSwatchWorker } = {}) {
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
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        if (data.type === 'done') {
          if (!data.result || typeof data.result.gcode !== 'string') finish(new Error('Export worker returned no printable result.'));
          else finish(null, data.result);
        } else if (data.type === 'error') {
          const error = new Error(data.message || 'Unable to generate export.');
          error.name = data.name || 'Error';
          finish(error);
        }
      };
      worker.onerror = (event) => { event.preventDefault?.(); finish(new Error(event.message || 'Export worker failed.')); };
      worker.onmessageerror = () => finish(new Error('Unable to read the export worker result.'));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      worker.postMessage({ type: 'start', input: snapshot, preview });
    } catch (error) { finish(error); }
  });
}
