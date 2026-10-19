import { PRINTABILITY } from './printability-data.js';
import { validNumber } from './numeric.js';
import { generate } from '../engine/generate.js';
import { generateSquiggle, SAMPLERS, createImageSampler, minCrossingAmplitude } from '../engine/squiggle.js';
import { placeOutline, unflattenRings } from '../engine/outline.js';
import { createPreview, ROLES } from './preview.js';
import { createOverview } from './overview.js';
import { useWholeOverview, canSimplifyPreview } from '../engine/overview.js';
import { bedSizeLimits, printSizeProblem } from './bed-size.js';
import { PrintEstimates } from './print-estimates.js';
import { RANGES, PRIMARY_DEFAULTS, sampleSize, toTextile, describePrimary, airStrandMm, fitAspect, pileLiftFactor } from './controls.js';
import { SQ_RANGES, SQUIGGLE_DEFAULTS, describeSquiggle, sizeForAspect } from './squiggle-controls.js';
import { buildVerdict, buildSquiggleVerdict, formatMinutes } from './verdict.js';
import { stateToHash, hashToState, sanitizeState, PRINT_DEFAULTS } from './share.js';
import { ADVANCED_GROUPS, FIELD_LABELS, fieldDefault, changedFields } from './param-schema.js';
import { $, $$, el, icon, ICONS } from './dom.js';
import { DesignPanel, SizeControl, SliderControl, PatternPicker, SvgImportCard, PrintSetupCard, SectionFold } from './panels.js';
import { layerHeightOptions, defaultLayerHeight, resolveConfig } from '../engine/params.js';
import { TooltipLayer } from './tooltip.js';
// versioned with the release in boot.js, so a returning browser never pairs this file with an older printer loader
import { ProfileStore } from './profile-store.js?v=20261019-printer-setup';
import { machineSuggestions } from './machine-search.js?v=20261019-printer-setup';
import { DESIGNS, ESSENTIALS, designById, isReady, baseDesignSettings } from './designs.js';
import { THUMBS, shapeThumb, presetThumb } from './thumbs.js';
import { swatchCode } from './swatch.js';
import { exportFileName, relevantKeys } from './file-name.js';
import { FIELDS, FIELD_IDS, createField } from '../engine/fields.js';
import { SHAPES, SHAPE_IDS } from '../engine/shapes.js';
import { readSvgLines } from './svg-lines.js';
import { composeSvgLines, outlineFromVector, vectorPatternRings } from '../engine/svg-lines.js';
import { applySvgGuides, vectorGuides } from '../engine/svg-guides.js';
import { summariseDrawing, describeDrawing, interpretDrawing } from '../engine/drawing.js';
import { addExtraLayers, nativeLayerInfo } from '../engine/stack.js';
import { generateDesignBase } from '../engine/design-export.js';
import { rotateDesignInput } from '../engine/rotate-design.js';
import { applyBrim } from '../engine/brim.js';
import { boundaryFor } from '../engine/layers.js';
import { conformalGuideRegion } from '../engine/conformal.js';
import { windowRings } from '../engine/window.js';
import { bindPanelExport } from './panel-ui.js';
import { createStudyRecorder } from './study.js';
import { buildSwatch } from './export-builder.js';
import { classifyBuildError, DiagnosticLog, suggestRecovery, safeMetadata } from './diagnostics.js';
import { bindFeedback, problemReport } from './feedback.js';
import { bindPrivacyNotice, statsAllowed } from './privacy.js';
import { describeFabric, fixCandidates, problemScore, describeChanges } from './fix-geometry.js';

// the release this page loaded (boot.js imports this file with ?v=), so feedback says which version it is about
const RELEASE = new URL(import.meta.url).searchParams.get('v') ?? 'dev';
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
const PATTERN_SCALE = { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false };
// plainest first: the first one leaves every wave the same, the last ones need a picture
const PATTERNS = [
  { id: 'uniform', label: 'Even' },
  { id: 'gradientX', label: 'Fade across' },
  { id: 'gradientY', label: 'Fade up' },
  { id: 'centerSpot', label: 'Centre spot' },
  { id: 'waves', label: 'Ripples' },
  ...FIELD_IDS.map((id) => ({ id, label: FIELDS[id].label })),
  { id: 'image', label: 'Your picture' },
];

/** The two designs' controls, wired to the same slider and size components. */
const BINDINGS = {
  'loop-pile': {
    sliders: [...LOOP_SLIDERS, PATTERN_SCALE],
    build: LOOP_SLIDERS,
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
  design: 'zigzag',
  primary: { ...PRIMARY_DEFAULTS },
  advanced: {},
  squiggle: { ...SQUIGGLE_DEFAULTS },
  // settings of every design newer than the loop pile and squiggle, by design id
  designs: Object.fromEntries(DESIGNS.filter((d) => d.status === 'ready' && !d.legacy).map((d) => [d.id, d.defaults()])),
  image: null, // { data: ImageData, name, px: [w, h], thumb: canvas }: stays on this computer, never in a link
  imageBoxOpen: false,
  outline: null, // { name, rings (flat, unit box), rotation }: shared by every design, travels in links
  vector: null,
  print: { ...PRINT_DEFAULTS }, // layer thickness and extra fabric or backing passes, shared across designs
  docName: 'Untitled swatch',
  result: null,
  resultKey: null,
  error: null,
  fraction: 1,
  playing: false,
  details: false,
  checkOpen: null, // null: open when there is something to look at
  why: false,
  showTight: false,
  roles: {},
};
/**
 * A newer design describes its sliders and size in the registry; the studio wires them to the same slider and
 * size components as the two older designs. `sliders` is everything whose value is shown; `build` is what goes in
 * the sliders group (a pattern's size slider sits with the pattern picker instead).
 */
function bindingFor(mod) {
  const items = mod.controls.filter((c) => c.kind === 'sliders').flatMap((c) => c.items);
  const scale = mod.controls.find((c) => c.kind === 'pattern')?.scale;
  const sliders = scale ? [...items, scale] : items;
  const own = () => state.designs[mod.id];
  // each sliders group has its own host: the first keeps the plain id
  const groups = mod.controls.filter((c) => c.kind === 'sliders').map((c, k) => ({ host: `#${mod.id}-sliders${k ? `-${k}` : ''}`, items: c.items }));
  return {
    sliders,
    build: items,
    groups,
    host: `#${mod.id}-sliders`,
    get: (key) => own()[key],
    set: (key, value) => { own()[key] = value; },
    range: (key) => mod.ranges[key],
    readout: (key) => {
      const def = sliders.find((d) => d.key === key);
      const d = mod.describe(own());
      return def.readout ? def.readout(d) : d[key];
    },
    size: {
      host: `#${mod.id}-size`,
      ranges: { w: mod.ranges.width, h: mod.ranges.height },
      get: () => mod.size(own()),
      set: (w, h) => mod.setSize(own(), w, h),
      outline: mod.outline !== false,
    },
  };
}
for (const mod of DESIGNS) if (mod.status === 'ready' && !mod.legacy) BINDINGS[mod.id] = bindingFor(mod);

let preview = null;
let overview = null;
let previewChoice = 'auto';
let overviewActive = false;
let overviewFine = false;
let overviewStatus = '';
const printEstimates = new PrintEstimates();
let previewBuild = null;
let exporting = false;
let exportController = null;
let exportLabel = '';
let rafId = 0;
let lastFrame = 0;
const undoLog = { stack: [], cursor: -1 };
const diagnosticLog = new DiagnosticLog();
let feedback = null;
const openAdvancedGroups = new Set();

/* ---------- storage ---------- */
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};

/* ---------- small helpers ---------- */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/** The printers and filaments: the profiles folder and what was added in the printer setup. */
const profiles = new ProfileStore();

async function loadProfiles() {
  await Promise.all([profiles.loadFolders('profiles'), profiles.loadLibrary('profiles/library')]);
  profiles.loadUser();
  state.machines = profiles.machines;
  state.materials = profiles.materials;
  if (!state.machines.has(state.machine)) state.machine = [...state.machines.keys()][0];
  if (!state.materials.has(state.material)) state.material = [...state.materials.keys()][0];
  if (profiles.problems.length) console.warn('Some profile files could not be read', profiles.problems);
  return { machines: [...state.machines.keys()], materials: [...state.materials.keys()] };
}

/** The ids a link or file may name; the studio's own default first, which is what an unknown one falls back to. */
function known() {
  const first = (list, id) => (list.includes(id) ? [id, ...list.filter((x) => x !== id)] : list);
  return { machines: first([...state.machines.keys()], 'prusa-mk3s'), materials: first([...state.materials.keys()], 'filaflex-95-foamy') };
}

function snapshot() {
  return {
    v: 3,
    sampleDefaults: 100,
    design: state.design,
    machine: state.machine,
    material: state.material,
    primary: state.primary,
    advanced: state.advanced,
    squiggle: state.squiggle,
    designs: state.designs,
    outline: state.outline,
    vector: state.vector,
    print: state.print,
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
  // the layer setup is part of what is saved and undone, like everything else that changes the print
  return JSON.stringify({ d: state.design, m: state.machine, t: state.material, p: state.primary, a: state.advanced, s: state.squiggle, g: state.designs, o: state.outline, v: state.vector, y: state.print });
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
  state.vector = clean.vector;
  state.print = clean.print;
  if (data?.print?.layerHeight === undefined) state.print.layerHeight = defaultLayerHeight(state.machines.get(state.machine));
  normalisePrint();
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

/* ---------- the settings panel (the classes are in panels.js) ---------- */

/** Every control of every panel, so they can all redraw themselves from the current settings. */
const controls = [];
let svgImportCard = null;
let studyRecorder = null;

const RAISED_DESIGNS = new Set(['loop-pile', 'relief', 'fringe', 'spacer', 'pillarweave']);
const PRINT_RANGES = { extraLayers: { min: 0, max: 10, step: 1 }, brim: { min: 0, max: 8, step: 1 } };
const PRINT_THICKNESS = { label: 'Layer thickness', help: 'How thick every layer is. Thinner prints cleaner and slower; thicker is quick, but strands lie over each other less cleanly.' };
const PRINT_LAYERS = { key: 'extraLayers', label: 'Extra layers', help: '0 keeps the original design. One-layer patterns alternate with a regenerated 90° pass across the same outline. Multi-layer patterns continue their original sequence: A–B–A–B. For raised designs, extra passes reinforce the backing beneath the texture; the texture prints once. The brim and imported SVG paths print once.', lo: 'Original', hi: 'More', unit: '', edit: true };

/** The nozzle of the chosen printer (0.4 mm unless its profile says otherwise). */
const nozzleDiameter = () => state.machines.get(state.machine)?.nozzle_diameter ?? 0.4;

/** The layer thicknesses that nozzle can lay down. */
const layerChoices = () => layerHeightOptions(nozzleDiameter(), state.machines.get(state.machine)?.print_defaults?.layer_height);

/** The nearest thickness the nozzle can print: a value from a link or a saved file, or left over from another nozzle. */
function nearestLayerHeight(h) {
  const list = layerChoices();
  return list.reduce((best, v) => (Math.abs(v - h) < Math.abs(best - h) ? v : best), list[0]);
}

function normalisePrint() {
  const h = nearestLayerHeight(state.print.layerHeight);
  if (h !== state.print.layerHeight) state.print.layerHeight = h;
  // Whole-copy settings previously left raised textures unchanged; migrating them keeps that behavior.
  if (RAISED_DESIGNS.has(state.design) && state.print.legacyCopies) { state.print.extraLayers = 0; delete state.print.legacyCopies; }
}

function layerSetupText() {
  const plan = state.result?.designId === state.design ? state.result.layerPlan : null;
  if (plan?.mode === 'backing' && plan.repeatable) return `${plan.backingLayers} backing + ${state.print.extraLayers} extra = ${plan.backingLayers + state.print.extraLayers} · texture once`;
  if (plan && !plan.repeatable) return plan.nativeLayers === null ? 'Original raised structure' : `${plan.nativeLayers} original · SVG only`;
  if (plan) return `${plan.nativeLayers} + ${state.print.extraLayers} extra = ${plan.nativeLayers + state.print.extraLayers} layers`;
  return RAISED_DESIGNS.has(state.design) ? `${state.print.extraLayers} extra backing layers · texture once` : `${state.print.extraLayers} extra layers`;
}

const PRINT_BINDING = {
  get: (key) => state.print[key],
  set: (key, value) => {
    if (key === 'brim' && value > 50) { toast('Brim: enter a count from 0 to 50.'); return; }
    if (key === 'extraLayers') {
      if (value > 250) { toast('Extra layers: enter a count from 0 to 250.'); return; }
      delete state.print.legacyCopies;
    }
    state.print[key] = ['extraLayers', 'brim'].includes(key) ? Math.max(0, Math.round(value)) : value;
  },
  available: (key) => key !== 'extraLayers' || !(state.result?.designId === state.design && state.result.layerPlan?.repeatable === false),
  range: (key) => PRINT_RANGES[key],
  options: () => layerChoices(),
  note: () => {
    const machine = state.machines.get(state.machine);
    return `${nozzleDiameter()} mm nozzle · ${defaultLayerHeight(machine)} mm ${machine?.print_defaults?.layer_height ? 'from the imported print profile' : 'nozzle-based default'}. Choose another thickness above if needed.`;
  },
  readout: (key) => {
    if (key === 'brim') return state.print.brim ? `${state.print.brim} ${state.print.brim === 1 ? 'line' : 'lines'}` : 'Off';
    if (key === 'layerHeight') return `${Math.round(state.print.layerHeight * 1000) / 1000} mm${state.print.layerHeight === defaultLayerHeight(state.machines.get(state.machine)) ? ' (default)' : ''}`;
    return layerSetupText();
  },
};

/** What the panel classes need from the studio. */
const host = {
  binding: (id) => (id === 'print' ? PRINT_BINDING : BINDINGS[id]),
  settings: (id) => settingsOf(id),
  presetPicture: (mod, preset) => presetThumb(mod, preset, { machine: state.machines.get(state.machine), material: printMaterial() }),
  change: () => afterDesignChange(),
  nudge: () => afterControl(),
  sizeChanged: () => { renderControls(); schedule(); },
  sizeLimits: (id) => bedSizeLimits(state.machines.get(state.machine), printOverhang(id)),
  sizeInvalid: () => renderExport(),
  commit: () => commit(),
  toast: (message) => toast(message),
  vectorSize: () => (state.vector ? [state.vector.width, state.vector.height] : null),
  svg: () => svgSituation(),
  importSvg: (file) => importSvg(file),
  removeSvg: () => removeSvg(),
  setShapeOutline: (on) => setShapeOutline(on),
};

function renderControls() {
  for (const c of controls) c.update();
  renderPrinter();
}

/** The panels of every design, and the sliders and size of the two older ones, mounted into their own markup. */
function buildPanels() {
  for (const mod of DESIGNS) {
    if (mod.status !== 'ready' || mod.legacy) continue;
    const panel = new DesignPanel(host, mod);
    $('#settings-body').append(panel.node);
    controls.push(panel);
  }
  for (const id of ['loop-pile', 'squiggle']) {
    const b = BINDINGS[id];
    const size = new SizeControl(host, id);
    $(b.size.host).replaceChildren(size.node);
    const sliders = (b.build ?? b.sliders).map((def) => new SliderControl(host, id, def));
    $(b.host).replaceChildren(...sliders.map((s) => s.node));
    controls.push(size, ...sliders);
  }
  const picker = new PatternPicker(host, 'loop-pile', 'pattern', ['none', ...FIELD_IDS], 'lp-pattern-title', { scale: PATTERN_SCALE });
  $('#lp-pattern').replaceChildren(picker.node);
  controls.push(picker);
  const pilePatterns = new SectionFold(host, $('#lp-pattern').closest('section'), { id: 'lp-pattern-section' });
  controls.push(pilePatterns);
  // the layers every design shares live in the printer setup
  const layersCard = new PrintSetupCard(host, { thickness: PRINT_THICKNESS, layers: PRINT_LAYERS });
  $('#print-setup').replaceChildren(layersCard.node);
  controls.push(layersCard);
}

/* ---------- the imported SVG ---------- */

/** The closed shapes of the imported drawing as an outline, worked out once per drawing. */
const shapeCache = { vector: null, outline: null };
function shapesOf(vector) {
  if (shapeCache.vector !== vector) {
    shapeCache.vector = vector;
    shapeCache.outline = outlineFromVector(vector);
  }
  return shapeCache.outline;
}

/** What the drawing holds, in the words of the import card: "2 filled shapes with 1 hole, 9 lines (up to 3 passes)". */
const summaryCache = { vector: null, bead: 0, text: '' };
function summaryOf(vector) {
  const bead = state.result?.cfg?.t?.extrusion_width ?? 0.45;
  if (summaryCache.vector !== vector || summaryCache.bead !== bead) {
    summaryCache.vector = vector;
    summaryCache.bead = bead;
    summaryCache.text = describeDrawing(summariseDrawing(vector, { bead }));
  }
  return summaryCache.text;
}

/** What the import card shows about the drawing and the current design. */
function svgSituation() {
  const mod = designById(state.design);
  const v = state.vector;
  const registered = !!state.outline?.page;
  return {
    vector: v,
    summary: v ? summaryOf(v) : '',
    usesVector: !!mod.usesVector,
    idleNote: mod.svgNote ?? 'Its lines print first, with this pattern above, and its closed shapes can shape the pattern.',
    allowsOutline: true,
    hasShapes: !!(v && shapesOf(v)),
    outlineOn: registered,
    // Only detailed 3D may show a sample; the lightweight 2D view always shows the complete document.
    window: v && state.result && (v.width > state.result.cfg.t.sample_width || v.height > state.result.cfg.t.sample_height) ? [state.result.cfg.t.sample_width, state.result.cfg.t.sample_height] : null,
  };
}

/** A drawing sets the size of the swatch, whichever design is showing. */
function followVectorSize() {
  if (!state.vector) return;
  const b = BINDINGS[state.design].size;
  const [w, h] = b.get();
  if (w !== state.vector.width || h !== state.vector.height) b.set(state.vector.width, state.vector.height, 'custom');
}

async function importSvg(file) {
  try {
    const drawing = await readSvgLines(file);
    previewChoice = 'auto';
    state.vector = drawing;
    state.outline = shapesOf(drawing); // red contains the pattern and blue cuts it away on import
    followVectorSize();
    state.docName = file.name.replace(/\.svg$/i, '').slice(0, 60);
    $('#doc-name').value = state.docName;
    $('#panel-width').value = state.vector.width;
    $('#panel-height').value = state.vector.height;
    syncControls();
    schedule();
    commit();
    toast(`Imported ${state.vector.name}: ${state.vector.width.toFixed(1)} × ${state.vector.height.toFixed(1)} mm`);
  } catch (e) {
    toast(`Could not import the SVG: ${e.message}`);
  }
}

function removeSvg() {
  state.vector = null;
  if (state.outline?.page) state.outline = null; // its shapes went with it
  syncControls();
  schedule();
  commit();
}

function setShapeOutline(on) {
  state.outline = on && state.vector ? shapesOf(state.vector) : null;
  renderControls();
  schedule();
  commit();
}

/* ---------- generation ---------- */
let genTimer = null;
function schedule() {
  fixJob?.controller.abort(); // the settings changed under the search: what it would fix is gone
  previewBuild?.controller.abort();
  previewBuild = null;
  overview?.cancel();
  exportController?.abort();
  clearTimeout(genTimer);
  genTimer = setTimeout(regenerate, 140);
  renderBusy();
  renderExport();
  renderPreviewMode();
}

function renderBusy() {
  const busy = !!genTimer || !!previewBuild || exporting;
  $('#busy-chip').hidden = !busy;
  $('#busy-chip').textContent = exporting ? exportLabel : previewBuild?.estimateOnly ? 'Calculating full estimate…' : 'Updating…';
  if (busy) $('#stage').setAttribute('aria-busy', 'true');
  else $('#stage').removeAttribute('aria-busy');
  $('#preview-cancel').hidden = !previewBuild;
  $('#preview-cancel').textContent = previewBuild?.estimateOnly ? 'Cancel calculation' : 'Cancel preview';
}

/** A captured design at its selected size, shared by preview and direct export workers. */
function exportOptions(width = null, height = null) {
  const size = BINDINGS[state.design].size.get();
  width ??= size[0]; height ??= size[1];
  return {
    machine: state.machines.get(state.machine), material: printMaterial(), design: state.design,
    width, height, settings: state.design === 'loop-pile' ? toTextile(state.primary, state.advanced) : settingsOf(state.design),
    studySettings: { ...settingsOf(state.design) }, outline: placedOutline(width, height),
    vector: state.vector, shapeOutline: !!state.outline?.page, extraLayers: state.print.extraLayers, legacyCopies: state.print.legacyCopies, brim: state.print.brim,
    image: state.image?.data ?? null, pilePattern: state.primary.pattern, pilePatternScale: state.primary.patternScale,
    panelSize: size,
  };
}

function showGenerated(result, key) {
  result.designId = state.design;
  if (state.print.legacyCopies && result.layerPlan) {
    state.print.extraLayers = result.layerPlan.extraLayers;
    delete state.print.legacyCopies;
    key = snapshotKey();
    store.set(STORAGE_KEY, JSON.stringify(snapshot()));
  }
  state.result = result;
  state.resultKey = key;
  state.error = null;
  const [width, height] = BINDINGS[state.design].size.get();
  printEstimates.put(key, result, width, height);
  preview.update(result);
  applyScrub();
}

/** Full ordinary-size designs build off the UI thread; obsolete slider jobs are terminated. */
function previewAtSelectedSize(input, { estimateOnly = false } = {}) {
  state.error = null;
  const key = snapshotKey(), controller = new AbortController();
  const job = { key, controller, promise: null, estimateOnly };
  previewBuild = job;
  job.promise = buildSwatch(input, { signal: controller.signal, preview: !estimateOnly }).then((result) => {
    if (previewBuild === job && snapshotKey() === key) {
      if (estimateOnly) printEstimates.put(key, result, input.width, input.height);
      else showGenerated(result, key);
    }
    return result;
  }).catch((error) => {
    if (error.name !== 'AbortError' && previewBuild === job) {
      if (!estimateOnly && previewChoice === 'auto' && canSimplifyPreview(error)) {
        previewBuild = null;
        showWholeOverview(input);
        toast('Full 3D could not complete. Showing a labelled lightweight preview; print settings are unchanged.');
        return null;
      }
      state.error = error;
      recordBuildFailure(error, { ...input, operation: 'preview' });
    }
    throw error;
  }).finally(() => {
    if (previewBuild === job) { previewBuild = null; renderBusy(); render(); }
  });
  void job.promise.catch(() => {});
  renderBusy();
}

/** The tone of the squiggle pattern across the swatch as it is previewed (a window at most 100 mm across). */
function squiggleSampler(width = state.squiggle.width, height = state.squiggle.height) {
  const s = state.squiggle;
  if (s.pattern === 'image' && state.image) return createImageSampler(state.image.data, width, height, { yUp: true });
  return SAMPLERS[s.pattern] ?? SAMPLERS.centerSpot;
}

/**
 * The outline as it will print for a width x height swatch (mm). A drawing's own shapes stay registered to its lines;
 * any other outline is rotated, then fitted inside the swatch.
 */
function placedOutline(width, height, fullWidth = width, fullHeight = height) {
  const o = state.outline;
  if (!o) return null;
  const rings = unflattenRings(o.rings);
  if (o.page) {
    const [pw, ph] = o.page;
    const long = Math.max(pw, ph);
    // Saved rings are simplified and rounded for sharing. While the drawing is available, its original edges are authoritative.
    const scaled = state.vector ? vectorPatternRings(state.vector, { scaleX: fullWidth / state.vector.width, scaleY: fullHeight / state.vector.height })
      : rings.map((r) => r.map((p) => ({ x: p.x * long * (fullWidth / pw), y: p.y * long * (fullHeight / ph) })));
    const cropped = windowRings(scaled, width, height);
    if (!cropped.length) throw new Error('The bottom-left preview window contains no filled SVG shape. Use full-panel export for the complete drawing.');
    return cropped;
  }
  const placed = placeOutline(rings, { rotation: o.rotation, width: fullWidth, height: fullHeight });
  return width === fullWidth && height === fullHeight ? placed : windowRings(placed, width, height);
}

/** In parallel mode, the least wave depth that still lets each line cross its neighbours (mm). */
function parallelDepth() {
  const s = state.squiggle;
  if (s.mode !== 'parallel') return null;
  return minCrossingAmplitude(s.height / Math.max(2, Math.floor(s.height / s.spacing)));
}

/** The chosen material with the chosen layer thickness: every design reads its layer height from the config it makes. */
function printMaterial() {
  const base = state.materials.get(state.material);
  normalisePrint();
  if (!base || base.print_defaults?.layer_height === state.print.layerHeight) return base;
  return { ...base, print_defaults: { ...(base.print_defaults ?? {}), layer_height: state.print.layerHeight } };
}

function renderPreviewMode() {
  $('#overview').hidden = !overviewActive;
  $('#preview').hidden = overviewActive;
  preview?.setVisible(!overviewActive);
  $('#camera-seg').hidden = overviewActive;
  $('#btn-view').hidden = overviewActive;
  $('#overview-actions').hidden = !overviewActive;
  $('#overview-status').hidden = !overviewActive;
  $('#overview-status').textContent = overviewStatus;
  $('#preview-whole').setAttribute('aria-pressed', String(overviewActive));
  $('#preview-full').setAttribute('aria-pressed', String(!overviewActive && previewChoice !== 'sample'));
  $('#preview-full').disabled = !!currentPrintSizeProblem();
  $('#preview-detail').setAttribute('aria-pressed', String(!overviewActive && previewChoice === 'sample'));
  $('#overview-fine').setAttribute('aria-pressed', String(overviewFine));
  $('.playback').hidden = overviewActive;
  $('.canvas-hint').hidden = overviewActive;
  if (overviewActive) {
    $('#canvas-note').hidden = true;
    $('#canvas-wrap').classList.remove('dimmed');
  }
}

function showWholeOverview(input) {
  overviewActive = true;
  preview.reset();
  state.playing = false;
  state.result = null;
  state.resultKey = null;
  state.error = null;
  renderPreviewMode();
  overview.update(input, overviewFine);
  renderBusy();
  render();
}

function regenerate() {
  genTimer = null;
  previewBuild?.controller.abort();
  previewBuild = null;
  const machine = state.machines.get(state.machine);
  const material = printMaterial();
  try {
    let result;
    const mod = designById(state.design);
    followVectorSize();
    const [selectedWidth, selectedHeight] = BINDINGS[state.design].size.get();
    if (useWholeOverview(selectedWidth, selectedHeight, machine, previewChoice) || previewChoice !== 'sample' && currentPrintSizeProblem()) {
      showWholeOverview(exportOptions(selectedWidth, selectedHeight));
      return;
    }
    overviewActive = false;
    overview.cancel();
    renderPreviewMode();
    const wholePreview = !currentPrintSizeProblem() && previewChoice !== 'sample';
    if (wholePreview) {
      previewAtSelectedSize(exportOptions(selectedWidth, selectedHeight));
      return;
    }
    // Detailed 3D uses a bounded sample for large pieces. Whole-piece 2D is the default for those pieces above.
    // Imported drawings keep their full scale within the explicitly labelled sample.
    const cap = state.vector && Math.max(state.vector.width, state.vector.height) <= 250 && state.vector.width <= machine.bed.width && state.vector.height <= machine.bed.depth ? 250 : 100;
    if (!mod.legacy) {
      const own = state.designs[mod.id];
      const [w, h] = mod.size(own);
      const previewState = { ...own, width: Math.min(w, cap), height: Math.min(h, cap) };
      result = mod.generate(machine, material, previewState, { outline: mod.outline === false ? null : placedOutline(previewState.width, previewState.height, w, h), vector: mod.usesVector || mod.vectorGuides ? state.vector : null, vectorSize: [w, h], includeLines: !state.vector });
    } else if (state.design === 'squiggle') {
      const s = state.squiggle;
      // a picture is shown whole: the preview is the whole swatch at the shape it has, shrunk to fit the window
      const shrink = s.pattern === 'image' && state.image && !state.vector ? Math.min(1, cap / Math.max(s.width, s.height)) : null;
      const pw = shrink ? Math.max(10, Math.round(s.width * shrink)) : Math.min(s.width, cap);
      const ph = shrink ? Math.max(10, Math.round(s.height * shrink)) : Math.min(s.height, cap);
      result = generateSquiggle(machine, material, {
        width: pw,
        height: ph,
        mode: s.mode,
        shape: s.shape,
        spacing: s.spacing,
        amplitude: s.amplitude,
        wavelength: s.wavelength,
        sampler: squiggleSampler(pw, ph),
        colorChange: s.colorChange,
        outline: placedOutline(pw, ph, shrink ? pw : s.width, shrink ? ph : s.height),
      });
    } else {
      const [w, h] = sampleSize(state.primary);
      const textile = toTextile(state.primary, state.advanced);
      textile.sample_width = Math.min(w, cap); textile.sample_height = Math.min(h, cap);
      result = generate(machine, material, textile, { outline: placedOutline(textile.sample_width, textile.sample_height, w, h), liftAt: pileLiftFactor(state.primary) });
    }
    if (state.vector) {
      const [fullWidth, fullHeight] = BINDINGS[state.design].size.get();
      result = applySvgGuides(result, state.vector, { fullWidth, fullHeight, outline: mod.outline === false ? placedOutline(result.cfg.t.sample_width, result.cfg.t.sample_height, fullWidth, fullHeight) : null });
      // a drawing that is also the outline lies on the boundary itself, so its lines are not trimmed to it
      result = composeSvgLines(result, state.vector, { fullWidth, fullHeight, clipLines: !state.outline?.page && !result.guideCount });
    }
    const native = nativeLayerInfo(result);
    const extras = state.print.legacyCopies ? (native.repeatable && !native.raised ? native.patternLayers * (state.print.legacyCopies - 1) : 0) : state.print.extraLayers;
    result = addExtraLayers(result, extras, {
      rotatedResult: () => generateDesignBase(rotateDesignInput({ ...exportOptions(), width: result.cfg.t.sample_width, height: result.cfg.t.sample_height,
        outline: result.outline, vectorSize: [selectedWidth, selectedHeight] })),
      colorChange: !!settingsOf(state.design).colorChange,
    });
    // Offset the selected outline before clipping: a bounded preview must never invent an edge at its crop.
    const pictured = state.design === 'squiggle' && state.squiggle.pattern === 'image' && state.image && !state.vector;
    const fullWidth = pictured ? result.cfg.t.sample_width : selectedWidth;
    const fullHeight = pictured ? result.cfg.t.sample_height : selectedHeight;
    let brimOutline = result.outline;
    if (fullWidth !== result.cfg.t.sample_width || fullHeight !== result.cfg.t.sample_height) {
      const boundary = boundaryFor(fullWidth, fullHeight, placedOutline(fullWidth, fullHeight));
      brimOutline = state.vector ? conformalGuideRegion(boundary, vectorGuides(state.vector, fullWidth, fullHeight)).rings : boundary.rings;
    }
    result = applyBrim(result, { count: state.print.brim, outline: brimOutline, fullWidth, fullHeight });
    if (state.vector && result.cfg.t.sample_width === selectedWidth && result.cfg.t.sample_height === selectedHeight) result.documentSize = [state.vector.width, state.vector.height];
    showGenerated(result, snapshotKey());
  } catch (e) {
    if (previewChoice === 'auto' && canSimplifyPreview(e)) {
      try { showWholeOverview(exportOptions()); return; } catch { /* invalid document dimensions still report normally */ }
    }
    state.error = e;
    recordBuildFailure(e);
    if (!(e && Array.isArray(e.errors))) console.error(e);
  }
  renderBusy();
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
    const [w, h] = BINDINGS[state.design].size.get();
    const t = state.result?.cfg.t;
    const sampled = t && (t.sample_width !== w || t.sample_height !== h);
    $('#canvas-note').hidden = !sampled;
    if (sampled) $('#canvas-note').textContent = `3D detail: ${t.sample_width} × ${t.sample_height} mm sample · full export ${w} × ${h} mm`;
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
  $('#canvas-note').textContent = 'Showing your last valid settings';
  $('#canvas-note').hidden = !hasPreview;
  $('#canvas-wrap').classList.toggle('dimmed', hasPreview);
}

/** What in a warning points at a setting, and which settings (by key) a person would change to answer it. */
const FIXES = [
  { when: /cross each other more than|overlap far too much|moves; the limit/i, keys: ['rowOverlap', 'size', 'spacing', 'pitch', 'cell', 'block', 'wavelength'], advice: (l) => `Lower "${l}".` },
  { when: /separate|disconnected|region|island/i, keys: ['spacing', 'pitch', 'cell', 'size', 'rowPitch', 'warpPitch', 'wavelength', 'block', 'hub'], advice: (l) => `Lower "${l}" so the lines meet.` },
  { when: /never cross|peeled apart/i, keys: ['angle', 'turn', 'phase', 'second'], advice: (l) => `Change "${l}" so the layers cross each other.` },
  { when: /free strand|without crossing|sag/i, keys: ['spacing', 'pitch', 'cell', 'size', 'rowPitch', 'warpPitch', 'wavelength', 'block'], advice: (l) => `Lower "${l}", or add a direction.` },
  { when: /outline|outside|leave/i, keys: ['size', 'spacing', 'pitch', 'cell', 'block'], advice: (l) => `Lower "${l}" so more of the pattern fits inside.` },
];

/** The setting to change, named as the panel names it, for the first warning text it matches. */
function adviceFor(mod, text) {
  if (!mod || mod.legacy) return '';
  const labels = new Map();
  for (const c of mod.controls ?? []) if (c.kind === 'sliders') for (const item of c.items) labels.set(item.key, item.label);
  for (const fix of FIXES) {
    if (!fix.when.test(text)) continue;
    const key = fix.keys.find((k) => labels.has(k));
    if (key) return ` ${fix.advice(labels.get(key))}`;
  }
  return '';
}

/** The geometry check, or null when there is nothing to say: it only speaks up for a problem, and says what to change. */
function currentVerdict() {
  if (!state.result || state.error) return null;
  const fabric = state.result.fabric;
  const mod = designById(state.design);
  if (fabric && !fabric.exportable) {
    const advice = adviceFor(mod, fabric.issues.join('. '));
    const fix = fabric.issues.length > 0 && !!BINDINGS[state.design]?.sliders?.length;
    return {
      level: 'heads-up', title: 'Check the geometry', fix,
      body: `${describeFabric(fabric)}${advice}${fix ? ' Fix it tries small changes to the settings and keeps the first one that clears this.' : ''} You can also export it as it is: it prints as drawn.`,
      action: null,
    };
  }
  const verdict = !mod.legacy ? mod.verdict(state.result, state.designs[mod.id]) : state.design === 'squiggle'
    ? buildSquiggleVerdict(state.result.stats, { colorChange: state.squiggle.colorChange })
    : buildVerdict(state.result.stats, { roomy: state.primary.roomy });
  if (verdict.level === 'ready' || verdict.level === 'ok') return null;
  return { ...verdict, body: verdict.body + adviceFor(mod, `${verdict.title} ${verdict.body}`) };
}

function renderCheck() {
  const box = $('#check');
  let v = currentVerdict();
  const recovery = state.error ? suggestRecovery(designById(state.design), settingsOf(state.design), state.error) : null;
  if (!v && state.error) {
    // say what the problem is, and which setting to change: the same words the message above the controls uses
    const text = Array.isArray(state.error.errors) ? state.error.errors.map((m) => plainError(m).text).join('. ') : String(state.error.message || state.error);
    v = { level: 'error', title: 'Can\'t build this yet', body: recovery ? `${text} Simplify this pattern restores practical spacing and loop or wave sizes. You can undo the change.` : `${text}${adviceFor(designById(state.design), text)} Download the error log to keep this attempt and its settings.`, action: null };
  }
  if (!v) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `check ${v.level}`;
  // collapsed by default so the controls keep the room; the one fix that matters sits on the row itself
  // it only appears for a problem, so it opens straight onto what the problem is
  const open = state.checkOpen ?? true;
  const toggle = el('button', { type: 'button', class: 'check-head', 'aria-expanded': String(open), 'aria-controls': 'check-body' },
    icon(ICONS[v.level] ?? ICONS.info, { size: 20 }),
    el('span', { class: 'check-title', text: v.title }),
    el('span', { class: 'check-chev' }, icon(ICONS.chevron, { size: 16 })));
  toggle.addEventListener('click', () => { state.checkOpen = !open; renderCheck(); });
  const row = el('div', { class: 'check-row' }, toggle);
  if (recovery) {
    const simplify = el('button', { type: 'button', class: 'check-btn', title: recovery.description, text: recovery.label });
    simplify.addEventListener('click', () => applyBuildRecovery(recovery));
    row.append(simplify);
  }
  if (v.fix) {
    const label = fixJob ? `Stop looking (${Math.min(fixJob.tried + 1, fixJob.total)} of ${fixJob.total})` : 'Fix it';
    const fix = el('button', { type: 'button', class: 'check-btn', id: 'check-fix', title: 'Tries small changes to this design\'s settings and keeps the first one after which the check passes. Undo brings your settings back.', text: label });
    fix.addEventListener('click', () => { if (fixJob) fixJob.controller.abort(); else void fixGeometry(); });
    row.append(fix);
  }
  if (v.action === 'roomy-on') {
    const quick = el('button', { type: 'button', class: 'check-btn', title: `${v.actionLabel}: 1.5 mm between loop feet`, text: 'Add room' });
    quick.addEventListener('click', () => setRoomy(true));
    row.append(quick);
  }
  const children = [row];
  if (open) {
    const body = el('div', { class: 'check-body', id: 'check-body' }, el('p', { text: v.body }));
    const actions = el('div', { class: 'check-actions' });
    if (state.error) {
      const saveLog = el('button', { type: 'button', class: 'check-btn ghost', text: 'Download error log', title: 'Downloads recent local errors and current settings, including the current drawing. Share this file only when you want to share that drawing.' });
      saveLog.addEventListener('click', saveErrorLog);
      const report = el('button', { type: 'button', class: 'check-btn ghost', text: 'Report this problem', title: 'Tell us what happened: the error details and settings go with it, never your drawing.' });
      report.addEventListener('click', () => feedback?.open('problem'));
      actions.append(saveLog, report);
    }
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

/** The crossing report of a layered design, as Details rows. */
function reportItems(r, item) {
  return [
    item('Crossings', `${r.crossings.toLocaleString('en')} (${r.perCm2.toFixed(1)} per cm²)`),
    item('Between layers', r.between.toLocaleString('en')),
    item('Smallest usual angle', r.crossings ? `${Math.round(r.minAngle)}°` : 'none'),
    item('Longest uncrossed', `${Math.round(r.longestUncrossed)} mm`),
  ];
}

function renderFigures() {
  const host = $('#figures');
  const toggle = $('#btn-details');
  const fig = (value, unit, label) => el('div', { class: 'figure' },
    el('div', { class: 'fig-value' }, value, unit ? el('span', { class: 'fig-unit', text: ` ${unit}` }) : null),
    el('div', { class: 'fig-label', text: label }));
  host.classList.toggle('overview-figures', overviewActive);
  if (overviewActive) {
    const [w, h] = BINDINGS[state.design].size.get();
    const estimate = printEstimates.get(snapshotKey());
    const scope = estimate?.full ? 'Full-piece' : 'Sample';
    host.classList.toggle('stale', !!state.error);
    host.replaceChildren();
    if (estimate) host.append(fig(formatMinutes(estimate.timeSec / 60), 'min', `${scope} print time`),
      fig(grams(estimate.filamentGrams ?? 0), 'g', `${scope} filament`));
    host.append(el('p', { class: 'estimate-info small muted', text: estimate
      ? `${estimate.width} × ${estimate.height} mm${estimate.full ? ' full piece. Time excludes acceleration.' : ` sample only — not the whole ${w} × ${h} mm piece.`}`
      : `${w} × ${h} mm whole piece. Full print time has not been calculated yet.` }));
    if (!estimate?.full) {
      const calculate = el('button', { type: 'button', id: 'calculate-full-estimate', class: 'link small', text: previewBuild?.estimateOnly ? 'Calculating…' : 'Calculate full estimate', disabled: !!previewBuild || !!currentPrintSizeProblem() });
      calculate.title = currentPrintSizeProblem() || 'Build the full toolpath in the background without loading 3D meshes. Can be cancelled.';
      calculate.addEventListener('click', () => { previewAtSelectedSize(exportOptions(), { estimateOnly: true }); renderFigures(); });
      host.append(calculate);
    }
    toggle.hidden = true;
    $('#details').hidden = true;
    return;
  }
  if (!state.result) { host.replaceChildren(); toggle.hidden = true; return; }
  toggle.hidden = false;
  const { stats, cfg } = state.result;
  const t = cfg.t;
  const isSq = state.design === 'squiggle';
  const selected = BINDINGS[state.design].size.get();
  const sampled = t.sample_width !== selected[0] || t.sample_height !== selected[1];
  const mod = designById(state.design);
  host.classList.toggle('stale', !!state.error);
  host.replaceChildren(
    fig(formatMinutes(stats.timeSec / 60), 'min', sampled ? 'Preview print time' : 'Print time'),
    fig(grams(stats.filamentGrams), 'g', sampled ? 'Preview filament' : 'Filament'),
    !mod.legacy
      ? (() => { const f = mod.figure(state.result); return fig(f.value, f.unit, f.label); })()
      : isSq ? fig('2', '', 'Layers') : fig(stats.loops.toLocaleString('en'), '', 'Loops'),
  );
  toggle.textContent = state.details ? 'Hide details' : 'Details';
  toggle.setAttribute('aria-expanded', String(state.details));

  const d = $('#details');
  d.hidden = !state.details;
  if (state.details) {
    const item = (k, v) => el('div', {}, el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v }));
    d.replaceChildren(
      item('Preview size', `${t.sample_width} × ${t.sample_height} mm`),
      item('Design code', currentSwatch()),
      item('Filament length', `${Math.round(stats.filamentMm).toLocaleString('en')} mm`),
      item('Strands', String(stats.strands)),
      item('Nozzle lifts', String(stats.hops)),
      item('Travel', `${Math.round(stats.travelMm).toLocaleString('en')} mm`),
      ...(state.result.fabric ? [item('Fabric regions', String(state.result.fabric.components)), item('Longest free span', `${state.result.fabric.longestUnsupported.toFixed(1)} mm`)] : []),
      ...(state.result.routing ? [item('Between paths', `${Math.round(state.result.routing.beforeMm)} → ${Math.round(state.result.routing.afterMm)} mm`)] : []),
      item('G-code moves', stats.moves.toLocaleString('en')),
      item('Steepest slope', `${stats.maxSlopeDeg.toFixed(1)}°`),
      ...(state.result.report ? reportItems(state.result.report, item) : []),
      el('p', { class: 'note', text: 'Time ignores acceleration. Each lift ends one strand and starts the next, which is where blobs and strings come from.' })
    );
  }
  const what = !mod.legacy ? mod.summary(state.result) : isSq ? 'a two-layer squiggle mesh' : `${stats.loops} loops`;
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
  // Export can build a selected design independently of its bounded or pending preview.
  const problem = currentPrintSizeProblem();
  const invalidDraft = ['w', 'h'].some(axis => $(`#${state.design}-${axis}`)?.getAttribute('aria-invalid') === 'true');
  btn.disabled = exporting || !!problem || invalidDraft || (!overviewActive && !!state.print.legacyCopies) || !(ok || isReady(state.design));
  $('#print-fit-warning').hidden = !problem;
  $('#print-fit-message').textContent = problem;
  $('#btn-panel').hidden = designById(state.design).panel === false;
}

function printOverhang(id = state.design) {
  if (id !== 'loop-pile') return 0;
  const t = toTextile(state.primary, state.advanced);
  return (t.include_loops ?? true) && t.boundary_policy === 'feet-only' ? t.loop_length + (t.random_enabled ? t.amp_length : 0) : 0;
}

function currentPrintSizeProblem() {
  const [width, height] = BINDINGS[state.design].size.get();
  return printSizeProblem(width, height, state.machines.get(state.machine), printOverhang());
}

/** The print setup in two lines: what the printer chip holds, repeated in the Export dialog so it can be checked. */
function setupSummary() {
  const machine = state.machines.get(state.machine), material = state.materials.get(state.material);
  if (!machine || !material) return null;
  return { name: `${shortMachine(machine.name)} · ${material.name}`, sub: `${state.print.layerHeight} mm thickness · ${layerSetupText()}` };
}

const shortMachine = (name) => name.replace('Original ', '').replace(' i3', '').replace(' / MK3S+', '');
const shortMaterial = (name) => name.replace('Recreus ', '').replace('Prusa ', '');

function renderPrinter() {
  const machine = state.machines.get(state.machine);
  const material = state.materials.get(state.material);
  if (!machine || !material) return;
  // the chip says what the setup holds, so the layers are never a thing to look for elsewhere
  const layers = `${state.print.layerHeight} mm · ${layerSetupText()}`;
  $('#printer-name').textContent = shortMachine(machine.name);
  $('#printer-material').textContent = `${shortMaterial(material.name)} · ${layers}`;
  $('#printer-dot').className = 'status-dot ok';
  $('#btn-printer').title = 'Printer, filament, layer thickness and extra layers above the original design. Add your own printer or filament from a PrusaSlicer or Bambu Studio export.';
  $('#btn-printer').setAttribute('aria-label', `Printer setup: ${shortMachine(machine.name)} with ${shortMaterial(material.name)}, ${layers}`);
}

function renderSizes() {
  renderControls();
}

function renderSliders() {
  renderControls();
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
  $('#sq-pattern-hint').textContent = s.pattern === 'uniform'
    ? 'Every wave is the same, so the fabric is symmetric. Choose a pattern to make some parts deeper.'
    : floor === null
      ? 'Darker parts of the pattern get deeper, tighter waves.'
      : 'Darker parts of the pattern get deeper waves.';
  for (const btn of $$('[data-sqmode]')) btn.setAttribute('aria-pressed', String(btn.dataset.sqmode === s.mode));
  for (const btn of $$('[data-sqshape]')) btn.setAttribute('aria-pressed', String(btn.dataset.sqshape === s.shape));
  for (const btn of $$('[data-pattern]')) btn.setAttribute('aria-pressed', String(btn.dataset.pattern === s.pattern));
  $('#sq-color-change').checked = s.colorChange;

  const showBox = s.pattern === 'image' || state.imageBoxOpen;
  $('#sq-image-box').hidden = !showBox;
  $('#sq-img-info').hidden = !state.image;
  $('#sq-drop-label').textContent = state.image ? 'Drop another picture, or browse' : 'Drop a picture here, or browse';
  if (state.image) {
    $('#sq-img-name').textContent = state.image.name;
    // the picture spans the swatch whatever its shape; matching the shape just stops it being stretched
    const matched = Math.abs(s.width / s.height - state.image.px[0] / state.image.px[1]) < 0.02;
    $('#sq-img-size').textContent = `${state.image.px[0]} × ${state.image.px[1]} px${matched ? ', the swatch has its shape' : ', stretched to fill the swatch'}`;
    $('#sq-img-match').hidden = matched;
  }
  for (const fold of squiggleFolds.values()) fold.update();
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
  renderDesignChoices();
  renderTilePressed();
  renderAdvancedSummary();
  renderLegend();
  renderPreviewMode();
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

/** The squiggle panel's long lists sit behind one line that names the chosen option, like every other design's. */
const squiggleFolds = new Map();
function foldSquiggle(id) {
  if (squiggleFolds.has(id)) return;
  const fold = new SectionFold(host, $(`#${id}`).closest('section'), { id });
  squiggleFolds.set(id, fold);
  controls.push(fold);
}

/** The strand-shape picker of the squiggle panel: the same shapes the Coil card offers. */
function buildSquiggleShapes() {
  $('#sq-shapes').replaceChildren(...SHAPE_IDS.map((shape) => {
    const btn = el('button', { type: 'button', class: 'pattern', 'data-sqshape': shape, 'aria-pressed': 'false', title: SHAPES[shape].hint });
    btn.innerHTML = `${shapeThumb(shape)}<span>${SHAPES[shape].label === 'Wave' ? 'Wave (default)' : SHAPES[shape].label}</span>`;
    btn.addEventListener('click', () => {
      state.squiggle.shape = shape;
      renderSquiggleChoices();
      schedule();
      commit();
    });
    return btn;
  }));
  foldSquiggle('sq-shapes');
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
  foldSquiggle('sq-patterns');
  renderSquiggleChoices();
}

/** The sections of the two hand-built panels fold like every other design's, closed until they are opened. */
function foldRemainingSections() {
  for (const section of $$('#settings-body .panel > section.group')) {
    const heading = section.querySelector('h2');
    if (!heading || section.classList.contains('section-fold')) continue;
    controls.push(new SectionFold(host, section, { id: heading.id }));
  }
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
  renderDesignChoices();
  $('#doc-name').value = state.docName;
  fillDialogSelects();
}

function fillDialogSelects() {
  const fill = (select, map, current) => {
    select.replaceChildren(...[...map.values()].map((p) => el('option', { value: p.id, text: p.name, selected: p.id === current })));
  };
  renderMachinePicker();
  fill($('#sel-material'), state.materials, state.material);
  updateDialogNote();
}

/* ---------- the printer picker: the printers here and the library's hundreds, found by typing ---------- */

/** Every printer that can be picked: the ones in the profiles folder or added here first, then the library's. */
function machineEntries() {
  const own = [...state.machines.values()].filter((m) => profiles.origins.get(`machines:${m.id}`) !== 'library')
    .map((m) => ({ id: m.id, vendor: 'yours', name: m.name, model: m.name, nozzle: m.nozzle_diameter ?? 0.4, bed: [m.bed.width, m.bed.depth, m.bed.max_z] }));
  const ids = new Set(own.map(m => m.id));
  return [...own, ...(profiles.library?.machines ?? []).filter(m => !ids.has(m.id))];
}

function renderMachinePicker() {
  const query = $('#machine-search').value;
  const vendors = [{ id: 'yours', name: 'In this studio' }, ...(profiles.library?.vendors ?? [])];
  const all = machineEntries();
  const found = machineSuggestions(all, query, state.machine, vendors);
  $('#machine-search').placeholder = `Search ${all.length} printers…`;
  const items = [];
  for (const entry of found) {
    const bed = entry.bed ? `${entry.bed[0]} × ${entry.bed[1]} mm` : '';
    const btn = el('button', { type: 'button', class: 'machine-option', 'data-machine': entry.id, 'aria-pressed': String(entry.id === state.machine) },
      el('span', { class: 'machine-name', text: entry.name }),
      el('span', { class: 'machine-meta', text: [entry.id === state.machine ? 'In use' : null, entry.nozzle ? `${entry.nozzle} mm nozzle` : null, bed].filter(Boolean).join(' · ') }));
    items.push(btn);
  }
  if (!found.length) items.push(el('p', { class: 'machine-empty small muted', text: 'No printer matches. Try fewer words, or add your printer\'s file below.' }));
  $('#machine-list').replaceChildren(...items);
  $('#machine-count').textContent = query.trim() ? `${found.length} ${found.length === 1 ? 'printer matches' : 'printers match'}. Scroll for more matches.` : `Showing ${found.length} of ${all.length}. Type a name, e.g. Ender 3 or MK3.5.`;
}

async function chooseMachine(id) {
  try {
    if (!(await profiles.useLibrary(id))) throw new Error('this printer is not in the library');
  } catch (e) {
    toast(`Could not load that printer: ${e.message}`);
    return;
  }
  if (state.machine !== id) state.print.layerHeight = defaultLayerHeight(state.machines.get(id));
  state.machine = id;
  normalisePrint();
  renderControls();
  renderMachinePicker();
  updateDialogNote();
  schedule();
  commit();
  $(`#machine-list [data-machine="${CSS.escape(id)}"]`)?.focus();
}

function bindMachinePicker() {
  const search = $('#machine-search'), list = $('#machine-list');
  search.addEventListener('input', () => { renderMachinePicker(); list.scrollTop = 0; });
  list.addEventListener('click', (e) => { const btn = e.target.closest('[data-machine]'); if (btn) void chooseMachine(btn.dataset.machine); });
  // the arrow keys move from the search into the list and along it, so a printer is picked without the mouse
  const options = () => [...list.querySelectorAll('[data-machine]')];
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); options()[0]?.focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); const first = options()[0]; if (first) void chooseMachine(first.dataset.machine); }
  });
  list.addEventListener('keydown', (e) => {
    const all = options(), at = all.indexOf(document.activeElement);
    if (at < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); all[Math.min(all.length - 1, at + 1)].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (at === 0 ? search : all[at - 1]).focus(); }
  });
}

function updateDialogNote() {
  const material = state.materials.get($('#sel-material').value);
  const machine = state.machines.get(state.machine);
  // where each profile came from, and anything the importer had to guess or leave out
  $('#dialog-note').textContent = [
    machine && `Printer: ${machine.source ?? machine.name}.`,
    ...(machine ? profiles.notesFor('machines', machine.id) : []),
    material && `Filament: ${material.source ?? material.name}.`,
    ...(material ? profiles.notesFor('materials', material.id) : []),
  ].filter(Boolean).join(' ');
  renderProfileList();
}

/** The profiles added here, each with a way to remove it. The ones in the profiles folder go when their file does. */
function renderProfileList() {
  const items = [];
  for (const kind of ['machines', 'materials']) {
    for (const profile of profiles.user[kind]) {
      const remove = el('button', { type: 'button', class: 'link small', text: 'Remove' });
      remove.addEventListener('click', () => {
        profiles.remove(kind, profile.id);
        if (!state.machines.has(state.machine)) state.machine = [...state.machines.keys()][0];
        if (!state.materials.has(state.material)) state.material = [...state.materials.keys()][0];
        normalisePrint();
        renderControls();
        fillDialogSelects();
        renderPrinter();
        schedule();
        commit();
      });
      items.push(el('li', {}, el('span', { text: `${profile.name} (${kind === 'machines' ? 'printer' : 'filament'})` }), remove));
    }
  }
  $('#profile-list').replaceChildren(...items);
  $('#profile-list').hidden = items.length === 0;
}

/* ---------- designs ---------- */
/** One tile per registry module; planned designs are visible placeholders that cannot be selected. */
function renderTiles() {
  const ranking = new Map(PRINTABILITY.map((p, i) => [p.id, { ...p, rank: i + 1 }]));
  const byRank = (a, b) => (ranking.get(a.id)?.rank ?? 1000) - (ranking.get(b.id)?.rank ?? 1000);
  const essentials = ESSENTIALS.map((id) => DESIGNS.find((d) => d.id === id)).filter(Boolean);
  const others = DESIGNS.filter((d) => !ESSENTIALS.includes(d.id) && !d.hidden).sort(byRank);
  const makeTile = (d) => {
    const ready = d.status === 'ready';
    const planned = d.status === 'planned';
    const tile = el('button', {
      type: 'button',
      class: planned ? 'design-tile planned' : 'design-tile',
      'data-design': ready ? d.id : false,
      'data-preset-tile': d.status === 'preset' ? d.id : false,
      'data-planned': planned ? d.id : false,
      'aria-pressed': planned ? false : 'false',
      'aria-disabled': planned ? 'true' : false,
      disabled: planned,
      title: planned ? `${d.name} is coming soon` : `${d.name}: ${d.blurb}`,
    });
    const assessment = ranking.get(d.id);
    tile.title = `${d.blurb}${assessment ? ` · Estimated printability ${assessment.rank} of ${PRINTABILITY.length}. ${assessment.longestUnsupported.toFixed(1)} mm longest free span; ${assessment.maxSlopeDeg.toFixed(1)}° maximum slope. Default 100 × 100 mm geometry; physical testing pending.` : ''}`;
    tile.innerHTML = `${d.thumb ?? THUMBS[d.id] ?? ''}<span class="design-text"><span class="design-name">${d.name}${planned ? '<span class="soon">Soon</span>' : ''}</span></span>`;
    if (ready) tile.addEventListener('click', () => setDesign(d.id));
    if (d.status === 'preset') tile.addEventListener('click', () => openPresetTile(d));
    return tile;
  };
  // the headings are one word or two; what they mean is a tooltip, so the first tile is the first thing in the list
  const heading = (text, sub) => el('h3', { class: 'design-group', title: sub }, text);
  $('#design-list').replaceChildren(
    heading('Essentials', 'Flat lines in one or two layers, with only a few controls'),
    ...essentials.map(makeTile),
    heading('More structures', 'Easiest first'),
    ...others.map(makeTile),
  );
  renderTilePressed();
}

/** The settings object a design keeps its state in (the two older designs keep theirs at the top level). */
function settingsOf(id) {
  if (id === 'loop-pile') return state.primary;
  if (id === 'squiggle') return state.squiggle;
  return state.designs[id];
}

/** A preset tile opens another design with some settings changed, for example the zigzag mesh on Squiggle & Gyroid. */
function openPresetTile(d) {
  const { design, patch } = d.opens;
  Object.assign(settingsOf(design), patch);
  if (state.design === design) {
    showDesign();
    syncControls();
    schedule();
    commit();
  } else {
    setDesign(design, { fromPreset: true });
    syncControls();
  }
}

function renderTilePressed() {
  for (const d of DESIGNS) {
    if (d.status === 'ready') {
      for (const tile of $$(`[data-design="${d.id}"]`)) {
        // a preset tile of this design takes the highlight when its settings are the ones in use
        const claimed = DESIGNS.some((p) => p.status === 'preset' && p.opens.design === d.id && matchesPreset(p));
        tile.setAttribute('aria-pressed', String(d.id === state.design && !claimed));
      }
    } else if (d.status === 'preset') {
      for (const tile of $$(`[data-preset-tile="${d.id}"]`)) tile.setAttribute('aria-pressed', String(matchesPreset(d)));
    }
  }
}

function matchesPreset(d) {
  if (state.design !== d.opens.design) return false;
  const own = settingsOf(d.opens.design);
  return Object.entries(d.opens.patch).every(([k, v]) => own[k] === v);
}

/** The code that names this swatch: design, preset, size and a fingerprint of every setting. */
function currentSwatch() {
  const mod = designById(state.design);
  let settings, size, preset = null;
  if (!mod.legacy) {
    settings = state.designs[mod.id];
    size = mod.size(settings);
    preset = mod.presetMatch ? mod.presetMatch(settings) : null;
  } else if (mod.id === 'squiggle') {
    settings = state.squiggle;
    size = [settings.width, settings.height];
    if (JSON.stringify(settings) === JSON.stringify(mod.defaults())) preset = 'default';
  } else {
    settings = { primary: state.primary, advanced: state.advanced };
    size = sampleSize(state.primary);
    if (JSON.stringify(settings) === JSON.stringify({ primary: mod.defaults(), advanced: {} })) preset = 'default';
  }
  return swatchCode(mod.file, { ...settings, vector: state.vector, print: state.print }, { size, preset, outline: state.outline });
}

function resetRoles() {
  state.roles = {};
  preview?.setRoles(Object.fromEntries(ROLES.map((r) => [r, true])));
}

function showDesign() {
  renderTilePressed();
  for (const d of DESIGNS) {
    const panel = $(`#panel-${d.id}`);
    if (panel) panel.hidden = d.id !== state.design;
  }
  const svgSlot = $(`#panel-${state.design} .size-svg-slot`);
  if (svgSlot && svgImportCard) svgSlot.append(svgImportCard.node);
  $('#tight-option').hidden = state.design !== 'loop-pile';
  renderExport();
  if (state.design !== 'loop-pile' && state.showTight) setShowTight(false);
}

function setDesign(id, { fromPreset = false } = {}) {
  if (!isReady(id)) return;
  let variantChanged = false;
  if (!fromPreset) {
    const own = settingsOf(id), next = baseDesignSettings(id, own);
    variantChanged = Object.keys(next).some((key) => next[key] !== own[key]);
    Object.assign(own, next);
  }
  if (state.design === id && !variantChanged) return;
  stopPlay();
  state.design = id;
  state.fraction = 1;
  state.checkOpen = null;
  state.why = false;
  resetRoles();
  showDesign();
  syncControls();
  $('#settings-body').scrollTop = 0;
  schedule();
  commit();
}

/* ---------- panels for the newer designs, built from their registry entry ---------- */
function afterDesignChange() {
  renderSliders();
  schedule();
  commit();
}

function renderDesignChoices() {
  renderControls();
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
    // the picture adapts to the swatch: the size you set stays, whatever the picture's own size
    state.squiggle.pattern = 'image';
    state.imageBoxOpen = false;
    $('#sq-thumb').getContext('2d').drawImage(thumb, 0, 0, 112, 112);
    buildPatterns();
    renderSizes();
    schedule();
    commit();
    toast(`Picture fitted to the ${state.squiggle.width} × ${state.squiggle.height} mm swatch`);
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
    // keep the size you have set, and give it the picture's shape
    const [w, h] = sizeForAspect(...state.image.px, Math.max(state.squiggle.width, state.squiggle.height));
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
function recordBuildFailure(error, input = null) {
  if (error?.name === 'AbortError') return false;
  const [width, height] = input ? [input.width, input.height] : BINDINGS[state.design].size.get();
  const captured = input ?? {
    design: state.design, width, height, studySettings: { ...settingsOf(state.design) },
    machine: state.machines.get(state.machine), material: printMaterial(), extraLayers: state.print.extraLayers, brim: state.print.brim,
    vector: state.vector, outline: state.outline?.rings,
  };
  const vector = captured.vector, sourcePaths = vector?.paths ?? [];
  const settings = captured.studySettings ?? captured.settings ?? {};
  const recorded = diagnosticLog.record({
    design: captured.design,
    settings: {
      ...settings,
      operation: input?.operation ?? (input ? 'panel' : 'preview'),
      print: { layers: captured.layers, extraLayers: captured.extraLayers, brim: captured.brim, layerHeight: captured.material?.print_defaults?.layer_height },
      machine: captured.machine?.id, material: captured.material?.id,
      ...(input ? { repeat: captured.repeat, backingSpacing: captured.backingSpacing } : state.design === 'loop-pile' ? { advanced: { ...state.advanced } } : {}),
    },
    dimensions: { width, height },
    sourceComplexity: { svgPathCount: sourcePaths.length, svgPointCount: sourcePaths.reduce((count, path) => count + path.length, 0), svgWidth: vector?.width ?? 0, svgHeight: vector?.height ?? 0, outlineRingCount: captured.outline?.length ?? 0 },
    error,
  });
  if (recorded) reportStudyExport('build-error', { ...captured, error: classifyBuildError(error) });
  return recorded;
}

function applyBuildRecovery(recovery) {
  applySettingsPatch(recovery.patch);
  if (!state.error) toast('Pattern simplified. Undo restores your previous settings.');
}

/** Changes some of this design's settings as one step that Undo takes back, and rebuilds. */
function applySettingsPatch(patch) {
  // Failed edits may not have reached the normal history. Keep this exact state so Undo restores the attempt.
  const key = snapshotKey();
  if (undoLog.stack[undoLog.cursor]?.key !== key) {
    undoLog.stack = undoLog.stack.slice(0, undoLog.cursor + 1);
    undoLog.stack.push({ key, data: JSON.parse(JSON.stringify(snapshot())) });
    if (undoLog.stack.length > 100) undoLog.stack.shift();
    undoLog.cursor = undoLog.stack.length - 1;
  }
  Object.assign(settingsOf(state.design), patch);
  clearTimeout(genTimer);
  syncControls();
  renderControls();
  regenerate();
  commit();
  renderHistoryButtons();
}

/* ---------- Fix it: the geometry check, answered by trying settings ---------- */
let fixJob = null; // { controller, tried, total } while a search runs

/** The design as its preview builds it (the same size or window), for a worker to build and check. */
function previewInput() {
  const machine = state.machines.get(state.machine);
  const [w, h] = BINDINGS[state.design].size.get();
  const whole = Math.max(w, h) <= 250 && w <= machine.bed.width && h <= machine.bed.depth;
  const cap = state.vector && Math.max(state.vector.width, state.vector.height) <= 250 && state.vector.width <= machine.bed.width && state.vector.height <= machine.bed.depth ? 250 : 100;
  const pw = whole ? w : Math.min(w, cap), ph = whole ? h : Math.min(h, cap);
  return { ...exportOptions(pw, ph), outline: placedOutline(pw, ph, w, h), vectorSize: [w, h] };
}

/** Builds the design with some settings changed, without changing them: the job captures its input at once. */
function buildWithPatch(patch, signal) {
  const binding = BINDINGS[state.design], saved = {};
  for (const [k, value] of Object.entries(patch)) { saved[k] = binding.get(k); binding.set(k, value); }
  try { return buildSwatch(previewInput(), { signal }); }
  finally { for (const [k, value] of Object.entries(saved)) binding.set(k, value); }
}

async function fixGeometry() {
  const fabric = state.result?.fabric, binding = BINDINGS[state.design];
  if (!fabric || fabric.exportable || fixJob) return;
  const unitOf = (key) => binding.sliders.find((s) => s.key === key)?.unit ?? '';
  const advice = adviceFor(designById(state.design), fabric.issues.join('. '));
  const candidates = fixCandidates(fabric, { sliders: binding.sliders, get: binding.get, range: binding.range });
  if (!candidates.length) { toast(`None of this design's settings is likely to change this.${advice}`); return; }
  const key = snapshotKey(), controller = new AbortController(), before = problemScore(fabric);
  fixJob = { controller, tried: 0, total: candidates.length };
  renderCheck();
  let best = null;
  try {
    for (const candidate of candidates) {
      let score = Infinity;
      try { score = problemScore((await buildWithPatch(candidate.patch, controller.signal)).fabric); }
      catch (error) { if (error.name === 'AbortError') throw error; } // a try that cannot build is not a fix
      if (controller.signal.aborted || snapshotKey() !== key) throw new DOMException('Stopped', 'AbortError');
      fixJob.tried++;
      renderCheck();
      if (score < (best?.score ?? before)) best = { ...candidate, score };
      if (score === 0) break;
    }
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
    fixJob = null;
    renderCheck();
    return;
  }
  fixJob = null;
  if (!best) { renderCheck(); toast(`No small change cleared it.${advice || ' Try a simpler shape or a larger swatch.'}`); return; }
  applySettingsPatch(best.patch);
  const changed = describeChanges(best.changes, unitOf);
  toast(best.score === 0 ? `Fixed: ${changed}. Undo brings your settings back.` : `Better, though not cleared: ${changed}. Undo brings your settings back.`);
}

function saveErrorLog() {
  const name = `${slug(state.docName)}-error-log.json`;
  const data = {
    format: 'filafabric-error-log-v1',
    downloadedAt: new Date().toISOString(),
    note: 'This file contains recent local build errors and the complete current settings snapshot, including the current drawing when one is loaded. It is downloaded locally; share it only when you want to share that drawing.',
    errors: diagnosticLog.export(),
    current: snapshot(),
  };
  download(name, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  toast(state.vector ? 'Error log saved, including the current drawing.' : 'Error log saved with the current settings.');
}

/** What the feedback form knows about the studio right now: the design, and for a problem report its settings and recent errors. */
function feedbackContext() {
  const mod = designById(state.design);
  return {
    designName: mod?.name ?? state.design,
    release: RELEASE,
    report: () => {
      const [width, height] = BINDINGS[state.design].size.get();
      const paths = state.vector?.paths ?? [];
      return problemReport({
        release: RELEASE,
        browser: navigator.userAgent,
        screen: `${innerWidth} × ${innerHeight}`,
        design: state.design,
        size: { width, height },
        settings: settingsOf(state.design),
        print: { extraLayers: state.print.extraLayers, brim: state.print.brim, layerHeight: printMaterial()?.print_defaults?.layer_height },
        machine: state.machine,
        material: state.material,
        // counts only: the drawing stays on this device
        drawing: state.vector ? { svgPaths: paths.length, svgPoints: paths.reduce((n, p) => n + p.length, 0), width: state.vector.width, height: state.vector.height } : null,
        error: state.error ? (Array.isArray(state.error.errors) ? state.error.errors.join(' ') : String(state.error.message || state.error)) : null,
        recent: diagnosticLog.export(),
      });
    },
  };
}

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

function reportStudyExport(exportType, options = {}, stats = state.result?.stats) {
  if (!studyRecorder) return;
  const cfg = options.cfg ?? state.result?.cfg;
  const [width, height] = ['settings-json', 'build-error'].includes(exportType) ? BINDINGS[state.design].size.get() : [cfg?.t.sample_width, cfg?.t.sample_height];
  const vector = options.vector ?? state.vector;
  const plan = options.layerPlan ?? state.result?.layerPlan;
  let print = stats?.print ?? { layerHeight: cfg?.t.layer_height, extraLayers: plan?.extraLayers ?? options.extraLayers ?? state.print.extraLayers, nativeLayers: plan?.nativeLayers, totalLayers: plan?.totalLayers, backingLayers: plan?.backingLayers, totalBackingLayers: plan?.totalBackingLayers, brim: options.brim ?? state.print.brim, nozzleDiameter: cfg?.t.nozzle_diameter, extrusionWidth: cfg?.t.extrusion_width };
  if (exportType === 'build-error') {
    print = { layerHeight: options.material?.print_defaults?.layer_height ?? state.print.layerHeight, extraLayers: options.extraLayers ?? state.print.extraLayers, brim: options.brim ?? state.print.brim };
    try {
      const current = resolveConfig(options.machine ?? state.machines.get(state.machine), options.material ?? printMaterial());
      Object.assign(print, { nozzleDiameter: current.t.nozzle_diameter, extrusionWidth: current.t.extrusion_width });
    } catch { /* the invalid profile itself may be the cause; do not substitute an older successful build */ }
  }
  void studyRecorder.record({
    design: options.design ?? state.design, exportType,
    dimensions: { width: options.width ?? width, height: options.height ?? height },
    properties: {
      settings: exportType === 'gcode-panel' ? { ...(options.studySettings ?? settingsOf(state.design)), colorChange: false } : options.studySettings ?? settingsOf(state.design),
      print,
      metrics: exportType === 'build-error' ? {} : { timeSec: stats?.timeSec, filamentMm: stats?.filamentMm, moves: stats?.moves ?? options.moveCount ?? state.result?.moves?.length },
      sources: { svg: !!vector, image: (options.design ?? state.design) === 'squiggle' && (options.settings ?? state.squiggle).pattern === 'image' && !!(options.image ?? state.image), ...(vector ? { svgPaths: vector.paths.length, svgPoints: vector.paths.reduce((n, p) => n + p.length, 0), svgGuides: interpretDrawing(vector).guides.length } : {}) },
      panel: { repeat: options.repeat, backingSpacing: options.backingSpacing },
      ...(exportType === 'build-error' ? { error: options.error } : {}),
    },
  });
}

/** The settings an exported file is named after: what a registry design's panel shows, the controls of the two older ones. */
function namedKeys(id) {
  const mod = designById(id), s = settingsOf(id);
  if (!mod.legacy) return relevantKeys(mod, s);
  if (id === 'squiggle') return ['mode', 'shape', ...SQ_SLIDERS.map((d) => d.key), 'pattern', 'colorChange'];
  return [...LOOP_SLIDERS.map((d) => d.key), 'edgeLoops', 'roomy', 'pattern', ...(s.pattern && s.pattern !== 'none' ? ['patternScale'] : [])];
}

/**
 * The name a file is saved under unless the person types another: design, preset, size, the value of every setting and
 * the print setup (src/ui/file-name.js), so a folder of exports shows which designs and looks are printed most.
 */
function exportName(size, panel = false, panelSettings = {}) {
  const settings = panel ? { ...settingsOf(state.design), ...panelSettings } : settingsOf(state.design);
  const keys = panel ? [...namedKeys(state.design), 'repeat', 'backingSpacing'] : namedKeys(state.design);
  return exportFileName(designById(state.design), settings, keys, { size, print: state.print, material: state.material, docName: state.docName, panel });
}

function swatchFileName() {
  return exportName(BINDINGS[state.design].size.get());
}

async function exportGcode() {
  if (exporting) return;
  let input;
  const controller = new AbortController();
  exportController = controller;
  exporting = true;
  try {
    input = structuredClone(exportOptions());
    const key = snapshotKey(), code = currentSwatch(), name = swatchFileName();
    const title = state.docName.replace(/[\r\n]+/g, ' ');
    const savedPrint = { ...state.print };
    exportLabel = `Preparing ${input.width} × ${input.height} mm…`;
    renderBusy(); renderExport();
    let result;
    const fullPreview = !genTimer && !previewBuild && state.result && !state.error && state.resultKey === key && state.result.cfg.t.sample_width === input.width && state.result.cfg.t.sample_height === input.height;
    if (fullPreview) result = state.result;
    else if (previewBuild?.key === key) result = await previewBuild.promise;
    else result = await buildSwatch(input, { signal: controller.signal });
    if (controller.signal.aborted || snapshotKey() !== key) throw new DOMException('The design changed during export.', 'AbortError');
    const moveCount = result.moveCount ?? result.moves?.length ?? 0;
    if (!moveCount) throw new Error('Nothing to print for this design and size.');
    const settings = JSON.stringify({ design: input.design, settings: input.studySettings, print: { ...savedPrint,
      ...(result.layerPlan ? { extraLayers: result.layerPlan.extraLayers, nativeLayers: result.layerPlan.nativeLayers, totalLayers: result.layerPlan.totalLayers,
        ...(result.layerPlan.mode === 'backing' ? { backingLayers: result.layerPlan.backingLayers, totalBackingLayers: result.layerPlan.totalBackingLayers, textureCopies: 1 } : {}) } : {}) }, machine: input.machine.id, material: input.material.id });
    const text = result.gcode.replace('; Textile G-code generator v1\n', (head) => `${head}; swatch ${code}\n; name ${title}\n; studio settings ${settings}\n`);
    download(name, new Blob([text], { type: 'text/plain' }));
    reportStudyExport('gcode-swatch', { ...input, cfg: result.cfg, moveCount, layerPlan: result.layerPlan }, result.stats);
    printEstimates.put(key, result, input.width, input.height);
    toast(`Saved ${input.width} × ${input.height} mm: ${name}`);
  } catch (error) {
    if (error.name === 'AbortError') toast('Export cancelled because the design changed.');
    else {
      state.error = error;
      recordBuildFailure(error, { ...input, operation: 'design-export' });
      toast(`Could not export: ${error.message}`);
    }
  } finally {
    exporting = false;
    exportController = null;
    renderBusy(); render();
  }
}

async function shareLink() {
  const hash = stateToHash({ ...snapshot(), vector: null });
  const url = `${location.origin}${location.pathname}${hash}`;
  const picture = state.design === 'squiggle' && state.squiggle.pattern === 'image';
  const note = state.vector ? ' SVG paths stay in your saved settings file; the link shares the pattern settings.' : picture ? ' Your picture stays on this computer, so the link opens with the centre spot pattern.' : '';
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
  reportStudyExport('settings-json');
}

async function openFile(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object') throw new Error('that is not a settings file');
    if (typeof data.machine === 'string') await profiles.useLibrary(data.machine).catch(() => null);
    applySnapshot(data);
    commit();
    toast('Settings loaded');
  } catch (e) {
    $('#errors').hidden = false;
    $('#errors').replaceChildren(el('div', { text: `Could not open that file: ${e.message}` }));
  }
}

function resetDesign() {
  const mod = designById(state.design);
  if (!mod.legacy) {
    state.designs[mod.id] = mod.defaults();
  } else if (state.design === 'squiggle') {
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
  $('#preview-full').addEventListener('click', () => { previewChoice = 'full'; schedule(); });
  $('#preview-whole').addEventListener('click', () => { previewChoice = 'overview'; schedule(); });
  $('#preview-detail').addEventListener('click', () => { previewChoice = 'sample'; schedule(); });
  $('#preview-cancel').addEventListener('click', () => { previewBuild?.controller.abort(); previewBuild = null; previewChoice = 'overview'; schedule(); });
  $('#print-fit-printer').addEventListener('click', () => $('#btn-printer').click());
  $('#overview-fine').addEventListener('click', () => { overviewFine = !overviewFine; schedule(); });
  $('#overview-fit').addEventListener('click', () => overview.fit());
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
  $('#btn-export').addEventListener('click', () => { void exportGcode(); });
  $('#btn-panel').addEventListener('click', closeMenus);
  $('#btn-share').addEventListener('click', shareLink);
  $('#btn-details').addEventListener('click', () => { state.details = !state.details; renderFigures(); });
  $('#btn-advanced').addEventListener('click', () => openAdvanced($('#advanced-body').hidden));
  $('#doc-name').addEventListener('input', (e) => { state.docName = e.target.value; });
  $('#doc-name').addEventListener('change', () => { store.set(STORAGE_KEY, JSON.stringify(snapshot())); });
  $('#doc-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  anchorPopover($('#more-menu'), $('#btn-more'));
  anchorPopover($('#view-menu'), $('#btn-view'));
  $('#btn-help').addEventListener('click', () => { closeMenus(); $('#help-dialog').showModal(); });
  feedback = bindFeedback($('#feedback-dialog'), { context: feedbackContext, toast });
  $('#btn-feedback').addEventListener('click', () => feedback.open());
  $('#btn-save-file').addEventListener('click', () => { closeMenus(); saveFile(); });
  $('#btn-error-log').addEventListener('click', () => { closeMenus(); saveErrorLog(); });
  $('#btn-reset').addEventListener('click', () => { closeMenus(); resetDesign(); });
  $('#file-open').addEventListener('change', (e) => {
    closeMenus();
    if (e.target.files[0]) openFile(e.target.files[0]);
    e.target.value = '';
  });

  const dialog = $('#printer-dialog');
  $('#btn-printer').addEventListener('click', () => { $('#machine-search').value = ''; fillDialogSelects(); dialog.showModal(); });
  bindMachinePicker();
  $('#sel-material').addEventListener('change', (e) => { state.material = e.target.value; updateDialogNote(); schedule(); commit(); });
  // a printer or filament profile as the slicers export it: PrusaSlicer .ini or sliced .gcode, Bambu Studio .json
  $('#profile-file').addEventListener('change', async (e) => {
    for (const file of [...e.target.files]) {
      try {
        const got = profiles.add(await file.text(), file.name);
        if (got.machines[0]) { state.machine = got.machines[0].id; state.print.layerHeight = defaultLayerHeight(got.machines[0]); }
        if (got.materials[0]) state.material = got.materials[0].id;
        toast(`Added ${[...got.machines.map((m) => `${m.name} (printer)`), ...got.materials.map((m) => `${m.name} (filament)`)].join(' and ')}`);
      } catch (err) {
        toast(`${file.name}: ${err.errors?.[0] ?? err.message}`);
      }
    }
    e.target.value = '';
    normalisePrint();
    renderControls();
    fillDialogSelects();
    renderPrinter();
    schedule();
    commit();
  });

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, select, textarea')) return;
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  });

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { buildPatterns(); for (const c of controls) c.redraw(); });

  bindSquiggle();
}

async function init() {
  await loadProfiles();
  preview = createPreview($('#preview'));
  overview = createOverview($('#overview'), text => { overviewStatus = text; if (overviewActive) renderPreviewMode(); });
  svgImportCard = new SvgImportCard(host);
  controls.push(svgImportCard);
  studyRecorder = createStudyRecorder($('#study-notice'), { allowed: () => statsAllowed() });
  void studyRecorder.init();
  const privacy = bindPrivacyNotice($('#privacy-banner'), { onChange: () => studyRecorder.refresh(), openFeedback: () => feedback?.open(), toast });
  $('#btn-privacy').addEventListener('click', () => { closeMenus(); privacy.open(); });

  // start from: a shared link, then the last session, then the defaults
  const fromLink = hashToState(location.hash);
  let initial = fromLink;
  if (!initial) {
    try { initial = JSON.parse(store.get(STORAGE_KEY) ?? 'null'); } catch { initial = null; }
  }
  // a page that is opened (not a shared link) lands on the zigzag mesh, whatever was open last; what was set in the
  // other designs is kept for when they are chosen
  if (initial && !fromLink) initial.design = 'zigzag';
  if (initial && !fromLink) for (const [id, oldHub] of [['web', 3], ['rosette', 4], ['spirograph', 4], ['sunflower', 3]]) {
    const settings = initial.designs?.[id];
    if (settings && !settings.hubStyle && settings.hub === oldHub) settings.hub = 0.6;
  }
  let pictureDropped = false;
  if (initial && !fromLink && initial.sampleDefaults !== 100) {
    for (const settings of [initial.squiggle, ...Object.values(initial.designs ?? {})]) if (settings && settings.width === settings.height && [50, 200].includes(settings.width)) { settings.width = 100; settings.height = 100; }
    if (initial.primary && initial.primary.swatch !== 'custom') initial.primary.swatch = 'full';
  }
  // a printer from the library is read before the settings that name it are checked against the known printers
  if (initial?.machine) await profiles.useLibrary(initial.machine).catch(() => null);
  if (initial) pictureDropped = loadState(initial);

  buildPanels();
  buildAdvanced();
  buildSquiggleShapes();
  buildPatterns();
  foldRemainingSections();
  fillDialogSelects();
  renderTiles();
  bindStatic();
  bindPanelExport({
    options: exportOptions,
    machines: () => state.machines, machineId: () => state.machine,
    setupSummary,
    openSetup: () => $('#btn-printer').click(),
    panelAvailable: () => designById(state.design).panel !== false,
    download, filename: (w, h, repeat, backingSpacing) => exportName([w, h], true, { repeat, backingSpacing }), toast,
    onExport: (options, stats) => reportStudyExport('gcode-panel', options, stats),
    onError: (error, input) => recordBuildFailure(error, input),
    onDownloadErrorLog: saveErrorLog,
  });
  new TooltipLayer();
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
