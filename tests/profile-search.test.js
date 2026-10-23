import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProfileNames } from '../src/ui/profile-picker.js';

test('filament search lists names alphabetically and finds TPU regardless of punctuation', () => {
  const entries = [{ id: 'r', name: 'Recreus Filaflex' }, { id: 'p', name: 'Generic PLA' }, { id: 'f', name: 'Generic FLEX (TPU, MK3)' }];
  assert.deepEqual(searchProfileNames(entries, '').map(p => p.id), ['f', 'p', 'r']);
  assert.deepEqual(searchProfileNames(entries, 'tpu mk3').map(p => p.id), ['f']);
  assert.deepEqual(searchProfileNames(entries, 'not-a-filament'), []);
  assert.deepEqual(entries.map(p => p.id), ['r', 'p', 'f']);
});
