const CODES = new Set(['crossing-limit', 'move-limit', 'bed-fit', 'invalid-settings', 'empty-geometry', 'unknown-build-error']);
const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const parsedNumber = (value) => value === undefined ? undefined : number(Number(value.replaceAll(',', '')));

/** Safe for study events: never returns error text, stack traces, settings or drawing content. */
export function classifyBuildError(error) {
  const details = error?.details;
  const known = details?.code ?? details?.kind;
  if (CODES.has(known)) {
    const out = { code: known };
    for (const key of ['limit', 'observed']) if (number(details[key]) !== undefined) out[key] = details[key];
    return out;
  }
  const message = typeof error === 'string' ? error : String(error?.message ?? '');
  const crossing = message.match(/cross(?:ings?| each other)(?:[^\n]*?)more than\s+([\d,]+)(?:\s+times)?/i);
  if (crossing) return { code: 'crossing-limit', limit: parsedNumber(crossing[1]) };
  if (/crossing[- ](?:limit|budget)|too many crossings/i.test(message)) return { code: 'crossing-limit' };
  if (/moves[\s\S]*\blimit\b|need more than [\d,]+ moves|too many moves|move[- ]budget/i.test(message)) {
    const limit = message.match(/limit (?:is |of )?([\d,]+)/i) ?? message.match(/more than ([\d,]+) moves/i);
    const observed = message.match(/need (?:about )?([\d,]+) moves/i);
    return { code: 'move-limit', ...(limit ? { limit: parsedNumber(limit[1]) } : {}), ...(observed ? { observed: parsedNumber(observed[1]) } : {}) };
  }
  if (/does not fit the bed|leave the printable volume/i.test(message)) return { code: 'bed-fit' };
  if (/nothing to print|empty geometry/i.test(message)) return { code: 'empty-geometry' };
  if (error?.name === 'ConfigError') return { code: 'invalid-settings' };
  return { code: 'unknown-build-error' };
}

const STORAGE_KEY = 'filafabric.build-diagnostics.v1';
const MAX_ENTRIES = 50;
const GEOMETRY_KEYS = /^(?:svg|svgText|svgSource|vector|geometry|outline|outlines|pts|points|rings|pathData|imageData)$/i;

// Callers supply bounded metadata. This additional guard prevents an accidentally supplied SVG/point payload
// from reaching localStorage; full reproducible snapshots are a separate, explicit download action.
function metadata(value, depth = 0) {
  if (depth > 4) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return /<(?:svg|path|polygon|polyline)\b/i.test(value) ? undefined : value.slice(0, 256);
  if (Array.isArray(value)) return value.slice(0, 32).map((item) => metadata(item, depth + 1)).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return undefined;
  const out = {};
  for (const key of Object.keys(value).sort().slice(0, 100)) {
    if (GEOMETRY_KEYS.test(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    // Counts such as sourceComplexity.paths are metadata; arrays of those paths are geometry.
    if (/^(?:paths|segments|contours)$/i.test(key) && Array.isArray(value[key])) continue;
    const item = metadata(value[key], depth + 1);
    if (item !== undefined) out[key] = item;
  }
  return out;
}

/** The same guard for anything else leaving the studio, such as a feedback problem report. */
export const safeMetadata = (value) => metadata(value);

function logEntry(entry) {
  const error = entry.error;
  return {
    at: typeof entry.at === 'string' ? entry.at.slice(0, 32) : new Date().toISOString(),
    design: String(entry.design ?? '').slice(0, 100),
    settings: metadata(entry.settings) ?? {},
    dimensions: metadata(entry.dimensions) ?? null,
    sourceComplexity: metadata(entry.sourceComplexity) ?? null,
    error: {
      ...classifyBuildError(error),
      name: String(error?.name ?? 'Error').slice(0, 100),
      message: String(typeof error === 'string' ? error : error?.message ?? '').slice(0, 4000),
      ...(typeof error?.stack === 'string' ? { stack: error.stack.slice(0, 8000) } : {}),
    },
  };
}

const fingerprint = (entry) => JSON.stringify([entry.design, entry.settings, entry.dimensions, entry.sourceComplexity, entry.error.code]);

/** Local-only bounded history. Storage failures keep the current session's log usable in memory. */
export class DiagnosticLog {
  constructor(storage) {
    this.storage = null;
    this.entries = [];
    try {
      this.storage = storage ?? globalThis.localStorage ?? null;
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(saved)) this.entries = saved.slice(-MAX_ENTRIES).filter((entry) => entry && typeof entry === 'object').map((entry) => logEntry({ ...entry, error: { ...entry.error, details: entry.error } }));
    } catch { /* unavailable storage or a damaged previous log starts a fresh in-memory history */ }
  }

  /** Returns true only for a new attempt, so a caller can also deduplicate its structured study event. */
  record(entry) {
    const next = logEntry(entry);
    if (this.entries.length && fingerprint(this.entries.at(-1)) === fingerprint(next)) return false;
    this.entries.push(next);
    this.entries = this.entries.slice(-MAX_ENTRIES);
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.entries)); } catch { /* quota/privacy mode */ }
    return true;
  }

  export() { return JSON.parse(JSON.stringify(this.entries)); }

  clear() {
    this.entries = [];
    try { this.storage?.removeItem(STORAGE_KEY); } catch { /* quota/privacy mode */ }
  }
}

const SPACING_KEYS = /^(?:spacing|pitch|wavelength|period|rowPitch|rowGap|baseSpacing|designSpacing|backing\dSpacing|backingPitch|cellSize|cell)$/;
const COUNT_KEYS = new Set(['loops', 'lobes', 'spokes', 'arms', 'twist', 'harmonics', 'order', 'iterations']);
const AMPLITUDE_KEYS = new Set(['size', 'depth', 'amplitude', 'loop', 'radius']);

/** A substantial density reset, preserving dimensions and all shape/pattern/colour choices. No print guarantee. */
export function suggestRecovery(designModule, settings, error) {
  if (!['crossing-limit', 'move-limit'].includes(classifyBuildError(error).code)) return null;
  const defaults = designModule?.defaults?.();
  if (!defaults || !settings) return null;
  const patch = {};
  const areaScale = Math.max(1, Math.min(4, Math.sqrt((Number(settings.width) || 100) * (Number(settings.height) || 100) / 10000)));
  for (const [key, baseline] of Object.entries(defaults)) {
    const current = settings[key];
    if (typeof baseline !== 'number' || !Number.isFinite(current)) continue;
    let next = current;
    if (SPACING_KEYS.test(key)) next = Math.max(current, baseline * 1.5 * areaScale, 3);
    else if (key === 'rowOverlap') next = Math.min(current, Math.min(baseline, 25));
    else if (COUNT_KEYS.has(key) || AMPLITUDE_KEYS.has(key)) next = Math.min(current, baseline);
    if (key === 'size' && designModule.id === 'coil') next = Math.max(3, baseline);
    if (next === current) continue;
    next = Math.round(next * 100) / 100;
    if (next !== current) patch[key] = next;
  }
  if (!Object.keys(patch).length) return null;
  const descriptions = Object.entries(patch).map(([key, value]) => {
    const label = key === 'rowOverlap' ? 'Row overlap' : key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
    return `${label} to ${value}${key === 'rowOverlap' ? '%' : SPACING_KEYS.test(key) || ['size', 'depth', 'amplitude', 'radius'].includes(key) ? ' mm' : ''}`;
  });
  return { label: 'Simplify this pattern', patch, description: `Changes ${descriptions.join(', ')}. Keeps the sample dimensions and chosen shape and pattern.` };
}
