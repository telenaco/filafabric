// Controls for the newer structures (Relief, Fringe, Bouclé, Spiral, Weave): ranges, defaults, sanitising, presets and
// read-outs, built from one small description each. Pure: no DOM, so it is tested in Node like the engine.

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
export { r1, r2 };

/**
 * @param ranges    { key: { min, max, step } } for every number, including width and height
 * @param defaults  every setting with its default
 * @param enums     { key: [allowed values] } for choices (a value outside the list falls back to the default)
 * @param bools     keys that are on/off switches
 * @param presets   [{ id, name, blurb, patch }] named variants
 * @param describe  (settings) => { key: 'plain-language read-out' }
 */
export function defineControls({ ranges, defaults, enums = {}, bools = [], presets = [], describe }) {
  const frozen = Object.freeze({ ...defaults });
  const sanitize = (raw) => {
    const out = { ...frozen };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [key, range] of Object.entries(ranges)) {
      const n = Number(raw[key]);
      if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '' && Number.isFinite(n)) {
        out[key] = Math.min(range.max, Math.max(range.min, n));
      }
    }
    for (const [key, allowed] of Object.entries(enums)) if (allowed.includes(raw[key])) out[key] = raw[key];
    for (const key of bools) if (typeof raw[key] === 'boolean') out[key] = raw[key];
    return out;
  };
  const presetMatch = (s) => {
    for (const p of presets) if (Object.entries(p.patch).every(([k, v]) => s[k] === v)) return p.id;
    return null;
  };
  return { ranges: Object.freeze(ranges), defaults: frozen, sanitize, presets, presetMatch, describe };
}

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };

export const RELIEF_CONTROLS = defineControls({
  ranges: { ...SIZE, relief: { min: 0.5, max: 3, step: 0.25 }, rowPitch: { min: 2, max: 6, step: 0.5 }, patternScale: { min: 0.25, max: 2, step: 0.05 } },
  defaults: { width: 50, height: 50, relief: 2, rowPitch: 3, pattern: 'bumps', patternScale: 0.5 },
  presets: [
    { id: 'seersucker', name: 'Seersucker', blurb: 'Fine puckered stripes', patch: { pattern: 'stripes', patternScale: 0.3, relief: 1, rowPitch: 2.5 } },
    { id: 'bobbles', name: 'Bobbles', blurb: 'Round bumps', patch: { pattern: 'bumps', patternScale: 0.5, relief: 2.5, rowPitch: 3 } },
    { id: 'pleats', name: 'Pleats', blurb: 'Broad ridges', patch: { pattern: 'stripes', patternScale: 0.8, relief: 2, rowPitch: 3 } },
  ],
  describe: (s) => ({ relief: `${r2(s.relief)} mm`, rowPitch: `${r1(s.rowPitch)} mm apart`, patternScale: `${r2(s.patternScale)}×` }),
});

export const FRINGE_CONTROLS = defineControls({
  ranges: { ...SIZE, length: { min: 6, max: 25, step: 1 }, lift: { min: 0.5, max: 5, step: 0.5 }, spacing: { min: 2, max: 8, step: 0.5 }, rowGap: { min: 3, max: 10, step: 0.5 }, variation: { min: 0, max: 100, step: 10 } },
  defaults: { width: 50, height: 50, length: 15, lift: 3, spacing: 4, rowGap: 5, variation: 0 },
  presets: [
    { id: 'fringe', name: 'Fringe', blurb: 'Even, medium hairs', patch: { length: 15, lift: 3, spacing: 4, rowGap: 5, variation: 0 } },
    { id: 'shag', name: 'Shag', blurb: 'Long and uneven', patch: { length: 25, lift: 4, spacing: 3, rowGap: 6, variation: 40 } },
    { id: 'fine-pile', name: 'Fine pile', blurb: 'Short and close', patch: { length: 8, lift: 1.5, spacing: 2.5, rowGap: 3.5, variation: 0 } },
  ],
  describe: (s) => ({
    length: `${r1(s.length)} mm`,
    lift: `${r1(s.lift)} mm`,
    spacing: `${r1(s.spacing)} mm apart`,
    rowGap: `${r1(s.rowGap)} mm`,
    variation: s.variation === 0 ? 'Off' : `${s.variation}%`,
  }),
});

export const BOUCLE_CONTROLS = defineControls({
  ranges: { ...SIZE, size: { min: 2, max: 8, step: 0.5 }, pitch: { min: 5, max: 16, step: 0.5 }, rowPitch: { min: 4, max: 16, step: 0.5 }, lift: { min: 0.1, max: 0.6, step: 0.05 }, patternScale: { min: 0.5, max: 2, step: 0.25 } },
  defaults: { width: 50, height: 50, size: 4, pitch: 8, rowPitch: 7, lift: 0.25, pattern: 'none', patternScale: 1 },
  presets: [
    { id: 'picot-trim', name: 'Picot trim', blurb: 'Small rings, wide rows', patch: { size: 3, pitch: 6, rowPitch: 8 } },
    { id: 'boucle', name: 'Bouclé', blurb: 'Big rings on every row', patch: { size: 5, pitch: 8, rowPitch: 7 } },
    { id: 'curls', name: 'Curls', blurb: 'Small, packed rings', patch: { size: 3, pitch: 5, rowPitch: 5 } },
  ],
  describe: (s) => ({ size: `${r1(s.size)} mm rings`, pitch: `${r1(s.pitch)} mm apart`, rowPitch: `${r1(s.rowPitch)} mm apart`, lift: `${r2(s.lift)} mm`, patternScale: `${r2(s.patternScale)}×` }),
});

export const SPIRAL_CONTROLS = defineControls({
  ranges: { ...SIZE, spacing: { min: 1.5, max: 8, step: 0.5 } },
  defaults: { width: 50, height: 50, spacing: 3, second: 'none', colorChange: false },
  enums: { second: ['none', 'normals'] },
  bools: ['colorChange'],
  presets: [
    { id: 'tight', name: 'Tight', blurb: 'Rings close together', patch: { spacing: 2, second: 'none' } },
    { id: 'standard', name: 'Standard', blurb: 'A moderate gap', patch: { spacing: 3, second: 'none' } },
    { id: 'open', name: 'Open', blurb: 'Airy, wide gaps', patch: { spacing: 5, second: 'none' } },
    { id: 'normals', name: 'With normals', blurb: 'Rings crossed at right angles', patch: { spacing: 3, second: 'normals' } },
  ],
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart` }),
});

export const WEAVE_CONTROLS = (bindingIds) => defineControls({
  ranges: { ...SIZE, pitch: { min: 2.5, max: 8, step: 0.5 } },
  defaults: { width: 50, height: 50, pitch: 4, binding: 'plain' },
  enums: { binding: bindingIds },
  describe: (s) => ({ pitch: `${r1(s.pitch)} mm between lines` }),
});
