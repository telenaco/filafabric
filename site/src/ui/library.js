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
 * | L-06 | `chainmail` | Rings · layered | existing ID; settingsKey `rings` |
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
  if (mod.legacy !== undefined && (!Array.isArray(mod.legacy) || mod.legacy.some(entry => !object(entry) || typeof entry.id !== 'string' || (entry.patch !== undefined && !object(entry.patch))))) problems.push('Legacy must be an array of { id, patch? } records.');
  return problems;
}

/** Visible ready cards grouped and sorted by shelf, family, test state and name. */
export function libraryGroups(designs = DESIGNS) {
  const stateOrder = { tested: 0, untested: 1, 'needs-repair': 2 };
  return Object.fromEntries(Object.keys(SHELVES).map(shelf => [shelf,
    Object.keys(FAMILIES).map(family => ({ family, cards: designs.filter(card => card.status === 'ready' && !card.hidden && card.shelf === shelf && card.family === family)
      .sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || a.name.localeCompare(b.name)) })).filter(group => group.cards.length),
  ]));
}

/** Ready variants sharing the explicit settings key, or their own permanent id. */
export function variantsOf(id) {
  const card = DESIGNS.find(card => card.id === id && card.status === 'ready');
  if (!card) return [];
  const key = card.settingsKey ?? card.id;
  return Object.keys(SHELVES).flatMap(shelf => DESIGNS.filter(other => other.status === 'ready' && other.shelf === shelf && (other.settingsKey ?? other.id) === key));
}
