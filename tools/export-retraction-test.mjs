// Writes six small Zigzag mesh swatches to DemoTestingPrints/retraction-test/, each with its own retraction and extra
// push after a travel, lettered A to F, so the starts after each travel can be compared: one print with all six on the
// bed (the plate), and each on its own.
//   node tools/export-retraction-test.mjs              50 x 30 mm swatches, the six of the table below
//   node tools/export-retraction-test.mjs --size=60x40 another size (mm)
// Everything else is the Filaflex Foamy profile as it is (speed, temperatures, flow); the files are local (.gitignore).
import fs from 'node:fs';
import { generateDesignExport } from '../src/engine/design-export.js';
import { resolveConfig } from '../src/engine/params.js';
import { emitStrands } from '../src/engine/emit.js';
import { computeStats } from '../src/engine/stats.js';
import { writeGcode } from '../src/engine/gcode.js';
import { designById } from '../src/ui/designs.js';
import { plateMoves } from './plate.mjs';

const profile = (kind, id) => JSON.parse(fs.readFileSync(new URL(`../profiles/${kind}/${id}.json`, import.meta.url)));
const machine = profile('machines', 'prusa-mk3s');
const material = profile('materials', 'filaflex-95-foamy');
const OUT = new URL('../DemoTestingPrints/retraction-test/', import.meta.url);
const sizeArg = process.argv.find((a) => a.startsWith('--size='));
const [W, H] = sizeArg ? sizeArg.slice(7).split('x').map(Number) : [50, 30];
if (![W, H].every((n) => n >= 20 && n <= 200)) throw new Error('--size must be WxH, each 20 to 200 mm');

/** Retraction (mm) and the extra pushed back after it (mm): Recreus's 2.5-5 mm range, with and without a little extra. */
const PLAN = [[3, 0], [3, 0.2], [4, 0], [4, 0.2], [5, 0], [5, 0.2]];
// the plate: three swatches a row, A B C at the front of the bed and D E F behind; left of each, as many short bars as
// its place in the alphabet (A one, F six), so a swatch can be told once it is off the bed
const COLUMNS = 3, GAP_X = 12, GAP_Y = 8, MARGIN = 10, BAR = { length: 10, pitch: 1.2, inset: 3 };

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^([A-F]|ALL)_.*\.gcode$/.test(f)) fs.unlinkSync(new URL(f, OUT));

const mod = designById('zigzag'), r = material.retraction;
const swatches = PLAN.map(([length, extra], i) => {
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
  return { letter, length, extra, result, name, hops: result.stats.hops, minutes: Math.round(result.stats.timeSec / 60) };
});

/* ---------- all six on one print ---------- */

const rows = Math.ceil(PLAN.length / COLUMNS);
const plateW = MARGIN + COLUMNS * W + (COLUMNS - 1) * GAP_X, plateH = rows * H + (rows - 1) * GAP_Y;
const plateCfg = resolveConfig(machine, material, { sample_width: plateW, sample_height: plateH });
const h = plateCfg.t.layer_height;

// each swatch is two parts with its own settings: its bars (short lines on the bed left of it, one for A up to six for
// F), then the swatch itself
const moves = plateMoves(swatches.flatMap((sw, i) => {
  const at = [MARGIN + (i % COLUMNS) * (W + GAP_X), Math.floor(i / COLUMNS) * (H + GAP_Y)];
  const retraction = sw.result.cfg.derived.retraction;
  const bars = Array.from({ length: i + 1 }, (_, b) => {
    const x = -BAR.inset - b * BAR.pitch, y0 = (H - BAR.length) / 2;
    return { id: `bar-${b + 1}`, kind: 'base', name: `Mark ${sw.letter}`, pts: [{ x, y: y0, z: h }, { x, y: y0 + BAR.length, z: h }] };
  });
  return [{ moves: emitStrands(bars, { retraction }), retraction, at, tag: sw.letter }, { moves: sw.result.moves, retraction, at, tag: sw.letter }];
}));

const stats = computeStats(moves, plateCfg, []);
const comments = [
  `Filafabric retraction test plate: six Zigzag mesh swatches of ${W} x ${H} mm, each with its own retraction, printed one after the other`,
  'Front row left to right A B C, back row D E F; left of each, A one short bar up to F six',
  ...swatches.map((s) => `${s.letter}: retract ${s.length} mm, push back ${s.length + s.extra} mm (${s.extra ? `${s.extra} mm extra` : 'no extra'}), ${s.hops} travels`),
  `Retraction speed ${r.speed} mm/s and push-back speed ${r.deretract_speed} mm/s for all; the move between two swatches retracts and primes with the settings of the one it leaves`,
];
const plateName = `ALL_A-F_zigzag_${W}x${H}mm_plate_${plateW}x${plateH}mm.gcode`;
fs.writeFileSync(new URL(plateName, OUT), writeGcode(moves, plateCfg, { stats, comments }));

const retracts = moves.filter((m) => m.retract === 'retract').length;
const minutes = Math.round(stats.timeSec / 60);
for (const s of swatches) console.log(`${s.letter}  retract ${s.length}  push ${s.length + s.extra}  ${s.hops} travels  ${s.minutes} min  ${s.name}`);
console.log(`ALL  ${plateW} x ${plateH} mm on the bed, ${retracts} travels, about ${minutes} min  ${plateName}`);

const md = [
  '# Retraction test',
  '',
  `Six ${W} x ${H} mm Zigzag mesh swatches in ${material.name}, each with its own retraction and extra push after a`,
  `travel. Retraction speed ${r.speed} mm/s, push-back speed ${r.deretract_speed} mm/s and everything else as the profile says.`,
  'Look at the first 2 to 5 mm after each travel: thin and filling in (more push needed), even (right), or a blob (too',
  'much), and at the strings between strands.',
  '',
  `**One print with all six:** \`${plateName}\`, ${plateW} x ${plateH} mm in the middle of the bed, about ${minutes} min.`,
  'Front row left to right A, B, C; back row D, E, F. Left of each swatch are short bars: one for A, two for B, up to',
  'six for F, so they can be told apart once they are off the bed. Each swatch prints whole before the next.',
  '',
  '| Swatch | Bars | Retract | Push back | Extra | Travels | On its own | File |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...swatches.map((x, i) => `| ${x.letter} | ${i + 1} | ${x.length} mm | ${x.length + x.extra} mm | ${x.extra} mm | ${x.hops} | ${x.minutes} min | \`${x.name}\` |`),
  '',
  'Then set the winner in the studio: Printer setup > Temperatures and retraction > Retraction on every travel and',
  'Extra push after travel. If even the best still starts thin, go on in 0.1 mm steps of extra push (up to about 0.4).',
  '',
  `Made by \`node tools/export-retraction-test.mjs\` (\`--size=60x40\` for another size).`,
  '',
].join('\n');
fs.writeFileSync(new URL('INDEX.md', OUT), md);
console.log('\nwritten to DemoTestingPrints/retraction-test/ with INDEX.md');
