import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generate } from '../src/engine/generate.js';
import { defaultProfiles, projectRoot } from './helpers.js';
import { goldenSummary } from './scene.js';

test('20 x 20 golden summary matches (run `npm run golden` after an intended change)', () => {
  const file = path.join(projectRoot, 'tests', 'golden', 'sample20.json');
  assert.ok(fs.existsSync(file), 'golden file missing: run `npm run golden`');
  const golden = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { machine, material } = defaultProfiles();
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.deepEqual(goldenSummary(r), golden);
});
