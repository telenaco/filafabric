// The cookies and privacy notice shown on a first visit, and the visitor's answer about the anonymous export statistics.
// There are no cookies to consent to: the notice says what is kept in the browser and what is counted, and a "no" turns
// the counting off for this browser. The answer is kept in localStorage; without storage the notice simply shows again.
const KEY = 'filafabric:privacy';
export const PRIVACY_VERSION = 1;

/** The visitor's answer to this version of the notice, { stats }, or null when they have not answered yet. */
export function readPrivacyChoice(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
    return saved?.v === PRIVACY_VERSION && typeof saved.stats === 'boolean' ? { stats: saved.stats } : null;
  } catch { return null; }
}

export function savePrivacyChoice(stats, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify({ v: PRIVACY_VERSION, stats: !!stats })); } catch { /* storage unavailable: asked again next visit */ }
}

/** Exports are counted unless the visitor said no; until they answer, the notice itself is on screen. */
export const statsAllowed = (storage) => readPrivacyChoice(storage)?.stats !== false;

/** Wires the notice in index.html. It opens by itself until answered, and open() brings it back from the menu. */
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
    if (!stats) toast?.('Your exports will not be counted. You can change this in ⋯ › Privacy and cookies.');
  }

  accept.addEventListener('click', () => answer(true));
  decline.addEventListener('click', () => answer(false));
  banner.querySelector('#privacy-feedback')?.addEventListener('click', () => openFeedback?.());
  if (!readPrivacyChoice(storage)) show(false);
  return { open: () => show(true) };
}
