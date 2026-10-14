// Sets the password of the studio's gate. Writes only a salted hash to src/ui/gate-config.json: the password itself
// is never stored.
//
//   node tools/set-password.mjs                 makes a random password and prints it once
//   node tools/set-password.mjs "your phrase"   uses that password
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeConfig, generatePassword } from '../src/ui/gate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const given = process.argv[2];
if (given !== undefined && given.length < 8) {
  console.error('Use a password of at least 8 characters.');
  process.exit(1);
}
const password = given ?? generatePassword();
const config = await makeConfig(password);
fs.writeFileSync(path.join(root, 'src', 'ui', 'gate-config.json'), `${JSON.stringify(config, null, 2)}\n`);
console.log('Gate password updated.');
if (given === undefined) console.log(`The new password is: ${password}`);
console.log('Commit src/ui/gate-config.json and push to publish it.');
