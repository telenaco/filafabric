import fs from 'node:fs';
import path from 'node:path';
import { generate } from '../src/engine/generate.js';
import { defaultProfiles, projectRoot } from '../tests/helpers.js';
import { goldenSummary } from '../tests/scene.js';

const { machine, material } = defaultProfiles();
const result = generate(machine, material, { sample_width: 20, sample_height: 20 });
const dir = path.join(projectRoot, 'tests', 'golden');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'sample20.json');
fs.writeFileSync(file, JSON.stringify(goldenSummary(result), null, 2) + '\n');
console.log('wrote', file);
