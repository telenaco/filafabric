import { DEFAULT_TEXTILE } from '../engine/params.js';
import { generate } from '../engine/generate.js';
import { createPreview, ROLES } from './preview.js';
import { RANGES, PRIMARY_DEFAULTS, ADVANCED_DEFAULTS, sampleSize, toTextile, describePrimary } from './controls.js';
import { buildVerdict, formatMinutes } from './verdict.js';
import { stateToHash, hashToState, sanitizeState } from './share.js';
import { ADVANCED_GROUPS, FIELD_LABELS } from './param-schema.js';

const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'filament-textile-studio:v1';
const PLAY_ICON = 'M5 3l10 6-10 6z';
const PAUSE_ICON = 'M4 3h3.5v12H4zM10.5 3H14v12h-3.5z';

const SLIDERS = [
  { key: 'pileHeight', label: 'Pile height', lo: 'Low', hi: 'Tall' },
  { key: 'loopSize', label: 'Loop size', lo: 'Small', hi: 'Large' },
  { key: 'loopSpacing', label: 'Loop density', lo: 'Dense', hi: 'Sparse' },
  { key: 'baseGap', label: 'Base openness', lo: 'Tight', hi: 'Airy' },
  { key: 'variation', label: 'Natural variation', lo: 'Even', hi: 'Wild' },
];
const ROLE_LABELS = { base: 'Base', anchored: 'Anchored', lifting: 'Lifting and lowering', free: 'Free-hanging' };
const ROLE_HEIGHT = { base: 2, anchored: 3, lifting: 3, free: 5 };

const state = {
  machines: new Map(),
  materials: new Map(),
  machine: 'prusa-mk3s',
  material: 'filaflex-95-foamy',
  primary: { ...PRIMARY_DEFAULTS },
  advanced: {},
  docName: 'Untitled swatch',
  result: null,
  error: null,
  fraction: 1,
  playing: false,
  details: false,
  why: false,
  tightSpotsTouched: false,
};
let preview = null;
let timer = null;
let rafId = 0;
let lastFrame = 0;
const undoLog = { stack: [], cursor: -1 };

/* ---------- storage ---------- */
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};

/* ---------- small helpers ---------- */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function loadProfiles() {
  const index = await fetchJson('profiles/index.json');
  for (const id of index.machines) state.machines.set(id, await fetchJson(`profiles/machines/${id}.json`));
  for (const id of index.materials) state.materials.set(id, await fetchJson(`profiles/materials/${id}.json`));
  return { machines: index.machines, materials: index.materials };
}

function snapshot() {
  return { v: 1, machine: state.machine, material: state.material, primary: state.primary, advanced: state.advanced, name: state.docName };
}

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}

function indexAtTime(starts, t) {
  let lo = 0, hi = starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/* ---------- history (undo / redo) ---------- */
function snapshotKey() {
  return JSON.stringify({ m: state.machine, t: state.material, p: state.primary, a: state.advanced });
}

function commit() {
  if (state.error) return; // never record a state that cannot generate
  const key = snapshotKey();
  const current = undoLog.stack[undoLog.cursor];
  if (current && current.key === key) return;
  undoLog.stack = undoLog.stack.slice(0, undoLog.cursor + 1);
  undoLog.stack.push({ key, data: JSON.parse(JSON.stringify(snapshot())) });
  if (undoLog.stack.length > 100) undoLog.stack.shift();
  undoLog.cursor = undoLog.stack.length - 1;
  store.set(STORAGE_KEY, JSON.stringify(snapshot()));
  renderHistoryButtons();
}

function applySnapshot(data) {
  const clean = sanitizeState(data, { machines: [...state.machines.keys()], materials: [...state.materials.keys()] });
  state.machine = clean.machine;
  state.material = clean.material;
  state.primary = clean.primary;
  state.advanced = clean.advanced;
  if (typeof data?.name === 'string') state.docName = data.name.slice(0, 60);
  syncControls();
  schedule();
}

function undo() {
  if (undoLog.cursor <= 0) return;
  undoLog.cursor--;
  applySnapshot(undoLog.stack[undoLog.cursor].data);
  renderHistoryButtons();
}
function redo() {
  if (undoLog.cursor >= undoLog.stack.length - 1) return;
  undoLog.cursor++;
  applySnapshot(undoLog.stack[undoLog.cursor].data);
  renderHistoryButtons();
}
function renderHistoryButtons() {
  $('#btn-undo').disabled = undoLog.cursor <= 0;
  $('#btn-redo').disabled = undoLog.cursor >= undoLog.stack.length - 1;
}

/* ---------- generation ---------- */
let genTimer = null;
function schedule() {
  $('#busy-chip').hidden = false;
  $('#stage').setAttribute('aria-busy', 'true');
  clearTimeout(genTimer);
  genTimer = setTimeout(regenerate, 140);
}

function regenerate() {
  const machine = state.machines.get(state.machine);
  const material = state.materials.get(state.material);
  try {
    const result = generate(machine, material, toTextile(state.primary, state.advanced));
    state.result = result;
    state.error = null;
    preview.update(result);
    if (!state.tightSpotsTouched) {
      const box = $('#show-violations');
      box.checked = result.stats.violations > 0 && result.stats.violations <= 2000;
      preview.setShowViolations(box.checked);
    }
    applyScrub();
  } catch (e) {
    state.error = e;
    if (!(e && Array.isArray(e.errors))) console.error(e);
  }
  $('#busy-chip').hidden = true;
  $('#stage').removeAttribute('aria-busy');
  render();
}

function applyScrub() {
  if (!state.result) return;
  const { stats } = state.result;
  const t = state.fraction * stats.timeSec;
  preview.setMoveIndex(state.fraction >= 1 ? Infinity : indexAtTime(stats.moveStartSec, t));
}

/* ---------- rendering ---------- */
function plainError(message) {
  const m = /^([a-z_]+) (.*)$/.exec(message);
  if (m && FIELD_LABELS[m[1]]) return { key: m[1], text: `${FIELD_LABELS[m[1]]}: ${m[2]}` };
  return { key: null, text: message };
}

function renderErrors() {
  const box = $('#errors');
  for (const input of document.querySelectorAll('[aria-invalid="true"]')) input.removeAttribute('aria-invalid');
  for (const e of document.querySelectorAll('.field-error[data-for]')) { e.hidden = true; e.textContent = ''; }
  const customError = $('#custom-error');
  customError.hidden = true;

  if (!state.error) {
    box.hidden = true;
    box.replaceChildren();
    $('#canvas-note').hidden = true;
    $('#canvas-wrap').classList.remove('dimmed');
    return;
  }
  const raw = Array.isArray(state.error.errors) ? state.error.errors : [String(state.error.message || state.error)];
  const general = [];
  for (const message of raw) {
    const { key, text } = plainError(message);
    const field = key ? document.querySelector(`[data-key="${key}"]`) : null;
    const inline = key ? document.querySelector(`.field-error[data-for="${key}"]`) : null;
    if (field && inline) {
      field.setAttribute('aria-invalid', 'true');
      inline.textContent = text;
      inline.hidden = false;
      const adv = field.closest('#advanced-body');
      if (adv && $('#advanced-body').hidden) openAdvanced(true);
    } else if (key === 'sample_width' || key === 'sample_height') {
      customError.textContent = text;
      customError.hidden = false;
      general.push(text);
    } else general.push(text);
  }
  box.hidden = general.length === 0;
  box.replaceChildren(...general.map((t) => el('div', { text: t })));
  const hasPreview = !!state.result;
  $('#canvas-note').hidden = !hasPreview;
  $('#canvas-wrap').classList.toggle('dimmed', hasPreview);
}

function renderVerdict() {
  const box = $('#verdict');
  box.className = 'verdict';
  if (!state.result || state.error) {
    box.hidden = !state.result;
    return;
  }
  box.hidden = false;
  const v = buildVerdict(state.result.stats, { roomy: state.primary.roomy });
  box.classList.add(v.level === 'info' ? 'info' : v.level);
  const children = [el('div', { class: 'v-title', text: v.title }), el('p', { text: v.body })];
  const actions = el('div', { class: 'v-actions' });
  if (v.action) {
    const turnOn = v.action === 'roomy-on';
    const btn = el('button', { type: 'button', class: `v-btn${turnOn ? '' : ' ghost'}`, text: v.actionLabel });
    btn.addEventListener('click', () => setRoomy(turnOn));
    actions.append(btn);
  }
  if (v.level !== 'info') {
    const why = el('button', { type: 'button', class: 'v-why', 'aria-expanded': String(state.why), text: 'What does this mean?' });
    why.addEventListener('click', () => { state.why = !state.why; renderVerdict(); });
    actions.append(why);
  }
  children.push(actions);
  if (state.why && v.level !== 'info') {
    children.push(el('p', { class: 'v-explain', text: 'The nozzle tip is wider than the gap between two loops that sit 0.6 mm apart, so printing one can touch its neighbour. At 1.5 mm there is room to pass. Loops that cross at the same height are normal in a pile, and the count is best used to compare layouts, not as pass or fail.' }));
  }
  box.replaceChildren(...children);
}

function renderStatus() {
  const status = $('#status');
  if (!state.result) { status.replaceChildren(); return; }
  const { stats, cfg } = state.result;
  const t = cfg.t;
  const parts = [
    el('strong', { text: `${t.sample_width} × ${t.sample_height} mm` }),
    el('span', { text: `${stats.loops} loops` }),
    el('span', { text: `about ${formatMinutes(stats.timeSec / 60)} min` }),
    el('span', { text: `${stats.filamentGrams < 1 ? stats.filamentGrams.toFixed(2) : stats.filamentGrams.toFixed(1)} g filament` }),
    el('span', { text: `${stats.hops} nozzle hops` }),
    el('span', { class: 'fit', text: 'Fits the bed' }),
  ];
  const toggle = el('button', { type: 'button', class: 'link', 'aria-expanded': String(state.details), text: state.details ? 'Hide details' : 'Details' });
  toggle.addEventListener('click', () => { state.details = !state.details; renderStatus(); });
  status.replaceChildren(...parts, toggle);

  const d = $('#details');
  d.hidden = !state.details;
  if (state.details) {
    const item = (k, v) => el('div', {}, el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v }));
    d.replaceChildren(
      item('G-code moves', stats.moves.toLocaleString('en')),
      item('Filament length', `${Math.round(stats.filamentMm).toLocaleString('en')} mm`),
      item('Horizontal travel', `${Math.round(stats.travelMm).toLocaleString('en')} mm`),
      item('Vertical hops', String(stats.hops)),
      item('Strands', String(stats.strands)),
      item('Steepest slope', `${stats.maxSlopeDeg.toFixed(1)}°`),
      el('div', { class: 'note', text: 'Time ignores acceleration. Travel is a small share of the print; the main cost of a hop is where one strand ends and the next begins.' })
    );
  }
  $('#preview').setAttribute('aria-label', `3D preview: ${stats.loops} loops on a ${t.sample_width} by ${t.sample_height} millimetre swatch, about ${formatMinutes(stats.timeSec / 60)} minutes.`);
}

function renderPlayback() {
  const total = state.result ? state.result.stats.timeSec / 60 : 0;
  $('#time-label').textContent = `${formatMinutes(total * state.fraction)} of ${formatMinutes(total)} min`;
  $('#play-icon').setAttribute('d', state.playing ? PAUSE_ICON : PLAY_ICON);
  $('#btn-play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play the print');
  $('#scrub').value = String(Math.round(state.fraction * 1000));
}

function renderExport() {
  const btn = $('#btn-export');
  const ok = !!state.result && !state.error && state.result.moves.length > 0;
  btn.disabled = !ok;
  const bytes = state.result ? state.result.gcode.length : 0;
  $('#export-size').textContent = ok ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`) : '';
}

function renderPrinter() {
  const machine = state.machines.get(state.machine);
  const material = state.materials.get(state.material);
  if (!machine || !material) return;
  $('#printer-name').textContent = machine.name.replace('Original ', '').replace(' i3', '').replace(' / MK3S+', '');
  $('#printer-material').textContent = `${material.name.replace('Recreus ', '').replace('Prusa ', '')} · 0.4 mm nozzle`;
  const chips = $('#printer-chips');
  chips.replaceChildren(
    el('span', { class: `chip ${machine.verified ? 'ok' : 'warn'}`, text: machine.verified ? 'Printer setup ready' : 'Printer setup not verified' }),
    el('span', { class: `chip ${material.verified ? 'ok' : 'warn'}`, text: material.verified ? 'Filament verified' : 'Filament not yet tried here' })
  );
  $('#printer-note').textContent = material.verified
    ? 'There are no printer settings to tune.'
    : 'There are no printer settings to tune. This filament has not been printed with this tool yet, so start with a test swatch.';
}

function renderSwatch() {
  for (const b of document.querySelectorAll('[data-swatch]')) b.setAttribute('aria-pressed', String(state.primary.swatch === b.dataset.swatch));
  const [w, h] = sampleSize(state.primary);
  const isCustom = state.primary.swatch === 'custom';
  $('#custom-size').open = $('#custom-size').open || isCustom;
  $('#custom-width').value = isCustom ? state.primary.customWidth : $('#custom-width').value || state.primary.customWidth;
  $('#custom-height').value = isCustom ? state.primary.customHeight : $('#custom-height').value || state.primary.customHeight;
  const stats = state.result?.stats;
  $('#swatch-hint').textContent = stats && !state.error
    ? `${state.primary.swatch === 'test' ? 'A good first print' : `${w} × ${h} mm`}: about ${formatMinutes(stats.timeSec / 60)} minutes and ${stats.filamentGrams < 1 ? stats.filamentGrams.toFixed(2) : stats.filamentGrams.toFixed(1)} g.`
    : '';
}

function renderSliders() {
  const d = describePrimary(state.primary);
  for (const def of SLIDERS) {
    const input = $(`#s-${def.key}`);
    if (input && document.activeElement !== input) input.value = String(state.primary[def.key]);
    const out = $(`#v-${def.key}`);
    if (out) out.textContent = d[def.key];
  }
  $('#room-value').textContent = state.primary.roomy ? 'Roomy: 1.5 mm gap' : 'Standard: 0.6 mm gap';
  for (const b of document.querySelectorAll('[data-room]')) b.setAttribute('aria-pressed', String((b.dataset.room === 'roomy') === state.primary.roomy));
}

function render() {
  renderErrors();
  renderVerdict();
  renderStatus();
  renderPlayback();
  renderExport();
  renderPrinter();
  renderSwatch();
  renderSliders();
  const custom = $('#custom-note');
  custom.hidden = true;
}

/* ---------- controls ---------- */
function setRoomy(on) {
  state.primary.roomy = on;
  renderSliders();
  schedule();
  commit();
}

function buildSliders() {
  const host = $('#sliders');
  host.replaceChildren();
  for (const def of SLIDERS) {
    const range = RANGES[def.key];
    const input = el('input', { id: `s-${def.key}`, type: 'range', min: range.min, max: range.max, step: range.step, value: state.primary[def.key] });
    input.addEventListener('input', () => {
      state.primary[def.key] = Number(input.value);
      renderSliders();
      schedule();
    });
    input.addEventListener('change', commit);
    host.append(
      el('div', { class: 'slider' },
        el('div', { class: 'row-top' }, el('label', { class: 'label', for: input.id, text: def.label }), el('span', { class: 'value', id: `v-${def.key}` })),
        input,
        el('div', { class: 'ends' }, el('span', { text: def.lo }), el('span', { text: def.hi }))
      )
    );
  }
}

function fieldValue(key) {
  if (key in state.advanced) return state.advanced[key];
  if (key in ADVANCED_DEFAULTS) return ADVANCED_DEFAULTS[key];
  return DEFAULT_TEXTILE[key];
}

function buildAdvanced() {
  const body = $('#advanced-body');
  body.replaceChildren();
  for (const group of ADVANCED_GROUPS) {
    const fields = el('div', { class: 'adv-fields' });
    for (const f of group.fields) {
      const id = `adv-${f.key}`;
      let input;
      if (f.type === 'select') {
        input = el('select', { id, 'data-key': f.key });
        for (const o of f.options) input.append(el('option', { value: o, text: o }));
        input.value = String(fieldValue(f.key));
        input.addEventListener('change', () => { state.advanced[f.key] = input.value; schedule(); commit(); });
      } else if (f.type === 'checkbox') {
        input = el('input', { id, type: 'checkbox', 'data-key': f.key });
        input.checked = !!fieldValue(f.key);
        input.addEventListener('change', () => { state.advanced[f.key] = input.checked; schedule(); commit(); });
      } else {
        input = el('input', { id, type: 'number', inputmode: 'decimal', step: f.step ?? 'any', 'data-key': f.key });
        if (f.min !== undefined) input.min = String(f.min);
        const v = fieldValue(f.key);
        input.value = v === null || v === undefined ? '' : String(v);
        input.addEventListener('input', () => {
          const raw = input.value.trim();
          if (raw === '' && f.nullable) delete state.advanced[f.key];
          else state.advanced[f.key] = raw === '' ? NaN : Number(raw);
          schedule();
        });
        input.addEventListener('change', commit);
      }
      const label = f.unit ? `${f.label} (${f.unit})` : f.label;
      const row = el('label', { class: `field-row${f.type === 'checkbox' ? '' : ''}`, for: id }, el('span', { text: label }), input);
      const wrap = el('div', { class: f.label.length > 26 ? 'wide' : '' }, row, el('p', { class: 'field-error', 'data-for': f.key, hidden: true }));
      if (f.label.length > 26) wrap.classList.add('wide');
      fields.append(wrap);
    }
    body.append(el('div', { class: 'adv-group' }, el('h3', { text: group.title }), el('p', { class: 'hint', text: group.hint }), fields));
  }
}

function openAdvanced(open) {
  $('#advanced-body').hidden = !open;
  $('#btn-advanced').setAttribute('aria-expanded', String(open));
}

function syncControls() {
  buildAdvanced();
  renderSliders();
  renderSwatch();
  $('#doc-name').value = state.docName;
  fillDialogSelects();
}

function fillDialogSelects() {
  const fill = (select, map, current) => {
    select.replaceChildren(...[...map.values()].map((p) => el('option', { value: p.id, text: p.name + (p.verified ? '' : ' (not yet verified)'), selected: p.id === current })));
  };
  fill($('#sel-machine'), state.machines, state.machine);
  fill($('#sel-material'), state.materials, state.material);
  updateDialogNote();
}

function updateDialogNote() {
  const material = state.materials.get($('#sel-material').value);
  const machine = state.machines.get($('#sel-machine').value);
  $('#dialog-note').textContent = [
    machine && (machine.verified ? 'Printer limits come from your own sliced file.' : 'Printer limits are not verified yet.'),
    material && (material.verified ? 'Filament behaviour is verified.' : 'Filament values come from the maker\'s guidance and have not been printed here yet.'),
  ].filter(Boolean).join(' ');
}

/* ---------- actions ---------- */
function slug(s) {
  return (s || 'swatch').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'swatch';
}

function exportGcode() {
  if (!state.result || state.error) return;
  const t = state.result.cfg.t;
  const name = `${slug(state.docName)}_${t.sample_width}x${t.sample_height}_${state.material}.gcode`;
  const url = URL.createObjectURL(new Blob([state.result.gcode], { type: 'text/plain' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${name}`);
}

async function shareLink() {
  const hash = stateToHash(snapshot());
  const url = `${location.origin}${location.pathname}${hash}`;
  try { history.replaceState(null, '', hash); } catch { /* ignore */ }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast('The address bar now holds the link: copy it from there');
  }
}

function saveFile() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
  const a = el('a', { href: url, download: `${slug(state.docName)}-settings.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function openFile(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object') throw new Error('that is not a settings file');
    applySnapshot(data);
    state.tightSpotsTouched = false;
    commit();
    toast('Settings loaded');
  } catch (e) {
    $('#errors').hidden = false;
    $('#errors').replaceChildren(el('div', { text: `Could not open that file: ${e.message}` }));
  }
}

function resetAll() {
  state.primary = { ...PRIMARY_DEFAULTS };
  state.advanced = {};
  state.tightSpotsTouched = false;
  syncControls();
  schedule();
  commit();
  toast('Back to the defaults');
}

function play() {
  if (!state.result) return;
  if (state.playing) { stopPlay(); renderPlayback(); return; }
  if (state.fraction >= 1) state.fraction = 0;
  state.playing = true;
  lastFrame = performance.now();
  const step = (now) => {
    const dt = now - lastFrame;
    lastFrame = now;
    state.fraction = Math.min(1, state.fraction + dt / 12000);
    applyScrub();
    renderPlayback();
    if (state.fraction >= 1) { stopPlay(); renderPlayback(); return; }
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
  renderPlayback();
}
function stopPlay() {
  state.playing = false;
  cancelAnimationFrame(rafId);
}

/* ---------- boot ---------- */
function buildRoles() {
  const host = $('#roles');
  host.replaceChildren();
  for (const role of ROLES) {
    const chip = el('button', { type: 'button', class: 'role-chip', 'aria-pressed': 'true', 'data-role': role },
      el('span', { class: 'swatch', style: `height:${ROLE_HEIGHT[role]}px;background:var(--role-${role})`, 'aria-hidden': 'true' }),
      ROLE_LABELS[role]);
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(on));
      preview.setRoles({ [role]: on });
    });
    host.append(chip);
  }
}

function bindStatic() {
  for (const b of document.querySelectorAll('[data-camera]')) {
    b.addEventListener('click', () => {
      for (const o of document.querySelectorAll('[data-camera]')) o.setAttribute('aria-pressed', String(o === b));
      preview.setCamera(b.dataset.camera);
    });
  }
  for (const b of document.querySelectorAll('[data-layer]')) {
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      preview.setLayers({ [b.dataset.layer]: on });
      $('#thickness-note').hidden = b.dataset.layer === 'strand' ? !on : $('#thickness-note').hidden;
    });
  }
  for (const b of document.querySelectorAll('[data-swatch]')) {
    b.addEventListener('click', () => { state.primary.swatch = b.dataset.swatch; renderSwatch(); schedule(); commit(); });
  }
  for (const b of document.querySelectorAll('[data-room]')) b.addEventListener('click', () => setRoomy(b.dataset.room === 'roomy'));

  const customInput = (id, key, label, range) => {
    const input = $(id);
    input.addEventListener('input', () => {
      const n = Number(input.value);
      const error = $('#custom-error');
      if (!input.value.trim() || !Number.isFinite(n) || n < range.min || n > range.max) {
        input.setAttribute('aria-invalid', 'true');
        error.textContent = `Enter a ${label} between ${range.min} and ${range.max} mm.`;
        error.hidden = false;
        return;
      }
      input.removeAttribute('aria-invalid');
      error.hidden = true;
      state.primary[key] = n;
      state.primary.swatch = 'custom';
      renderSwatch();
      schedule();
    });
    input.addEventListener('change', commit);
  };
  customInput('#custom-width', 'customWidth', 'width', RANGES.customWidth);
  customInput('#custom-height', 'customHeight', 'height', RANGES.customHeight);

  $('#scrub').addEventListener('input', (e) => {
    stopPlay();
    state.fraction = Number(e.target.value) / 1000;
    applyScrub();
    renderPlayback();
  });
  $('#btn-play').addEventListener('click', play);
  $('#exaggerate').addEventListener('change', (e) => preview.setExaggerate(e.target.checked));
  $('#show-violations').addEventListener('change', (e) => { state.tightSpotsTouched = true; preview.setShowViolations(e.target.checked); });

  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#btn-export').addEventListener('click', exportGcode);
  $('#btn-share').addEventListener('click', shareLink);
  $('#btn-reset').addEventListener('click', resetAll);
  $('#btn-save-file').addEventListener('click', saveFile);
  $('#file-open').addEventListener('change', (e) => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; });
  $('#btn-advanced').addEventListener('click', () => openAdvanced($('#advanced-body').hidden));
  $('#doc-name').addEventListener('input', (e) => { state.docName = e.target.value; });
  $('#doc-name').addEventListener('change', commit);

  const dialog = $('#printer-dialog');
  $('#btn-printer').addEventListener('click', () => { fillDialogSelects(); if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); });
  $('#sel-machine').addEventListener('change', (e) => { state.machine = e.target.value; updateDialogNote(); schedule(); commit(); });
  $('#sel-material').addEventListener('change', (e) => { state.material = e.target.value; updateDialogNote(); schedule(); commit(); });

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, select, textarea')) return;
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  });
}

async function init() {
  const known = await loadProfiles();
  preview = createPreview($('#preview'));

  // start from: a shared link, then the last session, then the defaults
  let initial = hashToState(location.hash);
  if (!initial) {
    try { initial = JSON.parse(store.get(STORAGE_KEY) ?? 'null'); } catch { initial = null; }
  }
  if (initial) {
    const clean = sanitizeState(initial, known);
    state.machine = clean.machine;
    state.material = clean.material;
    state.primary = clean.primary;
    state.advanced = clean.advanced;
    if (typeof initial.name === 'string') state.docName = initial.name.slice(0, 60);
  }

  buildSliders();
  buildRoles();
  buildAdvanced();
  fillDialogSelects();
  bindStatic();
  $('#doc-name').value = state.docName;
  regenerate();
  commit();
}

init().catch((e) => {
  const box = $('#errors');
  box.hidden = false;
  box.replaceChildren(el('div', { text: `The studio could not start: ${e.message}` }));
  console.error(e);
});

