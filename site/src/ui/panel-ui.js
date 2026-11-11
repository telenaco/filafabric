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
  let activeJob = null, mode = hasSwatch ? 'swatch' : 'panel', named = false;
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
    const machine = machines().get(machineId());
    if (machine) { $('panel-width').max = String(machine.bed.width); $('panel-height').max = String(machine.bed.depth); }
    const problem = bedProblem();
    set('export-fit', problem);
    show('export-fit', !!problem);
    $('panel-start').disabled = !!activeJob || !!problem;
  };
  const defaultName = (machine, size = dims()) => {
    if (mode === 'swatch') return swatchInfo()?.name ?? 'swatch.gcode';
    return machine ? filename(...size, machine) : filename(...size);
  };
  const refreshName = () => {
    const input = $('export-filename');
    if (input && !named) input.value = defaultName();
  };
  /** What the person typed, as a safe `.gcode` name; the default when it is empty. */
  const chosenName = (machine, size) => {
    if (mode === 'panel' && !named) return defaultName(machine, size);
    const typed = ($('export-filename')?.value ?? '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-');
    if (!typed) return defaultName(machine, size);
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

  const waitingForFile = () => activeJob?.phase === 'picking' || activeJob?.phase === 'opening';

  const controls = () => {
    const busy = !!activeJob;
    const waiting = waitingForFile();
    $('panel-close').disabled = busy && !waiting;
    $('panel-cancel').hidden = !busy || waiting;
    $('panel-cancel').disabled = activeJob?.phase === 'finalizing';
    $('panel-progress').hidden = !busy || waiting;
    for (const id of ['panel-width', 'panel-height', 'panel-repeat', 'panel-backing', 'export-filename', 'export-mode-swatch', 'export-mode-panel', 'export-change-setup']) { const node = $(id); if (node) node.disabled = busy; }
    refresh();
  };

  const abortWritable = async (file) => {
    try { await file?.abort(); } catch { /* the writer may already have failed */ }
  };
  const finish = (job, message) => {
    if (activeJob !== job) return false;
    activeJob = null;
    if (job.worker) {
      job.worker.onmessage = job.worker.onerror = job.worker.onmessageerror = null;
      job.worker.terminate();
    }
    controls();
    status(message);
    return true;
  };
  const fail = async (job, message) => {
    // Retire ownership before aborting the file. Pending writes can settle while cleanup is running.
    if (finish(job, message)) await abortWritable(job.file);
  };
  const cancel = () => {
    // close() commits the file. Once it starts, wait for the actual outcome.
    if (activeJob && activeJob.phase !== 'finalizing') return fail(activeJob, 'Export cancelled. No completed file was saved.');
  };

  const open = () => {
    if (dialog.open) return;
    if (activeJob?.phase === 'finalizing') { dialog.showModal(); return; }
    void cancel();
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
  $('panel-close').addEventListener('click', () => {
    if (activeJob && !waitingForFile()) return;
    void cancel();
    dialog.close();
  });
  dialog.addEventListener('cancel', (event) => {
    if (activeJob && !waitingForFile()) event.preventDefault();
    else void cancel();
  });
  dialog.addEventListener('close', () => { if (!dialog.open) void cancel(); });
  $('panel-cancel').addEventListener('click', cancel);

  $('panel-start').addEventListener('click', async () => {
    if (activeJob) return;
    const problem = bedProblem();
    if (problem) { status(problem); refresh(); return; }
    if (mode === 'swatch') {
      saveSwatch(chosenName());
      dialog.close();
      return;
    }
    const values = dims();
    if (['panel-width', 'panel-height', 'panel-repeat', 'panel-backing'].some((id) => !$(id).checkValidity())) { status('Enter dimensions and spacing within the shown limits.'); return; }

    const job = { phase: 'picking', worker: null, file: null };
    activeJob = job;
    controls();
    if (errorLogButton) errorLogButton.hidden = true;
    try {
      const [width, height, repeat, backingSpacing] = values;
      const input = structuredClone({ ...options(width, height), width, height, repeat, backingSpacing });
      const name = chosenName(input.machine, values);
      if (typeof window.showSaveFilePicker === 'function') {
        status('Choose where to save the G-code…');
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'G-code', accept: { 'text/plain': ['.gcode'] } }] });
        if (activeJob !== job) return;
        if (dialog.open === false) { await cancel(); return; }
        job.phase = 'opening';
        status('Opening the file for writing…');
        const file = await handle.createWritable();
        if (activeJob !== job) { await abortWritable(file); return; }
        job.file = file;
        if (dialog.open === false) { await cancel(); return; }
      }

      job.phase = 'building';
      controls();
      status('Generating the backing…');
      $('panel-progress').value = 0;
      const chunks = [];
      let bytes = 0;
      const worker = new Worker(new URL('./panel-worker.js', import.meta.url), { type: 'module' });
      job.worker = worker;
      const buildFailure = async (error) => {
        if (activeJob !== job || job.phase === 'finalizing') return;
        if (error.name === 'AbortError') { await cancel(); return; }
        if (errorLogButton) errorLogButton.hidden = false;
        const cleanup = fail(job, `Export failed: ${error.message}`);
        onError(error, input);
        await cleanup;
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        return buildFailure(new Error(event.message || 'The panel worker could not build this pattern.'));
      };
      worker.onmessageerror = () => buildFailure(new Error('Unable to read the panel worker result.'));
      worker.onmessage = async ({ data }) => {
        if (activeJob !== job || job.phase === 'finalizing') return;
        if (dialog.open === false) { await cancel(); return; }
        try {
          if (data.type === 'chunk' && job.phase === 'building') {
            job.phase = 'writing';
            if (job.file) await job.file.write(data.text);
            else {
              bytes += data.text.length;
              if (bytes > 128 * 1024 * 1024) throw new Error('This download exceeds 128 MB. Use Chrome or Edge with direct file saving.');
              chunks.push(data.text);
            }
            if (activeJob !== job) return;
            if (dialog.open === false) { await cancel(); return; }
            job.phase = 'building';
            worker.postMessage({ type: 'ack' });
          } else if (data.type === 'progress') {
            $('panel-progress').value = data.total ? data.done / data.total : 0;
            status(data.phase === 'texture' ? `Texture section ${data.done} of ${data.total}` : data.phase === 'svg' ? 'Printing the SVG first layer…' : 'Generating the continuous backing…');
          } else if (data.type === 'done' && job.phase === 'building') {
            job.phase = 'finalizing';
            controls();
            status('Finishing the save…');
            if (job.file) {
              await job.file.close();
              job.file = null;
            } else download(name, new Blob(chunks, { type: 'text/plain' }));
            const { timeSec, bytes: savedBytes, warnings } = data.stats;
            const summary = `Saved ${name}. Estimated ${(timeSec / 3600).toFixed(1)} h, ${(savedBytes / 1048576).toFixed(1)} MB. Time excludes acceleration.`;
            finish(job, summary + (warnings?.length ? ' Check: ' + warnings.join('; ') : ''));
            onExport(input, data.stats);
            toast('Panel G-code saved');
          } else if (data.type === 'error') {
            const error = new Error(data.message || 'The panel worker could not build this pattern.');
            error.name = data.name || 'Error';
            await buildFailure(error);
          }
        } catch (error) { await fail(job, error.message); }
      };
      worker.postMessage({ type: 'start', options: input });
    } catch (error) {
      if (error.name === 'AbortError') {
        if (activeJob === job) await cancel();
      } else await fail(job, error.message);
    }
  });
}
