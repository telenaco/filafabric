// Shareable state: the design and its settings, encoded into the URL hash. Pure, tested in Node.
import { DEFAULT_TEXTILE } from '../engine/params.js';
import { ADVANCED_DEFAULTS, PRIMARY_KEYS, sanitizePrimary } from './controls.js';

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

/** Accept only what the app understands: known profiles, clamped primary values, known advanced keys. */
export function sanitizeState(raw, known) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
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
  return { v: 1, machine, material, primary, advanced };
}
