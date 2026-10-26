// Slider ranges are conveniences, not limits: any finite number that makes sense for the setting (positive, or zero
// where the range starts at zero) is used as typed, and the panel warns when it is outside the range. Exact values
// survive settings round trips.
export function validNumber(key, n, range) {
  if (!Number.isFinite(n)) return false;
  return range.min < 0 || (range.min === 0 ? n >= 0 : n > 0);
}
