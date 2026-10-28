/** Conservative identity: anything that can change toolpaths, machine commands or calibration must match. */
export function defaultCacheIdentity(input) {
  const { studySettings, panelSize, ...own } = input;
  const out = { ...own, outline: input.outline ?? null, vector: input.vector ?? null, image: input.image ?? null,
    regions: input.regions?.length ? input.regions : null, backing: input.backing ?? null,
    shapeOutline: !!input.shapeOutline, extraLayers: input.extraLayers ?? 0, legacyCopies: input.legacyCopies ?? null,
    solidLayers: input.solidLayers ?? 1, solidGenerator: input.solidGenerator ?? 'arachne',
    brim: input.brim ?? 2, perimeters: input.perimeters ?? input.brim ?? 2, meshPerimeters: input.meshPerimeters ?? null };
  if (!out.regions) delete out.seam;
  if (input.design !== 'loop-pile') { delete out.pilePattern; delete out.pilePatternScale; }
  return stableStringify(out);
}

/** A browsing sample intentionally ignores printer and filament. It must never stand in for a machine export. */
export function referenceCacheIdentity(input) {
  const identity = JSON.parse(defaultCacheIdentity(input));
  delete identity.machine; delete identity.material;
  return stableStringify(identity);
}

export function stableStringify(value) {
  const sort = v => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])])) : v;
  return JSON.stringify(sort(value));
}

const typed = { Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array };
export const stringifyDefaultResult = value => JSON.stringify(value, (_, v) => {
  if (ArrayBuffer.isView(v) && typed[v.constructor.name]) return { $ffType: v.constructor.name, values: Array.from(v) };
  if (typeof v === 'number' && !Number.isFinite(v)) return { $ffType: 'number', value: String(v) };
  return v;
});
export function parseDefaultResult(text) {
  // Native JSON parsing is much faster than a reviver invoked for every coordinate/characteristic of every move.
  const restore = v => {
    if (v?.$ffType === 'number') return Number(v.value);
    if (v?.$ffType && Object.hasOwn(typed, v.$ffType) && Array.isArray(v.values)) return typed[v.$ffType].from(v.values);
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (v[i] && typeof v[i] === 'object') v[i] = restore(v[i]); }
    else if (v && typeof v === 'object') for (const key of Object.keys(v)) if (v[key] && typeof v[key] === 'object') v[key] = restore(v[key]);
    return v;
  };
  return restore(JSON.parse(text));
}
