// The one line a card or preset shows for its pre-computed print: time, filament and layers. Pure, so it is tested in Node.

const grams = (g) => (g >= 10 ? String(Math.round(g)) : String(Math.round(g * 100) / 100).replace(/(\.\d)0$/, '$1'));

/** @param entry {{min: number|null, g: number, layers: number}} from card-estimates.js @returns {string} '' when there is none */
export function estimateLine(entry) {
  if (!entry) return '';
  const parts = [];
  if (Number.isFinite(entry.min)) {
    const m = entry.min;
    parts.push(m >= 120 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${m >= 10 ? Math.round(m) : m} min`);
  }
  if (Number.isFinite(entry.g)) parts.push(`${grams(entry.g)} g`);
  if (Number.isInteger(entry.layers)) parts.push(`${entry.layers} layer${entry.layers === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
