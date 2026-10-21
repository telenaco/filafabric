// Page start: show the "coming soon" gate, and load the studio only once the password is right (or this browser was
// unlocked before). The studio's own code is a dynamic import, so nothing of it runs behind the gate.
import { verifyPassword, unlockToken } from './ui/gate.js';

const STORE = 'filafabric:unlock';
const $ = (id) => document.getElementById(id);

const keep = {
  get() {
    try { return localStorage.getItem(STORE) ?? sessionStorage.getItem(STORE); } catch { return null; }
  },
  set(token, remember) {
    try {
      localStorage.removeItem(STORE);
      sessionStorage.removeItem(STORE);
      (remember ? localStorage : sessionStorage).setItem(STORE, token);
    } catch { /* storage unavailable: the gate asks again next time */ }
  },
  clear() {
    try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch { /* nothing to clear */ }
  },
};

async function openStudio({ open = false } = {}) {
  document.body.classList.remove('locked');
  $('gate')?.remove();
  await import('./ui/main.js?v=20261021-retraction-test');
  // with the gate open there is nothing to lock
  if (open) $('btn-lock')?.remove();
  $('btn-lock')?.addEventListener('click', () => {
    keep.clear();
    location.reload();
  });
}

async function start() {
  let config;
  try {
    const response = await fetch('src/ui/gate-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    config = await response.json();
  } catch (e) {
    const error = $('gate-error');
    error.textContent = 'The studio could not start. Reload the page, and if it happens again let the owner know.';
    error.hidden = false;
    console.error(e);
    return;
  }

  // "open": true in gate-config.json lets everyone in without the password, for a while; the password stays set, and
  // removing the flag (or setting a new password with tools/set-password.mjs) closes the gate again
  if (config.open === true) {
    await openStudio({ open: true });
    return;
  }

  if (keep.get() === unlockToken(config)) {
    await openStudio();
    return;
  }

  const form = $('gate-form');
  const input = $('gate-password');
  const error = $('gate-error');
  const button = $('gate-submit');
  input.focus();
  input.addEventListener('input', () => { error.hidden = true; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    error.hidden = true;
    let ok = false;
    try { ok = await verifyPassword(input.value, config); } catch { ok = false; }
    if (ok) {
      keep.set(unlockToken(config), $('gate-remember').checked);
      await openStudio();
      return;
    }
    button.disabled = false;
    error.textContent = 'That is not the password.';
    error.hidden = false;
    input.select();
  });
  button.disabled = false;
}

start();
