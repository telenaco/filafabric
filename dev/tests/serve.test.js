import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../tools/serve.mjs';

function get(port, p) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: p, agent: false }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
      })
      .on('error', reject);
  });
}

test('serves index and files, 404s missing, blocks traversal', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>hi</h1>');
  fs.writeFileSync(path.join(dir, 'data.json'), '{"a":1}');
  const server = createServer(dir);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => {
    server.closeAllConnections?.();
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const { port } = server.address();

  const idx = await get(port, '/');
  assert.equal(idx.status, 200);
  assert.match(idx.type, /text\/html/);
  assert.equal(idx.body, '<h1>hi</h1>');

  const json = await get(port, '/data.json');
  assert.equal(json.status, 200);
  assert.match(json.type, /application\/json/);

  assert.equal((await get(port, '/missing.txt')).status, 404);
  assert.equal((await get(port, '/..%2f..%2fpackage.json')).status, 403);
});
