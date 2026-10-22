import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySourceSnapshot } from '../tools/source-bundle.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('shipped source offer matches the current tracked/staged application', () => {
  assert.equal(verifySourceSnapshot(projectRoot).current, true);
});
