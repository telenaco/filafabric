// Slider limits that follow the nozzle.
//
// The rule. A size that counts in beads (a cell, a ring, a pitch: lengths whose walls are strands) cannot shrink below what
// its strands need, and a strand is one bead wide: the nozzle diameter × 1.125, which the config calls `cfg.t.extrusion_width`.
// Those minimums were first set for the standard 0.4 mm nozzle, whose bead is 0.45 mm, so each is really a number of beads
// (3 mm ring = 6.7 beads). Written that way a minimum follows the nozzle: half as large for a 0.2 mm nozzle (bead 0.225 mm),
// a third larger for a 0.6 mm one. The smallest value any nozzle reaches is the `min` of the range: the floor, checked
// (dev/tests/nozzle-limits.test.js) to build a connected, exportable fabric with the finest supported nozzle.
// Spacings between strands (line spacing, row pitch) are not in this list: they already go down to 0.8 mm.
//
// A range that counts in beads carries `standardMin`, its minimum for the standard bead, and its `min` is the floor.

/** The nozzle the shipped minimums were set for, and its bead width in mm. */
export const STANDARD_NOZZLE = 0.4;
export const STANDARD_BEAD = 0.45;
/** The finest nozzle the studio supports for these sizes, and its bead width in mm (nozzle × 1.125). */
export const FINEST_NOZZLE = 0.2;
export const FINEST_BEAD = 0.225;

const dust = (n) => Math.round(n * 1e6) / 1e6; // 3 - 0.1 * 7 and the like, without the floating-point tail

/**
 * The smallest value of a range for a bead of the given width, on the range's own grid of steps (a slider moves in steps
 * from its minimum, so the minimum moves in whole steps from where it was).
 */
export function minForBead(range, bead) {
  const wanted = range.standardMin * bead / STANDARD_BEAD;
  return dust(range.standardMin + Math.ceil((wanted - range.standardMin) / range.step - 1e-9) * range.step);
}

/** A range that counts in beads: `min` becomes the floor at the finest bead (or the given floor), `standardMin` what it was. */
export function inBeads(range, floor) {
  const counting = { ...range, standardMin: range.min };
  return { ...counting, min: floor ?? minForBead(counting, FINEST_BEAD) };
}

/** The range a slider shows for the bead width of the printer and filament chosen: ranges that do not count in beads stay as they are. */
export function nozzleRange(range, bead) {
  if (!range || !(range.standardMin > 0) || !(bead > 0)) return range;
  const min = Math.max(range.min, minForBead(range, bead));
  return min === range.min ? range : { ...range, min };
}

/**
 * Every size that counts in beads: card id → { slider key → floor }, with null where the floor is the standard minimum scaled
 * to the finest bead (half of it). A floor written out is a size the engine could not build at half: the reason is beside it.
 * Each floor builds a connected, exportable fabric with the finest nozzle (dev/tests/nozzle-limits.test.js).
 */
const WAVES = { wavelength: null };
export const BEAD_SIZES = Object.freeze({
  // rings, cells and tiles: walls of strands round an open middle
  // the period was already lowered from 4 to 1.5 mm for every nozzle: that stays the standard minimum, and the finest nozzle goes to 1 mm
  auxetic: { period: null },
  'honeycomb-flat': { period: null },
  // the truly flat versions count their cells in beads like the cards they came from
  'auxetic-flat': { period: null },
  'honeycomb-planar': { period: null },
  'rings-flat': { ringSize: null, overlap: null },
  'rings-raised': { ringSize: null, overlap: null },
  'rotating-squares': { cell: null, neck: null, neckLength: null },
  'rotating-triangles': { cell: null, neck: null, neckLength: null },
  'star-metric': { cell: null, wall: null },
  'spiral-cells': { cell: null, armWidth: null },
  'connected-lace': { scale: null, neck: null },
  'lace-backing': { scale: null },
  'isohedral-tiles': { scale: null },
  'arrowhead-band': { cellHeight: null },
  kirigami: { slitLength: null, slitGap: null, interval: null, endSpacing: null },
  'step-lace': { spacing: null, tieLength: null, tieDepth: null },
  'paired-loops': { loopWidth: null },
  'meander-ties': { tieInterval: null },
  turing: { wavelength: null },
  'turing-legacy': { wavelength: null },
  'turing-flat': { wavelength: null },
  'squiggle-flat': WAVES, 'square-net-flat': WAVES, 'figure8-net-flat': WAVES, 'zigzag-flat': WAVES,
  // the engine loses a layer cut to the shape below about 0.95 mm; 1.05 is the first step of the slider above that
  parquet: { block: 1.05 },
  'parquet-flat': { block: 1.05 },
  halftone: { spacing: null, pitch: null },
  'moire-net': { pitchA: null },
  // pitches of structures that stand up: pillars, tiles, corrugations
  scales: { pitch: null },
  spacer: { pitch: null },
  pillarweave: { pitch: null },
  corrugation: { wavelength: null },
  // wave lengths of the nets
  squiggle: WAVES, 'square-net': WAVES, 'honeycomb-layered': WAVES, 'figure8-net': WAVES, 'looped-net': WAVES,
  'squiggle-rings': WAVES, 'squiggle-zigzag': WAVES, 'colour-exposure': WAVES, zigzag: WAVES,
});

/** Lengths above 0.8 mm that do not count in beads, and why: the test asks every such slider to be in one list or the other. */
export const NOT_IN_BEADS = Object.freeze({
  'wave-bridged.wavelength': 'its bridges are not yet fully connected with a 0.2 mm nozzle, even at the default wavelength',
  'fringe.length': 'the length of a hair: the engine wants a loop longer than half its width, which is not a bead measure',
  'grid-lifted.liftLength': 'the run of a ramp upward, set by the height it climbs',
  'grid-sliding.channelLift': 'a height, set by the layers it has to clear',
  'flowlines.scale': 'the wavelength of the flow field the lines follow, not of a cell',
});

/** The registry's cards with their ranges rewritten: every size in BEAD_SIZES counts in beads. */
export function applyBeadSizes(cards, sizes = BEAD_SIZES) {
  for (const card of cards) {
    const own = sizes[card.id];
    if (!own || !card.ranges) continue;
    card.ranges = Object.freeze({ ...card.ranges, ...Object.fromEntries(Object.entries(own).filter(([key]) => card.ranges[key]).map(([key, floor]) => [key, inBeads(card.ranges[key], floor ?? undefined)])) });
  }
  return cards;
}
