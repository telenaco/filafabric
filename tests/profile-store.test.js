import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProfileStore } from '../src/ui/profile-store.js';

test('import warnings and exact layer defaults survive closing and reopening the profile store', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const first = new ProfileStore(storage);
  const text = fs.readFileSync(new URL('../tests/fixtures/prusa-config.ini', import.meta.url), 'utf8') + '\nlayer_height = 0.28';
  const got = first.add(text, 'printer.ini');
  assert.ok(first.notesFor('machines', got.machines[0].id).length > 0, 'unsupported startup macros are explained');
  const reopened = new ProfileStore(storage);
  reopened.loadUser();
  assert.equal(reopened.machines.get(got.machines[0].id).print_defaults.layer_height, .28);
  assert.deepEqual(reopened.notesFor('machines', got.machines[0].id), first.notesFor('machines', got.machines[0].id));
});
