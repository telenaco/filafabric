// Page start: show the password gate and load the studio only for an authorized visit.
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

async function start({ loadStudio = () => import('./ui/main.js?v=20261112-inspector') } = {}) {
  const form = $('gate-form');
  const input = $('gate-password');
  const error = $('gate-error');
  const button = $('gate-submit');
  let phase = 'loading-config';

  function startupFailed(cause) {
    phase = 'failed';
    input.disabled = true;
    button.disabled = true;
    button.textContent = 'Open the studio';
    error.textContent = 'The studio could not start. Reload the page, and if it happens again let the owner know.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn';
    retry.textContent = 'Reload page';
    retry.addEventListener('click', () => location.reload());
    error.append(' ', retry);
    error.hidden = false;
    retry.focus();
    console.error(cause);
  }

  async function openStudio({ open = false } = {}) {
    phase = 'loading-studio';
    button.disabled = true;
    button.textContent = 'Loading the studio…';
    input.disabled = true;
    try {
      const studio = await loadStudio();
      await studio.init();
    } catch (cause) {
      startupFailed(cause);
      return;
    }
    phase = 'ready';
    document.body.classList.remove('locked');
    $('gate').remove();
    // With the gate open there is nothing to lock.
    const lock = $('btn-lock');
    if (open) lock?.remove();
    else lock?.addEventListener('click', () => {
      keep.clear();
      location.reload();
    });
  }

  let config, token;
  try {
    const response = await fetch('src/ui/gate-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load gate configuration (HTTP ' + response.status + ').');
    config = await response.json();
    if (!config || typeof config !== 'object') throw new Error('The gate configuration is invalid.');
    if (config.open !== true) token = unlockToken(config);
  } catch (cause) {
    startupFailed(cause);
    return;
  }

  // "open": true allows public access without clearing the configured password.
  if (config.open === true) {
    await openStudio({ open: true });
    return;
  }
  if (keep.get() === token) {
    await openStudio();
    return;
  }

  phase = 'locked';
  input.focus();
  input.addEventListener('input', () => { if (phase === 'locked') error.hidden = true; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (phase !== 'locked') return;
    phase = 'verifying';
    button.disabled = true;
    button.textContent = 'Checking password…';
    error.hidden = true;
    let ok = false;
    try {
      ok = await verifyPassword(input.value, config);
    } catch (cause) {
      startupFailed(cause);
      return;
    }
    if (ok) {
      keep.set(token, $('gate-remember').checked);
      await openStudio();
      return;
    }
    phase = 'locked';
    button.disabled = false;
    button.textContent = 'Open the studio';
    error.textContent = 'That is not the password.';
    error.hidden = false;
    input.select();
  });
  button.disabled = false;
}

start();
