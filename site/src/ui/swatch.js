// A swatch code names a printed sample so a photo can be matched to its settings later: the design, the preset,
// the size and a short fingerprint of every setting. The same settings always give the same code. Pure: no DOM.

/** Key-sorted JSON, so the order settings were set in never changes the fingerprint. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** FNV-1a, 32 bits, as six hex digits. */
export function fingerprint(value) {
  let h = 0x811c9dc5;
  for (const ch of stable(value)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/**
 * @param file      the design's file prefix (looppile, squiggle, coil, ...)
 * @param settings  everything that shapes the print for this design (the design's own settings, advanced overrides)
 * @param opts      size [w, h] in mm, preset id or null, outline ({ name, rotation, rings }) or null
 */
export function swatchCode(file, settings, { size, preset = null, outline = null } = {}) {
  const [w, h] = size ?? [0, 0];
  const shape = outline ? { outline: { name: outline.name, rotation: outline.rotation, points: outline.rings?.reduce((n, r) => n + r.length, 0) } } : {};
  return `${file}-${preset ?? 'custom'}-${w}x${h}-${fingerprint({ settings, ...shape })}`;
}
