/** Lower scores mean a simpler default swatch: faults, free spans, slope, starts and clearance flags. */
export function printabilityScore(result) {
  const f = result.fabric, s = result.stats;
  if (!f?.exportable) return 1000000 + (f?.issues.length ?? 1) * 1000;
  return 2 * f.longestUnsupported + f.maxSlopeDeg + s.hops / 20 +
    200 * (s.violations ?? 0) / Math.max(1, s.extrudingMoves ?? s.moves);
}
