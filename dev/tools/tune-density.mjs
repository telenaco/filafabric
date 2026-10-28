// Finds the size settings that give a card the standard weight (1.2 g of filament on a 100 x 100 mm sheet, see site/src/ui/density.js).
// Each card's scale settings are multiplied by one factor, the factor is searched until the sheet weighs the target, and what comes
// out is printed next to what the card has now, with whether it still builds. The result is what goes in FLAT_DENSITY (or in the card's
// own defaults).
// Run: node dev/tools/tune-density.mjs [shelf] [id,id|all] [grams]     (a few minutes for a whole shelf)
import fs from 'node:fs';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { TARGET_GRAMS } from '../../site/src/ui/density.js';

const profile = (kind, id) => JSON.parse(fs.readFileSync(new URL(`../../site/profiles/${kind}/${id}.json`, import.meta.url)));
const machine = profile('machines', 'prusa-mk3s'), material = profile('materials', 'filaflex-95-foamy');
const [shelf = 'flat', onlyArg = 'all', targetArg = String(TARGET_GRAMS)] = process.argv.slice(2);
const only = onlyArg === 'all' ? null : onlyArg.split(','), TARGET = Number(targetArg);

// keys: the settings that set a card's scale (all multiplied by one factor); floor: the smallest each may be (what the engine builds)
// slope: the exponent g ~ factor^slope to start the search from; extra: settings that follow the factor in some other way
const KNOBS = {
  'rings-flat': { keys: ['ringSize'], floor: { ringSize: 3 } },
  'rotating-squares': { keys: ['cell'], floor: { cell: 2.5 } },
  'rotating-triangles': { keys: ['cell'], floor: { cell: 1.5 } },
  'arrowhead-band': { keys: ['cellHeight'], floor: { cellHeight: 3 }, extra: (f) => ({ columns: Math.max(1, Math.round(4 / f)) }) },
  'spiral-cells': { keys: ['cell'], floor: { cell: 4 }, extra: () => ({ twist: 3.8 }) },
  'voronoi-cells': { keys: ['spacing'], floor: { spacing: 1.2 } },
  'stochastic-net': { keys: ['density'], slope: 0.5, floor: { density: 0.01 } },
  'connected-lace': { keys: ['scale'], floor: { scale: 3 } },
  'meander-ties': { keys: ['cell'], floor: { cell: 0.8 } },
  kirigami: { keys: ['spacing'], floor: { spacing: 0.4 } },
  'star-metric': { keys: ['cell'], floor: { cell: 2.5 } },
  'isohedral-tiles': { keys: ['scale'], floor: { scale: 1 } },
  'auxetic-flat': { keys: ['rowPitch', 'period', 'amplitude'], floor: { rowPitch: 0.8, period: 1.5, amplitude: 0.5 } },
  'honeycomb-planar': { keys: ['rowPitch', 'period', 'amplitude'], floor: { rowPitch: 0.8, period: 1.5, amplitude: 0.5 } },
  'starlattice-flat': { keys: ['size'], floor: { size: 0.8 } },
  'harmonograph-flat': { keys: [], slope: 1, extra: (f) => ({ a: Math.round(7 * f), b: Math.round(6 * f) }) },
  'coil-flat': { keys: ['pitch'], floor: { pitch: 0.8 } },
  'figure8-rows-flat': { keys: ['pitch'], floor: { pitch: 0.8 } },
  'truchet-flat': { keys: ['size'], floor: { size: 0.8 } },
  'meander-flat': { keys: ['cell'], floor: { cell: 0.8 } },
  'parquet-flat': { keys: ['block', 'spacing'], floor: { block: 1.05, spacing: 0.8 } },
  'boucle-flat': { keys: ['size', 'pitch', 'rowPitch'], floor: { size: 0.8, pitch: 0.8, rowPitch: 0.8 } },
};

const stepOf = (card, key) => card.ranges?.[key]?.step ?? 0.1;
const apply = (card, base, spec, f) => {
  const settings = { ...base };
  for (const key of spec.keys) {
    const step = stepOf(card, key);
    const value = Math.max(spec.floor?.[key] ?? 0, base[key] * f);
    settings[key] = +(Math.round(value / step) * step).toFixed(4);
  }
  return Object.assign(settings, spec.extra?.(f, settings) ?? {});
};
const evaluate = (card, settings) => {
  const sized = { ...settings };
  if (card.setSize) card.setSize(sized, 100, 100); else Object.assign(sized, { width: 100, height: 100 });
  try {
    const result = card.generate(machine, material, sized, {});
    return { g: result.stats.filamentGrams, ok: result.fabric?.exportable !== false, strokes: result.strands.length };
  } catch (error) { return { error: error.message.slice(0, 70) }; }
};

for (const card of DESIGNS.filter((c) => c.status === 'ready' && !c.hidden && c.shelf === shelf && KNOBS[c.id] && (!only || only.includes(c.id)))) {
  const spec = KNOBS[card.id], base = card.defaults(), first = evaluate(card, base);
  let factor = 1, grams = first.g, slope = spec.slope ?? -1, best = { ...first, factor: 1, settings: base };
  const history = [{ factor, grams }];
  for (let i = 0; i < 9 && !first.error; i++) {
    if (history.length >= 2) {
      const [a, b] = history.slice(-2), m = Math.log(b.grams / a.grams) / Math.log(b.factor / a.factor);
      if (Number.isFinite(m) && Math.abs(m) > 0.1) slope = m;
    }
    const next = factor * Math.pow(TARGET / grams, 1 / slope), settings = apply(card, base, spec, next), result = evaluate(card, settings);
    if (result.error) break;
    factor = next; grams = result.g; history.push({ factor, grams });
    if (result.ok && Math.abs(result.g - TARGET) < Math.abs(best.g - TARGET)) best = { ...result, factor, settings };
    if (Math.abs(result.g / TARGET - 1) < 0.03) break;
  }
  const keys = [...spec.keys, ...Object.keys(spec.extra?.(best.factor, base) ?? {})];
  console.log(`${card.id.padEnd(20)} ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, base[k]])))} -> ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, best.settings[k]])))}  ${first.g?.toFixed(2)} g -> ${best.g?.toFixed(2)} g  exportable ${best.ok}`);
}
