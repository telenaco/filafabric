// Shareable state: the design and its settings, encoded into the URL hash. Pure, tested in Node.
import { DEFAULT_TEXTILE } from '../engine/params.js';
import { ADVANCED_DEFAULTS, PRIMARY_KEYS, sanitizePrimary } from './controls.js';
import { sanitizeSquiggle } from './squiggle-controls.js';

/** The designs the studio knows, in gallery order. The first one opens by default. */
export const DESIGN_IDS = Object.freeze(['loop-pile', 'squiggle']);

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
  return {
    name: typeof raw.name === 'string' && raw.name ? raw.name.slice(0, 80) : 'Outline',
    rings,
    rotation: Number.isFinite(rotation) ? Math.max(-180, Math.min(180, Math.round(rotation))) : 0,
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
  return { v: 2, design, machine, material, primary, advanced, squiggle: sanitizeSquiggle(r.squiggle), outline: sanitizeOutline(r.outline) };
}
