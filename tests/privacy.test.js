import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PRIVACY_VERSION, readPrivacyChoice, savePrivacyChoice, statsAllowed } from '../src/ui/privacy.js';
import { createStudyRecorder } from '../src/ui/study.js';
import { projectRoot } from './helpers.js';

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
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  for (const id of ['privacy-banner', 'privacy-accept', 'privacy-decline', 'privacy-state', 'privacy-feedback', 'btn-privacy']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /no cookies/i);
});

test('no page loads its font or styles from another site', () => {
  for (const file of ['index.html', 'study.html', path.join('src', 'ui', 'styles.css')]) {
    const text = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    assert.doesNotMatch(text, /fonts\.(googleapis|gstatic)\.com/, file);
    assert.doesNotMatch(text, /<link[^>]+href="https?:/, file);
  }
  const css = fs.readFileSync(path.join(projectRoot, 'src', 'ui', 'styles.css'), 'utf8');
  for (const [, url] of css.matchAll(/url\('([^']+\.woff2)'\)/g)) {
    assert.ok(fs.existsSync(path.join(projectRoot, 'src', 'ui', url)), `${url} is in the repository`);
  }
  assert.ok(fs.existsSync(path.join(projectRoot, 'vendor', 'fonts', 'instrument-sans', 'OFL.txt')), 'with its licence');
});
