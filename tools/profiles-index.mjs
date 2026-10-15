// Lists the printer and filament files in profiles/machines and profiles/materials in profiles/index.json, which is
// what the studio reads (a static site cannot list a folder). Run it after adding or removing a file:
//   node tools/profiles-index.mjs
// The local server builds the same list on the fly, so while testing a dropped-in file just shows up.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROFILE_FILE = /\.(json|ini|gcode|cfg)$/i;

/** @returns { machines: string[], materials: string[] } the file names in each folder, sorted */
export function buildProfileIndex(root) {
  const list = (kind) => {
    const dir = path.join(root, 'profiles', kind);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => PROFILE_FILE.test(f) && !f.startsWith('.')).sort();
  };
  return { machines: list('machines'), materials: list('materials') };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const index = buildProfileIndex(root);
  fs.writeFileSync(path.join(root, 'profiles', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`profiles/index.json: ${index.machines.length} printer file(s), ${index.materials.length} filament file(s)`);
}
