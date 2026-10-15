// Counts what a folder of exported G-code files was made with, from their names alone (src/ui/file-name.js): which
// designs, which presets, and which value of each setting, most used first.
//   node tools/tally-exports.mjs "C:/Users/me/Downloads"
//   node tools/tally-exports.mjs DemoTestingPrints --json     the counts as JSON, to put in a spreadsheet
import fs from 'node:fs';
import path from 'node:path';
import { parseFileName } from '../src/ui/file-name.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const folder = args.find((a) => !a.startsWith('--'));
if (!folder) {
  console.error('Usage: node tools/tally-exports.mjs <folder> [--json]');
  process.exit(1);
}

const files = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.gcode'));
const read = files.map((f) => parseFileName(path.basename(f))).filter(Boolean);
const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const designs = new Map(), presets = new Map(), setups = new Map(), materials = new Map();
const settings = new Map(); // "design setting" -> Map(value -> count)
for (const r of read) {
  count(designs, r.design);
  count(presets, `${r.design} ${r.preset}`);
  if (r.layerHeight !== null) count(setups, `${r.layerHeight} mm x ${r.layers}`);
  if (r.material) count(materials, r.material);
  for (const [key, value] of Object.entries(r.settings)) {
    const k = `${r.design} ${key}`;
    if (!settings.has(k)) settings.set(k, new Map());
    count(settings.get(k), value);
  }
}

const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
if (json) {
  const obj = (map) => Object.fromEntries(sorted(map));
  console.log(JSON.stringify({
    files: files.length, read: read.length,
    designs: obj(designs), presets: obj(presets), layers: obj(setups), materials: obj(materials),
    settings: Object.fromEntries([...settings.entries()].sort().map(([k, m]) => [k, obj(m)])),
  }, null, 2));
} else {
  console.log(`${read.length} of ${files.length} G-code files have a studio name.\n`);
  const table = (title, map) => {
    console.log(title);
    for (const [k, n] of sorted(map)) console.log(`  ${String(n).padStart(4)}  ${k}`);
    console.log('');
  };
  table('Designs', designs);
  table('Presets', presets);
  table('Layer thickness x layers', setups);
  table('Filaments', materials);
  console.log('Settings (design, setting: value x count)');
  for (const [k, m] of [...settings.entries()].sort()) console.log(`  ${k}: ${sorted(m).map(([v, n]) => `${v} x${n}`).join(', ')}`);
}
