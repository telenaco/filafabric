import { buildOverview } from '../engine/overview.js';

self.onmessage = ({ data }) => {
  try { self.postMessage({ type: 'done', result: buildOverview(data.input, { fine: data.fine }) }); }
  catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
