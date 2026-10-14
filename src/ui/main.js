import { DEFAULT_TEXTILE } from '../engine/params.js';
import { generate } from '../engine/generate.js';
import { PARAM_GROUPS } from './param-schema.js';
import { createPreview } from './preview.js';

const $ = (selector) => document.querySelector(selector);
const state = {
  machines: new Map(),
  materials: new Map(),
  machineId: 'prusa-mk3s',
  materialId: 'filaflex-95-foamy',
  textile: { ...DEFAULT_TEXTILE },
  result: null,
};
let preview = null;
let timer = null;
let violationsTouched = false;

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function loadProfiles() {
  const index = await fetchJson('profiles/index.json');
  for (const id of index.machines) state.machines.set(id, await fetchJson(`profiles/machines/${id}.json`));
  for (const id of index.materials) state.materials.set(id, await fetchJson(`profiles/materials/${id}.json`));
}

function fillSelect(element, map, selected) {
  element.replaceChildren(
    ...[...map.values()].map((p) => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name + (p.verified ? '' : ' (unverified)');
      option.selected = p.id === selected;
      return option;
    })
  );
}

function fieldRow(field) {
  const label = document.createElement('label');
  label.className = 'field';
  const text = document.createElement('span');
  text.textContent = field.unit ? `${field.label} (${field.unit})` : field.label;
  label.appendChild(text);
  let input;
  if (field.type === 'select') {
    input = document.createElement('select');
    for (const value of field.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      input.appendChild(option);
    }
    input.addEventListener('change', () => { state.textile[field.key] = input.value; schedule(); });
  } else if (field.type === 'checkbox') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => { state.textile[field.key] = input.checked; schedule(); });
  } else {
    input = document.createElement('input');
    input.type = 'number';
    input.step = String(field.step ?? 'any');
    if (field.min !== undefined) input.min = String(field.min);
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      state.textile[field.key] = raw === '' ? (field.nullable ? null : NaN) : Number(raw);
      schedule();
    });
  }
  input.dataset.key = field.key;
  label.appendChild(input);
  return label;
}

function buildForm() {
  const host = $('#param-groups');
  host.replaceChildren();
  for (const group of PARAM_GROUPS) {
    const details = document.createElement('details');
    details.open = !!group.open;
    const summary = document.createElement('summary');
    summary.textContent = group.title;
    details.appendChild(summary);
    for (const field of group.fields) details.appendChild(fieldRow(field));
    host.appendChild(details);
  }
  syncForm();
}

function syncForm() {
  for (const input of document.querySelectorAll('#param-groups [data-key]')) {
    const value = state.textile[input.dataset.key];
    if (input.type === 'checkbox') input.checked = !!value;
    else input.value = value === null || value === undefined || Number.isNaN(value) ? '' : String(value);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min ${s} s`;
}

function renderStats(result) {
  const s = result.stats;
  const rows = [
    ['Loops', s.loops],
    ['Moves', s.moves],
    ['Est. time*', formatTime(s.timeSec)],
    ['Filament', `${s.filamentMm.toFixed(0)} mm`],
    ['Mass', `${s.filamentGrams.toFixed(2)} g`],
    ['Max slope', `${s.maxSlopeDeg.toFixed(1)}°`],
    ['Violations', s.violations],
    ['Unsupported path', `${s.lengthByClass.unsupported.toFixed(0)} mm`],
  ];
  $('#stats').replaceChildren(
    ...rows.map(([name, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = name;
      const dd = document.createElement('dd');
      dd.textContent = String(value);
      row.append(dt, dd);
      return row;
    })
  );
}

function renderWarnings(result) {
  $('#warnings').replaceChildren(
    ...result.warnings.map((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      return li;
    })
  );
}

function regenerate() {
  const machine = state.machines.get(state.machineId);
  const material = state.materials.get(state.materialId);
  const errors = $('#errors');
  try {
    const result = generate(machine, material, state.textile);
    state.result = result;
    errors.hidden = true;
    errors.textContent = '';
    $('#btn-download').disabled = false;
    renderStats(result);
    renderWarnings(result);
    preview.update(result);
    if (!violationsTouched) {
      // many violations would bury the model; show them by default only when there are few
      const box = $('#show-violations');
      box.checked = result.stats.violations > 0 && result.stats.violations <= 2000;
      preview.setShowViolations(box.checked);
    }
    const scrub = $('#scrub');
    scrub.max = String(result.moves.length);
    scrub.value = scrub.max;
    preview.setScrub(result.moves.length);
    store.set('textile-params', JSON.stringify({ machineId: state.machineId, materialId: state.materialId, textile: state.textile }));
  } catch (e) {
    errors.hidden = false;
    errors.textContent = Array.isArray(e.errors) ? e.errors.join('\n') : String(e.message || e);
    $('#btn-download').disabled = true;
    $('#warnings').replaceChildren();
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(regenerate, 200);
}

function download() {
  if (!state.result) return;
  const t = state.result.cfg.t;
  const name = `textile_${t.sample_width}x${t.sample_height}_${state.materialId}_seed${t.random_seed}.gcode`;
  const url = URL.createObjectURL(new Blob([state.result.gcode], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveParams() {
  const payload = { version: 1, machineId: state.machineId, materialId: state.materialId, textile: state.textile };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'textile-parameters.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadParams(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data.textile !== 'object') throw new Error('not a parameters file');
    const known = Object.keys(DEFAULT_TEXTILE);
    const next = { ...DEFAULT_TEXTILE };
    for (const key of known) if (key in data.textile) next[key] = data.textile[key];
    state.textile = next;
    if (state.machines.has(data.machineId)) state.machineId = data.machineId;
    if (state.materials.has(data.materialId)) state.materialId = data.materialId;
    fillSelect($('#machine'), state.machines, state.machineId);
    fillSelect($('#material'), state.materials, state.materialId);
    syncForm();
    regenerate();
  } catch (e) {
    const errors = $('#errors');
    errors.hidden = false;
    errors.textContent = `Could not load parameters: ${e.message}`;
  }
}

async function init() {
  preview = createPreview($('#preview'));
  await loadProfiles();
  try {
    const saved = JSON.parse(store.get('textile-params') ?? 'null');
    if (saved && typeof saved.textile === 'object') {
      for (const key of Object.keys(DEFAULT_TEXTILE)) if (key in saved.textile) state.textile[key] = saved.textile[key];
      if (state.machines.has(saved.machineId)) state.machineId = saved.machineId;
      if (state.materials.has(saved.materialId)) state.materialId = saved.materialId;
    }
  } catch { /* ignore a corrupt saved value */ }
  fillSelect($('#machine'), state.machines, state.machineId);
  fillSelect($('#material'), state.materials, state.materialId);
  $('#machine').addEventListener('change', (e) => { state.machineId = e.target.value; schedule(); });
  $('#material').addEventListener('change', (e) => { state.materialId = e.target.value; schedule(); });
  $('#btn-download').addEventListener('click', download);
  $('#btn-save').addEventListener('click', saveParams);
  $('#file-load').addEventListener('change', (e) => { if (e.target.files[0]) loadParams(e.target.files[0]); e.target.value = ''; });
  $('#show-travel').addEventListener('change', (e) => preview.setShowTravel(e.target.checked));
  $('#show-violations').addEventListener('change', (e) => {
    violationsTouched = true;
    preview.setShowViolations(e.target.checked);
  });
  $('#z-scale').addEventListener('input', (e) => preview.setZScale(Number(e.target.value)));
  $('#scrub').addEventListener('input', (e) => preview.setScrub(Number(e.target.value)));
  buildForm();
  regenerate();
}

init().catch((e) => {
  const errors = $('#errors');
  errors.hidden = false;
  errors.textContent = `Startup failed: ${e.message}`;
});
