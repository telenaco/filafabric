import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'three');
const dst = path.join(root, 'vendor', 'three');
fs.mkdirSync(path.join(dst, 'addons', 'controls'), { recursive: true });
fs.copyFileSync(path.join(src, 'build', 'three.module.js'), path.join(dst, 'three.module.js'));
fs.copyFileSync(path.join(src, 'examples', 'jsm', 'controls', 'OrbitControls.js'), path.join(dst, 'addons', 'controls', 'OrbitControls.js'));
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(dst, 'LICENSE'));
const version = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')).version;
console.log(`vendored three ${version} into vendor/three`);
