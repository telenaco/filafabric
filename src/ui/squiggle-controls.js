// The Squiggle & Gyroid design's controls: ranges, defaults, sanitising and read-outs.
// Pure functions: no DOM, so they are tested in Node like the engine.

export const SQ_RANGES = Object.freeze({
  width: { min: 10, max: 240, step: 5 },
  height: { min: 10, max: 200, step: 5 },
  spacing: { min: 1.5, max: 6, step: 0.5 },
  amplitude: { min: 0.4, max: 3, step: 0.1 },
  wavelength: { min: 2, max: 10, step: 0.5 },
});

import { SHAPE_IDS } from '../engine/shapes.js';
import { FIELD_IDS } from '../engine/fields.js';
import { DEFAULT_SIDE } from './structure-controls.js';

export const SQ_MODES = Object.freeze(['cross', 'parallel']);

/** How each line wanders: the sine wave it always was, or a shape from the strand-shape library. */
export const SQ_SHAPES = SHAPE_IDS;

/** Procedural patterns plus 'image' (a picture the person drops in; it never travels in a link). */
export const SQ_PATTERNS = Object.freeze(['centerSpot', 'gradientX', 'gradientY', 'waves', 'uniform', ...FIELD_IDS, 'image']);

export const SQUIGGLE_DEFAULTS = Object.freeze({
  mode: 'cross',
  shape: 'wave',
  width: DEFAULT_SIDE,
  height: DEFAULT_SIDE,
  pattern: 'centerSpot',
  spacing: 2.5, // mm between neighbouring wavy lines
  amplitude: 1.2, // mm of side-to-side swing
  wavelength: 4, // mm per full wave
  colorChange: false, // M600 pause between the two layers
});

const r1 = (n) => Math.round(n * 10) / 10;

/** Coerce anything (a shared link, a saved file) into valid squiggle settings. */
export function sanitizeSquiggle(raw) {
  const out = { ...SQUIGGLE_DEFAULTS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, range] of Object.entries(SQ_RANGES)) {
    const n = Number(raw[key]);
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '' && Number.isFinite(n)) {
      out[key] = Math.min(range.max, Math.max(range.min, n));
    }
  }
  if (SQ_MODES.includes(raw.mode)) out.mode = raw.mode;
  if (SQ_SHAPES.includes(raw.shape)) out.shape = raw.shape;
  if (SQ_PATTERNS.includes(raw.pattern)) out.pattern = raw.pattern;
  if (typeof raw.colorChange === 'boolean') out.colorChange = raw.colorChange;
  return out;
}

/** Plain-language read-outs shown beside the sliders. */
export function describeSquiggle(s) {
  return {
    spacing: `${r1(s.spacing)} mm apart`,
    amplitude: `${r1(s.amplitude)} mm`,
    wavelength: `${r1(s.wavelength)} mm`,
  };
}

/**
 * A swatch size that keeps a picture's proportions, with the long side at `longSide` mm.
 * Clamped to the ranges, so a very thin picture still gives a printable strip.
 */
export function sizeForAspect(pixelWidth, pixelHeight, longSide = 80) {
  if (!(pixelWidth > 0) || !(pixelHeight > 0)) return [SQUIGGLE_DEFAULTS.width, SQUIGGLE_DEFAULTS.height];
  const aspect = pixelWidth / pixelHeight;
  const clampW = (n) => Math.max(15, Math.min(SQ_RANGES.width.max, Math.round(n)));
  const clampH = (n) => Math.max(15, Math.min(SQ_RANGES.height.max, Math.round(n)));
  return aspect >= 1 ? [clampW(longSide), clampH(longSide / aspect)] : [clampW(longSide * aspect), clampH(longSide)];
}
