import { generate } from '../engine/generate.js';
import { generateSquiggle, SAMPLERS, createImageSampler, minCrossingAmplitude } from '../engine/squiggle.js';
import { placeOutline, rotateRings, ringsAspect, unflattenRings } from '../engine/outline.js';
import { createPreview, ROLES } from './preview.js';
import { RANGES, PRIMARY_DEFAULTS, sampleSize, toTextile, describePrimary, airStrandMm, fitAspect } from './controls.js';
import { SQ_RANGES, SQUIGGLE_DEFAULTS, describeSquiggle, sizeForAspect } from './squiggle-controls.js';
import { buildVerdict, buildSquiggleVerdict, formatMinutes } from './verdict.js';
import { stateToHash, hashToState, sanitizeState } from './share.js';
import { ADVANCED_GROUPS, FIELD_LABELS, fieldDefault, changedFields } from './param-schema.js';
import { readSvgOutline, drawOutlineThumb } from './svg-outline.js';
import { DESIGNS, designById, isReady } from './designs.js';
import { THUMBS } from './thumbs.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'filament-textile-studio:v1'; // kept so a returning visitor's last session still opens
const PLAY_ICON = 'M5 3l10 6-10 6z';
const PAUSE_ICON = 'M4 3h3.5v12H4zM10.5 3H14v12h-3.5z';

const ROLE_HEIGHT = { base: 2, anchored: 3, lifting: 3, free: 5 };

const LOOP_SLIDERS = [
  { key: 'pileHeight', label: 'Pile height', help: 'How far the loops rise above the base.', lo: 'Flat', hi: 'Plush', unit: 'mm', edit: true },
  { key: 'loopSize', label: 'Loop size', help: 'Width and length of each loop, kept in proportion.', lo: 'Small', hi: 'Large' },
  { key: 'airFlow', label: 'Strand thickness', help: 'Extra flow where the loops are in the air, for thicker, sturdier strands.', lo: 'Thin', hi: 'Thick', unit: '%', edit: true },
  { key: 'loopSpacing', label: 'Loop spacing', help: 'Distance between neighbouring loops in a row.', lo: 'Packed', hi: 'Open', unit: 'mm', edit: true },
  { key: 'baseGap', label: 'Base openness', help: 'Gap between the lines of the backing mesh.', lo: 'Firm', hi: 'Airy', unit: 'mm', edit: true },
  { key: 'variation', label: 'Natural variation', help: 'Random wobble in each loop\'s size, height and angle.', lo: 'Even', hi: 'Wild', unit: '%', edit: true },
];
const SQ_SLIDERS = [
  { key: 'spacing', label: 'Line spacing', help: 'Distance between neighbouring wavy lines.', lo: 'Dense', hi: 'Airy', unit: 'mm', edit: true },
  { key: 'amplitude', label: 'Wave depth', help: 'How far each line swings to the side.', lo: 'Subtle', hi: 'Deep', unit: 'mm', edit: true },
  { key: 'wavelength', label: 'Wave length', help: 'Length of one full wave.', lo: 'Tight', hi: 'Stretched', unit: 'mm', edit: true },
];
const PATTERNS = [
  { id: 'centerSpot', label: 'Centre spot' },
  { id: 'gradientX', label: 'Fade across' },
  { id: 'gradientY', label: 'Fade up' },
  { id: 'waves', label: 'Ripples' },
  { id: 'uniform', label: 'Even' },
  { id: 'image', label: 'Your picture' },
];

/** The two designs' controls, wired to the same slider and size components. */
const BINDINGS = {
  'loop-pile': {
    sliders: LOOP_SLIDERS,
    host: '#lp-sliders',
    get: (key) => state.primary[key],
    set: (key, value) => { state.primary[key] = value; },
    range: (key) => RANGES[key],
    readout: (key) => {
      const d = describePrimary(state.primary);
      if (key === 'loopSpacing') return `${d.loopSpacing} · ${d.overlap}`;
      if (key === 'airFlow') {
        const mm = airStrandMm(state.primary, state.advanced, state.materials.get(state.material));
        return mm ? `${d.airFlow} · about ${mm.toFixed(2)} mm` : d.airFlow;
      }
      return d[key];
    },
    size: {
      host: '#lp-size',
      ranges: { w: RANGES.customWidth, h: RANGES.customHeight },
      get: () => sampleSize(state.primary),
      set: (w, h, preset) => {
        state.primary.customWidth = w;
        state.primary.customHeight = h;
        state.primary.swatch = preset ?? 'custom';
      },
    },
  },
  squiggle: {
    sliders: SQ_SLIDERS,
    host: '#sq-sliders',
    get: (key) => state.squiggle[key],
    set: (key, value) => { state.squiggle[key] = value; },
    range: (key) => SQ_RANGES[key],
    readout: (key) => {
      const text = describeSquiggle(state.squiggle)[key];
      const floor = parallelDepth();
      if (key === 'amplitude' && floor !== null && state.squiggle.amplitude < floor) return `${text} · raised to ${floor.toFixed(2)} mm`;
      return text;
    },
    size: {
      host: '#sq-size',
      ranges: { w: SQ_RANGES.width, h: SQ_RANGES.height },
      get: () => [state.squiggle.width, state.squiggle.height],
      set: (w, h) => {
        state.squiggle.width = w;
        state.squiggle.height = h;
      },
    },
  },
};

const state = {
  machines: new Map(),
  materials: new Map(),
  machine: 'prusa-mk3s',
  material: 'filaflex-95-foamy',
  design: 'loop-pile',
  primary: { ...PRIMARY_DEFAULTS },
  advanced: {},
  squiggle: { ...SQUIGGLE_DEFAULTS },
  designs: {}, // settings of every design newer than the loop pile and squiggle, by design id
  image: null, // { data: ImageData, name, px: [w, h], thumb: canvas }: stays on this computer, never in a link
  imageBoxOpen: false,
  outline: null, // { name, rings (flat, unit box), rotation }: shared by every design, travels in links
  docName: 'Untitled swatch',
  result: null,
  error: null,
  fraction: 1,
  playing: false,
  details: false,
  checkOpen: null, // null: open when there is something to look at
  why: false,
  showTight: false,
  roles: {},
};
let preview = null;
let rafId = 0;
let lastFrame = 0;
const undoLog = { stack: [], cursor: -1 };
const openAdvancedGroups = new Set();

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
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function icon(d, { size = 18, fill = false } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', fill ? 'currentColor' : 'none');
  if (!fill) {
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}
const ICONS = {
  ok: 'M9 1.8a7.2 7.2 0 100 14.4A7.2 7.2 0 009 1.8zM5.8 9.2l2.2 2.2 4.2-4.6',
  'heads-up': 'M9 2.2L16.4 15H1.6zM9 7v3.6M9 12.8v.1',
  info: 'M9 1.8a7.2 7.2 0 100 14.4A7.2 7.2 0 009 1.8zM9 8.2v4.4M9 5.6v.1',
  error: 'M9 1.8a7.2 7.2 0 100 14.4A7.2 7.2 0 009 1.8zM6.4 6.4l5.2 5.2M11.6 6.4l-5.2 5.2',
  chevron: 'M5 7l4 4 4-4',
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
  return { machines: index.machines, materials: index.materials };
}

function known() {
  return { machines: [...state.machines.keys()], materials: [...state.materials.keys()] };
}

function snapshot() {
  return {
    v: 3,
    design: state.design,
    machine: state.machine,
    material: state.material,
    primary: state.primary,
    advanced: state.advanced,
    squiggle: state.squiggle,
    designs: state.designs,
    outline: state.outline,
    name: state.docName,
  };
}

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3600);
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

const grams = (g) => (g < 1 ? g.toFixed(2) : g.toFixed(1));

/* ---------- history (undo / redo) ---------- */
function snapshotKey() {
  return JSON.stringify({ d: state.design, m: state.machine, t: state.material, p: state.primary, a: state.advanced, s: state.squiggle, g: state.designs, o: state.outline });
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
  // once a link has been opened (or edited past), drop it from the address bar so a reload keeps later changes
  if (location.hash.startsWith('#s=')) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  }
  renderHistoryButtons();
}

/** Load sanitized settings into the state. Returns true when a picture pattern had to be replaced. */
function loadState(data) {
  const clean = sanitizeState(data, known());
  const designChanged = clean.design !== state.design;
  state.design = clean.design;
  state.machine = clean.machine;
  state.material = clean.material;
  state.primary = clean.primary;
  state.advanced = clean.advanced;
  state.squiggle = clean.squiggle;
  state.designs = clean.designs;
  state.outline = clean.outline;
  if (typeof data?.name === 'string') state.docName = data.name.slice(0, 60);
  if (designChanged) resetRoles();
  // a picture never travels in a link or a file, so without one loaded the pattern falls back
  if (state.squiggle.pattern === 'image' && !state.image) {
    state.squiggle.pattern = SQUIGGLE_DEFAULTS.pattern;
    return true;
  }
  return false;
}

function applySnapshot(data) {
  loadState(data);
  showDesign();
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

function squiggleSampler() {
  const s = state.squiggle;
  if (s.pattern === 'image' && state.image) return createImageSampler(state.image.data, s.width, s.height);
  return SAMPLERS[s.pattern] ?? SAMPLERS.centerSpot;
}

/** The outline as it will print for a width x height swatch: rotated, then fitted inside it (mm). */
function placedOutline(width, height) {
  if (!state.outline) return null;
  return placeOutline(unflattenRings(state.outline.rings), { rotation: state.outline.rotation, width, height });
}

/** In parallel mode, the least wave depth that still lets each line cross its neighbours (mm). */
function parallelDepth() {
  const s = state.squiggle;
  if (s.mode !== 'parallel') return null;
  return minCrossingAmplitude(s.height / Math.max(2, Math.floor(s.height / s.spacing)));
}

function regenerate() {
  const machine = state.machines.get(state.machine);
  const material = state.materials.get(state.material);
  try {
    let result;
    if (state.design === 'squiggle') {
      const s = state.squiggle;
      result = generateSquiggle(machine, material, {
        width: s.width,
        height: s.height,
        mode: s.mode,
        spacing: s.spacing,
        amplitude: s.amplitude,
        wavelength: s.wavelength,
        sampler: squiggleSampler(),
        colorChange: s.colorChange,
        outline: placedOutline(s.width, s.height),
      });
    } else {
      const [w, h] = sampleSize(state.primary);
      result = generate(machine, material, toTextile(state.primary, state.advanced), { outline: placedOutline(w, h) });
    }
    state.result = result;
    state.error = null;
    preview.update(result);
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
  for (const input of $$('[data-key][aria-invalid="true"]')) input.removeAttribute('aria-invalid');
  for (const e of $$('.field-error[data-for], .field-error[data-engine]')) { e.hidden = true; e.textContent = ''; delete e.dataset.engine; }
  const sizeError = $(`#${state.design}-size-error`);

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
      if (field.closest('#advanced-body')) {
        openAdvanced(true);
        const group = field.closest('details');
        if (group) group.open = true;
      }
    } else if ((key === 'sample_width' || key === 'sample_height') && sizeError) {
      sizeError.textContent = text;
      sizeError.hidden = false;
      sizeError.dataset.engine = '1';
    } else general.push(text);
  }
  box.hidden = general.length === 0;
  box.replaceChildren(...general.map((t) => el('div', { text: t })));
  const hasPreview = !!state.result;
  $('#canvas-note').hidden = !hasPreview;
  $('#canvas-wrap').classList.toggle('dimmed', hasPreview);
}

function currentVerdict() {
  if (!state.result || state.error) return null;
  return state.design === 'squiggle'
    ? buildSquiggleVerdict(state.result.stats, { colorChange: state.squiggle.colorChange })
    : buildVerdict(state.result.stats, { roomy: state.primary.roomy });
}

function renderCheck() {
  const box = $('#check');
  let v = currentVerdict();
  if (!v && state.error) {
    v = { level: 'error', title: 'Can\'t export yet', body: 'Fix the setting marked in red and the preview and export come back.', action: null };
  }
  if (!v) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `check ${v.level}`;
  // collapsed by default so the controls keep the room; the one fix that matters sits on the row itself
  const open = state.checkOpen ?? v.level === 'error';
  const toggle = el('button', { type: 'button', class: 'check-head', 'aria-expanded': String(open), 'aria-controls': 'check-body' },
    icon(ICONS[v.level] ?? ICONS.info, { size: 20 }),
    el('span', { class: 'check-title', text: v.title }),
    el('span', { class: 'check-chev' }, icon(ICONS.chevron, { size: 16 })));
  toggle.addEventListener('click', () => { state.checkOpen = !open; renderCheck(); });
  const row = el('div', { class: 'check-row' }, toggle);
  if (v.action === 'roomy-on') {
    const quick = el('button', { type: 'button', class: 'check-btn', title: `${v.actionLabel}: 1.5 mm between loop feet`, text: 'Add room' });
    quick.addEventListener('click', () => setRoomy(true));
    row.append(quick);
  }
  const children = [row];
  if (open) {
    const body = el('div', { class: 'check-body', id: 'check-body' }, el('p', { text: v.body }));
    const actions = el('div', { class: 'check-actions' });
    if (v.action === 'roomy-off') {
      const btn = el('button', { type: 'button', class: 'check-btn ghost', text: v.actionLabel });
      btn.addEventListener('click', () => setRoomy(false));
      actions.append(btn);
    }
    const loopFlags = state.design === 'loop-pile' && state.result && !state.error && state.result.stats.violations > 0;
    if (loopFlags) {
      const show = el('button', { type: 'button', class: 'check-link', 'aria-pressed': String(state.showTight), text: state.showTight ? 'Hide tight spots' : 'Show where' });
      show.addEventListener('click', () => setShowTight(!state.showTight));
      actions.append(show);
    }
    if (v.level === 'heads-up' && state.design === 'loop-pile') {
      const why = el('button', { type: 'button', class: 'check-link', 'aria-expanded': String(state.why), text: 'Why?' });
      why.addEventListener('click', () => { state.why = !state.why; renderCheck(); });
      actions.append(why);
    }
    if (actions.childElementCount) body.append(actions);
    if (state.why && v.level === 'heads-up' && state.design === 'loop-pile') {
      body.append(el('p', { class: 'check-explain', text: 'The nozzle tip is wider than the gap between two loop feet that sit 0.6 mm apart, so printing one can touch its neighbour. At 1.5 mm there is room to pass. Loops that cross at the same height are normal in a pile, so use the count to compare layouts, not as pass or fail.' }));
    }
    children.push(body);
  }
  box.replaceChildren(...children);
}

function renderFigures() {
  const host = $('#figures');
  const toggle = $('#btn-details');
  if (!state.result) { host.replaceChildren(); toggle.hidden = true; return; }
  toggle.hidden = false;
  const { stats, cfg } = state.result;
  const t = cfg.t;
  const isSq = state.design === 'squiggle';
  const fig = (value, unit, label) => el('div', { class: 'figure' },
    el('div', { class: 'fig-value' }, value, unit ? el('span', { class: 'fig-unit', text: ` ${unit}` }) : null),
    el('div', { class: 'fig-label', text: label }));
  host.classList.toggle('stale', !!state.error);
  host.replaceChildren(
    fig(formatMinutes(stats.timeSec / 60), 'min', 'Print time'),
    fig(grams(stats.filamentGrams), 'g', 'Filament'),
    isSq ? fig('2', '', 'Layers') : fig(stats.loops.toLocaleString('en'), '', 'Loops'),
  );
  toggle.textContent = state.details ? 'Hide details' : 'Details';
  toggle.setAttribute('aria-expanded', String(state.details));

  const d = $('#details');
  d.hidden = !state.details;
  if (state.details) {
    const item = (k, v) => el('div', {}, el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v }));
    d.replaceChildren(
      item('Swatch', `${t.sample_width} × ${t.sample_height} mm`),
      item('Filament length', `${Math.round(stats.filamentMm).toLocaleString('en')} mm`),
      item('Strands', String(stats.strands)),
      item('Nozzle lifts', String(stats.hops)),
      item('Travel', `${Math.round(stats.travelMm).toLocaleString('en')} mm`),
      item('G-code moves', stats.moves.toLocaleString('en')),
      item('Steepest slope', `${stats.maxSlopeDeg.toFixed(1)}°`),
      el('p', { class: 'note', text: 'Time ignores acceleration. Each lift ends one strand and starts the next, which is where blobs and strings come from.' })
    );
  }
  const what = isSq ? 'a two-layer squiggle mesh' : `${stats.loops} loops`;
  $('#preview').setAttribute('aria-label', `3D preview: ${what} on a ${t.sample_width} by ${t.sample_height} millimetre swatch, about ${formatMinutes(stats.timeSec / 60)} minutes.`);
}

function renderPlayback() {
  const total = state.result ? state.result.stats.timeSec / 60 : 0;
  $('#time-label').textContent = `${formatMinutes(total * state.fraction)} of ${formatMinutes(total)} min`;
  $('#play-icon').setAttribute('d', state.playing ? PAUSE_ICON : PLAY_ICON);
  $('#btn-play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play the print order');
  $('#scrub').value = String(Math.round(state.fraction * 1000));
}

function renderExport() {
  const btn = $('#btn-export');
  const ok = !!state.result && !state.error && state.result.moves.length > 0;
  btn.disabled = !ok;
  const bytes = state.result ? state.result.gcode.length : 0;
  $('#export-size').textContent = ok ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`) : '';
}

const shortMachine = (name) => name.replace('Original ', '').replace(' i3', '').replace(' / MK3S+', '');
const shortMaterial = (name) => name.replace('Recreus ', '').replace('Prusa ', '');

function renderPrinter() {
  const machine = state.machines.get(state.machine);
  const material = state.materials.get(state.material);
  if (!machine || !material) return;
  const ok = machine.verified && material.verified;
  $('#printer-name').textContent = shortMachine(machine.name);
  $('#printer-material').textContent = shortMaterial(material.name);
  $('#printer-dot').className = `status-dot ${ok ? 'ok' : 'warn'}`;
  $('#btn-printer').title = ok
    ? 'Printer and filament are both verified. Click to change the setup.'
    : 'This filament has not been printed with this tool yet, so start with a test swatch. Click to change the setup.';
  $('#btn-printer').setAttribute('aria-label', `Printer setup: ${shortMachine(machine.name)} with ${shortMaterial(material.name)}${ok ? '' : ', filament not yet verified'}`);
}

function renderSizes() {
  for (const id of Object.keys(BINDINGS)) {
    const b = BINDINGS[id].size;
    const [w, h] = b.get();
    const wi = $(`#${id}-w`);
    const hi = $(`#${id}-h`);
    if (wi && document.activeElement !== wi && wi.getAttribute('aria-invalid') !== 'true') wi.value = String(w);
    if (hi && document.activeElement !== hi && hi.getAttribute('aria-invalid') !== 'true') hi.value = String(h);
  }
  renderOutline();
}

function renderSliders() {
  for (const id of Object.keys(BINDINGS)) {
    const b = BINDINGS[id];
    for (const def of b.sliders) {
      const input = $(`#${id}-${def.key}`);
      if (input && document.activeElement !== input) input.value = String(b.get(def.key));
      const out = $(`#${id}-${def.key}-out`);
      if (out) out.textContent = b.readout(def.key);
    }
  }
  const d = describePrimary(state.primary);
  $('#room-value').textContent = d.roomy;
  for (const btn of $$('[data-room]')) btn.setAttribute('aria-pressed', String((btn.dataset.room === 'roomy') === state.primary.roomy));
  $('#edge-value').textContent = d.edgeLoops;
  for (const btn of $$('[data-edge]')) btn.setAttribute('aria-pressed', String((btn.dataset.edge === 'every') === state.primary.edgeLoops));
}

function renderSquiggleChoices() {
  const s = state.squiggle;
  const floor = parallelDepth();
  $('#sq-mode-note').textContent = floor === null
    ? 'Layer 1 runs in columns and layer 2 in rows, so the two cross everywhere.'
    : `Layer 2 runs halfway between the layer 1 lines, in opposite phase. Waves stay at least ${floor.toFixed(2)} mm deep so every line crosses the lines on both sides.`;
  $('#sq-pattern-hint').textContent = floor === null
    ? 'Darker parts of the pattern get deeper, tighter waves.'
    : 'Darker parts of the pattern get deeper waves.';
  for (const btn of $$('[data-sqmode]')) btn.setAttribute('aria-pressed', String(btn.dataset.sqmode === s.mode));
  for (const btn of $$('[data-pattern]')) btn.setAttribute('aria-pressed', String(btn.dataset.pattern === s.pattern));
  $('#sq-color-change').checked = s.colorChange;

  const showBox = s.pattern === 'image' || state.imageBoxOpen;
  $('#sq-image-box').hidden = !showBox;
  $('#sq-img-info').hidden = !state.image;
  $('#sq-drop-label').textContent = state.image ? 'Drop another picture, or browse' : 'Drop a picture here, or browse';
  if (state.image) {
    $('#sq-img-name').textContent = state.image.name;
    const [w, h] = sizeForAspect(...state.image.px);
    const matched = s.width === w && s.height === h;
    $('#sq-img-size').textContent = `${state.image.px[0]} × ${state.image.px[1]} px${matched ? ', swatch matches its shape' : ''}`;
    $('#sq-img-match').hidden = matched;
  }
}

function renderAdvancedSummary() {
  let total = 0;
  for (const group of ADVANCED_GROUPS) {
    const n = changedFields(group, state.advanced).length;
    total += n;
    const count = document.querySelector(`.adv-count[data-group="${group.id}"]`);
    if (count) count.textContent = n ? `${n} changed` : '';
    const reset = document.querySelector(`[data-reset-group="${group.id}"]`);
    if (reset) reset.hidden = n === 0;
  }
  $('#advanced-count').textContent = total
    ? `${total} changed from the defaults`
    : 'Speeds, cooling, strand, nozzle and more';
  $('#btn-advanced').classList.toggle('has-changes', total > 0);
}

function renderLegend() {
  const host = $('#roles');
  const labels = designById(state.design).roles;
  const present = state.result ? preview.presentRoles().filter((role) => labels[role]) : [];
  host.replaceChildren(...present.map((role) => {
    const on = state.roles[role] !== false;
    const chip = el('button', { type: 'button', class: 'role-chip', 'aria-pressed': String(on), 'data-role': role, title: on ? 'Hide in the preview' : 'Show in the preview' },
      el('span', { class: 'swatch', style: `height:${ROLE_HEIGHT[role]}px;background:var(--role-${role})`, 'aria-hidden': 'true' }),
      labels[role]);
    chip.addEventListener('click', () => {
      state.roles[role] = !(state.roles[role] !== false);
      preview.setRoles({ [role]: state.roles[role] });
      renderLegend();
    });
    return chip;
  }));
}

function render() {
  renderErrors();
  renderCheck();
  renderFigures();
  renderPlayback();
  renderExport();
  renderPrinter();
  renderSizes();
  renderSliders();
  renderSquiggleChoices();
  renderAdvancedSummary();
  renderLegend();
}

/* ---------- controls ---------- */
function afterControl() {
  renderSliders();
  schedule();
}

function setRoomy(on) {
  state.primary.roomy = on;
  afterControl();
  commit();
}

function setShowTight(on) {
  state.showTight = on;
  $('#show-violations').checked = on;
  preview.setShowViolations(on);
  renderCheck();
}

function buildSlider(id, def) {
  const b = BINDINGS[id];
  const range = b.range(def.key);
  const inputId = `${id}-${def.key}`;
  const input = el('input', { id: inputId, type: 'range', min: range.min, max: range.max, step: range.step, 'aria-describedby': `${inputId}-help` });
  input.value = String(b.get(def.key));
  input.addEventListener('input', () => { b.set(def.key, Number(input.value)); afterControl(); });
  input.addEventListener('change', commit);

  const readout = def.edit
    ? el('button', { type: 'button', class: 'ctl-readout editable', id: `${inputId}-out`, title: 'Click to type a value', 'aria-label': `${def.label}: type an exact value` })
    : el('span', { class: 'ctl-readout', id: `${inputId}-out` });
  if (def.edit) readout.addEventListener('click', () => editValue(id, def, readout));

  return el('div', { class: 'ctl' },
    el('div', { class: 'ctl-top' }, el('label', { class: 'ctl-label', for: inputId, text: def.label }), readout),
    el('p', { class: 'ctl-help', id: `${inputId}-help`, text: def.help }),
    input,
    el('div', { class: 'ctl-ends', 'aria-hidden': 'true' }, el('span', { text: def.lo }), el('span', { text: def.hi })));
}

/** Swap a read-out for a number field so an exact value can be typed; Enter or leaving applies it, Escape cancels. */
function editValue(id, def, readout) {
  const b = BINDINGS[id];
  const range = b.range(def.key);
  const field = el('input', { type: 'number', class: 'ctl-edit', min: range.min, max: range.max, step: range.step, inputmode: 'decimal', 'aria-label': `${def.label} in ${def.unit}` });
  field.value = String(b.get(def.key));
  let done = false;
  const finish = (apply) => {
    if (done) return;
    done = true;
    const raw = field.value.trim();
    const n = Number(raw);
    if (apply && raw !== '' && Number.isFinite(n)) {
      const v = Math.min(range.max, Math.max(range.min, n));
      if (v !== n) toast(`${def.label} goes from ${range.min} to ${range.max} ${def.unit}, so it is set to ${v} ${def.unit}.`);
      b.set(def.key, v);
      afterControl();
      commit();
    }
    field.replaceWith(readout);
    renderSliders();
    readout.focus();
  };
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  field.addEventListener('blur', () => finish(true));
  readout.replaceWith(field);
  field.focus();
  field.select();
}

function buildSliders(id) {
  const b = BINDINGS[id];
  $(b.host).replaceChildren(...b.sliders.map((def) => buildSlider(id, def)));
}

function buildSize(id) {
  const b = BINDINGS[id].size;
  const error = el('p', { class: 'field-error', id: `${id}-size-error`, hidden: true });
  const make = (axis, label, range) => {
    const input = el('input', { id: `${id}-${axis}`, type: 'number', inputmode: 'decimal', min: range.min, max: range.max, step: range.step });
    const field = el('label', { class: 'size-field', for: input.id }, el('span', { class: 'size-label', text: label }), input, el('span', { class: 'unit', 'aria-hidden': 'true', text: 'mm' }));
    return { field, input, range, label: label.toLowerCase() };
  };
  const wf = make('w', 'Width', b.ranges.w);
  const hf = make('h', 'Height', b.ranges.h);
  const onInput = () => {
    for (const f of [wf, hf]) f.input.removeAttribute('aria-invalid');
    const bad = [wf, hf].find((f) => {
      const n = Number(f.input.value);
      return !f.input.value.trim() || !Number.isFinite(n) || n < f.range.min || n > f.range.max;
    });
    if (bad) {
      bad.input.setAttribute('aria-invalid', 'true');
      error.textContent = `Enter a ${bad.label} from ${bad.range.min} to ${bad.range.max} mm.`;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    b.set(Number(wf.input.value), Number(hf.input.value), null);
    renderSizes();
    schedule();
  };
  for (const f of [wf, hf]) {
    f.input.addEventListener('input', onInput);
    f.input.addEventListener('change', commit);
  }
  $(b.host).replaceChildren(
    el('div', { class: 'size-inputs' }, wf.field, el('span', { class: 'times', 'aria-hidden': 'true', text: '×' }), hf.field),
    error,
    buildOutlineBox(id));
}

/* ---------- outline (an SVG the pattern fills) ---------- */
function bindDrop(zone, onFile) {
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer?.files?.[0]) onFile(e.dataTransfer.files[0]);
  });
}

function svgInput(id) {
  const input = el('input', { type: 'file', accept: '.svg,image/svg+xml', class: 'visually-hidden' });
  input.addEventListener('change', () => {
    if (input.files?.[0]) loadOutline(input.files[0], id);
    input.value = '';
  });
  return input;
}

/** Built once per design; renderOutline() only updates it, so the rotate slider keeps working while dragged. */
function buildOutlineBox(id) {
  const drop = el('label', { class: 'dropzone compact', 'data-outline': 'empty' },
    icon('M9 2.5l2 4.2 4.5.6-3.3 3.1.8 4.5L9 12.8l-4 2.1.8-4.5-3.3-3.1 4.5-.6z'),
    el('span', { class: 'small strong', text: 'Fill an outline instead' }),
    el('span', { class: 'small muted', text: 'Drop an SVG here, or browse. The pattern fills the shape.' }),
    svgInput(id));
  bindDrop(drop, (file) => loadOutline(file, id));

  const match = el('button', { type: 'button', class: 'link small', 'data-outline': 'match', text: 'Match its shape' });
  match.addEventListener('click', () => { matchOutline(id); renderSizes(); schedule(); commit(); });
  const remove = el('button', { type: 'button', class: 'link small', text: 'Remove' });
  remove.addEventListener('click', () => {
    state.outline = null;
    renderOutline();
    schedule();
    commit();
  });
  const replace = el('label', { class: 'link small file-link' }, 'Replace', svgInput(id));

  const rotateId = `${id}-outline-rotate`;
  const rotate = el('input', { id: rotateId, type: 'range', min: -180, max: 180, step: 5, value: 0 });
  rotate.addEventListener('input', () => {
    if (!state.outline) return;
    state.outline.rotation = Number(rotate.value);
    renderOutline();
    schedule();
  });
  rotate.addEventListener('change', commit);

  const card = el('div', { class: 'outline-loaded', 'data-outline': 'loaded', hidden: true },
    el('div', { class: 'img-info' },
      el('canvas', { class: 'outline-thumb', width: 112, height: 112, 'aria-hidden': 'true' }),
      el('div', { class: 'img-text' },
        el('div', { class: 'img-name', 'data-outline': 'name' }),
        el('div', { class: 'small muted', 'data-outline': 'info' }),
        el('div', { class: 'img-actions' }, match, replace, remove))),
    el('div', { class: 'ctl' },
      el('div', { class: 'ctl-top' }, el('label', { class: 'ctl-label', for: rotateId, text: 'Rotate outline' }), el('span', { class: 'ctl-readout', 'data-outline': 'angle' })),
      rotate,
      el('div', { class: 'ctl-ends', 'aria-hidden': 'true' }, el('span', { text: '−180°' }), el('span', { text: '180°' }))));
  bindDrop(card, (file) => loadOutline(file, id));
  return el('div', { class: 'outline-box', id: `${id}-outline` }, drop, card);
}

function outlineAspect() {
  return ringsAspect(rotateRings(unflattenRings(state.outline.rings), state.outline.rotation));
}

function matchOutline(id) {
  const b = BINDINGS[id].size;
  const [w, h] = fitAspect(b.get()[0], outlineAspect(), b.ranges);
  b.set(w, h, null);
}

function renderOutline() {
  const o = state.outline;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#34469a';
  for (const id of Object.keys(BINDINGS)) {
    const box = $(`#${id}-outline`);
    if (!box) continue;
    box.querySelector('[data-outline="empty"]').hidden = !!o;
    box.querySelector('[data-outline="loaded"]').hidden = !o;
    if (!o) continue;
    const parts = o.rings.length;
    box.querySelector('[data-outline="name"]').textContent = o.name;
    const b = BINDINGS[id].size;
    const [w, h] = b.get();
    const [mw, mh] = fitAspect(w, outlineAspect(), b.ranges);
    const matched = mw === w && mh === h;
    box.querySelector('[data-outline="info"]').textContent = `${parts === 1 ? 'One shape' : `${parts} shapes and holes`} · fitted inside ${w} × ${h} mm${matched ? '' : ' (with room to spare)'}`;
    box.querySelector('[data-outline="match"]').hidden = matched;
    box.querySelector('[data-outline="angle"]').textContent = `${o.rotation}°`;
    const rotate = $(`#${id}-outline-rotate`);
    if (document.activeElement !== rotate) rotate.value = String(o.rotation);
    const thumb = box.querySelector('.outline-thumb');
    const key = `${o.name}:${o.rotation}:${o.rings.length}:${o.rings[0].length}:${accent}`;
    if (thumb.dataset.key !== key) {
      drawOutlineThumb(thumb, rotateRings(unflattenRings(o.rings), o.rotation), accent);
      thumb.dataset.key = key;
    }
  }
}

async function loadOutline(file, id) {
  if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
    toast('Use an SVG file for the outline.');
    return;
  }
  try {
    const o = await readSvgOutline(file);
    state.outline = { name: o.name, rings: o.rings, rotation: 0 };
    matchOutline(id);
    renderSizes();
    schedule();
    commit();
    const [w, h] = BINDINGS[id].size.get();
    toast(`Filling ${o.name}: the swatch is ${w} × ${h} mm to match its shape`);
  } catch (e) {
    toast(`Could not use that outline: ${e.message}`);
  }
}

function fieldValue(key) {
  return key in state.advanced ? state.advanced[key] : fieldDefault(key);
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
        input.addEventListener('change', () => { state.advanced[f.key] = input.value; renderAdvancedSummary(); schedule(); commit(); });
      } else if (f.type === 'checkbox') {
        input = el('input', { id, type: 'checkbox', 'data-key': f.key });
        input.checked = !!fieldValue(f.key);
        input.addEventListener('change', () => { state.advanced[f.key] = input.checked; renderAdvancedSummary(); schedule(); commit(); });
      } else {
        input = el('input', { id, type: 'number', inputmode: 'decimal', step: f.step ?? 'any', 'data-key': f.key });
        if (f.min !== undefined) input.min = String(f.min);
        const v = fieldValue(f.key);
        input.value = v === null || v === undefined ? '' : String(v);
        if (f.placeholder) input.placeholder = f.placeholder;
        input.addEventListener('input', () => {
          const raw = input.value.trim();
          if (raw === '' && f.nullable) delete state.advanced[f.key];
          else state.advanced[f.key] = raw === '' ? NaN : Number(raw);
          renderAdvancedSummary();
          schedule();
        });
        input.addEventListener('change', commit);
      }
      const label = f.unit ? `${f.label} (${f.unit})` : f.label;
      const row = f.type === 'checkbox'
        ? el('label', { class: 'field-row inline', for: id }, input, el('span', { text: label }))
        : el('label', { class: 'field-row', for: id }, el('span', { text: label }), input);
      const wide = f.label.length > 26 || f.type === 'checkbox';
      fields.append(el('div', { class: wide ? 'wide' : '' }, row, el('p', { class: 'field-error', 'data-for': f.key, hidden: true })));
    }
    const reset = el('button', { type: 'button', class: 'link small', 'data-reset-group': group.id, text: 'Reset this group', hidden: true });
    reset.addEventListener('click', () => {
      for (const f of group.fields) delete state.advanced[f.key];
      buildAdvanced();
      schedule();
      commit();
    });
    const details = el('details', { class: 'adv-group', 'data-group': group.id, open: openAdvancedGroups.has(group.id) },
      el('summary', {},
        el('span', { class: 'adv-title' }, el('span', { class: 'adv-name', text: group.title }), el('span', { class: 'adv-hint', text: group.hint })),
        el('span', { class: 'adv-count', 'data-group': group.id }),
        el('span', { class: 'adv-chev' }, icon(ICONS.chevron, { size: 16 }))),
      fields,
      el('div', { class: 'adv-foot' }, reset));
    details.addEventListener('toggle', () => {
      if (details.open) openAdvancedGroups.add(group.id);
      else openAdvancedGroups.delete(group.id);
    });
    body.append(details);
  }
  renderAdvancedSummary();
}

function openAdvanced(open) {
  $('#advanced-body').hidden = !open;
  $('#btn-advanced').setAttribute('aria-expanded', String(open));
}

/** A tiny picture of what a pattern does: wavy lines that swing wider and tighter where the pattern is dark. */
function drawPatternThumb(canvas, sampler) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const size = 48;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#34469a';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  for (let row = 0; row < 5; row++) {
    const y0 = 6 + row * 9;
    let phase = row * 0.9;
    ctx.beginPath();
    for (let x = 3; x <= size - 3; x += 0.5) {
      const tone = Math.max(0, Math.min(1, sampler((x / size) * 50, (1 - y0 / size) * 50, 50, 50)));
      phase += 0.5 * 2 * Math.PI * (1 / 9) * (1 + 1.2 * tone);
      const y = y0 + (0.2 + 3.4 * tone) * Math.sin(phase);
      if (x === 3) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function buildPatterns() {
  const host = $('#sq-patterns');
  host.replaceChildren(...PATTERNS.map((p) => {
    let thumb;
    if (p.id === 'image') {
      if (state.image) {
        thumb = el('canvas', { class: 'pattern-thumb', width: 96, height: 96, 'aria-hidden': 'true' });
        thumb.getContext('2d').drawImage(state.image.thumb, 0, 0, 96, 96);
      } else {
        thumb = el('span', { class: 'pattern-thumb upload', 'aria-hidden': 'true' }, icon('M9 12.5V4M5.5 7.5L9 4l3.5 3.5M3 14.5h12'));
      }
    } else {
      thumb = el('canvas', { class: 'pattern-thumb', 'aria-hidden': 'true' });
      drawPatternThumb(thumb, SAMPLERS[p.id]);
    }
    const btn = el('button', { type: 'button', class: 'pattern', 'data-pattern': p.id, 'aria-pressed': 'false' }, thumb, el('span', { text: p.label }));
    btn.addEventListener('click', () => {
      if (p.id === 'image' && !state.image) {
        state.imageBoxOpen = true;
        renderSquiggleChoices();
        $('#sq-file-input').click();
        return;
      }
      state.imageBoxOpen = false;
      state.squiggle.pattern = p.id;
      renderSquiggleChoices();
      schedule();
      commit();
    });
    return btn;
  }));
  renderSquiggleChoices();
}

function syncControls() {
  for (const id of Object.keys(BINDINGS)) {
    for (const axis of ['w', 'h']) $(`#${id}-${axis}`)?.removeAttribute('aria-invalid');
    const error = $(`#${id}-size-error`);
    if (error) error.hidden = true;
  }
  buildAdvanced();
  renderSliders();
  renderSizes();
  renderSquiggleChoices();
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
  const chip = (ok, yes, no) => el('span', { class: `chip ${ok ? 'ok' : 'warn'}`, text: ok ? yes : no });
  $('#dialog-chips').replaceChildren(
    ...(machine ? [chip(machine.verified, 'Printer verified', 'Printer not verified')] : []),
    ...(material ? [chip(material.verified, 'Filament verified', 'Filament not yet tried here')] : []));
  $('#dialog-note').textContent = [
    machine && (machine.verified ? 'Printer limits come from your own sliced file.' : 'Printer limits are not verified yet.'),
    material && (material.verified ? 'Filament behaviour is verified.' : 'Filament values come from the maker\'s guidance and have not been printed here yet, so start with a test swatch.'),
  ].filter(Boolean).join(' ');
}

/* ---------- designs ---------- */
/** One tile per registry module; planned designs are visible placeholders that cannot be selected. */
function renderTiles() {
  const tiles = DESIGNS.map((d) => {
    const ready = d.status === 'ready';
    const tile = el('button', {
      type: 'button',
      class: ready ? 'design-tile' : 'design-tile planned',
      'data-design': ready ? d.id : false,
      'data-planned': ready ? false : d.id,
      'aria-pressed': ready ? String(d.id === state.design) : false,
      'aria-disabled': ready ? false : 'true',
      disabled: !ready,
      title: ready ? false : `${d.name} is coming soon`,
    });
    tile.innerHTML = `${THUMBS[d.id] ?? ''}<span class="design-text"><span class="design-name">${d.name}${ready ? '' : '<span class="soon">Soon</span>'}</span><span class="design-sub">${d.blurb}</span></span>`;
    if (ready) tile.addEventListener('click', () => setDesign(d.id));
    return tile;
  });
  $('#design-list').replaceChildren(...tiles);
}

function resetRoles() {
  state.roles = {};
  preview?.setRoles(Object.fromEntries(ROLES.map((r) => [r, true])));
}

function showDesign() {
  for (const tile of $$('[data-design]')) tile.setAttribute('aria-pressed', String(tile.dataset.design === state.design));
  $('#panel-loop-pile').hidden = state.design !== 'loop-pile';
  $('#panel-squiggle').hidden = state.design !== 'squiggle';
  $('#tight-option').hidden = state.design !== 'loop-pile';
  if (state.design !== 'loop-pile' && state.showTight) setShowTight(false);
}

function setDesign(id) {
  if (state.design === id || !isReady(id)) return;
  stopPlay();
  state.design = id;
  state.fraction = 1;
  state.checkOpen = null;
  state.why = false;
  resetRoles();
  showDesign();
  $('#settings-body').scrollTop = 0;
  schedule();
  commit();
}

/* ---------- pictures for the squiggle pattern ---------- */
function loadPicture(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('That is not a picture: use a PNG, JPG or WebP file.');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const scale = Math.min(1, 400 / Math.max(natW, natH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(natW * scale));
    canvas.height = Math.max(1, Math.round(natH * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 112;
    const side = Math.min(natW, natH);
    thumb.getContext('2d').drawImage(img, (natW - side) / 2, (natH - side) / 2, side, side, 0, 0, 112, 112);
    state.image = { data: ctx.getImageData(0, 0, canvas.width, canvas.height), name: file.name, px: [natW, natH], thumb };
    const [w, h] = sizeForAspect(natW, natH);
    state.squiggle.width = w;
    state.squiggle.height = h;
    state.squiggle.pattern = 'image';
    state.imageBoxOpen = false;
    $('#sq-thumb').getContext('2d').drawImage(thumb, 0, 0, 112, 112);
    buildPatterns();
    renderSizes();
    schedule();
    commit();
    toast(`Swatch set to ${w} × ${h} mm to match the picture's shape`);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('That picture could not be opened.'); };
  img.src = url;
}

function bindSquiggle() {
  for (const btn of $$('[data-sqmode]')) {
    btn.addEventListener('click', () => {
      state.squiggle.mode = btn.dataset.sqmode;
      renderSquiggleChoices();
      schedule();
      commit();
    });
  }
  $('#sq-color-change').addEventListener('change', (e) => {
    state.squiggle.colorChange = e.target.checked;
    schedule();
    commit();
  });

  const fileInput = $('#sq-file-input');
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) loadPicture(fileInput.files[0]);
    fileInput.value = '';
  });
  const drop = $('#sq-dropzone');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    if (e.dataTransfer?.files?.[0]) loadPicture(e.dataTransfer.files[0]);
  });
  $('#sq-img-match').addEventListener('click', () => {
    if (!state.image) return;
    const [w, h] = sizeForAspect(...state.image.px);
    state.squiggle.width = w;
    state.squiggle.height = h;
    renderSizes();
    renderSquiggleChoices();
    schedule();
    commit();
  });
  $('#sq-img-clear').addEventListener('click', () => {
    state.image = null;
    state.imageBoxOpen = false;
    if (state.squiggle.pattern === 'image') state.squiggle.pattern = SQUIGGLE_DEFAULTS.pattern;
    buildPatterns();
    schedule();
    commit();
  });
}

/* ---------- actions ---------- */
function slug(s) {
  return (s || 'swatch').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'swatch';
}

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportGcode() {
  if (!state.result || state.error) return;
  const t = state.result.cfg.t;
  const name = `${slug(state.docName)}_${designById(state.design).file}_${t.sample_width}x${t.sample_height}_${state.material}.gcode`;
  download(name, new Blob([state.result.gcode], { type: 'text/plain' }));
  toast(`Saved ${name}`);
}

async function shareLink() {
  const hash = stateToHash(snapshot());
  const url = `${location.origin}${location.pathname}${hash}`;
  const picture = state.design === 'squiggle' && state.squiggle.pattern === 'image';
  const note = picture ? ' Your picture stays on this computer, so the link opens with the centre spot pattern.' : '';
  try {
    await navigator.clipboard.writeText(url);
    toast(`Link copied.${note}`);
  } catch {
    try { history.replaceState(null, '', hash); } catch { /* ignore */ }
    toast(`The address bar now holds the link: copy it from there.${note}`);
  }
}

function saveFile() {
  download(`${slug(state.docName)}-settings.json`, new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
}

async function openFile(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object') throw new Error('that is not a settings file');
    applySnapshot(data);
    commit();
    toast('Settings loaded');
  } catch (e) {
    $('#errors').hidden = false;
    $('#errors').replaceChildren(el('div', { text: `Could not open that file: ${e.message}` }));
  }
}

function resetDesign() {
  if (state.design === 'squiggle') {
    state.squiggle = { ...SQUIGGLE_DEFAULTS };
    state.image = null;
    state.imageBoxOpen = false;
    buildPatterns();
  } else {
    state.primary = { ...PRIMARY_DEFAULTS };
    state.advanced = {};
  }
  state.checkOpen = null;
  syncControls();
  schedule();
  commit();
  toast('This design is back to its defaults. Undo brings your settings back.');
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
const HAS_POPOVER = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

/** Menus open under the button that opens them, aligned to its right edge. */
function anchorPopover(menu, button) {
  const place = () => {
    const r = button.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 6)}px`;
    menu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  };
  button.setAttribute('aria-expanded', 'false');
  if (!HAS_POPOVER) {
    // older browsers: a plain toggle that closes on an outside click or Escape
    menu.hidden = true;
    const set = (open) => { menu.hidden = !open; button.setAttribute('aria-expanded', String(open)); };
    button.addEventListener('click', () => { place(); set(menu.hidden); });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); button.focus(); } });
    return;
  }
  menu.addEventListener('beforetoggle', (e) => {
    if (e.newState !== 'open') return;
    place();
    button.setAttribute('aria-expanded', 'true');
  });
  menu.addEventListener('toggle', (e) => { if (e.newState !== 'open') button.setAttribute('aria-expanded', 'false'); });
}

function closeMenus() {
  for (const m of $$('.menu')) {
    if (!HAS_POPOVER) m.hidden = true;
    else if (m.matches(':popover-open')) m.hidePopover();
  }
}

function bindStatic() {
  for (const b of $$('[data-camera]')) {
    b.addEventListener('click', () => {
      for (const o of $$('[data-camera]')) o.setAttribute('aria-pressed', String(o === b));
      preview.setCamera(b.dataset.camera);
    });
  }
  for (const box of $$('#view-menu [data-layer]')) {
    box.addEventListener('change', () => preview.setLayers({ [box.dataset.layer]: box.checked }));
  }
  $('#exaggerate').addEventListener('change', (e) => preview.setExaggerate(e.target.checked));
  $('#show-violations').addEventListener('change', (e) => setShowTight(e.target.checked));
  for (const b of $$('[data-room]')) b.addEventListener('click', () => setRoomy(b.dataset.room === 'roomy'));
  for (const b of $$('[data-edge]')) {
    b.addEventListener('click', () => {
      state.primary.edgeLoops = b.dataset.edge === 'every';
      afterControl();
      commit();
    });
  }

  $('#scrub').addEventListener('input', (e) => {
    stopPlay();
    state.fraction = Number(e.target.value) / 1000;
    applyScrub();
    renderPlayback();
  });
  $('#btn-play').addEventListener('click', play);

  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#btn-export').addEventListener('click', exportGcode);
  $('#btn-share').addEventListener('click', shareLink);
  $('#btn-details').addEventListener('click', () => { state.details = !state.details; renderFigures(); });
  $('#btn-advanced').addEventListener('click', () => openAdvanced($('#advanced-body').hidden));
  $('#doc-name').addEventListener('input', (e) => { state.docName = e.target.value; });
  $('#doc-name').addEventListener('change', () => { store.set(STORAGE_KEY, JSON.stringify(snapshot())); });
  $('#doc-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  anchorPopover($('#more-menu'), $('#btn-more'));
  anchorPopover($('#view-menu'), $('#btn-view'));
  $('#btn-help').addEventListener('click', () => { closeMenus(); $('#help-dialog').showModal(); });
  $('#btn-save-file').addEventListener('click', () => { closeMenus(); saveFile(); });
  $('#btn-reset').addEventListener('click', () => { closeMenus(); resetDesign(); });
  $('#file-open').addEventListener('change', (e) => {
    closeMenus();
    if (e.target.files[0]) openFile(e.target.files[0]);
    e.target.value = '';
  });

  const dialog = $('#printer-dialog');
  $('#btn-printer').addEventListener('click', () => { fillDialogSelects(); dialog.showModal(); });
  $('#sel-machine').addEventListener('change', (e) => { state.machine = e.target.value; updateDialogNote(); schedule(); commit(); });
  $('#sel-material').addEventListener('change', (e) => { state.material = e.target.value; updateDialogNote(); schedule(); commit(); });

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, select, textarea')) return;
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  });

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', buildPatterns);

  bindSquiggle();
}

async function init() {
  await loadProfiles();
  preview = createPreview($('#preview'));

  // start from: a shared link, then the last session, then the defaults
  const fromLink = hashToState(location.hash);
  let initial = fromLink;
  if (!initial) {
    try { initial = JSON.parse(store.get(STORAGE_KEY) ?? 'null'); } catch { initial = null; }
  }
  let pictureDropped = false;
  if (initial) pictureDropped = loadState(initial);

  for (const id of Object.keys(BINDINGS)) {
    buildSize(id);
    buildSliders(id);
  }
  buildAdvanced();
  buildPatterns();
  fillDialogSelects();
  renderTiles();
  bindStatic();
  showDesign();
  $('#doc-name').value = state.docName;
  regenerate();
  commit();
  if (pictureDropped && fromLink) toast('This link was made with a picture, which links can\'t carry, so it opens with the centre spot pattern.');
}

init().catch((e) => {
  const box = $('#errors');
  box.hidden = false;
  box.replaceChildren(el('div', { text: `The studio could not start: ${e.message}` }));
  console.error(e);
});
