import { layered } from './more-designs.js';
import { coilParams } from './coil-controls.js';
import { generateCoil, generateCoilTextile, coilRowPitch } from '../engine/coil.js';
import { thumbFromLayers } from './thumbs.js';

/** The card's picture, drawn from the flat build itself (rows that touch, one plane), not from the layered card's. */
function flatCoilThumb({ shape, size, pitch, rowPitch = null }) {
  try {
    const bead = 0.45, rows = rowPitch ?? Math.max(1.5 * bead, coilRowPitch(size, 0, bead) - 1.4 * bead);
    const built = generateCoilTextile({ width: 36, height: 22, shape, size, pitch, rowOverlap: 0, rowPitch: rows, layerHeight: 0.2, strandWidth: bead, planCrossings: false });
    return thumbFromLayers([built.strands.map((strand) => strand.pts.filter((_, i) => i % 3 === 0 || i === strand.pts.length - 1))], 36, 22);
  } catch { return ''; }
}
import { patternField } from '../engine/picture.js';

/** The Bouclé card's own generator, in one plane. */
function boucleFlat(machine, material, s, { outline, picture }) {
  return generateCoil(machine, material, {
    width: s.width, height: s.height, shape: 'ring', size: s.size, pitch: s.pitch, rowPitch: s.rowPitch, rowOverlap: 0, lift: s.lift,
    sampler: patternField(s.pattern, { scale: s.patternScale, picture }), outline, flat: true,
  });
}
import { auxeticFlatLayers, planarLayers, onePlane } from '../engine/flat-variants.js';

// Some cards listed as Flat printed as two layers (Looped rows, Figure-8 rows, Re-entrant mesh, Honeycomb, Star lattice,
// Harmonograph). Each now keeps that card on the Layered shelf (the Raised shelf for the two whose strand lifts over itself), and a new card on the Flat shelf builds the same style in one
// layer, with the same settings, so the two can be compared (Print all variants).

// a strand that rises over its own earlier passes leaves the plane, so those two cards belong on the Raised shelf; the rest print whole layers
const SHELF_OF = { coil: 'raised', 'figure8-rows': 'raised' };
const LAYERED_NAMES = {
  coil: 'Looped rows · raised',
  'figure8-rows': 'Figure-8 rows · raised',
  auxetic: 'Re-entrant mesh · layered',
  'honeycomb-flat': 'Honeycomb · two-layer',
  starlattice: 'Star lattice · layered',
  harmonograph: 'Harmonograph · layered',
};

/**
 * Moves the two-layer cards to the Layered shelf and returns the truly flat cards that take their place.
 * @param designs  the registry, after the cards it names have been made
 */
export function makeFlatVariants(designs) {
  const find = (id) => designs.find((card) => card.id === id);
  const out = [];

  // 1. the two-layer cards, renamed and moved; each needs a settings key so the pair shares settings
  const keyOf = { coil: 'coil', 'figure8-rows': 'figure8-rows', auxetic: 'auxetic', 'honeycomb-flat': 'honeycomb-flat', starlattice: 'starlattice', harmonograph: 'harmonograph' };
  for (const [id, name] of Object.entries(LAYERED_NAMES)) {
    const card = find(id);
    if (!card) continue;
    card.shelf = SHELF_OF[id] ?? 'layered';
    card.name = name;
    card.settingsKey ??= keyOf[id];
  }

  // 2. Re-entrant mesh and Honeycomb: rows of zigzag with a strut between rows, struts ending on the rows
  const auxetic = find('auxetic'), honeycomb = find('honeycomb-flat');
  if (auxetic?.def) {
    out.push(layered({
      ...auxetic.def, id: 'auxetic-flat', shelf: 'flat', name: 'Re-entrant mesh · flat', file: 'auxetic-flat', settingsKey: auxetic.settingsKey,
      joins: 'Bow-tie cells in one layer: each strut ends on the rows beside it.', blurb: 'Bow-tie cells that widen when pulled, in one layer',
      about: 'Rows of zigzag, each the mirror of the one below, with a short strut between two rows at every wide point. The struts end on the rows, so nothing crosses and the whole piece is one layer thick. Pulled one way it widens the other way. The two-layer version of this style is on the Layered shelf.',
      build: (s, boundary) => auxeticFlatLayers(boundary, { rowPitch: s.rowPitch, period: s.period, amplitude: s.amplitude, cell: s.cell }),
      summary: (result) => `a flat re-entrant mesh of ${result.extra?.struts ?? result.struts ?? 0} struts`,
    }));
  }
  if (honeycomb?.def) {
    out.push(layered({
      ...honeycomb.def, id: 'honeycomb-planar', shelf: 'flat', name: 'Honeycomb · flat', file: 'honeycomb-planar', settingsKey: honeycomb.settingsKey,
      joins: 'Hexagon cells in one layer: each strut ends on the rows beside it.', blurb: 'Hexagon cells share their walls in one layer',
      about: 'Rows of zigzag, each the mirror of the one below, with a short strut between two rows at every waist, so the cells are convex hexagons. The struts end on the rows, so nothing crosses and the whole piece is one layer thick. The two-layer version of this style is on the Layered shelf.',
      build: (s, boundary) => auxeticFlatLayers(boundary, { rowPitch: s.rowPitch, period: s.period, amplitude: s.amplitude, cell: 'hexagon' }),
      summary: (result) => `a flat honeycomb of ${result.extra?.struts ?? result.struts ?? 0} struts`,
    }));
  }

  // 3. Star lattice, Harmonograph and Zigzag mesh: the same strands, every crossing joined in the plane and all of them in one layer
  const zigzagCard = find('zigzag');
  if (zigzagCard) zigzagCard.settingsKey ??= 'zigzag';
  for (const [id, flatId, label, about] of [
    ['starlattice', 'starlattice-flat', 'Star lattice · flat', 'The same star straps as the layered card, but where two straps meet they are joined in the plane, and every strap is in one layer.'],
    ['harmonograph', 'harmonograph-flat', 'Harmonograph · flat', 'The same Lissajous curve as the layered card, but where the curve meets itself it is joined in the plane, so the whole piece is one layer thick.'],
    ['zigzag', 'zigzag-flat', 'Zigzag mesh · flat', 'The same two zigzag families as the layered card, in one layer: where a line meets one of the other family they are joined there.'],
  ]) {
    const base = find(id);
    if (!base?.def) continue;
    out.push(layered({
      ...base.def, id: flatId, shelf: 'flat', name: label, file: flatId, settingsKey: base.settingsKey,
      joins: `${base.def.joins.replace(/\.$/, '')}, joined in one layer.`, about: `${about} The layered version is on the Layered shelf.`,
      build: (s, boundary, ctx) => {
        const built = base.def.build(s, boundary, ctx);
        return { ...built, layers: planarLayers(built.layers, { bead: ctx?.bead ?? 0.45 }), extra: { ...(built.extra ?? {}), flat: true, transform: onePlane } };
      },
    }));
  }

  // 4. Looped rows and Figure-8 rows: rows that only touch, and loops that cross themselves in the plane
  for (const [id, flatId, label] of [['coil', 'coil-flat', 'Looped rows · flat'], ['figure8-rows', 'figure8-rows-flat', 'Figure-8 rows · flat']]) {
    const base = find(id);
    if (!base) continue;
    out.push({
      ...base, id: flatId, shelf: 'flat', name: label, file: flatId, settingsKey: base.settingsKey,
      thumb: flatCoilThumb({ shape: id === 'coil' ? 'looped' : 'figure8', size: 2, pitch: 3.6 }),
      blurb: 'One strand in rows, in one layer: the rows only touch',
      about: 'The same rows of one continuous strand, but every row only touches the next (the row overlap is not used here) and the strand stays in one layer, loops crossing themselves in the plane. The raised version, whose strand lifts over its own earlier passes and whose rows reach into each other, is on the Raised shelf.',
      joins: 'One strand in rows; each row touches the next, all in one layer.',
      generate: (machine, material, c, { outline = null, picture = null } = {}) => generateCoil(machine, material, { ...coilParams(c, { outline, picture }), flat: true }),
    });
  }

  // 5. Truchet tiles, Turing stripes, Meander and Parquet without their second layer. The live site printed each as two layers, the
  // second being the backing; here is the first layer on its own. It is not printable alone: the backing option comes later.
  const BACKING_KEYS = ['backing', 'backingLayers', 'backingArea', 'backing1Pattern', 'backing2Pattern'];
  const withoutBacking = (controls) => controls.filter((section) => section.kind !== 'support' && !BACKING_KEYS.includes(section.key))
    // the backing's own sliders (and the spacing and angle a Support section drives) go with it, and a section left empty goes too
    .map((section) => (section.kind === 'sliders' ? { ...section, items: section.items.filter((item) => !['backingDepth', 'backingLength', 'angle', 'spacing'].includes(item.key)) } : section))
    .filter((section) => section.kind !== 'sliders' || section.items.length);
  const firstLayer = (built, { planar = false, bead = 0.45 } = {}) => {
    const layers = planar ? planarLayers([built.layers[0]], { bead }) : [built.layers[0]];
    if (built.layers.families) layers.families = built.layers.families.slice(0, 1);
    const extra = { ...(built.extra ?? {}) };
    if (Array.isArray(extra.families)) extra.families = extra.families.slice(0, 1);
    if (planar) Object.assign(extra, { flat: true, transform: onePlane });
    return { ...built, layers, families: built.families?.slice(0, 1), extra };
  };
  const NOTE = 'This is the first layer on its own, without a backing, so it is not printable alone; a backing option is coming.';
  for (const [id, label, joins] of [
    ['truchet', 'Truchet tiles · flat', 'Tile curves meet at the tile edges, in one layer without a backing.'],
    ['turing', 'Turing stripes · flat', 'Grown stripes in one layer, without a backing.'],
    ['meander', 'Meander · flat', 'One space-filling curve in one layer, without a backing.'],
    ['parquet', 'Parquet · flat', 'Blocks of parallel lines joined by seams, in one layer without a backing.'],
  ]) {
    const base = find(id);
    if (!base?.def) continue;
    out.push(layered({
      ...base.def, id: `${id}-flat`, shelf: 'flat', name: label, file: `${id}-flat`, support: 'needs-backing', state: 'untested', settingsKey: undefined, variantGroup: undefined,
      joins, about: `${base.def.about} ${NOTE}`, controls: withoutBacking(base.def.controls),
      build: (s, boundary, ctx) => firstLayer(base.def.build(s, boundary, ctx), { planar: ['truchet', 'turing'].includes(id), bead: ctx?.bead ?? 0.45 }),
    }));
  }

  // 6. Bouclé and picots in one layer: the rings lie in the plane with the line that carries them
  const boucle = find('boucle');
  if (boucle) {
    out.push({
      ...boucle, id: 'boucle-flat', shelf: 'flat', name: 'Bouclé & picots · flat', file: 'boucle-flat', thumb: flatCoilThumb({ shape: 'ring', size: 2.4, pitch: 4.5, rowPitch: 4 }), settingsKey: undefined, support: 'needs-backing',
      blurb: 'Rings on a line, in one layer', joins: 'Rings sit on a line, in one layer without the built-in backing.',
      about: `Rows of line with a round ring standing on it, alternately above and below, printed as one strand in one layer. Where a ring meets the next row it is joined in the plane. ${NOTE} The layered version, with its built-in backing, is on the Layered shelf.`,
      generate: (machine, material, s, { outline = null, picture = null } = {}) => boucleFlat(machine, material, s, { outline, picture }),
    });
  }
  return out;
}
