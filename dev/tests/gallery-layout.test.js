import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('gallery keeps the three main shelves without extra family subsections', () => {
  const source = fs.readFileSync(new URL('../../site/src/ui/main.js', import.meta.url), 'utf8');
  assert.match(source, /\['flat', 'layered', 'raised'\]\.map/);
  assert.match(source, /class: 'shelf-cards'/);
  assert.doesNotMatch(source, /class: 'family-group'|FAMILIES\[family\]\.label/);
});
