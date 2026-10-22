import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createSourceSnapshot, verifySourceSnapshot, decodeArchive, encodeArchive, archivePath, manifestPath } from '../tools/source-bundle.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filafabric-offer-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || String(result.error));
  };
  const write = (name, text) => { const location = path.join(root, name); fs.mkdirSync(path.dirname(location), { recursive: true }); fs.writeFileSync(location, text); };
  git('init', '--quiet'); git('config', 'core.autocrlf', 'false');
  write('src/app.js', 'export const value = 1;\n');
  write('package.json', '{"type":"module"}\n');
  git('add', '--', 'src/app.js', 'package.json');
  return { root, git, write, read: name => fs.readFileSync(path.join(root, name)) };
}

test('source offer excludes private untracked files even within an allowed source directory', t => {
  const f = fixture(t);
  f.write('src/private-customer-note.txt', 'PRIVATE FILE MUST NEVER BE PUBLISHED');
  f.write('personal-secret.txt', 'secret');
  f.write('.env', 'API_KEY=private'); f.git('add', '--', '.env');
  createSourceSnapshot(f.root);
  assert.deepEqual(decodeArchive(f.read(archivePath)).map(entry => entry.path), ['package.json', 'src/app.js']);
  assert.equal(verifySourceSnapshot(f.root).current, true);
});

test('currentness rejects edited, deleted and newly staged source before any commit', t => {
  const f = fixture(t);
  createSourceSnapshot(f.root);
  f.write('src/app.js', 'export const value = 2;\n');
  assert.throws(() => verifySourceSnapshot(f.root), /stale/);
  createSourceSnapshot(f.root); assert.equal(verifySourceSnapshot(f.root).current, true);
  fs.unlinkSync(path.join(f.root, 'src/app.js'));
  assert.throws(() => verifySourceSnapshot(f.root), /ENOENT/);
  f.write('src/app.js', 'export const value = 2;\n');
  f.write('src/new-feature.js', 'export const staged = true;\n');
  f.git('add', '--', 'src/new-feature.js');
  assert.throws(() => verifySourceSnapshot(f.root), /stale/);
  createSourceSnapshot(f.root);
  assert.equal(verifySourceSnapshot(f.root).files, 3);
});

test('archive and manifest are reproducible across text line endings and modification times', t => {
  const f = fixture(t); createSourceSnapshot(f.root);
  const archive = f.read(archivePath), manifest = f.read(manifestPath);
  f.write('src/app.js', 'export const value = 1;\r\n');
  fs.utimesSync(path.join(f.root, 'src/app.js'), new Date(), new Date('2001-01-01'));
  assert.equal(verifySourceSnapshot(f.root).current, true);
  createSourceSnapshot(f.root);
  assert.deepEqual(f.read(archivePath), archive); assert.deepEqual(f.read(manifestPath), manifest);
  assert.equal(decodeArchive(archive).find(entry => entry.path === 'src/app.js').data.toString(), 'export const value = 1;\n');
});

for (const mutation of ['missing', 'extra', 'duplicate', 'changed']) {
  test(`currentness rejects ${mutation} archive entries even with updated archive checksum`, t => {
    const f = fixture(t); createSourceSnapshot(f.root);
    const entries = decodeArchive(f.read(archivePath));
    if (mutation === 'missing') entries.pop();
    if (mutation === 'extra') entries.push({ path: 'src/secret.txt', data: Buffer.from('secret') });
    if (mutation === 'duplicate') entries.push(entries[0]);
    if (mutation === 'changed') entries[0].data = Buffer.from('changed');
    const archive = encodeArchive(entries);
    fs.writeFileSync(path.join(f.root, archivePath), archive);
    const manifest = JSON.parse(f.read(manifestPath));
    manifest.archiveSha256 = createHash('sha256').update(archive).digest('hex');
    fs.writeFileSync(path.join(f.root, manifestPath), JSON.stringify(manifest));
    assert.throws(() => verifySourceSnapshot(f.root), /stale/);
  });
}

test('currentness rejects manifest changes and checks the exact pinned kernel/source pair', t => {
  const f = fixture(t); createSourceSnapshot(f.root);
  const manifest = JSON.parse(f.read(manifestPath)); manifest.files.pop();
  f.write(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verifySourceSnapshot(f.root), /manifest is stale/);
  f.write('vendor/arachne/slicer_core.js', 'pinned kernel\r\n');
  f.write('vendor/arachne/corresponding-source.tar.gz', Buffer.from([0, 1, 2]));
  const hash = name => createHash('sha256').update(f.read(name)).digest('hex');
  f.write('vendor/arachne/provenance.json', JSON.stringify({ kernelSha256: hash('vendor/arachne/slicer_core.js'), sourceSha256: hash('vendor/arachne/corresponding-source.tar.gz') }));
  f.git('add', '--', 'vendor/arachne/slicer_core.js', 'vendor/arachne/corresponding-source.tar.gz', 'vendor/arachne/provenance.json');
  createSourceSnapshot(f.root);
  assert.deepEqual(decodeArchive(f.read(archivePath)).find(entry => entry.path.endsWith('slicer_core.js')).data, f.read('vendor/arachne/slicer_core.js'));
  f.write('vendor/arachne/slicer_core.js', 'different kernel\n');
  assert.throws(() => verifySourceSnapshot(f.root), /provenance mismatch/);
});

test('an engine without tracked matching-source provenance fails closed', t => {
  const f = fixture(t);
  f.write('vendor/arachne/slicer_core.js', 'kernel');
  f.git('add', '--', 'vendor/arachne/slicer_core.js');
  assert.throws(() => createSourceSnapshot(f.root), /provenance is missing/);
});
