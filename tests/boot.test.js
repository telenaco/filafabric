import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = fs.readFileSync(new URL('../src/boot.js', import.meta.url), 'utf8');
const start = source.match(/async function start\(\)[^]*?\n}/)[0];

test('login stays disabled until the password config and submit handler are ready', async () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<button\b[^>]*id="gate-submit"[^>]*\bdisabled\b/);
  let deliver;
  const nodes = Object.fromEntries(['gate-form', 'gate-password', 'gate-error', 'gate-submit'].map((id) => [id, { disabled: true, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, focus() {} }]));
  const host = { $: (id) => nodes[id], fetch: () => new Promise((resolve) => { deliver = resolve; }), keep: { get: () => null }, unlockToken: () => 'token', console };
  const pending = runInNewContext(`${start}\nstart();`, host);
  assert.equal(nodes['gate-submit'].disabled, true);
  assert.equal(nodes['gate-form'].listeners.submit, undefined);
  deliver({ ok: true, json: async () => ({}) });
  await pending;
  assert.equal(typeof nodes['gate-form'].listeners.submit, 'function');
  assert.equal(nodes['gate-submit'].disabled, false);
});

test('a failed login configuration keeps submission disabled and explains the retry', async () => {
  const nodes = { 'gate-submit': { disabled: true }, 'gate-error': { hidden: true, textContent: '' } };
  await runInNewContext(`${start}\nstart();`, { $: (id) => nodes[id], fetch: async () => { throw new Error('offline'); }, console: { error() {} } });
  assert.equal(nodes['gate-submit'].disabled, true);
  assert.equal(nodes['gate-error'].hidden, false);
  assert.match(nodes['gate-error'].textContent, /Reload the page/);
});
