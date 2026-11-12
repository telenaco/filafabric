import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bindPrivacyNotice, PRIVACY_VERSION, readPrivacyChoice, savePrivacyChoice, statsAllowed } from '../../site/src/ui/privacy.js';
import { createStudyRecorder } from '../../site/src/ui/study.js';
import { siteRoot } from './helpers.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), data };
};

test('until the visitor answers there is no choice, and exports are counted while the notice is on screen', () => {
  const storage = memory();
  assert.equal(readPrivacyChoice(storage), null);
  assert.equal(statsAllowed(storage), true);
});

test('"Don\'t count my exports" is remembered, and can be changed back', () => {
  const storage = memory();
  savePrivacyChoice(false, storage);
  assert.deepEqual(readPrivacyChoice(storage), { stats: false });
  assert.equal(statsAllowed(storage), false);
  savePrivacyChoice(true, storage);
  assert.equal(statsAllowed(storage), true);
  assert.equal(JSON.parse([...storage.data.values()][0]).v, PRIVACY_VERSION);
});

test('a damaged, older or unavailable stored answer asks again rather than guessing', () => {
  const damaged = memory();
  damaged.setItem('filafabric:privacy', '{not json');
  assert.equal(readPrivacyChoice(damaged), null);
  const older = memory();
  older.setItem('filafabric:privacy', JSON.stringify({ v: PRIVACY_VERSION - 1, stats: false }));
  assert.equal(readPrivacyChoice(older), null);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readPrivacyChoice(broken), null);
  assert.doesNotThrow(() => savePrivacyChoice(false, broken));
});

test('with counting turned off the research notice hides and nothing is sent; turning it on again brings both back', async () => {
  let allowed = false;
  const notice = { hidden: false };
  const sent = [];
  const recorder = createStudyRecorder(notice, {
    allowed: () => allowed,
    uuid: () => 'abcde123-1234-4234-8234-123456789abc',
    fetcher: async (url, init) => { sent.push(url); return url.endsWith('status') ? Response.json({ enabled: true }) : new Response(null, { status: 204 }); },
  });
  await recorder.init();
  assert.equal(notice.hidden, true);
  assert.equal(await recorder.record({ design: 'squiggle', exportType: 'gcode-swatch', dimensions: { width: 100, height: 100 } }), false);
  assert.deepEqual(sent, ['/api/study/status']);
  allowed = true;
  recorder.refresh();
  assert.equal(notice.hidden, false);
  assert.equal(await recorder.record({ design: 'squiggle', exportType: 'gcode-swatch', dimensions: { width: 100, height: 100 } }), true);
  assert.equal(sent.at(-1), '/api/study/exports');
});

test('the page has the privacy notice, its buttons and the menu item that brings it back', () => {
  const html = fs.readFileSync(path.join(siteRoot, 'index.html'), 'utf8');
  for (const id of ['privacy-banner', 'privacy-accept', 'privacy-decline', 'privacy-state', 'privacy-feedback', 'btn-privacy']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /no cookies/i);
});

test('what is counted is a dialog inside the studio, not a public page of its own', () => {
  assert.equal(fs.existsSync(path.join(siteRoot, 'study.html')), false, 'a public page could be found and cached by a search engine');
  const html = fs.readFileSync(path.join(siteRoot, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /study\.html/);
  assert.ok(html.includes('id="study-dialog"'), 'the dialog');
  assert.ok((html.match(/data-open-study/g) ?? []).length >= 2, 'both links open it');
  assert.match(html, /What is recorded/);
});

test('no page loads its font or styles from another site', () => {
  for (const file of ['index.html', path.join('src', 'ui', 'styles.css')]) {
    const text = fs.readFileSync(path.join(siteRoot, file), 'utf8');
    assert.doesNotMatch(text, /fonts\.(googleapis|gstatic)\.com/, file);
    assert.doesNotMatch(text, /<link[^>]+href="https?:/, file);
  }
  const css = fs.readFileSync(path.join(siteRoot, 'src', 'ui', 'styles.css'), 'utf8');
  for (const [, url] of css.matchAll(/url\('([^']+\.woff2)'\)/g)) {
    assert.ok(fs.existsSync(path.join(siteRoot, 'src', 'ui', url)), `${url} is in the repository`);
  }
  assert.ok(fs.existsSync(path.join(siteRoot, 'vendor', 'fonts', 'instrument-sans', 'OFL.txt')), 'with its licence');
});



test('the privacy dialog and recorder share a declined answer when storage writes are denied', async () => {
  const storage = {
    getItem() { return JSON.stringify({ v: PRIVACY_VERSION, stats: true }); },
    setItem() { throw new Error('blocked'); },
  };
  const control = () => ({ addEventListener(_, click) { this.click = click; }, focus() {} });
  const children = Object.fromEntries(['privacy-state', 'privacy-accept', 'privacy-decline'].map((id) => [id, control()]));
  const banner = { hidden: true, querySelector: (id) => children[id.slice(1)] };
  const notice = { hidden: true };
  const calls = [];
  const recorder = createStudyRecorder(notice, {
    allowed: () => statsAllowed(storage),
    uuid: () => 'abcde123-1234-4234-8234-123456789abc',
    fetcher: async (url) => {
      calls.push(url);
      return url.endsWith('status') ? Response.json({ enabled: true }) : new Response(null, { status: 204 });
    },
  });
  const binding = bindPrivacyNotice(banner, { storage, onChange: recorder.refresh });
  await recorder.init();
  assert.equal(notice.hidden, false);

  binding.open();
  children['privacy-decline'].click();
  assert.equal(banner.hidden, true);
  assert.equal(notice.hidden, true);
  const input = { design: 'squiggle', dimensions: { width: 100, height: 100 } };
  for (const exportType of ['gcode-swatch', 'build-failure']) {
    assert.equal(await recorder.record({ ...input, exportType, failure: { code: 'move-limit' } }), false);
  }
  assert.deepEqual(calls, ['/api/study/status']);

  binding.open();
  assert.match(children['privacy-state'].textContent, /exports are not counted/);
  children['privacy-accept'].click();
  assert.equal(notice.hidden, false);
  assert.equal(await recorder.record({ ...input, exportType: 'gcode-swatch' }), true);
  assert.equal(calls.at(-1), '/api/study/exports');
});

test('the default privacy policy retains a decline if the localStorage property getter throws', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    savePrivacyChoice(false);
    assert.equal(statsAllowed(), false);
    assert.deepEqual(readPrivacyChoice(), { stats: false });
    savePrivacyChoice(true);
    assert.equal(statsAllowed(), true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
