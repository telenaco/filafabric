import { validNumber } from './numeric.js';
// The few creative controls people see, and how they map onto engine parameters.
// Pure functions: no DOM, so they are tested in Node like the engine.
import { DEFAULT_TEXTILE } from '../engine/params.js';
import { airStrandDiameter } from '../engine/extrusion.js';
import { FIELD_IDS, createField } from '../engine/fields.js';

export const RANGES = Object.freeze({
  pileHeight: { min: 1, max: 6, step: 0.5 },
  loopSize: { min: 0.6, max: 1.4, step: 0.1 },
  loopSpacing: { min: 0.8, max: 6, step: 0.1 },
  baseGap: { min: 0.8, max: 10, step: 0.1 },
  variation: { min: 0, max: 100, step: 10 },
  airFlow: { min: 80, max: 200, step: 5 },
  customWidth: { min: 10, max: 1000, step: 5 },
  customHeight: { min: 10, max: 1000, step: 5 },
  patternScale: { min: 0.5, max: 2, step: 0.25 },
});

export const PRIMARY_DEFAULTS = Object.freeze({
  swatch: 'full', // 'test' | 'full' | 'custom'
  customWidth: 100,
  customHeight: 100,
  pileHeight: 3, // mm of lift
  loopSize: 1, // 1 = 6 x 15 mm
  loopSpacing: 3, // mm between loop centres
  roomy: false, // false: leg gap 0.6 / clearance 1.0; true: 1.5 / 0.5
  baseGap: 5, // mm between base lines (and rows)
  variation: 0, // 0 = off, 100 = full amplitudes
  airFlow: 100, // % flow for the strands in the air (rising, falling, free-hanging)
  edgeLoops: false, // garment samples keep the entire pile inside their boundary
  pattern: 'none', // a pattern field that raises some loops and lowers others ('none': every loop the same height)
  patternScale: 1, // stretches the pattern across the fabric
});

// every base swatch is 100 x 100 mm (the older 'test' and 'mid' names are kept so saved settings still open)
export const SWATCH_SIZES = Object.freeze({ test: [100, 100], mid: [100, 100], full: [100, 100] });

/** Amplitudes reached at 100 % variation; editable under Advanced. */
export const ADVANCED_DEFAULTS = Object.freeze({
  amp_length: 1.5,
  amp_width: 0.5,
  amp_lift: 0.6,
  amp_xy: 0.6,
  amp_orientation: 8,
  amp_spacing: 0.4,
});

/** Engine parameters owned by the primary controls; Advanced can never override these. */
export const PRIMARY_KEYS = Object.freeze([
  'sample_width', 'sample_height', 'loop_z_lift', 'loop_width', 'loop_length', 'loop_pitch',
  'leg_gap', 'clearance', 'base_spacing', 'random_enabled', 'flow_nonplanar', 'flow_unsupported', 'boundary_policy',
]);

const SWATCHES = ['test', 'mid', 'full', 'custom'];
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const trim = (n) => String(r1(n));

export function sampleSize(primary) {
  if (primary.swatch === 'custom') return [primary.customWidth, primary.customHeight];
  return [...(SWATCH_SIZES[primary.swatch] ?? SWATCH_SIZES.test)];
}

/** Primary controls + advanced overrides -> engine textile parameters. Primary always wins. */
export function toTextile(primary, advanced = {}) {
  const [w, h] = sampleSize(primary);
  const f = Math.max(0, Math.min(1, primary.variation / 100));
  const out = { ...advanced };
  for (const key of PRIMARY_KEYS) delete out[key];
  Object.assign(out, {
    sample_width: w,
    sample_height: h,
    loop_z_lift: primary.pileHeight,
    loop_width: r1(6 * primary.loopSize),
    loop_length: r1(15 * primary.loopSize),
    loop_pitch: primary.loopSpacing,
    leg_gap: primary.roomy ? 1.5 : 0.6,
    clearance: primary.roomy ? 0.5 : 1.0,
    base_spacing: primary.baseGap,
    random_enabled: f > 0,
    flow_nonplanar: primary.airFlow,
    flow_unsupported: primary.airFlow,
    // a loop extends one loop length past its feet: 'feet-only' keeps the rows rooted on the last lines
    boundary_policy: primary.edgeLoops ? 'feet-only' : 'footprint',
  });
  for (const key of Object.keys(ADVANCED_DEFAULTS)) out[key] = r3((advanced[key] ?? ADVANCED_DEFAULTS[key]) * f);
  return out;
}

/** Coerce anything (a shared link, a saved file) into valid primary controls. */
export function sanitizePrimary(raw) {
  const out = { ...PRIMARY_DEFAULTS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, range] of Object.entries(RANGES)) {
    const n = Number(raw[key]);
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '' && validNumber(key, n, range)) {
      out[key] = n;
    }
  }
  if (SWATCHES.includes(raw.swatch)) out.swatch = raw.swatch;
  if (typeof raw.roomy === 'boolean') out.roomy = raw.roomy;
  if (typeof raw.edgeLoops === 'boolean') out.edgeLoops = raw.edgeLoops;
  if (raw.pattern === 'none' || FIELD_IDS.includes(raw.pattern)) out.pattern = raw.pattern;
  return out;
}

/** How much neighbouring loops in a row overlap, as a whole percentage of the loop width (0 when they don't). */
export function overlapPercent(primary) {
  const width = 6 * primary.loopSize;
  return Math.max(0, Math.round((1 - primary.loopSpacing / width) * 100));
}

/** Plain-language read-outs shown beside the sliders. */
export function describePrimary(primary) {
  const overlap = overlapPercent(primary);
  return {
    pileHeight: `${trim(primary.pileHeight)} mm`,
    loopSize: `${trim(6 * primary.loopSize)} × ${trim(15 * primary.loopSize)} mm`,
    loopSpacing: `${trim(primary.loopSpacing)} mm apart`,
    overlap: overlap > 0 ? `${overlap}% overlap` : 'loops don\'t touch',
    baseGap: `${trim(primary.baseGap)} mm`,
    variation: primary.variation === 0 ? 'Off' : `${primary.variation}%`,
    airFlow: primary.airFlow === 100 ? 'Standard flow' : `${primary.airFlow > 100 ? '+' : '−'}${Math.abs(primary.airFlow - 100)}% flow`,
    roomy: primary.roomy ? '1.5 mm at the feet' : '0.6 mm at the feet',
    edgeLoops: primary.edgeLoops ? `overhangs ${trim(15 * primary.loopSize)} mm` : 'fits inside',
    patternScale: `${r3(primary.patternScale)}×`,
  };
}

/**
 * The pile-height factor a pattern gives each loop: 0.3 where the field is 0 and 1 where it is 1, so no loop
 * vanishes. Null when no pattern is chosen (every loop keeps the pile height).
 */
export function pileLiftFactor(primary) {
  if (!primary.pattern || primary.pattern === 'none') return null;
  const field = createField(primary.pattern, { scale: primary.patternScale });
  return (x, y) => 0.3 + 0.7 * field(x, y);
}

/**
 * Expected thickness (mm) of a free-hanging strand once it has foamed, for the read-out beside the slider.
 * Null while a typed Advanced value is not a number yet.
 */
export function airStrandMm(primary, advanced, material) {
  const t = { ...DEFAULT_TEXTILE, ...toTextile(primary, advanced) };
  const freeDiameter = t.free_strand_diameter ?? t.nozzle_diameter;
  const d = airStrandDiameter('unsupported', { t, material, derived: { freeDiameter } });
  return Number.isFinite(d) && d > 0 ? d : null;
}

/**
 * A width x height with the given proportions (width / height), keeping the width where it can and staying
 * inside the ranges, for "Match its shape".
 */
export function fitAspect(width, aspect, ranges) {
  const clampTo = (n, r) => Math.min(r.max, Math.max(r.min, Math.round(n)));
  if (!(aspect > 0)) return [width, width];
  let w = clampTo(width, ranges.w);
  let h = w / aspect;
  if (h > ranges.h.max || h < ranges.h.min) {
    h = clampTo(h, ranges.h);
    w = clampTo(h * aspect, ranges.w);
  }
  return [w, clampTo(h, ranges.h)];
}
