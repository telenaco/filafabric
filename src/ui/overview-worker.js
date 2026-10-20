import { buildOverview, OVERVIEW_FACTORS } from '../engine/overview.js';

// `start` skips the sizes an earlier attempt ran out of time on; the packed arrays move to the page without a copy
self.onmessage = ({ data }) => {
  try {
    const result = buildOverview(data.input, { factors: OVERVIEW_FACTORS.slice(data.start ?? 0) });
    self.postMessage({ type: 'done', result }, [result.packed.xy.buffer, result.packed.starts.buffer, result.packed.layer.buffer]);
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
