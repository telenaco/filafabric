import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { deriveHash, makeConfig, verifyPassword, unlockToken, generatePassword, ITERATIONS } from '../src/ui/gate.js';
import { projectRoot } from './helpers.js';

// a low count keeps the tests quick; the shipped config uses ITERATIONS
const FAST = { iterations: 1000 };

test('the same password and salt give the same hash; another salt or password does not', async () => {
  const a = await deriveHash('correct horse', 'aa'.repeat(16), 1000);
  assert.equal(a, await deriveHash('correct horse', 'aa'.repeat(16), 1000));
  assert.notEqual(a, await deriveHash('correct horse', 'bb'.repeat(16), 1000));
  assert.notEqual(a, await deriveHash('correct horsf', 'aa'.repeat(16), 1000));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('only the right password opens the gate', async () => {
  const config = await makeConfig('tester-secret-1', FAST);
  assert.equal(await verifyPassword('tester-secret-1', config), true);
  assert.equal(await verifyPassword('tester-secret-2', config), false);
  assert.equal(await verifyPassword('', config), false);
  assert.equal(await verifyPassword('tester-secret-1', null), false);
  assert.equal(await verifyPassword('tester-secret-1', { salt: 'ab' }), false);
  assert.equal(await verifyPassword(undefined, config), false);
});

test('the config holds a salted hash and never the password', async () => {
  const config = await makeConfig('tester-secret-1', FAST);
  assert.deepEqual(Object.keys(config).sort(), ['hash', 'iterations', 'salt', 'v']);
  assert.equal(JSON.stringify(config).includes('tester-secret-1'), false);
  const other = await makeConfig('tester-secret-1', FAST);
  assert.notEqual(config.salt, other.salt, 'a fresh salt each time');
});

test('the unlock token is not the password, and changes when the password changes', async () => {
  const a = await makeConfig('tester-secret-1', FAST);
  const b = await makeConfig('tester-secret-2', FAST);
  assert.notEqual(unlockToken(a), unlockToken(b));
  assert.equal(unlockToken(a).includes('tester-secret-1'), false);
});

test('generated passwords are long, readable and different each time', () => {
  const a = generatePassword();
  assert.match(a, /^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{2}$/);
  assert.notEqual(a, generatePassword());
});

test('the shipped config is well formed and uses the full iteration count', () => {
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src', 'ui', 'gate-config.json'), 'utf8'));
  assert.equal(config.v, 1);
  assert.equal(config.iterations, ITERATIONS);
  assert.match(config.salt, /^[0-9a-f]{32}$/);
  assert.match(config.hash, /^[0-9a-f]{64}$/);
});

test('the page loads the studio only through the gate', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert.match(html, /<body class="locked">/);
  const bootSrc = html.match(/<script type="module" src="([^"]+)"/)?.[1];
  const bootUrl = new URL(bootSrc, 'http://localhost/');
  assert.equal(bootUrl.pathname, '/src/boot.js');
  assert.ok(bootUrl.searchParams.get('v'), 'the gate markup loads a matching startup script despite older browser caches');
  assert.equal(html.includes('src/ui/main.js'), false, 'the studio is imported by boot.js after the password, never directly');
  for (const id of ['gate', 'gate-form', 'gate-password', 'gate-submit', 'gate-error', 'gate-remember', 'btn-lock']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /Coming soon/);
});

test('boot.js imports the studio dynamically, so nothing of it runs behind the gate', () => {
  const boot = fs.readFileSync(path.join(projectRoot, 'src', 'boot.js'), 'utf8');
  const studioSrc = boot.match(/await import\('([^']+)'\)/)?.[1];
  const studioUrl = new URL(studioSrc, 'http://localhost/src/boot.js');
  assert.equal(studioUrl.pathname, '/src/ui/main.js');
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const bootSrc = html.match(/<script type="module" src="([^"]+)"/)?.[1];
  const bootUrl = new URL(bootSrc, 'http://localhost/');
  assert.ok(studioUrl.searchParams.get('v'), 'a returning browser must not reuse the old unversioned studio loader');
  assert.equal(studioUrl.searchParams.get('v'), bootUrl.searchParams.get('v'), 'page, bootstrap and studio load the same release');
  assert.equal(/^import .* from '\.\/ui\/main\.js'/m.test(boot), false);
});
