import { PRINTABILITY } from './printability-data.js';
import { CARD_ESTIMATES } from './card-estimates.js';
import { initDesignsResizer } from './designs-resizer.js';
import { estimateLine } from './estimate-line.js';
import { validNumber } from './numeric.js';
import { generate } from '../engine/generate.js';
import { placeOutline, unflattenRings } from '../engine/outline.js';
import { createPreview, ROLES } from './preview.js?v=20261112-preferences';
import { createOverview } from './overview.js?v=20261112-preferences';
import { useWholeOverview, canSimplifyPreview, packLines } from '../engine/overview.js';
import { packTrace, indexAtTime } from '../engine/trace.js';
import { traceToSvg } from '../engine/trace-svg.js';
import { bedSizeLimits, printSizeProblem } from './bed-size.js';
import { PrintEstimates, printTimeSeconds } from './print-estimates.js';
import { RANGES, PRIMARY_DEFAULTS, sampleSize, toTextile, describePrimary, airStrandMm, fitAspect, pileLiftFactor } from './controls.js';
import { PICTURE, withPicture, withContrast, PICTURE_CONTRAST } from '../engine/picture.js';
import { buildVerdict, buildSquiggleVerdict, formatMinutes, constructionVerdict } from './verdict.js';
import { refreshConstruction, assertConstructionExportable } from '../engine/construction-report.js';
import { stateToHash, hashToState, sanitizeState, PRINT_DEFAULTS } from './share.js?v=20261112-region-build';
import { FILAMENT_FIELDS, filamentValue, withFilamentSettings, setFilamentSetting, withoutFilamentSettings, sanitizeFilamentSettings } from './filament-settings.js';
import { ADVANCED_GROUPS, FIELD_LABELS, fieldDefault, changedFields } from './param-schema.js';
import { $, $$, el, icon, ICONS, helpBubble } from './dom.js';
import { DesignPanel, SizeControl, SliderControl, PatternPicker, SvgImportCard, PrintSetupCard, SectionFold, ColourSection, SupportSection } from './panels.js?v=20261112-inspector';
import { layerHeightOptions, defaultLayerHeight, resolveConfig, beadWidth } from '../engine/params.js';
import { nozzleRange } from './nozzle-limits.js';
import { TooltipLayer } from './tooltip.js';
// versioned with the release in boot.js, so a returning browser never pairs this file with an older printer loader
import { ProfileStore } from './profile-store.js?v=20261019-printer-setup';
import { searchMachines } from './machine-search.js?v=20261019-printer-setup';
import { createProfilePicker } from './profile-picker.js';
import { DESIGNS, designById, isReady, baseDesignSettings } from './designs.js';
import { THUMBS, shapeThumb, presetThumb } from './thumbs.js';
import { SHELVES, galleryCards, initialDesignSettings, selectVariant, variantsOf } from './library.js?v=20261112-studio';
import { regionsFromDrawing, REGION_LIMIT, sanitizeSeam, sanitizeOutsideOutline, regionsFingerprint, colourName, regionInPiece as inPiece } from '../engine/regions.js?v=20261112-region-build';
import { RegionControls } from './region-controls.js?v=20261112-region-build';
import { bindSwatchLab, swatchRecord } from './swatch-lab.js?v=20261112-preferences';
import { sanitizeWidthMaps } from '../engine/width-maps.js';
import { swatchCode, fingerprint } from './swatch.js';
import { exportFileName, relevantKeys, variantsFileName, printerFileToken } from './file-name.js';
import { FIELDS, FIELD_IDS, createField } from '../engine/fields.js';
import { SHAPES, SHAPE_IDS } from '../engine/shapes.js';
import { readSvgLines } from './svg-lines.js';
import { composeSvgLines, outlineFromVector, vectorPatternRings } from '../engine/svg-lines.js';
import { applySvgGuides, vectorGuides } from '../engine/svg-guides.js';
import { applySvgSolids, solidOnly, withoutPattern } from '../engine/svg-solids.js';
import { prepareAdaptiveSolids } from '../engine/adaptive-solids.js';
import { summariseDrawing, describeDrawing, interpretDrawing, scaleDrawing, fitToBed } from '../engine/drawing.js';
import { addExtraLayers, nativeLayerInfo } from '../engine/stack.js';
import { colourResult, strandLayer } from '../engine/colour-plan.js';
import { generateDesignBase, compactDesignExport } from '../engine/design-export.js';
import { combineVariantResults, planVariantLayout } from '../engine/variant-export.js';
import { rotateDesignInput } from '../engine/rotate-design.js';
import { applyBrim } from '../engine/brim.js';
import { boundaryFor } from '../engine/layers.js';
import { conformalGuideRegion } from '../engine/conformal.js';
import { windowRings } from '../engine/window.js';
import { bindPanelExport } from './panel-ui.js';
import { createStudyRecorder } from './study.js';
import { DENSITY_REVISION, RETUNED_CARDS } from './density.js';
import { buildSwatch } from './export-builder.js?v=20261112-region-build';
import { defaultCache } from './default-cache.js?v=20261112-region-build';
import { classifyBuildError, DiagnosticLog, suggestRecovery, safeMetadata } from './diagnostics.js?v=20261112-region-build';
import { bindFeedback, problemReport } from './feedback.js';
import { bindPrivacyNotice, statsAllowed } from './privacy.js?v=20261112-preferences';
import { describeFabric, fixCandidates, problemScore, describeChanges } from './fix-geometry.js';
import { createTour } from './tour.js?v=20261112-studio';
import { sizeForAspect } from './squiggle-controls.js';

// the release this page loaded (boot.js imports this file with ?v=), so feedback says which version it is about
const RELEASE = new URL(import.meta.url).searchParams.get('v') ?? 'dev';
const STORAGE_KEY = 'filament-textile-studio:v1'; // kept so a returning visitor's last session still opens
const PLAY_ICON = 'M5 3l10 6-10 6z';
const PAUSE_ICON = 'M4 3h3.5v12H4zM10.5 3H14v12h-3.5z';

const ROLE_HEIGHT = { base: 2, anchored: 3, lifting: 3, free: 5 };

const LOOP_SLIDERS = [
  { key: 'pileHeight', label: 'Height', help: 'How high a loop rises over the layer below.', lo: 'Flat', hi: 'Plush', unit: 'mm', edit: true },
  { key: 'loopSize', label: 'Loop size', help: 'Width and length of each loop, kept in proportion.', lo: 'Small', hi: 'Large' },
  { key: 'airFlow', label: 'Strand thickness', help: 'Extra flow where the loops are in the air, for thicker, sturdier strands.', lo: 'Thin', hi: 'Thick', unit: '%', edit: true },
  { key: 'loopSpacing', label: 'Loop spacing', help: 'Distance between neighbouring loops in a row.', lo: 'Packed', hi: 'Open', unit: 'mm', edit: true },
  { key: 'baseGap', label: 'Base openness', help: 'Gap between the lines of the backing mesh.', lo: 'Firm', hi: 'Airy', unit: 'mm', edit: true },
  { key: 'variation', label: 'Natural variation', help: 'Random wobble in each loop\'s size, height and angle.', lo: 'Even', hi: 'Wild', unit: '%', edit: true },
];
const PATTERN_SCALE = { key: 'patternScale', label: 'Pattern size', help: 'Stretches the pattern across the fabric.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false };
// plainest first: the first one leaves every wave the same, the last ones need a picture
const PATTERNS = [
  { id: 'uniform', label: 'None' },
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
};

const state = {
  machines: new Map(),
  materials: new Map(),
  machine: 'prusa-mk3s',
  material: 'filaflex-95-foamy',
  design: 'zigzag',
  primary: { ...PRIMARY_DEFAULTS },
  advanced: {},
  // settings of every design newer than the loop pile and squiggle, by design id
  designs: initialDesignSettings(DESIGNS),
  image: null, // { data, original: ImageData, contrast, name, px: [w, h], thumb: canvas }: stays on this computer, never in a link
  imageRevision: 0, // identity of the current picture state, including in history
  imageBoxOpen: false,
  outline: null, // { name, rings (flat, unit box), rotation }: shared by every design, travels in links
  vector: null,
  regions: null,
  seam: sanitizeSeam(),
  selectedRegion: null,
  print: { ...PRINT_DEFAULTS }, // layer thickness and extra fabric or backing passes, shared across designs
  docName: 'Untitled swatch',
  result: null,
  resultKey: null,
  buildFailure: null, // { key, error } for the inputs that failed
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
   const own = () => state.designs[mod.settingsKey ?? mod.id];
  // each sliders group has its own host: the first keeps the plain id
  const groups = mod.controls.filter((c) => c.kind === 'sliders').map((c, k) => ({ host: `#${mod.id}-sliders${k ? `-${k}` : ''}`, items: c.items }));
  return {
    sliders,
    build: items,
    groups,
    host: `#${mod.id}-sliders`,
    get: (key) => own()[key],
    set: (key, value) => { own()[key] = value; },
    range: (key) => nozzleRange(mod.ranges[key], beadNow()), // sizes that count in beads follow the nozzle
    readout: (key) => {
      const def = sliders.find((d) => d.key === key);
      const d = mod.describe(own());
       return def?.readout ? def.readout(d) : d[key] ?? `${own()[key]}${['thin', 'thick'].includes(key) ? '×' : ''}`;
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
for (const mod of DESIGNS) if (mod.status === 'ready' && !mod.legacyPanel) BINDINGS[mod.id] = bindingFor(mod);

let preview = null;
let overview = null;
let previewChoice = 'auto';
let overviewActive = false;
let overviewStatus = '';
const printEstimates = new PrintEstimates();
let previewBuild = null;
let pendingRegionApply = null;
// the G-code a "Generate G-code" step made for these exact settings, so Export saves it without building it again
let readyGcode = null; // { key, result }
let referenceResult = null; // { key, result }: fixed browsing sample, never printable output for the selected machine
// the print order of that G-code (src/engine/trace.js), which the 2D view plays and exports as SVG
let overviewTrace = null; // { key, trace, source? }
let autoBuildStopped = ''; // the settings whose background build failed: 2D does not start it again
let traceProblem = null; // { key, message } when the background build failed
let exporting = false;
let exportController = null;
let exportLabel = '';
let rafId = 0;
let lastFrame = 0;
const undoLog = { stack: [], cursor: -1 };
let nextImageRevision = 0;
const diagnosticLog = new DiagnosticLog();
let feedback = null;
let documentRequest = 0;
let pictureRequest = 0;
let machineRequest = 0;
let shareRequest = 0;
let regionUI = null;
let regionUIKey = '';
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
    v: 4,
    geometryRevision: 2,
    densityRevision: DENSITY_REVISION,
    sampleDefaults: 100,
    design: state.design,
    machine: state.machine,
    material: state.material,
    primary: state.primary,
    advanced: state.advanced,
    designs: state.designs,
    outline: state.outline,
    vector: state.vector,
    regions: state.regions,
    seam: state.seam,
    print: state.print,
    name: state.docName,
  };
}

function toast(message, { kind = 'info' } = {}) {
  const t = $('#toast');
  t.dataset.kind = kind;
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3600);
}

const grams = (g) => String(Math.round(g * 100) / 100); // two decimals, no trailing zero, to match the tiles

/* ---------- history (undo / redo) ---------- */
/** What a page refresh keeps of the last session: the printer setup, nothing of the design. */
function printerSetupOnly(saved) {
  const print = { ...sanitizeFilamentSettings(saved?.print) };
  if (saved?.print?.layerHeight !== undefined) print.layerHeight = saved.print.layerHeight;
  return { v: saved?.v, geometryRevision: saved?.geometryRevision, densityRevision: saved?.densityRevision, sampleDefaults: saved?.sampleDefaults,
    machine: saved?.machine, material: saved?.material, print };
}

function rememberPrintSetup() {
  store.set(STORAGE_KEY, JSON.stringify(printerSetupOnly(snapshot())));
  // The address-bar snapshot would take precedence over this setup on reload.
  if (location.hash.startsWith('#s=')) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  }
}

function snapshotKey() {
  // A picture revision distinguishes document edits without serializing its pixels.
  if (state.regions?.length) return JSON.stringify({ m:state.machine, t:state.material, a:state.advanced, o:state.outline, v:state.vector, r:state.regions, s:state.seam, y:state.print, i:state.imageRevision });
  // the layer setup is part of what is saved and undone, like everything else that changes the print
  return JSON.stringify({ d: state.design, m: state.machine, t: state.material, p: state.primary, a: state.advanced, g: state.designs, o: state.outline, v: state.vector, y: state.print, i: state.imageRevision });
}

// Compare profile contents as well as settings. Reimport can replace a profile under the same ID.
function buildKey() {
  const setup = [state.machines.get(state.machine), state.materials.get(state.material)];
  // The region engine may take the single-design path using the active card and outline mode.
  if (state.regions?.length) {
    const regions = pieceRegions();
    // Applying keeps the same effective membership and order. Only a different toolpath invalidates the build.
    const ordered = regions.filter(region => region.enabled).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    const order = new Map(ordered.map((region, index) => [region.id, index]));
    const geometry = regions.map(region => ({ ...region, order: order.get(region.id) }));
    return JSON.stringify([setup, state.design, state.primary, settingsOf(state.design), state.advanced,
      state.outline, state.vector, geometry, state.print, state.imageRevision]);
  }
  return JSON.stringify(setup) + '\n' + snapshotKey();
}

function currentBuildError(key) {
  const failure = state.buildFailure;
  return failure && failure.key === (key ?? buildKey()) ? failure.error : null;
}

function captureHistoryPicture() {
  // Contrast pixels can be regenerated. Keep only the source, thumbnail and transform metadata.
  if (!state.image) return { revision: state.imageRevision, image: null };
  const { data, ...image } = state.image;
  return { revision: state.imageRevision, image };
}

function trimHistory() {
  const { stack } = undoLog;
  const originals = new Set();
  const budget = 32 * 1024 * 1024;
  let bytes = 0;
  let i = stack.length - 1;
  for (; i >= Math.max(0, stack.length - 100); i--) {
    const image = stack[i].picture.image;
    if (!image || originals.has(image.original)) continue;
    originals.add(image.original);
    bytes += image.original.data.byteLength + image.thumb.width * image.thumb.height * 4;
    if (bytes > budget && i < stack.length - 1) break;
  }
  if (i >= 0) stack.splice(0, i + 1);
}

function commit() {
  const key = snapshotKey();
  const current = undoLog.stack[undoLog.cursor];
  if (current && current.key === key) return;
  undoLog.stack = undoLog.stack.slice(0, undoLog.cursor + 1);
  undoLog.stack.push({ key, data: JSON.parse(JSON.stringify(snapshot())), picture: captureHistoryPicture() });
  trimHistory();
  undoLog.cursor = undoLog.stack.length - 1;
  rememberPrintSetup();
  renderHistoryButtons();
}

/** Load sanitized settings into the state. Returns true when a picture pattern had to be replaced. */
function loadState(data, picture) {
  const clean = sanitizeState(data, known());
  const loadedRegions=clean.regions??(clean.vector?regionsFromDrawing(clean.vector,{currentCard:clean.design,currentSettings:clean.design==='loop-pile'?clean.primary:clean.designs[designById(clean.design).settingsKey??clean.design]}):null);
  if(loadedRegions?.length>REGION_LIMIT)throw new Error(`This saved drawing has more than ${REGION_LIMIT} colour regions. Reduce its colours before loading it.`);
  if (picture) {
    const image = picture.image;
    state.image = image ? { ...image, data: withContrast(image.original, image.contrast) } : null;
    state.imageRevision = picture.revision;
  }
  const designChanged = clean.design !== state.design;
  state.design = clean.design;
  state.machine = clean.machine;
  state.material = clean.material;
  state.primary = clean.primary;
  state.advanced = clean.advanced;
  state.designs = clean.designs;
  state.outline = clean.outline;
  state.vector = clean.vector;
  state.regions = loadedRegions;
  state.seam = clean.seam;
  state.selectedRegion = null;
  if (state.regions?.length) selectRegion(state.regions.find(r=>r.role==='pattern')?.id ?? state.regions[0].id, { quiet:true });
  state.print = clean.print;
  if (clean.migrationNotes?.length) toast(clean.migrationNotes.join(' '), { kind:'warning' });
  if (data?.print?.layerHeight === undefined) state.print.layerHeight = defaultLayerHeight(state.machines.get(state.machine));
  normalisePrint();
  if (typeof data?.name === 'string') state.docName = data.name.slice(0, 60);
  if (designChanged) resetRoles();
  // a picture never travels in a link or a file, so without one loaded every pattern set to it falls back
  return state.image ? false : forgetPictureChoices();
}

function applySnapshot(data, { preserveSetupRequest = false, picture } = {}) {
  loadState(data, picture);
  documentRequest++;
  pictureRequest++;
  if (!preserveSetupRequest) machineRequest++;
  $('#doc-name').value = state.docName;
  showDesign();
  syncControls();
  schedule();
}

function restoreHistory(step) {
  const cursor = undoLog.cursor + step;
  const entry = undoLog.stack[cursor];
  if (!entry) return;
  applySnapshot(entry.data, { picture: entry.picture });
  undoLog.cursor = cursor;
  rememberPrintSetup();
  renderHistoryButtons();
}

function undo() {
  restoreHistory(-1);
}

function redo() {
  restoreHistory(1);
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
const PRINT_SOLIDS = { key: 'solidLayers', label: 'Solid layers', info: true, help: 'Layers of fill in solid SVG shapes. 1 prints a single layer; more adds thickness and reinforcement. This does not change the mesh layers.', lo: 'Single', hi: 'Reinforced', unit: '', edit: true };
const PRINT_RANGES = { solidLayers: { min: 1, max: 8, step: 1 }, extraLayers: { min: 0, max: 10, step: 1 }, brim: { min: 0, max: 8, step: 1 }, meshPerimeters: { min: 0, max: 8, step: 1 }, meshSpacing: { min: 1, max: 12, step: 0.1 }, meshDepth: { min: 0.5, max: 10, step: 0.1 }, meshWave: { min: 3, max: 40, step: 0.5 } };
/** The extra backing's three settings to start with: the Zigzag mesh · flat at the settings Luis chose. */
const BACKING_DEFAULTS = { meshSpacing: 4, meshDepth: 4, meshWave: 12 };

/**
 * The outline: one setting, a number of lines overlapping by 20%, for every edge of the piece. It is the walls of solid
 * shapes, the border round the pattern and inside its windows, and the contour round every colour of a drawing. Centred
 * on the edge by default (half each side), so a pattern and its neighbour both run into it and are joined.
 */
const EDGE_PITCH = 0.8;
const edgeCount = () => state.print.brim ?? 2;
const edgeWidth = () => edgeCount() > 0 ? Math.round(beadNow() * (1 + (edgeCount() - 1) * EDGE_PITCH) * 100) / 100 : 0;
const edgeAlign = () => state.print.edgeAlign ?? 'centre';
// outside: the passes lie beyond the edge except the innermost, which stays one pass inside so the pattern's ends cross it
// and bond to it (a pass that only touches their ends leaves the outline a separate piece)
const edgeShift = () => ({ inside: 0, centre: edgeWidth() / 2, outside: Math.max(0, edgeCount() - 2) * beadNow() * EDGE_PITCH })[edgeAlign()] ?? 0;
const edgeSeam = () => ({ enabled: edgeWidth() > 0, width: Math.max(.4, edgeWidth()), align: edgeAlign() });
const PRINT_THICKNESS = { label: 'Layer thickness', help: 'Height of each printed layer. Smaller values make finer, thinner strands. Changing this also changes the total thickness of the piece.' };
const PRINT_LAYERS = { key: 'extraLayers', label: 'Extra layers', info: true, help: 'Adds reinforcing passes to the pattern or, for raised textures, its backing. 0 keeps the original design, including its native layers. Solid fill is controlled separately.', lo: 'Original', hi: 'More', unit: '', edit: true };

/** The nozzle of the chosen printer (0.4 mm unless its profile says otherwise). */
const nozzleDiameter = () => state.machines.get(state.machine)?.nozzle_diameter ?? 0.4;

/**
 * The width of one bead for the printer and filament now chosen (cfg.t.extrusion_width), which the sizes that count in beads
 * follow. Remembered until the printer, the filament or its measured bead width changes: sliders ask for it on every redraw.
 */
let beadMemo = null;
function beadNow() {
  const machine = state.machines.get(state.machine), material = state.materials.get(state.material);
  const width = state.print.flatBeadWidth;
  if (!beadMemo || beadMemo.machine !== machine || beadMemo.material !== material || beadMemo.width !== width) {
    beadMemo = { machine, material, width, bead: beadWidth(machine, material && withFilamentSettings(material, state.print, machine)) };
  }
  return beadMemo.bead;
}

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
  // one outline count for every edge: the older separate mesh outline count follows it
  state.print.meshPerimeters = edgeCount(); delete state.print.edgeWidth;
  // Whole-copy settings previously left raised textures unchanged; migrating them keeps that behavior.
  if (RAISED_DESIGNS.has(state.design) && state.print.legacyCopies) { state.print.extraLayers = 0; delete state.print.legacyCopies; }
}

/** The backing mesh under the current design: its settings, or null when it is off or the design stands on its own base. */
const backingFor = () => state.print.backingOn ? { extra: true, spacing: state.print.meshSpacing ?? BACKING_DEFAULTS.meshSpacing, depth: state.print.meshDepth ?? BACKING_DEFAULTS.meshDepth, wavelength: state.print.meshWave ?? BACKING_DEFAULTS.meshWave } : null;

function layerSetupText() {
  const solid = state.vector && interpretDrawing(state.vector).solids.length ? ` · solids: ${state.print.solidLayers} × ${state.print.layerHeight} mm` : '';
  return patternLayerSetupText() + solid;
}

function patternLayerSetupText() {
  if(state.regions?.length)return `${state.regions.filter(inPiece).length} regions${state.result?.layerPlan?.totalLayers?` · ${state.result.layerPlan.totalLayers} layer groups`:''}`;
  const plan = state.result?.designId === state.design ? state.result.layerPlan : null;
  if (plan?.mode === 'backing' && plan.repeatable) return `${plan.backingLayers} backing + ${state.print.extraLayers} extra = ${plan.backingLayers + state.print.extraLayers} · texture once`;
  if (plan && !plan.repeatable) return plan.nativeLayers === null ? 'Original raised structure' : `${plan.nativeLayers} original · SVG only`;
  const mesh = backingFor() ? 1 : 0; // the extra backing is one layer
  if (plan) return `${mesh ? `${mesh} mesh + ` : ''}${plan.patternLayers ?? plan.nativeLayers} pattern passes + ${state.print.extraLayers} extra${plan.fixedLayers ? ' · drawing lines once' : ''}`;
  return RAISED_DESIGNS.has(state.design) ? `${state.print.extraLayers} extra backing layers · texture once` : `${mesh ? `${mesh} mesh + ` : ''}${state.print.extraLayers} extra layers`;
}

const PRINT_BINDING = {
  get: (key) => {
    if (key === 'edgeAlign') return edgeAlign();
    if (key in BACKING_DEFAULTS) return state.print[key] ?? BACKING_DEFAULTS[key];
    return state.print[key];
  },
  set: (key, value) => {
    if (key === 'solidLayers') { state.print.solidLayers = Math.max(1, Math.min(8, Math.round(value))); return; }
    if (key === 'edgeAlign') { state.print.edgeAlign = value; return; }
    if (['brim', 'meshPerimeters'].includes(key) && value > 50) { toast('Perimeters: enter a count from 0 to 50.'); return; }
    if (key === 'extraLayers') {
      if (value > 250) { toast('Extra layers: enter a count from 0 to 250.'); return; }
      delete state.print.legacyCopies;
    }
    state.print[key] = ['extraLayers', 'brim', 'meshPerimeters'].includes(key) ? Math.max(0, Math.round(value)) : value;
    if (key === 'brim') { state.print.meshPerimeters = state.print.brim; delete state.print.edgeWidth; } // one outline count for every edge
  },
  available: (key) => key !== 'extraLayers' || !(state.result?.designId === state.design && state.result.layerPlan?.repeatable === false),
  range: (key) => PRINT_RANGES[key],
  options: () => layerChoices(),
  note: () => {
    const machine = state.machines.get(state.machine);
    return `${nozzleDiameter()} mm nozzle · ${defaultLayerHeight(machine)} mm ${machine?.print_defaults?.layer_height ? 'from the imported print profile' : 'nozzle-based default'}. Choose another thickness above if needed.`;
  },
  readout: (key) => {
    if (key === 'solidLayers') return `${state.print.solidLayers} ${state.print.solidLayers === 1 ? 'layer' : 'layers'} · ${Number((state.print.solidLayers * state.print.layerHeight).toFixed(3))} mm`;
    if (key === 'extraLayers') return `${state.print.extraLayers} extra`;
    if (key === 'meshSpacing') return `${PRINT_BINDING.get(key)} mm apart`;
    if (key === 'meshDepth') return `${PRINT_BINDING.get(key)} mm each way`;
    if (key === 'meshWave') return `${PRINT_BINDING.get(key)} mm per wave`;
    if (key === 'brim') return edgeCount() ? `${edgeCount()} ${edgeCount() === 1 ? 'line' : 'lines'} · ${edgeWidth()} mm` : 'Off';
    if (['brim', 'meshPerimeters'].includes(key)) return state.print[key] ? `${state.print[key]} ${state.print[key] === 1 ? 'line' : 'lines'}` : 'Off';
    if (key === 'layerHeight') return `${Math.round(state.print.layerHeight * 1000) / 1000} mm${state.print.layerHeight === defaultLayerHeight(state.machines.get(state.machine)) ? ' (default)' : ''}`;
    return layerSetupText();
  },
};

/** The guided tour (tour.js): offered on a first visit, and ⋯ › Getting started. */
const tour = createTour({ design: () => state.design });

/** What the panel classes need from the studio. */
const host = {
  // the one uploaded picture, shared by every design whose pattern can be it (never in a link or a saved file)
  picture: () => state.image,
  loadPicture,
  requestPicture: () => ++pictureRequest,
  currentPictureRequest: request => request === pictureRequest,
  clearPicture: () => clearPicture(),
  pictureContrast: () => state.image?.contrast ?? 1,
  setPictureContrast: (value) => setPictureContrast(value),
  pictureShape: (designId) => givePictureShape(designId),
  rotatePicture: (designId) => rotatePicture(designId),
  fillBed: (designId) => fillBed(designId),
  binding: (id) => (id === 'print' ? PRINT_BINDING : BINDINGS[id]),
  settings: (id) => settingsOf(id),
  presetPicture: (mod, preset) => presetThumb(mod, preset, { machine: state.machines.get(state.machine), material: printMaterial() }),
  previewResult: (id) => state.design === id && state.resultKey === buildKey() ? state.result : null,
  layerCount: (id) => id === state.design && state.result?.strands?.length ? Math.max(...state.result.strands.map(strandLayer)) + 1 : 2,
  switchDesign: (id) => setDesign(id, { fromVariant: true }),
  printVariants: (id) => { void exportAllVariants(id); },
  change: () => afterDesignChange(),
  nudge: () => afterControl(),
  sizeChanged: () => { renderControls(); schedule(); },
  sizeLimits: (id) => bedSizeLimits(state.machines.get(state.machine), printOverhang(id)),
  sizeInvalid: () => renderExport(),
  commit: () => commit(),
  toast: (message) => toast(message),
  vectorSize: () => (state.vector ? [state.vector.width, state.vector.height] : null),
  svg: () => svgSituation(),
  importSvg,
  requestSvg: () => ++documentRequest,
  currentSvgRequest: request => request === documentRequest,
  fitSvgToBed: () => fitSvgToBed(),
  removeSvg: () => removeSvg(),
  setShapeOutline: (on) => setShapeOutline(on),
  setSectionOpen: setInspectorSection,
};

function renderControls() {
  for (const c of controls) c.update();
  renderPrinter();
}

/** The panels of every design, and the sliders and size of the two older ones, mounted into their own markup. */
function buildPanels() {
  for (const mod of DESIGNS) {
    if (mod.status !== 'ready' || mod.legacyPanel) continue;
    const panel = new DesignPanel(host, mod);
    $('#settings-body').append(panel.node);
    controls.push(panel);
  }
  for (const id of ['loop-pile']) {
    const b = BINDINGS[id];
    const size = new SizeControl(host, id);
    $(b.size.host).replaceChildren(size.node);
    const sliders = (b.build ?? b.sliders).map((def) => new SliderControl(host, id, def));
    $(b.host).replaceChildren(...sliders.map((s) => s.node));
    controls.push(size, ...sliders);
  }
  const picker = new PatternPicker(host, 'loop-pile', 'pattern', withPicture(['none', ...FIELD_IDS]), 'lp-pattern-title', { scale: PATTERN_SCALE, picture: 'positive', pictureHint: 'The pile is taller where the picture is dark and lower where it is light.' });
  $('#lp-pattern').replaceChildren(picker.node);
  controls.push(picker);
  const pilePatterns = new SectionFold(host, $('#lp-pattern').closest('section'), { id: 'lp-pattern-section' });
  controls.push(pilePatterns);
  const pileColour = new ColourSection(host, designById('loop-pile'), { kind: 'colour', title: 'Colour' }, { index: 'colour' });
  $('#panel-loop-pile').append(pileColour.node);
  controls.push(pileColour);
  const pileSupport = new SupportSection(host, designById('loop-pile'), { kind: 'support', title: 'Support', readonly: true }, { index: 'support' });
  $('#panel-loop-pile').append(pileSupport.node);
  controls.push(pileSupport);
  // the layers every design shares live in the printer setup
  const layersCard = new PrintSetupCard(host, { thickness: PRINT_THICKNESS, layers: PRINT_LAYERS, solids: PRINT_SOLIDS });
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
    // a design that reads a colour its own way says so in the colour guide
    designNote: mod.svgNote ?? null,
    allowsOutline: !state.regions?.length,
    hasShapes: !!(v && shapesOf(v)),
    outlineOn: registered,
    // a drawing smaller than the bed is left as it is; this is the size it would become if asked to fit the bed
    fitSize: v ? bedFitSize(v) : null,
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

async function importSvg(file, request = ++documentRequest) {
  try {
    let drawing = await readSvgLines(file);
    if (request !== documentRequest) return;
    // bigger than this printer's bed: the whole drawing is scaled down to fit it, rather than refused
    const drawn = drawing.drawnSize ?? [drawing.width, drawing.height];
    const limits = bedSizeLimits(state.machines.get(state.machine), printOverhang());
    if (drawing.width > limits.width || drawing.height > limits.height) {
      const [w] = fitToBed(limits, { w: drawing.width, h: drawing.height });
      drawing = scaleDrawing(drawing, w / drawing.width);
    }
    const scaled = drawing.width < drawn[0] - 0.05;
    delete drawing.drawnSize; delete drawing.scaledBy;
    const regions = regionsFromDrawing(drawing, { currentCard:state.design, currentSettings:settingsOf(state.design) });
    if(regions.length>REGION_LIMIT)throw new Error(`The drawing has ${regions.length} colours; reduce it to ${REGION_LIMIT} or fewer. Nothing was imported.`);
    // every colour loads, one ticked: work through them one at a time, then tick them all to export
    const first = regions.find(r=>r.role==='pattern') ?? regions[0];
    for (const r of regions) r.enabled = r === first;
    previewChoice = 'auto';
    state.vector = drawing;
    state.regions = regions;
    state.selectedRegion = null;
    state.seam = sanitizeSeam();
    selectRegion(first?.id, { quiet:true });
    state.outline = shapesOf(drawing); // red contains the pattern and blue cuts it away on import
    followVectorSize();
    state.docName = file.name.replace(/\.svg$/i, '').slice(0, 60);
    $('#doc-name').value = state.docName;
    $('#panel-width').value = state.vector.width;
    $('#panel-height').value = state.vector.height;
    showDesign();
    openDrawingSettings({ focus: true });
    syncControls();
    renderRegions(true); // the colours show at once, not when the first preview is done
    schedule();
    commit();
    const size = `${state.vector.width.toFixed(1)} × ${state.vector.height.toFixed(1)} mm`;
    toast(scaled ? `Imported ${state.vector.name}, scaled down from ${drawn[0].toFixed(1)} × ${drawn[1].toFixed(1)} mm to ${size} to fit the ${shortMachine(state.machines.get(state.machine).name)} bed`
      : `Imported ${state.vector.name}: ${size}${bedFitSize(state.vector) ? '. It is smaller than the bed: Fit to printer bed scales it up' : ''}`);
  } catch (e) {
    if (request !== documentRequest) return;
    toast(`Could not import the SVG: ${e.message}`);
  }
}

/** The size a drawing would take if scaled, at its proportions, to the printer bed less a margin: null when that is not bigger than it is now. */
function bedFitSize(vector) {
  const limits = bedSizeLimits(state.machines.get(state.machine), printOverhang());
  const [w, h] = fitToBed(limits, { w: vector.width, h: vector.height });
  return w > vector.width + 0.5 || h > vector.height + 0.5 ? [w, h] : null;
}

/** Scales the imported drawing up to the printer bed (a smaller drawing is never scaled on its own: this is asked for). */
function fitSvgToBed() {
  const v = state.vector;
  const size = v && bedFitSize(v);
  if (!size) return;
  documentRequest++;
  state.vector = scaleDrawing(v, size[0] / v.width);
  if (state.outline?.page) state.outline = shapesOf(state.vector);
  followVectorSize();
  $('#panel-width').value = state.vector.width;
  $('#panel-height').value = state.vector.height;
  syncControls();
  renderRegions(true);
  schedule();
  commit();
  toast(`${state.vector.name} is now ${state.vector.width.toFixed(1)} × ${state.vector.height.toFixed(1)} mm, the most the ${shortMachine(state.machines.get(state.machine).name)} bed takes at its proportions`);
}

function removeSvg() {
  documentRequest++;
  state.vector = null;
  state.regions = null;
  state.selectedRegion = null;
  delete state.print.outsideOutline;
  if (state.outline?.page) state.outline = null; // its shapes went with it
  showDesign();
  syncControls();
  renderRegions(true);
  schedule();
  commit();
}

function setShapeOutline(on) {
  state.outline = on && state.vector ? shapesOf(state.vector) : null;
  renderControls();
  schedule();
  commit();
}

/* ---------- drawing regions ---------- */
const selectedRegion = () => state.regions?.find(region=>region.id===state.selectedRegion) ?? null;
/** The regions as the engine builds them: every colour in the piece is enabled, and "applied" is the UI's own business. */
const pieceRegions = () => state.regions?.map(region=>{ const { applied, ...rest } = region; return { ...rest, enabled:inPiece(region) }; }) ?? null;
/** Ticked colours not yet applied: what Apply would set aside. */
const workingRegions = () => state.regions?.filter(region=>region.enabled!==false&&!region.applied) ?? [];
const regionName = (region) => colourName(region.hex) ?? region.color;
const requiresApply = () => workingRegions().length>0;

function captureRegionSettings() {
  const region=selectedRegion();
  if(region?.role==='pattern'&&region.card===state.design) region.settings=structuredClone(settingsOf(state.design));
}

function selectRegion(id, { quiet=false } = {}) {
  captureRegionSettings();
  state.selectedRegion=id??null;
  const region=selectedRegion();
  if(region?.role==='pattern'){
    const mod=designById(region.card);
    if(mod){
      state.design=mod.id;
      const own=mod.sanitize(region.settings);
      mod.setSize?.(own,state.vector.width,state.vector.height);
      if(mod.id==='loop-pile'){own.customWidth=state.vector.width;own.customHeight=state.vector.height;own.swatch='custom';state.primary=own;}
      else state.designs[mod.settingsKey??mod.id]=own;
      region.settings=structuredClone(own);
    }
  }
  if (!quiet) {
    showDesign();
    openDrawingSettings();
    syncControls();
    renderRegions(true);
    if (id && matchMedia('(max-width: 900px)').matches) $('#region-header').scrollIntoView({ block: 'nearest' });
  }
}

function regionCard(id,cardId) {
  captureRegionSettings();
  const region=state.regions?.find(r=>r.id===id),card=designById(cardId);
  if(!region||!card||card.status!=='ready')return;
  if (!inPiece(region)) region.enabled = true;
  const oldCard=region.card;
  const previous=designById(oldCard),shared=oldCard===cardId||previous?.settingsKey&&previous.settingsKey===card.settingsKey;
  region.role='pattern';region.card=cardId;region.settings=card.sanitize(shared?region.settings:card.defaults());
  state.selectedRegion=null;
  selectRegion(id);schedule();commit();
}

function changeRegion(id,patch) {
  captureRegionSettings();
  const previousKey = buildKey();
  if(!id&&patch.allEnabled!==undefined)for(const region of state.regions)region.enabled=patch.allEnabled;
  else if(!id)state.seam=sanitizeSeam(patch.seam);
  else {
    const region=state.regions.find(r=>r.id===id);if(!region)return;
    Object.assign(region,patch);
    if(region.role==='pattern'&&!region.card){region.card=state.design;region.settings=structuredClone(settingsOf(state.design));}
    // with one colour left ticked, that colour is the one being edited
    const only=patch.enabled!==undefined&&state.regions.filter(r=>r.enabled!==false);
    state.selectedRegion=null;selectRegion(only?.length===1?only[0].id:id);
  }
  if (buildKey() !== previousKey) schedule();
  commit();showDesign();renderRegions(true);
}

function renderRegions(force=false) {
  if(!regionUI) {
    regionUI=new RegionControls({bar:$('#colour-bar'),header:$('#region-header'),cards:DESIGNS,select: id => { const before = buildKey(); selectRegion(id); if (buildKey() !== before) schedule(); },change:changeRegion,useCard:regionCard,close:()=>selectRegion(null)});
  }
  const key=JSON.stringify([state.regions?.map(({settings,...r})=>r),state.selectedRegion,edgeSeam()]);
  if(force||key!==regionUIKey){regionUI.update(state.regions,state.selectedRegion,edgeSeam());regionUIKey=key;}
  const keyNow=buildKey(),built=readyGcode?.key===keyNow||state.resultKey===keyNow;
  const working=workingRegions(),names=working.length>2?`${working.length} colours`:working.map(regionName).join(' and ');
  const button=$('#btn-apply');
  const empty = !!state.regions?.length && !state.regions.some(inPiece);
  const failed = !!currentBuildError(keyNow);
  button.disabled=empty||exporting||!!pendingRegionApply||!!currentPrintSizeProblem()||!isReady(state.design)
    || !working.length && (!!previewBuild || !!state.regions?.length && (!built || failed));
  button.textContent=empty?'Include a colour':pendingRegionApply?'Applying…':working.length?`Apply to ${names}`:previewBuild?'Updating…':'Export G-code';
  button.dataset.mode=working.length?'apply':'export';
  button.classList.toggle('has-changes',!!working.length);
  button.title=working.length?`Set ${names} aside as part of the piece, then untick it and work on the next colour.`:'Save the G-code for every applied colour.';
  $('#apply-status').hidden=!state.regions?.length;
  const parked=state.regions?.filter(r=>r.applied).length??0;
  if (state.regions?.length) $('#apply-status').textContent = empty ? 'Include a colour to build the piece.'
    : pendingRegionApply ? `Applying ${names}…`
    : failed ? 'The latest settings could not be built. See the reason in the print summary.'
    : working.length ? `${names} selected · ${parked} applied`
    : built ? `${parked} colour${parked===1?'':'s'} applied. Export is ready.` : 'Updating the piece…';
}

/** Apply only after the exact toolpath has built successfully. Reuse the preview job if it is already building it. */
function applyPiece() {
  if (exporting || pendingRegionApply || !workingRegions().length) return;
  captureRegionSettings();
  const key = buildKey();
  pendingRegionApply = { key };
  if (state.resultKey === key && !currentBuildError(key)) {
    finishRegionApply(key);
    return;
  }
  if (previewBuild?.key !== key && (!genTimer || previewChoice === 'overview')) {
    clearTimeout(genTimer);
    genTimer = null;
    if (previewChoice === 'overview' && !overviewActive) showRegionOverview();
    previewAtSelectedSize(exportOptions());
  }
  renderRegions();
}

function finishRegionApply(key) {
  if (pendingRegionApply?.key !== key) return;
  pendingRegionApply = null;
  let next=Math.max(0,...state.regions.map(r=>r.order??0));
  for(const r of workingRegions()){r.applied=true;if(!r.order)r.order=++next;}
  commit();
  renderRegions(true);
}

/* ---------- generation ---------- */
let genTimer = null;
function schedule() {
  regenerationEpoch++;
  stopPlay();
  captureRegionSettings();
  const key = buildKey();
  if (pendingRegionApply && pendingRegionApply.key !== key) pendingRegionApply = null;
  if (readyGcode && readyGcode.key !== key) readyGcode = null; // made for settings that are no longer these
  if (referenceResult && referenceResult.key !== key) referenceResult = null;
  if (overviewTrace && overviewTrace.key !== key) overviewTrace = null; // likewise: made for settings that are no longer these
  if (traceProblem && traceProblem.key !== key) traceProblem = null;
  fixJob?.controller.abort(); // the settings changed under the search: what it would fix is gone
  previewBuild?.controller.abort();
  previewBuild = null;
  overview?.cancel();
  exportController?.abort();
  clearTimeout(genTimer);
  genTimer = setTimeout(regenerate, 140);
  if (state.buildFailure && state.buildFailure.key !== key) {
    state.buildFailure = null;
    renderErrors();
  }
  renderCheck(key);
  renderBusy();
  renderExport();
  renderPreviewMode();
  renderPlayback();
}

function renderBusy() {
  const busy = !!genTimer || !!previewBuild || exporting;
  // the G-code 2D builds in the background is quiet: the picture is already there, and the playback bar says it is building
  $('#busy-chip').hidden = !busy || (previewBuild?.kind === 'background-trace' && !genTimer && !exporting);
  const message = exporting ? exportLabel : previewBuild?.progress ?? (previewBuild && previewBuild.kind !== 'full-preview' ? 'Generating G-code…' : 'Updating…');
  if ($('#busy-chip').textContent !== message) $('#busy-chip').textContent = message;
  if (busy) $('#stage').setAttribute('aria-busy', 'true');
  else $('#stage').removeAttribute('aria-busy');
}

/** A captured design at its selected size, shared by preview and direct export workers. */
function exportOptions(width = null, height = null) {
  const size = BINDINGS[state.design].size.get();
  width ??= size[0]; height ??= size[1];
  return {
    machine: state.machines.get(state.machine), material: printMaterial(), design: state.design,
    width, height, settings: state.design === 'loop-pile' ? toTextile(state.primary, state.advanced) : settingsOf(state.design),
    studySettings: { ...settingsOf(state.design) }, outline: state.regions?.length ? null : placedOutline(width, height),
    regions: pieceRegions(), seam: edgeSeam(),
    ...(state.regions?.length && state.print.outsideOutline ? { outsideOutline: state.print.outsideOutline } : {}),
    vector: state.vector, shapeOutline: !!state.outline?.page, solidLayers: state.print.solidLayers, solidGenerator: 'arachne', extraLayers: state.print.extraLayers, legacyCopies: state.print.legacyCopies, brim: state.print.brim, perimeters: state.print.brim, meshPerimeters: edgeCount(), meshShift: edgeShift(), backing: backingFor(),
    image: state.image?.data ?? null, pilePattern: state.primary.pattern, pilePatternScale: state.primary.patternScale,
    panelSize: size,
  };
}

function showGenerated(result, key) {
  result.designId = state.design;
  if (state.print.legacyCopies && result.layerPlan) {
    state.print.extraLayers = result.layerPlan.extraLayers;
    delete state.print.legacyCopies;
    key = buildKey();
  }
  state.result = result;
  state.resultKey = key;
  state.buildFailure = null;
  const [width, height] = BINDINGS[state.design].size.get();
  if (result.referencePreview) referenceResult = { key, result };
  else printEstimates.put(key, result, width, height);
  preview.update(regionPreviewResult(result));
  applyScrub();
  if (state.regions?.length && !result.referencePreview) {
    readyGcode = { key, result };
    finishRegionApply(key);
    if (overviewActive) showRegionOverview();
  }
}

function regionPreviewResult(result) {
  if(!state.regions?.length||previewChoice!=='sample')return result;
  const w=Math.min(100,result.cfg.t.sample_width),h=Math.min(100,result.cfg.t.sample_height);
  return {...result,sampleWindow:[w,h],documentSize:[w,h],outline:null,excludedPaths:[]};
}

function showRegionOverview() {
  overviewActive=true;renderPreviewMode();
  const current=state.resultKey===buildKey()?state.result:null;
  const width=state.vector.width,height=state.vector.height;
  const source=state.regions.filter(r=>!inPiece(r)).flatMap(r=>r.pathIndices.map(i=>({pts:state.vector.paths[i],color:'other'})));
  // the whole piece is already built in this flow, so its print order needs no second build
  if(current&&overviewTrace?.source!==current)overviewTrace={key:buildKey(),trace:packTrace(current),source:current};
  overview.setResult({width,height,rings:current?.outline??[[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}]],source,packed:packLines(current?.strands??[]),strandWidth:current?.cfg.t.extrusion_width??.45,shapeOnly:!current});
  overviewStatus=current?'Whole colour-region piece at true scale.':'Region outlines only — Apply to build the whole piece.';
  renderBusy();renderPreviewMode();render(); // the "Updating…" chip schedule() raised has nothing left to wait for
}

/** Full ordinary-size designs build off the UI thread; obsolete slider jobs are terminated. */
function canBrowseReference(input) {
  return input.width === 100 && input.height === 100 && !input.vector && !input.outline && !input.image && !input.regions?.length
    && state.print.layerHeight === defaultLayerHeight(state.machines.get(state.machine))
    && !FILAMENT_FIELDS.some(field => Object.hasOwn(state.print, field.key)) && !Object.hasOwn(state.print, 'widthMaps');
}

function showBuiltOverview(result) {
  const width = result.cfg.t.sample_width, height = result.cfg.t.sample_height;
  overviewStatus = result.referencePreview ? '' : '2D view at true scale';
  overview.setResult({ width, height, rings: result.outline ?? [[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}]], source: [],
    packed: packLines(result.strands), strandWidth: result.cfg.t.extrusion_width });
}

function previewAtSelectedSize(input, { estimateOnly = false, auto = false, reference = false } = {}) {
  state.buildFailure = null;
  previewBuild?.controller.abort();
  const key = buildKey(), controller = new AbortController();
  const kind = auto ? 'background-trace' : estimateOnly ? 'print-estimate' : 'full-preview';
  const job = { key, controller, promise: null, kind };
  const isCurrent = () => previewBuild === job && !controller.signal.aborted && buildKey() === key;
  previewBuild = job;
  // the G-code for time, filament and Export, with its print order for 2D to play (no 3D geometry crosses from the worker)
  const build = async () => {
    const cached = await defaultCache.load(input, { signal: controller.signal, reference: reference && canBrowseReference(input) });
    if (cached) {
      job.cachedGeometry = cached;
      return estimateOnly ? { ...compactDesignExport(cached), referencePreview: !!cached.referencePreview, trace: packTrace(cached) } : cached;
    }
    if (estimateOnly && overviewActive && isCurrent() && canBrowseReference(input)) overview.update(input);
    return buildSwatch(input, { signal: controller.signal, preview: !estimateOnly, trace: estimateOnly, progress: progress => {
      if (previewBuild !== job || controller.signal.aborted || !input.regions?.length) return;
      job.progress = progress.message;
      renderBusy();
    } });
  };
  job.promise = build().then((result) => {
    if (isCurrent()) {
      if (estimateOnly) {
        if (result.referencePreview) {
          referenceResult = { key, result: job.cachedGeometry ?? result };
        }
        else { printEstimates.put(key, result, input.width, input.height); readyGcode = { key, result }; }
        if (overviewActive && job.cachedGeometry) showBuiltOverview(job.cachedGeometry);
        if (result.trace) overviewTrace = { key, trace: result.trace, referencePreview: !!result.referencePreview };
      } else showGenerated(result, key);
    }
    return result;
  }).catch((error) => {
    if (error.name !== 'AbortError' && isCurrent() && kind === 'background-trace') {
      // the 2D picture stays: only the print order is missing, and Export reports the same problem if it is real
      autoBuildStopped = key;
      traceProblem = { key, message: error.message };
      recordBuildFailure(error, { ...input, operation: 'preview' });
    } else if (error.name !== 'AbortError' && isCurrent()) {
      if (!estimateOnly && !input.regions?.length && previewChoice === 'auto' && canSimplifyPreview(error)) {
        previewBuild = null;
        showWholeOverview(input, { build: false }); // 3D just failed to build this piece: the same build would fail again
        toast('3D could not finish for this piece, so it shows the 2D drawing. Print settings are unchanged.', { kind:'warning' });
        return null;
      }
      state.buildFailure = { key, error };
      recordBuildFailure(error, { ...input, operation: 'preview' });
    }
    throw error;
  }).finally(() => {
    if (previewBuild === job) {
      if (pendingRegionApply?.key === key) pendingRegionApply = null;
      previewBuild = null;
      renderBusy();
      render();
    }
  });
  void job.promise.catch(() => {});
  renderBusy();
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

/**
 * The chosen material with the chosen layer thickness, temperatures and retraction: every design reads its layer height
 * from the config it makes, and the G-code its temperatures and retraction.
 */
function printMaterial() {
  const base = state.materials.get(state.material);
  normalisePrint();
  if (!base) return base;
  const material = withFilamentSettings(base, state.print, state.machines.get(state.machine));
  if (material.print_defaults?.layer_height === state.print.layerHeight) return material;
  return { ...material, print_defaults: { ...(material.print_defaults ?? {}), layer_height: state.print.layerHeight } };
}

/** The filament's temperatures and retraction in the printer setup, each showing its value now. */
function renderFilamentSettings() {
  const material = state.materials.get(state.material), machine = state.machines.get(state.machine), box = $('#filament-fields');
  if (!material || !box) return;
  if (!box.children.length) {
    const basic = el('div', { class: 'filament-fields' });
    const advancedFields = el('div', { class: 'filament-fields' });
    const advanced = el('details', { class: 'filament-advanced', id: 'filament-advanced' },
      el('summary', {}, 'Advanced ', el('span', { id: 'filament-advanced-changes', class: 'small muted', hidden: true })), advancedFields);
    for (const f of FILAMENT_FIELDS) {
      const input = el('input', { type: 'number', id: `filament-${f.key}`, min: String(f.min), max: String(f.max), step: String(f.step), inputmode: 'decimal' });
      input.addEventListener('change', () => {
        const filament = state.materials.get(state.material);
        if (input.value !== '' && !(Number(input.value) >= f.min && Number(input.value) <= f.max)) toast(`${f.label}: enter ${f.min} to ${f.max} ${f.unit}.`);
        state.print = setFilamentSetting(state.print, filament, f.key, input.value, state.machines.get(state.machine));
        renderPrinter();
        schedule();
        commit();
      });
      const row = el('div', { class: 'field-row', 'data-filament': f.key },
        el('span', { class: 'field-heading' }, el('label', { for: input.id, text: `${f.label} (${f.unit})` }), f.help && helpBubble(f.label, f.help)), input);
      (['firstLayerTemp', 'nozzleTemp'].includes(f.key) ? basic : advancedFields).append(row);
    }
    const maps=el('details',{class:'width-maps'},el('summary',{text:'Measured thickness maps'}),el('p',{class:'small muted',text:'Enter measured flow,width pairs (one pair per line). Keep separate tables for beads on the bed and beads over another net. Leave empty until printed and measured. Tables clamp rather than extrapolate outside the measured range.'}));
    for(const [key,label] of [['bed','On the bed'],['overNet','Over another net']]){
      const field=el('textarea',{id:`width-map-${key}`,rows:4,'aria-label':`${label}: measured flow and width in mm`,placeholder:'flow, measured width (mm)'});
      field.addEventListener('change',()=>{
        try{
          const value={};
          for(const table of ['bed','overNet']){
            const text=$(`#width-map-${table}`).value.trim();
            if(text)value[table]=text.split(/\r?\n/).filter(line=>line.trim()).map(line=>{const [flow,width,...extra]=line.trim().split(/[,;\s]+/);if(extra.length||!flow||!width)throw new Error('Use exactly two numbers per row: flow, measured width.');return {flow:Number(flow),width:Number(width)};});
          }
          state.print.widthMaps=sanitizeWidthMaps(value);field.removeAttribute('aria-invalid');schedule();commit();renderFilamentSettings();
        }catch(error){field.setAttribute('aria-invalid','true');toast(error.message);}
      });
      maps.append(el('label',{class:'field-row stacked'},el('span',{text:label}),field));
    }
    const save=el('button',{type:'button',class:'btn',text:'Save filament profile with measurements'});
    save.addEventListener('click',()=>download(`${state.material}-calibration.json`,new Blob([JSON.stringify(printMaterial(),null,2)],{type:'application/json'})));
    maps.append(save);advancedFields.append(maps);
    box.append(basic, advanced);
    $('#filament-reset').addEventListener('click', () => {
      state.print = withoutFilamentSettings(state.print);
      renderPrinter(); schedule(); commit();
    });
  }
  const changed = [];
  for (const f of FILAMENT_FIELDS) {
    const row = box.querySelector(`[data-filament="${f.key}"]`), input = row.querySelector('input');
    const own = f.get(material, machine), value = filamentValue(material, state.print, f.key, machine);
    if (document.activeElement !== input) input.value = value === null ? '' : String(value);
    input.placeholder = own === null ? (f.key === 'flatBeadWidth' ? 'Unmeasured' : 'Design speeds') : String(own);
    row.classList.toggle('changed', value !== own);
    input.setAttribute('aria-description', value !== own
      ? (own === null ? 'Optional setting added to this print setup' : `Filament default: ${own} ${f.unit}`)
      : 'Using the filament default');
    if (value !== own) changed.push(f);
  }
  for(const key of ['bed','overNet']){
    const field=$(`#width-map-${key}`),maps=Object.hasOwn(state.print,'widthMaps')?state.print.widthMaps:material.flow.width_maps;
    if(field&&document.activeElement!==field&&!field.hasAttribute('aria-invalid'))field.value=(maps?.[key]??[]).map(row=>`${row.flow}, ${row.width}`).join('\n');
  }
  $('#filament-reset').disabled = !changed.length&&!Object.hasOwn(state.print,'widthMaps');
  const advancedChanges = changed.filter(f => !['firstLayerTemp', 'nozzleTemp'].includes(f.key)).length;
  const badge = $('#filament-advanced-changes');
  badge.hidden = !advancedChanges;
  badge.textContent = `${advancedChanges} changed`;
}

function renderPreviewMode() {
  const design = designById(state.design);
  const drawing = !!state.regions?.length;
  const heading = $('#stage-design');
  const title = drawing ? 'Drawing preview' : design.name;
  if (heading.textContent !== title) heading.textContent = title;
  const shelf = SHELVES[design.shelf]?.label;
  $('#stage-type').textContent = shelf ? `${shelf} textile` : '';
  $('#stage-type').hidden = drawing || !shelf;
  const [width, height] = BINDINGS[state.design].size.get();
  $('#canvas-piece-size').textContent = `${Number(width.toFixed(2))} × ${Number(height.toFixed(2))} mm piece`;
  $('#canvas-view-mode').textContent = overviewActive ? '2D view' : previewChoice === 'sample' ? '3D sample' : '3D view';
  $('#overview').hidden = !overviewActive;
  $('#preview').hidden = overviewActive;
  preview?.setVisible(!overviewActive);
  $('#btn-camera').hidden = overviewActive;
  $('#btn-view').hidden = overviewActive;
  $('#overview-actions').hidden = !overviewActive;
  $('#overview-status').hidden = !overviewActive;
  const building = printOrderBuilding(), problem = overviewActive ? traceProblem?.message ?? '' : '';
  $('#overview-status').textContent = [overviewTrace?.referencePreview ? 'Reference sample · Prusa MK3S / Foamy 95A · Export uses your selected setup' : overviewStatus, building && 'building the print order…', problem && `the print order could not be built (${problem})`].filter(Boolean).join(' · ');
  const trace = overviewTraceNow();
  $('#overview-export-svg').disabled = !trace;
  $('#overview-export-svg').title = trace ? 'Save this view as an SVG at true size, with every strand as a path' : 'Available once the print order is built';
  overview?.setTrace(trace);
  if (overviewActive) applyScrub();
  $('#preview-whole').setAttribute('aria-pressed', String(overviewActive));
  $('#preview-full').setAttribute('aria-pressed', String(!overviewActive && previewChoice !== 'sample'));
  $('#preview-full').disabled = !!currentPrintSizeProblem();
  $('#preview-detail').setAttribute('aria-pressed', String(!overviewActive && previewChoice === 'sample'));
  $('.playback').hidden = overviewActive && !trace && !building; // 2D plays the print order once the G-code is built
  $('.canvas-hint').hidden = overviewActive;
  if (overviewActive && !currentBuildError()) {
    $('#canvas-note').hidden = true;
    $('#canvas-wrap').classList.remove('dimmed');
  }
}

/**
 * The 2D picture appears at once; unless `build` is false, the G-code is built behind it straight away (the same build Export
 * and "Generate G-code" use), and when it is ready the print order can be played and saved as SVG.
 */
function showWholeOverview(input, { build = true } = {}) {
  // a finished whole-piece 3D build already holds the G-code: keep it (without its 3D geometry) for Export
  const [sw, sh] = BINDINGS[state.design].size.get();
  const key = buildKey();
  let wholeResult = null;
  if (state.result && !state.result.samplePreview && !currentBuildError(key) && state.resultKey === key && state.result.cfg.t.sample_width === sw && state.result.cfg.t.sample_height === sh) {
    wholeResult = state.result;
    const trace = packTrace(wholeResult);
    if (!wholeResult.referencePreview) readyGcode = { key, result: { ...compactDesignExport(wholeResult), trace } };
    overviewTrace = { key, trace, referencePreview: !!wholeResult.referencePreview };
  }
  overviewActive = true;
  overviewStatus = '';
  preview.reset();
  stopPlay();
  state.result = null;
  state.resultKey = null;
  state.buildFailure = null;
  renderPreviewMode();
  const reference = referenceResult?.key === key ? referenceResult.result : null;
  const geometry = wholeResult ?? reference;
  const waitingForCache = build && !previewBuild && autoBuildStopped !== key
    && !overviewTrace?.trace && !readyGcode?.result.trace && canBrowseReference(input);
  if (geometry?.strands) showBuiltOverview(geometry);
  else if (waitingForCache) overview.setResult({ width: sw, height: sh, rings: [[{x:0,y:0},{x:sw,y:0},{x:sw,y:sh},{x:0,y:sh}]], source: [], packed: packLines([]), strandWidth: .45, shapeOnly: true });
  else overview.update(input);
  if (build) startPrintOrder(input);
  renderBusy();
  render();
}

function startPrintOrder(input) {
  const key = buildKey();
  if (currentPrintSizeProblem() && !canBrowseReference(input) || previewBuild || autoBuildStopped === key) return;
  if (overviewTrace?.key === key && overviewTrace.trace) return;
  if (readyGcode?.key === key && readyGcode.result.trace) { overviewTrace = { key, trace: readyGcode.result.trace }; return; } // already built: not again
  traceProblem = null;
  previewAtSelectedSize(input, { estimateOnly: true, auto: true, reference: true });
}

/**
 * The print order of the finished G-code for the settings now showing in 2D, or null while it is not there. schedule() drops one
 * made for other settings, so this is a plain lookup: playback asks for it on every frame, and the settings key is not cheap.
 */
function overviewTraceNow() {
  return overviewActive ? overviewTrace?.trace ?? null : null;
}

/** 2D is waiting for its print order: the build is running (or about to start). */
function printOrderBuilding() {
  return overviewActive && !overviewTraceNow() && (previewBuild?.kind === 'background-trace' || (!!genTimer && !state.regions?.length));
}

let regenerationEpoch = 0;
async function regenerate() {
  const epoch = ++regenerationEpoch;
  genTimer = null;
  previewBuild?.controller.abort();
  previewBuild = null;
  const machine = state.machines.get(state.machine);
  const material = printMaterial();
  let key;
  try {
    let result;
    const mod = designById(state.design);
    followVectorSize();
    key = buildKey();
    const [selectedWidth, selectedHeight] = BINDINGS[state.design].size.get();
    if (state.regions?.length && previewChoice==='overview') {
      showRegionOverview();
      if (state.resultKey !== key && state.regions.some(inPiece) && (pendingRegionApply || !workingRegions().length)) {
        previewAtSelectedSize(exportOptions());
      }
      return;
    }
    if (state.regions?.length && !state.regions.some(inPiece)) { showRegionOverview(); return; } // nothing ticked or applied: just the outlines
    if (state.regions?.length) {
      if(currentPrintSizeProblem())throw new Error(currentPrintSizeProblem());
      overviewActive=false; overview.cancel(); renderPreviewMode();
      previewAtSelectedSize(exportOptions(selectedWidth,selectedHeight)); return;
    }
    const reference = previewChoice !== 'sample' && canBrowseReference(exportOptions(selectedWidth, selectedHeight));
    if ((useWholeOverview(selectedWidth, selectedHeight, machine, previewChoice) || previewChoice !== 'sample' && currentPrintSizeProblem()) && !(reference && previewChoice !== 'overview')) {
      showWholeOverview(exportOptions(selectedWidth, selectedHeight));
      return;
    }
    overviewActive = false;
    overview.cancel();
    renderPreviewMode();
    const wholePreview = (!currentPrintSizeProblem() || reference) && previewChoice !== 'sample';
    if (wholePreview) {
      previewAtSelectedSize(exportOptions(selectedWidth, selectedHeight), { reference: true });
      return;
    }
    if (state.vector && state.print.brim > 0) {
      await prepareAdaptiveSolids();
      if (epoch !== regenerationEpoch) return;
    }
    // 3D sample is a bounded corner of a large piece. 2D is the default for pieces larger than the bed (above).
    // Imported drawings keep their full scale within the explicitly labelled sample.
    const cap = state.vector && Math.max(state.vector.width, state.vector.height) <= 250 && state.vector.width <= machine.bed.width && state.vector.height <= machine.bed.depth ? 250 : 100;
    if (!mod.legacyPanel) {
      const own = state.designs[mod.settingsKey ?? mod.id];
      const [w, h] = mod.size(own);
      const previewState = { ...own, width: Math.min(w, cap), height: Math.min(h, cap) };
      result = mod.generate(machine, material, previewState, { outline: mod.outline === false ? null : placedOutline(previewState.width, previewState.height, w, h), vector: mod.usesVector || mod.vectorGuides ? state.vector : null, vectorSize: [w, h], includeLines: !state.vector, picture: pictureFor(w, h), perimeters: state.print.meshPerimeters, printedBoundary: !!state.vector && !!state.outline?.page });
    } else {
      const [w, h] = sampleSize(state.primary);
      const textile = toTextile(state.primary, state.advanced);
      textile.sample_width = Math.min(w, cap); textile.sample_height = Math.min(h, cap);
      result = generate(machine, material, textile, { outline: placedOutline(textile.sample_width, textile.sample_height, w, h), liftAt: pileLiftFactor(state.primary, pictureFor(w, h)) });
    }
    // a drawing that is all green (and blue) has no red to fill: no pattern, only its solids
    const allSolid = solidOnly(state.vector);
    if (allSolid) result = withoutPattern(result);
    if (state.vector) {
      const [fullWidth, fullHeight] = BINDINGS[state.design].size.get();
      result = applySvgGuides(result, state.vector, { fullWidth, fullHeight, outline: mod.outline === false ? placedOutline(result.cfg.t.sample_width, result.cfg.t.sample_height, fullWidth, fullHeight) : null });
      // a drawing that is also the outline lies on the boundary itself, so its lines are not trimmed to it
      result = composeSvgLines(result, state.vector, { fullWidth, fullHeight, clipLines: !state.outline?.page && !result.guideCount, perimeters: state.print.brim, meshPerimeters: state.print.meshPerimeters });
    }
    const native = nativeLayerInfo(result);
    const extras = state.print.legacyCopies ? (native.repeatable && !native.raised ? native.patternLayers * (state.print.legacyCopies - 1) : 0) : state.print.extraLayers;
    result = addExtraLayers(result, extras, {
      rotatedResult: () => generateDesignBase(rotateDesignInput({ ...exportOptions(), width: result.cfg.t.sample_width, height: result.cfg.t.sample_height,
        outline: result.outline, vectorSize: [selectedWidth, selectedHeight] })),
      colorChange: !!settingsOf(state.design).colorChange,
    });
    // green shapes print solid: on the bed layer by layer with the pattern, or last, on top of it and any extra layers
    if (state.vector) result = applySvgSolids(result, state.vector, { fullWidth: selectedWidth, fullHeight: selectedHeight, layers: state.print.solidLayers, perimeters: state.print.brim, generator: 'arachne' });
    // Offset the selected outline before clipping: a bounded preview must never invent an edge at its crop.
    const pictured = state.design === 'squiggle' && settingsOf(state.design).pattern === 'image' && state.image && !state.vector;
    const fullWidth = pictured ? result.cfg.t.sample_width : selectedWidth;
    const fullHeight = pictured ? result.cfg.t.sample_height : selectedHeight;
    let brimOutline = result.outline;
    if (fullWidth !== result.cfg.t.sample_width || fullHeight !== result.cfg.t.sample_height) {
      const boundary = boundaryFor(fullWidth, fullHeight, placedOutline(fullWidth, fullHeight));
      brimOutline = state.vector ? conformalGuideRegion(boundary, vectorGuides(state.vector, fullWidth, fullHeight)).rings : boundary.rings;
    }
    result = applyBrim(result, { count: allSolid && !backingFor() ? 0 : edgeCount(), shift: edgeShift(), outline: brimOutline, fullWidth, fullHeight, label: 'Perimeters', requestedCount: state.print.brim });
    if (state.vector && result.cfg.t.sample_width === selectedWidth && result.cfg.t.sample_height === selectedHeight) result.documentSize = [state.vector.width, state.vector.height];
    const sample = refreshConstruction(colourResult(result, settingsOf(state.design)));
    sample.samplePreview = true;
    showGenerated(sample, buildKey());
  } catch (e) {
    if (epoch !== regenerationEpoch) return;
    if (previewChoice === 'auto' && canSimplifyPreview(e)) {
      try { showWholeOverview(exportOptions(), { build: false }); return; } catch { /* invalid document dimensions still report normally */ }
    }
    state.buildFailure = { key: key ?? buildKey(), error: e };
    recordBuildFailure(e);
    if (!(e && Array.isArray(e.errors))) console.error(e);
  }
  renderBusy();
  render();
}

function applyScrub() {
  if (overviewActive) { // the 2D picture plays the same print order, over the same scrubber
    const trace = overviewTraceNow();
    overview.setProgress(trace && state.fraction < 1 ? indexAtTime(trace.time, state.fraction * trace.timeSec) : Infinity);
    return;
  }
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
  for (const input of $$('[data-build-invalid]')) {
    input.removeAttribute('aria-invalid');
    delete input.dataset.buildInvalid;
  }
  for (const e of $$('.field-error[data-engine]')) { e.hidden = true; e.textContent = ''; delete e.dataset.engine; }
  const sizeError = $(`#${state.design}-size-error`);

  const error = currentBuildError();
  if (!error) {
    box.hidden = true;
    box.replaceChildren();
    const [w, h] = BINDINGS[state.design].size.get();
    const t = state.result?.cfg.t;
    const sampled = t && (t.sample_width !== w || t.sample_height !== h);
    $('#canvas-note').hidden = !sampled;
    if (sampled) $('#canvas-note').textContent = `3D sample: a ${t.sample_width} × ${t.sample_height} mm corner · Export makes the whole ${w} × ${h} mm`;
    if (state.result?.referencePreview) { $('#canvas-note').hidden = false; $('#canvas-note').textContent = 'Reference sample · Prusa MK3S / Foamy 95A · Export builds for your selected printer and filament'; }
    const stale=state.regions?.length&&state.resultKey!==buildKey()&&!!state.result;
    if(stale){$('#canvas-note').hidden=false;$('#canvas-note').textContent='Settings changed — showing the last applied piece';}
    $('#canvas-wrap').classList.toggle('dimmed',!!stale);
    return;
  }
  const raw = Array.isArray(error.errors) && error.errors.length ? error.errors : [String(error.message || error)];
  for (const message of raw) {
    const { key, text } = plainError(message);
    const field = key ? document.querySelector(`[data-key="${key}"]`) : null;
    const inline = key ? document.querySelector(`.field-error[data-for="${key}"]`) : null;
    if (field && inline) {
      field.setAttribute('aria-invalid', 'true');
      field.dataset.buildInvalid = '1';
      inline.textContent = text;
      inline.hidden = false;
      inline.dataset.engine = '1';
      if (field.closest('#advanced-body')) {
        openAdvanced(true);
        const group = field.closest('details');
        if (group) group.open = true;
      }
    } else if ((key === 'sample_width' || key === 'sample_height') && sizeError) {
      sizeError.textContent = text;
      sizeError.hidden = false;
      sizeError.dataset.engine = '1';
    }
  }
  box.hidden = true;
  const hasPreview = !!state.result;
  const reason = plainError(raw[0]).text;
  $('#canvas-note').textContent = hasPreview ? `Showing the last successful preview. ${reason}` : reason;
  $('#canvas-note').hidden = false;
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
  if (!mod || mod.legacyPanel) return '';
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
function currentVerdict(key = buildKey()) {
  if (!state.result || state.resultKey !== key || currentBuildError(key)) return null;
  const construction = constructionVerdict(state.result.construction);
  if (construction?.blocked) return construction;
  if(state.regions?.length) {
    const notes=[...(state.result.warnings??[]),...(state.result.construction?.warnings??[])];
    return notes.length?{level:'heads-up',title:'Whole-piece construction',body:[...new Set(notes)].join(' '),action:null}:null;
  }
  const fabric = state.result.fabric;
  const mod = designById(state.design);
  if (fabric && !fabric.exportable) {
    const advice = adviceFor(mod, fabric.issues.join('. '));
    const fix = fabric.issues.length > 0 && !!BINDINGS[state.design]?.sliders?.length;
    return constructionVerdict(state.result.construction, {
      level: 'heads-up', title: 'Check the geometry', fix,
      body: `${describeFabric(fabric)}${advice}${fix ? ' Fix it tries small changes to the settings and keeps the first one that clears this.' : ''} You can also export it as it is: it prints as drawn.`,
      action: null,
    });
  }
  const baseVerdict = !mod.legacyPanel ? (mod.verdict?.(state.result, settingsOf(state.design)) ?? buildSquiggleVerdict(state.result.stats, { colorChange: settingsOf(state.design).colorChange }))
    : buildVerdict(state.result.stats, { roomy: state.primary.roomy });
  const verdict = constructionVerdict(state.result.construction, baseVerdict);
  if (verdict.level === 'ready' || verdict.level === 'ok') return null;
  return { ...verdict, body: verdict.body + adviceFor(mod, `${verdict.title} ${verdict.body}`) };
}

function renderCheck(key = buildKey()) {
  const box = $('#check');
  let v = currentVerdict(key);
  const error = currentBuildError(key);
  const failedRegion = state.regions?.find(region => region.id === error?.region?.id);
  const recovery = error && (!failedRegion || failedRegion.id === state.selectedRegion)
    ? suggestRecovery(designById(state.design), settingsOf(state.design), error) : null;
  if (!v && error) {
    const reasons = (error.errors?.length ? error.errors : [String(error.message || error)]).slice(0, 3).map(message => plainError(message).text);
    const code = classifyBuildError(error).code;
    const next = recovery ? 'Try Simplify this pattern. Undo restores the previous settings.'
      : code === 'bed-fit' ? 'Check the printer bed and drawing size. An outline that sits outside the edge also needs room on the bed.'
      : failedRegion ? `Open ${regionName(failedRegion)} in Drawing colours and adjust its pattern or outline. Undo restores the previous settings.`
      : '';
    v = { level: 'error', title: failedRegion ? `Could not build ${regionName(failedRegion)}` : 'Could not build the piece',
      body: [...reasons, next].filter(Boolean).join(' '), action: null };
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
    // a build error shows no log or report buttons here: Download error log stays in the ··· menu
    if (v.action === 'roomy-off') {
      const btn = el('button', { type: 'button', class: 'check-btn ghost', text: v.actionLabel });
      btn.addEventListener('click', () => setRoomy(false));
      actions.append(btn);
    }
    const loopFlags = state.design === 'loop-pile' && state.result && !error && state.result.stats.violations > 0;
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

/** The crossing report, shown only when Details is opened. */
function reportItems(r, item) {
  return [
    item('Crossings', `${r.crossings.toLocaleString('en')} (${r.perCm2.toFixed(1)} per cm²)`),
    ...(Number.isFinite(r.between) ? [item('Between layers', r.between.toLocaleString('en'))] : []),
    ...(Number.isFinite(r.minAngle) ? [item('Smallest usual angle', r.crossings ? `${Math.round(r.minAngle)}°` : 'none')] : []),
    ...(Number.isFinite(r.longestUncrossed) ? [item('Longest uncrossed', `${Math.round(r.longestUncrossed)} mm`)] : []),
  ];
}

function renderFigures() {
  const minutes = stats => { const seconds=printTimeSeconds(stats); return seconds===null ? '—' : formatMinutes(seconds/60); };
  const host = $('#figures');
  const toggle = $('#btn-details');
  const fig = (value, unit, label) => el('div', { class: 'figure' },
    el('div', { class: 'fig-value' }, value, unit ? el('span', { class: 'fig-unit', text: ` ${unit}` }) : null),
    el('div', { class: 'fig-label', text: label }));
  host.classList.toggle('overview-figures', overviewActive);
  if (overviewActive) {
    // 2D is a drawing: time and filament come from the G-code, which is one explicit step (and Export reuses it)
    const [w, h] = BINDINGS[state.design].size.get();
    const key = buildKey();
    const estimate = printEstimates.get(key);
    const reference = referenceResult?.key === key ? referenceResult.result : null;
    const generating = !!(previewBuild && previewBuild.kind !== 'full-preview');
    const problem = currentPrintSizeProblem();
    const scope = estimate?.full ? 'Whole-piece' : 'Sample';
    host.classList.toggle('stale', !!currentBuildError());
    host.replaceChildren();
    if (estimate) host.append(fig(minutes(estimate), 'min', `${scope} motion estimate`),
      fig(grams(estimate.filamentGrams ?? 0), 'g', `${scope} filament`));
    else if (reference) host.append(fig(minutes(reference.stats), 'min', 'Reference motion estimate'), fig(grams(reference.stats.filamentGrams), 'g', 'Reference filament'));
    const info = reference && !estimate ? 'Reference sample: Prusa MK3S / Foamy 95A. Export or Generate G-code calculates your selected printer and filament.' : generating ? `Generating the G-code for the whole ${w} × ${h} mm piece, the same work Export does. You can keep looking; the time appears when it is done.`
      : estimate?.full ? null
        : estimate ? `From a ${estimate.width} × ${estimate.height} mm 3D sample only, not the whole ${w} × ${h} mm piece.`
          : `The 2D view is a drawing, so it has no print time. Time and filament come from the G-code for the whole ${w} × ${h} mm piece.`;
    if (info) host.append(el('p', { class: 'estimate-info small muted', text: problem && !estimate?.full ? `${info} ${problem}` : info }));
    if (!estimate?.full) {
      const generate = el('button', { type: 'button', id: 'calculate-full-estimate', class: 'btn', text: generating ? 'Generating G-code…' : 'Generate G-code for time and filament', disabled: generating || !!previewBuild || !!problem });
      generate.title = problem || 'Works out the whole toolpath in the background: the same work as Export, which then saves it without waiting. You can stop it.';
      generate.addEventListener('click', () => { previewAtSelectedSize(exportOptions(), { estimateOnly: true }); renderFigures(); });
      host.append(generate);
    }
    toggle.hidden = true;
    $('#details').hidden = true;
    return;
  }
  if (!state.result) { host.replaceChildren(); toggle.hidden = true; $('#details').hidden = true; return; }
  toggle.hidden = false;
  const { stats, cfg } = state.result;
  const t = cfg.t;
  const selected = BINDINGS[state.design].size.get();
  const sampled = !!state.result.samplePreview || t.sample_width !== selected[0] || t.sample_height !== selected[1];
  const mod = designById(state.design);
  host.classList.toggle('stale', !!currentBuildError());
  host.replaceChildren(
    fig(minutes(stats), 'min', state.result.referencePreview ? 'Reference motion estimate' : sampled ? 'Preview motion estimate' : 'Motion estimate'),
    fig(grams(stats.filamentGrams), 'g', state.result.referencePreview ? 'Reference filament' : sampled ? 'Preview filament' : 'Filament'),
    state.regions?.length ? fig(String(state.regions.filter(inPiece).length), '', 'Regions') : !mod.legacyPanel
      ? (() => { const f = mod.figure(state.result); return fig(f.value, f.unit, f.label); })()
      : fig(stats.loops.toLocaleString('en'), '', 'Loops'),
  );
  toggle.textContent = state.details ? 'Hide details' : 'Details';
  toggle.setAttribute('aria-expanded', String(state.details));
  const details = $('#details');
  details.hidden = !state.details;
  if (state.details) {
    const item = (label, value) => el('div', {}, el('div', { class:'k', text:label }), el('div', { class:'v', text:value }));
    details.replaceChildren(
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
    );
  }
  const what = state.regions?.length ? 'the whole colour-region piece' : !mod.legacyPanel ? mod.summary(state.result) : `${stats.loops} loops`;
  $('#preview').setAttribute('aria-label', `3D preview: ${what} on a ${t.sample_width} by ${t.sample_height} millimetre swatch, ${printTimeSeconds(stats)===null ? 'motion estimate unavailable' : `about ${minutes(stats)} minutes of modeled motion`}.`);
}

/** The seconds the print order runs for in the view showing now, or null when there is nothing to play. */
function playbackSeconds() {
  const seconds = overviewActive ? overviewTraceNow()?.timeSec : state.result?.stats.timeSec;
  return Number.isFinite(seconds) ? seconds : null;
}

function renderPlayback() {
  const total = (playbackSeconds() ?? 0) / 60, waiting = overviewActive && playbackSeconds() === null;
  $('#btn-play').disabled = waiting;
  $('#scrub').disabled = waiting;
  $('#time-label').textContent = waiting ? 'Building…' : `${formatMinutes(total * state.fraction)} of ${formatMinutes(total)} min`;
  $('#time-label').title = 'Print order uses commanded motion without acceleration; the motion estimate above includes acceleration and startup/end motion.';
  $('#play-icon').setAttribute('d', state.playing ? PAUSE_ICON : PLAY_ICON);
  $('#btn-play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play the print order');
  $('#scrub').value = String(Math.round(state.fraction * 1000));
}

function renderExport() {
  const btn = $('#btn-export');
  const key = buildKey();
  const result = state.resultKey === key && !state.result?.referencePreview && !state.result?.samplePreview ? state.result : null;
  const ok = !!result && !currentBuildError(key) && result.moves.length > 0;
  // Export can build a selected design independently of its bounded or pending preview.
  const problem = currentPrintSizeProblem();
  const invalidDraft = ['w', 'h'].some(axis => $(`#${state.design}-${axis}`)?.getAttribute('aria-invalid') === 'true');
  btn.disabled = exporting || !!result?.construction?.errors.length || !!problem || invalidDraft || (!overviewActive && !!state.print.legacyCopies) || !(ok || isReady(state.design));
  if (requiresApply()) btn.disabled = true;
  btn.title = readyGcode?.key === key ? 'The G-code for these settings is ready: Export saves it straight away.' : '';
  $('#print-fit-warning').hidden = !problem;
  $('#print-fit-message').textContent = problem;
  $('#garment-tool').hidden = !!state.regions?.length || designById(state.design).panel === false;
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
  const heat = `${filamentValue(material, state.print, 'nozzleTemp', machine)} °C`, retract = filamentValue(material, state.print, 'retraction', machine);
  return { name: `${shortMachine(machine.name)} · ${material.name}`, sub: `${state.print.layerHeight} mm thickness · ${layerSetupText()} · ${heat} · ${retract ? `${retract} mm retraction` : 'no retraction'}` };
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
  renderFilamentSettings();
  // a new printer, filament or measured bead moves the ends of the sizes that count in beads, without waiting for the build
  const bead = beadNow();
  if (bead !== sliderBead) { sliderBead = bead; for (const c of controls) c.update(); }
}
let sliderBead = 0;

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
  renderDesignChoices();
  renderTilePressed();
  renderAdvancedSummary();
  renderLegend();
  renderPreviewMode();
  renderRegions();
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
  setInspectorSection($('#btn-advanced'), open);
}

function setInspectorSection(button, open) {
  const set = (toggle, expanded) => {
    document.getElementById(toggle.getAttribute('aria-controls')).hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
  };
  if (open) {
    for (const other of $$('#settings-body :is(.section-fold-toggle, #btn-advanced)[aria-expanded="true"]')) {
      if (other !== button) set(other, false);
    }
  }
  set(button, open);
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

function foldRemainingSections() {
  for (const section of $$('#settings-body .panel > section.group, #drawing-region-settings')) {
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
  renderDesignChoices();
  $('#doc-name').value = state.docName;
  fillDialogSelects();
}

let machinePicker, materialPicker;
function fillDialogSelects() {
  machinePicker?.refresh();
  materialPicker?.refresh();
  updateDialogNote();
}

/* ---------- the printer picker: the printers here and the library's hundreds, found by typing ---------- */

/** Every printer that can be picked: the ones in the profiles folder or added here first, then the library's. */
function machineEntries() {
  const own = [...state.machines.values()].filter((m) => profiles.origins.get(`machines:${m.id}`) !== 'library')
    .map((m) => ({ id: m.id, vendor: 'yours', name: m.name, model: m.name, nozzle: m.nozzle_diameter ?? 0.4, bed: [m.bed.width, m.bed.depth, m.bed.max_z] }));
  const ids = new Set(own.map(m => m.id));
  return [...own, ...(profiles.library?.machines ?? []).filter(m => !ids.has(m.id))]
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }));
}

async function chooseMachine(id) {
  const request = ++machineRequest;
  try {
    if (!(await profiles.useLibrary(id))) throw new Error('this printer is not in the library');
  } catch (e) {
    if (request !== machineRequest) return;
    toast(`Could not load that printer: ${e.message}`);
    return;
  }
  if (request !== machineRequest) return;
  if (state.machine !== id) state.print.layerHeight = defaultLayerHeight(state.machines.get(id));
  state.machine = id;
  normalisePrint();
  renderControls();
  machinePicker?.refresh();
  updateDialogNote();
  schedule();
  commit();
}

function bindMachinePicker() {
  machinePicker = createProfilePicker($('#machine-picker'), {
    entries: machineEntries, selected: () => state.machine, choose: chooseMachine,
    search: (entries, query) => searchMachines(entries, query, [{ id: 'yours', name: 'In this studio' }, ...(profiles.library?.vendors ?? [])]),
    meta: entry => [entry.nozzle ? `${entry.nozzle} mm nozzle` : '', entry.bed ? `${entry.bed[0]} × ${entry.bed[1]} mm` : ''].filter(Boolean).join(' · '),
    empty: 'No printer matches. Try fewer words, or add a profile below.',
  });
  materialPicker = createProfilePicker($('#material-picker'), {
    entries: () => [...state.materials.values()], selected: () => state.material,
    choose: id => {
      machineRequest++;
      if (state.material === id) return;
      state.material = id;
      state.print = withoutFilamentSettings(state.print);
      updateDialogNote();
      schedule();
      commit();
    },
    empty: 'No filament matches. Try fewer words, or add a profile below.',
  });
}

function updateDialogNote() {
  const material = state.materials.get(state.material);
  const machine = state.machines.get(state.machine);
  // Keep actionable import warnings; profile provenance remains in the profile files and exports.
  const notes = [
    ...(machine ? profiles.notesFor('machines', machine.id) : []),
    ...(material ? profiles.notesFor('materials', material.id) : []),
  ].filter(Boolean);
  $('#dialog-note').textContent = notes.join(' ');
  $('#dialog-note').hidden = !notes.length;
  renderProfileList();
  renderFilamentSettings();
}

/** The profiles added here, each with a way to remove it. The ones in the profiles folder go when their file does. */
function renderProfileList() {
  const items = [];
  for (const kind of ['machines', 'materials']) {
    for (const profile of profiles.user[kind]) {
      const remove = el('button', { type: 'button', class: 'link small', text: 'Remove' });
      remove.addEventListener('click', () => {
        machineRequest++;
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
let activeLibraryFilter = 'all';

/** One tile per visible design or quick-start preset. */
function renderTiles() {
  const ranking = new Map(PRINTABILITY.map((p, i) => [p.id, { ...p, rank: i + 1 }]));
  const makeTile = (d) => {
    const ready = d.status === 'ready';
    const planned = d.status === 'planned';
    const shelf = d.shelf ?? designById(d.opens?.design)?.shelf;
    const type = d.status === 'preset' ? 'Quick start' : SHELVES[shelf]?.label;
    const tile = el('button', {
      type: 'button',
      class: planned ? 'design-tile planned' : 'design-tile',
      'data-design': ready ? d.id : false,
      'data-preset-tile': d.status === 'preset' ? d.id : false,
      'data-planned': planned ? d.id : false,
      'data-shelf': shelf ?? '',
      'data-search': `${d.name} ${d.id}`.toLowerCase(),
      'aria-pressed': planned ? false : 'false',
      'aria-disabled': planned ? 'true' : false,
      disabled: planned,
      title: planned ? `${d.name} is coming soon` : `${d.name}: ${d.blurb}`,
    });
    const assessment = ['parquet','truchet','meander','turing'].includes(d.id) ? null : ranking.get(d.id);
    tile.title = `${d.blurb}${assessment ? ` · Estimated printability ${assessment.rank} of ${PRINTABILITY.length}. ${assessment.longestUnsupported.toFixed(1)} mm longest free span; ${assessment.maxSlopeDeg.toFixed(1)}° maximum slope. Default 100 × 100 mm geometry; physical testing pending.` : ''}`;
    const supportLabel = { self: 'Holds itself', auto: '+ backing', 'built-in': 'Built-in carrier', 'needs-backing': 'Needs a backing' }[d.support];
    const stateLabel = d.state === 'needs-repair' ? 'Needs repair' : d.state === 'untested' ? 'Untested' : '';
    const estimate = ready ? estimateLine(CARD_ESTIMATES[d.id]) : '';
    const badges = [supportLabel, stateLabel].filter(Boolean).map((text) => `<span class="design-badge" aria-label="${text}">${text}</span>`).join('');
    tile.innerHTML = `${d.thumb ?? THUMBS[d.id] ?? ''}<span class="design-text"><span class="design-name">${d.name}${planned ? '<span class="soon">Soon</span>' : ''}</span>${type ? `<span class="design-type">${type}</span>` : ''}<span class="design-badges">${badges}</span>${estimate ? `<span class="design-estimate" title="What it prints as at its default 100 × 100 mm">${estimate}</span>` : ''}</span>`;
    if (ready) tile.addEventListener('click', () => setDesign(d.id));
    if (d.status === 'preset') tile.addEventListener('click', () => openPresetTile(d));
    return tile;
  };
  $('#design-list').replaceChildren(...galleryCards().map(makeTile));
  applyDesignFilter();
  renderTilePressed();
}

/** Search narrows the active category without changing the document or current card. */
function applyDesignFilter() {
  const words = $('#design-filter').value.toLowerCase().split(/\s+/).filter(Boolean);
  const tiles = $$('#design-list .design-tile');
  let shown = 0;
  for (const tile of tiles) {
    const match = (activeLibraryFilter === 'all' || tile.dataset.shelf === activeLibraryFilter)
      && words.every(word => tile.dataset.search.includes(word));
    tile.hidden = !match;
    if (match) shown++;
  }
  $('#design-count').textContent = `${shown} of ${tiles.length}`;
  $('#design-filter-none').hidden = shown !== 0;
}

/** The settings object a design keeps its state in (the two older designs keep theirs at the top level). */
function settingsOf(id) {
  if (id === 'loop-pile') return state.primary;
  const mod = designById(id);
  return state.designs[mod?.settingsKey ?? id];
}

/** A preset tile opens another design with some settings changed. */
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
  if(state.regions?.length)return `regions-${regionsFingerprint(state.vector,pieceRegions(),edgeSeam(),state.print)}`;
  const mod = designById(state.design);
  let settings, size, preset = null;
  if (!mod.legacyPanel) {
    settings = state.designs[mod.settingsKey ?? mod.id];
    size = mod.size(settings);
    preset = mod.presetMatch ? mod.presetMatch(settings) : null;
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
  const patternSelected = !state.regions?.length || selectedRegion()?.role === 'pattern';
  $('#btn-reset-inspector').disabled = !patternSelected;
  for (const d of DESIGNS) {
    const panel = $(`#panel-${d.id}`);
    if (panel) panel.hidden = d.id !== state.design;
  }
  const panel = $(`#panel-${state.design}`);
  panel.classList.toggle('drawing-only', !patternSelected);
  const size = panel.querySelector('.size-control');
  const svgSlot = size.querySelector('.size-svg-slot');
  const outside = $('#outside-outline-controls');
  const regionSettings = $('#drawing-region-settings');
  if (svgImportCard.node.parentElement !== svgSlot) svgSlot.append(svgImportCard.node);
  if (outside.parentElement !== size) svgSlot.after(outside);
  if (regionSettings.parentElement !== panel) size.closest('.group').after(regionSettings);
  const drawing = !!state.regions?.length;
  regionSettings.hidden = !drawing;
  const regionToggle = regionSettings.querySelector('.section-fold-toggle');
  if (!drawing && regionToggle.getAttribute('aria-expanded') === 'true') setInspectorSection(regionToggle, false);
  outside.hidden = !drawing;
  size.querySelector('.brim-control .ctl-label').textContent = drawing ? 'Default region outline' : 'Outline';
  size.querySelector('.field-row.brim-control > span').textContent = drawing ? 'Default region outline sits' : 'Outline sits';
  renderOutsideOutline();
  $('#tight-option').hidden = state.design !== 'loop-pile';
  renderExport();
  if (state.design !== 'loop-pile' && state.showTight) setShowTight(false);
}

function renderOutsideOutline() {
  const { count, align } = sanitizeOutsideOutline(state.print.outsideOutline);
  $('#outside-outline-count').value = count;
  $('#outside-outline-align').value = align;
  $('#outside-outline-align').disabled = count === 0;
}

function openDrawingSettings({ focus = false } = {}) {
  const button = $('#drawing-region-settings:not([hidden]) .section-fold-toggle');
  if (!button) return;
  if (button.getAttribute('aria-expanded') === 'false') setInspectorSection(button, true);
  if (focus) button.focus();
}

function setDesign(id, { fromPreset = false, fromVariant = false } = {}) {
  if (!isReady(id)) return;
  if(state.regions?.length){
    const region=selectedRegion()??state.regions.find(r=>r.role==='pattern');
    if(region){regionCard(region.id,id);return;}
    toast('Select a drawing colour first, then choose its design.', { kind:'warning' });return;
  }
  let variantChanged = false;
  if (!fromPreset && !fromVariant) {
    const own = settingsOf(id), next = baseDesignSettings(id, own);
    variantChanged = Object.keys(next).some((key) => next[key] !== own[key]);
    Object.assign(own, next);
  }
  if (state.design === id && !variantChanged) return;
  stopPlay();
  if (!selectVariant(state, id)) return;
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

/* ---------- the picture, as a pattern for any design that offers it ---------- */
/** The picture laid over a width x height mm piece, for a design's pattern (picture.js), or null without one. */
function pictureFor(width, height) {
  return state.image ? { image: state.image.data, size: [width, height], offset: [0, 0] } : null;
}

/** Every pattern set to the picture goes back to its design's own default. True if any did. */
function forgetPictureChoices() {
  let changed = false;
  for (const mod of DESIGNS) {
    if (mod.status !== 'ready') continue;
    const s = settingsOf(mod.id);
    if (s?.pattern !== PICTURE) continue;
    s.pattern = mod.defaults().pattern ?? 'none';
    changed = true;
  }
  for(const region of state.regions??[]){
    if(region.settings?.pattern===PICTURE){region.settings.pattern=designById(region.card)?.defaults().pattern??'none';if(region.settings.pattern===PICTURE)region.settings.pattern='centerSpot';changed=true;}
  }
  return changed;
}

/** Picture contrast: pulls the picture's mid-greys apart, so a picture of close tones gives the design more range. */
function setPictureContrast(value) {
  if (!state.image) return;
  const contrast = Math.round(Math.max(PICTURE_CONTRAST.min, Math.min(PICTURE_CONTRAST.max, Number(value) || 1)) * 10) / 10;
  if (contrast === state.image.contrast) return;
  state.image.contrast = contrast;
  state.image.data = withContrast(state.image.original, contrast);
  state.imageRevision = ++nextImageRevision;
  schedule();
}

function clearPicture() {
  pictureRequest++;
  state.image = null;
  state.imageRevision = ++nextImageRevision;
  state.imageBoxOpen = false;
  forgetPictureChoices();
  renderControls();
  schedule();
  commit();
}

/** The design keeps its longer side and takes the picture's proportions. */
function givePictureShape(designId = state.design) {
  if (!state.image) return;
  const binding = BINDINGS[designId];
  let [w, h] = sizeForAspect(...state.image.px, Math.max(...binding.size.get()));
  // never past the printer's bed: a tall picture on a wide piece is fitted, at its proportions, inside it
  const limits = bedSizeLimits(state.machines.get(state.machine), printOverhang(designId));
  if (w > limits.width || h > limits.height) [w, h] = fitToBed(limits, { w, h });
  binding.size.set(w, h);
  renderSizes();
  renderControls();
  schedule();
  commit();
}

/** The piece as big as this printer prints it, with a small margin; a picture pattern keeps the picture's proportions. */
function fillBed(designId = state.design) {
  const machine = state.machines.get(state.machine);
  const limits = bedSizeLimits(machine, printOverhang(designId));
  const picture = state.image && settingsOf(designId)?.pattern === PICTURE;
  const [w, h] = fitToBed(limits, picture ? { w: state.image.px[0], h: state.image.px[1] } : {});
  BINDINGS[designId].size.set(w, h, 'custom');
  renderSizes();
  renderControls();
  schedule();
  commit();
  toast(`The piece is now ${w} × ${h} mm, the most the ${shortMachine(machine.name)} bed takes${picture ? ' at the picture\'s proportions' : ''}. A big piece takes a while to build and to print.`);
}

/** Turns the picture a quarter turn clockwise; the piece takes its new proportions (unless a drawing sets the size). */
function rotatePicture(designId = state.design) {
  if (!state.image) return;
  const turn = (source, width, height) => {
    const from = document.createElement('canvas');
    from.width = width; from.height = height;
    if (source instanceof HTMLCanvasElement) from.getContext('2d').drawImage(source, 0, 0);
    else from.getContext('2d').putImageData(source, 0, 0);
    const to = document.createElement('canvas');
    to.width = height; to.height = width;
    const ctx = to.getContext('2d');
    ctx.translate(height, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(from, 0, 0);
    return to;
  };
  const { original, thumb } = state.image;
  const turned = turn(original, original.width, original.height);
  state.image.original = turned.getContext('2d').getImageData(0, 0, turned.width, turned.height);
  state.image.data = withContrast(state.image.original, state.image.contrast ?? 1);
  state.image.thumb = turn(thumb, thumb.width, thumb.height);
  state.image.px = [state.image.px[1], state.image.px[0]];
  state.image.rotation = ((state.image.rotation ?? 0) + 90) % 360;
  state.imageRevision = ++nextImageRevision;
  if (!state.vector) givePictureShape(designId);
  else { renderControls(); schedule(); commit(); }
}

function loadPicture(file, designId = 'squiggle', request = ++pictureRequest) {
  if (request !== pictureRequest) return;
  if (!file || !file.type.startsWith('image/')) {
    toast('That is not a picture: use a PNG, JPG or WebP file.');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    if (request !== pictureRequest) return;
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    // kept at up to 1000 pixels across: enough for picture detail on a large garment (a metre is 1 mm a pixel)
    const scale = Math.min(1, 1000 / Math.max(natW, natH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(natW * scale));
    canvas.height = Math.max(1, Math.round(natH * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 112;
    const side = Math.min(natW, natH);
    thumb.getContext('2d').drawImage(img, (natW - side) / 2, (natH - side) / 2, side, side, 0, 0, 112, 112);
    const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.image = { data: original, original, contrast: 1, name: file.name, px: [natW, natH], thumb };
    state.imageRevision = ++nextImageRevision;
    const target = settingsOf(designId);
    if (target) target.pattern = PICTURE;
    state.imageBoxOpen = false;
    // the piece takes the picture's proportions, keeping its longer side, so the picture is not stretched; with a
    // drawing, the drawing sets the size and the picture is laid over it
    if (!state.vector) givePictureShape(designId);
    else { renderControls(); renderSizes(); schedule(); commit(); }
    const [w, h] = BINDINGS[designId].size.get().map((n) => Math.round(n * 10) / 10);
    toast(state.vector ? `Picture fitted to the ${w} × ${h} mm drawing` : `The piece is now ${w} × ${h} mm, the picture's proportions`);
  };
  img.onerror = () => { URL.revokeObjectURL(url); if (request === pictureRequest) toast('That picture could not be opened.'); };
  img.src = url;
}

/* ---------- actions ---------- */
function recordBuildFailure(error, input = null) {
  if (error?.name === 'AbortError') return false;
  $('#btn-error-log').hidden = false;
  const [width, height] = input ? [input.width, input.height] : BINDINGS[state.design].size.get();
  const captured = input ?? {
    design: state.design, width, height, studySettings: { ...settingsOf(state.design) },
    machine: state.machines.get(state.machine), material: printMaterial(), solidLayers: state.print.solidLayers, extraLayers: state.print.extraLayers, brim: state.print.brim, perimeters: state.print.brim, meshPerimeters: state.print.meshPerimeters,
    vector: state.vector, outline: state.outline?.rings,
  };
  const vector = captured.vector, sourcePaths = vector?.paths ?? [];
  const settings = captured.studySettings ?? captured.settings ?? {};
  const recorded = diagnosticLog.record({
    design: captured.design,
    settings: {
      ...settings,
      operation: input?.operation ?? (input ? 'panel' : 'preview'),
      print: { layers: captured.layers, extraLayers: captured.extraLayers, brim: captured.brim, perimeters: captured.perimeters, meshPerimeters: captured.meshPerimeters, layerHeight: captured.material?.print_defaults?.layer_height },
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
  toast('Pattern settings adjusted. Undo restores your previous settings.');
}

/** Changes some of this design's settings as one step that Undo takes back, and rebuilds. */
function applySettingsPatch(patch) {
  commit(); // Preserve the exact starting settings if a control was still being edited.
  Object.assign(settingsOf(state.design), patch);
  syncControls();
  renderControls();
  schedule();
  commit();
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
  const key = buildKey();
  if (!fabric || fabric.exportable || fixJob || state.resultKey !== key || currentBuildError(key)) return;
  const unitOf = (key) => binding.sliders.find((s) => s.key === key)?.unit ?? '';
  const advice = adviceFor(designById(state.design), fabric.issues.join('. '));
  const candidates = fixCandidates(fabric, { sliders: binding.sliders, get: binding.get, range: binding.range });
  if (!candidates.length) { toast(`None of this design's settings is likely to change this.${advice}`, { kind:'warning' }); return; }
  const controller = new AbortController(), before = problemScore(fabric);
  fixJob = { controller, tried: 0, total: candidates.length };
  renderCheck();
  let best = null;
  try {
    for (const candidate of candidates) {
      let score = Infinity;
      try { score = problemScore((await buildWithPatch(candidate.patch, controller.signal)).fabric); }
      catch (error) { if (error.name === 'AbortError') throw error; } // a try that cannot build is not a fix
      if (controller.signal.aborted || buildKey() !== key) throw new DOMException('Stopped', 'AbortError');
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
  if (!best) { renderCheck(); toast(`No small change cleared it.${advice || ' Try a simpler shape or a larger swatch.'}`, { kind:'warning' }); return; }
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
  const error = currentBuildError();
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
        print: { solidLayers: state.print.solidLayers, extraLayers: state.print.extraLayers, brim: state.print.brim, perimeters: state.print.brim, meshPerimeters: state.print.meshPerimeters, layerHeight: printMaterial()?.print_defaults?.layer_height },
        machine: state.machine,
        material: state.material,
        // counts only: the drawing stays on this device
        drawing: state.vector ? { svgPaths: paths.length, svgPoints: paths.reduce((n, p) => n + p.length, 0), width: state.vector.width, height: state.vector.height } : null,
        error: error ? (Array.isArray(error.errors) ? error.errors.join(' ') : String(error.message || error)) : null,
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
  let print = stats?.print ?? { layerHeight: cfg?.t.layer_height, extraLayers: plan?.extraLayers ?? options.extraLayers ?? state.print.extraLayers, nativeLayers: plan?.nativeLayers, totalLayers: plan?.totalLayers, backingLayers: plan?.backingLayers, totalBackingLayers: plan?.totalBackingLayers, brim: options.brim ?? state.print.brim, perimeters: options.perimeters ?? state.print.brim, meshPerimeters: options.meshPerimeters ?? state.print.meshPerimeters, nozzleDiameter: cfg?.t.nozzle_diameter, extrusionWidth: cfg?.t.extrusion_width };
  if (exportType === 'build-error') {
    print = { layerHeight: options.material?.print_defaults?.layer_height ?? state.print.layerHeight, extraLayers: options.extraLayers ?? state.print.extraLayers, brim: options.brim ?? state.print.brim, perimeters: options.perimeters ?? state.print.brim, meshPerimeters: options.meshPerimeters ?? state.print.meshPerimeters };
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
      sources: { svg: !!vector, image: (options.studySettings ?? options.settings ?? settingsOf(options.design ?? state.design))?.pattern === PICTURE && !!(options.image ?? state.image), ...(vector ? { svgPaths: vector.paths.length, svgPoints: vector.paths.reduce((n, p) => n + p.length, 0), svgGuides: interpretDrawing(vector).guides.length, svgSolids: interpretDrawing(vector).solids.length } : {}) },
      panel: { repeat: options.repeat, backingSpacing: options.backingSpacing },
      ...(exportType === 'build-error' ? { error: options.error } : {}),
    },
  });
}

/** The settings an exported file is named after: what a registry design's panel shows, the controls of the two older ones. */
function namedKeys(id) {
  const mod = designById(id), s = settingsOf(id);
  if (!mod.legacyPanel) return relevantKeys(mod, s);
  if (id === 'squiggle') return ['mode', 'shape', ...SQ_SLIDERS.map((d) => d.key), 'pattern', 'colorChange'];
  return [...LOOP_SLIDERS.map((d) => d.key), 'edgeLoops', 'roomy', 'pattern', ...(s.pattern && s.pattern !== 'none' ? ['patternScale'] : [])];
}

/**
 * The name a file is saved under unless the person types another: design, preset, size, the value of every setting and
 * the print setup (src/ui/file-name.js), so a folder of exports shows which designs and looks are printed most.
 */
function exportName(size, panel = false, panelSettings = {}, machine = state.machines.get(state.machine)) {
  if (state.regions?.length && !panel) return [currentSwatch(), printerFileToken(machine), `${size[0]}x${size[1]}mm`].filter(Boolean).join('_') + '.gcode';
  const settings = panel ? { ...settingsOf(state.design), ...panelSettings } : settingsOf(state.design);
  const keys = panel ? [...namedKeys(state.design), 'repeat', 'backingSpacing'] : namedKeys(state.design);
  return exportFileName(designById(state.design), settings, keys, { size, print: state.print, material: state.material, machine, docName: state.docName, panel });
}

function swatchFileName(machine) {
  return exportName(BINDINGS[state.design].size.get(), false, {}, machine);
}

async function exportGcode() {
  if (exporting) return;
  if (requiresApply()) { toast('Apply the whole piece before exporting.'); return; }
  let input;
  const key = buildKey();
  const controller = new AbortController();
  exportController = controller;
  exporting = true;
  try {
    input = structuredClone(exportOptions());
    const code = currentSwatch(), name = swatchFileName(input.machine);
    const title = state.docName.replace(/[\r\n]+/g, ' ');
    const savedPrint = { ...state.print };
    exportLabel = `Preparing ${input.width} × ${input.height} mm…`;
    renderBusy(); renderExport();
    let result;
    let referenceWasVisible = !!(state.result?.referencePreview || overviewTrace?.referencePreview);
    const buildActual = () => buildSwatch(input, { signal: controller.signal, preview: referenceWasVisible && !overviewActive, trace: referenceWasVisible && overviewActive });
    const fullPreview = !genTimer && !previewBuild && state.result && !state.result.referencePreview && !state.result.samplePreview && !currentBuildError(key) && state.resultKey === key && state.result.cfg.t.sample_width === input.width && state.result.cfg.t.sample_height === input.height;
    if (fullPreview) result = state.result;
    else if (readyGcode?.key === key) result = readyGcode.result;
    else if (previewBuild?.key === key) result = await previewBuild.promise;
    else result = await buildActual();
    if (result?.referencePreview) referenceWasVisible = true;
    if (!result || result.referencePreview) result = await buildActual();
    if (controller.signal.aborted || buildKey() !== key) throw new DOMException('The design changed during export.', 'AbortError');
    assertConstructionExportable(result);
    if (referenceWasVisible) {
      referenceResult = null;
      if (!overviewActive && result.moves) showGenerated(result, key);
      else if (result.trace) { overviewTrace = { key, trace: result.trace }; renderPreviewMode(); }
    }
    const moveCount = result.moveCount ?? result.moves?.length ?? 0;
    if (!moveCount) throw new Error('Nothing to print for this design and size.');
    const settings = JSON.stringify({ design: input.design, settings: input.studySettings, regions:input.regions, seam:input.seam, print: { ...savedPrint,
      ...(result.layerPlan ? { extraLayers: result.layerPlan.extraLayers, nativeLayers: result.layerPlan.nativeLayers, totalLayers: result.layerPlan.totalLayers,
        ...(result.layerPlan.mode === 'backing' ? { backingLayers: result.layerPlan.backingLayers, totalBackingLayers: result.layerPlan.totalBackingLayers, textureCopies: 1 } : {}) } : {}) }, machine: input.machine.id, material: input.material.id });
    const text = result.gcode.replace('; Textile G-code generator v1\n', (head) => `${head}; swatch ${code}\n; name ${title}\n; studio settings ${settings}\n`);
    download(name, new Blob([text], { type: 'text/plain' }));
    if (state.buildFailure?.key === key && state.buildFailure.operation === 'export') state.buildFailure = null;
    reportStudyExport('gcode-swatch', { ...input, cfg: result.cfg, moveCount, layerPlan: result.layerPlan }, result.stats);
    printEstimates.put(key, result, input.width, input.height);
    readyGcode = { key, result };
    toast(`Saved ${input.width} × ${input.height} mm: ${name}`);
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted || buildKey() !== key) toast('Export cancelled because the design changed.');
    else {
      state.buildFailure = { key, error, operation: 'export' };
      recordBuildFailure(error, { ...input, operation: 'design-export' });
      toast(`Could not export: ${error.message}`);
    }
  } finally {
    exporting = false;
    exportController = null;
    renderBusy(); render();
  }
}

/** The finished toolpath seen from above as an SVG at true size (see traceToSvg for what it leaves out). */
function exportOverviewSvg() {
  const trace = overviewTraceNow();
  if (!trace) { toast('The print order is still being built.'); return; }
  const [w, h] = BINDINGS[state.design].size.get().map((n) => Math.round(n * 10) / 10);
  const mod = designById(state.design), what = state.regions?.length ? 'Colour regions' : mod.name;
  const svg = traceToSvg(trace, {
    title: `${what}, ${w} × ${h} mm, seen from above`,
    description: `${overviewTrace?.referencePreview ? 'Reference sample: Prusa MK3S / Foamy 95A. ' : ''}FilaFabric ${currentSwatch()}. One unit is one millimetre. Strands are drawn at the width they print; the back of the bed is the top of the page.`,
  });
  const name = swatchFileName().replace(/\.gcode$/i, '.svg');
  download(name, new Blob([svg], { type: 'image/svg+xml' }));
  toast(`Saved ${w} × ${h} mm top view: ${name}`);
}

let variantJob = null;
function drawVariantPreview(result,variants){
  const host=$('#variants-preview'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox',`-2 -2 ${result.width+4} ${result.height+4}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`Top-down overview of ${variants.length} variants on one bed`);
  const colors=['#b44737','#276e69','#a46b25','#566c9a'];
  for(let i=0;i<variants.length;i++){
    const x=result.pieces[i].x,y=result.pieces[i].y,w=result.pieces[i].width,h=result.pieces[i].height;
    const rect=document.createElementNS(svg.namespaceURI,'rect');rect.setAttribute('x',x);rect.setAttribute('y',result.height-y-h);rect.setAttribute('width',w);rect.setAttribute('height',h);rect.setAttribute('fill','none');rect.setAttribute('stroke','currentColor');rect.setAttribute('stroke-dasharray','1.5 1');rect.setAttribute('stroke-width','.25');svg.append(rect);
    const label=document.createElementNS(svg.namespaceURI,'text');label.setAttribute('x',x+w/2);label.setAttribute('y',result.height-y-h-1);label.setAttribute('text-anchor','middle');label.setAttribute('font-size','2.5');label.textContent=variants[i].name;svg.append(label);
    const path=document.createElementNS(svg.namespaceURI,'path');let d='';
    for(const strand of result.strands.filter(s=>s.id.startsWith(`variant-${i+1}-`))){if(strand.pts.length<2)continue;d+=`M ${strand.pts[0].x} ${result.height-strand.pts[0].y}`;for(let k=1;k<strand.pts.length;k++)d+=` L ${strand.pts[k].x} ${result.height-strand.pts[k].y}`;}
    path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',colors[i%colors.length]);path.setAttribute('stroke-width','.45');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);
  }
  host.replaceChildren(svg);
}

async function exportAllVariants(id) {
  if (exporting) return;
  const variants = variantsOf(id);
  if (variants.length < 2) { toast('This design has no printable variants.'); return; }
  const dialog = $('#variants-dialog');
  const controller = new AbortController();
  const job = { controller, phase: 'building', key: null };
  variantJob = job;
  exportController = controller;
  exporting = true;
  const button = $('#variants-download'), status = $('#variants-status'), note = $('#variants-note'), list = $('#variants-list');
  let captured;
  try {
    button.disabled = true;
    list.replaceChildren();
    $('#variants-preview').replaceChildren();
    status.textContent = 'Checking the bed and building each variant…';
    note.textContent = 'Each piece uses the selected printer, filament and print setup.';
    if (!dialog.open) dialog.showModal();
    exportLabel = 'Building comparison set…';
    renderBusy();

    captured = structuredClone(exportOptions());
    const { machine, material } = captured;
    const print = structuredClone(state.print);
    job.key = buildKey();
    const [requestedW, requestedH] = BINDINGS[id].size.get();
    const layout = planVariantLayout({ width: requestedW, height: requestedH, count: variants.length, machine, material,
      overrides: { layer_height: print.layerHeight } });
    const outline = state.regions?.length ? null : placedOutline(layout.width, layout.height);
    const settingsByCard = Object.fromEntries(variants.map(card => [card.id, structuredClone(settingsOf(card.id))]));
    const inputs = variants.map(({ id: design }) => ({ ...captured, design, settings: settingsByCard[design],
      studySettings: settingsByCard[design], width: layout.width, height: layout.height, outline,
      regions: null, vector: null, shapeOutline: false }));

    const results = [];
    for (const [index, card] of variants.entries()) {
      status.textContent = `Building ${index + 1} of ${variants.length}: ${card.name}…`;
      exportLabel = `Building ${card.name} (${index + 1}/${variants.length})…`;
      renderBusy();
      const result = await buildSwatch(inputs[index], { signal: controller.signal, preview: true });
      if (variantJob !== job || controller.signal.aborted || !dialog.open || buildKey() !== job.key) {
        throw new DOMException('Comparison build cancelled.', 'AbortError');
      }
      result.designId = card.id;
      results.push(result);
    }
    const combined = combineVariantResults(results, { machine, material, positions: layout.positions,
      width: layout.totalWidth, height: layout.totalHeight, settings: settingsByCard, print, gap: layout.gap });
    const family = variants[0].variantGroup ?? variants[0].settingsKey ?? variants[0].family;
    const hash = combined.settingsHash, code = `${family}-variants-${hash}`;
    combined.gcode = combined.gcode.replace('; Textile G-code generator v1\n', match => `${match}; swatch ${code}\n`);
    combined.swatchCode = code;
    combined.filename = variantsFileName(family, hash, machine);
    combined.scaled = layout.scaled;
    combined.pieces.forEach((piece, index) => {
      piece.position = [layout.positions[index].x, layout.positions[index].y];
      piece.settings = settingsByCard[piece.card];
    });
    drawVariantPreview(combined, variants);
    const mm = n => Math.round(n * 10) / 10;
    list.replaceChildren(...combined.pieces.map(piece => el('li', { text:
      `${piece.index}. ${variants[piece.index - 1].name} — ${mm(piece.width)} × ${mm(piece.height)} mm at (${mm(piece.x)}, ${mm(piece.y)}) mm · ${piece.settingsHash}` })));
    const size = layout.scaled ? ` at ${layout.width.toFixed(1)} × ${layout.height.toFixed(1)} mm each (scaled down from ${requestedW} × ${requestedH} mm)`
      : ` at ${mm(layout.width)} × ${mm(layout.height)} mm each`;
    status.textContent = `${variants.length} variants fit on one bed${size}.`;
    note.textContent = `One G-code file · ${layout.gap} mm gaps · swatch ${code}. ${layout.scaled ? 'The swatch was reduced proportionally to fit the selected printer.' : ''}`;
    job.phase = 'ready';
    job.result = combined;
    button.disabled = false;
  } catch (error) {
    if (variantJob !== job) return;
    if (error.name === 'AbortError' || controller.signal.aborted || !dialog.open) status.textContent = 'Comparison export cancelled.';
    else {
      status.textContent = `Could not build variants: ${error.message}`;
      recordBuildFailure(error, { ...captured, design: id, operation: 'variants-export' });
    }
    variantJob = null;
  } finally {
    if (exportController === controller) {
      exporting = false;
      exportController = null;
      renderBusy();
      render();
    }
  }
}

function retireVariantJob() {
  const job = variantJob;
  variantJob = null;
  if (job?.phase !== 'building') return;
  job.controller.abort();
  if (exportController === job.controller) {
    exporting = false;
    exportController = null;
    renderBusy();
    render();
  }
}

function downloadVariants(){
  if (variantJob?.phase !== 'ready') return;
  if (variantJob.key !== buildKey()) {
    retireVariantJob();
    $('#variants-download').disabled = true;
    $('#variants-status').textContent = 'The setup changed. Reopen the comparison to build it again.';
    return;
  }
  const result = variantJob.result;
  const record={format:1,swatchCode:result.swatchCode,filename:result.filename,createdAt:new Date().toISOString(),machine:result.cfg.machine.id,material:result.cfg.material.id,dimensions:{width:result.width,height:result.height},pieces:result.pieces.map(({index,card,settingsHash,position,width,height,settings})=>({index,card,settingsHash,position,width,height,settings}))};
  download(result.filename,new Blob([result.gcode],{type:'text/plain'}));
  download(result.filename.replace(/\.gcode$/i,'.swatch.json'),new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
  toast(`Saved ${result.pieces.length} variants${result.scaled?' at the reduced swatch size':''}: ${result.filename}`);
  retireVariantJob();
  $('#variants-dialog').close('export');
}

async function shareLink() {
  const request = ++shareRequest;
  const key = snapshotKey();
  const hash = stateToHash({ ...snapshot(), vector: state.regions?.length ? state.vector : null });
  const url = `${location.origin}${location.pathname}${hash}`;
  if(url.length>32000){toast('This drawing and its regions are too large for a reliable share link. Save a settings file instead; nothing has been truncated.');return;}
  const picture = settingsOf(state.design)?.pattern === PICTURE && !!state.image;
  const note = state.regions?.length ? ' The drawing and all region settings are included.' : state.vector ? ' SVG paths stay in your saved settings file; the link shares the pattern settings.' : picture ? ' Your picture stays on this computer, so the link opens with the centre spot pattern.' : '';
  try {
    await navigator.clipboard.writeText(url);
    if (request !== shareRequest) return;
    toast(`Link copied.${note}`);
  } catch {
    if (request !== shareRequest) return;
    if (snapshotKey() !== key) { toast('The settings changed. Use Share again for this design.'); return; }
    try { history.replaceState(null, '', hash); } catch { /* ignore */ }
    toast(`The address bar now holds the link: copy it from there.${note}`);
  }
}

function saveFile() {
  download(`${slug(state.docName)}-settings.json`, new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
  reportStudyExport('settings-json');
}

async function openFile(file) {
  const request = ++documentRequest;
  const setupRequest = ++machineRequest;
  try {
    const data = JSON.parse(await file.text());
    if (request !== documentRequest) return;
    if (!data || typeof data !== 'object') throw new Error('that is not a settings file');
    if (typeof data.machine === 'string' && setupRequest === machineRequest) await profiles.useLibrary(data.machine).catch(() => null);
    if (request !== documentRequest) return;
    if (setupRequest !== machineRequest) {
      data.machine = state.machine;
      data.material = state.material;
      data.print = { ...withoutFilamentSettings(data.print ?? {}), ...sanitizeFilamentSettings(state.print), layerHeight: state.print.layerHeight };
    }
    applySnapshot(data, { preserveSetupRequest: true });
    commit();
    toast('Settings loaded');
  } catch (e) {
    if (request !== documentRequest) return;
    $('#errors').hidden = false;
    $('#errors').replaceChildren(el('div', { text: `Could not open that file: ${e.message}` }));
  }
}

function resetDesign() {
  documentRequest++;
  const mod = designById(state.design);
  if (!mod.legacyPanel) {
    state.designs[mod.settingsKey ?? mod.id] = mod.defaults();
  } else {
    state.primary = { ...PRIMARY_DEFAULTS };
    state.advanced = {};
  }
  state.checkOpen = null;
  captureRegionSettings();
  syncControls();
  schedule();
  commit();
  toast('This design is back to its defaults. Undo brings your settings back.');
}

function play() {
  const playingResult = overviewActive ? overviewTraceNow() : state.result;
  if (genTimer || !playingResult || playbackSeconds() === null) return;
  if (state.playing) { stopPlay(); renderPlayback(); return; }
  if (state.fraction >= 1) state.fraction = 0;
  state.playing = true;
  lastFrame = performance.now();
  const step = (now) => {
    if (playingResult !== (overviewActive ? overviewTraceNow() : state.result) || playbackSeconds() === null) {
      stopPlay(); renderPlayback(); return;
    }
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

/** Align the menu to its trigger while keeping it inside the viewport. */
function anchorPopover(menu, button) {
  const place = () => {
    const r = button.getBoundingClientRect();
    const width = Math.min(Number.parseFloat(getComputedStyle(menu).width), window.innerWidth - 16);
    const above = r.top - 14;
    const below = window.innerHeight - r.bottom - 14;
    const openAbove = below < 320 && above > below;
    menu.style.top = openAbove ? 'auto' : `${Math.round(r.bottom + 6)}px`;
    menu.style.bottom = openAbove ? `${Math.round(window.innerHeight - r.top + 6)}px` : 'auto';
    menu.style.maxHeight = `${Math.max(0, Math.floor(openAbove ? above : below))}px`;
    menu.style.right = `${Math.max(8, Math.min(window.innerWidth - width - 8, Math.round(window.innerWidth - r.right)))}px`;
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
  const outsideCount = $('#outside-outline-count'), outsideAlign = $('#outside-outline-align');
  const changeOutsideOutline = () => {
    if (outsideCount.value === '' || !outsideCount.validity.valid) { renderOutsideOutline(); return; }
    state.print.outsideOutline = sanitizeOutsideOutline({ count: outsideCount.valueAsNumber, align: outsideAlign.value });
    renderOutsideOutline();
    schedule();
    commit();
  };
  outsideCount.addEventListener('change', changeOutsideOutline);
  outsideAlign.addEventListener('change', changeOutsideOutline);
  $('#preview-full').addEventListener('click', () => { previewChoice = 'full'; schedule(); });
  $('#preview-whole').addEventListener('click', () => { previewChoice = 'overview'; schedule(); });
  $('#preview-detail').addEventListener('click', () => { previewChoice = 'sample'; schedule(); });
  $('#print-fit-printer').addEventListener('click', () => $('#btn-printer').click());
  $('#overview-fit').addEventListener('click', () => overview.fit());
  $('#overview-export-svg').addEventListener('click', exportOverviewSvg);
  const cameraButton = $('#btn-camera');
  const closeCamera = () => {
    closeMenus();
    cameraButton.setAttribute('aria-expanded', 'false');
    cameraButton.focus();
  };
  for (const b of $$('[data-camera]')) {
    b.addEventListener('click', () => {
      for (const o of $$('[data-camera]')) o.setAttribute('aria-pressed', String(o === b));
      preview.setCamera(b.dataset.camera);
      cameraButton.textContent = b.textContent;
      cameraButton.setAttribute('aria-label', `Camera view: ${b.textContent}`);
      closeCamera();
    });
  }
  $('#camera-fit').addEventListener('click', () => { preview.fit(); closeCamera(); });
  const stage = $('#stage');
  const expand = $('#preview-expand');
  if (document.fullscreenEnabled && stage.requestFullscreen) {
    expand.hidden = false;
    expand.addEventListener('click', async () => {
      closeMenus();
      try {
        if (document.fullscreenElement === stage) await document.exitFullscreen();
        else await stage.requestFullscreen();
      } catch { toast('This browser could not expand the preview.'); }
    });
    document.addEventListener('fullscreenchange', () => {
      const expanded = document.fullscreenElement === stage;
      const label = expanded ? 'Exit expanded preview' : 'Expand preview';
      expand.setAttribute('aria-pressed', String(expanded));
      expand.setAttribute('aria-label', label);
      expand.title = label;
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
  initDesignsResizer();
  const libraryFilters = $$('[data-library-filter]');
  for (const button of libraryFilters) button.addEventListener('click', () => {
    activeLibraryFilter = button.dataset.libraryFilter;
    for (const filter of libraryFilters) filter.setAttribute('aria-pressed', String(filter === button));
    applyDesignFilter();
    $('#design-list').scrollTop = 0;
  });
  $('#design-filter').addEventListener('input', applyDesignFilter);
  $('#design-filter').addEventListener('keydown', (event) => { if (event.key === 'Escape' && event.target.value) { event.target.value = ''; applyDesignFilter(); } });
  $('#btn-details').addEventListener('click', () => { state.details = !state.details; renderFigures(); });
  $('#btn-apply').addEventListener('click', () => { if ($('#btn-apply').dataset.mode === 'export') { if (!$('#btn-export').disabled) void exportGcode(); } else void applyPiece(); });
  const toolsDialog = $('#tools-dialog');
  $('#btn-tools').addEventListener('click', () => { closeMenus(); toolsDialog.showModal(); });
  for (const id of ['btn-panel', 'btn-swatch-lab', 'btn-swatch-record']) {
    $(`#${id}`).addEventListener('click', () => toolsDialog.close());
  }
  $('#btn-swatch-record').addEventListener('click',()=>{
    const input=exportOptions(),code=currentSwatch();
    const record=swatchRecord({code,card:state.regions?.length?'colour regions':state.design,settings:state.regions??settingsOf(state.design),machine:state.machine,material:state.material,width:input.width,height:input.height,print:state.print,construction:state.resultKey===buildKey()?state.result?.construction:null});
    download(`${code}.md`,new Blob([record],{type:'text/markdown'}));
  });
  const variantsDialog = $('#variants-dialog');
  $('#variants-cancel').addEventListener('click', () => { retireVariantJob(); variantsDialog.close('cancel'); });
  $('#variants-download').addEventListener('click', downloadVariants);
  variantsDialog.addEventListener('cancel', retireVariantJob);
  variantsDialog.addEventListener('close', () => { if (!variantsDialog.open) retireVariantJob(); });
  $('#btn-share').addEventListener('click', shareLink);
  $('#btn-advanced').addEventListener('click', () => openAdvanced($('#advanced-body').hidden));
  $('#doc-name').addEventListener('input', (e) => { state.docName = e.target.value; });
  $('#doc-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  anchorPopover($('#more-menu'), $('#btn-more'));
  anchorPopover($('#camera-menu'), cameraButton);
  anchorPopover($('#view-menu'), $('#btn-view'));
  // Getting started is the guided tour, on the real controls
  $('#btn-help').addEventListener('click', () => { closeMenus(); tour.start(); });
  // what is counted lives inside the studio, behind the password, not on a page of its own that a search engine could find
  document.querySelectorAll('[data-open-study]').forEach((button) => button.addEventListener('click', () => $('#study-dialog').showModal()));
  feedback = bindFeedback($('#feedback-dialog'), { context: feedbackContext, toast });
  $('#btn-feedback').addEventListener('click', () => feedback.open());
  $('#btn-save-file').addEventListener('click', () => { closeMenus(); saveFile(); });
  $('#btn-error-log').addEventListener('click', () => { closeMenus(); saveErrorLog(); });
  $('#btn-reset-inspector').addEventListener('click', resetDesign);
  $('#file-open').addEventListener('change', (e) => {
    closeMenus();
    if (e.target.files[0]) openFile(e.target.files[0]);
    e.target.value = '';
  });

  const dialog = $('#printer-dialog');
  $('#btn-printer').addEventListener('click', () => { fillDialogSelects(); dialog.showModal(); });
  dialog.querySelector('button[value="close"]').addEventListener('click', () => dialog.close('close'));
  bindMachinePicker();
  // a printer or filament profile as the slicers export it: PrusaSlicer .ini or sliced .gcode, Bambu Studio .json
  $('#profile-file').addEventListener('change', async (e) => {
    const request = ++machineRequest;
    const files = [...e.target.files];
    e.target.value = '';
    const reads = await Promise.allSettled(files.map(file => file.text()));
    if (request !== machineRequest) return;
    for (const [index, read] of reads.entries()) {
      const file = files[index];
      try {
        if (read.status === 'rejected') throw read.reason;
        const got = profiles.add(read.value, file.name);
        if (got.machines[0]) { state.machine = got.machines[0].id; state.print.layerHeight = defaultLayerHeight(got.machines[0]); }
        if (got.materials[0]) { state.material = got.materials[0].id; state.print = withoutFilamentSettings(state.print); }
        toast(`Added ${[...got.machines.map((m) => `${m.name} (printer)`), ...got.materials.map((m) => `${m.name} (filament)`)].join(' and ')}`);
      } catch (err) {
        toast(`${file.name}: ${err.errors?.[0] ?? err.message}`);
      }
    }
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

  document.addEventListener('filafabric:themechange', () => { for (const c of controls) c.redraw(); });

}

export async function init() {
  await loadProfiles();
  preview = createPreview($('#preview'));
  overview = createOverview($('#overview'), text => { overviewStatus = text; if (overviewActive) renderPreviewMode(); });
  svgImportCard = new SvgImportCard(host);
  controls.push(svgImportCard);
  studyRecorder = createStudyRecorder($('#study-notice'), { allowed: () => statsAllowed() });
  const privacy = bindPrivacyNotice($('#privacy-banner'), { onChange: () => studyRecorder.refresh(), openFeedback: () => feedback?.open(), toast });
  $('#btn-privacy').addEventListener('click', () => { $('#tools-dialog').close(); privacy.open(); });

  // start from: a shared link, then the last session, then the defaults
  const fromLink = hashToState(location.hash);
  let initial = fromLink;
  if (!initial) {
    try { initial = JSON.parse(store.get(STORAGE_KEY) ?? 'null'); } catch { initial = null; }
    // a refresh is a clean start: only the printer setup survives it (printer, filament, its temperatures and other
    // filament settings, layer height); the design, its sizes, an imported drawing and every slider go back to the
    // defaults. A shared link or a settings file still opens exactly what it holds.
    if (initial) initial = printerSetupOnly(initial);
  }
  // a page that is opened (not a shared link) lands on the zigzag mesh, whatever was open last; what was set in the
  // other designs is kept for when they are chosen
  if (initial && !fromLink) initial.design = 'zigzag';
  if (initial && !fromLink) for (const [id, oldHub] of [['web', 3], ['rosette', 4], ['spirograph', 4], ['sunflower', 3]]) {
    const settings = initial.designs?.[id];
    if (settings && !settings.hubStyle && settings.hub === oldHub) settings.hub = 0.6;
  }
  // cards whose defaults moved to the standard weight open at it: what this browser saved for them is dropped, once
  if (initial && !fromLink && initial.densityRevision !== DENSITY_REVISION) {
    for (const id of RETUNED_CARDS) delete initial.designs?.[designById(id)?.settingsKey ?? id];
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
  foldRemainingSections();
  fillDialogSelects();
  renderTiles();
  bindStatic();
  bindSwatchLab({button:$('#btn-swatch-lab'),options:exportOptions,download,toast});
  bindPanelExport({
    options: exportOptions,
    machines: () => state.machines, machineId: () => state.machine,
    setupSummary,
    openSetup: () => $('#btn-printer').click(),
    panelAvailable: () => designById(state.design).panel !== false,
    download, filename: (w, h, repeat, backingSpacing, machine) => exportName([w, h], true, { repeat, backingSpacing }, machine), toast,
    onExport: (options, stats) => reportStudyExport('gcode-panel', options, stats),
    onError: (error, input) => recordBuildFailure(error, input),
    onDownloadErrorLog: saveErrorLog,
  });
  new TooltipLayer();
  showDesign();
  $('#doc-name').value = state.docName;
  regenerate();
  commit();
  requestAnimationFrame(() => {
    void studyRecorder.init();
    tour.offer();
  });
  if (pictureDropped && fromLink) toast('This link was made with a picture, which links can\'t carry, so it opens with the centre spot pattern.', { kind:'warning' });
}
