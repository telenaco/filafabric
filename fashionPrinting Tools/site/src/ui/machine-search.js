// Finding a printer among hundreds by typing a little of its name. Every word typed must appear in the printer's vendor,
// model or preset name, with spaces and punctuation ignored ("ender3v2" finds "Ender-3 V2"), or in the short name
// people use for it ("x1c" for the X1 Carbon). The best matches come first: words that are whole words of the name,
// then the 0.4 mm nozzle before the larger ones, then the library's own order. Pure: no DOM.

/** Short names people type for printers whose full name they do not. */
const ALIASES = [
  [/\bX1 Carbon\b/i, 'x1c'],
  [/\bCORE One\b/i, 'coreone core1'],
  [/\bEnder-(\d)/i, 'ender$1'],
  [/\bMK3S\b/i, 'mk3'],
  [/\bAnkerMake\b/i, 'anker'],
  [/\bVORON2?\b/i, 'voron v2.4'],
];

const compact = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const words = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The text a printer is searched by. */
function haystack(entry, vendorName) {
  const text = `${vendorName ?? ''} ${entry.model ?? ''} ${entry.name}`;
  const aliases = ALIASES.filter(([re]) => re.test(text)).map(([re, alias]) => text.replace(new RegExp(`[\\s\\S]*?${re.source}[\\s\\S]*`, 'i'), alias));
  return { text: `${text} ${aliases.join(' ')}`, flat: compact(`${text} ${aliases.join(' ')}`) };
}

/**
 * @param entries  [{ id, vendor, name, model?, nozzle? }] in the order to show them when nothing is typed
 * @param query    what was typed
 * @param vendors  [{ id, name }], so a vendor can be found by its name
 * @returns the entries that match, best first
 */
export function searchMachines(entries, query, vendors = []) {
  const names = new Map(vendors.map((v) => [v.id, v.name]));
  const tokens = words(query);
  if (!tokens.length) return [...entries];
  const scored = [];
  entries.forEach((entry, order) => {
    const { text, flat } = haystack(entry, names.get(entry.vendor) ?? entry.vendor);
    if (!tokens.every((t) => flat.includes(t))) return;
    const own = words(text);
    const score = tokens.reduce((n, t) => n + (own.includes(t) ? 2 : own.some((w) => w.startsWith(t)) ? 1 : 0), 0);
    scored.push({ entry, score, nozzle: Math.abs((entry.nozzle ?? 0.4) - 0.4), order });
  });
  scored.sort((a, b) => b.score - a.score || a.nozzle - b.nozzle || a.order - b.order);
  return scored.map((s) => s.entry);
}

/** Before typing, show just the current printer and one alternative; searching still reaches the full library. */
export function machineSuggestions(entries, query, current, vendors = []) {
  const found = searchMachines(entries, query, vendors);
  if (query.trim()) return found;
  const selected = entries.find(m => m.id === current);
  return (selected ? [selected, ...found.filter(m => m.id !== current)] : found).slice(0, 2);
}
