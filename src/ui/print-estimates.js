/** Numeric summaries only: switching views must not retain a second copy of millions of toolpath points. */
export class PrintEstimates {
  constructor() { this.entries = new Map(); }
  put(key, result, selectedWidth, selectedHeight) {
    const t = result.cfg?.t, stats = result.stats;
    if (!t || !stats || !Number.isFinite(stats.timeSec)) return;
    const full = t.sample_width === selectedWidth && t.sample_height === selectedHeight;
    const record = { width: t.sample_width, height: t.sample_height, full,
      timeSec: stats.timeSec, filamentGrams: stats.filamentGrams, filamentMm: stats.filamentMm };
    const entry = this.entries.get(key) ?? {};
    entry[full ? 'full' : 'sample'] = record;
    this.entries.set(key, entry);
    while (this.entries.size > 8) this.entries.delete(this.entries.keys().next().value);
  }
  get(key) { const entry = this.entries.get(key); return entry?.full ?? entry?.sample ?? null; }
}
