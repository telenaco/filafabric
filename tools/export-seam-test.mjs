// Writes one print of small circles to DemoTestingPrints/seam-test/ for judging the start and the close of a strand and
// the strings between: each circle is a 20 mm two-line brim (the studio's own, two loops overlapping 20%, on the first
// layer), where a strand starts and closes on the same spot. Twelve pairs of circles, each pair changing one thing from
// the filament's own settings (the first pair), so what makes the blobs and strings shows: the lift on a travel, the
// retraction, its speed, the extra push, joining the two loops into one strand, and the temperature.
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
const r = material.retraction;

/** The filament's own settings, which the first pair prints with and every other pair changes one thing of. */
const BASE = { temp: material.temperature.first_layer, length: r.length, speed: r.speed, extra: r.restart_extra ?? 0, pushSpeed: r.deretract_speed, lift: 3, joined: false };
// front row first; the temperature row last and coolest last, as the nozzle cools slowly and heats fast
const PLAN = [
  { label: 'As now', patch: {} },
  { label: 'Lift 0.2 mm on a travel (Recreus\'s z-hop)', patch: { lift: 0.2 } },
  { label: 'Lift 1 mm on a travel', patch: { lift: 1 } },
  { label: 'Retract 2.5 mm', patch: { length: 2.5 } },
  { label: 'Retract 5 mm', patch: { length: 5 } },
  { label: 'No extra push', patch: { extra: 0 } },
  { label: 'Retract at 40 mm/s', patch: { speed: 40 } },
  { label: 'Retract at 90 mm/s', patch: { speed: 90 } },
  { label: 'The two loops joined: one start, one stop', patch: { joined: true } },
  { label: '243 C', patch: { temp: 243 } },
  { label: '238 C', patch: { temp: 238 } },
  { label: '238 C and lift 0.2 mm', patch: { temp: 238, lift: 0.2 } },
];
const COLUMNS = 3, DIAMETER = 20, CIRCLE_GAP = 6, PAIR_GAP = 14, ROW_GAP = 12;
const PAIR = 2 * DIAMETER + CIRCLE_GAP, rows = Math.ceil(PLAN.length / COLUMNS);
const plateW = COLUMNS * PAIR + (COLUMNS - 1) * PAIR_GAP, plateH = rows * DIAMETER + (rows - 1) * ROW_GAP;

const cfg = resolveConfig(machine, material, { sample_width: plateW, sample_height: plateH });
const { layer_height: h, extrusion_width: bead } = cfg.t;

/** A circle of the given diameter whose box starts at (x, y). */
const circle = (x, y, d = DIAMETER, n = 96) => Array.from({ length: n }, (_, i) => ({ x: x + d / 2 + (d / 2) * Math.cos((2 * Math.PI * i) / n), y: y + d / 2 + (d / 2) * Math.sin((2 * Math.PI * i) / n) }));

/** The two loops as one strand: the inner one starts where the outer one closes, without a travel between. */
function joinLoops([outer, inner]) {
  const end = outer.pts.at(-1), ring = inner.pts.slice(0, -1);
  let k = 0;
  ring.forEach((p, i) => { if (Math.hypot(p.x - end.x, p.y - end.y) < Math.hypot(ring[k].x - end.x, ring[k].y - end.y)) k = i; });
  const turned = [...ring.slice(k), ...ring.slice(0, k), ring[k]];
  return { ...outer, id: `${outer.id}-joined`, pts: [...outer.pts, ...turned] };
}

/** A pair of circles, each a two-line brim as the studio prints one (or its two loops joined), side by side. */
const pair = (joined) => [[0, 0], [DIAMETER + CIRCLE_GAP, 0]].flatMap(([x, y], c) => {
  const loops = buildBrimStrands([circle(x, y)], { count: 2, strandWidth: bead, layerHeight: h }).map((s) => ({ ...s, id: `circle-${c + 1}-${s.id}` }));
  return joined ? [joinLoops(loops)] : loops;
});

let temp = BASE.temp;
const parts = PLAN.map((item, i) => {
  const s = { ...BASE, ...item.patch };
  const tested = { ...material, retraction: { ...r, length: s.length, speed: s.speed, restart_extra: s.extra, deretract_speed: s.pushSpeed } };
  const retraction = resolveConfig(machine, tested).derived.retraction;
  // a new temperature is waited for (M109 R: heating or cooling) with the nozzle lifted clear, before the pair prints
  const startGcode = s.temp !== temp ? `M109 R${s.temp} ; wait for the nozzle at ${s.temp} C for the next pair` : null;
  temp = s.temp;
  const row = Math.floor(i / COLUMNS), col = i % COLUMNS;
  return { ...item, s, row, col, retraction, startGcode, tag: `pair${i + 1}`,
    at: [col * (PAIR + PAIR_GAP), row * (DIAMETER + ROW_GAP)], moves: emitStrands(pair(s.joined), { retraction, travelLift: s.lift, startLift: s.lift }) };
});

const moves = plateMoves(parts);
const stats = computeStats(moves, cfg, []);
const describe = (s) => `${s.temp} C, retract ${s.length} mm at ${s.speed} mm/s, push back ${s.length + s.extra} mm at ${s.pushSpeed} mm/s, lift ${s.lift} mm${s.joined ? ', loops joined' : ''}`;
const where = (p) => `${['front', 'second', 'third', 'back'][p.row]} row ${['left', 'middle', 'right'][p.col]}`;
const comments = [
  `Filafabric seam test: ${parts.length} pairs of ${DIAMETER} mm circles, each a two-line brim on the first layer; each pair changes one thing from the first`,
  ...parts.map((p, i) => `${i + 1}, ${where(p)}: ${p.label} (${describe(p.s)})`),
  'The move into each pair retracts and primes with the settings of the pair before it: its first start belongs to that one',
];
const name = `seam-test_${parts.length}-pairs_circles${DIAMETER}mm_plate_${plateW}x${plateH}mm.gcode`;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^seam-test_.*\.gcode$/.test(f)) fs.unlinkSync(new URL(f, OUT));
fs.writeFileSync(new URL(name, OUT), writeGcode(moves, cfg, { stats, comments }));

const minutes = Math.round(stats.timeSec / 60);
const md = [
  '# Seam test',
  '',
  `One print, \`${name}\`: ${parts.length * 2} circles of ${DIAMETER} mm in ${material.name}, ${plateW} x ${plateH} mm in the`,
  `middle of the bed, about ${minutes} min plus a minute or two for the nozzle to cool for the back row. Each circle is a`,
  'two-line brim as the studio prints one (two loops overlapping 20%, first layer only): every loop starts and closes on',
  'the same spot. Look there for a knot or a gap, and at the strings between the circles. Judge them on the bed, or',
  'photograph them before taking them off: the circles come off loose.',
  '',
  `The first pair prints with the filament's own settings (${describe(BASE)}); every other pair changes one thing:`,
  '',
  '| # | Where (front of the bed at the bottom) | What changes |',
  '| --- | --- | --- |',
  ...parts.map((p, i) => `| ${i + 1} | ${where(p)} | ${p.label} |`),
  '',
  'Pairs print front row first, left to right. The move into a pair retracts and primes with the settings of the pair',
  'before it, so the first start of each pair belongs to that one.',
  '',
  'Made by `node tools/export-seam-test.mjs`.',
  '',
].join('\n');
fs.writeFileSync(new URL('INDEX.md', OUT), md);
console.log(`${parts.length} pairs, about ${minutes} min: DemoTestingPrints/seam-test/${name}`);
for (const [i, p] of parts.entries()) console.log(`${String(i + 1).padStart(2)}  ${where(p).padEnd(18)} ${p.label}`);
