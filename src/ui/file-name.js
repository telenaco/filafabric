// The name an exported file is saved under: the design, the preset it started from, the size, then the value of every
// setting that shapes it, and last the print setup. A folder of exported files then says by itself which designs, and
// which looks of them, are printed most:
//
//   coil_overlapping_100x100mm_shape-looped_size3_pitch5_overlap30_lift0.25_pattern-none_scale1_brim2_lh0.2_extra0_filaflex-95-foamy.gcode
//
// Tokens are joined by "_". A number follows its setting's name (pitch5, lift0.25), anything else comes after a hyphen
// (shape-looped), and a switch is named only while it is on (twoColours-on). The demo prints
// (tools/export-demo-prints.mjs) are named the same way. Pure: no DOM.

/** Short, readable names for the settings whose own names are long; every other setting keeps its own name. */
export const SHORT = {
  designPattern: 'fill', designSpacing: 'fillSp', designAngle: 'fillAng',
  backing: 'backing', backingArea: 'area',
  backing1Pattern: 'b1', backing1Spacing: 'b1Sp', backing1Angle: 'b1Ang',
  backing2Pattern: 'b2', backing2Spacing: 'b2Sp', backing2Angle: 'b2Ang',
  patternScale: 'scale', rowOverlap: 'overlap', rowPitch: 'rowPitch', colorChange: 'twoColours',
};

/** Filename stem budget (the extension is additional). Long names retain a digest of omitted settings. */
export const MAX_NAME = 150;

/** The settings of a registry design that matter for its current choices, in the order its panel shows them. */
export function relevantKeys(mod, s) {
  const keys = [];
  for (const c of mod.controls ?? []) {
    if (typeof c.when === 'function' && !c.when(s)) continue;
    if (c.kind === 'choice' || c.kind === 'shape') keys.push(c.key);
    else if (c.kind === 'sliders') for (const item of c.items) keys.push(item.key);
    else if (c.kind === 'pattern') { keys.push(c.key); if (c.scale) keys.push(c.scale.key); }
    else if (c.kind === 'switch' && s[c.key]) keys.push(c.key);
  }
  return [...new Set(keys)];
}

/** Keep exact numeric values, including typed precision; a switch that is on is written as "on". */
export const showValue = (v) => (v === true ? 'on' : String(v));

/** One setting as a token: pitch5, shape-looped, twoColours-on. `label` is the name it goes under. */
export function settingToken(key, value, label = SHORT[key] ?? key) {
  return `${label}${typeof value === 'number' ? '' : '-'}${showValue(value)}`;
}

/** Encode each token before joining: an underscore inside a profile ID must not become a delimiter. */
const clean = (token) => encodeURIComponent(String(token).toWellFormed()).replace(/[!'()*_]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// A deterministic 64-bit FNV-1a identifier, for distinguishing shortened names rather than authentication.
function digest(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}

/** Shorten without cutting a percent escape or a Unicode code point; retain a distinguishing identifier. */
function shorten(token, max) {
  if (token.length <= max) return token;
  const suffix = `-h${digest(token)}`;
  let prefix = '';
  for (const c of decodeURIComponent(token)) {
    const next = clean(c);
    if (prefix.length + next.length + suffix.length > max) break;
    prefix += next;
  }
  return prefix + suffix;
}

/**
 * @param head  tokens that always lead: [design file prefix, preset or "custom", "100x100mm", ...]
 * @param s     the settings the keys are read from
 * @param keys  the settings to name, in order; a setting that is off, unset or empty is left out
 * @param tail  tokens that always close it (print setup, filament, the swatch's own name); empty ones are skipped
 */
export function settingsFileName({ head, s, keys, tail = [] }, { max = MAX_NAME, ext = '.gcode' } = {}) {
  let list = keys.filter((k) => s[k] !== undefined && s[k] !== null && s[k] !== false && s[k] !== '');
  const starts = head.map(clean), ends = tail.filter(Boolean).map((token) => shorten(clean(token), 64));
  const identity = digest(JSON.stringify([head, [...list].sort().map((key) => [key, s[key]]), tail]));
  let omitted = false;
  // a short name that is also another setting of the design (Flow lines has its own "scale") gives way to the full one
  const label = (k) => (SHORT[k] && SHORT[k] !== k && keys.includes(SHORT[k]) ? k : SHORT[k] ?? k);
  const build = () => [...starts, ...list.map((k) => clean(settingToken(k, s[k], label(k)))), ...(omitted ? [`h-${identity}`] : []), ...ends].join('_');
  // Missing zero-angle tokens mean zero. Keep the existing demo names that already used this shorthand.
  if (build().length > max) list = list.filter((k) => !(/angle$/i.test(k) && s[k] === 0));
  // Pattern scale has no effect while its pattern is off; the existing Meander demo omits this trailing token.
  if (build().length > max && s.pattern === 'none') list = list.filter((k) => k !== 'patternScale');
  while (build().length > max && list.length) { list = list.slice(0, -1); omitted = true; }
  while (build().length > max) {
    const tokens = [...starts, ...ends], longest = tokens.reduce((best, token, i) => token.length > tokens[best].length ? i : best, 0);
    if (tokens[longest].length <= 18) break;
    const shortened = shorten(tokens[longest], Math.max(18, tokens[longest].length - (build().length - max)));
    if (longest < starts.length) starts[longest] = shortened;
    else ends[longest - starts.length] = shortened;
  }
  // Tiny custom budgets may not even hold design/size/print tokens. The normal 150/180 budgets keep them readable.
  const stem = build();
  return `${stem.length <= max ? stem : `h-${identity}`.slice(0, Math.max(0, max))}${ext}`;
}

/** "Untitled swatch" is the name every swatch starts with; only a name someone gave it goes into the file name. */
export function ownName(docName) {
  const slug = String(docName ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug && slug !== 'untitled-swatch' ? shorten(slug, 40) : '';
}

/** Whether every named setting still has the design's default value (a swatch that started from no preset). */
export function untouched(keys, s, defaults) {
  return keys.every((k) => s[k] === defaults[k]);
}

/**
 * The name the studio saves a swatch or a panel under.
 * @param design  { file, presetMatch?, defaults() } (a registry entry, or one of the two hand-built designs)
 * @param s       its settings
 * @param keys    the settings to name (relevantKeys for a registry design)
 * @param size    [w, h] in mm of what is exported
 * @param print   { layerHeight, extraLayers, brim } (legacy layers is also accepted), material: the filament id, docName: the swatch's name, panel: a full panel
 */
export function exportFileName(design, s, keys, { size, print, material, docName = '', panel = false }) {
  if (panel) s = { ...s, colorChange: false };
  const preset = (design.presetMatch ? design.presetMatch(s) : null) ?? (untouched(keys, s, design.defaults()) ? 'default' : 'custom');
  const mm = (n) => String(n);
  const head = [design.file, preset, `${mm(size[0])}x${mm(size[1])}mm`, panel ? 'panel' : ''].filter(Boolean);
  const count = Object.hasOwn(print, 'extraLayers') ? `extra${print.extraLayers}` : `layers${print.layers}`;
  const tail = [...(print.meshPerimeters !== undefined ? [`meshOutlines${print.meshPerimeters}`] : []), ...(print.solidLayers !== undefined ? [`solid${print.solidLayers}`] : []), print.perimeters !== undefined ? `perimeters${print.perimeters}` : `brim${print.brim ?? 2}`, `lh${showValue(print.layerHeight)}`, count, material, ownName(docName)];
  return settingsFileName({ head, s, keys, tail }, { max: 180 });
}

const SIZE_TOKEN = /^(\d+(?:\.\d+)?(?:e[+-]?\d+)?)x(\d+(?:\.\d+)?(?:e[+-]?\d+)?)mm$/i;
const NUMBER_TOKEN = /^([A-Za-z][A-Za-z0-9]*?)(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/i;

/**
 * Reads a name made by exportFileName (or a demo print's) back into what it says, or null when it is not one: the
 * design, the preset, the size, whether it is a panel, each named setting (by its name in the file, as text), the print
 * setup and the filament. A name someone typed over in the Export dialog is not read.
 */
export function parseFileName(name) {
  let tokens;
  try { tokens = String(name).replace(/\.gcode$/i, '').split('_').map(decodeURIComponent); }
  catch { return null; }
  if (/^\d{2}$/.test(tokens[0])) tokens = tokens.slice(1); // a demo print's number
  const [design, preset, size] = tokens;
  const dims = SIZE_TOKEN.exec(size ?? '');
  if (!design || !preset || !dims) return null;
  let i = 3;
  const panel = tokens[i] === 'panel';
  if (panel) i++;
  const settings = {};
  let layerHeight = null, layers = null, extraLayers = null, solidLayers = null, perimeters = null, meshPerimeters = null, brim = null, material = null, swatchName = null, settingsDigest = null;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^meshOutlines\d+$/.test(t) && /^(?:solid[1-8]|brim\d+|perimeters\d+)$/.test(tokens[i + 1] ?? '')) { meshPerimeters = Number(t.slice(12)); continue; }
    if (/^solid[1-8]$/.test(t) && /^(?:brim\d+|perimeters\d+|lh\d)/.test(tokens[i + 1] ?? '')) { solidLayers = Number(t.slice(5)); continue; }
    if (/^h-[0-9a-f]{16}$/.test(t)) { settingsDigest = t.slice(2); continue; }
    if (/^perimeters\d+$/.test(t) && /^lh\d+(\.\d+)?$/.test(tokens[i + 1] ?? '') && /^(?:layers|extra)\d+$/.test(tokens[i + 2] ?? '')) { perimeters = Number(t.slice(10)); brim = perimeters; continue; }
    // Brim precedes the height/count pair, leaving legacy material IDs such as 'brim2' unambiguous.
    if (/^brim\d+$/.test(t) && /^lh\d+(\.\d+)?$/.test(tokens[i + 1] ?? '') && /^(?:layers|extra)\d+$/.test(tokens[i + 2] ?? '')) { brim = Number(t.slice(4)); continue; }
    if (/^lh\d+(\.\d+)?$/.test(t) && /^(?:layers|extra)\d+$/.test(tokens[i + 1] ?? '')) {
      layerHeight = Number(t.slice(2));
      const count = tokens[i + 1];
      if (count.startsWith('extra')) extraLayers = Number(count.slice(5));
      else layers = Number(count.slice(6));
      material = tokens[i + 2] ?? null;
      swatchName = tokens[i + 3] ?? null;
      break;
    }
    const dash = t.indexOf('-');
    const number = NUMBER_TOKEN.exec(t);
    if (number) settings[number[1]] = number[2];
    else if (dash > 0) settings[t.slice(0, dash)] = t.slice(dash + 1);
  }
  return { design, preset, size: [Number(dims[1]), Number(dims[2])], panel, settings, layerHeight, layers, ...(solidLayers !== null ? { solidLayers } : {}), ...(extraLayers !== null ? { extraLayers } : {}), ...(perimeters !== null ? { perimeters } : {}), ...(meshPerimeters !== null ? { meshPerimeters } : {}), brim, material, swatchName, ...(settingsDigest ? { settingsDigest } : {}) };
}
