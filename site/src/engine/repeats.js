// Whole repeats: a pattern meets the edge of the swatch at the end of a repeat, never part-way through one.
//
// A swatch of printed fabric is sewn or welded to the next piece, so a zigzag that stops half-way up its last triangle,
// or a cell cut in half at the edge, is a loose end at every seam. The size of a repeat a person chooses (a wave length,
// a line spacing, a tile) is therefore taken as a target: the pattern uses the nearest size that fits a whole number of
// times into the swatch, so 9.6 waves in 100 mm become 10 waves of 10 mm. The change is never more than half a repeat
// spread over the whole width, so the look is the one chosen.

/** The nearest period to `period` that fits a whole number of times (at least `min`) into `length`. */
export function fitPeriod(length, period, min = 1) {
  if (!(length > 0) || !(period > 0)) return period;
  return length / Math.max(min, Math.round(length / period));
}

/** How many whole repeats of about `period` fit into `length` (at least `min`). */
export function fitCount(length, period, min = 1) {
  if (!(length > 0) || !(period > 0)) return min;
  return Math.max(min, Math.round(length / period));
}

/**
 * Lines about `spacing` apart that fill [lo, hi] exactly: the first on `lo`, the last on `hi`, the gaps between them
 * equal. A span shorter than a gap holds one line, in its middle.
 */
export function fitLanes(lo, hi, spacing) {
  if (!(hi - lo > 1e-9) || !(spacing > 0)) return [(lo + hi) / 2];
  const n = Math.max(1, Math.round((hi - lo) / spacing));
  return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n);
}

/**
 * The centres of equal cells about `size` wide that fill [lo, hi] exactly, half a cell in from each end: where a
 * pattern is made of cells (a tile, a bubble, a ring), each edge cell is a whole one.
 */
export function fitCells(lo, hi, size) {
  const n = fitCount(hi - lo, size);
  const step = (hi - lo) / n;
  return { count: n, size: step, centres: Array.from({ length: n }, (_, k) => lo + step * (k + 0.5)) };
}
