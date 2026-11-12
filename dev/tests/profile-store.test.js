import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProfileStore } from '../../site/src/ui/profile-store.js';

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

test('profiles can be added and removed in memory when accessing localStorage throws', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    const store = new ProfileStore();
    store.loadUser();
    const text = fs.readFileSync(new URL('../tests/fixtures/prusa-config.ini', import.meta.url), 'utf8');
    const { machines: [printer] } = store.add(text, 'printer.ini');
    assert.equal(store.machines.get(printer.id), printer);
    assert.equal(store.remove('machines', printer.id), true);
    assert.equal(store.machines.has(printer.id), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
