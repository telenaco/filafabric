/**
 * Advanced repeating garment panel export, opened from More. It builds in a worker, with chunk acknowledgements
 * for backpressure to the file writer. Legacy hosts may supply saveSwatch to retain a mode chooser. The printer, filament, layer
 * thickness and layer count are not asked here: they live in the printer setup, which the dialog only names and links.
 *
 * What it asks of the page (element ids): btn-panel, panel-dialog, export-mode-swatch / export-mode-panel,
 * export-swatch-fields, export-panel-fields, export-design / export-dims / export-estimate, export-fit,
 * export-setup-name / export-setup-sub / export-change-setup, export-filename, panel-width / -height / -repeat /
 * -backing, panel-svg-note, panel-progress, panel-status, panel-close / -cancel / -start. Every export-* element is
 * optional: without them the dialog is the full-panel dialog it used to be.
 */
export function bindPanelExport({
  options, machines = () => new Map(), machineId = () => '', download, filename, toast,
  saveSwatch = null, swatchInfo = () => null, setupSummary = () => null, openSetup = null, panelAvailable = () => true,
  onExport = () => {}, onError = () => {}, onDownloadErrorLog = null,
}) {
  const $ = (id) => document.getElementById(id), dialog = $('panel-dialog');
  const hasSwatch = typeof saveSwatch === 'function';
  let worker = null, file = null, busy = false, mode = hasSwatch ? 'swatch' : 'panel', named = false;
  const nameDrafts = new Map();
  let errorLogButton = null;
  if (onDownloadErrorLog) {
    errorLogButton = document.createElement('button');
    errorLogButton.type = 'button'; errorLogButton.className = 'btn'; errorLogButton.hidden = true;
    errorLogButton.textContent = 'Download error log';
    errorLogButton.title = 'Downloads recent local errors and current settings, including the current drawing. Share it only when you want to share that drawing.';
    errorLogButton.addEventListener('click', onDownloadErrorLog);
    dialog.querySelector('.dialog-actions').append(errorLogButton);
  }
  const status = (s) => { $('panel-status').textContent = s; };
  const set = (id, text) => { const node = $(id); if (node) node.textContent = text; };
  const show = (id, visible) => { const node = $(id); if (node) node.hidden = !visible; };
  const dims = () => ['panel-width', 'panel-height', 'panel-repeat', 'panel-backing'].map((id) => Number($(id).value));

  /** The panel's size against the printer's bed: the one thing the printer select in this dialog used to be for. */
  const bedProblem = () => {
    if (mode !== 'panel') return '';
    const m = machines().get(machineId());
    const [w, h] = dims();
    if (!m || !(w > 0) || !(h > 0)) return '';
    return w > m.bed.width || h > m.bed.depth
      ? `${w} × ${h} mm does not fit the ${m.name} bed (${m.bed.width} × ${m.bed.depth} mm). Make the panel smaller, or change the printer in the setup below.`
      : '';
  };
  const refresh = () => {
    const problem = bedProblem();
    set('export-fit', problem);
    show('export-fit', !!problem);
    $('panel-start').disabled = busy || !!problem;
  };
  const defaultName = () => {
    if (mode === 'swatch') return swatchInfo()?.name ?? 'swatch.gcode';
    return filename(...dims());
  };
  const refreshName = () => {
    const input = $('export-filename');
    if (input && !named) input.value = defaultName();
  };
  /** What the person typed, as a safe `.gcode` name; the default when it is empty. */
  const chosenName = () => {
    const typed = ($('export-filename')?.value ?? '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-');
    if (!typed) return defaultName();
    return /\.gcode$/i.test(typed) ? typed : `${typed}.gcode`;
  };

  const setMode = (next) => {
    if (next !== mode) {
      nameDrafts.set(mode, named ? $('export-filename')?.value : null);
      mode = next;
      const draft = nameDrafts.get(mode);
      named = !!draft;
      if (named && $('export-filename')) $('export-filename').value = draft;
    }
    $('export-mode-swatch')?.setAttribute('aria-pressed', String(mode === 'swatch'));
    $('export-mode-panel')?.setAttribute('aria-pressed', String(mode === 'panel'));
    show('export-swatch-fields', mode === 'swatch');
    show('export-panel-fields', mode === 'panel');
    refreshName();
    refresh();
  };

  const controls = (on) => {
    busy = on; $('panel-close').disabled = on; $('panel-cancel').hidden = !on;
    $('panel-progress').hidden = !on;
    for (const id of ['panel-width', 'panel-height', 'panel-repeat', 'panel-backing', 'export-filename', 'export-mode-swatch', 'export-mode-panel', 'export-change-setup']) { const node = $(id); if (node) node.disabled = on; }
    refresh();
  };

  const open = () => {
    const current = options();
    if (current.vector) { $('panel-width').value = current.vector.width; $('panel-height').value = current.vector.height; } else if (current.panelSize?.some((n) => n > 100)) { $('panel-width').value = current.panelSize[0]; $('panel-height').value = current.panelSize[1]; }
    $('panel-svg-note').textContent = current.vector ? `SVG strokes print once at the full document size, then a crossed panel backing and ${current.design === 'svgdesign' ? 'the drawing’s fill and chosen backing patterns, generated in sections' : `repeated ${current.design} texture`}.` : 'Radial motifs repeat per section. Outlines and holes apply to the whole panel.';
    $('panel-svg-note').textContent += ' Full panels use one filament; colour-change pauses are available in swatch exports.';
    // this swatch needs a swatch that built; a panel needs a design that can be one
    const info = hasSwatch ? swatchInfo() : null;
    const canPanel = panelAvailable();
    set('export-design', info?.design ?? '');
    set('export-dims', info?.dims ?? '');
    set('export-window-note', info?.context ?? '');
    show('export-window-note', !!info?.context);
    set('export-estimate', info?.estimate ?? '');
    const setup = setupSummary();
    if (setup) { set('export-setup-name', setup.name); set('export-setup-sub', setup.sub); }
    const swatchOption = $('export-mode-swatch'), panelOption = $('export-mode-panel');
    if (swatchOption) swatchOption.disabled = !info;
    if (panelOption) panelOption.hidden = !canPanel;
    show('export-mode', hasSwatch && canPanel && !!info);
    status(canPanel ? 'Print and qualify a small swatch before using a full garment panel.' : '');
    errorLogButton && (errorLogButton.hidden = true);
    setMode(hasSwatch && info ? (mode === 'panel' && canPanel ? 'panel' : 'swatch') : 'panel');
    dialog.showModal();
  };
  (hasSwatch ? $('btn-export') : ($('btn-panel') ?? $('btn-export')))?.addEventListener('click', open);
  $('export-mode-swatch')?.addEventListener('click', () => setMode('swatch'));
  $('export-mode-panel')?.addEventListener('click', () => setMode('panel'));
  $('export-change-setup')?.addEventListener('click', () => { dialog.close(); openSetup?.(); });
  $('export-filename')?.addEventListener('input', () => { named = $('export-filename').value.trim() !== ''; });
  for (const id of ['panel-width', 'panel-height', 'panel-repeat', 'panel-backing']) $(id).addEventListener?.('input', () => { refreshName(); refresh(); });
  $('panel-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
  $('panel-cancel').addEventListener('click', async () => { worker?.terminate(); worker = null; if (file) { try { await file.abort(); } catch {} file = null; } controls(false); status('Export cancelled. No completed file was saved.'); });

  $('panel-start').addEventListener('click', async () => {
    if (mode === 'swatch') {
      saveSwatch(chosenName());
      dialog.close();
      return;
    }
    const values = dims();
    if (['panel-width', 'panel-height', 'panel-repeat', 'panel-backing'].some((id) => !$(id).checkValidity())) { status('Enter dimensions and spacing within the shown limits.'); return; }
    const [width, height, repeat, backingSpacing] = values;
    const input = structuredClone({ ...options(width, height), width, height, repeat, backingSpacing });
    const name = $('export-filename') ? chosenName() : filename(width, height, repeat, backingSpacing), chunks = []; let bytes = 0;
    try {
      if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'G-code', accept: { 'text/plain': ['.gcode'] } }] });
        file = await handle.createWritable();
      }
      controls(true); status('Generating the backing…'); $('panel-progress').value = 0;
      if (errorLogButton) errorLogButton.hidden = true;
      worker = new Worker(new URL('./panel-worker.js', import.meta.url), { type: 'module' });
      const fail = async (message) => { worker?.terminate(); worker = null; if (file) { try { await file.abort(); } catch {} file = null; } controls(false); status(message); };
      let failureReported = false;
      const buildFailure = async (error) => {
        if (error.name === 'AbortError') { await fail('Export cancelled.'); return; }
        if (!failureReported) {
          failureReported = true;
          onError(error, input);
        }
        if (errorLogButton) errorLogButton.hidden = false;
        await fail(`Export failed: ${error.message}`);
      };
      worker.onerror = (event) => { void buildFailure(new Error(event.message || 'The panel worker could not build this pattern.')); };
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
            onExport(input, data.stats);
            worker?.terminate(); worker = null; controls(false);
            status(`Saved ${name}. Estimated ${(data.stats.timeSec / 3600).toFixed(1)} h, ${(data.stats.bytes / 1048576).toFixed(1)} MB. Time excludes acceleration.${data.stats.warnings?.length ? ` Check: ${data.stats.warnings.join('; ')}` : ''}`); toast('Panel G-code saved');
          } else if (data.type === 'error') {
            const error = new Error(data.message || 'The panel worker could not build this pattern.');
            error.name = data.name || 'Error';
            await buildFailure(error);
          }
        } catch (e) { await fail(e.message); }
      };
      worker.postMessage({ type: 'start', options: input });
    } catch (e) { if (file) { try { await file.abort(); } catch {} file = null; } controls(false); if (e.name !== 'AbortError') status(e.message); }
  });
}
