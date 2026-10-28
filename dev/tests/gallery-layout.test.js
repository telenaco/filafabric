import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('gallery renders registered shelves including Experimental without extra family subsections', () => {
  const source = fs.readFileSync(new URL('../../site/src/ui/main.js', import.meta.url), 'utf8');
  assert.match(source, /Object\.keys\(SHELVES\)\.map/);
  assert.match(source, /el\('details', \{ class: `library-shelf shelf-\$\{shelf\}`, open: shelf === 'flat' \}\)/);
  assert.match(source, /class: 'shelf-cards'/);
  assert.match(source, /el\('summary', \{ class: 'shelf-heading'/);
  assert.doesNotMatch(source, /class: 'family-group'|FAMILIES\[family\]\.label/);
});
