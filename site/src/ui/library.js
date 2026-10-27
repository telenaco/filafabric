/**
 * Permanent card IDs reserved for the whole plan. Names change; IDs do not.
 * | Plan ID | Card ID | Name | Notes |
 * |---|---|---|---|
 * | F-01 | `rings-flat` | Rings · flat | new; settingsKey `rings` |
 * | F-02 | `honeycomb-flat` | Honeycomb · flat | from `auxetic` with `cell: 'hexagon'`; settingsKey `honeycomb` |
 * | F-03 | `auxetic` | Re-entrant (bow-tie) | existing ID |
 * | F-04 | `starlattice` | Star lattice | existing |
 * | F-05 | — | *withdrawn* | the same as L-08 (see the plan's §5.1); do not use the ID `isogrid-flat` |
 * | F-06 | `rotating-squares` | Rotating squares | new |
 * | F-07 | `rotating-triangles` | Rotating triangles | new |
 * | F-08 | `arrowhead-band` | Arrowhead band | new |
 * | F-09 | `spiral-cells` | Spiral cells | new |
 * | F-10 | `stochastic-net` | Stochastic net | new |
 * | F-11 | `star-metric` | Star-metric cells | new |
 * | F-12 | `isohedral-tiles` | Isohedral tiles | new |
 * | F-13 | `connected-lace` | Connected lace | new |
 * | F-14 | `meander-ties` | Meander with ties | new |
 * | F-15 | `voronoi-cells` | Voronoi cells | new |
 * | F-16 | `coil` | Looped rows | existing ID |
 * | F-17 | `figure8-rows` | Figure-8 rows | new ID, Coil generator |
 * | F-18 | `harmonograph` | Harmonograph | existing |
 * | F-19 | `kirigami` | Kirigami sheet | new |
 * | L-01 | `squiggle` | Wave net | existing ID; settingsKey `wave` |
 * | L-02 | `zigzag` | Zigzag net | existing ID |
 * | L-03 | `square-net` | Square-wave net | new ID, Squiggle generator |
 * | L-04 | `honeycomb-layered` | Honeycomb · layered | new ID, Squiggle generator; settingsKey `honeycomb` |
 * | L-05 | `figure8-net` | Figure-8 net | new ID, Squiggle generator |
 * | L-06 | `chainmail` | Rings · layered | existing ID; comparison group `rings` (card-specific geometry settings) |
 * | L-07 | `bubbles` | Bubbles | existing |
 * | L-08 | `crosshatch` | Grid & isogrid · layered | existing ID; settingsKey `grid` |
 * | L-09 | `rotated-stack` | Rotated stack | new |
 * | L-10 | `moire-net` | Moiré net | new |
 * | L-11 … L-18 | `voronoi`, `web`, `sunflower`, `rosette`, `spirograph`, `conformal`, `flowlines`, `spiral` | unchanged names | existing |
 * | L-19 | `weave` | Woven draft | existing ID |
 * | L-20, L-21 | `truchet`, `parquet` | unchanged | existing |
 * | L-22, L-23 | `meander`, `turing` | unchanged | existing |
 * | L-24 | `svgdesign` | Your drawing | existing ID |
 * | L-25 | `lace-backing` | Lace + backing | new |
 * | L-26 | `step-lace` | Step, ripple and petal lace | new |
 * | L-27 | `paired-loops` | Paired loops | new |
 * | L-28 | `scales` | Scales on a carrier | new |
 * | L-29 | `boucle` | Bouclé & picots | existing |
 * | R-01 | `rings-raised` | Rings · raised | new; settingsKey `rings` |
 * | R-02 … R-04 | `loop-pile`, `relief`, `dipweave` | unchanged | existing |
 * | R-05 | `looped-net` | Looped net | new ID, Squiggle generator |
 * | R-06 … R-08 | `fringe`, `spacer`, `pillarweave` | unchanged | existing |
 * | R-09 | `grid-lifted` | Grid · lifted crossings | new; settingsKey `grid` |
 * | R-10 | `grid-sliding` | Grid · sliding channels | new; settingsKey `grid` |
 * | R-11 | `wave-bridged` | Wave net · bridged crossings | new; settingsKey `wave` |
 * | R-12 | `corrugation` | Corrugation | new |
 * | R-13 | `colour-exposure` | Colour exposure texture | new |
 * | (hidden) | `squiggle-rings`, `squiggle-zigzag`, `coil-shapes`, `halftone` | legacy only | open old links exactly (T1.2, T1.3, T1.4, T1.5) |
 */
import { DESIGNS } from './designs.js';
import { sanitizeSupport } from '../engine/backing.js';

/** Old IDs and setting variants that can be routed to a currently implemented card. */
export const MIGRATIONS = Object.freeze([
  ...DESIGNS.filter((card) => card.status === 'ready').flatMap((card) => (card.legacy ?? []).map((rule) => Object.freeze({ from: rule.id, to: card.id, patch: rule.patch ?? null }))),
  { from: 'zigzag-mesh', to: 'squiggle-zigzag', patch: { mode: 'parallel' } },
]);

/** Converts an older persisted state to schema v4 before its values are sanitised. */
export function migrateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const migrated = { ...raw, designs: { ...(raw.designs && typeof raw.designs === 'object' && !Array.isArray(raw.designs) ? raw.designs : {}) } };
  if (raw.primary && typeof raw.primary === 'object' && !migrated.designs['loop-pile']) migrated.designs['loop-pile'] = { ...raw.primary };
  if (raw.squiggle && typeof raw.squiggle === 'object' && !migrated.designs.squiggle) migrated.designs.squiggle = { ...raw.squiggle };
  if (raw.v === 3) {
    const convertColour = (settings) => settings && typeof settings === 'object' && settings.colorChange === true
      ? { ...settings, colourMode: 'face', colorChange: false } : settings;
    migrated.primary = convertColour(raw.primary);
    migrated.squiggle = convertColour(raw.squiggle);
    for (const [id, settings] of Object.entries(migrated.designs)) migrated.designs[id] = convertColour(settings);
    migrated.v = 4;
  }
  // Old global meshes are folded into one carrier on auto cards, never appended to one.
  const backing = raw.print?.backing;
  if (backing) for (const card of DESIGNS.filter(d => d.status === 'ready' && d.support === 'auto')) {
    const key = card.settingsKey ?? card.id, current = migrated.designs[key] ?? migrated.designs[card.id] ?? {};
    if (!current.support) migrated.designs[key] = { ...current, support: sanitizeSupport({ ...(typeof backing === 'object' ? backing : {}), style: 'zigzag', layers: 2, angle: 0, openness: typeof backing === 'object' ? backing.spacing ?? 3.7 : 3.7, wavelength: typeof backing === 'object' ? backing.wavelength ?? 6 : 6, order: 'motif-first' }) };
  }
  if (migrated.design === 'squiggle') {
    let source = migrated.designs.wave ?? migrated.designs.squiggle ?? migrated.squiggle ?? {};
    if (source.colourMode === 'face' && source.colorChange !== true) source = { ...source, colorChange: true };
    const target = ({ wave: 'squiggle', square: 'square-net', honeycomb: 'honeycomb-layered', figure8: 'figure8-net', looped: 'looped-net', ring: 'squiggle-rings', zigzag: 'squiggle-zigzag' })[source.shape] ?? 'squiggle';
    const card = DESIGNS.find((entry) => entry.id === target);
    const key = card?.settingsKey ?? target;
    migrated.design = target;
    migrated.designs[key] = { ...source, shape: card?.shape ?? 'wave' };
  }
  if (migrated.design === 'coil') {
    const source = migrated.designs.coil ?? {};
    const target = source.shape === 'figure8' ? 'figure8-rows'
      : ['wave', 'zigzag', 'square', 'honeycomb', 'ring'].includes(source.shape) ? 'coil-shapes' : 'coil';
    migrated.design = target;
    migrated.designs[target] = { ...source, shape: target === 'coil' ? 'looped' : source.shape };
  }
  if (migrated.design === 'auxetic' && migrated.designs.auxetic?.cell === 'hexagon') {
    migrated.design = 'honeycomb-flat';
    migrated.designs['honeycomb-flat'] = { ...migrated.designs.auxetic, cell: 'hexagon' };
  }
  if (migrated.design === 'crosshatch' && Number(migrated.designs.crosshatch?.size ?? 0) > 0) {
    migrated.design = 'crosshatch-wavy';
    migrated.designs['crosshatch-wavy'] = { ...migrated.designs.crosshatch };
  }
  const rule = MIGRATIONS.find((entry) => entry.from === migrated.design);
  if (rule) {
    const current = migrated.designs[rule.from] ?? migrated.designs[rule.to] ?? {};
    migrated.design = rule.to;
    migrated.designs[rule.to] = { ...current, ...(rule.patch ?? {}) };
  }
  if (raw.geometryRevision !== 2 && ['truchet','meander','turing'].includes(migrated.design)) {
    const original=migrated.design;
    migrated.design=`${original}-legacy`;
    migrated.designs[migrated.design]={...(migrated.designs[original]??{})};
  }
  return migrated;
}

// Registry modules keep their metadata inline and never import this module.
// DESIGNS is read only when these functions run, after registry initialization.
export const SHELVES = Object.freeze({
  flat: { label: 'Flat', hint: 'One layer that joins in the plane' },
  layered: { label: 'Layered', hint: 'Flat layers that cross at different heights, or a motif on a backing' },
  raised: { label: 'Raised', hint: 'Strands that deliberately leave the plane' },
});
export const FAMILIES = Object.freeze({
  "waves": {
    "label": "Waves"
  },
  "grids": {
    "label": "Grids"
  },
  "cells": {
    "label": "Cells"
  },
  "lattices": {
    "label": "Lattices"
  },
  "rings": {
    "label": "Rings and bubbles"
  },
  "loops": {
    "label": "Loops"
  },
  "curves": {
    "label": "Curves"
  },
  "radial": {
    "label": "Radial"
  },
  "fields": {
    "label": "Field lines"
  },
  "tiles": {
    "label": "Tiles"
  },
  "lace": {
    "label": "Lace"
  },
  "sheets": {
    "label": "Sheets"
  },
  "nets": {
    "label": "Random nets"
  },
  "motif": {
    "label": "Motif on a backing"
  },
  "woven": {
    "label": "Woven"
  },
  "textures": {
    "label": "Textures"
  },
  "pile": {
    "label": "Pile and fringe"
  },
  "spacers": {
    "label": "Spacers"
  }
});

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Returns all metadata problems. Preset tiles are links rather than cards. */
export function validateCard(mod) {
  if (mod?.status === 'preset') return [];
  if (!object(mod)) return ['Card must be an object.'];
  const problems = [];
  if (!Object.hasOwn(SHELVES, mod.shelf)) problems.push('Unknown shelf.');
  if (!Object.hasOwn(FAMILIES, mod.family)) problems.push('Unknown family.');
  if (typeof mod.joins !== 'string' || !/\S.*\.$/.test(mod.joins) || mod.joins.length > 120) problems.push('Joins must be a sentence of at most 120 characters ending in a full stop.');
  if (!['self', 'auto', 'built-in'].includes(mod.support)) problems.push('Unknown support policy.');
  if (!['tested', 'untested', 'needs-repair'].includes(mod.state)) problems.push('Unknown card state.');
  if (!object(mod.sources)) problems.push('Sources must be an object.');
  if (mod.settingsKey !== undefined && typeof mod.settingsKey !== 'string') problems.push('Settings key must be a string.');
  if (mod.variantGroup !== undefined && (typeof mod.variantGroup !== 'string' || !mod.variantGroup.trim())) problems.push('Variant group must be a non-empty string.');
  if (mod.legacy !== undefined && (!Array.isArray(mod.legacy) || mod.legacy.some(entry => !object(entry) || typeof entry.id !== 'string' || (entry.patch !== undefined && !object(entry.patch))))) problems.push('Legacy must be an array of { id, patch? } records.');
  return problems;
}

/** Visible ready cards grouped and sorted by shelf, family, test state and name. */
/**
 * The order cards are listed in, simplest first: plain regular patterns, then patterns with more to understand, then those built
 * from graphs, random seeds, pictures or several stages. One list for all three shelves; a card not named here comes after those
 * that are, in the order it already had. Change the order by moving an id.
 */
export const SIMPLEST_FIRST = Object.freeze([
  // plain, regular patterns
  'honeycomb-flat', 'auxetic', 'rings-flat', 'coil', 'figure8-rows', 'zigzag', 'crosshatch', 'squiggle', 'square-net', 'rotated-stack',
  'rings-raised', 'loop-pile',
  // regular, with a little more to set
  'rotating-squares', 'rotating-triangles', 'arrowhead-band', 'starlattice', 'harmonograph', 'spiral-cells', 'kirigami', 'honeycomb-layered',
  'figure8-net', 'moire-net', 'chainmail', 'spiral', 'sunflower', 'rosette', 'web', 'spirograph', 'flowlines',
  'looped-net', 'relief', 'corrugation', 'fringe', 'wave-bridged', 'grid-lifted',
  // built from graphs, seeds, pictures or several stages
  'voronoi-cells', 'star-metric', 'isohedral-tiles', 'connected-lace', 'meander-ties', 'voronoi', 'bubbles', 'conformal', 'parquet', 'truchet',
  'meander', 'turing', 'weave', 'paired-loops', 'step-lace', 'lace-backing', 'scales', 'boucle', 'stochastic-net',
  'colour-exposure', 'dipweave', 'pillarweave', 'spacer', 'grid-sliding', 'svgdesign',
]);

/** @param cards  cards of one shelf @returns {object[]} the same cards, simplest first */
export function simplestFirst(cards) {
  const rank = (card) => { const at = SIMPLEST_FIRST.indexOf(card.id); return at < 0 ? SIMPLEST_FIRST.length : at; };
  return cards.map((card, index) => ({ card, index })).sort((a, b) => rank(a.card) - rank(b.card) || a.index - b.index).map(({ card }) => card);
}

export function libraryGroups(designs = DESIGNS) {
  const stateOrder = { tested: 0, untested: 1, 'needs-repair': 2 };
  return Object.fromEntries(Object.keys(SHELVES).map(shelf => [shelf,
    Object.keys(FAMILIES).map(family => ({ family, cards: designs.filter(card => card.status === 'ready' && !card.hidden && card.shelf === shelf && card.family === family)
      .sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || a.name.localeCompare(b.name)) })).filter(group => group.cards.length),
  ]));
}

/** Ready variants sharing an explicit comparison group or settings key, or their own permanent id. */
export function variantsOf(id, designs = DESIGNS) {
  const card = designs.find(card => card.id === id && card.status === 'ready' && !card.hidden);
  if (!card) return [];
  if (card.variantGroup) return Object.keys(SHELVES).flatMap(shelf => designs.filter(other => other.status === 'ready' && !other.hidden && other.shelf === shelf && other.variantGroup === card.variantGroup));
  if (!card.settingsKey) return [card];
  return Object.keys(SHELVES).flatMap(shelf => designs.filter(other => other.status === 'ready' && !other.hidden && other.shelf === shelf && other.settingsKey === card.settingsKey));
}

/** Reports variant groups whose cards do not expose the same shared settings keys. */
export function variantDefaultErrors(designs = DESIGNS) {
  const groups = new Map();
  for (const card of designs.filter((entry) => entry.status === 'ready' && !entry.hidden && entry.settingsKey)) {
    const keys = Object.keys(card.defaults()).sort().join('|');
    const prior = groups.get(card.settingsKey);
    if (prior && prior.keys !== keys) prior.errors.push(`${card.id}: defaults differ from ${prior.ids[0]}.`);
    else if (prior) prior.ids.push(card.id);
    else groups.set(card.settingsKey, { keys, ids: [card.id], errors: [] });
  }
  return [...groups.values()].flatMap((group) => group.errors);
}

/** Sets the active card without touching its shared settings object. */
export function selectVariant(state, id, designs = DESIGNS) {
  if (!variantsOf(id, designs).length) return false;
  state.design = id;
  return true;
}

/** Creates one defaults object per settings group for the application state. */
export function initialDesignSettings(designs = DESIGNS) {
  const settings = {};
  for (const card of designs) if (card.status === 'ready') {
    const key = card.settingsKey ?? card.id;
    if (!Object.hasOwn(settings, key)) settings[key] = card.defaults();
  }
  return settings;
}
