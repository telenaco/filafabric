// Import one baseline for each Generic filament in a PrusaSlicer vendor bundle.
// node tools/import-generic-filaments.mjs "C:/Users/.../PrusaSlicer/vendor/PrusaResearch.ini"
// Existing studio profiles are preserved; only missing materials are written.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseConfigText, importProfiles } from '../src/engine/profile-import.js';
import { buildProfileIndex } from './profiles-index.mjs';

const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
const REPOSITORY = 'https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff';

export function buildGenericFilaments(text) {
  const sections = parseConfigText(text);
  const version = sections.find(s => s.kind === 'vendor')?.values.config_version ?? 'unknown';
  const resolve = (kind, name, trail = []) => {
    const key = `${kind}:${name}`;
    if (trail.includes(key)) throw new Error(`Cyclic inheritance: ${key}`);
    const section = sections.find(s => s.kind === kind && s.name === name);
    if (!section) throw new Error(`Missing parent preset: ${key}`);
    const parents = String(section.values.inherits ?? '').split(';').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    const values = Object.assign({}, ...parents.map(parent => resolve(kind, parent, [...trail, key])), section.values);
    delete values.inherits;
    return values;
  };
  const groups = Map.groupBy(sections.filter(s => s.kind === 'filament' && /^Generic /.test(s.name)), s => s.name.split(' @')[0]);
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, variants]) => {
    const preset = variants.find(s => s.name === name) ?? variants[0];
    const variant = preset.name.includes(' @');
    const printerName = /COREONEINDX/.test(preset.name) ? 'Prusa CORE One INDX 8T HF0.4 nozzle'
      : /PGIS/.test(preset.name) ? 'Original Prusa MK4 Input Shaper 0.4 nozzle'
      : 'Original Prusa i3 MK3S & MK3S+';
    const printer = sections.some(s => s.kind === 'printer' && s.name === printerName) ? resolve('printer', printerName) : {};
    const values = resolve('filament', preset.name);
    const { materials: [material] } = importProfiles(JSON.stringify({ ...printer, ...values, type: 'filament', name: preset.name,
      // Keep printer defaults for retraction only; a printer's geometry would make this a machine import.
      bed_shape: undefined, printable_area: undefined, printer_settings_id: undefined,
    }), 'prusa-generic.json');
    material.id = name === 'Generic FLEX' ? 'generic-flex-mk3' : slug(name);
    material.name = name === 'Generic FLEX' ? 'Generic FLEX (TPU, MK3, 0.4 mm)' : variant ? preset.name : name;
    const fan = String(values.cooling) === '0' && String(values.fan_always_on) !== '1' ? 0 : Number(values.min_fan_speed ?? 0);
    material.fan.default = fan;
    material.print_defaults = { fan_base: 0, fan_supported: fan, fan_nonplanar: fan, fan_unsupported: fan, fan_travel: 0 };
    material.source = `PrusaResearch ${version}: ${preset.name}; ${printerName} reference`;
    material.notes = 'PrusaSlicer reference settings. Cooling is adapted to path roles; gradual layer cooling, filament startup commands and printer compatibility conditions are not reproduced. Match this reference to your printer and spool.';
    material.provenance = { repository: REPOSITORY, bundle_version: version, preset: preset.name, reference_printer: printerName,
      source_url: `${REPOSITORY}/blob/main/PrusaResearch/${version}.ini`, physically_verified: false };
    return material;
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (!process.argv[2]) throw new Error('Pass the path to PrusaResearch.ini');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const material of buildGenericFilaments(fs.readFileSync(process.argv[2], 'utf8'))) {
    const file = path.join(root, 'profiles/materials', `${material.id}.json`);
    if (fs.existsSync(file)) { console.log(`Kept ${material.id}`); continue; }
    fs.writeFileSync(file, `${JSON.stringify(material, null, 2)}\n`);
    console.log(`Added ${material.name}`);
  }
  fs.writeFileSync(path.join(root, 'profiles/index.json'), `${JSON.stringify(buildProfileIndex(root), null, 2)}\n`);
}
