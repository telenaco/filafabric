// Shareable state: the design and its settings, encoded into the URL hash. Pure, tested in Node.
import { DEFAULT_TEXTILE } from '../engine/params.js';
import { ADVANCED_DEFAULTS, PRIMARY_KEYS, sanitizePrimary } from './controls.js';
import { sanitizeSquiggle } from './squiggle-controls.js';
import { DESIGNS, READY_IDS } from './designs.js';
import { sanitizeSvgLines } from '../engine/svg-lines.js';

/** The designs a link can open, in gallery order (planned placeholders are not loadable). The first opens by default. */
export const DESIGN_IDS = READY_IDS;

const toToken = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromToken = (t) => decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeState(obj) {
  return toToken(JSON.stringify(obj));
}

export function decodeState(token) {
  try {
    if (!token) return null;
    const value = JSON.parse(fromToken(token));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function stateToHash(state) {
  return `#s=${encodeState(state)}`;
}

export function hashToState(hash) {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash || '');
  return m ? decodeState(m[1]) : null;
}

/** Layer thickness (mm), additional layers above the native design, and side-by-side brim runs. Invalid values use the defaults. */
export const PRINT_DEFAULTS = Object.freeze({ layerHeight: 0.2, extraLayers: 0, brim: 2 });
export function sanitizePrint(raw) {
  const out = { ...PRINT_DEFAULTS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const h = Number(raw.layerHeight);
  if (raw.layerHeight !== null && raw.layerHeight !== '' && Number.isFinite(h) && h > 0 && h <= 2) out.layerHeight = h;
  const e = raw.extraLayers;
  const extra = (typeof e === 'number' || typeof e === 'string' && e.trim() !== '') ? Number(e) : NaN;
  if (Number.isFinite(extra) && extra >= 0 && extra <= 250) out.extraLayers = Math.round(extra);
  // Native layer count is only known after generation. Keep old copies unresolved until the pipeline can migrate them.
  if (out.extraLayers === 0 && Number.isInteger(raw.legacyCopies) && raw.legacyCopies >= 2 && raw.legacyCopies <= 50) out.legacyCopies = raw.legacyCopies;
  else if (!Object.hasOwn(raw, 'extraLayers')) {
    const copies = Math.round(Number(raw.layers));
    if (Number.isFinite(copies) && copies >= 2 && copies <= 50) out.legacyCopies = copies;
  }
  const b = raw.brim;
  const count = (typeof b === 'number' || typeof b === 'string' && b.trim() !== '') ? Number(b) : NaN;
  if (Number.isFinite(count) && count >= 0 && count <= 50) out.brim = Math.round(count);
  return out;
}

const MAX_OUTLINE_RINGS = 64;
const MAX_OUTLINE_POINTS = 2000;

/**
 * An outline from a link or a file: rings of flat [x, y, ...] numbers in a unit box, a rotation and a name.
 * Anything malformed, oversized or out of range gives null (no outline).
 */
export function sanitizeOutline(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.rings)) return null;
  const rings = [];
  let points = 0;
  for (const r of raw.rings.slice(0, MAX_OUTLINE_RINGS)) {
    if (!Array.isArray(r) || r.length < 6 || r.length % 2 !== 0) continue;
    if (!r.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -0.01 && n <= 1.01)) continue;
    points += r.length / 2;
    if (points > MAX_OUTLINE_POINTS) return null;
    rings.push(r);
  }
  if (rings.length === 0) return null;
  const rotation = Number(raw.rotation);
  // `page`: the size (mm) of the drawing these rings are measured against, so they stay registered to its lines
  const page = Array.isArray(raw.page) && raw.page.length === 2 && raw.page.every((n) => Number.isFinite(n) && n > 0 && n <= 1000) ? [raw.page[0], raw.page[1]] : null;
  return {
    name: typeof raw.name === 'string' && raw.name ? raw.name.slice(0, 80) : 'Outline',
    rings,
    rotation: Number.isFinite(rotation) ? Math.max(-180, Math.min(180, Math.round(rotation))) : 0,
    ...(page ? { page } : {}),
  };
}

/**
 * Accept only what the app understands: a known design and profiles, clamped primary and squiggle values,
 * known advanced keys. Version 1 links (before designs were saved) open as the loop pile.
 */
export function sanitizeState(raw, known) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const design = DESIGN_IDS.includes(r.design) ? r.design : DESIGN_IDS[0];
  const machine = known.machines.includes(r.machine) ? r.machine : known.machines[0];
  const material = known.materials.includes(r.material) ? r.material : known.materials[0];
  const primary = sanitizePrimary(r.primary);
  const advanced = {};
  if (r.advanced && typeof r.advanced === 'object' && !Array.isArray(r.advanced)) {
    for (const [key, value] of Object.entries(r.advanced)) {
      if (PRIMARY_KEYS.includes(key)) continue;
      if (!(key in DEFAULT_TEXTILE) && !(key in ADVANCED_DEFAULTS)) continue;
      const base = DEFAULT_TEXTILE[key] ?? ADVANCED_DEFAULTS[key];
      const ok = base === null ? value === null || typeof value === 'number' : typeof value === typeof base;
      if (ok) advanced[key] = value;
    }
  }
  // the loop pile and squiggle keep their own keys; every newer design keeps its settings under `designs[id]`
  const saved = r.designs && typeof r.designs === 'object' && !Array.isArray(r.designs) ? r.designs : {};
  const designs = {};
  for (const d of DESIGNS) {
    if (d.status === 'ready' && !d.legacy) designs[d.id] = d.sanitize(saved[d.id]);
  }
  return { v: 3, design, machine, material, primary, advanced, squiggle: sanitizeSquiggle(r.squiggle), designs, outline: sanitizeOutline(r.outline), vector: sanitizeSvgLines(r.vector), print: sanitizePrint(r.print) };
}
