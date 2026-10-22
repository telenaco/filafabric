// Fail when the offer differs from current allowlisted tracked/staged sources.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySourceSnapshot } from './source-bundle.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { console.log(JSON.stringify(verifySourceSnapshot(root))); }
catch (error) { console.error(error.message); process.exitCode = 1; }
