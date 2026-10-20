import test from 'node:test';
import assert from 'node:assert/strict';
import { machineSuggestions } from '../src/ui/machine-search.js';

const entries = ['First', 'Ender-3', 'Ender-3 V2', 'Ender-3 Pro', 'My MK3.5'].map((name, i) => ({ id: String(i), name, vendor: 'printer', nozzle: .4 }));

test('the idle printer picker offers only two entries, keeping the selected printer first', () => {
  assert.deepEqual(machineSuggestions(entries, '', '4').map(m => m.id), ['4', '0']);
  assert.deepEqual(machineSuggestions(entries, '  ', 'missing').map(m => m.id), ['0', '1']);
  assert.equal(machineSuggestions([], '', 'missing').length, 0);
  assert.equal(machineSuggestions(entries.slice(0, 1), '', '0').length, 1);
});

test('typing searches the full library instead of only the two suggestions', () => {
  assert.equal(machineSuggestions(entries, 'ender', '4').length, 3);
  assert.equal(machineSuggestions(entries, 'mk3.5', '0')[0].id, '4');
  assert.equal(machineSuggestions(entries, 'no such printer', '0').length, 0);
});
