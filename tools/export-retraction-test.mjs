// Writes six small Zigzag mesh swatches to DemoTestingPrints/retraction-test/, each with its own retraction and extra
// push after a travel, lettered A to F, so they can be printed side by side and the starts after each travel compared.
//   node tools/export-retraction-test.mjs              50 x 30 mm, the six of the table below
//   node tools/export-retraction-test.mjs --size=60x40 another size (mm)
// Everything else is the Filaflex Foamy profile as it is (speed, temperatures, flow); the files are local (.gitignore).
import fs from 'node:fs';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';

const profile = (kind, id) => JSON.parse(fs.readFileSync(new URL(`../profiles/${kind}/${id}.json`, import.meta.url)));
const machine = profile('machines', 'prusa-mk3s');
const material = profile('materials', 'filaflex-95-foamy');
const OUT = new URL('../DemoTestingPrints/retraction-test/', import.meta.url);
const sizeArg = process.argv.find((a) => a.startsWith('--size='));
const [W, H] = sizeArg ? sizeArg.slice(7).split('x').map(Number) : [50, 30];
if (![W, H].every((n) => n >= 20 && n <= 200)) throw new Error('--size must be WxH, each 20 to 200 mm');

/** Retraction (mm) and the extra pushed back after it (mm): Recreus's 2.5-5 mm range, with and without a little extra. */
const PLAN = [[3, 0], [3, 0.2], [4, 0], [4, 0.2], [5, 0], [5, 0.2]];

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^[A-F]_.*\.gcode$/.test(f)) fs.unlinkSync(new URL(f, OUT));

const mod = designById('zigzag'), r = material.retraction;
const rows = PLAN.map(([length, extra], i) => {
  const letter = 'ABCDEF'[i];
  const tested = { ...material, retraction: { ...r, length, restart_extra: extra } };
  const result = generateDesignExport({ machine, material: tested, design: 'zigzag', settings: mod.defaults(), width: W, height: H, extraLayers: 0, brim: 2 });
  const name = `${letter}_zigzag_${W}x${H}mm_retract${length}_push${length + extra}.gcode`;
  const header = [
    `; Filafabric retraction test ${letter} of F: retract ${length} mm at ${r.speed} mm/s, push back ${length + extra} mm (${extra ? `${extra} mm extra` : 'no extra'}) at ${r.deretract_speed} mm/s`,
    `; Zigzag mesh ${W} x ${H} mm, ${result.stats.hops} travels: look at the first 2-5 mm after each one (thin, even or a blob) and at strings between them`,
    `; ${material.name}, everything else as its profile says`,
  ];
  fs.writeFileSync(new URL(name, OUT), `${header.join('\n')}\n${result.gcode}`);
  console.log(`${letter}  retract ${length}  push ${length + extra}  ${result.stats.hops} travels  ${Math.round(result.stats.timeSec / 60)} min  ${name}`);
  return { letter, length, extra, hops: result.stats.hops, minutes: Math.round(result.stats.timeSec / 60), name };
});

const md = [
  '# Retraction test',
  '',
  `Six ${W} x ${H} mm Zigzag mesh swatches in ${material.name}, each with its own retraction and extra push after a`,
  `travel. Retraction speed ${r.speed} mm/s, push-back speed ${r.deretract_speed} mm/s and everything else as the profile says.`,
  'Print them side by side and look at the first 2 to 5 mm after each travel: thin and filling in (more push needed),',
  'even (right), or a blob (too much), and at the strings between strands.',
  '',
  '| Swatch | Retract | Push back | Extra | Travels | Time | File |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map((x) => `| ${x.letter} | ${x.length} mm | ${x.length + x.extra} mm | ${x.extra} mm | ${x.hops} | ${x.minutes} min | \`${x.name}\` |`),
  '',
  'Then set the winner in the studio: Printer setup > Temperatures and retraction > Retraction on every travel and',
  'Extra push after travel. If even the best still starts thin, go on in 0.1 mm steps of extra push (up to about 0.4).',
  '',
  `Made by \`node tools/export-retraction-test.mjs\` (\`--size=60x40\` for another size).`,
  '',
].join('\n');
fs.writeFileSync(new URL('INDEX.md', OUT), md);
console.log(`\n${rows.length} files, about ${rows.reduce((a, x) => a + x.minutes, 0)} min, written to DemoTestingPrints/retraction-test/ with INDEX.md`);
