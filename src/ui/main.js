import { DEFAULT_TEXTILE } from '../engine/params.js';
import { generate } from '../engine/generate.js';
import { generateSquiggle, SAMPLERS, createImageSampler } from '../engine/squiggle.js';
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
  {
    key: 'pileHeight',
    label: 'Pile height',
    lo: 'Low (1 mm)',
    hi: 'Tall (6 mm)',
    unit: 'mm',
    desc: 'Z-lift height of loops above the base. Higher lift gives a thick, plush fleece; lower lift makes a flatter, lightweight textile.',
  },
  {
    key: 'loopSize',
    label: 'Loop size',
    lo: 'Small (0.6×)',
    hi: 'Large (1.4×)',
    unit: '×',
    desc: 'Scale of each loop (width × length). Larger loops create a bolder surface grain and softer drape.',
  },
  {
    key: 'loopSpacing',
    label: 'Loop density',
    lo: 'Dense (2 mm)',
    hi: 'Sparse (6 mm)',
    unit: 'mm',
    desc: 'Distance between loop centres along rows. Smaller spacing packs loops densely; larger spacing makes it open and breathable.',
  },
  {
    key: 'baseGap',
    label: 'Base openness',
    lo: 'Tight (3 mm)',
    hi: 'Airy (10 mm)',
    unit: 'mm',
    desc: 'Spacing between base serpentine lines. Tighter base adds strength; wider base makes the backing flexible and airy.',
  },
  {
    key: 'variation',
    label: 'Natural variation',
    lo: 'Even (0%)',
    hi: 'Wild (100%)',
    unit: '%',
    desc: 'Organic variation in loop height, tilt, and length so the fabric resembles natural wool rather than rigid plastic.',
  },
];
const ROLE_LABELS = { base: 'Base / L1', anchored: 'Anchored / L2', lifting: 'Lifting and lowering', free: 'Free-hanging' };
const ROLE_HEIGHT = { base: 2, anchored: 3, lifting: 3, free: 5 };

const state = {
  machines: new Map(),
  materials: new Map(),
  machine: 'prusa-mk3s',
  material: 'filaflex-95-foamy',
  design: 'loop-pile',
  linkSizeDensity: true,
  primary: { ...PRIMARY_DEFAULTS },
  advanced: {},
  squiggle: {
    mode: 'cross',
    swatch: 'mid',
    width: 50,
    height: 50,
    pattern: 'centerSpot',
    spacing: 2.5,
    amplitude: 1.2,
    wavelength: 4.0,
    colorChange: false,
    customSampler: null,
    imageElement: null,
    imageName: '',
  },
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
    let result;
    if (state.design === 'squiggle') {
      const s = state.squiggle;
      const sampler = (s.pattern === 'image' && s.customSampler) ? s.customSampler : (SAMPLERS[s.pattern] ?? SAMPLERS.centerSpot);
      result = generateSquiggle(machine, material, {
        width: s.width,
        height: s.height,
        mode: s.mode,
        spacing: s.spacing,
        amplitude: s.amplitude,
        wavelength: s.wavelength,
        sampler,
        colorChange: s.colorChange,
      });
    } else {
      result = generate(machine, material, toTextile(state.primary, state.advanced));
    }
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
  const isSq = state.design === 'squiggle';
  const parts = [
    el('strong', { text: `${t.sample_width} × ${t.sample_height} mm` }),
    ...(isSq ? [el('span', { text: '2-layer mesh' })] : [el('span', { text: `${stats.loops} loops` })]),
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
  const [w, h] = sampleSize(state.primary);
  const wInput = $('#custom-width');
  const hInput = $('#custom-height');
  if (wInput && document.activeElement !== wInput) wInput.value = String(w);
  if (hInput && document.activeElement !== hInput) hInput.value = String(h);

  for (const b of document.querySelectorAll('#swatch-presets button')) {
    const isTest = b.dataset.swatch === 'test' && w === 30 && h === 30;
    const isMid = b.dataset.swatch === 'mid' && w === 50 && h === 50;
    const isFull = b.dataset.swatch === 'full' && w === 100 && h === 100;
    b.classList.toggle('active', isTest || isMid || isFull);
    b.setAttribute('aria-pressed', String(isTest || isMid || isFull));
  }

  const stats = state.result?.stats;
  $('#swatch-hint').textContent = stats && !state.error
    ? `${w} × ${h} mm: about ${formatMinutes(stats.timeSec / 60)} minutes and ${stats.filamentGrams < 1 ? stats.filamentGrams.toFixed(2) : stats.filamentGrams.toFixed(1)} g.`
    : '';
}

function renderSliders() {
  const d = describePrimary(state.primary);
  for (const def of SLIDERS) {
    const sInput = $(`#s-${def.key}`);
    if (sInput && document.activeElement !== sInput) sInput.value = String(state.primary[def.key]);
    const numInput = $(`#num-${def.key}`);
    if (numInput && document.activeElement !== numInput) numInput.value = String(state.primary[def.key]);
    const out = $(`#v-${def.key}`);
    if (out) out.textContent = d[def.key];
  }
  const linkBox = $('#link-size-density');
  if (linkBox) linkBox.checked = state.linkSizeDensity;
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

    const slider = el('input', {
      id: `s-${def.key}`,
      type: 'range',
      min: range.min,
      max: range.max,
      step: range.step,
      value: state.primary[def.key],
    });

    const numInput = el('input', {
      id: `num-${def.key}`,
      class: 'num-input',
      type: 'number',
      min: range.min,
      max: range.max,
      step: range.step,
      value: state.primary[def.key],
    });

    const updateVal = (newVal) => {
      state.primary[def.key] = newVal;

      if (state.linkSizeDensity) {
        if (def.key === 'loopSize') {
          const linkedPitch = Math.min(
            RANGES.loopSpacing.max,
            Math.max(RANGES.loopSpacing.min, Math.round(3.0 * newVal * 10) / 10)
          );
          state.primary.loopSpacing = linkedPitch;
        } else if (def.key === 'loopSpacing') {
          const linkedSize = Math.min(
            RANGES.loopSize.max,
            Math.max(RANGES.loopSize.min, Math.round((newVal / 3.0) * 10) / 10)
          );
          state.primary.loopSize = linkedSize;
        }
      }

      renderSliders();
      schedule();
    };

    slider.addEventListener('input', () => updateVal(Number(slider.value)));
    slider.addEventListener('change', commit);

    numInput.addEventListener('input', () => {
      const v = Number(numInput.value);
      if (Number.isFinite(v) && v >= range.min && v <= range.max) {
        updateVal(v);
      }
    });
    numInput.addEventListener('change', commit);

    const sliderDiv = el('div', { class: 'slider' },
      el('div', { class: 'row-top' },
        el('div', { class: 'label-with-tip' },
          el('label', { class: 'label', for: slider.id, text: def.label }),
          el('span', { class: 'info-tip', title: def.desc, text: 'ⓘ' })
        ),
        el('div', { class: 'input-val-wrap' },
          numInput,
          el('span', { class: 'unit-tag', text: def.unit })
        )
      ),
      slider,
      el('div', { class: 'ends' },
        el('span', { text: def.lo }),
        el('span', { class: 'readout-text', id: `v-${def.key}` }),
        el('span', { text: def.hi })
      )
    );

    host.append(sliderDiv);

    if (def.key === 'loopSize') {
      const linkBox = el('input', {
        type: 'checkbox',
        id: 'link-size-density',
        checked: state.linkSizeDensity,
      });
      linkBox.addEventListener('change', (e) => {
        state.linkSizeDensity = e.target.checked;
        if (state.linkSizeDensity) {
          state.primary.loopSpacing = Math.min(
            RANGES.loopSpacing.max,
            Math.max(RANGES.loopSpacing.min, Math.round(3.0 * state.primary.loopSize * 10) / 10)
          );
          renderSliders();
          schedule();
          commit();
        }
      });

      const linkRow = el('div', { class: 'link-constraint-row' },
        el('label', { class: 'check small', for: 'link-size-density' },
          linkBox,
          el('span', { class: 'link-icon', text: '🔗' }),
          el('span', {}, el('strong', { text: 'Link size & density' }), ' (proportional packing)')
        ),
        el('span', {
          class: 'info-tip',
          title: 'Maintains consistent 50% loop overlap and symmetric packing when resizing loops, preventing overcrowding or accidental holes.',
          text: 'ⓘ',
        })
      );
      host.append(linkRow);
    }
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
  const prefix = state.design === 'squiggle' ? 'squiggle' : 'looppile';
  const name = `${slug(state.docName)}_${prefix}_${t.sample_width}x${t.sample_height}_${state.material}.gcode`;
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
  for (const b of document.querySelectorAll('#swatch-presets button, [data-swatch]')) {
    b.addEventListener('click', () => {
      const sw = b.dataset.swatch;
      state.primary.swatch = sw;
      if (sw === 'test') { state.primary.customWidth = 30; state.primary.customHeight = 30; }
      else if (sw === 'mid') { state.primary.customWidth = 50; state.primary.customHeight = 50; }
      else if (sw === 'full') { state.primary.customWidth = 100; state.primary.customHeight = 100; }
      renderSwatch();
      schedule();
      commit();
    });
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

  bindSquiggleControls();
}

function bindSquiggleControls() {
  const tileLoop = $('#tile-loop-pile');
  const tileSq = $('#tile-squiggle');
  const panelLoop = $('#panel-loop-pile');
  const panelSq = $('#panel-squiggle');

  function setDesign(design) {
    state.design = design;
    const isSq = design === 'squiggle';
    if (tileSq) {
      tileSq.classList.toggle('selected', isSq);
      tileSq.setAttribute('aria-pressed', String(isSq));
    }
    if (tileLoop) {
      tileLoop.classList.toggle('selected', !isSq);
      tileLoop.setAttribute('aria-pressed', String(!isSq));
    }
    if (panelSq) panelSq.hidden = !isSq;
    if (panelLoop) panelLoop.hidden = isSq;
    schedule();
    commit();
  }

  if (tileLoop && tileSq) {
    tileLoop.addEventListener('click', () => setDesign('loop-pile'));
    tileSq.addEventListener('click', () => setDesign('squiggle'));
  }

  // Squiggle structure mode
  const modeButtons = document.querySelectorAll('#sq-mode-seg button');
  for (const b of modeButtons) {
    b.addEventListener('click', () => {
      state.squiggle.mode = b.dataset.sqmode;
      for (const btn of modeButtons) btn.setAttribute('aria-pressed', String(btn === b));
      schedule();
      commit();
    });
  }

  // Squiggle swatch dimensions & presets
  const sqWInput = $('#sq-width-input');
  const sqHInput = $('#sq-height-input');

  const updateSqDim = () => {
    const w = Number(sqWInput?.value);
    const h = Number(sqHInput?.value);
    if (Number.isFinite(w) && w >= 10 && w <= 240) state.squiggle.width = w;
    if (Number.isFinite(h) && h >= 10 && h <= 200) state.squiggle.height = h;
    for (const btn of document.querySelectorAll('#sq-swatch-presets button')) {
      const is30 = btn.dataset.sqpreset === '30x30' && w === 30 && h === 30;
      const is50 = btn.dataset.sqpreset === '50x50' && w === 50 && h === 50;
      const is100 = btn.dataset.sqpreset === '100x100' && w === 100 && h === 100;
      btn.classList.toggle('active', is30 || is50 || is100);
    }
    if (state.squiggle.imageElement) {
      processSquiggleImage(state.squiggle.imageElement, state.squiggle.imageName, false);
    }
    schedule();
  };

  if (sqWInput && sqHInput) {
    sqWInput.addEventListener('input', updateSqDim);
    sqHInput.addEventListener('input', updateSqDim);
    sqWInput.addEventListener('change', commit);
    sqHInput.addEventListener('change', commit);
  }

  for (const b of document.querySelectorAll('#sq-swatch-presets button')) {
    b.addEventListener('click', () => {
      const preset = b.dataset.sqpreset;
      const size = preset === '30x30' ? 30 : preset === '100x100' ? 100 : 50;
      state.squiggle.width = size;
      state.squiggle.height = size;
      if (sqWInput) sqWInput.value = String(size);
      if (sqHInput) sqHInput.value = String(size);
      for (const btn of document.querySelectorAll('#sq-swatch-presets button')) {
        btn.classList.toggle('active', btn === b);
      }
      if (state.squiggle.imageElement) {
        processSquiggleImage(state.squiggle.imageElement, state.squiggle.imageName, false);
      }
      schedule();
      commit();
    });
  }

  // Pattern selector
  const patternSel = $('#sq-pattern-sel');
  const imgBox = $('#sq-image-box');
  if (patternSel) {
    patternSel.addEventListener('change', (e) => {
      state.squiggle.pattern = e.target.value;
      if (imgBox) imgBox.hidden = e.target.value !== 'image';
      schedule();
      commit();
    });
  }

  // Geometry sliders
  const setupSqSlider = (id, valId, key, unit) => {
    const input = $(id);
    const label = $(valId);
    if (!input || !label) return;
    input.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.squiggle[key] = val;
      label.textContent = `${val.toFixed(1)} ${unit}`;
      schedule();
    });
    input.addEventListener('change', commit);
  };
  setupSqSlider('#sq-spacing', '#sq-spacing-val', 'spacing', 'mm');
  setupSqSlider('#sq-amplitude', '#sq-amplitude-val', 'amplitude', 'mm');
  setupSqSlider('#sq-wavelength', '#sq-wavelength-val', 'wavelength', 'mm');

  // Color change checkbox
  const colorBox = $('#sq-color-change');
  if (colorBox) {
    colorBox.addEventListener('change', (e) => {
      state.squiggle.colorChange = e.target.checked;
      schedule();
      commit();
    });
  }

  // Image upload and dropzone
  const fileInput = $('#sq-file-input');
  const dropzone = $('#sq-dropzone');
  const imgInfo = $('#sq-img-info');
  const imgName = $('#sq-img-name');
  const imgClear = $('#sq-img-clear');

  function processSquiggleImage(img, filename = 'Image', autoSize = true) {
    state.squiggle.imageElement = img;
    state.squiggle.imageName = filename;

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;

    // Auto-size swatch dimensions from image aspect ratio
    if (autoSize && natW > 0 && natH > 0) {
      const aspect = natW / natH;
      let targetW, targetH;
      if (aspect >= 1) {
        targetW = 80;
        targetH = Math.max(15, Math.min(200, Math.round(targetW / aspect)));
      } else {
        targetH = 80;
        targetW = Math.max(15, Math.min(240, Math.round(targetH * aspect)));
      }
      state.squiggle.width = targetW;
      state.squiggle.height = targetH;
      if (sqWInput) sqWInput.value = String(targetW);
      if (sqHInput) sqHInput.value = String(targetH);

      const aspectHint = $('#sq-aspect-hint');
      if (aspectHint) {
        aspectHint.textContent = `Auto-sized from image (${natW} × ${natH} px → ${targetW} × ${targetH} mm)`;
        aspectHint.hidden = false;
      }
    }

    const canvas = document.createElement('canvas');
    const maxDim = 400;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    state.squiggle.customSampler = createImageSampler(
      imgData,
      state.squiggle.width,
      state.squiggle.height
    );

    const thumb = $('#sq-thumb');
    if (thumb) {
      const tctx = thumb.getContext('2d');
      tctx.clearRect(0, 0, 56, 56);
      tctx.drawImage(canvas, 0, 0, 56, 56);
    }

    if (imgName) imgName.textContent = filename;
    if (imgInfo) imgInfo.hidden = false;
    if (patternSel) patternSel.value = 'image';
    state.squiggle.pattern = 'image';
    if (imgBox) imgBox.hidden = false;
    schedule();
    commit();
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Please select an image file (PNG, JPG, WebP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => processSquiggleImage(img, file.name);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handleFile(e.target.files[0]);
    });
  }

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  if (imgClear) {
    imgClear.addEventListener('click', () => {
      state.squiggle.customSampler = null;
      state.squiggle.imageElement = null;
      state.squiggle.imageName = '';
      state.squiggle.pattern = 'centerSpot';
      if (patternSel) patternSel.value = 'centerSpot';
      if (imgInfo) imgInfo.hidden = true;
      if (imgBox) imgBox.hidden = true;
      if (fileInput) fileInput.value = '';
      schedule();
      commit();
    });
  }
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

