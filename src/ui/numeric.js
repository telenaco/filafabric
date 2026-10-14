// Slider ranges are conveniences. Exact, finite values survive settings round trips.
export function validNumber(key, n, range) {
  if (!Number.isFinite(n)) return false;
  if (key === 'variation') return n >= 0 && n <= 100;
  if (key === 'rowOverlap') return n >= 0 && n < 100;
  return range.min < 0 || (range.min === 0 ? n >= 0 : n > 0);
}
