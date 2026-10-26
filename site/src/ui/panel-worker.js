import { exportPanel } from '../engine/panel.js';
let controller = null, acknowledge = null;
self.onmessage = async ({ data }) => {
  if (data.type === 'ack') { acknowledge?.(); acknowledge = null; return; }
  if (data.type === 'cancel') { controller?.abort(); acknowledge?.(); acknowledge = null; return; }
  if (data.type !== 'start') return;
  controller = new AbortController();
  try {
    const stats = await exportPanel(data.options, {
      signal: controller.signal,
      progress: (p) => self.postMessage({ type: 'progress', ...p }),
      write: (text) => new Promise((resolve) => { acknowledge = resolve; self.postMessage({ type: 'chunk', text }); }),
    });
    self.postMessage({ type: 'done', stats });
  } catch (e) { self.postMessage({ type: 'error', name: e.name, message: e.message }); }
};
