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
  svgdesign: 'Weight depends on the imported drawing, its stroke widths and filled areas. The empty-card estimate contains only the carrier; tuning that to 1.2 g would not normalize a real drawing.',
  'rotated-stack': 'The three-plane construction and Lu-derived gap range are retained. At the widest gap (2 times strand width) it is about 2.38 g; reaching 1.2 g would require a different layer count or a gap beyond the source range.',
  conformal: 'Denser hole-map lines are pruned by the existing geometry pipeline: a spacing sweep from 0.8 to 1.8 mm peaks near 1.06 g, then loses material. The default uses that peak; repairing the mapping is separate from tuning its weight.',
  'auxetic-star': 'This new source-geometry study retains Kabir\'s approximately 15.24 mm cell diagonal for the first comparison prints; it was added after the Flat weight pass and has not been density-normalized.',
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

// Layered constructions retain their native passes. Carrier settings are retuned before the common Support wrapper is built.
export const LAYERED_DENSITY = Object.freeze({
  weave: { set: { pitch: 1.7 } },
  spiral: { set: { spacing: 1.3 } },
  boucle: { set: { size: 1.8, pitch: 3.6, rowPitch: 3.1 } },
  crosshatch: { set: { spacing: 1.7 } },
  auxetic: { set: { rowPitch: 2.4, period: 3, amplitude: 0.75 } },
  'honeycomb-flat': { set: { rowPitch: 1.8, period: 2.5, amplitude: 0.5 } },
  web: { set: { spacing: 1.1, spokes: 48 } },
  chainmail: { set: { spacing: 9, ringSize: 13.5, overlap: 4.5 } },
  meander: { set: { cell: 2.2, spacing: 1.9, backingDepth: 0.7, backingLength: 3.5 }, patches: { stipple: { cell: 2.7 } } },
  harmonograph: { set: { a: 22, b: 17 }, coprime: ['a', 'b'] },
  truchet: { set: { size: 2.7 } },
  voronoi: { set: { spacing: 4.1 } },
  'rotated-stack': { set: { gapFactor: 2 }, keep: ['wearable', 'open-60', 'fine-45'] },
  'moire-net': { set: { pitchA: 1.7, pitchDiff: 0.08 } },
  turing: { set: { spacing: 1.3, backingDepth: 0.5, backingLength: 3 } },
  'step-lace': { set: { spacing: 5.7, tieLength: 11.5, tieDepth: 6.3 } },
  scales: { set: { pitch: 4, gap: 2, scaleLayers: 1, carrier: 'net' } },
  'lace-backing': { set: { scale: 5, spacing: 1.5 } },
  conformal: { set: { spacing: 1.5 } },
  sunflower: { set: { spacing: 1.8 } },
  rosette: { set: { spacing: 1.7, depth: 0.6 } },
  flowlines: { set: { spacing: 1.7 } },
  bubbles: { set: { size: 5.5 } },
  parquet: { set: { block: 10.6, spacing: 2.7 } },
  spirograph: { set: { spacing: 2.8 } },
  starlattice: { set: { size: 2.5 } },
});

/**
 * The cards whose defaults moved to the standard weight, and the revision of that move. What a visitor had saved for them is dropped once
 * (when the saved session has an older densityRevision), so they open at the new weight instead of the old settings; a shared link keeps
 * its own settings, because a link means exactly the design that was shared. Raise the revision when more cards move.
 */
export const DENSITY_REVISION = 2;
export const RETUNED_CARDS = Object.freeze([
  ...Object.keys(FLAT_DENSITY),
  ...Object.keys(LAYERED_DENSITY),
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
