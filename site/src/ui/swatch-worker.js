import { generateDesignExportAsync, compactDesignExport } from '../engine/design-export.js?v=20261112-hole-rim';
import { packTrace, traceBuffers } from '../engine/trace.js';

self.onmessage = async ({ data }) => {
  if (data.type !== 'start') return;
  try {
    const result = await generateDesignExportAsync(data.input, { progress: p => self.postMessage({ type:'progress', ...p }) });
    const done = data.preview ? result : compactDesignExport(result);
    // colour regions' whole patterns go back for the next job (export-builder.js keeps them), even in a compact result
    if (result.patternCache) done.patternCache = result.patternCache;
    // the print order for the 2D view: flat arrays, handed over instead of copied
    if (data.trace) done.trace = packTrace(result);
    self.postMessage({ type: 'done', result: done }, data.trace ? traceBuffers(done.trace) : []);
  } catch (error) {
    self.postMessage({ type: 'error', name: error.name, message: error.message, errors: error.errors, details: error.details, region: error.region });
  }
};
