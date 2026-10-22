// Stage intended new source files, then rebuild the local public source offer.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSourceSnapshot } from './source-bundle.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { console.log(JSON.stringify(createSourceSnapshot(root))); }
catch (error) { console.error(error.message); process.exitCode = 1; }
