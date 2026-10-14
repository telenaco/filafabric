// The password gate: one password, no username. The password is never stored; only a salted PBKDF2 hash of it is
// (src/ui/gate-config.json). Pure functions on the Web Crypto API, so they run the same in the browser and in Node.
//
// This is a soft gate. The studio is a static site, so everything it is made of is still downloadable by anyone who
// knows the file names; the gate keeps casual visitors out and does not stand in for real access control.

const enc = new TextEncoder();
export const ITERATIONS = 210000;

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

/** PBKDF2-SHA256 of the password with the given salt (hex) and iteration count, as 64 hex digits. */
export async function deriveHash(password, saltHex, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256);
  return toHex(bits);
}

/** A config for a password: { v, salt, iterations, hash }. */
export async function makeConfig(password, { iterations = ITERATIONS, salt = null } = {}) {
  const saltHex = salt ?? toHex(crypto.getRandomValues(new Uint8Array(16)));
  return { v: 1, salt: saltHex, iterations, hash: await deriveHash(password, saltHex, iterations) };
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Whether `password` is the one the config was made from. */
export async function verifyPassword(password, config) {
  if (!config || typeof config.hash !== 'string' || typeof config.salt !== 'string') return false;
  if (typeof password !== 'string' || password.length === 0) return false;
  const hash = await deriveHash(password, config.salt, config.iterations ?? ITERATIONS);
  return sameString(hash, config.hash);
}

/** What a browser keeps after a correct password: not the password, and useless once the password changes. */
export const unlockToken = (config) => `v${config.v}-${config.hash.slice(0, 24)}`;

/** A random password of 14 characters from an alphabet without look-alikes, grouped as xxxx-xxxx-xxxx-xx. */
export function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 characters: no i, l, o, 0, 1
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12), chars.slice(12)].map((g) => g.join('')).join('-');
}
