// How much filament a card puts on a 100 x 100 mm sheet when it opens.
//
// A sheet far lighter than this is a net too open to hold as fabric, and cards of very different weight cannot be compared: the
// grams a card shows are about proportional to its print time (extrusion is nearly all of it), so a library whose cards run
// from 0.2 g to 5 g gives no way to choose. Luis set the standard on 28 October 2026 from the Wave net, Square-wave net, Figure-8 net
// and Zigzag mesh, which weigh 1.13 to 1.17 g: every card opens at about 1.2 g, within a tenth either way. dev/tests/density.test.js
// holds the Flat shelf to it, and dev/tools/tune-density.mjs finds the setting that reaches it.
export const TARGET_GRAMS = 1.2;
export const TOLERANCE = 0.1;
export const GRAMS_BAND = Object.freeze([TARGET_GRAMS * (1 - TOLERANCE), TARGET_GRAMS * (1 + TOLERANCE)]);

/** Cards that cannot reach the band, and why. The test lists them, so an exception is a decision someone made. */
export const DENSITY_EXCEPTIONS = Object.freeze({
  'zigzag-flat': 'Luis chose its settings himself (4 mm apart, 4 mm each way, 12 mm per wave) for a loose first layer that takes a backing: both families together weigh about 0.83 g, the first layer alone about 0.42 g.',
  'turing-flat': 'The stripes come from a reaction-diffusion simulation whose finest stripe is about 4 mm wide, set by the size of its grid; below that the slider changes nothing. Reaching 1.2 g needs a simulation four times finer (about ten seconds a rebuild).',
});

/**
 * The size settings that give a card its weight: `set` replaces the card's defaults, and every preset's value for the same settings
 * is scaled by the same factor, so a preset keeps its character (a broad cell stays broader than a close one) at the new weight.
 * `keep` lists presets left as they are; `patches` sets values on a preset after the scaling (for a preset whose weight the scaling cannot
 * carry, such as a dotted tour limited by its dot count); `blurbs` rewrites a preset's one-line description to match; `coprime` names two
 * whole-number settings (a Lissajous curve's a and b) that must stay coprime.
 */
export const FLAT_DENSITY = Object.freeze({
  'rings-flat': { set: { ringSize: 4.5 } },
  'voronoi-cells': { set: { spacing: 1.7 } },
  // Luis's own settings for the flat zigzag (28 October 2026): 4 mm apart, 4 mm each way, 12 mm per wave
  'zigzag-flat': { set: { spacing: 4, depth: 4, wavelength: 12 } },
  'connected-lace': { set: { scale: 3.5 } },
  'auxetic-flat': { set: { rowPitch: 1.7, period: 2.5, amplitude: 0.5 } },
  // the struts of a honeycomb are the row pitch less twice the cell depth: below about 1.7 mm a row apart there are none
  'honeycomb-planar': { set: { rowPitch: 1.9, period: 1.5, amplitude: 0.5 } },
  'starlattice-flat': { set: { size: 2.5 } },
  'harmonograph-flat': { set: { a: 22, b: 19 }, coprime: ['a', 'b'], blurbs: { fine: 'Twenty-two by nineteen, small diamond cells', coarse: 'Thirteen by ten, larger diamonds', lens: 'Nine by seven, a looser curve' } },
  'coil-flat': { set: { pitch: 2.7 } },
  'figure8-rows-flat': { set: { pitch: 3 } },
  'truchet-flat': { set: { size: 1.4 } },
  // the dotted tour is limited by its dot count (about 1,500), so its cell stays at the smallest that allows; the open meander is half as fine
  'meander-flat': { set: { cell: 0.8 }, patches: { stipple: { cell: 2.7 }, open: { cell: 1.6 } } },
  'parquet-flat': { set: { block: 6.6, spacing: 1.6 } },
  'boucle-flat': { set: { size: 1.2, pitch: 2.4, rowPitch: 2.1 } },
});

/**
 * The cards whose defaults moved to the standard weight, and the revision of that move. What a visitor had saved for them is dropped once
 * (when the saved session has an older densityRevision), so they open at the new weight instead of the old settings; a shared link keeps
 * its own settings, because a link means exactly the design that was shared. Raise the revision when more cards move.
 */
export const DENSITY_REVISION = 1;
export const RETUNED_CARDS = Object.freeze([
  ...Object.keys(FLAT_DENSITY),
  'rotating-squares', 'rotating-triangles', 'arrowhead-band', 'spiral-cells', 'stochastic-net', 'connected-lace', 'meander-ties', 'kirigami', 'star-metric', 'isohedral-tiles',
]);

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const onGrid = (value, step) => Math.round(value / step + 1e-9) * step;

function retune({ defaults, ranges = {}, presets = [], sanitize }, { set, keep = [], patches = {}, blurbs = {}, coprime = null }) {
  const factors = Object.fromEntries(Object.keys(set).filter((key) => Number(defaults[key]) > 0).map((key) => [key, set[key] / defaults[key]]));
  const scaled = (key, value) => {
    const range = ranges[key], step = range?.step ?? 0.1;
    let next = onGrid(value * factors[key], step);
    if (range) next = Math.max(range.min, Math.min(range.max, next));
    return +next.toFixed(4);
  };
  const tuned = presets.map((preset) => {
    if (keep.includes(preset.id)) return preset;
    const patch = { ...preset.patch };
    for (const key of Object.keys(factors)) if (typeof patch[key] === 'number') patch[key] = scaled(key, patch[key]);
    if (coprime && patch[coprime[0]] && patch[coprime[1]]) while (gcd(patch[coprime[0]], patch[coprime[1]]) > 1) patch[coprime[1]] += 1;
    Object.assign(patch, patches[preset.id]);
    return { ...preset, ...(blurbs[preset.id] ? { blurb: blurbs[preset.id] } : {}), patch };
  });
  return {
    defaults: { ...defaults, ...set },
    presets: tuned,
    // what is missing from a saved setting takes the new default, not the old one
    sanitize: (raw) => sanitize({ ...set, ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) }),
    presetMatch: (s) => tuned.find((preset) => Object.entries(preset.patch).every(([key, value]) => s[key] === value))?.id ?? null,
  };
}

/** A settings definition (defineControls) with its defaults and presets retuned. */
export function retuneC(c, options) {
  const out = retune(c, options);
  return { ...c, defaults: Object.freeze(out.defaults), presets: out.presets, sanitize: out.sanitize, presetMatch: out.presetMatch };
}

/** A card that is not built from a settings definition (its own defaults(), presets and sanitize), retuned the same way. */
export function retuneCard(card, options) {
  const out = retune({ defaults: card.defaults(), ranges: card.ranges, presets: card.presets, sanitize: card.sanitize }, options);
  return { ...card, defaults: () => ({ ...out.defaults }), presets: out.presets, sanitize: out.sanitize, presetMatch: out.presetMatch };
}

/** A card definition for layered() with the settings of its Flat-shelf weight, when it has one. */
export function withDensity(def) {
  const options = FLAT_DENSITY[def.id];
  return options && def.c && !def.defaults ? { ...def, c: retuneC(def.c, options) } : def;
}
