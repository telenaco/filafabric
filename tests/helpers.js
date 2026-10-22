import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadProfile(kind, id) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, 'profiles', kind, `${id}.json`), 'utf8'));
}

export function defaultProfiles() {
  return { machine: loadProfile('machines', 'prusa-mk3s'), material: loadProfile('materials', 'filaflex-95-foamy') };
}

/** Explicit active-retraction fixture for feature tests; current Foamy defaults disable filament retraction. */
export function retractingMaterial(material) {
  return { ...material, retraction: { ...material.retraction, length: 1, speed: 40, deretract_speed: 20, min_travel: 2, z_hop: 0.2 } };
}
