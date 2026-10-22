// Writes one print of small circles to DemoTestingPrints/seam-test/ for judging the start and the close of a strand and
// the strings between: each circle is a 20 mm two-line brim (the studio's own, two loops overlapping 20%, on the first
// layer), where a strand starts and closes on the same spot. Twelve pairs of circles, each pair changing one thing from
// the first pair, so what makes the knots and strings shows.
//   node tools/export-seam-test.mjs                  how a strand ends (seam gap, coasting, wipe), at 238 C and a 0.2 mm lift
//   node tools/export-seam-test.mjs --plan=settings  the settings before it: lift, retraction, its speed, push, temperature
// Everything else is the Filaflex Foamy profile as it is; the files are local (.gitignore).
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

/** The filament's own settings. */
const OWN = { temp: material.temperature.first_layer, length: r.length, speed: r.speed, extra: r.restart_extra ?? 0, pushSpeed: r.deretract_speed, lift: 3, joined: false, gap: 0, coast: 0, wipe: 0 };
const PLANS = {
  // the first pair is the cleanest of the settings plan (238 C, 0.2 mm lift); the others end each loop another way
  endings: {
    title: 'How a strand ends',
    base: { ...OWN, temp: 238, lift: 0.2 },
    items: [
      { label: 'As the cleanest pair of the settings test: 238 C, lift 0.2 mm', patch: {} },
      { label: 'Seam gap 0.5 mm: each loop stops short of its start', patch: { gap: 0.5 } },
      { label: 'Seam gap 1 mm', patch: { gap: 1 } },
      { label: 'Coast 1 mm: the end of each loop moved over without pushing', patch: { coast: 1 } },
      { label: 'Coast 2 mm', patch: { coast: 2 } },
      { label: 'Wipe 3 mm: on round the loop, retracting as it goes', patch: { wipe: 3 } },
      { label: 'Wipe 6 mm', patch: { wipe: 6 } },
      { label: 'Gap 0.5 and coast 1', patch: { gap: 0.5, coast: 1 } },
      { label: 'Gap 0.5 and wipe 3', patch: { gap: 0.5, wipe: 3 } },
      { label: 'Coast 1 and wipe 3', patch: { coast: 1, wipe: 3 } },
      { label: 'Gap 0.5, coast 1 and wipe 3', patch: { gap: 0.5, coast: 1, wipe: 3 } },
      { label: 'Gap 0.5, coast 1 and wipe 3, the two loops joined', patch: { gap: 0.5, coast: 1, wipe: 3, joined: true } },
    ],
  },
  // front row first; the temperature row last and coolest last, as the nozzle cools slowly and heats fast
  settings: {
    title: 'Settings',
    base: OWN,
    items: [
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
    ],
  },
};
const planArg = process.argv.find((a) => a.startsWith('--plan='))?.slice(7) ?? 'endings';
const PLAN = PLANS[planArg];
if (!PLAN) throw new Error(`--plan must be one of ${Object.keys(PLANS).join(', ')}`);
const BASE = PLAN.base;

const COLUMNS = 3, DIAMETER = 20, CIRCLE_GAP = 6, PAIR_GAP = 14, ROW_GAP = 12;
const PAIR = 2 * DIAMETER + CIRCLE_GAP, rows = Math.ceil(PLAN.items.length / COLUMNS);
const plateW = COLUMNS * PAIR + (COLUMNS - 1) * PAIR_GAP, plateH = rows * DIAMETER + (rows - 1) * ROW_GAP;

// the print starts at the first pair's temperature
const plateMaterial = { ...material, temperature: { first_layer: BASE.temp, print: BASE.temp } };
const cfg = resolveConfig(machine, plateMaterial, { sample_width: plateW, sample_height: plateH });
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
const parts = PLAN.items.map((item, i) => {
  const s = { ...BASE, ...item.patch };
  const tested = { ...material, retraction: { ...r, length: s.length, speed: s.speed, restart_extra: s.extra, deretract_speed: s.pushSpeed } };
  const retraction = resolveConfig(machine, tested).derived.retraction;
  // a new temperature is waited for (M109 R: heating or cooling) with the nozzle lifted clear, before the pair prints
  const startGcode = s.temp !== temp ? `M109 R${s.temp} ; wait for the nozzle at ${s.temp} C for the next pair` : null;
  temp = s.temp;
  const seam = s.gap || s.coast || s.wipe ? { gap: s.gap, coast: s.coast, wipe: s.wipe } : null;
  const row = Math.floor(i / COLUMNS), col = i % COLUMNS;
  return { ...item, s, row, col, retraction, startGcode, tag: `pair${i + 1}`,
    at: [col * (PAIR + PAIR_GAP), row * (DIAMETER + ROW_GAP)], moves: emitStrands(pair(s.joined), { retraction, travelLift: s.lift, startLift: s.lift, seam }) };
});

const moves = plateMoves(parts);
const stats = computeStats(moves, cfg, []);
const ending = (s) => [s.gap && `seam gap ${s.gap} mm`, s.coast && `coast ${s.coast} mm`, s.wipe && `wipe ${s.wipe} mm`].filter(Boolean).join(', ');
const describe = (s) => `${s.temp} C, retract ${s.length} mm at ${s.speed} mm/s, push back ${s.length + s.extra} mm at ${s.pushSpeed} mm/s, lift ${s.lift} mm${ending(s) ? `, ${ending(s)}` : ''}${s.joined ? ', loops joined' : ''}`;
const where = (p) => `${['front', 'second', 'third', 'back'][p.row]} row ${['left', 'middle', 'right'][p.col]}`;
const comments = [
  `Filafabric seam test (${PLAN.title.toLowerCase()}): ${parts.length} pairs of ${DIAMETER} mm circles, each a two-line brim on the first layer; each pair changes one thing from the first`,
  ...parts.map((p, i) => `${i + 1}, ${where(p)}: ${p.label} (${describe(p.s)})`),
  'The move into each pair retracts and primes with the settings of the pair before it: its first start belongs to that one',
];
const name = `seam-test-${planArg}_${parts.length}-pairs_circles${DIAMETER}mm_plate_${plateW}x${plateH}mm.gcode`;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.startsWith(`seam-test-${planArg}_`) && f.endsWith('.gcode')) fs.unlinkSync(new URL(f, OUT));
fs.writeFileSync(new URL(name, OUT), writeGcode(moves, cfg, { stats, comments }));

const minutes = Math.round(stats.timeSec / 60), waits = parts.some((p) => p.startGcode);
const md = [
  `# Seam test: ${PLAN.title.toLowerCase()}`,
  '',
  `One print, \`${name}\`: ${parts.length * 2} circles of ${DIAMETER} mm in ${material.name}, ${plateW} x ${plateH} mm in the`,
  `middle of the bed, about ${minutes} min${waits ? ' plus a minute or two for the nozzle to cool for the back row' : ''}. Each circle is a`,
  'two-line brim as the studio prints one (two loops overlapping 20%, first layer only): every loop starts and closes on',
  'the same spot. Look there for a knot or a gap, and at the strings between the circles. Judge them on the bed, or',
  'photograph them before taking them off: the circles come off loose.',
  '',
  `The first pair prints with ${describe(BASE)}; every other pair changes one thing:`,
  '',
  '| # | Where (front of the bed at the bottom) | What changes |',
  '| --- | --- | --- |',
  ...parts.map((p, i) => `| ${i + 1} | ${where(p)} | ${p.label} |`),
  '',
  'Pairs print front row first, left to right. The move into a pair retracts and primes with the settings of the pair',
  'before it, so the first start of each pair belongs to that one.',
  '',
  `Made by \`node tools/export-seam-test.mjs${planArg === 'endings' ? '' : ` --plan=${planArg}`}\`.`,
  '',
].join('\n');
fs.writeFileSync(new URL(`INDEX-${planArg}.md`, OUT), md);
if (fs.existsSync(new URL('INDEX.md', OUT))) fs.unlinkSync(new URL('INDEX.md', OUT));
console.log(`${parts.length} pairs, about ${minutes} min: DemoTestingPrints/seam-test/${name}`);
for (const [i, p] of parts.entries()) console.log(`${String(i + 1).padStart(2)}  ${where(p).padEnd(18)} ${p.label}`);
