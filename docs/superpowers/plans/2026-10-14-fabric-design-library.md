# Fabric design library, phases 0 to 2: Implementation Plan

> **For agentic workers:** execute task by task with `superpowers:executing-plans` (native, this session). Steps use
> checkbox (`- [ ]`) syntax. Each task ends green (`npm test`) and committed.

**Goal:** add a design registry, a pattern/shape/crossing library and a new **Coil** card (flat looped strands with a
controllable overlap), plus Strand shape and Pattern pickers on Squiggle & Gyroid and placeholder tiles for the cards
that come later.

**Architecture:** every strand-based design returns ordered strands `{kind,id,pts:[{x,y,z,cls?}],name,pauseBefore}`;
`emit.js` turns them into moves and the existing `computeStats` / `writeGcode` finish the job. Shared libraries
(`fields.js`, `shapes.js`, `crossings.js`) are pure and unit-tested. The UI asks a registry (`designs.js`) for tiles,
defaults, sanitising, generation, verdicts and legend labels instead of branching on design ids.

**Tech Stack:** vanilla ES modules, `node --test`, Three.js preview (vendored), no build step.

**Spec:** [`docs/superpowers/specs/2026-10-14-fabric-design-library-design.md`](../specs/2026-10-14-fabric-design-library-design.md).
Later phases (weave, spiral, bouclé, relief, fringe, pile pattern) get their own plan when reached.

## Global Constraints

- Z moves 12 mm/s, jerk 0.4: slope under about 17° (`tan 17° = 0.31`).
- Non-crossing strands at least one strand width apart (about 0.49 mm foamed, `extrusion_width` 0.45 in config).
- Fields and shapes modulate a path, they never cut it; deterministic for a seed and parameters.
- Moves stay under `MAX_MOVES` (250 000, from `tiler.js`) with a plain-language `ConfigError`.
- Existing behaviour is frozen: loop pile golden and squiggle G-code stay byte-identical; v1 and v2 links open as before.
- Repo rules: `npm test` passes and the UI is checked in a browser (`npm run serve`) before pushing to `main`.
- Commits: no Claude attribution lines; path-scoped (`git add <paths>`; `git commit -m ... -- <paths>`) because the
  parent `Websites` repo has unrelated dirty files. Push with
  `git subtree push --prefix="fashionPrinting Tools" filafabric main` after `git fetch filafabric`.
- Run commands from `G:\Luis\Desktop\__CLI projects\Websites\fashionPrinting Tools`.

## Review Focus

Inputs the spec implies but no happy-path test would hit, most likely first:

1. A share link from before this change (v1 or v2, with `squiggle` and no `designs`) opens exactly as it did.
2. A swatch smaller than one loop, or `size` so small relative to `pitch` that the loops close up: a plain message, not an empty or broken preview.
3. An outline (concave, with holes) on Coil: strands stay inside the lanes; nothing prints across a gap.
4. Extreme slider combinations (tiny pitch on a 240 × 200 swatch): the move-budget error, not a frozen tab.
5. Pattern set to *Your picture* with no picture loaded (restored from a link): falls back, as Squiggle does today.
6. Fields on narrow swatches (10 mm): values stay in 0..1, no NaN.

Each line has its test in the owning task (T2: 1; T7: 2, 3, 4, 6; T9: 5).

---

## File structure

| File | Responsibility |
|---|---|
| `src/engine/emit.js` (new) | `emitStrands(strands, opts) → moves` |
| `src/engine/fields.js` (new) | Pattern library: `FIELDS`, `createField`, `fieldSlope` |
| `src/engine/shapes.js` (new) | Strand shapes: `SHAPES`, `shapeAt`, `lanePoints` |
| `src/engine/crossings.js` (new) | `resolveCrossings(strands, opts)` |
| `src/engine/coil.js` (new) | `generateCoilTextile`, `generateCoil` |
| `src/engine/squiggle.js` | Uses `emitStrands`; gains `shape` and a field sampler (T9) |
| `src/ui/designs.js` (new) | Design registry (pure) |
| `src/ui/coil-controls.js` (new) | Coil ranges, defaults, sanitise, describe, presets |
| `src/ui/thumbs.js` (new) | SVG thumbnails for tiles (pure strings) |
| `src/ui/panel.js` (new) | Generic panel builder from a module's `controls` |
| `src/ui/share.js` | v3 state, delegates to the registry |
| `src/ui/main.js`, `index.html`, `styles.css` | Registry-driven tiles, panels, verdicts, export names |

---

## Phase 0: registry

### Task 1: extract `emitStrands` (no behaviour change)

**Files:** Create `src/engine/emit.js`, `tests/emit.test.js`; Modify `src/engine/squiggle.js`.

**Interfaces:** Produces `emitStrands(strands, { startLift = 5, travelLift = 3 } = {}) → moves[]`. A point may carry
`cls`; otherwise the move class is `base` for `kind === 'base'` and `supported` otherwise.

- [ ] **Step 1: capture today's squiggle G-code as a regression hash** (before touching `squiggle.js`)

```js
// tests/squiggle-golden.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateSquiggle, SAMPLERS } from '../src/engine/squiggle.js';
import { defaultProfiles } from './helpers.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');

test('squiggle G-code stays byte-identical (cross and parallel)', () => {
  const { machine, material } = defaultProfiles();
  const cross = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'cross', sampler: SAMPLERS.waves });
  const par = generateSquiggle(machine, material, { width: 40, height: 30, mode: 'parallel', colorChange: true });
  assert.equal(hash(cross.gcode), 'REPLACE_CROSS');
  assert.equal(hash(par.gcode), 'REPLACE_PARALLEL');
});
```

Run `node -e "..."` once to print both hashes and paste them over `REPLACE_*`:

```bash
node -e "import('./src/engine/squiggle.js').then(async m=>{const {defaultProfiles}=await import('./tests/helpers.js');const {createHash}=await import('node:crypto');const {machine,material}=defaultProfiles();const h=s=>createHash('sha256').update(s).digest('hex');console.log(h(m.generateSquiggle(machine,material,{width:40,height:30,mode:'cross',sampler:m.SAMPLERS.waves}).gcode));console.log(h(m.generateSquiggle(machine,material,{width:40,height:30,mode:'parallel',colorChange:true}).gcode));})"
```

- [ ] **Step 2: write the failing emit tests**

```js
// tests/emit.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitStrands } from '../src/engine/emit.js';

const strand = (id, kind, pts, extra = {}) => ({ id, kind, pts, name: id, ...extra });
const P = (x, y, z = 0.2) => ({ x, y, z });

test('the first strand starts with a lift to start height and a drop; strands print in order', () => {
  const m = emitStrands([strand('a', 'base', [P(0, 0), P(5, 0), P(5, 5)])]);
  assert.deepEqual(m.slice(0, 2).map((q) => [q.cls, q.z]), [['travel', 5.2], ['travel', 0.2]]);
  const printed = m.filter((q) => q.extrude);
  assert.equal(printed.length, 2);
  assert.ok(printed.every((q) => q.cls === 'base' && q.tag === 'a'));
});

test('between strands the nozzle lifts above both, travels, and drops', () => {
  const m = emitStrands([strand('a', 'base', [P(0, 0), P(5, 0)]), strand('b', 'supported', [P(0, 9, 0.4), P(5, 9, 0.4)])]);
  const travels = m.filter((q) => !q.extrude).slice(2);
  assert.deepEqual(travels.map((q) => [q.x, q.y, q.z]), [[5, 0, 3.4], [0, 9, 3.4], [0, 9, 0.4]]);
  assert.equal(m.filter((q) => q.extrude && q.tag === 'b')[0].cls, 'supported');
});

test('a point class overrides the strand kind, and pauseBefore inserts M600 once', () => {
  const pts = [P(0, 0), { ...P(1, 0), cls: 'supported' }, P(2, 0)];
  const m = emitStrands([strand('a', 'base', pts), strand('b', 'supported', [P(0, 5), P(3, 5)], { pauseBefore: true })]);
  assert.deepEqual(m.filter((q) => q.extrude && q.tag === 'a').map((q) => q.cls), ['supported', 'base']);
  assert.equal(m.filter((q) => q.customGcode?.startsWith('M600')).length, 1);
});

test('strands with fewer than two points are skipped', () => {
  assert.equal(emitStrands([strand('a', 'base', [P(0, 0)])]).length, 0);
});
```

- [ ] **Step 3: run, expect failure** `node --test tests/emit.test.js` → FAIL (module not found).

- [ ] **Step 4: implement** `src/engine/emit.js`

```js
/**
 * Turns ordered strands into printable moves. Every strand-based design shares this: a lift and travel between
 * strands, an optional filament-change pause, and each point printed as its strand's class unless it carries its own.
 */
export function emitStrands(strands, { startLift = 5, travelLift = 3 } = {}) {
  const moves = [];
  const travel = (x, y, z, customGcode, comment) => ({ x, y, z, cls: 'travel', extrude: false, customGcode, comment });
  let cur = null;
  for (const strand of strands) {
    if (strand.pts.length < 2) continue;
    const first = strand.pts[0];
    if (cur === null) {
      moves.push(travel(first.x, first.y, first.z + startLift));
      moves.push(travel(first.x, first.y, first.z));
    } else {
      const safeZ = Math.max(cur.z, first.z) + travelLift;
      moves.push(travel(cur.x, cur.y, safeZ));
      if (strand.pauseBefore) {
        moves.push(travel(cur.x, cur.y, safeZ, 'M600 ; Pause for filament color change', `Filament change pause before ${strand.name}`));
      }
      moves.push(travel(first.x, first.y, safeZ));
      moves.push(travel(first.x, first.y, first.z));
    }
    const kindClass = strand.kind === 'base' ? 'base' : 'supported';
    for (let i = 1; i < strand.pts.length; i++) {
      const p = strand.pts[i];
      moves.push({ x: p.x, y: p.y, z: p.z, cls: p.cls ?? kindClass, extrude: true, tag: strand.id });
    }
    cur = strand.pts[strand.pts.length - 1];
  }
  return moves;
}
```

- [ ] **Step 5:** in `generateSquiggle` replace the move-building loop (the `const moves = []` … `cur = ...` block) with
  `const moves = emitStrands(res.strands);` and add `import { emitStrands } from './emit.js';`.

- [ ] **Step 6: run everything** `npm test` → all green including the new hash test (byte-identical) and emit tests.

- [ ] **Step 7: commit**

```bash
git -C .. add "fashionPrinting Tools/src/engine/emit.js" "fashionPrinting Tools/src/engine/squiggle.js" "fashionPrinting Tools/tests/emit.test.js" "fashionPrinting Tools/tests/squiggle-golden.test.js"
git -C .. commit -m "refactor: share strand-to-move emission between strand-based designs" -- "fashionPrinting Tools/src/engine/emit.js" "fashionPrinting Tools/src/engine/squiggle.js" "fashionPrinting Tools/tests/emit.test.js" "fashionPrinting Tools/tests/squiggle-golden.test.js"
```

### Task 2: design registry and share v3

**Files:** Create `src/ui/designs.js`, `tests/designs.test.js`; Modify `src/ui/share.js`, `tests/share.test.js`.

**Interfaces:**
- Consumes: `sanitizePrimary`/`PRIMARY_DEFAULTS` (`controls.js`), `sanitizeSquiggle`/`SQUIGGLE_DEFAULTS` (`squiggle-controls.js`).
- Produces: `DESIGNS` (array), `designById(id)`, `READY_IDS`, `isReady(id)`; each module has
  `{ id, name, blurb, status, file, roles, legacy: true|undefined, defaults(), sanitize(raw), opens? }`.
  `sanitizeState(raw, known)` now returns `{ v: 3, design, machine, material, primary, advanced, squiggle, designs, outline }`
  where `designs` holds the sanitised state of every non-legacy ready design (`{}` until Coil lands).

- [ ] **Step 1: tests**

```js
// tests/designs.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById, READY_IDS, isReady } from '../src/ui/designs.js';

test('loop pile and squiggle come first and are ready', () => {
  assert.deepEqual(READY_IDS.slice(0, 2), ['loop-pile', 'squiggle']);
  assert.equal(designById('loop-pile').legacy, true);
});

test('every module is complete', () => {
  const ids = new Set();
  for (const d of DESIGNS) {
    assert.equal(ids.has(d.id), false, `duplicate ${d.id}`);
    ids.add(d.id);
    for (const k of ['name', 'blurb', 'file']) assert.ok(d[k], `${d.id}.${k}`);
    assert.ok(['ready', 'planned'].includes(d.status), d.id);
    if (d.status === 'ready') {
      assert.equal(typeof d.defaults, 'function');
      assert.equal(typeof d.sanitize, 'function');
      assert.ok(d.roles && d.roles.base, `${d.id} needs role labels`);
    }
  }
});

test('planned designs are not selectable', () => {
  assert.equal(isReady('loop-pile'), true);
  assert.equal(isReady('nope'), false);
  for (const d of DESIGNS.filter((x) => x.status === 'planned')) assert.equal(isReady(d.id), false);
});
```

- [ ] **Step 2: run, expect FAIL** (`designs.js` missing).
- [ ] **Step 3: implement** `src/ui/designs.js`: array of the two legacy modules (copying `file` and `roles` from
  `main.js` `DESIGNS`, `defaults` from `PRIMARY_DEFAULTS` / `SQUIGGLE_DEFAULTS`, `sanitize` from the existing sanitisers,
  `legacy: true`, `status: 'ready'`, a `blurb` taken from the tile text), exports `designById`, `READY_IDS`
  (`DESIGNS.filter(ready).map(id)`), `isReady`. Planned entries are added in T10.
- [ ] **Step 4: share tests** (append to `tests/share.test.js`)

```js
test('v3 states carry per-design settings; unknown or planned designs fall back to the loop pile', () => {
  const s = sanitizeState({ v: 3, design: 'weave', designs: { weave: { a: 1 } } }, known);
  assert.equal(s.design, 'loop-pile');
  assert.equal(s.v, 3);
  assert.deepEqual(s.designs, {});
});

test('a version 2 link (squiggle key, no designs) opens identically', () => {
  const s = sanitizeState({ v: 2, design: 'squiggle', squiggle: { mode: 'parallel', spacing: 4 } }, known);
  assert.equal(s.design, 'squiggle');
  assert.equal(s.squiggle.mode, 'parallel');
  assert.equal(s.squiggle.spacing, 4);
  assert.deepEqual(s.designs, {});
});
```

- [ ] **Step 5: implement** in `share.js`: `import { READY_IDS, DESIGNS } from './designs.js'`; `export const DESIGN_IDS = READY_IDS`
  (keep the name so existing tests and imports work); in `sanitizeState` set `v: 3` and build
  `designs` from `DESIGNS.filter((d) => d.status === 'ready' && !d.legacy)` calling `d.sanitize(r.designs?.[d.id])`.
- [ ] **Step 6:** `npm test` green (update the one existing assertion that expects `v: 2` if any).
- [ ] **Step 7: commit** `feat: design registry and share format v3` with the four paths.

### Task 3: drive the studio from the registry

**Files:** Modify `src/ui/main.js`, `index.html`, `src/ui/styles.css`; Create `src/ui/thumbs.js`.

**Interfaces:** Consumes `DESIGNS`, `designById`. Produces: registry-rendered tiles; no `state.design === 'squiggle'`
branch left outside the two legacy modules' own hooks.

- [ ] **Step 1:** move the two inline tile thumbnails from `index.html` into `thumbs.js` as `thumbs['loop-pile']` and
  `thumbs.squiggle` (SVG strings, same markup). Empty `.design-list` in `index.html`; keep `<p class="more-designs">`.
- [ ] **Step 2:** `main.js`: replace the local `DESIGNS` roles table with `designById(state.design).roles`
  (legend, T3) and `.file` (export name). Add `renderTiles()` creating one `<button class="design-tile">` per module:
  `status === 'planned'` tiles get `disabled`, `aria-disabled="true"`, a small "Coming soon" tag; ready tiles keep
  `data-design` and `aria-pressed`. Call it from `init()` and `showDesign()`.
- [ ] **Step 3:** `snapshot()` gains `v: 3` and `designs: state.designs`; `state.designs = {}` added; `loadState` copies
  `clean.designs`; `snapshotKey` includes it.
- [ ] **Step 4:** `styles.css`: `.design-tile[aria-disabled="true"]` dimmed, not hoverable; `.soon` pill.
- [ ] **Step 5: browser check** (`npm run serve`): the two tiles select as before; legend, export file name and share link
  unchanged; placeholder look checked once planned tiles exist (T10). Screenshot both designs in light and dark.
- [ ] **Step 6:** `npm test`; commit `refactor: render design tiles from the registry`.
- [ ] **Step 7:** push (Phase 0 is behaviour-neutral): `git fetch filafabric`, then subtree push.

---

## Phase 1: libraries

### Task 4: pattern fields

**Files:** Create `src/engine/fields.js`, `tests/fields.test.js`.

**Interfaces:** Produces
`FIELDS: { [id]: { id, label, hint, kind: 'pattern'|'noise'|'bumps' } }`, `FIELD_IDS`,
`createField(id, { scale = 1, freqX = 6, freqY = 6, seed = 1, smooth = 1 } = {}) → (x, y, w, h) => 0..1`,
`fieldSlope(sampler, w, h, step = 0.5) → max |gradient| per mm`.

Mapping from the vase: `circumference = 100 · scale` mm, `angle = 2π·x/circumference`, `zn = y/circumference`
(patterns keep a fixed physical size whatever the swatch size). `fx = freqX`, `fz = freqY` (Blender's
`pattern_frequency`, `pattern_z_frequency`, default 6). Each raw value is Blender's `effective_amplitude = 1`
displacement, normalised by its analytic range, then clamped to 0..1:

| id | raw | normalise |
|---|---|---|
| deepSpiral | `2 sin(a·fx + zn·fz·π)` | `(v+2)/4` |
| brick | row `floor(zn·fz)`; `|sin((a + (row%2)·π/8)·fx)| > 0.7 ? 1 : 0`, edges and row seams smoothed | as is |
| diamondGrid | `2 |sin(a·fx) · sin(zn·fz·π)|` | `v/2` |
| tribalFeathers | `2 Σ_{j=0..2} (1/(j+1)) |sin(a(fx+2j) + zn(fz+4j)π)|^(2+j)` | `v/(2·1.8333)` |
| circuitBoard | `max(|sin(zn·fz·π)| > 0.8, |sin(a·fx)| > 0.9)` smoothed | as is |
| oceanWaves | `1.5 (sin(a·fx/3 + zn·fz·π) + 0.5 sin(a·fx·5/6 − zn·fz·2π) + 0.3 |sin(a·fx·2.5 + zn·fz·5π)|)` | `(v+2.25)/4.95` |
| hexagonCells | `2 · min(|cos(a·fx)|, |cos(a·fx + π/3)|) · (1 + 0.3 sin(zn·fz·π))` | `v/2.6` |
| mountainPeaks | `2 (|sin(a·fx)|³ + 0.6 sin²(7a + π/4)) (1 + 0.5 sin(zn·fz·π))` | `v/4.8` |
| lotusPetals | `1.8 ((sin²(a·fx) + 0.02)^0.25 + 0.5 sin²(16a + π/8)) (1 + 0.4 sin(zn·fz·π))` | `v/3.78` |
| lightningBolts | `gate(|sin(a·fx + zn·fz·π)| > 0.85) · |sin(24a)|` | as is |
| noise | seeded value noise, 2 octaves, cell `100·scale/fx` mm | as is |
| bumps | staggered Gaussian bumps, cell `100·scale/fx`, σ = 0.3 cell | as is |

`gate` is `smoothstep((s − t + w)/(2w))` with `w = 0.12·smooth`.

- [ ] **Step 1: tests**

```js
// tests/fields.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, FIELD_IDS, createField, fieldSlope } from '../src/engine/fields.js';

const grid = (f, w = 100, h = 100, step = 1.3) => {
  const out = [];
  for (let y = 0; y <= h; y += step) for (let x = 0; x <= w; x += step) out.push(f(x, y, w, h));
  return out;
};

test('the ten Blender patterns plus noise and bumps are registered', () => {
  for (const id of ['deepSpiral', 'brick', 'diamondGrid', 'tribalFeathers', 'circuitBoard', 'oceanWaves', 'hexagonCells', 'mountainPeaks', 'lotusPetals', 'lightningBolts', 'noise', 'bumps']) {
    assert.ok(FIELDS[id], id);
    assert.ok(FIELDS[id].label && FIELDS[id].hint, id);
  }
  assert.equal(FIELD_IDS.length, 12);
});

test('every field stays in 0..1, is deterministic, and is not flat', () => {
  for (const id of FIELD_IDS) {
    const a = grid(createField(id));
    const b = grid(createField(id));
    assert.deepEqual(a, b, id);
    assert.ok(a.every((v) => v >= 0 && v <= 1 && Number.isFinite(v)), `${id} range`);
    assert.ok(Math.max(...a) - Math.min(...a) > 0.3, `${id} is flat`);
  }
});

test('narrow swatches give finite values too', () => {
  for (const id of FIELD_IDS) {
    const f = createField(id);
    for (const v of grid(f, 10, 10, 0.7)) assert.ok(v >= 0 && v <= 1, id);
  }
});

test('deepSpiral matches the Blender formula at known points', () => {
  const f = createField('deepSpiral');
  assert.ok(Math.abs(f(0, 0) - 0.5) < 1e-9);
  assert.ok(Math.abs(f(100 / 24, 0) - 1) < 1e-9, 'sin = 1 at a quarter of a cell');
  assert.ok(Math.abs(f(0, 100 / 12) - 1) < 1e-9, 'zn·fz·π = π/2 at zn = 1/12');
});

test('thresholded patterns are continuous: no jump between points 0.05 mm apart', () => {
  for (const id of ['brick', 'circuitBoard', 'lightningBolts']) {
    const f = createField(id);
    let worst = 0;
    for (let y = 0; y <= 60; y += 0.37) for (let x = 0; x < 60; x += 0.05) worst = Math.max(worst, Math.abs(f(x + 0.05, y) - f(x, y)));
    assert.ok(worst < 0.25, `${id} jumps by ${worst}`);
  }
});

test('gradients stay printable at the default scale', () => {
  for (const id of FIELD_IDS) assert.ok(fieldSlope(createField(id), 100, 100) <= 2.5, id);
});

test('scale stretches the pattern; seed changes noise only', () => {
  const a = createField('diamondGrid', { scale: 2 });
  const b = createField('diamondGrid');
  assert.ok(Math.abs(a(20, 10) - b(10, 5)) < 1e-9);
  assert.notDeepEqual(grid(createField('noise', { seed: 1 })), grid(createField('noise', { seed: 2 })));
  assert.deepEqual(grid(createField('deepSpiral', { seed: 1 })), grid(createField('deepSpiral', { seed: 9 })));
});
```

- [ ] **Step 2:** run, expect FAIL. **Step 3:** implement per the table (helpers: `smooth`, `gate`, `hash2`, `valueNoise`).
  `fieldSlope` samples a grid at `step` and returns the largest finite-difference gradient magnitude.
- [ ] **Step 4:** `npm test` green. **Step 5:** commit `feat: pattern field library ported from the Blender ceramics patterns`.

### Task 5: strand shapes

**Files:** Create `src/engine/shapes.js`, `tests/shapes.test.js`.

**Interfaces:** Produces `SHAPES: { wave, looped, zigzag, figure8, square }` (each `{ id, label, hint }`),
`shapeAt(shape, s, { pitch, size }) → { v, du }` (lateral offset and shift along the lane at progress `s` mm;
both 0 at `s = 0`), `lanePoints({ shape, length, pitch, size, sizeAt = null, step = 0.4 }) → [{ u, v }]`
(lead-in and lead-out centre the whole periods; `u` runs 0..length; endpoints at `v = 0`),
`loopCount(length, pitch)`, `loopsClose(pitch, size) → boolean` (true when `size ≤ pitch/2π`: no loop forms).

Formulas (`a = pitch/2π`, `θ = s/a`, `R = size`):
wave `v = R sinθ`; zigzag `v = R·asin(0.9 sinθ)/asin(0.9)`; square `v = R·tanh(2.5 sinθ)/tanh(2.5)`;
looped `θ' = θ + π/2`, `v = −R cosθ'`, `du = R(1 − sinθ')`; figure8 `v = R sinθ`, `du = 0.6 R sin 2θ`.

- [ ] **Step 1: tests**

```js
// tests/shapes.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, shapeAt, lanePoints, loopCount, loopsClose } from '../src/engine/shapes.js';

const opts = { pitch: 6, size: 3 };

test('every shape starts at the lane centre with no shift', () => {
  for (const id of Object.keys(SHAPES)) {
    const { v, du } = shapeAt(id, 0, opts);
    assert.ok(Math.abs(v) < 1e-9 && Math.abs(du) < 1e-9, id);
  }
});

test('lateral offset never exceeds the size', () => {
  for (const id of Object.keys(SHAPES)) {
    for (let s = 0; s < 40; s += 0.1) assert.ok(Math.abs(shapeAt(id, s, opts).v) <= 3.0001, id);
  }
});

test('lanePoints runs from 0 to length, ends on the centre, and steps stay small', () => {
  for (const id of Object.keys(SHAPES)) {
    const pts = lanePoints({ shape: id, length: 50, ...opts });
    assert.ok(Math.abs(pts[0].u) < 1e-9 && Math.abs(pts[0].v) < 1e-9, `${id} start`);
    const last = pts[pts.length - 1];
    assert.ok(Math.abs(last.u - 50) < 0.5 && Math.abs(last.v) < 1e-6, `${id} end`);
    for (let i = 1; i < pts.length; i++) {
      assert.ok(Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v) <= 0.5, `${id} step ${i}`);
    }
  }
});

test('looped goes backwards in u inside each loop; a wave never does', () => {
  const back = (shape) => {
    const pts = lanePoints({ shape, length: 40, ...opts });
    return pts.some((p, i) => i > 0 && p.u < pts[i - 1].u - 1e-9);
  };
  assert.equal(back('looped'), true);
  assert.equal(back('wave'), false);
});

test('loops close up when the size is below pitch / 2π', () => {
  assert.equal(loopsClose(6, 0.9), true);
  assert.equal(loopsClose(6, 1.0), false);
  assert.equal(loopCount(50, 6), 8);
});

test('sizeAt modulates the loop size along the lane', () => {
  const pts = lanePoints({ shape: 'wave', length: 60, pitch: 6, size: 3, sizeAt: (u) => (u < 30 ? 0.4 : 1) });
  const amp = (lo, hi) => Math.max(...pts.filter((p) => p.u >= lo && p.u < hi).map((p) => Math.abs(p.v)));
  assert.ok(amp(0, 30) < 1.4 && amp(30, 60) > 2.8);
});
```

- [ ] **Step 2:** FAIL. **Step 3:** implement. Step size: sample one period numerically for the largest
  `|d(u,v)/ds|` and use `step / thatRate` as the progress increment so arc steps stay ≤ `step`.
- [ ] **Step 4:** green. **Step 5:** commit `feat: strand shapes (wave, looped, zigzag, figure-8, square)`.

### Task 6: crossings

**Files:** Create `src/engine/crossings.js`, `tests/crossings.test.js`.

**Interfaces:** Produces
`resolveCrossings(strands, { lift = 0.25, ramp = 1.2, strandWidth = 0.5, cell = 1, decide = null, arch = 1, archSpan = 3 } = {})
→ { strands, crossings, maxLift, maxSlopeDeg }`. Input strands are `{ id, kind, pts:[{x,y,z}] }` in print order; output
points are new objects (input untouched), lifted ones carrying `cls: 'supported'`. `decide(info) → 'later-over' | 'earlier-over'`
with `info = { a, b, x, y }` (strand indices); default `later-over`.

Bump profile for a crossing at arc position `s0` of the raised strand: height `h`, plateau half-width `h0`, falloff `ramp`:
`w(d) = 1` for `|d| ≤ h0`, `½(1 + cos(π(|d| − h0)/ramp))` for `h0 < |d| < h0 + ramp`, else 0. Lift: `h = lift`,
`h0 = 0.75·strandWidth`. Arch (earlier strand): `h = arch`, `h0 = archSpan/2`. Points take the maximum bump.
Segments of one strand closer than `3·strandWidth` in arc length are not crossings.

- [ ] **Step 1: tests**

```js
// tests/crossings.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCrossings } from '../src/engine/crossings.js';

const line = (id, x0, y0, x1, y1, z = 0.2, n = 60) => ({
  id, kind: 'base',
  pts: Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, z })),
});
const zAt = (strand, x, y) => strand.pts.reduce((best, p) => (Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best)).z;

test('the later strand lifts over the earlier one at a crossing and nowhere else', () => {
  const r = resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)], { lift: 0.25 });
  assert.equal(r.crossings, 1);
  assert.ok(Math.abs(zAt(r.strands[1], 5, 5) - 0.45) < 1e-9);
  assert.equal(zAt(r.strands[1], 5, 0), 0.2);
  assert.equal(zAt(r.strands[1], 5, 10), 0.2);
  assert.ok(r.strands[0].pts.every((p) => p.z === 0.2), 'the earlier strand is untouched');
  assert.ok(Math.abs(r.maxLift - 0.25) < 1e-9);
});

test('the lift ramps smoothly: no step bigger than the slope budget', () => {
  const r = resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10, 0.2, 200)], { lift: 0.25, ramp: 1.2 });
  assert.ok(r.maxSlopeDeg < 17, `slope ${r.maxSlopeDeg}`);
});

test('parallel and non-touching strands are left alone', () => {
  const r = resolveCrossings([line('a', 0, 0, 10, 0), line('b', 0, 3, 10, 3)]);
  assert.equal(r.crossings, 0);
  assert.equal(r.maxLift, 0);
});

test('a strand crossing itself lifts its later pass', () => {
  // a figure-of-eight: out along the diagonal, a loop, back across the first leg
  const pts = [[0, 0], [4, 4], [8, 8], [8, 0], [4, 4.0001], [0, 8]].flatMap(([x, y], i, all) => {
    if (i === 0) return [];
    const [px, py] = all[i - 1];
    return Array.from({ length: 20 }, (_, k) => ({ x: px + ((x - px) * (k + 1)) / 20, y: py + ((y - py) * (k + 1)) / 20, z: 0.2 }));
  });
  const r = resolveCrossings([{ id: 's', kind: 'base', pts: [{ x: 0, y: 0, z: 0.2 }, ...pts] }]);
  assert.equal(r.crossings, 1);
  assert.ok(r.strands[0].pts.some((p) => p.z > 0.2 && p.cls === 'supported'));
});

test('earlier-over arches the earlier strand instead (weave)', () => {
  const r = resolveCrossings([line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)], { decide: () => 'earlier-over', arch: 1, archSpan: 3 });
  assert.ok(Math.abs(zAt(r.strands[0], 5, 5) - 1.2) < 1e-9);
  assert.ok(Math.abs(zAt(r.strands[0], 6.2, 5) - 1.2) < 1e-9, 'plateau spans the arch');
  assert.ok(r.strands[1].pts.every((p) => p.z === 0.2));
});

test('deterministic, and the input is not mutated', () => {
  const input = [line('a', 0, 5, 10, 5), line('b', 5, 0, 5, 10)];
  const copy = JSON.stringify(input);
  const a = resolveCrossings(input);
  const b = resolveCrossings(input);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(input), copy);
});
```

- [ ] **Step 2:** FAIL. **Step 3:** implement: cumulative arc per strand; segment list with global order; uniform grid
  keyed `${ix},${iy}`; pairwise segment intersection for later-ordered candidates; skip same-strand pairs closer than
  `3·strandWidth` in arc; merge crossings of the same strand pair within one strand width in both arcs; apply bumps; slope
  from final points.
- [ ] **Step 4:** green. **Step 5:** commit `feat: crossing resolver (later strand lifts over earlier; optional arch)`.
- [ ] **Step 6:** push Phase 1 (libraries are unused by the UI; behaviour-neutral).

---

## Phase 2: Coil card and pickers

### Task 7: Coil engine

**Files:** Create `src/engine/coil.js`, `tests/coil.test.js`.

**Interfaces:**
- Consumes `lanePoints`, `loopCount`, `loopsClose` (shapes), `resolveCrossings`, `emitStrands`, `serpentineChains`,
  `PolygonBoundary`, `resolveConfig`, `bedFitErrors`, `PreflightError`, `writeGcode`, `computeStats`, `ConfigError`, `MAX_MOVES`.
- Produces
  `generateCoilTextile({ width, height, shape = 'looped', size = 3, pitch = 5, rowOverlap = 0.25, layerHeight = 0.2, strandWidth = 0.45, lift = 0.25, sizeAt = null, boundary = null }) → { strands, rows, loops, crossings, maxLift, maxSlopeDeg, rowPitch, warnings }`
  and `generateCoil(machine, material, params) → { cfg, strands, moves, stats, warnings, gcode, outline, coil }`
  where `params` is the Coil state plus `{ sampler, outline }` and `stats` gains `loops`, `crossings`, `maxLift`.

Layout: row pitch `L = max(2·size·(1 − rowOverlap), 1.5·strandWidth)`; rows centred between `size` and
`height − size`; each row `lanePoints` along x, alternate rows reversed; rows joined by a rounded turn (bulge
`min(0.35 L, 1.5)` mm); one strand for a rectangle. With an outline: lanes every `L` through
`boundary.intervals('y', c)`, joined by `serpentineChains(…, { inset: 0.3, minLength: 2·pitch, maxJog: 3·L })`, each
segment sampled with `lanePoints`; z is `layerHeight` everywhere before `resolveCrossings`.

- [ ] **Step 1: tests**

```js
// tests/coil.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCoilTextile, generateCoil } from '../src/engine/coil.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { ConfigError } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const base = { width: 50, height: 30, size: 3, pitch: 5, rowOverlap: 0.25 };

test('a rectangle is one continuous strand, one layer thick except at crossings', () => {
  const r = generateCoilTextile(base);
  assert.equal(r.strands.length, 1);
  const zs = r.strands[0].pts.map((p) => p.z);
  assert.equal(Math.min(...zs), 0.2);
  assert.ok(Math.max(...zs) <= 0.2 + 0.25 + 1e-9);
  assert.ok(r.crossings > 0 && r.loops > 0);
});

test('row overlap controls the row pitch and the number of crossings', () => {
  const open = generateCoilTextile({ ...base, rowOverlap: 0 });
  const tight = generateCoilTextile({ ...base, rowOverlap: 0.5 });
  assert.ok(tight.rows > open.rows);
  assert.ok(tight.crossings > open.crossings, 'overlapping rows add crossings between rows');
  assert.ok(tight.rowPitch < open.rowPitch);
});

test('loops that cannot form are reported, not hidden', () => {
  const r = generateCoilTextile({ ...base, size: 0.8, pitch: 8 });
  assert.ok(r.warnings.some((w) => /loops? (close|do not form)/i.test(w)));
});

test('the lifts never exceed the slope budget', () => {
  const r = generateCoilTextile({ ...base, rowOverlap: 0.4 });
  assert.ok(r.maxSlopeDeg < 17, String(r.maxSlopeDeg));
});

test('an outline keeps every strand point within one loop radius of the inside', () => {
  const ring = [{ x: 5, y: 2 }, { x: 45, y: 2 }, { x: 45, y: 28 }, { x: 28, y: 28 }, { x: 28, y: 14 }, { x: 5, y: 14 }];
  const boundary = new PolygonBoundary([ring]);
  const r = generateCoilTextile({ ...base, boundary });
  assert.ok(r.strands.reduce((n, s) => n + s.pts.length, 0) > 100);
  const reach = base.size + 0.5;
  const nearInside = (p) => {
    if (boundary.contains(p.x, p.y)) return true;
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      if (boundary.contains(p.x + reach * Math.cos(a), p.y + reach * Math.sin(a))) return true;
    }
    return false;
  };
  for (const s of r.strands) for (const p of s.pts) assert.ok(nearInside(p), `point ${p.x.toFixed(1)}, ${p.y.toFixed(1)} is outside the outline`);
  // nothing prints across the notch: no strand segment is longer than a turn or a loop step
  for (const s of r.strands) {
    for (let i = 1; i < s.pts.length; i++) assert.ok(Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y) < 4, 'a jump across a gap');
  }
});

test('a swatch smaller than one loop prints nothing and says so', () => {
  const { machine, material } = defaultProfiles();
  const r = generateCoil(machine, material, { ...base, width: 10, height: 10, size: 6, pitch: 12 });
  assert.equal(r.moves.length === 0 || r.warnings.length > 0, true);
});

test('too many moves gives the plain budget error', () => {
  const { machine, material } = defaultProfiles();
  assert.throws(() => generateCoil(machine, material, { ...base, width: 240, height: 200, size: 1.5, pitch: 3, rowOverlap: 0.6 }), ConfigError);
});

test('generateCoil returns moves, stats and G-code', () => {
  const { machine, material } = defaultProfiles();
  const r = generateCoil(machine, material, base);
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.stats.timeSec > 0 && r.stats.loops === r.coil.loops);
  assert.ok(r.gcode.includes('G1'));
  assert.deepEqual(generateCoil(machine, material, base).gcode, r.gcode, 'deterministic');
});

test('a field makes the loops vary in size', () => {
  const flat = generateCoilTextile(base);
  const varied = generateCoilTextile({ ...base, sizeAt: (x, y) => (x < 25 ? 0.5 : 1) });
  const spread = (r) => Math.max(...r.strands[0].pts.map((p) => p.y)) - Math.min(...r.strands[0].pts.map((p) => p.y));
  assert.ok(spread(varied) <= spread(flat) + 1e-6);
  assert.notDeepEqual(varied.strands[0].pts, flat.strands[0].pts);
});
```

- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** green; check `PolygonBoundary`'s constructor argument shape
  (the test passes `[ring]`) against `src/engine/boundary.js` and fix the test or the call, not the assertion.
- [ ] **Step 5:** commit `feat: coil engine (flat looped rows with controllable overlap)`.

### Task 8: Coil card

**Files:** Create `src/ui/coil-controls.js`, `src/ui/panel.js`, `tests/coil-controls.test.js`; Modify `src/ui/designs.js`,
`src/ui/thumbs.js`, `src/ui/verdict.js`, `tests/verdict.test.js`, `src/ui/main.js`, `index.html`, `src/ui/styles.css`.

**Interfaces:**
- `coil-controls.js`: `COIL_RANGES` (`width 10..240 step 5`, `height 10..200 step 5`, `size 1.5..6 step 0.5`,
  `pitch 3..14 step 0.5`, `rowOverlap 0..60 step 5` as percent, `lift 0.1..0.6 step 0.05`), `COIL_DEFAULTS`
  (`shape 'looped', width 50, height 50, size 3, pitch 5, rowOverlap 25, lift 0.25, pattern 'none', scale 1, colorChange false`),
  `COIL_SHAPES` (`['looped','figure8','zigzag','wave','square']`), `COIL_PRESETS`
  (`open-chain {rowOverlap 0, pitch 8}`, `overlapping {rowOverlap 30, pitch 5}`, `dense {rowOverlap 50, pitch 4, size 2.5}`),
  `sanitizeCoil(raw)`, `describeCoil(c) → { size, pitch, overlap, rowOverlap, lift }` (e.g. `'loops overlap 17%'`),
  `coilParams(c, { sampler, outline })` mapping percent to fraction.
- `verdict.js`: `buildCoilVerdict(stats, { loopsClose }) → { level, title, body, action: null, actionLabel: '', share: 0 }`
  naming loops, crossings and the biggest lift ("Crossings lift the strand by up to 0.25 mm; none is steeper than 9°").
- `panel.js`: `buildPanel(module, api) → HTMLElement` building header, size group (reusing `api.buildSize`), a
  `choice` group for shape, a `pattern` picker, sliders (reusing `api.buildSlider`), presets row, and a switch from the
  module's `controls` array.

- [ ] **Step 1: tests** (`coil-controls.test.js`: ranges clamp, defaults valid through `generateCoilTextile`, sanitise drops
  unknown keys and clamps, `describeCoil` read-outs, every preset passes `sanitizeCoil` unchanged; `verdict.test.js`:
  coil verdict wording with and without closed loops).
- [ ] **Step 2:** implement controls and verdict; green.
- [ ] **Step 3:** add the Coil module to `designs.js` (`id: 'coil'`, `file: 'coil'`, `roles: { base: 'Strand', anchored: 'Crossing over' }`,
  `controls` array, `defaults`, `sanitize`, `presets`, `generate`, `verdict`, `figures`), a thumbnail in `thumbs.js`, add
  `'coil'` state handling in `main.js` (`state.designs.coil`, `regenerate`, verdict, figures: third figure "Crossings").
- [ ] **Step 4:** `panel.js` and the host `<div id="panel-coil" class="panel" hidden>` created at boot; `showDesign()` shows
  the panel of the selected module (legacy panels keep their ids).
- [ ] **Step 5: browser check**: select Coil; change each slider, shape, preset, pattern (after T9), outline drop; preview shows
  the loops; legend shows *Strand* and *Crossing over*; verdict reads sensibly; export file `…_coil_50x50_….gcode`; share
  link round trip; undo/redo; phone width. Screenshots saved to the scratchpad.
- [ ] **Step 6:** `npm test`; commit `feat: Coil card`.

### Task 9: Strand shape and Pattern pickers on Squiggle & Gyroid

**Files:** Modify `src/engine/squiggle.js`, `src/ui/squiggle-controls.js`, `src/ui/main.js`, `index.html`,
`tests/squiggle.test.js`, `tests/squiggle-controls.test.js`.

**Interfaces:** `generateSquiggleTextile` and `generateSquiggle` accept `shape` (default `'wave'`, unchanged output);
for other shapes the lane offsets come from `shapeAt`, with the progress step reduced by `shapeStep`. `SQUIGGLE_DEFAULTS`
gains `shape: 'wave'`; `SQ_PATTERNS` gains the field ids. Existing links (no `shape`) open as `wave`.

- [ ] **Step 1: tests**: default `shape` output is byte-identical (the T1 hash test still passes); `shape: 'looped'` gives
  strands with self-crossings; sanitise accepts known shapes and fields only; the picker falls back for `'image'` without a
  loaded picture (Review Focus 5).
- [ ] **Step 2:** implement; **Step 3:** UI: shape buttons in `#panel-squiggle` (a `seg` of five), field patterns appended to
  `PATTERNS` with `createField` thumbnails; **Step 4:** browser check, screenshots; **Step 5:** commit.

### Task 10: placeholders, swatch code, docs, push

**Files:** Modify `src/ui/designs.js`, `src/ui/thumbs.js`, `src/ui/main.js`, `src/ui/styles.css`, `README.md`,
`docs/` (a short `docs/fabric-structures.md` with the catalogue and print/photo notes); tests in `tests/designs.test.js`.

- [ ] **Step 1:** add planned modules (`weave`, `spiral`, `boucle`, `relief`, `fringe`) with thumbnails from the catalogue
  sketch, blurb, `status: 'planned'`; add `zigzag-mesh` as a ready tile that `opens: { design: 'squiggle', patch: { shape: 'zigzag', mode: 'parallel' } }`.
- [ ] **Step 2:** swatch code `swatchCode(designId, state)` (pure, tested): `<id>-<preset or custom>-<WxH>-<6 hex of a
  hash of the sanitised state>`; used in the export file name and as a `; swatch ...` comment line in the G-code header.
- [ ] **Step 3:** README and `docs/fabric-structures.md`; `npm test` green; browser check of the full left column in
  light and dark and at phone width.
- [ ] **Step 4:** `git fetch filafabric`; confirm the remote is not ahead; subtree push to `main`; confirm
  https://filafabric.pages.dev shows the new tiles (Cloudflare build takes a minute).
- [ ] **Step 5:** report to the user: what shipped, what is placeholder, what needs a first print (crossing lift, arch).

---

## Self-review

- **Spec coverage:** card catalogue (T8, T9, T10), registry and share v3 (T2, T3), emit (T1), fields (T4), shapes (T5),
  crossings (T6), Coil with row overlap and presets (T7, T8), Strand shape and Pattern pickers (T9), placeholders and swatch
  code (T10). Weave, Spiral, Bouclé, Relief, Fringe and the pile pattern are phases 3 to 5 and get their own plans.
  The spec's `helix` and `double helix` shapes are folded into `looped` (a helix seen from above is a looped line; the
  overlap controls give the tight version) and a braid is a later card; the spec is updated in T10.
- **Placeholders:** none left; T8 and T9 give interfaces and checks rather than full code because their UI wiring is
  written against the live `main.js` during execution.
- **Types:** `emitStrands`, `lanePoints`, `shapeAt`, `resolveCrossings`, `createField`, `generateCoilTextile`,
  `generateCoil`, `sanitizeCoil`, `describeCoil`, `buildCoilVerdict`, `designById`, `READY_IDS` are used with the same
  names and shapes in every task.
