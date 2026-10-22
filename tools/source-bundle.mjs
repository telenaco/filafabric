// Source-offer tooling. Only paths deliberately tracked/staged in Git can enter.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const archivePath = 'vendor/arachne/filafabric-source.tar.gz';
export const manifestPath = 'vendor/arachne/filafabric-source.manifest.json';
const sourceDirectories = ['src/', 'profiles/', 'tools/', 'tests/', 'vendor/', 'functions/', 'migrations/', 'templates/', 'samples/', 'docs/', 'reference/', '.github/'];
const sourceFiles = new Set(['.gitignore', 'CLAUDE.md', 'README.md', 'STUDY_SETUP.md', 'Run Textile Tool.bat', '_routes.json', 'index.html', 'study.html', 'source.html', 'package.json', 'package-lock.json', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'NOTICE', 'NOTICE.md']);
const textExtension = /\.(?:js|mjs|cjs|json|html|css|md|txt|svg|sql|yml|yaml|ini|bat|gcode)$/i;
const sha256 = data => createHash('sha256').update(data).digest('hex');
const byteOrder = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const validPath = name => name && !name.startsWith('/') && !name.includes('\\') && !/[\0\r\n]/.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..');
const allowed = name => name !== archivePath && name !== manifestPath && (sourceFiles.has(name) || sourceDirectories.some(dir => name.startsWith(dir)));

function gitFiles(root) {
  const result = spawnSync('git', ['ls-files', '--cached', '-z', '--', '.'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot list tracked/staged source: ${result.stderr || result.error}`);
  return [...new Set(result.stdout.split('\0').filter(Boolean))].filter(allowed).sort(byteOrder);
}

function canonicalBytes(name, data) {
  // Preserve the exact pinned engine bytes used by provenance.json.
  if (name === 'vendor/arachne/slicer_core.js') return data;
  return (textExtension.test(name) || name === '.gitignore' || name === 'LICENSE' || name === 'NOTICE')
    ? Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n')) : data;
}

function checkEngine(root, names) {
  const provenance = 'vendor/arachne/provenance.json';
  if (!names.some(name => ['vendor/arachne/slicer_core.js', 'vendor/arachne/corresponding-source.tar.gz', provenance].includes(name))) return;
  if (!names.includes(provenance)) throw new Error('Pinned engine/source provenance is missing');
  const pin = JSON.parse(fs.readFileSync(path.join(root, provenance), 'utf8'));
  for (const [name, expected] of [['vendor/arachne/slicer_core.js', pin.kernelSha256], ['vendor/arachne/corresponding-source.tar.gz', pin.sourceSha256]]) {
    if (!names.includes(name) || !/^[a-f0-9]{64}$/.test(expected || '') || sha256(fs.readFileSync(path.join(root, name))) !== expected) {
      throw new Error(`Pinned engine/source provenance mismatch: ${name}`);
    }
  }
}

function currentEntries(root) {
  const names = gitFiles(root);
  if (!names.length) throw new Error('No allowlisted tracked/staged source files found');
  const entries = names.map(name => {
    if (!validPath(name)) throw new Error(`Unsafe source path: ${name}`);
    // Reject symlinks in every component, including a directory symlink.
    let location = root;
    for (const part of name.split('/')) {
      location = path.join(location, part);
      if (fs.lstatSync(location).isSymbolicLink()) throw new Error(`Source symlink is not allowed: ${name}`);
    }
    if (!fs.statSync(location).isFile()) throw new Error(`Source is not a regular file: ${name}`);
    return { path: name, data: canonicalBytes(name, fs.readFileSync(location)) };
  });
  checkEngine(root, names);
  return entries;
}

function field(buffer, start, size, value) {
  const data = Buffer.from(value);
  if (data.length > size) throw new Error(`Tar field too long: ${value}`);
  data.copy(buffer, start);
}
function octal(buffer, start, size, value) { field(buffer, start, size, value.toString(8).padStart(size - 1, '0') + '\0'); }

export function encodeArchive(entries) {
  const blocks = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    let name = entry.path, prefix = '';
    if (Buffer.byteLength(name) > 100) {
      const split = [...name.matchAll(/\//g)].map(match => match.index).reverse().find(index => Buffer.byteLength(name.slice(0, index)) <= 155 && Buffer.byteLength(name.slice(index + 1)) <= 100);
      if (split === undefined) throw new Error(`Source path too long for ustar: ${name}`);
      prefix = name.slice(0, split); name = name.slice(split + 1);
    }
    field(header, 0, 100, name); octal(header, 100, 8, 0o644);
    octal(header, 108, 8, 0); octal(header, 116, 8, 0);
    octal(header, 124, 12, entry.data.length); octal(header, 136, 12, 0);
    header.fill(32, 148, 156); header[156] = 48;
    field(header, 257, 6, 'ustar\0'); field(header, 263, 2, '00'); field(header, 345, 155, prefix);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    field(header, 148, 8, checksum.toString(8).padStart(6, '0') + '\0 ');
    blocks.push(header, entry.data, Buffer.alloc((512 - entry.data.length % 512) % 512));
  }
  // gzipSync emits zero mtime; tar modes, uid/gid, names, order and mtime are fixed.
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]), { level: 9 });
}

export function decodeArchive(archive) {
  const tar = gunzipSync(archive), entries = [];
  const string = (header, start, size) => header.subarray(start, start + size).toString('utf8').replace(/\0.*$/s, '');
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      if (tar.length - offset < 1024 || tar.subarray(offset).some(byte => byte !== 0)) throw new Error('Invalid archive terminator');
      return entries;
    }
    const saved = parseInt(string(header, 148, 8).trim(), 8), check = Buffer.from(header);
    check.fill(32, 148, 156);
    if (saved !== check.reduce((sum, byte) => sum + byte, 0) || header[156] !== 48 || string(header, 257, 6) !== 'ustar') throw new Error('Invalid or unsupported archive entry');
    const prefix = string(header, 345, 155), name = (prefix ? prefix + '/' : '') + string(header, 0, 100);
    const size = parseInt(string(header, 124, 12), 8);
    if (!validPath(name) || !Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid archive path or size');
    entries.push({ path: name, data: tar.subarray(offset + 512, offset + 512 + size) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error('Truncated archive');
}

const inventory = entries => entries.map(entry => ({ path: entry.path, bytes: entry.data.length, sha256: sha256(entry.data) }));
function makeManifest(entries, archive) {
  return { format: 1, archive: archivePath, archiveSha256: sha256(archive), canonicalization: 'CRLF to LF for allowlisted text extensions; pinned slicer_core.js and binary files unchanged', files: inventory(entries) };
}

export function createSourceSnapshot(root) {
  const entries = currentEntries(root), archive = encodeArchive(entries), manifest = makeManifest(entries, archive);
  fs.mkdirSync(path.join(root, path.dirname(archivePath)), { recursive: true });
  fs.writeFileSync(path.join(root, archivePath), archive);
  fs.writeFileSync(path.join(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
  return { archive: archivePath, files: entries.length, sha256: manifest.archiveSha256 };
}

export function verifySourceSnapshot(root) {
  const expected = currentEntries(root), archive = fs.readFileSync(path.join(root, archivePath));
  const actual = decodeArchive(archive);
  if (JSON.stringify(inventory(actual)) !== JSON.stringify(inventory(expected))) throw new Error('Source archive is stale: missing, extra, reordered or changed source files. Run npm run source:snapshot.');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
  if (JSON.stringify(manifest) !== JSON.stringify(makeManifest(expected, archive))) throw new Error('Source manifest is stale or the archive checksum changed. Run npm run source:snapshot.');
  if (!archive.equals(encodeArchive(expected))) throw new Error('Source archive metadata/compression is not reproducible. Run npm run source:snapshot.');
  return { archive: archivePath, files: expected.length, sha256: sha256(archive), current: true };
}
