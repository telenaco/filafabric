import { generateDesignExportAsync, compactDesignExport } from '../engine/design-export.js';
import { packTrace, traceBuffers } from '../engine/trace.js';

self.onmessage = async ({ data }) => {
  if (data.type !== 'start') return;
  try {
    const result = await generateDesignExportAsync(data.input, { progress: p => self.postMessage({ type:'progress', ...p }) });
    const done = data.preview ? result : compactDesignExport(result);
    // the print order for the 2D view: flat arrays, handed over instead of copied
    if (data.trace) done.trace = packTrace(result);
    self.postMessage({ type: 'done', result: done }, data.trace ? traceBuffers(done.trace) : []);
  } catch (error) {
    self.postMessage({ type: 'error', name: error.name, message: error.message });
  }
};
