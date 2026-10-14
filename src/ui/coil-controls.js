// The Coil design's controls: ranges, defaults, sanitising, presets and read-outs.
// Pure functions: no DOM, so they are tested in Node like the engine.
import { SHAPE_IDS, loopsClose } from '../engine/shapes.js';
import { FIELD_IDS, createField } from '../engine/fields.js';

export const COIL_RANGES = Object.freeze({
  width: { min: 10, max: 240, step: 5 },
  height: { min: 10, max: 200, step: 5 },
  size: { min: 1.5, max: 6, step: 0.5 },
  pitch: { min: 3, max: 14, step: 0.5 },
  rowOverlap: { min: 0, max: 60, step: 5 },
  lift: { min: 0.1, max: 0.6, step: 0.05 },
  patternScale: { min: 0.5, max: 2, step: 0.25 },
});

export const COIL_SHAPES = SHAPE_IDS;

/** 'none' (every loop the same size) plus the pattern fields. */
export const COIL_PATTERNS = Object.freeze(['none', ...FIELD_IDS]);

export const COIL_DEFAULTS = Object.freeze({
  shape: 'looped',
  width: 50,
  height: 50,
  size: 3, // mm: how far the strand swings to each side (the loop radius)
  pitch: 5, // mm along the row per loop
  rowOverlap: 25, // percent: how far each row reaches into the one before
  lift: 0.25, // mm: how far a strand lifts where it lies over another
  pattern: 'none',
  patternScale: 1,
});

/** Named variants of the structure: one click, the same controls. */
export const COIL_PRESETS = Object.freeze([
  { id: 'open-chain', name: 'Open chain', blurb: 'Separate loops, rows only touching', patch: { shape: 'looped', size: 3, pitch: 8, rowOverlap: 0 } },
  { id: 'overlapping', name: 'Overlapping', blurb: 'Loops and rows lie on each other', patch: { shape: 'looped', size: 3, pitch: 5, rowOverlap: 30 } },
  { id: 'dense', name: 'Dense', blurb: 'Small, packed loops', patch: { shape: 'looped', size: 2.5, pitch: 4, rowOverlap: 50 } },
]);

const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;

/** Coerce anything (a shared link, a saved file) into valid coil settings. */
export function sanitizeCoil(raw) {
  const out = { ...COIL_DEFAULTS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, range] of Object.entries(COIL_RANGES)) {
    const n = Number(raw[key]);
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '' && Number.isFinite(n)) {
      out[key] = Math.min(range.max, Math.max(range.min, n));
    }
  }
  if (COIL_SHAPES.includes(raw.shape)) out.shape = raw.shape;
  if (COIL_PATTERNS.includes(raw.pattern)) out.pattern = raw.pattern;
  return out;
}

/** The preset whose settings the coil currently has, or null once it has been changed. */
export function presetMatch(coil) {
  for (const p of COIL_PRESETS) {
    if (Object.entries(p.patch).every(([k, v]) => coil[k] === v)) return p.id;
  }
  return null;
}

/** Plain-language read-outs shown beside the sliders. */
export function describeCoil(c) {
  let overlap;
  if (c.shape !== 'looped') overlap = c.shape === 'figure8' ? 'a chain of figure-8s' : `a plain ${c.shape}`;
  else if (loopsClose(c.pitch, c.size)) overlap = 'loops close up';
  else {
    const pct = Math.round(Math.max(0, 1 - c.pitch / (2 * c.size)) * 100);
    overlap = pct > 0 ? `loops overlap ${pct}%` : 'loops do not touch';
  }
  return {
    size: `${r1(c.size)} mm loops`,
    pitch: `${r1(c.pitch)} mm apart`,
    overlap,
    rowOverlap: c.rowOverlap > 0 ? `${c.rowOverlap}% into the row above` : 'rows just touch',
    lift: `${r2(c.lift)} mm`,
    patternScale: `${r2(c.patternScale)}×`,
  };
}

/** Engine parameters for generateCoil: percent becomes a fraction and the pattern becomes a sampler. */
export function coilParams(c, { outline = null } = {}) {
  return {
    width: c.width,
    height: c.height,
    shape: c.shape,
    size: c.size,
    pitch: c.pitch,
    rowOverlap: c.rowOverlap / 100,
    lift: c.lift,
    sampler: c.pattern === 'none' ? null : createField(c.pattern, { scale: c.patternScale }),
    outline,
  };
}
