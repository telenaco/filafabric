// Writes one print of small circles to DemoTestingPrints/seam-test/ for judging the start and the close of a strand: each
// circle is a 20 mm two-line brim (the studio's own, two loops overlapping 20%, on the first layer), where a strand starts
// and closes on the same spot, so a blob or a gap there shows at once. Nine blocks of four circles, each block with its
// own extra push after a travel and its own push-back speed; the retraction itself is the same 4 mm at 65 mm/s for all.
//   node tools/export-seam-test.mjs
// Everything else is the Filaflex Foamy profile as it is; the file is local (.gitignore).
import fs from 'node:fs';
import { resolveConfig } from '../src/engine/params.js';
import { buildBrimStrands } from '../src/engine/brim.js';
import { emitStrands } from '../src/engine/emit.js';
import { computeStats } from '../src/engine/stats.js';
import { writeGcode } from '../src/engine/gcode.js';
import { plateMoves } from './plate.mjs';

const profile = (kind, id) => JSON.parse(fs.readFileSync(new URL(`../profiles/${kind}/${id}.json`, import.meta.url)));
const machine = profile('machines', 'prusa-mk3s');
const material = profile('materials', 'filaflex-95-foamy');
const OUT = new URL('../DemoTestingPrints/seam-test/', import.meta.url);

// columns left to right: the extra push after a travel; rows front to back: the push-back speed
const EXTRAS = [0.1, 0.2, 0.3], SPEEDS = [15, 25, 40];
const DIAMETER = 20, CIRCLE_GAP = 6, BLOCK_GAP = 14, LINES = 2;
const BLOCK = 2 * DIAMETER + CIRCLE_GAP;
const plateSize = EXTRAS.length * BLOCK + (EXTRAS.length - 1) * BLOCK_GAP;
const r = material.retraction;

const cfg = resolveConfig(machine, material, { sample_width: plateSize, sample_height: plateSize });
const { layer_height: h, extrusion_width: bead } = cfg.t;

/** A circle of the given diameter whose box starts at (x, y). */
const circle = (x, y, d = DIAMETER, n = 96) => Array.from({ length: n }, (_, i) => ({ x: x + d / 2 + (d / 2) * Math.cos((2 * Math.PI * i) / n), y: y + d / 2 + (d / 2) * Math.sin((2 * Math.PI * i) / n) }));

// the four circles of a block, as the studio prints a two-line brim round each: two loops, each starting and closing on itself
const circles = [[0, 0], [DIAMETER + CIRCLE_GAP, 0], [0, DIAMETER + CIRCLE_GAP], [DIAMETER + CIRCLE_GAP, DIAMETER + CIRCLE_GAP]]
  .flatMap(([x, y], c) => buildBrimStrands([circle(x, y)], { count: LINES, strandWidth: bead, layerHeight: h }).map((s) => ({ ...s, id: `circle-${c + 1}-${s.id}` })));

const blocks = [];
SPEEDS.forEach((speed, row) => EXTRAS.forEach((extra, col) => {
  const tested = { ...material, retraction: { ...r, restart_extra: extra, deretract_speed: speed } };
  const retraction = resolveConfig(machine, tested).derived.retraction;
  blocks.push({ row, col, extra, speed, retraction, at: [col * (BLOCK + BLOCK_GAP), row * (BLOCK + BLOCK_GAP)], tag: `push${extra}-at${speed}`,
    moves: emitStrands(circles, { retraction }) });
}));

const moves = plateMoves(blocks);
const stats = computeStats(moves, cfg, []);
const comments = [
  `Filafabric seam test: ${blocks.length} blocks of four ${DIAMETER} mm circles, each a ${LINES}-line brim on the first layer; a strand starts and closes on the same spot`,
  `Retraction ${r.length} mm at ${r.speed} mm/s for all. Columns left to right: extra push ${EXTRAS.join(', ')} mm. Rows front to back: push-back speed ${SPEEDS.join(', ')} mm/s`,
  ...blocks.map((b) => `${['front', 'middle', 'back'][b.row]} row, ${['left', 'middle', 'right'][b.col]}: push back ${r.length + b.extra} mm (${b.extra} extra) at ${b.speed} mm/s`),
  'The move into each block retracts and primes with the settings of the block before it: its first start belongs to that one',
];
const name = `seam-test_circles${DIAMETER}mm_${LINES}lines_push${EXTRAS.join('-')}_at${SPEEDS.join('-')}mms_plate_${plateSize}x${plateSize}mm.gcode`;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^seam-test_.*\.gcode$/.test(f)) fs.unlinkSync(new URL(f, OUT));
fs.writeFileSync(new URL(name, OUT), writeGcode(moves, cfg, { stats, comments }));

const minutes = Math.round(stats.timeSec / 60), starts = moves.filter((m) => m.retract === 'unretract').length;
const cell = (row, col) => { const b = blocks.find((x) => x.row === row && x.col === col); return `+${b.extra} mm at ${b.speed} mm/s`; };
const md = [
  '# Seam test',
  '',
  `One print, \`${name}\`: ${blocks.length * 4} circles of ${DIAMETER} mm in ${material.name}, ${plateSize} x ${plateSize} mm in the`,
  `middle of the bed, about ${minutes} min. Each circle is a ${LINES}-line brim as the studio prints one (two loops overlapping`,
  '20%, first layer only), so every loop starts and closes on the same spot: look there for a blob (too much push) or a gap',
  '(too little). Judge them on the bed, or photograph them before taking them off: the circles come off loose.',
  '',
  `Retraction ${r.length} mm at ${r.speed} mm/s for every circle. What changes is how much is pushed back after a travel, and how fast:`,
  '',
  '| Row (front of the bed at the bottom) | Left | Middle | Right |',
  '| --- | --- | --- | --- |',
  ...[2, 1, 0].map((row) => `| ${['Front', 'Middle', 'Back'][row]} | ${[0, 1, 2].map((col) => cell(row, col)).join(' | ')} |`),
  '',
  `Each block prints its four circles one after the other, then the next block: front row left to right first. The move into`,
  'a block retracts and primes with the settings of the block before it, so the first start of each block belongs to that one.',
  '',
  'Set the winner in the studio: Printer setup > Temperatures and retraction > Extra push after travel (the push-back speed',
  'is the filament profile\'s `deretract_speed`; say which one won and it goes in the profile).',
  '',
  'Made by `node tools/export-seam-test.mjs`.',
  '',
].join('\n');
fs.writeFileSync(new URL('INDEX.md', OUT), md);
console.log(`${blocks.length} blocks of 4 circles, ${starts} starts after a travel, about ${minutes} min: DemoTestingPrints/seam-test/${name}`);
