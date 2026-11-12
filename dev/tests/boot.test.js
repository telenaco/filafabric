import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = fs.readFileSync(new URL('../../site/src/boot.js', import.meta.url), 'utf8');
const code = source.replace(/^import .*$/m, '').replace(/\nstart\(\);\s*$/, '');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function fixture({ config = {}, fetcher, password = async () => false, local = new Map(), session = new Map() } = {}) {
  const classes = new Set(['locked']);
  const node = (id = '') => ({
    id, disabled: id === 'gate-submit', hidden: true, listeners: {}, children: [],
    addEventListener(type, fn) { this.listeners[type] = fn; },
    append(...children) { this.children.push(...children); },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    remove() { this.removed = true; },
  });
  const nodes = Object.fromEntries(['gate', 'gate-form', 'gate-password', 'gate-error', 'gate-submit', 'gate-remember', 'btn-lock'].map((id) => [id, node(id)]));
  const storage = (data) => ({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  });
  let reloads = 0;
  const logged = [];
  const start = runInNewContext(code + '\nstart;', {
    document: { getElementById: (id) => nodes[id], body: { classList: { remove: (name) => classes.delete(name) } }, createElement: () => node() },
    fetch: fetcher ?? (async () => ({ ok: true, json: async () => config })),
    verifyPassword: password,
    unlockToken: () => 'token',
    localStorage: storage(local),
    sessionStorage: storage(session),
    location: { reload() { reloads++; } },
    console: { error(error) { logged.push(error); } },
  });
  return { start, nodes, local, session, logged, locked: () => classes.has('locked'), reloads: () => reloads };
}

const submit = (nodes) => nodes['gate-form'].listeners.submit({ preventDefault() {} });

test('login stays disabled until the password config and submit handler are ready', async () => {
  const html = fs.readFileSync(new URL('../../site/index.html', import.meta.url), 'utf8');
  assert.match(html, /<button\b[^>]*id="gate-submit"[^>]*\bdisabled\b/);
  const response = deferred();
  const { start, nodes } = fixture({ fetcher: () => response.promise });
  const pending = start();
  assert.equal(nodes['gate-submit'].disabled, true);
  assert.equal(nodes['gate-form'].listeners.submit, undefined);
  response.resolve({ ok: true, json: async () => ({}) });
  await pending;
  assert.equal(typeof nodes['gate-form'].listeners.submit, 'function');
  assert.equal(nodes['gate-submit'].disabled, false);
  assert.equal(nodes['gate-password'].focused, true);
});

test('a failed login configuration leaves the gate locked and offers a reload', async () => {
  const { start, nodes, locked, reloads } = fixture({ fetcher: async () => { throw new Error('offline'); } });
  await start();
  assert.equal(locked(), true);
  assert.equal(nodes['gate-submit'].disabled, true);
  assert.equal(nodes['gate-error'].hidden, false);
  assert.match(nodes['gate-error'].textContent, /studio could not start/i);
  const retry = nodes['gate-error'].children.at(-1);
  assert.equal(retry.textContent, 'Reload page');
  assert.equal(retry.focused, true);
  retry.listeners.click();
  assert.equal(reloads(), 1);
});

test('one password check is allowed at a time and an incorrect password can be retried', async () => {
  const checked = deferred();
  let checks = 0;
  const { start, nodes, locked } = fixture({ password: () => { checks++; return checked.promise; } });
  await start();
  const first = submit(nodes);
  const repeated = submit(nodes);
  assert.equal(checks, 1);
  checked.resolve(false);
  await Promise.all([first, repeated]);
  assert.equal(locked(), true);
  assert.equal(nodes['gate-submit'].disabled, false);
  assert.match(nodes['gate-error'].textContent, /not the password/);
  assert.equal(nodes['gate-password'].selected, true);
});

test('a correct password unlocks the page only after studio initialization succeeds', async () => {
  const loading = deferred();
  const ready = deferred();
  const importing = deferred();
  const initializing = deferred();
  const { start, nodes, locked, session, local, reloads } = fixture({ password: async () => true });
  await start({ loadStudio: () => { importing.resolve(); return loading.promise; } });
  const pending = submit(nodes);
  await importing.promise;
  assert.equal(locked(), true);
  assert.equal(nodes.gate.removed, undefined);
  loading.resolve({ init() { initializing.resolve(); return ready.promise; } });
  await initializing.promise;
  assert.equal(locked(), true);
  assert.equal(nodes.gate.removed, undefined);
  ready.resolve();
  await pending;
  assert.equal(locked(), false);
  assert.equal(nodes.gate.removed, true);
  assert.equal(session.get('filafabric:unlock'), 'token');
  assert.equal(local.size, 0);
  nodes['btn-lock'].listeners.click();
  assert.equal(session.size, 0);
  assert.equal(reloads(), 1);
});

test('a remembered unlock initializes the studio and an intentionally open gate hides the lock button', async () => {
  for (const [open, local] of [[false, new Map([['filafabric:unlock', 'token']])], [true, new Map()]]) {
    const { start, nodes, locked } = fixture({ config: { open }, local });
    let initialized = 0;
    await start({ loadStudio: async () => ({ init() { initialized++; } }) });
    assert.equal(initialized, 1);
    assert.equal(locked(), false);
    assert.equal(nodes['gate-form'].listeners.submit, undefined);
    assert.equal(!!nodes['btn-lock'].removed, open);
  }
});

test('module and studio initialization failures leave a visible gate and offer a fresh reload', async () => {
  const error = new Error('failed studio');
  for (const loadStudio of [
    async () => { throw error; },
    async () => ({ async init() { throw error; } }),
  ]) {
    const { start, nodes, locked, logged, reloads } = fixture({ config: { open: true } });
    await start({ loadStudio });
    assert.equal(locked(), true);
    assert.equal(nodes.gate.removed, undefined);
    assert.equal(nodes['gate-submit'].disabled, true);
    assert.equal(nodes['gate-error'].hidden, false);
    assert.match(nodes['gate-error'].textContent, /studio could not start/i);
    assert.deepEqual(logged, [error]);
    nodes['gate-error'].children.at(-1).listeners.click();
    assert.equal(reloads(), 1);
  }
});
