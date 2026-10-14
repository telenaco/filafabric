/** A fixed stats object so writer tests do not depend on stats.js (added in a later task). */
export function computeStatsStub() {
  return { timeSec: 100, filamentMm: 10, loops: 1, maxSlopeDeg: 17 };
}
