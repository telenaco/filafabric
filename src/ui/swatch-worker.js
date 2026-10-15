import { generateDesignExport, compactDesignExport } from '../engine/design-export.js';

self.onmessage = ({ data }) => {
  if (data.type !== 'start') return;
  try {
    const result = generateDesignExport(data.input);
    self.postMessage({ type: 'done', result: data.preview ? result : compactDesignExport(result) });
  } catch (error) {
    self.postMessage({ type: 'error', name: error.name, message: error.message });
  }
};
