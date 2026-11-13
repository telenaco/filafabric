// A choice lasts for the page session even when the browser denies access to localStorage.
const KEY = 'filafabric:privacy';
const browserSession = {};
const noStorageSession = {};
const sessionAnswers = new WeakMap();
export const PRIVACY_VERSION = 1;

function storageArea(storage) {
  return storage === browserSession ? globalThis.localStorage : storage;
}

/** The visitor's answer to this version of the notice, { stats }, or null when they have not answered yet. */
export function readPrivacyChoice(storage = browserSession) {
  const key = storage ?? noStorageSession;
  const previous = sessionAnswers.get(key);
  // A denied write can leave an older answer readable in storage.
  if (previous && !previous.persisted) return { stats: previous.stats };
  let value;
  try {
    value = storageArea(storage)?.getItem(KEY);
  } catch {
    return previous ? { stats: previous.stats } : null;
  }
  try {
    const saved = JSON.parse(value ?? 'null');
    if (saved?.v === PRIVACY_VERSION && typeof saved.stats === 'boolean') {
      sessionAnswers.set(key, { stats: saved.stats, persisted: true });
      return { stats: saved.stats };
    }
  } catch { /* damaged data is treated as an unanswered notice */ }
  sessionAnswers.delete(key);
  return null;
}

export function savePrivacyChoice(stats, storage = browserSession) {
  const choice = { stats: !!stats, persisted: false };
  sessionAnswers.set(storage ?? noStorageSession, choice);
  try {
    const area = storageArea(storage);
    if (area) {
      area.setItem(KEY, JSON.stringify({ v: PRIVACY_VERSION, stats: choice.stats }));
      choice.persisted = true;
    }
  } catch { /* the answer remains in memory until reload */ }
}

/** Exports are counted unless the visitor said no; until they answer, the notice itself is on screen. */
export const statsAllowed = (storage) => readPrivacyChoice(storage)?.stats !== false;

/** Wires the notice in index.html. It opens by itself until answered, and open() brings it back. */
export function bindPrivacyNotice(banner, { storage, onChange, openFeedback, toast } = {}) {
  const status = banner.querySelector('#privacy-state');
  const accept = banner.querySelector('#privacy-accept');
  const decline = banner.querySelector('#privacy-decline');

  function show(reopened) {
    const choice = readPrivacyChoice(storage);
    status.hidden = !reopened || !choice;
    if (choice) status.textContent = choice.stats ? 'Right now your exports are counted, anonymously.' : 'Right now your exports are not counted.';
    accept.textContent = reopened && choice?.stats === false ? 'I\'d love to contribute' : 'OK, I\'d love to contribute';
    banner.hidden = false;
    if (reopened) accept.focus();
  }

  function answer(stats) {
    savePrivacyChoice(stats, storage);
    banner.hidden = true;
    onChange?.(stats);
    if (!stats) toast?.('Your exports will not be counted.');
  }

  accept.addEventListener('click', () => answer(true));
  decline.addEventListener('click', () => answer(false));
  banner.querySelector('#privacy-feedback')?.addEventListener('click', () => openFeedback?.());
  if (!readPrivacyChoice(storage)) show(false);
  return { open: () => show(true) };
}
