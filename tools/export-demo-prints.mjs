// Writes a numbered set of small demo prints to DemoTestingPrints/: easiest to hardest, each named after its design
// and the values of its settings, so they can be printed and laid out in order.
//   node tools/export-demo-prints.mjs            all twenty, 100 x 100 mm
//   node tools/export-demo-prints.mjs --size=60  a smaller swatch (mm), which prints faster
import fs from 'node:fs';
import { DESIGNS, designById } from '../src/ui/designs.js';

const profile = (kind, id) => JSON.parse(fs.readFileSync(new URL(`../profiles/${kind}/${id}.json`, import.meta.url)));
const machine = profile('machines', 'prusa-mk3s');
const material = profile('materials', 'filaflex-95-foamy');
const OUT = new URL('../DemoTestingPrints/', import.meta.url);
const sizeArg = process.argv.find((a) => a.startsWith('--size='));
const SIZE = sizeArg ? Number(sizeArg.slice(7)) : 100;
if (!(SIZE >= 20 && SIZE <= 200)) throw new Error('--size must be 20 to 200 mm');

/** The set, easiest to hardest. `preset` is a preset id of the design; `patch` changes settings on top of it. */
const PLAN = [
  { design: 'crosshatch', preset: 'isogrid', what: 'Plain net of three directions: the baseline every other print is judged against' },
  { design: 'starlattice', what: 'Islamic star pattern in a few straps: checks crossings at many angles' },
  { design: 'dipweave', what: 'Straight warp with a weft that dips over it: the simplest over-and-under' },
  { design: 'weave', patch: { binding: 'plain', pitch: 4 }, what: 'Plain weave in two levels: each piece is a lift' },
  { design: 'weave', patch: { binding: 'diamond', pitch: 4 }, what: 'Diamond twill (new binding): floats that turn both ways' },
  { design: 'weave', patch: { binding: 'crepe', pitch: 4 }, what: 'Crepe (new binding): short irregular floats' },
  { design: 'halftone', preset: 'soft', what: 'Halftone net, gentle flow swing 0.8x to 1.4x: does the foam show a difference?' },
  { design: 'halftone', preset: 'colour-swap', what: 'Halftone net in two colours that trade thickness; pauses for a filament change (M600)' },
  { design: 'svgdesign', preset: 'line-art', what: 'SVG design: the sample heart as lines only' },
  { design: 'svgdesign', preset: 'filled-backed', what: 'SVG design: lines and rectilinear fill over a gyroid backing' },
  { design: 'svgdesign', preset: 'two-layer', what: 'SVG design: concentric fill with gyroid and triangles backings' },
  { design: 'svgdesign', preset: 'lightning-badge', what: 'SVG design: honeycomb fill, lightning backing on the shape only' },
  { design: 'svgdesign', patch: { mode: 'both', designPattern: 'hilbert', designSpacing: 3.5, designAngle: 0, backing: 'one', backingArea: 'box', backing1Pattern: 'cubic', backing1Spacing: 5, backing1Angle: 0 }, what: 'SVG design: Hilbert fill with a cubic backing in the drawing\'s box' },
  { design: 'auxetic', preset: 're-entrant', what: 'Re-entrant auxetic mesh: widens when pulled, as in the printed elastic band of the nursing-bra paper' },
  { design: 'spiral', what: 'Nested rings that follow the edge: one strand, no lifts' },
  { design: 'meander', what: 'Hilbert meander held by a hatch: one strand that never crosses itself' },
  { design: 'coil', preset: 'overlapping', what: 'Looped rows: crossing lifts on a single strand' },
  { design: 'spacer', preset: 'thin', what: 'Spacer net, four layers of pillar: does the foam hold the top net across the pillars?' },
  { design: 'pillarweave', preset: 'close', what: 'Pillar weave, close pillars: fibre locked round stacked rings, layer by layer' },
  { design: 'spacer', preset: 'airy', what: 'Spacer net with a pillar on every second node: the hardest, most open structure' },
];

/** Short, readable names for the settings whose own names are long; every other setting keeps its own name. */
const SHORT = {
  designPattern: 'fill', designSpacing: 'fillSp', designAngle: 'fillAng',
  backing: 'backing', backingArea: 'area',
  backing1Pattern: 'b1', backing1Spacing: 'b1Sp', backing1Angle: 'b1Ang',
  backing2Pattern: 'b2', backing2Spacing: 'b2Sp', backing2Angle: 'b2Ang',
  patternScale: 'scale', rowOverlap: 'overlap', rowPitch: 'rowPitch', colorChange: 'twoColours',
};
const MAX_NAME = 150;

/** The settings that matter for the current choices, in the order the panel shows them. */
function relevantKeys(mod, s) {
  const keys = [];
  for (const c of mod.controls) {
    if (typeof c.when === 'function' && !c.when(s)) continue;
    if (c.kind === 'choice' || c.kind === 'shape') keys.push(c.key);
    else if (c.kind === 'sliders') for (const item of c.items) keys.push(item.key);
    else if (c.kind === 'pattern') { keys.push(c.key); if (c.scale) keys.push(c.scale.key); }
    else if (c.kind === 'switch' && s[c.key]) keys.push(c.key);
  }
  return [...new Set(keys)];
}

const show = (v) => (typeof v === 'number' ? String(Number(v.toFixed(2))) : v === true ? 'on' : String(v));

function fileName(n, mod, s, presetId) {
  const [w, h] = mod.size(s);
  const head = [String(n).padStart(2, '0'), mod.file, presetId ?? 'custom', `${w}x${h}mm`];
  let keys = relevantKeys(mod, s);
  const build = () => [...head, ...keys.map((k) => `${SHORT[k] ?? k}${typeof s[k] === 'number' ? '' : '-'}${show(s[k])}`)].join('_').replace(/[^A-Za-z0-9._-]+/g, '-');
  // a long name drops the angles that are zero, then the last settings (the first lines of the file have them all)
  if (build().length > MAX_NAME) keys = keys.filter((k) => !(/angle$/i.test(k) && s[k] === 0));
  while (build().length > MAX_NAME && keys.length > 3) keys = keys.slice(0, -1);
  return `${build()}.gcode`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^\d\d_.*\.gcode$/.test(f)) fs.unlinkSync(new URL(f, OUT));

const rows = [];
let n = 0;
for (const item of PLAN) {
  n++;
  const mod = designById(item.design);
  if (!mod) throw new Error(`Unknown design ${item.design}`);
  const preset = item.preset ? mod.presets.find((p) => p.id === item.preset) : null;
  if (item.preset && !preset) throw new Error(`${item.design} has no preset ${item.preset}`);
  const s = mod.sanitize({ ...mod.defaults(), ...(preset?.patch ?? {}), ...(item.patch ?? {}) });
  mod.setSize(s, SIZE, SIZE);
  const result = mod.generate(machine, material, s, { outline: null });
  const untouched = JSON.stringify(s) === JSON.stringify(mod.sanitize({ ...mod.defaults(), width: SIZE, height: SIZE }));
  const name = fileName(n, mod, s, item.preset ?? (mod.presetMatch ? mod.presetMatch(s) : null) ?? (untouched ? 'default' : null));
  const header = [
    `; Filafabric demo print ${n} of ${PLAN.length}: ${mod.name}`,
    `; ${item.what}`,
    `; settings ${JSON.stringify(s)}`,
    '; Prusa MK3S with Filaflex Foamy 95. Geometry is checked, not yet printed: watch the first layers and stop if it goes wrong.',
  ];
  const exportable = result.fabric?.exportable !== false;
  fs.writeFileSync(new URL(name, OUT), `${header.join('\n')}\n${result.gcode}`);
  rows.push({
    n,
    name,
    design: mod.name,
    what: item.what,
    minutes: Math.round(result.stats.timeSec / 60),
    grams: result.stats.filamentGrams,
    hops: result.stats.hops,
    colour: !!s.colorChange,
    exportable,
    issues: result.fabric?.issues ?? [],
    settings: relevantKeys(mod, s).map((k) => `${k} ${show(s[k])}`).join(', '),
  });
  console.log(`${String(n).padStart(2, '0')}  ${String(rows.at(-1).minutes).padStart(3)} min  ${rows.at(-1).grams.toFixed(1).padStart(5)} g  ${name}${exportable ? '' : '  (NOT EXPORTABLE: ' + rows.at(-1).issues.join('; ') + ')'}`);
}

const total = rows.reduce((a, r) => a + r.minutes, 0);
const md = [
  '# Demo test prints',
  '',
  `Twenty small ${SIZE} x ${SIZE} mm swatches for a Prusa MK3S with Filaflex Foamy 95, easiest to hardest, so they can be printed`,
  'and laid out in order 1 to 20. Each file name is the number, the design, the preset it started from, the size and the',
  'values of the settings that matter for that print; the first lines of every file repeat them.',
  '',
  'Nothing here has been printed yet: the geometry is checked, the material is not. Print the first few before the rest,',
  'and note which number first goes wrong.',
  '',
  `Total: about ${(total / 60).toFixed(1)} h of printing and ${rows.reduce((a, r) => a + r.grams, 0).toFixed(0)} g of filament.`,
  rows.some((r) => r.colour) ? 'Files marked "2 colours" pause with M600 after the first layer for a filament change.' : '',
  '',
  '| # | Design | What to look at | Time | Filament | Lifts | Settings | File |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.n} | ${r.design}${r.colour ? ' (2 colours)' : ''} | ${r.what} | ${r.minutes} min | ${r.grams.toFixed(1)} g | ${r.hops} | ${r.settings} | \`${r.name}\` |`),
  '',
  `Made by \`node tools/export-demo-prints.mjs\` (add \`--size=80\` for a different swatch size). The G-code files are kept`,
  'locally: `*.gcode` is in `.gitignore`.',
  '',
].join('\n');
fs.writeFileSync(new URL('INDEX.md', OUT), md);
console.log(`\n${rows.length} files, about ${(total / 60).toFixed(1)} h, written to DemoTestingPrints/ with INDEX.md`);
if (rows.some((r) => !r.exportable)) process.exitCode = 1;
