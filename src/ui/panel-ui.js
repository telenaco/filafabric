/** Full-panel jobs stay in a worker. Chunk acknowledgements provide backpressure to the file writer. */
export function bindPanelExport({ options, machines, machineId, selectMachine, download, filename, toast }) {
  const $ = (id) => document.getElementById(id), dialog = $('panel-dialog');
  let worker = null, file = null, busy = false;
  const status = (s) => { $('panel-status').textContent = s; };
  const controls = (on) => {
    busy = on; $('panel-start').disabled = on; $('panel-close').disabled = on; $('panel-cancel').hidden = !on;
    $('panel-progress').hidden = !on;
    for (const id of ['panel-width', 'panel-height', 'panel-repeat', 'panel-backing', 'panel-machine']) $(id).disabled = on;
  };
  const note = () => { const m = machines().get($('panel-machine').value); $('panel-machine-note').textContent = `${m.bed.width} × ${m.bed.depth} × ${m.bed.max_z} mm${m.source ? `. ${m.source}` : ''}`; };
  $('btn-panel').addEventListener('click', () => {
    $('panel-machine').replaceChildren(...[...machines().values()].map((m) => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.name; return o; }));
    $('panel-machine').value = machineId(); note();
    const current = options();
    if (current.vector) { $('panel-width').value = current.vector.width; $('panel-height').value = current.vector.height; } else if (current.panelSize?.some((n) => n > 100)) { $('panel-width').value = current.panelSize[0]; $('panel-height').value = current.panelSize[1]; }
    $('panel-svg-note').textContent = current.vector ? `SVG strokes print once at the full document size, then the backing and repeated ${current.design} texture. The SVG is not tiled.` : 'Radial motifs repeat per section. Outlines and holes apply to the whole panel.';
    $('panel-svg-note').textContent += ' Full panels use one filament; colour-change pauses are available in swatch exports.';
    status('Print and qualify a small swatch before using a full garment panel.'); dialog.showModal();
  });
  $('panel-machine').addEventListener('change', () => { selectMachine($('panel-machine').value); note(); });
  $('panel-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
  $('panel-cancel').addEventListener('click', async () => { worker?.terminate(); worker = null; if (file) { try { await file.abort(); } catch {} file = null; } controls(false); status('Export cancelled. No completed file was saved.'); });
  $('panel-start').addEventListener('click', async () => {
    const values = ['panel-width', 'panel-height', 'panel-repeat', 'panel-backing'].map((id) => Number($(id).value));
    if (['panel-width', 'panel-height', 'panel-repeat', 'panel-backing'].some((id) => !$(id).checkValidity())) { status('Enter dimensions and spacing within the shown limits.'); return; }
    const [width, height, repeat, backingSpacing] = values;
    const input = { ...options(width, height), width, height, repeat, backingSpacing };
    const name = filename(width, height), chunks = []; let bytes = 0;
    try {
      if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'G-code', accept: { 'text/plain': ['.gcode'] } }] });
        file = await handle.createWritable();
      }
      controls(true); status('Generating the backing…'); $('panel-progress').value = 0;
      worker = new Worker(new URL('./panel-worker.js', import.meta.url), { type: 'module' });
      const fail = async (message) => { worker?.terminate(); worker = null; if (file) { try { await file.abort(); } catch {} file = null; } controls(false); status(message); };
      worker.onerror = (e) => { void fail(`Export failed: ${e.message}`); };
      worker.onmessage = async ({ data }) => {
        try {
          if (data.type === 'chunk') {
            if (file) await file.write(data.text);
            else { bytes += data.text.length; if (bytes > 128 * 1024 * 1024) throw new Error('This download exceeds 128 MB. Use Chrome or Edge with direct file saving.'); chunks.push(data.text); }
            worker?.postMessage({ type: 'ack' });
          } else if (data.type === 'progress') {
            $('panel-progress').value = data.total ? data.done / data.total : 0;
            status(data.phase === 'texture' ? `Texture section ${data.done} of ${data.total}` : data.phase === 'svg' ? 'Printing the SVG first layer…' : 'Generating the continuous backing…');
          } else if (data.type === 'done') {
            if (file) { await file.close(); file = null; } else download(name, new Blob(chunks, { type: 'text/plain' }));
            worker?.terminate(); worker = null; controls(false);
            status(`Saved ${name}. Estimated ${(data.stats.timeSec / 3600).toFixed(1)} h, ${(data.stats.bytes / 1048576).toFixed(1)} MB. Time excludes acceleration.${data.stats.warnings?.length ? ` Check: ${data.stats.warnings.join('; ')}` : ''}`); toast('Panel G-code saved');
          } else if (data.type === 'error') await fail(data.name === 'AbortError' ? 'Export cancelled.' : data.message);
        } catch (e) { await fail(e.message); }
      };
      worker.postMessage({ type: 'start', options: input });
    } catch (e) { if (file) { try { await file.abort(); } catch {} file = null; } controls(false); if (e.name !== 'AbortError') status(e.message); }
  });
}
