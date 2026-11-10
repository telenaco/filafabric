# Textile G-code Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based generator that computes direct G-code for non-planar FDM textile (sparse serpentine base + dense raised 3D loops) for the Prusa MK3S, with a live 3D preview, a G-code download, and a one-click local launcher.

**Architecture:** Pure-JS engine modules (no DOM) turn profiles + textile parameters into one tagged 3D polyline (`Move[]`); the preview and the G-code writer both consume that same polyline. Machine and material profiles are JSON data files. The UI is a static site (ES modules, no build step) served by a tiny Node server started from a double-clickable `.bat`.

**Tech Stack:** Node 20+ (tested on 22) with `node --test`, plain ES modules, three.js 0.169.0 vendored for the preview; no Python and no build step.

**Spec:** `docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md` (read it together with this plan; §12 lists the amendments made after the user's real G-code arrived). Reference data: `reference/g-code-analysis-2026-10-14.md`, `reference/research-notes-2026-10-14.md`. Real sample for comparison: `Shape-Box_0.2mm_FLEX_MK3S_5m.gcode`.

## Global Constraints

- All lengths in mm, speeds in mm/s inside the engine, angles in degrees in parameters (radians internally), `F` in mm/min only in emitted G-code.
- `src/engine/` is pure JS: **no DOM, no `window`, no `fetch`, no `localStorage`**; Node-testable.
- Plain ES modules, **no build step**; three.js vendored in `vendor/three/` (works offline).
- Output must be **byte-identical** for identical parameters: no timestamps, no `Math.random`, no iteration over unordered data.
- E is **relative** (`M83`); E for each move = true 3D distance × strand area × multiplier ÷ filament area; E is accumulated and rounded so rounding never drifts.
- The generated G-code sets `M221 S100` (Prusa's stock start G-code sets 95 %).
- Machine limits come from the machine profile; **speed is clamped** by class target, material volumetric ceiling (actual deposited volume = nominal × multiplier), machine X/Y/Z/E feedrate; Z component `v·|dz/ds| ≤ max_feedrate.z`.
- `F = 3D speed × 60` (Marlin applies F to the XYZ vector).
- Profiles carry `verified: true|false`; MK3S + Generic FLEX are verified, Foamy is not.
- MK3S `M204` is emitted as `S`/`T` (`accel_syntax: "S_T"`); never `P`/`R` for the MK3S.
- Browser storage access is always wrapped in `try/catch`; the page works without it.
- Commits: run from `fashionPrinting Tools/`, stage and commit **only the task's files** with an explicit pathspec, and add **no attribution line** (the user's rule).
- Never read or modify the user's sample files (`Shape-Box_…gcode`, `bambu lab a1 mini.gcode.3mf`) except as read-only data.

## Spec refinements this plan applies (already in spec §12)

1. Loop feet are at `loopBaseZ = 2 × layer_height` (0.4 mm); `z_rel = 0` is that level, peak = `loopBaseZ + lift`.
2. Default tile is 567 loops: 18 rows, 32 loops on even rows, 31 on staggered rows.
3. Leg-gap resolution is a greedy search (0, +gap, +2·gap, +3·gap) that yields the spec's `0,0,+δ,+δ` pattern for the defaults.
4. Foamy retraction defaults to 0 (the user's working profile uses none).
5. The sample is centred on the bed: `origin = ((bed.width − w)/2, (bed.depth − h)/2)` = (75, 55) for 100 × 100 mm on the MK3S.
6. Golden test stores summary stats + SHA-256 of the G-code, not the whole file.
7. The stats panel shows the clearance **violation count** (and red points in the preview) rather than a
   single "min clearance" number.
8. First prints use sample sizes (30 × 15 mm = one row of loops) instead of a dedicated "max rows" control.

## Not in this plan

Sub-projects 2–5 of the spec (G-code → profile extractor, SVG silhouette with rotate-to-fit, interwoven single
path, Bambu Lab A1 mini support with `.gcode.3mf` packaging). The engine interfaces are shaped for them
(`Boundary`, the planner's strand ordering, `accel_syntax`, `output.format` in the machine profile), but none is
built here.

## Review Focus

Failure modes the spec implies but a straight implementation would not test (each has a test in the owning task):

1. **Sample smaller than one loop** (e.g. 5 × 5 mm): zero loops, base only, no crash, a clear warning. (Task 6, Task 10)
2. **Sample larger than the bed** (e.g. 300 mm): generation must fail with a clear "does not fit the bed" error, never emit out-of-bed G-code. (Task 9)
3. **Blank / NaN / negative / non-numeric parameter** from the UI: validation errors listed, previous preview kept, download disabled, no exception escapes. (Task 2, Task 11)
4. **Unresolvable leg gap or absurd loop count** (pitch 0.5 mm, pitch 0.05 mm): terminates, warns about the gap, and refuses more than 4000 loops with a readable message. (Task 6)
5. **Extreme lift** (30 mm): Z-component speed is clamped to the machine's 12 mm/s and nothing exceeds `max_z`. (Task 7, Task 9)

---

## File structure

```
fashionPrinting Tools/
  package.json                      scripts: test, serve, vendor, golden
  .gitignore
  Run Textile Tool.bat              double-click launcher (starts the server, opens the browser)
  index.html                        page shell, import map for three.js
  tools/
    serve.mjs                       zero-dependency static server (+ --open)
    vendor-three.mjs                copies three.module.js + OrbitControls into vendor/
    update-golden.mjs               rewrites tests/golden/sample20.json
  profiles/
    index.json                      { machines: [...], materials: [...] }
    machines/prusa-mk3s.json
    materials/filaflex-95-foamy.json
    materials/generic-flex-mk3.json
  src/engine/
    profiles.js                     validateMachine / validateMaterial
    params.js                       DEFAULT_TEXTILE, ConfigError, validateTextile, resolveConfig, PRIME, startPosition
    rng.js                          createRng (mulberry32)
    boundary.js                     RectBoundary
    fiber.js                        zProfile, sampleFiber
    base.js                         buildBase
    tiler.js                        tile, countLegGapViolations, MAX_LOOPS
    extrusion.js                    areas, segmentE, moveSpeed
    planner.js                      HeightMap, clearanceModel, plan
    gcode.js                        preflight, PreflightError, writeGcode
    stats.js                        computeStats
    generate.js                     generate (pipeline)
  src/ui/
    styles.css
    param-schema.js                 PARAM_GROUPS (form definition)
    main.js                         wiring, form, download, save/load
    preview.js                      three.js preview
  vendor/three/                     three.module.js, addons/controls/OrbitControls.js, LICENSE
  tests/
    helpers.js                      loadProfile, defaultProfiles, projectRoot
    scene.js                        scene(), goldenSummary()
    serve.test.js params.test.js profiles.test.js rng.test.js boundary.test.js fiber.test.js
    base.test.js tiler.test.js extrusion.test.js planner.test.js gcode.test.js
    generate.test.js golden.test.js
    golden/sample20.json
```

---

### Task 1: Scaffold, local server and the double-click launcher

**Files:**
- Create: `package.json`, `.gitignore`, `tools/serve.mjs`, `tests/serve.test.js`, `Run Textile Tool.bat`, `index.html`

**Interfaces:**
- Produces: `createServer(rootDir) → http.Server` exported from `tools/serve.mjs`; CLI `node tools/serve.mjs [--open]` listening on `PORT` or 5173 (tries up to 20 ports).

- [ ] **Step 1: Write the failing test**

Create `tests/serve.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../tools/serve.mjs';

function get(port, p) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: p, agent: false }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
      })
      .on('error', reject);
  });
}

test('serves index and files, 404s missing, blocks traversal', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>hi</h1>');
  fs.writeFileSync(path.join(dir, 'data.json'), '{"a":1}');
  const server = createServer(dir);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => {
    server.closeAllConnections?.();
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const { port } = server.address();

  const idx = await get(port, '/');
  assert.equal(idx.status, 200);
  assert.match(idx.type, /text\/html/);
  assert.equal(idx.body, '<h1>hi</h1>');

  const json = await get(port, '/data.json');
  assert.equal(json.status, 200);
  assert.match(json.type, /application\/json/);

  assert.equal((await get(port, '/missing.txt')).status, 404);
  assert.equal((await get(port, '/..%2f..%2fpackage.json')).status, 403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/serve.test.js`
Expected: FAIL with `Cannot find module '../tools/serve.mjs'` (or ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: Write the implementation**

Create `package.json`:

```json
{
  "name": "fashion-printing-tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "serve": "node tools/serve.mjs --open",
    "vendor": "node tools/vendor-three.mjs",
    "golden": "node tools/update-golden.mjs"
  }
}
```

Create `.gitignore`:

```
node_modules/
*.log
```

Create `tools/serve.mjs`:

```js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exec } from 'node:child_process';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.gcode': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createServer(root) {
  const rootResolved = path.resolve(root);
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(rootResolved, '.' + rel);
      if (file !== rootResolved && !file.startsWith(rootResolved + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad request');
    }
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function listen(server, port, attemptsLeft) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        server.removeListener('error', onError);
        resolve(listen(server, port + 1, attemptsLeft - 1));
      } else reject(err);
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve(port);
    });
  });
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const server = createServer(root);
  const start = Number(process.env.PORT) || 5173;
  listen(server, start, 20).then((port) => {
    const url = `http://localhost:${port}/`;
    console.log(`Textile G-code Generator is running at ${url}`);
    console.log('Close this window (or press Ctrl+C) to stop it.');
    if (process.argv.includes('--open')) openBrowser(url);
  });
}
```

Create `Run Textile Tool.bat`:

```bat
@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node 20 or newer from https://nodejs.org and run this again.
  pause
  exit /b 1
)
echo Starting the Textile G-code Generator...
node tools\serve.mjs --open
pause
```

Create `index.html` (placeholder, replaced in Task 11):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Textile G-code Generator</title>
</head>
<body>
<h1>Textile G-code Generator</h1>
<p>The server works. The tool is being built.</p>
</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes, then check the launcher manually**

Run: `node --test tests/serve.test.js`
Expected: PASS (1 test).

Run: `node tools/serve.mjs & SERVER_PID=$!; sleep 1; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/; kill $SERVER_PID`
Expected: `200`.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore tools/serve.mjs tests/serve.test.js "Run Textile Tool.bat" index.html
git commit -m "feat: add local server and launcher" -- package.json .gitignore tools/serve.mjs tests/serve.test.js "Run Textile Tool.bat" index.html
```

---

### Task 2: Profiles, parameters and config resolution

**Files:**
- Create: `profiles/index.json`, `profiles/machines/prusa-mk3s.json`, `profiles/materials/filaflex-95-foamy.json`, `profiles/materials/generic-flex-mk3.json`, `src/engine/profiles.js`, `src/engine/params.js`, `tests/helpers.js`, `tests/profiles.test.js`, `tests/params.test.js`

**Interfaces:**
- Produces from `src/engine/profiles.js`: `validateMachine(m) → string[]`, `validateMaterial(m) → string[]` (empty array = valid).
- Produces from `src/engine/params.js`:
  - `class ConfigError extends Error { errors: string[] }`
  - `DEFAULT_TEXTILE` (frozen object, keys listed in the file below)
  - `PRIME = { x0: 60, x1: 100, y: -3, liftZ: 2 }`
  - `validateTextile(t) → string[]`
  - `resolveConfig(machine, material, overrides = {}) → cfg` where `cfg = { machine, material, t, derived }` and `derived = { filamentDiameter, multiplier, maxVolActual, freeDiameter, rowPitch, loopBaseZ, limits, limitsMode, retraction: { length, speed, deretractSpeed, zHop, minTravel }, temperatures: { first, print, bed }, origin: { x, y } }`
  - `startPosition(cfg) → { x, y, z }` (sample frame, nozzle position after the prime line)
- Produces from `tests/helpers.js`: `projectRoot`, `loadProfile(kind, id)`, `defaultProfiles() → { machine, material }` (MK3S + Foamy).

- [ ] **Step 1: Write the profile data files**

Create `profiles/index.json`:

```json
{
  "machines": ["prusa-mk3s"],
  "materials": ["filaflex-95-foamy", "generic-flex-mk3"]
}
```

Create `profiles/machines/prusa-mk3s.json`:

```json
{
  "id": "prusa-mk3s",
  "name": "Original Prusa i3 MK3S / MK3S+",
  "firmware": "prusa-marlin",
  "verified": true,
  "source": "Shape-Box_0.2mm_FLEX_MK3S_5m.gcode (PrusaSlicer 2.9.6, printer profile 2.5.11)",
  "bed": { "width": 250, "depth": 210, "max_z": 210 },
  "extrusion": { "relative_e": true },
  "accel_syntax": "S_T",
  "output": { "format": "gcode", "extension": ".gcode" },
  "limits": {
    "default_mode": "normal",
    "emit_to_gcode": true,
    "modes": {
      "normal": {
        "max_feedrate": { "x": 200, "y": 200, "z": 12, "e": 120 },
        "max_accel": { "x": 1000, "y": 1000, "z": 200, "e": 5000 },
        "accel_extruding": 1250,
        "accel_retracting": 1250,
        "accel_travel": 1500,
        "jerk": { "x": 8, "y": 8, "z": 0.4, "e": 4.5 }
      },
      "stealth": {
        "max_feedrate": { "x": 100, "y": 100, "z": 12, "e": 120 },
        "max_accel": { "x": 960, "y": 960, "z": 200, "e": 5000 },
        "accel_extruding": 1250,
        "accel_retracting": 1250,
        "accel_travel": 1250,
        "jerk": { "x": 8, "y": 8, "z": 0.4, "e": 4.5 }
      }
    }
  },
  "printer_model_check": "MK3S",
  "start_gcode": [
    "{machine_limits}",
    "M862.3 P \"{printer_model_check}\" ; printer model check",
    "M862.1 P{nozzle_diameter} ; nozzle diameter check",
    "M115 U3.14.1 ; tell printer latest fw version",
    "G90 ; absolute coordinates",
    "M83 ; relative E",
    "M104 S{first_layer_temp} ; set extruder temp",
    "M140 S{bed_temp} ; set bed temp",
    "M190 S{bed_temp} ; wait for bed",
    "M109 S{first_layer_temp} ; wait for extruder",
    "G28 W ; home all without mesh bed level",
    "G80 X{print_min_x} Y{print_min_y} W{print_width} H{print_height} ; mesh bed levelling",
    "M221 S100 ; flow 100% (Prusa's stock start G-code sets 95%; E is computed exactly by the engine)",
    "M907 E430 ; extruder motor current, as in the user's MK3S profile",
    "M900 K0 ; linear advance off",
    "M107 ; fan off",
    "{prime_line}",
    "G92 E0"
  ],
  "end_gcode": [
    "G1 Z{raise_z} F720 ; move print head up",
    "G1 X0 Y200 F3600 ; park",
    "G1 Z{park_z} F720 ; move print head further up",
    "G4 ; wait",
    "M221 S100 ; reset flow",
    "M900 K0 ; reset LA",
    "M907 E538 ; reset extruder motor current",
    "M104 S0 ; turn off temperature",
    "M140 S0 ; turn off heatbed",
    "M107 ; turn off fan",
    "M84 ; disable motors"
  ]
}
```

Create `profiles/materials/filaflex-95-foamy.json`:

```json
{
  "id": "filaflex-95-foamy",
  "name": "Recreus Filaflex 95A Foamy",
  "verified": false,
  "source": "recreus.com/en/products/filaflex-95-foamy (0.4 mm nozzle, 0.2 mm layer)",
  "filament_diameter": 1.75,
  "density": 1.22,
  "temperature": { "first_layer": 248, "print": 248 },
  "bed_temperature": 50,
  "flow": {
    "multiplier": 0.73,
    "reference_line_width": 0.55,
    "foam_expansion": 1.5,
    "max_volumetric_speed_nominal": 5.0
  },
  "retraction": {
    "length": 0,
    "speed": 75,
    "deretract_speed": 25,
    "z_hop": 0.2,
    "min_travel": 10,
    "note": "Recreus recommends 2.5-6 mm at 75 mm/s; the user's working Generic FLEX profile uses none. Start with none; raise if stringing hurts."
  },
  "fan": { "default": 0 },
  "travel_speed_hint": 180,
  "pressure_advance_k": null,
  "notes": "Dry at 55 C for at least 1 h. Direct-drive extruder recommended. Foams at 245-250 C; lower flow and higher temperature foam more."
}
```

Create `profiles/materials/generic-flex-mk3.json`:

```json
{
  "id": "generic-flex-mk3",
  "name": "Prusa Generic FLEX (MK3 family, 0.4 mm)",
  "verified": true,
  "source": "Shape-Box_0.2mm_FLEX_MK3S_5m.gcode embedded config (PrusaSlicer 2.9.6)",
  "filament_diameter": 1.75,
  "density": 1.22,
  "temperature": { "first_layer": 240, "print": 240 },
  "bed_temperature": 50,
  "flow": {
    "multiplier": 1.15,
    "reference_line_width": null,
    "foam_expansion": 1.0,
    "max_volumetric_speed_nominal": 1.2
  },
  "retraction": {
    "length": 0,
    "speed": 40,
    "deretract_speed": 25,
    "z_hop": 0,
    "min_travel": 10,
    "note": "Prusa's Generic FLEX disables retraction on the MK3 family; speed is unused while length is 0."
  },
  "fan": { "default": 0 },
  "travel_speed_hint": 180,
  "pressure_advance_k": null,
  "notes": "Prusa stock profile for non-foaming TPU on MK3-family printers."
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/helpers.js`:

```js
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
```

Create `tests/profiles.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateMachine, validateMaterial } from '../src/engine/profiles.js';
import { projectRoot, loadProfile } from './helpers.js';

const index = JSON.parse(fs.readFileSync(path.join(projectRoot, 'profiles', 'index.json'), 'utf8'));

test('every machine in profiles/index.json is valid', () => {
  assert.ok(index.machines.length >= 1);
  for (const id of index.machines) {
    const errors = validateMachine(loadProfile('machines', id));
    assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
  }
});

test('every material in profiles/index.json is valid', () => {
  assert.ok(index.materials.length >= 2);
  for (const id of index.materials) {
    const errors = validateMaterial(loadProfile('materials', id));
    assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
  }
});

test('validators reject broken profiles', () => {
  const m = loadProfile('machines', 'prusa-mk3s');
  m.bed.width = -1;
  m.extrusion.relative_e = false;
  delete m.limits.modes.normal.max_feedrate.z;
  const errors = validateMachine(m);
  assert.ok(errors.some((e) => /bed\.width/.test(e)));
  assert.ok(errors.some((e) => /relative_e/.test(e)));
  assert.ok(errors.some((e) => /max_feedrate\.z/.test(e)));

  const mat = loadProfile('materials', 'filaflex-95-foamy');
  mat.flow.multiplier = 0;
  mat.temperature.print = 999;
  const matErrors = validateMaterial(mat);
  assert.ok(matErrors.some((e) => /flow\.multiplier/.test(e)));
  assert.ok(matErrors.some((e) => /temperature\.print/.test(e)));
});
```

Create `tests/params.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, ConfigError, DEFAULT_TEXTILE, startPosition, PRIME } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('defaults resolve against MK3S + Foamy', () => {
  const cfg = resolveConfig(machine, material);
  assert.equal(cfg.derived.rowPitch, 5);
  assert.ok(Math.abs(cfg.derived.maxVolActual - 3.65) < 1e-9);
  assert.equal(cfg.derived.loopBaseZ, 0.4);
  assert.deepEqual(cfg.derived.origin, { x: 75, y: 55 });
  assert.equal(cfg.derived.limitsMode, 'normal');
  assert.equal(cfg.derived.limits.max_feedrate.z, 12);
  assert.equal(cfg.derived.freeDiameter, 0.4);
  assert.equal(cfg.derived.retraction.length, 0);
  assert.equal(cfg.derived.temperatures.first, 248);
});

test('overrides win and nulls fall back to the material', () => {
  const cfg = resolveConfig(machine, material, { retraction_length: 4, free_strand_diameter: 0.5, limits_mode: 'stealth' });
  assert.equal(cfg.derived.retraction.length, 4);
  assert.equal(cfg.derived.freeDiameter, 0.5);
  assert.equal(cfg.derived.limitsMode, 'stealth');
  assert.equal(cfg.derived.limits.max_feedrate.x, 100);
});

test('start position is the end of the prime line in sample coordinates', () => {
  const cfg = resolveConfig(machine, material);
  assert.deepEqual(startPosition(cfg), { x: PRIME.x1 - 75, y: PRIME.y - 55, z: PRIME.liftZ });
});

test('a sample bigger than the bed still resolves (preflight rejects it later)', () => {
  const cfg = resolveConfig(machine, material, { sample_width: 300 });
  assert.equal(cfg.derived.origin.x, -25);
});

test('invalid parameters throw ConfigError listing every problem', () => {
  assert.throws(
    () => resolveConfig(machine, material, { loop_pitch: 0, sample_width: -5, z_profile: 'nope', loop_width: NaN, random_seed: 1.5 }),
    (e) => {
      assert.ok(e instanceof ConfigError);
      for (const key of ['loop_pitch', 'sample_width', 'z_profile', 'loop_width', 'random_seed']) {
        assert.ok(e.errors.some((m) => m.includes(key)), `missing error for ${key}: ${e.errors.join(' | ')}`);
      }
      return true;
    }
  );
});

test('relationship checks: cap needs room, dwell must fit', () => {
  assert.throws(() => resolveConfig(machine, material, { loop_length: 2, loop_width: 6 }), /loop_length/);
  assert.throws(() => resolveConfig(machine, material, { anchor_dwell: 8 }), /anchor_dwell/);
});

test('blank UI values (null/undefined/strings) are rejected, not coerced', () => {
  assert.throws(() => resolveConfig(machine, material, { base_spacing: null }), /base_spacing/);
  assert.throws(() => resolveConfig(machine, material, { base_spacing: '5' }), /base_spacing/);
  assert.throws(() => resolveConfig(machine, material, { include_base: 'yes' }), /include_base/);
});

test('DEFAULT_TEXTILE is frozen', () => {
  assert.ok(Object.isFrozen(DEFAULT_TEXTILE));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/profiles.test.js tests/params.test.js`
Expected: FAIL with `Cannot find module '../src/engine/profiles.js'`.

- [ ] **Step 4: Write the implementation**

Create `src/engine/profiles.js`:

```js
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function need(errors, cond, message) {
  if (!cond) errors.push(message);
}

function axes(errors, obj, path, keys) {
  need(errors, obj && typeof obj === 'object', `${path} is missing`);
  if (!obj || typeof obj !== 'object') return;
  for (const k of keys) need(errors, isNum(obj[k]) && obj[k] >= 0, `${path}.${k} must be a number >= 0`);
}

export function validateMachine(m) {
  const errors = [];
  need(errors, m && typeof m === 'object', 'machine profile is not an object');
  if (!m || typeof m !== 'object') return errors;
  need(errors, typeof m.id === 'string' && m.id.length > 0, 'id must be a non-empty string');
  need(errors, typeof m.name === 'string', 'name must be a string');
  need(errors, typeof m.verified === 'boolean', 'verified must be true or false');
  need(errors, m.bed && isNum(m.bed.width) && m.bed.width > 0, 'bed.width must be > 0');
  need(errors, m.bed && isNum(m.bed.depth) && m.bed.depth > 0, 'bed.depth must be > 0');
  need(errors, m.bed && isNum(m.bed.max_z) && m.bed.max_z > 0, 'bed.max_z must be > 0');
  need(errors, m.extrusion && m.extrusion.relative_e === true, 'extrusion.relative_e must be true (v1 supports relative E only)');
  need(errors, ['S_T', 'P_R_T'].includes(m.accel_syntax), 'accel_syntax must be "S_T" or "P_R_T"');
  need(errors, typeof m.printer_model_check === 'string', 'printer_model_check must be a string');
  need(errors, Array.isArray(m.start_gcode) && m.start_gcode.every((l) => typeof l === 'string') && m.start_gcode.length > 0, 'start_gcode must be a non-empty array of strings');
  need(errors, Array.isArray(m.end_gcode) && m.end_gcode.every((l) => typeof l === 'string') && m.end_gcode.length > 0, 'end_gcode must be a non-empty array of strings');
  const limits = m.limits;
  need(errors, limits && limits.modes && typeof limits.modes === 'object', 'limits.modes is missing');
  if (limits && limits.modes) {
    need(errors, limits.default_mode in limits.modes, 'limits.default_mode must name one of limits.modes');
    for (const [name, mode] of Object.entries(limits.modes)) {
      const p = `limits.modes.${name}`;
      axes(errors, mode.max_feedrate, `${p}.max_feedrate`, ['x', 'y', 'z', 'e']);
      axes(errors, mode.max_accel, `${p}.max_accel`, ['x', 'y', 'z', 'e']);
      axes(errors, mode.jerk, `${p}.jerk`, ['x', 'y', 'z', 'e']);
      for (const k of ['accel_extruding', 'accel_retracting', 'accel_travel']) need(errors, isNum(mode[k]) && mode[k] > 0, `${p}.${k} must be > 0`);
    }
  }
  return errors;
}

export function validateMaterial(m) {
  const errors = [];
  need(errors, m && typeof m === 'object', 'material profile is not an object');
  if (!m || typeof m !== 'object') return errors;
  need(errors, typeof m.id === 'string' && m.id.length > 0, 'id must be a non-empty string');
  need(errors, typeof m.name === 'string', 'name must be a string');
  need(errors, typeof m.verified === 'boolean', 'verified must be true or false');
  need(errors, isNum(m.filament_diameter) && m.filament_diameter > 0, 'filament_diameter must be > 0');
  need(errors, isNum(m.density) && m.density > 0, 'density must be > 0');
  const t = m.temperature || {};
  need(errors, isNum(t.first_layer) && t.first_layer > 0 && t.first_layer <= 300, 'temperature.first_layer must be in 1-300');
  need(errors, isNum(t.print) && t.print > 0 && t.print <= 300, 'temperature.print must be in 1-300');
  need(errors, isNum(m.bed_temperature) && m.bed_temperature >= 0 && m.bed_temperature <= 120, 'bed_temperature must be in 0-120');
  const f = m.flow || {};
  need(errors, isNum(f.multiplier) && f.multiplier > 0, 'flow.multiplier must be > 0');
  need(errors, isNum(f.max_volumetric_speed_nominal) && f.max_volumetric_speed_nominal > 0, 'flow.max_volumetric_speed_nominal must be > 0');
  need(errors, isNum(f.foam_expansion) && f.foam_expansion >= 1, 'flow.foam_expansion must be >= 1');
  const r = m.retraction || {};
  need(errors, isNum(r.length) && r.length >= 0, 'retraction.length must be >= 0');
  need(errors, isNum(r.speed) && r.speed > 0, 'retraction.speed must be > 0');
  need(errors, isNum(r.deretract_speed) && r.deretract_speed > 0, 'retraction.deretract_speed must be > 0');
  need(errors, isNum(r.z_hop) && r.z_hop >= 0, 'retraction.z_hop must be >= 0');
  need(errors, isNum(r.min_travel) && r.min_travel >= 0, 'retraction.min_travel must be >= 0');
  need(errors, m.fan && isNum(m.fan.default) && m.fan.default >= 0 && m.fan.default <= 100, 'fan.default must be in 0-100');
  return errors;
}
```

Create `src/engine/params.js`:

```js
import { validateMachine, validateMaterial } from './profiles.js';

export class ConfigError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'ConfigError';
    this.errors = errors;
  }
}

/** Prime line in machine coordinates (outside the print area, in front of the bed). */
export const PRIME = Object.freeze({ x0: 60, x1: 100, y: -3, liftZ: 2 });

export const Z_PROFILE_NAMES = ['sin2', 'bell', 'smoothstep'];
export const FIBER_SHAPE_NAMES = ['hairpin', 'arch'];
export const BOUNDARY_POLICIES = ['footprint', 'feet-only'];

export const DEFAULT_TEXTILE = Object.freeze({
  sample_width: 100,
  sample_height: 100,
  include_base: true,
  include_loops: true,
  base_spacing: 5,
  corner_radius: 1,
  layer_height: 0.2,
  extrusion_width: 0.45,
  free_strand_diameter: null,
  nozzle_diameter: 0.4,
  loop_width: 6,
  loop_length: 15,
  loop_pitch: 3,
  loop_z_lift: 3,
  loop_start_z: null,
  anchor_dwell: 1,
  z_profile: 'sin2',
  fiber_shape: 'hairpin',
  leg_gap: 0.6,
  row_pitch_multiple: 1,
  row_stagger: 0.5,
  boundary_policy: 'footprint',
  curve_resolution: 0.4,
  support_threshold: 0.4,
  unsupported_fraction: 0.6,
  speed_base: 15,
  speed_supported: 12,
  speed_nonplanar: 8,
  speed_unsupported: 5,
  speed_travel: 150,
  fan_base: 0,
  fan_supported: 0,
  fan_nonplanar: 0,
  fan_unsupported: 0,
  fan_travel: 0,
  print_acceleration: 800,
  nozzle_tip_radius: 0.6,
  nozzle_cone_half_angle: 30,
  clearance: 1.0,
  retraction_length: null,
  retraction_speed: null,
  random_enabled: false,
  random_seed: 1,
  amp_length: 0,
  amp_width: 0,
  amp_lift: 0,
  amp_xy: 0,
  amp_orientation: 0,
  amp_spacing: 0,
  limits_mode: 'normal',
});

const POSITIVE = [
  'sample_width', 'sample_height', 'base_spacing', 'layer_height', 'extrusion_width', 'nozzle_diameter',
  'loop_width', 'loop_length', 'loop_pitch', 'curve_resolution', 'speed_base', 'speed_supported',
  'speed_nonplanar', 'speed_unsupported', 'speed_travel', 'print_acceleration', 'nozzle_cone_half_angle',
  'row_pitch_multiple',
];
const NON_NEGATIVE = [
  'corner_radius', 'loop_z_lift', 'anchor_dwell', 'leg_gap', 'row_stagger', 'support_threshold',
  'unsupported_fraction', 'nozzle_tip_radius', 'clearance', 'amp_length', 'amp_width', 'amp_lift', 'amp_xy',
  'amp_orientation', 'amp_spacing',
];
const PERCENT = ['fan_base', 'fan_supported', 'fan_nonplanar', 'fan_unsupported', 'fan_travel'];
const BOOLEAN = ['include_base', 'include_loops', 'random_enabled'];

export function validateTextile(t) {
  const errors = [];
  const num = (k) => typeof t[k] === 'number' && Number.isFinite(t[k]);
  for (const k of POSITIVE) if (!num(k) || t[k] <= 0) errors.push(`${k} must be a number greater than 0`);
  for (const k of NON_NEGATIVE) if (!num(k) || t[k] < 0) errors.push(`${k} must be a number of 0 or more`);
  for (const k of PERCENT) if (!num(k) || t[k] < 0 || t[k] > 100) errors.push(`${k} must be a number between 0 and 100`);
  for (const k of BOOLEAN) if (typeof t[k] !== 'boolean') errors.push(`${k} must be true or false`);
  for (const k of ['free_strand_diameter', 'loop_start_z', 'retraction_speed']) {
    if (t[k] !== null && (!num(k) || t[k] <= 0)) errors.push(`${k} must be empty or a number greater than 0`);
  }
  if (t.retraction_length !== null && (!num('retraction_length') || t.retraction_length < 0)) {
    errors.push('retraction_length must be empty or a number of 0 or more');
  }
  if (!Number.isInteger(t.random_seed)) errors.push('random_seed must be a whole number');
  if (num('row_pitch_multiple') && !Number.isInteger(t.row_pitch_multiple)) errors.push('row_pitch_multiple must be a whole number');
  if (!Z_PROFILE_NAMES.includes(t.z_profile)) errors.push(`z_profile must be one of ${Z_PROFILE_NAMES.join(', ')}`);
  if (!FIBER_SHAPE_NAMES.includes(t.fiber_shape)) errors.push(`fiber_shape must be one of ${FIBER_SHAPE_NAMES.join(', ')}`);
  if (!BOUNDARY_POLICIES.includes(t.boundary_policy)) errors.push(`boundary_policy must be one of ${BOUNDARY_POLICIES.join(', ')}`);
  if (typeof t.limits_mode !== 'string') errors.push('limits_mode must be a string');
  if (num('unsupported_fraction') && t.unsupported_fraction > 1) errors.push('unsupported_fraction must be at most 1');
  if (num('loop_length') && num('loop_width') && t.loop_length <= t.loop_width / 2) {
    errors.push('loop_length must be greater than half of loop_width');
  }
  if (num('anchor_dwell') && num('loop_length') && 2 * t.anchor_dwell >= t.loop_length) {
    errors.push('anchor_dwell must be less than half of loop_length');
  }
  return errors;
}

export function resolveConfig(machine, material, overrides = {}) {
  const profileErrors = [
    ...validateMachine(machine).map((e) => `machine: ${e}`),
    ...validateMaterial(material).map((e) => `material: ${e}`),
  ];
  const t = { ...DEFAULT_TEXTILE, ...overrides };
  const errors = [...profileErrors, ...validateTextile(t)];
  if (errors.length) throw new ConfigError(errors);

  const mode = t.limits_mode in machine.limits.modes ? t.limits_mode : machine.limits.default_mode;
  const multiplier = material.flow.multiplier;
  const r = material.retraction;
  const derived = {
    filamentDiameter: material.filament_diameter,
    multiplier,
    maxVolActual: material.flow.max_volumetric_speed_nominal * multiplier,
    freeDiameter: t.free_strand_diameter ?? t.nozzle_diameter,
    rowPitch: t.row_pitch_multiple * t.base_spacing,
    loopBaseZ: t.loop_start_z ?? 2 * t.layer_height,
    limits: machine.limits.modes[mode],
    limitsMode: mode,
    retraction: {
      length: t.retraction_length ?? r.length,
      speed: t.retraction_speed ?? r.speed,
      deretractSpeed: r.deretract_speed,
      zHop: r.z_hop,
      minTravel: r.min_travel,
    },
    temperatures: {
      first: material.temperature.first_layer,
      print: material.temperature.print,
      bed: material.bed_temperature,
    },
    origin: {
      x: (machine.bed.width - t.sample_width) / 2,
      y: (machine.bed.depth - t.sample_height) / 2,
    },
  };
  return { machine, material, t, derived };
}

export function startPosition(cfg) {
  const o = cfg.derived.origin;
  return { x: PRIME.x1 - o.x, y: PRIME.y - o.y, z: PRIME.liftZ };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/profiles.test.js tests/params.test.js`
Expected: PASS (profiles 3 tests, params 8 tests).

- [ ] **Step 6: Commit**

```bash
git add profiles src/engine/profiles.js src/engine/params.js tests/helpers.js tests/profiles.test.js tests/params.test.js
git commit -m "feat: add profiles, parameter validation and config resolution" -- profiles src/engine/profiles.js src/engine/params.js tests/helpers.js tests/profiles.test.js tests/params.test.js
```

---

### Task 3: Seeded RNG and boundary

**Files:**
- Create: `src/engine/rng.js`, `src/engine/boundary.js`, `tests/rng.test.js`, `tests/boundary.test.js`

**Interfaces:**
- Produces: `createRng(seed) → { next(): number in [0,1), symmetric(amp): number in [-amp, amp] }`
- Produces: `class RectBoundary { constructor(width, height); bbox() → {minX,minY,maxX,maxY}; contains(x, y) → boolean; containsPolyline(points: {x,y}[], policy: 'footprint'|'feet-only') → boolean }`

- [ ] **Step 1: Write the failing tests**

Create `tests/rng.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';

test('same seed gives the same sequence, different seed differs', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const sa = Array.from({ length: 5 }, () => a.next());
  const sb = Array.from({ length: 5 }, () => b.next());
  const sc = Array.from({ length: 5 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('values stay in [0, 1) and symmetric stays within +-amp', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
  }
  const s = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = s.symmetric(2.5);
    assert.ok(v >= -2.5 && v <= 2.5);
  }
});

test('symmetric(0) is zero but still advances the stream', () => {
  const a = createRng(1), b = createRng(1);
  assert.ok(a.symmetric(0) === 0);
  b.next();
  assert.equal(a.next(), b.next());
});
```

Create `tests/boundary.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { RectBoundary } from '../src/engine/boundary.js';

test('bbox and contains for a 100 x 100 rectangle', () => {
  const b = new RectBoundary(100, 100);
  assert.deepEqual(b.bbox(), { minX: 0, minY: 0, maxX: 100, maxY: 100 });
  assert.ok(b.contains(0, 0));
  assert.ok(b.contains(100, 100));
  assert.ok(b.contains(50, 50));
  assert.ok(!b.contains(100.01, 50));
  assert.ok(!b.contains(-0.01, 50));
});

test('containsPolyline policies', () => {
  const b = new RectBoundary(10, 10);
  const pts = [{ x: 1, y: 1 }, { x: 5, y: 12 }, { x: 9, y: 1 }];
  assert.equal(b.containsPolyline(pts, 'footprint'), false);
  assert.equal(b.containsPolyline(pts, 'feet-only'), true);
  assert.equal(b.containsPolyline([{ x: 1, y: 1 }, { x: 9, y: 9 }], 'footprint'), true);
  assert.equal(b.containsPolyline([], 'footprint'), true);
});

test('float noise at the edge is tolerated', () => {
  const b = new RectBoundary(100, 100);
  assert.ok(b.contains(100 + 1e-12, 100 + 1e-12));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rng.test.js tests/boundary.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/rng.js`:

```js
/** Seeded PRNG (mulberry32). Same seed => same sequence, on every platform. */
export function createRng(seed) {
  let a = Number(seed) >>> 0;
  function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    symmetric(amp) {
      return (next() * 2 - 1) * amp;
    },
  };
}
```

Create `src/engine/boundary.js`:

```js
const EPS = 1e-9;

/**
 * A boundary answers "is this point inside the textile?". The tiler and the base
 * depend only on this interface, so an SVG silhouette can replace RectBoundary later.
 */
export class RectBoundary {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  bbox() {
    return { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
  }

  contains(x, y) {
    return x >= -EPS && x <= this.width + EPS && y >= -EPS && y <= this.height + EPS;
  }

  /** policy 'footprint': every point inside. 'feet-only': first and last point inside. */
  containsPolyline(points, policy = 'footprint') {
    if (points.length === 0) return true;
    if (policy === 'feet-only') {
      const a = points[0], b = points[points.length - 1];
      return this.contains(a.x, a.y) && this.contains(b.x, b.y);
    }
    return points.every((p) => this.contains(p.x, p.y));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/rng.test.js tests/boundary.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.js src/engine/boundary.js tests/rng.test.js tests/boundary.test.js
git commit -m "feat: add seeded rng and rectangle boundary" -- src/engine/rng.js src/engine/boundary.js tests/rng.test.js tests/boundary.test.js
```

---

### Task 4: Fiber shapes and Z profiles

**Files:**
- Create: `src/engine/fiber.js`, `tests/fiber.test.js`

**Interfaces:**
- Produces: `zProfile(name: 'sin2'|'bell'|'smoothstep', u: number) → number in [0,1]` (0 at u≤0 and u≥1, 1 at u=0.5)
- Produces: `sampleFiber({ shape: 'hairpin'|'arch', width, length, lift, dwell, profile, resolution }) → { points: {x, y, z, s, part: 'leg'|'cap'}[], arcLength }` in a local frame (origin at foot midpoint, +Y outward, `z` = height above the loop base level, `s` = cumulative arc length).

- [ ] **Step 1: Write the failing tests**

Create `tests/fiber.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { zProfile, sampleFiber } from '../src/engine/fiber.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('every z profile is 0 at the ends and 1 in the middle', () => {
  for (const name of ['sin2', 'bell', 'smoothstep']) {
    near(zProfile(name, 0), 0);
    near(zProfile(name, 1), 0);
    near(zProfile(name, 0.5), 1);
    near(zProfile(name, -3), 0);
    near(zProfile(name, 7), 0);
  }
  assert.throws(() => zProfile('nope', 0.5), /Unknown z profile/);
});

const hairpin = { shape: 'hairpin', width: 6, length: 15, lift: 3, dwell: 1, profile: 'sin2', resolution: 0.4 };

test('hairpin: feet at y=0, legs width apart, arc length about 33.4 mm', () => {
  const { points, arcLength } = sampleFiber(hairpin);
  near(points[0].x, -3);
  near(points[0].y, 0);
  near(points[points.length - 1].x, 3);
  near(points[points.length - 1].y, 0);
  near(arcLength, 2 * 12 + Math.PI * 3, 0.05);
  const maxY = Math.max(...points.map((p) => p.y));
  near(maxY, 15, 1e-9);
});

test('hairpin: z is flat in the dwell, peaks at lift mid-way, symmetric', () => {
  const { points, arcLength } = sampleFiber(hairpin);
  for (const p of points) if (p.s <= 1) near(p.z, 0);
  const peak = Math.max(...points.map((p) => p.z));
  near(peak, 3, 1e-6);
  const mid = points.reduce((best, p) => (Math.abs(p.s - arcLength / 2) < Math.abs(best.s - arcLength / 2) ? p : best));
  near(mid.z, 3, 1e-6);
  for (let i = 0; i < points.length; i++) {
    const mirror = points[points.length - 1 - i];
    near(points[i].z, mirror.z, 1e-9);
  }
});

test('hairpin: z never decreases up to the peak and never increases after', () => {
  const { points } = sampleFiber(hairpin);
  let peakIndex = 0;
  points.forEach((p, i) => { if (p.z > points[peakIndex].z) peakIndex = i; });
  for (let i = 1; i <= peakIndex; i++) assert.ok(points[i].z >= points[i - 1].z - 1e-12);
  for (let i = peakIndex + 1; i < points.length; i++) assert.ok(points[i].z <= points[i - 1].z + 1e-12);
});

test('consecutive points are never farther apart than the resolution', () => {
  const { points } = sampleFiber(hairpin);
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    assert.ok(d <= 0.4 + 1e-9, `gap ${d} at ${i}`);
  }
});

test('peak slope with the defaults is about 17 degrees', () => {
  const { points } = sampleFiber(hairpin);
  let maxSlope = 0;
  for (let i = 1; i < points.length; i++) {
    const ds = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    maxSlope = Math.max(maxSlope, Math.abs(points[i].z - points[i - 1].z) / ds);
  }
  const deg = (Math.atan(maxSlope) * 180) / Math.PI;
  assert.ok(deg > 15.5 && deg < 18, `slope ${deg}`);
});

test('arch: a single strand from (0,0) to (0,length) with the same z profile', () => {
  const { points, arcLength } = sampleFiber({ ...hairpin, shape: 'arch' });
  near(points[0].y, 0);
  near(points[points.length - 1].y, 15);
  near(points[0].x, 0);
  near(arcLength, 15);
  near(Math.max(...points.map((p) => p.z)), 3, 1e-6);
});

test('unknown shape throws', () => {
  assert.throws(() => sampleFiber({ ...hairpin, shape: 'blob' }), /Unknown fiber shape/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/fiber.test.js`
Expected: FAIL with `Cannot find module '../src/engine/fiber.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/fiber.js`:

```js
const clamp01 = (u) => Math.min(1, Math.max(0, u));
const smooth = (x) => x * x * (3 - 2 * x);

const Z_PROFILES = {
  sin2: (u) => Math.sin(Math.PI * u) ** 2,
  bell: (u) => {
    const g = (x) => Math.exp(-((x - 0.5) ** 2) / (2 * 0.18 ** 2));
    const g0 = g(0);
    return (g(u) - g0) / (1 - g0);
  },
  smoothstep: (u) => (u < 0.5 ? smooth(2 * u) : smooth(2 * (1 - u))),
};

/** Height factor 0..1 along a fiber; 0 at both ends, 1 in the middle. */
export function zProfile(name, u) {
  const f = Z_PROFILES[name];
  if (!f) throw new Error(`Unknown z profile: ${name}`);
  return f(clamp01(u));
}

/** Two straight legs `width` apart, joined at the far end by a semicircular cap. */
function hairpinFootprint(width, length, resolution) {
  const r = width / 2;
  const straight = Math.max(length - r, 0);
  const pts = [];
  const nLeg = Math.max(1, Math.ceil(straight / resolution));
  for (let i = 0; i <= nLeg; i++) pts.push({ x: -r, y: (straight * i) / nLeg, part: 'leg' });
  const nCap = Math.max(2, Math.ceil((Math.PI * r) / resolution));
  for (let i = 1; i <= nCap; i++) {
    const a = Math.PI - (Math.PI * i) / nCap;
    pts.push({ x: r * Math.cos(a), y: straight + r * Math.sin(a), part: 'cap' });
  }
  for (let i = 1; i <= nLeg; i++) pts.push({ x: r, y: straight - (straight * i) / nLeg, part: 'leg' });
  return pts;
}

/** A single strand from (0,0) to (0,length): both feet on the same line, no width. */
function archFootprint(width, length, resolution) {
  const n = Math.max(2, Math.ceil(length / resolution));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push({ x: 0, y: (length * i) / n, part: 'leg' });
  return pts;
}

const FOOTPRINTS = { hairpin: hairpinFootprint, arch: archFootprint };

/**
 * Samples one fiber in a local frame: origin at the foot midpoint, +Y outward,
 * z = height above the loop base level, s = cumulative arc length.
 */
export function sampleFiber({ shape = 'hairpin', width, length, lift, dwell, profile = 'sin2', resolution }) {
  const footprint = FOOTPRINTS[shape];
  if (!footprint) throw new Error(`Unknown fiber shape: ${shape}`);
  const foot = footprint(width, length, resolution);
  const points = [];
  let s = 0;
  for (let i = 0; i < foot.length; i++) {
    if (i > 0) s += Math.hypot(foot[i].x - foot[i - 1].x, foot[i].y - foot[i - 1].y);
    points.push({ x: foot[i].x, y: foot[i].y, s, part: foot[i].part, z: 0 });
  }
  const arcLength = s;
  const span = Math.max(arcLength - 2 * dwell, 1e-9);
  for (const p of points) p.z = lift * zProfile(profile, (p.s - dwell) / span);
  return { points, arcLength };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/fiber.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/fiber.js tests/fiber.test.js
git commit -m "feat: add parametric fiber shapes and z profiles" -- src/engine/fiber.js tests/fiber.test.js
```

---

### Task 5: Serpentine base

**Files:**
- Create: `src/engine/base.js`, `tests/base.test.js`

**Interfaces:**
- Produces: `buildBase({ bbox, spacing, cornerRadius, z, resolution }) → { points: {x,y,z}[], length }` — one continuous polyline; line 0 runs +X from `(minX, minY)`; lines alternate; turns are quarter-circle fillets joined by a short step along the edge.

- [ ] **Step 1: Write the failing tests**

Create `tests/base.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBase } from '../src/engine/base.js';

const opts = { bbox: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, spacing: 5, cornerRadius: 1, z: 0.2, resolution: 0.4 };

test('100 x 100 at 5 mm spacing: starts at the origin, ends at the opposite corner', () => {
  const { points } = buildBase(opts);
  assert.deepEqual([points[0].x, points[0].y], [0, 0]);
  const last = points[points.length - 1];
  assert.ok(Math.abs(last.x - 100) < 1e-9 && Math.abs(last.y - 100) < 1e-9);
});

test('length is about 21 lines of 100 mm plus 20 edge steps, minus fillet savings', () => {
  const { length } = buildBase(opts);
  assert.ok(length > 2175 && length < 2200, `length ${length}`);
});

test('every point stays inside the bbox, at the requested z, with no duplicates', () => {
  const { points } = buildBase(opts);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    assert.ok(p.x >= -1e-9 && p.x <= 100 + 1e-9 && p.y >= -1e-9 && p.y <= 100 + 1e-9);
    assert.equal(p.z, 0.2);
    if (i > 0) assert.ok(Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1e-9);
  }
});

test('lines alternate direction: y=0 runs +x, y=5 runs -x', () => {
  const { points } = buildBase(opts);
  const row0 = points.filter((p) => Math.abs(p.y) < 1e-9);
  assert.ok(row0[row0.length - 1].x > row0[0].x);
  const row5 = points.filter((p) => Math.abs(p.y - 5) < 1e-9);
  assert.ok(row5[row5.length - 1].x < row5[0].x);
});

test('no fillets (radius 0) gives sharp turns and still one path', () => {
  const { points, length } = buildBase({ ...opts, cornerRadius: 0 });
  assert.ok(Math.abs(length - (21 * 100 + 20 * 5)) < 1e-6);
  assert.ok(points.length >= 2 * 21);
});

test('a single line when the height is less than the spacing', () => {
  const { points } = buildBase({ ...opts, bbox: { minX: 0, minY: 0, maxX: 20, maxY: 3 } });
  assert.equal(points.length, 2);
  assert.deepEqual([points[1].x, points[1].y], [20, 0]);
});

test('fillet radius is clamped to half the spacing', () => {
  const { points } = buildBase({ ...opts, cornerRadius: 10 });
  for (const p of points) assert.ok(p.x >= -1e-9 && p.x <= 100 + 1e-9);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/base.test.js`
Expected: FAIL with `Cannot find module '../src/engine/base.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/base.js`:

```js
function arc(cx, cy, r, a0, a1, resolution) {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / resolution));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** One continuous serpentine over the bbox: lines along X, `spacing` apart. */
export function buildBase({ bbox, spacing, cornerRadius, z, resolution }) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const lines = Math.floor(height / spacing + 1e-9) + 1;
  const r = Math.max(0, Math.min(cornerRadius, spacing / 2, width / 2));
  const points = [];
  const push = (x, y) => {
    const last = points[points.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 1e-9) points.push({ x, y, z });
  };

  for (let k = 0; k < lines; k++) {
    const y0 = bbox.minY + k * spacing;
    const dir = k % 2 === 0 ? 1 : -1;
    const xa = dir === 1 ? bbox.minX : bbox.maxX;
    const xb = dir === 1 ? bbox.maxX : bbox.minX;
    if (k === 0) push(xa, y0);
    if (k === lines - 1) {
      push(xb, y0);
      break;
    }
    const y1 = y0 + spacing;
    if (r > 0) {
      push(xb - dir * r, y0);
      const a1 = dir === 1 ? 0 : -Math.PI;
      for (const p of arc(xb - dir * r, y0 + r, r, -Math.PI / 2, a1, resolution)) push(p.x, p.y);
      push(xb, y1 - r);
      const b0 = dir === 1 ? 0 : Math.PI;
      for (const p of arc(xb - dir * r, y1 - r, r, b0, Math.PI / 2, resolution)) push(p.x, p.y);
    } else {
      push(xb, y0);
      push(xb, y1);
    }
  }

  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return { points, length };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/base.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/base.js tests/base.test.js
git commit -m "feat: add serpentine base generator" -- src/engine/base.js tests/base.test.js
```

---

### Task 6: Tiler (rows, stagger, leg gap, randomness, ordering)

**Files:**
- Create: `src/engine/tiler.js`, `tests/tiler.test.js`

**Interfaces:**
- Consumes: `cfg` from `resolveConfig`; a boundary with `bbox()` and `containsPolyline(points, policy)`; an rng with `symmetric(amp)`.
- Produces: `tile(cfg, boundary, rng) → { placements, warnings, counts }`
  - `placement = { id: 'r{row}c{col}', row, col, footY, points: {x, y, z, s, part}[], arcLength, lift }` (world XY in sample frame; `z` is relative to the loop base level)
  - ordering: rows from the largest `footY` down to 0, columns ascending within a row
  - `counts = { candidates, kept, dropped, unresolvedLegs }`
- Produces: `countLegGapViolations(placements, gap) → number`, `MAX_LOOPS = 4000`.

- [ ] **Step 1: Write the scene helper and the failing tests**

Create `tests/scene.js`:

```js
import { resolveConfig } from '../src/engine/params.js';
import { RectBoundary } from '../src/engine/boundary.js';
import { buildBase } from '../src/engine/base.js';
import { tile } from '../src/engine/tiler.js';
import { createRng } from '../src/engine/rng.js';
import { defaultProfiles } from './helpers.js';

/** Builds cfg + boundary + base + tiled loops for a parameter override set. */
export function scene(over = {}, profiles = {}) {
  const defaults = defaultProfiles();
  const cfg = resolveConfig(profiles.machine ?? defaults.machine, profiles.material ?? defaults.material, over);
  const boundary = new RectBoundary(cfg.t.sample_width, cfg.t.sample_height);
  const t = cfg.t;
  const base = t.include_base
    ? buildBase({ bbox: boundary.bbox(), spacing: t.base_spacing, cornerRadius: t.corner_radius, z: t.layer_height, resolution: t.curve_resolution })
    : null;
  const tiled = t.include_loops
    ? tile(cfg, boundary, createRng(t.random_seed))
    : { placements: [], warnings: [], counts: { candidates: 0, kept: 0, dropped: 0, unresolvedLegs: 0 } };
  return { cfg, boundary, base, tiled };
}
```

Create `tests/tiler.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { tile, countLegGapViolations, MAX_LOOPS } from '../src/engine/tiler.js';
import { ConfigError } from '../src/engine/params.js';
import { RectBoundary } from '../src/engine/boundary.js';
import { createRng } from '../src/engine/rng.js';
import { scene } from './scene.js';

function setup(over = {}) {
  const s = scene({ ...over, include_loops: false });
  return { cfg: s.cfg, boundary: s.boundary };
}

test('default 100 x 100 tile: 18 rows, 567 loops, far rows first', () => {
  const { cfg, boundary } = setup();
  const { placements, counts } = tile(cfg, boundary, createRng(1));
  assert.equal(placements.length, 567);
  assert.equal(counts.kept, 567);
  assert.equal(new Set(placements.map((p) => p.row)).size, 18);
  assert.equal(placements[0].row, 17);
  assert.equal(placements[placements.length - 1].row, 0);
  assert.equal(placements.filter((p) => p.row === 0).length, 32);
  assert.equal(placements.filter((p) => p.row === 1).length, 31);
  for (let i = 1; i < placements.length; i++) {
    const a = placements[i - 1], b = placements[i];
    assert.ok(a.row > b.row || (a.row === b.row && a.col < b.col));
  }
});

test('feet sit on the foot line and legs are width apart', () => {
  const { cfg, boundary } = setup();
  const { placements } = tile(cfg, boundary, createRng(1));
  const p = placements.find((q) => q.row === 0 && q.col === 0);
  assert.ok(Math.abs(p.points[0].y - 0) < 1e-9);
  assert.ok(Math.abs(p.points[0].x - 0) < 1e-9);
  assert.ok(Math.abs(p.points[p.points.length - 1].x - 6) < 1e-9);
  assert.equal(p.footY, 0);
  assert.equal(p.lift, 3);
});

test('leg gap invariant holds on the default tile', () => {
  const { cfg, boundary } = setup();
  const { placements, warnings } = tile(cfg, boundary, createRng(1));
  assert.equal(countLegGapViolations(placements, 0.6), 0);
  assert.deepEqual(warnings, []);
  // coincident legs would be 0 apart; the nudge pattern is 0,0,+g,+g along the row
  const row0 = placements.filter((p) => p.row === 0).sort((a, b) => a.col - b.col);
  const left = row0.slice(0, 6).map((p) => +p.points[0].x.toFixed(3));
  assert.deepEqual(left, [0, 3, 6.6, 9.6, 12, 15]);
});

test('20 x 20 sample holds 10 loops (2 rows of 5)', () => {
  const { cfg, boundary } = setup({ sample_width: 20, sample_height: 20 });
  const { placements } = tile(cfg, boundary, createRng(1));
  assert.equal(placements.length, 10);
});

test('randomness off never touches the rng', () => {
  const { cfg, boundary } = setup({ sample_width: 30, sample_height: 30 });
  const exploding = { next() { throw new Error('rng used'); }, symmetric() { throw new Error('rng used'); } };
  assert.doesNotThrow(() => tile(cfg, boundary, exploding));
});

test('same seed gives identical tiles, a different seed differs', () => {
  const over = {
    sample_width: 30, sample_height: 30, random_enabled: true,
    amp_length: 1, amp_width: 0.5, amp_lift: 0.5, amp_xy: 0.5, amp_orientation: 5, amp_spacing: 0.3,
  };
  const { cfg, boundary } = setup(over);
  const a = tile(cfg, boundary, createRng(7));
  const b = tile(cfg, boundary, createRng(7));
  const c = tile(cfg, boundary, createRng(8));
  assert.deepEqual(a.placements, b.placements);
  assert.notDeepEqual(a.placements, c.placements);
});

test('a sample smaller than one loop yields zero loops and a warning', () => {
  const { cfg, boundary } = setup({ sample_width: 5, sample_height: 5 });
  const { placements, warnings } = tile(cfg, boundary, createRng(1));
  assert.equal(placements.length, 0);
  assert.ok(warnings.some((w) => /no loops fit/i.test(w)));
});

test('an unresolvable leg gap terminates with a warning', () => {
  const { cfg, boundary } = setup({ sample_width: 20, sample_height: 20, loop_pitch: 0.5 });
  const { placements, warnings } = tile(cfg, boundary, createRng(1));
  assert.ok(placements.length > 0);
  assert.ok(warnings.some((w) => /leg gap/i.test(w)));
});

test('absurd loop counts are refused with a readable error', () => {
  const { cfg, boundary } = setup({ loop_pitch: 0.05 });
  assert.throws(() => tile(cfg, boundary, createRng(1)), (e) => {
    assert.ok(e instanceof ConfigError);
    assert.match(e.message, new RegExp(String(MAX_LOOPS)));
    return true;
  });
});

test('loops that leave the boundary are dropped', () => {
  const { cfg } = setup({ sample_width: 30, sample_height: 30 });
  const small = new RectBoundary(30, 18);
  const { placements, counts } = tile(cfg, small, createRng(1));
  assert.ok(counts.dropped > 0);
  for (const p of placements) for (const q of p.points) assert.ok(q.y <= 18 + 1e-9);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/tiler.test.js`
Expected: FAIL with `Cannot find module '../src/engine/tiler.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/tiler.js`:

```js
import { sampleFiber } from './fiber.js';
import { ConfigError } from './params.js';

const EPS = 1e-9;
export const MAX_LOOPS = 4000;
const NO_JITTER = Object.freeze({ width: 0, length: 0, lift: 0 });

/** X positions of the two leg lines a loop centred at cx would have. */
function legLines(t, cx) {
  const half = t.loop_width / 2;
  return t.fiber_shape === 'arch' ? [cx, cx] : [cx - half, cx + half];
}

function conflicts(candidate, existing, gap) {
  if (gap <= 0) return false;
  for (const c of candidate) for (const e of existing) if (Math.abs(c - e) < gap - EPS) return true;
  return false;
}

function fiberParams(t, jitter) {
  const width = Math.max(0.5, t.loop_width + jitter.width);
  const length = Math.max(t.loop_length + jitter.length, width / 2 + 0.5);
  return {
    shape: t.fiber_shape,
    width,
    length,
    lift: Math.max(0, t.loop_z_lift + jitter.lift),
    dwell: Math.min(t.anchor_dwell, 0.4 * length),
    profile: t.z_profile,
    resolution: t.curve_resolution,
  };
}

/**
 * Places fibers on the boundary. Rows have their feet on base lines; alternate rows are staggered;
 * loops that would put a leg closer than `leg_gap` to another leg are nudged sideways.
 * Rows are returned far-to-near ("shingle order") so the nozzle never dives under a raised strand.
 */
export function tile(cfg, boundary, rng) {
  const { t, derived } = cfg;
  const bbox = boundary.bbox();
  const half = t.loop_width / 2;
  const rowCount = Math.floor((bbox.maxY - bbox.minY) / derived.rowPitch + EPS) + 1;
  const perRow = Math.max(0, Math.floor((bbox.maxX - bbox.minX - t.loop_width) / t.loop_pitch + EPS) + 1);
  if (perRow * rowCount > MAX_LOOPS) {
    throw new ConfigError([
      `Too many loops (about ${perRow * rowCount}); the limit is ${MAX_LOOPS}. Increase loop_pitch or base_spacing, or use a smaller sample.`,
    ]);
  }

  const template = t.random_enabled ? null : sampleFiber(fiberParams(t, NO_JITTER));
  const rows = [];
  const counts = { candidates: 0, kept: 0, dropped: 0, unresolvedLegs: 0 };

  for (let k = 0; k < rowCount; k++) {
    const footY = bbox.minY + k * derived.rowPitch;
    const stagger = k % 2 === 1 ? t.row_stagger * t.loop_pitch : 0;
    const legs = [];
    const row = [];
    for (let i = 0; ; i++) {
      const nominalX = bbox.minX + half + stagger + i * t.loop_pitch;
      if (nominalX + half > bbox.maxX + EPS) break;
      counts.candidates++;

      let shift = 0;
      let resolved = false;
      for (let n = 0; n <= 3; n++) {
        if (!conflicts(legLines(t, nominalX + n * t.leg_gap), legs, t.leg_gap)) {
          shift = n * t.leg_gap;
          resolved = true;
          break;
        }
      }
      if (!resolved) counts.unresolvedLegs++;

      let jitter = NO_JITTER;
      let dx = 0, dy = 0, rot = 0;
      if (t.random_enabled) {
        jitter = {
          length: rng.symmetric(t.amp_length),
          width: rng.symmetric(t.amp_width),
          lift: rng.symmetric(t.amp_lift),
        };
        dx = rng.symmetric(t.amp_xy);
        dy = rng.symmetric(t.amp_xy);
        rot = rng.symmetric(t.amp_orientation);
        dx += rng.symmetric(t.amp_spacing);
      }

      const fp = fiberParams(t, jitter);
      const fiber = template ?? sampleFiber(fp);
      const cx = nominalX + shift + dx;
      const cy = footY + dy;
      const th = (rot * Math.PI) / 180;
      const c = Math.cos(th), s = Math.sin(th);
      const points = fiber.points.map((p) => ({
        x: cx + c * p.x - s * p.y,
        y: cy + s * p.x + c * p.y,
        z: p.z,
        s: p.s,
        part: p.part,
      }));

      if (!boundary.containsPolyline(points, t.boundary_policy)) {
        counts.dropped++;
        continue;
      }
      legs.push(points[0].x, points[points.length - 1].x);
      row.push({ id: `r${k}c${i}`, row: k, col: i, footY, points, arcLength: fiber.arcLength, lift: fp.lift });
      counts.kept++;
    }
    rows.push(row);
  }

  const warnings = [];
  if (counts.unresolvedLegs > 0) {
    warnings.push(`${counts.unresolvedLegs} loop(s) could not keep the ${t.leg_gap} mm leg gap; increase loop_pitch or reduce leg_gap`);
  }
  if (counts.kept === 0) warnings.push('No loops fit inside the boundary; only the base will print');
  return { placements: rows.reverse().flat(), warnings, counts };
}

/** Counts pairs of loops in the same row whose leg lines are closer than `gap`. */
export function countLegGapViolations(placements, gap) {
  const byRow = new Map();
  for (const p of placements) {
    if (!byRow.has(p.row)) byRow.set(p.row, []);
    byRow.get(p.row).push([p.points[0].x, p.points[p.points.length - 1].x]);
  }
  let violations = 0;
  for (const list of byRow.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (conflicts(list[i], list[j], gap)) violations++;
      }
    }
  }
  return violations;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/tiler.test.js`
Expected: PASS (10 tests). If the leg-position assertion `[0, 3, 6.6, 9.6, 12, 15]` fails, print `left` and check the greedy order against the spec's `0,0,+δ,+δ` pattern before changing the test.

- [ ] **Step 5: Commit**

```bash
git add src/engine/tiler.js tests/scene.js tests/tiler.test.js
git commit -m "feat: add tiler with stagger, leg gap and seeded randomness" -- src/engine/tiler.js tests/scene.js tests/tiler.test.js
```

---

### Task 7: Extrusion and speed clamping

**Files:**
- Create: `src/engine/extrusion.js`, `tests/extrusion.test.js`

**Interfaces:**
- Consumes: `cfg` (`cfg.t`, `cfg.derived`).
- Produces:
  - `EXTRUDING: Set<string>` = base, supported, rising, falling, unsupported
  - `filamentArea(d)`, `roundedRectArea(w, h)`, `roundArea(d)` → mm²
  - `strandArea(cls, cfg)`: base/supported → rounded rectangle (`extrusion_width` × `layer_height`); others → round (`derived.freeDiameter`)
  - `volumePerMm(cls, cfg)` = `strandArea × derived.multiplier` (actual deposited mm³ per mm)
  - `segmentE(ds, cls, cfg)` → mm of filament for a move of 3D length `ds`
  - `classTargetSpeed(cls, t)` → mm/s
  - `moveSpeed(cls, dx, dy, dz, cfg)` → mm/s, clamped by class, volumetric ceiling, machine X/Y/Z/E.

- [ ] **Step 1: Write the failing tests**

Create `tests/extrusion.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/engine/params.js';
import {
  filamentArea, roundedRectArea, roundArea, strandArea, volumePerMm, segmentE, classTargetSpeed, moveSpeed, EXTRUDING,
} from '../src/engine/extrusion.js';
import { defaultProfiles, loadProfile } from './helpers.js';

const { machine, material } = defaultProfiles();
const cfgFor = (over = {}, mat = material) => resolveConfig(machine, mat, over);
const near = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('areas', () => {
  near(filamentArea(1.75), 2.405282, 1e-5);
  near(roundedRectArea(0.45, 0.2), 0.2 * (0.45 - 0.2 * (1 - Math.PI / 4)), 1e-9);
  near(roundArea(0.4), Math.PI * 0.04, 1e-9);
});

test('E matches the real PrusaSlicer move: 100 mm, 0.42 x 0.2, multiplier 1.15 => E3.60574', () => {
  const generic = loadProfile('materials', 'generic-flex-mk3');
  const cfg = cfgFor({ extrusion_width: 0.42 }, generic);
  near(segmentE(100, 'base', cfg), 3.60574, 1e-4);
});

test('E uses true 3D distance', () => {
  const cfg = cfgFor();
  const perMm = segmentE(1, 'rising', cfg);
  near(segmentE(Math.hypot(3, 0, 4), 'rising', cfg), 5 * perMm, 1e-9);
  assert.ok(segmentE(5, 'rising', cfg) > segmentE(3, 'rising', cfg));
});

test('strand area per class', () => {
  const cfg = cfgFor();
  assert.equal(strandArea('base', cfg), strandArea('supported', cfg));
  near(strandArea('unsupported', cfg), roundArea(0.4), 1e-9);
  near(volumePerMm('base', cfg), roundedRectArea(0.45, 0.2) * 0.73, 1e-9);
});

test('class target speeds come from the parameters', () => {
  const t = cfgFor().t;
  assert.equal(classTargetSpeed('base', t), 15);
  assert.equal(classTargetSpeed('supported', t), 12);
  assert.equal(classTargetSpeed('rising', t), 8);
  assert.equal(classTargetSpeed('falling', t), 8);
  assert.equal(classTargetSpeed('unsupported', t), 5);
  assert.equal(classTargetSpeed('travel', t), 150);
});

test('an easy move runs at the class target', () => {
  assert.equal(moveSpeed('base', 10, 0, 0, cfgFor()), 15);
});

test('volumetric ceiling clamps a fast base move', () => {
  const cfg = cfgFor({ speed_base: 100 });
  const expected = cfg.derived.maxVolActual / volumePerMm('base', cfg);
  near(moveSpeed('base', 10, 0, 0, cfg), expected, 1e-9);
  assert.ok(expected < 100);
});

test('machine Z limit clamps steep moves (Review Focus: extreme lift)', () => {
  const cfg = cfgFor({ speed_unsupported: 50 });
  const v = moveSpeed('unsupported', 0.1, 0, 1, cfg);
  const ds = Math.hypot(0.1, 0, 1);
  near(v, (12 * ds) / 1, 1e-9);
  assert.ok(v * (1 / ds) <= 12 + 1e-9);
});

test('machine XY limit clamps travel, stealth mode lowers it', () => {
  assert.equal(moveSpeed('travel', 100, 0, 0, cfgFor({ speed_travel: 400 })), 200);
  assert.equal(moveSpeed('travel', 100, 0, 0, cfgFor({ speed_travel: 400, limits_mode: 'stealth' })), 100);
});

test('a pure Z travel is limited to the Z feedrate', () => {
  assert.equal(moveSpeed('travel', 0, 0, 5, cfgFor({ speed_travel: 150 })), 12);
});

test('a zero-length move returns the class target', () => {
  assert.equal(moveSpeed('base', 0, 0, 0, cfgFor()), 15);
});

test('EXTRUDING covers every extruding class and not travel', () => {
  for (const c of ['base', 'supported', 'rising', 'falling', 'unsupported']) assert.ok(EXTRUDING.has(c));
  assert.ok(!EXTRUDING.has('travel'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/extrusion.test.js`
Expected: FAIL with `Cannot find module '../src/engine/extrusion.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/extrusion.js`:

```js
export const EXTRUDING = new Set(['base', 'supported', 'rising', 'falling', 'unsupported']);

export const filamentArea = (d) => Math.PI * (d / 2) ** 2;
export const roundArea = (d) => Math.PI * (d / 2) ** 2;
/** PrusaSlicer's rounded-rectangle strand model: h * (w - h * (1 - pi/4)). */
export const roundedRectArea = (w, h) => h * (w - h * (1 - Math.PI / 4));

export function strandArea(cls, cfg) {
  if (cls === 'base' || cls === 'supported') return roundedRectArea(cfg.t.extrusion_width, cfg.t.layer_height);
  return roundArea(cfg.derived.freeDiameter);
}

/** Actual deposited volume per mm of path (after the flow multiplier). */
export function volumePerMm(cls, cfg) {
  return strandArea(cls, cfg) * cfg.derived.multiplier;
}

/** Filament length (mm, relative E) for a move of 3D length `ds`. */
export function segmentE(ds, cls, cfg) {
  return (ds * volumePerMm(cls, cfg)) / filamentArea(cfg.derived.filamentDiameter);
}

export function classTargetSpeed(cls, t) {
  switch (cls) {
    case 'base': return t.speed_base;
    case 'supported': return t.speed_supported;
    case 'rising':
    case 'falling': return t.speed_nonplanar;
    case 'unsupported': return t.speed_unsupported;
    case 'travel': return t.speed_travel;
    default: throw new Error(`Unknown move class: ${cls}`);
  }
}

/** Linear speed (mm/s along the 3D vector) after all clamps. */
export function moveSpeed(cls, dx, dy, dz, cfg) {
  const ds = Math.hypot(dx, dy, dz);
  let v = classTargetSpeed(cls, cfg.t);
  if (ds === 0) return v;
  const lim = cfg.derived.limits.max_feedrate;
  const cap = (limit, component) => {
    if (component > 1e-12) v = Math.min(v, (limit * ds) / component);
  };
  cap(lim.x, Math.abs(dx));
  cap(lim.y, Math.abs(dy));
  cap(lim.z, Math.abs(dz));
  if (EXTRUDING.has(cls)) {
    const vol = volumePerMm(cls, cfg);
    v = Math.min(v, cfg.derived.maxVolActual / vol);
    v = Math.min(v, (lim.e * filamentArea(cfg.derived.filamentDiameter)) / vol);
  }
  return v;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/extrusion.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/extrusion.js tests/extrusion.test.js
git commit -m "feat: add extrusion model and speed clamping" -- src/engine/extrusion.js tests/extrusion.test.js
```

---

### Task 8: Planner (move classes, travels, height map, clearance)

**Files:**
- Create: `src/engine/planner.js`, `tests/planner.test.js`

**Interfaces:**
- Consumes: `cfg`; `base` (`{points: {x,y,z}[]}` or `null`); `placements` from `tile` (`points[].z` relative to `loopBaseZ`); `boundary.bbox()`.
- Produces:
  - `class HeightMap { constructor(bbox, cell = 0.5, margin = 10); add(x,y,z); addSegment(a,b); maxWithin(x,y,r); maxAlong(a,b,r); collides(x,y,z,model) }`
  - `clearanceModel(cfg) → { tipRadius, tanA, clearance }`
  - `plan(cfg, base, placements, boundary) → { moves, warnings, violations }` where `move = { x, y, z, cls, extrude, retract?: 'retract'|'unretract', tag?, violation?: true }` and `cls ∈ base|supported|rising|falling|unsupported|travel`.

- [ ] **Step 1: Write the failing tests**

Create `tests/planner.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, HeightMap, clearanceModel } from '../src/engine/planner.js';
import { scene } from './scene.js';

const CLASSES = new Set(['base', 'supported', 'rising', 'falling', 'unsupported', 'travel']);
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

function run(over = {}, reverse = false) {
  const s = scene({ sample_width: 20, sample_height: 20, ...over });
  const placements = reverse ? [...s.tiled.placements].reverse() : s.tiled.placements;
  return { ...s, result: plan(s.cfg, s.base, placements, s.boundary) };
}

test('moves are well formed and travel never extrudes', () => {
  const { result } = run();
  assert.ok(result.moves.length > 100);
  for (const m of result.moves) {
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.z));
    assert.ok(CLASSES.has(m.cls), m.cls);
    assert.equal(m.extrude, m.cls !== 'travel');
  }
  assert.equal(result.moves[0].cls, 'travel');
});

test('loop feet are at loopBaseZ (0.4) and the peak is loopBaseZ + lift (3.4)', () => {
  const { result } = run();
  const loopMoves = result.moves.filter((m) => m.extrude && m.cls !== 'base');
  const zs = loopMoves.map((m) => m.z);
  near(Math.min(...zs), 0.4);
  near(Math.max(...zs), 3.4, 1e-6);
  for (const m of result.moves.filter((q) => q.cls === 'base')) near(m.z, 0.2);
});

test('classification: unsupported near the peak, supported near the feet', () => {
  const { result } = run();
  const unsupported = result.moves.filter((m) => m.cls === 'unsupported');
  assert.ok(unsupported.length > 0);
  for (const m of unsupported) assert.ok(m.z - 0.4 >= 0.6 * 3 - 0.25);
  const supported = result.moves.filter((m) => m.cls === 'supported');
  assert.ok(supported.length > 0);
  // classification uses the segment midpoint, so the endpoint can sit one half-step above the threshold
  for (const m of supported) assert.ok(m.z - 0.4 <= 0.4 + 0.15);
  assert.ok(result.moves.some((m) => m.cls === 'rising'));
  assert.ok(result.moves.some((m) => m.cls === 'falling'));
});

test('travels between strands lift above what is printed', () => {
  const { result } = run();
  const travelsAbove = result.moves.filter((m) => m.cls === 'travel' && m.z > 0.4 + 0.5);
  assert.ok(travelsAbove.length > 0);
});

test('shingle order produces fewer clearance violations than near-to-far order', () => {
  const good = run().result.violations;
  const bad = run({}, true).result.violations;
  assert.ok(bad > good, `reverse ${bad} should exceed shingle ${good}`);
});

test('retract/unretract markers pair up and only appear for long travels', () => {
  const { result } = run({ retraction_length: 2.5 });
  const r = result.moves.filter((m) => m.retract === 'retract').length;
  const u = result.moves.filter((m) => m.retract === 'unretract').length;
  assert.ok(r > 0);
  assert.equal(r, u);
});

test('no retract markers when the retraction length is 0', () => {
  const { result } = run({ retraction_length: 0 });
  assert.equal(result.moves.filter((m) => m.retract).length, 0);
});

test('base only and loops only both plan', () => {
  const baseOnly = run({ include_loops: false }).result;
  assert.ok(baseOnly.moves.every((m) => m.cls === 'base' || m.cls === 'travel'));
  const loopsOnly = run({ include_base: false }).result;
  assert.ok(loopsOnly.moves.every((m) => m.cls !== 'base'));
  assert.ok(loopsOnly.moves.length > 50);
});

test('nothing to print plans to an empty move list', () => {
  const { result } = run({ include_base: false, include_loops: false });
  assert.deepEqual(result.moves, []);
});

test('HeightMap: add, query and collision model', () => {
  const map = new HeightMap({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
  map.addSegment({ x: 5, y: 5, z: 3 }, { x: 10, y: 5, z: 3 });
  assert.ok(map.maxWithin(7, 5, 0.6) >= 3 - 1e-9);
  assert.equal(map.maxWithin(15, 15, 0.6), -Infinity);
  const model = { tipRadius: 0.6, tanA: Math.tan(Math.PI / 6), clearance: 1 };
  assert.equal(map.collides(7, 5, 0.4, model), true);
  assert.equal(map.collides(7, 15, 0.4, model), false);
  assert.equal(map.collides(7, 5, 3.0, model), false);
});

test('clearanceModel adds a foam pad and converts the cone angle', () => {
  const { cfg } = run();
  const m = clearanceModel(cfg);
  near(m.tipRadius, 0.6);
  near(m.tanA, Math.tan(Math.PI / 6), 1e-12);
  near(m.clearance, 1 + 0.5 * 0.4 * (Math.sqrt(1.5) - 1), 1e-9);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/planner.test.js`
Expected: FAIL with `Cannot find module '../src/engine/planner.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/planner.js`:

```js
const Z_MARGIN = 0.05;

/** Coarse grid of the highest printed nozzle Z per cell; used for travels and clearance checks. */
export class HeightMap {
  constructor(bbox, cell = 0.5, margin = 10) {
    this.cell = cell;
    this.minX = bbox.minX - margin;
    this.minY = bbox.minY - margin;
    this.nx = Math.ceil((bbox.maxX - bbox.minX + 2 * margin) / cell) + 1;
    this.ny = Math.ceil((bbox.maxY - bbox.minY + 2 * margin) / cell) + 1;
    this.data = new Float64Array(this.nx * this.ny).fill(-Infinity);
    this.maxZ = -Infinity;
  }

  index(x, y) {
    const ix = Math.round((x - this.minX) / this.cell);
    const iy = Math.round((y - this.minY) / this.cell);
    if (ix < 0 || iy < 0 || ix >= this.nx || iy >= this.ny) return -1;
    return iy * this.nx + ix;
  }

  add(x, y, z) {
    const i = this.index(x, y);
    if (i < 0) return;
    if (z > this.data[i]) this.data[i] = z;
    if (z > this.maxZ) this.maxZ = z;
  }

  addSegment(a, b) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / (this.cell / 2)));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      this.add(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
    }
  }

  maxWithin(x, y, r) {
    let best = -Infinity;
    const c = Math.ceil(r / this.cell);
    const cx = Math.round((x - this.minX) / this.cell);
    const cy = Math.round((y - this.minY) / this.cell);
    const limit = r * r + this.cell * this.cell;
    for (let dy = -c; dy <= c; dy++) {
      const iy = cy + dy;
      if (iy < 0 || iy >= this.ny) continue;
      for (let dx = -c; dx <= c; dx++) {
        const ix = cx + dx;
        if (ix < 0 || ix >= this.nx) continue;
        if ((dx * dx + dy * dy) * this.cell * this.cell > limit) continue;
        const z = this.data[iy * this.nx + ix];
        if (z > best) best = z;
      }
    }
    return best;
  }

  maxAlong(a, b, r) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / this.cell));
    let best = -Infinity;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      best = Math.max(best, this.maxWithin(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, r));
    }
    return best;
  }

  /** True if an already-printed strand is inside the nozzle cone at (x, y, z). */
  collides(x, y, z, model) {
    const { tipRadius, tanA, clearance } = model;
    if (this.maxZ <= z + Z_MARGIN) return false;
    const rMax = tipRadius + (this.maxZ - z) * tanA + clearance;
    const c = Math.ceil(rMax / this.cell);
    const cx = Math.round((x - this.minX) / this.cell);
    const cy = Math.round((y - this.minY) / this.cell);
    for (let dy = -c; dy <= c; dy++) {
      const iy = cy + dy;
      if (iy < 0 || iy >= this.ny) continue;
      for (let dx = -c; dx <= c; dx++) {
        const ix = cx + dx;
        if (ix < 0 || ix >= this.nx) continue;
        const zc = this.data[iy * this.nx + ix];
        if (zc <= z + Z_MARGIN) continue;
        const d = Math.hypot(this.minX + ix * this.cell - x, this.minY + iy * this.cell - y);
        if (d < tipRadius + (zc - z) * tanA + clearance) return true;
      }
    }
    return false;
  }
}

export function clearanceModel(cfg) {
  const { t, derived, material } = cfg;
  const foam = Math.max(material.flow.foam_expansion ?? 1, 1);
  const pad = 0.5 * derived.freeDiameter * (Math.sqrt(foam) - 1);
  return {
    tipRadius: t.nozzle_tip_radius,
    tanA: Math.tan((t.nozzle_cone_half_angle * Math.PI) / 180),
    clearance: t.clearance + pad,
  };
}

function classify(strand, a, b, cfg) {
  if (strand.kind === 'base') return 'base';
  const { t, derived } = cfg;
  const zr = (a.z + b.z) / 2 - derived.loopBaseZ;
  if (zr <= t.support_threshold) return 'supported';
  if (zr >= t.unsupported_fraction * strand.lift) return 'unsupported';
  return b.z >= a.z ? 'rising' : 'falling';
}

/**
 * Turns the base and the placed loops into one ordered list of moves (each the target of a G1).
 * Strands print in the given order; travels lift over what is already printed.
 */
export function plan(cfg, base, placements, boundary) {
  const { t, derived } = cfg;
  const map = new HeightMap(boundary.bbox());
  const model = clearanceModel(cfg);
  const moves = [];
  const strands = [];
  if (base) strands.push({ kind: 'base', id: 'base', pts: base.points, lift: 0 });
  for (const p of placements) {
    strands.push({
      kind: 'loop',
      id: p.id,
      lift: p.lift,
      pts: p.points.map((q) => ({ x: q.x, y: q.y, z: derived.loopBaseZ + q.z })),
    });
  }

  let cur = null;
  let violations = 0;
  let pendingUnretract = false;
  const travel = (x, y, z) => ({ x, y, z, cls: 'travel', extrude: false });

  for (const strand of strands) {
    if (strand.pts.length < 2) continue;
    const first = strand.pts[0];

    // --- travel to the strand start
    if (cur === null) {
      const safeZ = first.z + Math.max(5, t.clearance);
      moves.push(travel(first.x, first.y, safeZ));
      moves.push(travel(first.x, first.y, first.z));
    } else {
      const dist = Math.hypot(first.x - cur.x, first.y - cur.y);
      const dz = Math.abs(first.z - cur.z);
      if (dist > 1e-6 || dz > 1e-6) {
        const under = dist > 1e-6 ? map.maxAlong(cur, first, model.tipRadius) : map.maxWithin(cur.x, cur.y, model.tipRadius);
        const tz = under > -Infinity ? Math.max(under + model.clearance, cur.z, first.z) : Math.max(cur.z, first.z) + derived.retraction.zHop;
        const seq = [];
        if (tz > cur.z + 1e-9) seq.push(travel(cur.x, cur.y, tz));
        if (dist > 1e-6) seq.push(travel(first.x, first.y, tz));
        if (tz > first.z + 1e-9) seq.push(travel(first.x, first.y, first.z));
        if (seq.length > 0) {
          if (dist >= derived.retraction.minTravel && derived.retraction.length > 0) {
            seq[0].retract = 'retract';
            pendingUnretract = true;
          }
          moves.push(...seq);
        }
      }
    }

    // --- validate against what is already printed (own strand is not in the map yet)
    const flagged = new Set();
    for (let i = 1; i < strand.pts.length; i++) {
      const p = strand.pts[i];
      if (map.collides(p.x, p.y, p.z, model)) {
        flagged.add(i);
        violations++;
      }
    }

    // --- extrude the strand
    for (let i = 1; i < strand.pts.length; i++) {
      const a = strand.pts[i - 1], b = strand.pts[i];
      const move = { x: b.x, y: b.y, z: b.z, cls: classify(strand, a, b, cfg), extrude: true, tag: strand.id };
      if (i === 1 && pendingUnretract) {
        move.retract = 'unretract';
        pendingUnretract = false;
      }
      if (flagged.has(i)) move.violation = true;
      moves.push(move);
    }

    for (let i = 1; i < strand.pts.length; i++) map.addSegment(strand.pts[i - 1], strand.pts[i]);
    cur = strand.pts[strand.pts.length - 1];
  }

  const warnings = [];
  if (violations > 0) {
    warnings.push(`${violations} move(s) come closer to printed strands than the clearance model allows (red points in the preview)`);
  }
  return { moves, warnings, violations };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/planner.test.js`
Expected: PASS (11 tests). If the "shingle fewer than reverse" test fails, print both counts: the reverse order must have strictly more violations; do not weaken the test, fix the planner or the clearance model.

- [ ] **Step 5: Commit**

```bash
git add src/engine/planner.js tests/planner.test.js
git commit -m "feat: add planner with move classes, travels and clearance map" -- src/engine/planner.js tests/planner.test.js
```

---

### Task 9: G-code writer and preflight

**Files:**
- Create: `src/engine/gcode.js`, `tests/gcode.test.js`

**Interfaces:**
- Consumes: `moves` from `plan`; `cfg`; optional `info = { stats }` (`stats.timeSec`, `stats.filamentMm`, `stats.loops`, `stats.maxSlopeDeg` printed in the header when present).
- Produces: `preflight(moves, cfg) → string[]`, `class PreflightError extends Error { errors }`, `writeGcode(moves, cfg, info = {}) → string` (throws `PreflightError`). Output contains the lines `; BODY START` and `; BODY END` around the moves.

- [ ] **Step 1: Write the failing tests**

Create `tests/gcode.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeGcode, preflight, PreflightError } from '../src/engine/gcode.js';
import { plan } from '../src/engine/planner.js';
import { computeStatsStub } from './gcode-helpers.js';
import { defaultProfiles } from './helpers.js';
import { scene } from './scene.js';

function build(over = {}) {
  const s = scene({ sample_width: 20, sample_height: 20, ...over });
  const planned = plan(s.cfg, s.base, s.tiled.placements, s.boundary);
  return { ...s, moves: planned.moves, gcode: writeGcode(planned.moves, s.cfg, { stats: computeStatsStub() }) };
}

/** Minimal G-code reader: absolute XYZ, relative E, modal F. */
function readBody(gcode) {
  const lines = gcode.split('\n');
  const start = lines.indexOf('; BODY START');
  const end = lines.indexOf('; BODY END');
  assert.ok(start >= 0 && end > start, 'body markers missing');
  let x = NaN, y = NaN, z = NaN, f = NaN;
  const out = [];
  for (const raw of lines.slice(start + 1, end)) {
    const line = raw.split(';')[0].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts[0] !== 'G1') { out.push({ cmd: parts[0], raw: line }); continue; }
    const g = {};
    for (const p of parts.slice(1)) g[p[0]] = Number(p.slice(1));
    const prev = { x, y, z };
    if (g.X !== undefined) x = g.X;
    if (g.Y !== undefined) y = g.Y;
    if (g.Z !== undefined) z = g.Z;
    if (g.F !== undefined) f = g.F;
    out.push({ cmd: 'G1', x, y, z, prev, e: g.E, f, moved: g.X !== undefined || g.Y !== undefined || g.Z !== undefined });
  }
  return out;
}

test('header limits, M221 S100 before any extrusion, S/T acceleration for the MK3S', () => {
  const { gcode } = build();
  assert.match(gcode, /^M201 X1000 Y1000 Z200 E5000/m);
  assert.match(gcode, /^M203 X200 Y200 Z12 E120/m);
  assert.match(gcode, /^M204 S1250 T1250/m);
  assert.match(gcode, /^M205 X8 Y8 Z0\.4 E4\.5/m);
  assert.match(gcode, /^M204 S800/m);
  assert.doesNotMatch(gcode, /M204 P/);
  assert.doesNotMatch(gcode, /M221 S95/);
  const lines = gcode.split('\n');
  const flow = lines.findIndex((l) => l.startsWith('M221 S100'));
  const firstE = lines.findIndex((l) => /^G1 .*E[0-9.]+/.test(l));
  assert.ok(flow >= 0 && firstE > flow);
  assert.match(gcode, /^M83 /m);
  assert.match(gcode, /^M862\.3 P "MK3S"/m);
});

test('every parameter and the seed are recorded as comments', () => {
  const { gcode } = build({ random_seed: 9 });
  assert.match(gcode, /^; param random_seed = 9$/m);
  assert.match(gcode, /^; param loop_width = 6$/m);
  assert.match(gcode, /^; machine: prusa-mk3s$/m);
  assert.match(gcode, /^; material: filaflex-95-foamy \(unverified profile\)$/m);
});

test('output is deterministic', () => {
  assert.equal(build().gcode, build().gcode);
});

test('round trip: bounds, feedrates, Z-component limit and total E', () => {
  const { gcode, cfg, moves } = build();
  const body = readBody(gcode);
  const o = cfg.derived.origin;
  let totalE = 0;
  let maxF = 0;
  for (const g of body) {
    if (g.cmd !== 'G1' || !g.moved) continue;
    assert.ok(g.x >= o.x - 1e-3 && g.x <= o.x + 20 + 1e-3, `x ${g.x}`);
    assert.ok(g.y >= o.y - 1e-3 && g.y <= o.y + 20 + 1e-3, `y ${g.y}`);
    assert.ok(g.z <= 210);
    maxF = Math.max(maxF, g.f);
    const ds = Math.hypot(g.x - g.prev.x, g.y - g.prev.y, g.z - g.prev.z);
    if (ds > 1e-6) assert.ok(((g.f / 60) * Math.abs(g.z - g.prev.z)) / ds <= 12 + 0.1, `vz at z=${g.z}`);
    if (g.e !== undefined) totalE += g.e;
  }
  assert.ok(maxF <= 200 * 60);
  assert.ok(totalE > 0);
  assert.ok(moves.length > 0);
});

test('retract and unretract are emitted as relative E moves with the material speeds', () => {
  const { gcode } = build({ retraction_length: 2.5 });
  const lines = gcode.split('\n');
  assert.ok(lines.some((l) => /^G1 E-2\.5 F4500$/.test(l)));
  assert.ok(lines.some((l) => /^G1 E2\.5 F1500$/.test(l)));
});

test('fans: M106 only when a class asks for one, M107 otherwise', () => {
  const off = build().gcode.split('\n').filter((l) => l.startsWith('M106'));
  assert.equal(off.length, 0);
  const on = build({ fan_unsupported: 50 }).gcode.split('\n');
  assert.ok(on.some((l) => /^M106 S128/.test(l)));
  assert.ok(on.some((l) => l.startsWith('M107')));
});

test('Review Focus: a sample larger than the bed is refused with a clear message', () => {
  const s = scene({ sample_width: 300, sample_height: 20, include_loops: false });
  const planned = plan(s.cfg, s.base, [], s.boundary);
  assert.throws(() => writeGcode(planned.moves, s.cfg), (e) => {
    assert.ok(e instanceof PreflightError);
    assert.match(e.message, /does not fit the bed/);
    return true;
  });
});

test('Review Focus: an extreme lift is clamped on Z speed and stays inside max_z', () => {
  const { gcode, cfg } = build({ loop_z_lift: 30 });
  const body = readBody(gcode);
  let maxZ = 0;
  for (const g of body) {
    if (g.cmd !== 'G1' || !g.moved) continue;
    maxZ = Math.max(maxZ, g.z);
    const ds = Math.hypot(g.x - g.prev.x, g.y - g.prev.y, g.z - g.prev.z);
    if (ds > 1e-6) assert.ok(((g.f / 60) * Math.abs(g.z - g.prev.z)) / ds <= 12 + 0.1);
  }
  assert.ok(maxZ > 30 && maxZ <= cfg.machine.bed.max_z);
});

test('preflight catches out-of-range Z and bad temperatures', () => {
  const s = scene({ sample_width: 20, sample_height: 20 });
  const errors = preflight([{ x: 1, y: 1, z: 500, cls: 'base', extrude: true }], s.cfg);
  assert.ok(errors.some((e) => /printable volume/.test(e)));
});

test('Bambu-style P R T acceleration is emitted when the machine asks for it', () => {
  const s = scene({ sample_width: 20, sample_height: 20 }, {
    machine: { ...defaultProfiles().machine, accel_syntax: 'P_R_T' },
  });
  const planned = plan(s.cfg, s.base, s.tiled.placements, s.boundary);
  const gcode = writeGcode(planned.moves, s.cfg);
  assert.match(gcode, /^M204 P1250 R1250 T1500/m);
  assert.match(gcode, /^M204 P800/m);
});
```

Create `tests/gcode-helpers.js`:

```js
/** A fixed stats object so writer tests do not depend on stats.js (added in a later task). */
export function computeStatsStub() {
  return { timeSec: 100, filamentMm: 10, loops: 1, maxSlopeDeg: 17 };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/gcode.test.js`
Expected: FAIL with `Cannot find module '../src/engine/gcode.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/gcode.js`:

```js
import { moveSpeed, segmentE } from './extrusion.js';
import { PRIME, startPosition } from './params.js';

export class PreflightError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'PreflightError';
    this.errors = errors;
  }
}

const MESH_MARGIN = 3;
const fmt = (n, dp) => String(Number(n.toFixed(dp)));
const roundTo = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;

export function preflight(moves, cfg) {
  const errors = [];
  const { bed } = cfg.machine;
  const { t, derived } = cfg;
  const o = derived.origin;
  if (o.x < 0 || o.y < 0) {
    errors.push(`Sample (${t.sample_width} x ${t.sample_height} mm) does not fit the bed (${bed.width} x ${bed.depth} mm)`);
  }
  const { first, print, bed: bedTemp } = derived.temperatures;
  if (!(first > 0 && first <= 300)) errors.push(`first layer temperature ${first} C is outside 1-300`);
  if (!(print > 0 && print <= 300)) errors.push(`print temperature ${print} C is outside 1-300`);
  if (!(bedTemp >= 0 && bedTemp <= 120)) errors.push(`bed temperature ${bedTemp} C is outside 0-120`);
  let outside = 0;
  let example = null;
  for (const m of moves) {
    const x = m.x + o.x, y = m.y + o.y;
    const bad = x < -1e-6 || x > bed.width + 1e-6 || y < -1e-6 || y > bed.depth + 1e-6 || m.z < -1e-6 || m.z > bed.max_z + 1e-6;
    if (bad) {
      outside++;
      example ??= { x, y, z: m.z };
    }
  }
  if (outside > 0) {
    errors.push(`${outside} move(s) leave the printable volume (first at X${fmt(example.x, 2)} Y${fmt(example.y, 2)} Z${fmt(example.z, 2)})`);
  }
  return errors;
}

function limitsBlock(cfg) {
  const { machine, t, derived } = cfg;
  if (!machine.limits.emit_to_gcode) return ['; machine limits not emitted (emit_to_gcode is false)'];
  const L = derived.limits;
  const prt = machine.accel_syntax === 'P_R_T';
  return [
    `M201 X${L.max_accel.x} Y${L.max_accel.y} Z${L.max_accel.z} E${L.max_accel.e} ; max accelerations, mm/s^2`,
    `M203 X${L.max_feedrate.x} Y${L.max_feedrate.y} Z${L.max_feedrate.z} E${L.max_feedrate.e} ; max feedrates, mm/s`,
    prt
      ? `M204 P${L.accel_extruding} R${L.accel_retracting} T${L.accel_travel} ; accelerations, mm/s^2`
      : `M204 S${L.accel_extruding} T${L.accel_retracting} ; accelerations, mm/s^2`,
    `M205 X${L.jerk.x} Y${L.jerk.y} Z${L.jerk.z} E${L.jerk.e} ; jerk, mm/s`,
    'M205 S0 T0 ; minimum extruding and travel feed rates',
    prt ? `M204 P${t.print_acceleration} ; print acceleration` : `M204 S${t.print_acceleration} ; print acceleration`,
  ];
}

function primeBlock(cfg) {
  const length = PRIME.x1 - PRIME.x0;
  const e = segmentE(length, 'base', cfg);
  const f = Math.round(moveSpeed('base', length, 0, 0, cfg) * 60);
  return [
    `G1 Z${fmt(cfg.t.layer_height, 3)} F720`,
    `G1 X${PRIME.x0} Y${PRIME.y} F3000 ; go outside print area`,
    'G92 E0',
    `G1 X${PRIME.x1} Y${PRIME.y} E${fmt(e, 5)} F${f} ; prime line`,
    'G92 E0',
    `G1 Z${PRIME.liftZ} F720 ; lift after priming`,
  ];
}

function fillTemplate(lines, vars) {
  return lines.flatMap((line) =>
    line
      .replace(/\{(\w+)\}/g, (match, name) => {
        if (!(name in vars)) throw new Error(`Unknown placeholder {${name}} in machine G-code template`);
        const v = vars[name];
        return Array.isArray(v) ? v.join('\n') : String(v);
      })
      .split('\n')
  );
}

function fanFor(cls, t) {
  return t[`fan_${cls === 'rising' || cls === 'falling' ? 'nonplanar' : cls}`];
}

export function writeGcode(moves, cfg, info = {}) {
  const errors = preflight(moves, cfg);
  if (errors.length > 0) throw new PreflightError(errors);

  const { machine, material, t, derived } = cfg;
  const o = derived.origin;
  const r = derived.retraction;
  const out = [];

  out.push('; Textile G-code generator v1');
  out.push(`; machine: ${machine.id}${machine.verified ? '' : ' (unverified profile)'}`);
  out.push(`; material: ${material.id}${material.verified ? '' : ' (unverified profile)'}`);
  if (info.stats) {
    out.push(`; estimated time (no acceleration): ${fmt(info.stats.timeSec / 60, 1)} min`);
    out.push(`; filament: ${fmt(info.stats.filamentMm, 1)} mm, loops: ${info.stats.loops}`);
  }
  for (const key of Object.keys(t).sort()) out.push(`; param ${key} = ${JSON.stringify(t[key])}`);

  let maxZ = 0;
  for (const m of moves) if (m.z > maxZ) maxZ = m.z;
  const vars = {
    printer_model_check: machine.printer_model_check,
    nozzle_diameter: fmt(t.nozzle_diameter, 2),
    first_layer_temp: derived.temperatures.first,
    bed_temp: derived.temperatures.bed,
    print_min_x: fmt(Math.max(0, o.x - MESH_MARGIN), 1),
    print_min_y: fmt(Math.max(0, o.y - MESH_MARGIN), 1),
    print_width: fmt(Math.min(machine.bed.width, t.sample_width + 2 * MESH_MARGIN), 1),
    print_height: fmt(Math.min(machine.bed.depth, t.sample_height + 2 * MESH_MARGIN), 1),
    machine_limits: limitsBlock(cfg),
    prime_line: primeBlock(cfg),
    raise_z: fmt(Math.min(maxZ + 1, machine.bed.max_z), 2),
    park_z: fmt(Math.min(maxZ + 49, machine.bed.max_z), 2),
  };

  out.push(...fillTemplate(machine.start_gcode, vars));
  out.push('; BODY START');

  let pos = startPosition(cfg);
  let outX = null, outY = null, outZ = null, outF = null;
  let emittedE = 0, cumE = 0;
  let fan = 0;

  for (const m of moves) {
    if (m.retract === 'retract') {
      const f = Math.round(r.speed * 60);
      out.push(`G1 E-${fmt(r.length, 5)} F${f}`);
      outF = f;
    } else if (m.retract === 'unretract') {
      const f = Math.round(r.deretractSpeed * 60);
      out.push(`G1 E${fmt(r.length, 5)} F${f}`);
      outF = f;
    }

    const want = fanFor(m.cls, t);
    if (want !== fan) {
      out.push(want === 0 ? 'M107 ; fan off' : `M106 S${Math.round(want * 2.55)} ; fan ${want}%`);
      fan = want;
    }

    const dx = m.x - pos.x, dy = m.y - pos.y, dz = m.z - pos.z;
    const ds = Math.hypot(dx, dy, dz);
    pos = { x: m.x, y: m.y, z: m.z };
    if (ds < 1e-9) continue;

    const parts = ['G1'];
    const X = fmt(m.x + o.x, 3), Y = fmt(m.y + o.y, 3), Z = fmt(m.z, 3);
    if (X !== outX) { parts.push(`X${X}`); outX = X; }
    if (Y !== outY) { parts.push(`Y${Y}`); outY = Y; }
    if (Z !== outZ) { parts.push(`Z${Z}`); outZ = Z; }
    if (m.extrude) {
      cumE += segmentE(ds, m.cls, cfg);
      const target = roundTo(cumE, 5);
      parts.push(`E${fmt(target - emittedE, 5)}`);
      emittedE = target;
    }
    const F = Math.round(moveSpeed(m.cls, dx, dy, dz, cfg) * 60);
    if (F !== outF) { parts.push(`F${F}`); outF = F; }
    if (parts.length > 1) out.push(parts.join(' '));
  }

  out.push('; BODY END');
  out.push(...fillTemplate(machine.end_gcode, vars));
  return out.join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/gcode.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/gcode.js tests/gcode.test.js tests/gcode-helpers.js
git commit -m "feat: add G-code writer with preflight validation" -- src/engine/gcode.js tests/gcode.test.js tests/gcode-helpers.js
```

---

### Task 10: Stats, pipeline and golden file

**Files:**
- Create: `src/engine/stats.js`, `src/engine/generate.js`, `tests/generate.test.js`, `tests/golden.test.js`, `tools/update-golden.mjs`, `tests/golden/sample20.json`
- Modify: `tests/scene.js` (append `goldenSummary`), `tests/gcode.test.js` (use real stats), delete `tests/gcode-helpers.js`

**Interfaces:**
- Produces: `computeStats(moves, cfg, placements) → { timeSec, filamentMm, filamentGrams, loops, maxSlopeDeg, violations, lengthByClass, moves }`
- Produces: `generate(machine, material, textile = {}) → { cfg, base, placements, moves, stats, warnings, counts, gcode }` — throws `ConfigError` (parameters) or `PreflightError` (printability).
- Produces (tests): `goldenSummary(result) → { loops, moves, violations, filamentMm, timeSec, sha256 }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/generate.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/engine/generate.js';
import { ConfigError } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();

test('20 x 20 default sample: 10 loops, stats are populated', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.equal(r.stats.loops, 10);
  assert.ok(r.stats.filamentMm > 0);
  assert.ok(r.stats.timeSec > 0);
  assert.ok(r.stats.filamentGrams > 0);
  assert.ok(r.stats.maxSlopeDeg > 15 && r.stats.maxSlopeDeg < 18, `${r.stats.maxSlopeDeg}`);
  assert.ok(r.stats.lengthByClass.unsupported > 0);
  assert.match(r.gcode, /; BODY START/);
  assert.equal(r.stats.moves, r.moves.length);
});

test('stats header lines agree with the stats object', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.match(r.gcode, new RegExp(`loops: ${r.stats.loops}\\b`));
  assert.match(r.gcode, /^; estimated time \(no acceleration\): [0-9.]+ min$/m);
});

test('base only has zero loops', () => {
  const r = generate(machine, material, { sample_width: 20, sample_height: 20, include_loops: false });
  assert.equal(r.stats.loops, 0);
  assert.equal(r.stats.maxSlopeDeg, 0);
});

test('Review Focus: a 5 x 5 sample prints the base only, with a warning', () => {
  const r = generate(machine, material, { sample_width: 5, sample_height: 5 });
  assert.equal(r.stats.loops, 0);
  assert.ok(r.warnings.some((w) => /no loops fit/i.test(w)));
  assert.ok(r.moves.length > 0);
});

test('nothing selected still returns a valid (empty) result with a warning', () => {
  const r = generate(machine, material, { include_base: false, include_loops: false });
  assert.equal(r.moves.length, 0);
  assert.ok(r.warnings.some((w) => /nothing to print/i.test(w)));
});

test('Review Focus: invalid parameters surface as ConfigError, not a crash', () => {
  assert.throws(() => generate(machine, material, { base_spacing: NaN }), ConfigError);
});

test('same inputs give byte-identical G-code; a changed seed with randomness on changes it', () => {
  const a = generate(machine, material, { sample_width: 20, sample_height: 20 });
  const b = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.equal(a.gcode, b.gcode);
  const over = { sample_width: 20, sample_height: 20, random_enabled: true, amp_xy: 0.4, amp_length: 1 };
  const c = generate(machine, material, { ...over, random_seed: 1 });
  const d = generate(machine, material, { ...over, random_seed: 2 });
  assert.notEqual(c.gcode, d.gcode);
});
```

Create `tests/golden.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generate } from '../src/engine/generate.js';
import { defaultProfiles, projectRoot } from './helpers.js';
import { goldenSummary } from './scene.js';

test('20 x 20 golden summary matches (run `npm run golden` after an intended change)', () => {
  const file = path.join(projectRoot, 'tests', 'golden', 'sample20.json');
  assert.ok(fs.existsSync(file), 'golden file missing: run `npm run golden`');
  const golden = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { machine, material } = defaultProfiles();
  const r = generate(machine, material, { sample_width: 20, sample_height: 20 });
  assert.deepEqual(goldenSummary(r), golden);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/generate.test.js tests/golden.test.js`
Expected: FAIL with `Cannot find module '../src/engine/generate.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/stats.js`:

```js
import { moveSpeed, segmentE, filamentArea } from './extrusion.js';
import { startPosition } from './params.js';

/** Summary numbers for the UI and the G-code header. Time ignores acceleration. */
export function computeStats(moves, cfg, placements) {
  let pos = startPosition(cfg);
  let timeSec = 0;
  let filamentMm = 0;
  const lengthByClass = { base: 0, supported: 0, rising: 0, falling: 0, unsupported: 0, travel: 0 };
  const r = cfg.derived.retraction;
  let violations = 0;

  for (const m of moves) {
    const dx = m.x - pos.x, dy = m.y - pos.y, dz = m.z - pos.z;
    const ds = Math.hypot(dx, dy, dz);
    pos = { x: m.x, y: m.y, z: m.z };
    if (m.retract === 'retract') timeSec += r.length / r.speed;
    if (m.retract === 'unretract') timeSec += r.length / r.deretractSpeed;
    if (m.violation) violations++;
    if (ds < 1e-9) continue;
    timeSec += ds / moveSpeed(m.cls, dx, dy, dz, cfg);
    lengthByClass[m.cls] += ds;
    if (m.extrude) filamentMm += segmentE(ds, m.cls, cfg);
  }

  let maxSlope = 0;
  for (const p of placements) {
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1], b = p.points[i];
      const dxy = Math.hypot(b.x - a.x, b.y - a.y);
      if (dxy > 1e-9) maxSlope = Math.max(maxSlope, Math.abs(b.z - a.z) / dxy);
    }
  }

  const volumeMm3 = filamentMm * filamentArea(cfg.derived.filamentDiameter);
  return {
    timeSec,
    filamentMm,
    filamentGrams: (volumeMm3 / 1000) * cfg.material.density,
    loops: placements.length,
    maxSlopeDeg: (Math.atan(maxSlope) * 180) / Math.PI,
    violations,
    lengthByClass,
    moves: moves.length,
  };
}
```

Create `src/engine/generate.js`:

```js
import { resolveConfig } from './params.js';
import { RectBoundary } from './boundary.js';
import { buildBase } from './base.js';
import { tile } from './tiler.js';
import { createRng } from './rng.js';
import { plan } from './planner.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';

/**
 * The whole pipeline: profiles + textile parameters -> tagged moves -> stats -> G-code.
 * Throws ConfigError (bad parameters) or PreflightError (cannot be printed on this machine).
 */
export function generate(machine, material, textile = {}) {
  const cfg = resolveConfig(machine, material, textile);
  const t = cfg.t;
  const boundary = new RectBoundary(t.sample_width, t.sample_height);

  const base = t.include_base
    ? buildBase({
        bbox: boundary.bbox(),
        spacing: t.base_spacing,
        cornerRadius: t.corner_radius,
        z: t.layer_height,
        resolution: t.curve_resolution,
      })
    : null;

  const tiled = t.include_loops
    ? tile(cfg, boundary, createRng(t.random_seed))
    : { placements: [], warnings: [], counts: { candidates: 0, kept: 0, dropped: 0, unresolvedLegs: 0 } };

  const planned = plan(cfg, base, tiled.placements, boundary);
  const stats = computeStats(planned.moves, cfg, tiled.placements);
  const warnings = [...tiled.warnings, ...planned.warnings];
  if (planned.moves.length === 0) warnings.push('Nothing to print: enable the base or the loops');
  const gcode = writeGcode(planned.moves, cfg, { stats });

  return { cfg, base, placements: tiled.placements, moves: planned.moves, stats, warnings, counts: tiled.counts, gcode };
}
```

Modify `tests/scene.js` — append:

```js
import crypto from 'node:crypto';

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Compact, stable summary used by the golden test. */
export function goldenSummary(result) {
  return {
    loops: result.stats.loops,
    moves: result.moves.length,
    violations: result.stats.violations,
    filamentMm: round(result.stats.filamentMm, 3),
    timeSec: round(result.stats.timeSec, 1),
    sha256: crypto.createHash('sha256').update(result.gcode).digest('hex'),
  };
}
```

(The `import crypto` line goes at the top of `tests/scene.js` with the other imports.)

Create `tools/update-golden.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { generate } from '../src/engine/generate.js';
import { defaultProfiles, projectRoot } from '../tests/helpers.js';
import { goldenSummary } from '../tests/scene.js';

const { machine, material } = defaultProfiles();
const result = generate(machine, material, { sample_width: 20, sample_height: 20 });
const dir = path.join(projectRoot, 'tests', 'golden');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'sample20.json');
fs.writeFileSync(file, JSON.stringify(goldenSummary(result), null, 2) + '\n');
console.log('wrote', file);
```

Modify `tests/gcode.test.js`: remove the `computeStatsStub` import and use the real stats instead.

```js
// replace:  import { computeStatsStub } from './gcode-helpers.js';
import { computeStats } from '../src/engine/stats.js';
```

and in `build()` replace the `writeGcode` line with:

```js
  const stats = computeStats(planned.moves, s.cfg, s.tiled.placements);
  return { ...s, moves: planned.moves, gcode: writeGcode(planned.moves, s.cfg, { stats }) };
```

Then delete `tests/gcode-helpers.js`.

- [ ] **Step 4: Run tests, record the golden file, run everything**

Run: `node --test tests/generate.test.js` — Expected: PASS (7 tests).
Run: `node tools/update-golden.mjs` — Expected: `wrote …/tests/golden/sample20.json`.
Run: `npm test` — Expected: every test file passes, 0 failures.

Open `tests/golden/sample20.json` and sanity-check: `loops` is 10, `violations` is a small number (record whatever it is; it documents the clearance model's verdict on the default tile), `timeSec` is a few minutes.

- [ ] **Step 5: Commit**

```bash
git add src/engine/stats.js src/engine/generate.js tests/generate.test.js tests/golden.test.js tests/scene.js tests/gcode.test.js tools/update-golden.mjs tests/golden/sample20.json
git rm -q tests/gcode-helpers.js
git commit -m "feat: add stats, generation pipeline and golden test" -- src/engine/stats.js src/engine/generate.js tests/generate.test.js tests/golden.test.js tests/scene.js tests/gcode.test.js tools/update-golden.mjs tests/golden/sample20.json tests/gcode-helpers.js
```

---

### Task 11: UI shell (form, generation, stats, download, save/load)

**Files:**
- Modify: `index.html` (replace the placeholder)
- Create: `src/ui/styles.css`, `src/ui/param-schema.js`, `src/ui/main.js`
- Create (stub so the page loads before Task 12): `src/ui/preview.js`

**Interfaces:**
- Consumes: `generate`, `DEFAULT_TEXTILE`, `profiles/index.json` and the profile files via `fetch`.
- Produces: `PARAM_GROUPS` (array of `{ id, title, open?, fields: [{ key, label, type: 'number'|'checkbox'|'select', unit?, step?, min?, nullable?, options? }] }`); `createPreview(container) → { update(result), setScrub(k), setShowTravel(bool), setZScale(n) }` (stub here, real in Task 12).

- [ ] **Step 1: Write the page, styles and parameter schema**

Replace `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Textile G-code Generator</title>
<link rel="stylesheet" href="src/ui/styles.css">
<script type="importmap">
{ "imports": { "three": "./vendor/three/three.module.js", "three/addons/": "./vendor/three/addons/" } }
</script>
</head>
<body>
<header>
  <h1>Textile G-code Generator</h1>
  <div class="actions">
    <button id="btn-download" disabled>Download .gcode</button>
    <button id="btn-save" type="button">Save parameters</button>
    <label class="file-button">Load parameters<input type="file" id="file-load" accept=".json,application/json"></label>
  </div>
</header>
<main>
  <aside id="controls">
    <section class="profiles">
      <label class="field"><span>Machine</span><select id="machine"></select></label>
      <label class="field"><span>Material</span><select id="material"></select></label>
    </section>
    <div id="param-groups"></div>
  </aside>
  <section id="viewport">
    <div id="preview" aria-label="3D toolpath preview"></div>
    <div class="toolbar">
      <label><input type="checkbox" id="show-travel" checked> Show travel</label>
      <label>Z scale <input type="range" id="z-scale" min="1" max="6" step="0.5" value="1"></label>
      <label class="grow">Print order <input type="range" id="scrub" min="0" max="1" value="1"></label>
    </div>
    <div id="errors" class="errors" role="alert" hidden></div>
    <dl id="stats" class="stats"></dl>
    <ul id="warnings" class="warnings"></ul>
    <p class="legend">
      <span class="sw base"></span>base <span class="sw supported"></span>supported
      <span class="sw rising"></span>rising <span class="sw falling"></span>falling
      <span class="sw unsupported"></span>unsupported <span class="sw travel"></span>travel
      <span class="sw violation"></span>clearance violation
    </p>
  </section>
</main>
<script type="module" src="src/ui/main.js"></script>
</body>
</html>
```

Create `src/ui/styles.css`:

```css
:root {
  --bg: #f4f5f8; --panel: #ffffff; --text: #1b2130; --muted: #5b6577; --line: #d8dce6;
  --accent: #3b6df0; --danger: #c62828; --warn: #9a5b00;
  --c-base: #4f7cff; --c-supported: #22b573; --c-rising: #f5a623; --c-falling: #e8743b;
  --c-unsupported: #d6336c; --c-travel: #8a909a; --c-violation: #ff0000;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f131a; --panel: #171c26; --text: #e6e9ef; --muted: #9aa4b5; --line: #2a3242;
    --accent: #7ba3ff; --danger: #ff7a7a; --warn: #ffb454;
  }
}
:root[data-theme="dark"] {
  --bg: #0f131a; --panel: #171c26; --text: #e6e9ef; --muted: #9aa4b5; --line: #2a3242;
  --accent: #7ba3ff; --danger: #ff7a7a; --warn: #ffb454;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, "Segoe UI", sans-serif; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
h1 { font-size: 16px; margin: 0; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
button, .file-button { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--line);
  background: var(--panel); color: var(--text); cursor: pointer; }
button:not(:disabled):hover, .file-button:hover { border-color: var(--accent); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
#btn-download:not(:disabled) { background: var(--accent); border-color: var(--accent); color: #fff; }
.file-button input { display: none; }
main { display: grid; grid-template-columns: 340px 1fr; height: calc(100% - 53px); }
#controls { overflow-y: auto; padding: 12px; border-right: 1px solid var(--line); background: var(--panel); }
#viewport { display: flex; flex-direction: column; min-width: 0; padding: 12px 16px; gap: 8px; overflow-y: auto; }
#preview { flex: 1 1 360px; min-height: 320px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); overflow: hidden; }
.toolbar { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
.toolbar .grow { flex: 1 1 200px; display: flex; align-items: center; gap: 8px; }
.toolbar .grow input { flex: 1; }
details { border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px; padding: 0 10px; }
summary { cursor: pointer; padding: 8px 0; font-weight: 600; }
.field { display: grid; grid-template-columns: 1fr 110px; align-items: center; gap: 8px; margin: 6px 0; }
.field span { color: var(--muted); }
.field input[type="number"], .field select { width: 100%; font: inherit; padding: 4px 6px; border: 1px solid var(--line);
  border-radius: 6px; background: var(--bg); color: var(--text); }
.field input[type="checkbox"] { justify-self: start; }
.profiles { margin-bottom: 8px; }
.errors { white-space: pre-wrap; padding: 8px 10px; border: 1px solid var(--danger); border-radius: 6px; color: var(--danger); }
.stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 16px; margin: 0; }
.stats div { display: flex; justify-content: space-between; border-bottom: 1px dotted var(--line); }
.stats dt { color: var(--muted); }
.stats dd { margin: 0; font-variant-numeric: tabular-nums; }
.warnings { margin: 0; padding-left: 18px; color: var(--warn); }
.legend { margin: 0; color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
.sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 4px; vertical-align: -2px; }
.sw.base { background: var(--c-base); } .sw.supported { background: var(--c-supported); }
.sw.rising { background: var(--c-rising); } .sw.falling { background: var(--c-falling); }
.sw.unsupported { background: var(--c-unsupported); } .sw.travel { background: var(--c-travel); }
.sw.violation { background: var(--c-violation); border-radius: 50%; }
@media (max-width: 820px) {
  main { grid-template-columns: 1fr; height: auto; }
  #controls { border-right: 0; border-bottom: 1px solid var(--line); }
  #preview { min-height: 55vh; }
}
```

Create `src/ui/param-schema.js`:

```js
const num = (key, label, unit, step, min, extra = {}) => ({ key, label, type: 'number', unit, step, min, ...extra });
const bool = (key, label) => ({ key, label, type: 'checkbox' });
const sel = (key, label, options) => ({ key, label, type: 'select', options });

export const PARAM_GROUPS = [
  { id: 'sample', title: 'Sample', open: true, fields: [
    num('sample_width', 'Width', 'mm', 1, 1),
    num('sample_height', 'Height', 'mm', 1, 1),
    bool('include_base', 'Print base'),
    bool('include_loops', 'Print loops'),
  ] },
  { id: 'base', title: 'Base', fields: [
    num('base_spacing', 'Line spacing', 'mm', 0.5, 0.5),
    num('corner_radius', 'Corner radius', 'mm', 0.1, 0),
  ] },
  { id: 'strand', title: 'Strand', fields: [
    num('layer_height', 'Layer height', 'mm', 0.05, 0.05),
    num('extrusion_width', 'Extrusion width', 'mm', 0.05, 0.1),
    num('nozzle_diameter', 'Nozzle diameter', 'mm', 0.05, 0.1),
    num('free_strand_diameter', 'In-air strand diameter (blank = nozzle)', 'mm', 0.05, 0.1, { nullable: true }),
  ] },
  { id: 'loops', title: 'Loops', open: true, fields: [
    sel('fiber_shape', 'Shape', ['hairpin', 'arch']),
    sel('z_profile', 'Z profile', ['sin2', 'bell', 'smoothstep']),
    num('loop_width', 'Width', 'mm', 0.5, 0.5),
    num('loop_length', 'Length', 'mm', 0.5, 0.5),
    num('loop_pitch', 'Pitch', 'mm', 0.5, 0.1),
    num('loop_z_lift', 'Z lift', 'mm', 0.5, 0),
    num('anchor_dwell', 'Anchor dwell', 'mm', 0.5, 0),
    num('leg_gap', 'Leg gap', 'mm', 0.1, 0),
  ] },
  { id: 'pattern', title: 'Pattern', fields: [
    num('row_pitch_multiple', 'Row pitch (x base spacing)', '', 1, 1),
    num('row_stagger', 'Row stagger', 'x pitch', 0.1, 0),
    sel('boundary_policy', 'Boundary policy', ['footprint', 'feet-only']),
    num('curve_resolution', 'Curve resolution', 'mm', 0.05, 0.05),
  ] },
  { id: 'speeds', title: 'Speeds and fans', fields: [
    num('speed_base', 'Base', 'mm/s', 1, 1),
    num('speed_supported', 'Supported loop', 'mm/s', 1, 1),
    num('speed_nonplanar', 'Rising / falling', 'mm/s', 1, 1),
    num('speed_unsupported', 'Unsupported', 'mm/s', 1, 1),
    num('speed_travel', 'Travel', 'mm/s', 5, 1),
    num('fan_base', 'Fan: base', '%', 5, 0),
    num('fan_supported', 'Fan: supported', '%', 5, 0),
    num('fan_nonplanar', 'Fan: rising / falling', '%', 5, 0),
    num('fan_unsupported', 'Fan: unsupported', '%', 5, 0),
    num('fan_travel', 'Fan: travel', '%', 5, 0),
    num('print_acceleration', 'Print acceleration', 'mm/s²', 100, 100),
  ] },
  { id: 'classes', title: 'Move classes', fields: [
    num('support_threshold', 'Supported up to', 'mm', 0.1, 0),
    num('unsupported_fraction', 'Unsupported from', 'x lift', 0.05, 0),
  ] },
  { id: 'clearance', title: 'Clearance model', fields: [
    num('nozzle_tip_radius', 'Nozzle tip radius', 'mm', 0.1, 0),
    num('nozzle_cone_half_angle', 'Nozzle cone half-angle', '°', 5, 1),
    num('clearance', 'Extra clearance', 'mm', 0.1, 0),
  ] },
  { id: 'retraction', title: 'Retraction (blank = material)', fields: [
    num('retraction_length', 'Length', 'mm', 0.5, 0, { nullable: true }),
    num('retraction_speed', 'Speed', 'mm/s', 5, 1, { nullable: true }),
  ] },
  { id: 'random', title: 'Randomness', fields: [
    bool('random_enabled', 'Enable randomness'),
    num('random_seed', 'Seed', '', 1, 0),
    num('amp_length', 'Length', 'mm', 0.1, 0),
    num('amp_width', 'Width', 'mm', 0.1, 0),
    num('amp_lift', 'Lift', 'mm', 0.1, 0),
    num('amp_xy', 'XY position', 'mm', 0.1, 0),
    num('amp_orientation', 'Orientation', '°', 1, 0),
    num('amp_spacing', 'Spacing', 'mm', 0.1, 0),
  ] },
  { id: 'machine', title: 'Machine mode', fields: [
    sel('limits_mode', 'Limits mode', ['normal', 'stealth']),
  ] },
];
```

- [ ] **Step 2: Write the preview stub and the main script**

Create `src/ui/preview.js` (stub, replaced in Task 12):

```js
export function createPreview(container) {
  container.textContent = '3D preview loads in the next step.';
  return {
    update() {},
    setScrub() {},
    setShowTravel() {},
    setZScale() {},
  };
}
```

Create `src/ui/main.js`:

```js
import { DEFAULT_TEXTILE } from '../engine/params.js';
import { generate } from '../engine/generate.js';
import { PARAM_GROUPS } from './param-schema.js';
import { createPreview } from './preview.js';

const $ = (selector) => document.querySelector(selector);
const state = {
  machines: new Map(),
  materials: new Map(),
  machineId: 'prusa-mk3s',
  materialId: 'filaflex-95-foamy',
  textile: { ...DEFAULT_TEXTILE },
  result: null,
};
let preview = null;
let timer = null;

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function loadProfiles() {
  const index = await fetchJson('profiles/index.json');
  for (const id of index.machines) state.machines.set(id, await fetchJson(`profiles/machines/${id}.json`));
  for (const id of index.materials) state.materials.set(id, await fetchJson(`profiles/materials/${id}.json`));
}

function fillSelect(element, map, selected) {
  element.replaceChildren(
    ...[...map.values()].map((p) => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name + (p.verified ? '' : ' (unverified)');
      option.selected = p.id === selected;
      return option;
    })
  );
}

function fieldRow(field) {
  const label = document.createElement('label');
  label.className = 'field';
  const text = document.createElement('span');
  text.textContent = field.unit ? `${field.label} (${field.unit})` : field.label;
  label.appendChild(text);
  let input;
  if (field.type === 'select') {
    input = document.createElement('select');
    for (const value of field.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      input.appendChild(option);
    }
    input.addEventListener('change', () => { state.textile[field.key] = input.value; schedule(); });
  } else if (field.type === 'checkbox') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => { state.textile[field.key] = input.checked; schedule(); });
  } else {
    input = document.createElement('input');
    input.type = 'number';
    input.step = String(field.step ?? 'any');
    if (field.min !== undefined) input.min = String(field.min);
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      state.textile[field.key] = raw === '' ? (field.nullable ? null : NaN) : Number(raw);
      schedule();
    });
  }
  input.dataset.key = field.key;
  label.appendChild(input);
  return label;
}

function buildForm() {
  const host = $('#param-groups');
  host.replaceChildren();
  for (const group of PARAM_GROUPS) {
    const details = document.createElement('details');
    details.open = !!group.open;
    const summary = document.createElement('summary');
    summary.textContent = group.title;
    details.appendChild(summary);
    for (const field of group.fields) details.appendChild(fieldRow(field));
    host.appendChild(details);
  }
  syncForm();
}

function syncForm() {
  for (const input of document.querySelectorAll('#param-groups [data-key]')) {
    const value = state.textile[input.dataset.key];
    if (input.type === 'checkbox') input.checked = !!value;
    else input.value = value === null || value === undefined || Number.isNaN(value) ? '' : String(value);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min ${s} s`;
}

function renderStats(result) {
  const s = result.stats;
  const rows = [
    ['Loops', s.loops],
    ['Moves', s.moves],
    ['Est. time*', formatTime(s.timeSec)],
    ['Filament', `${s.filamentMm.toFixed(0)} mm`],
    ['Mass', `${s.filamentGrams.toFixed(2)} g`],
    ['Max slope', `${s.maxSlopeDeg.toFixed(1)}°`],
    ['Violations', s.violations],
    ['Unsupported path', `${s.lengthByClass.unsupported.toFixed(0)} mm`],
  ];
  $('#stats').replaceChildren(
    ...rows.map(([name, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = name;
      const dd = document.createElement('dd');
      dd.textContent = String(value);
      row.append(dt, dd);
      return row;
    })
  );
}

function renderWarnings(result) {
  $('#warnings').replaceChildren(
    ...result.warnings.map((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      return li;
    })
  );
}

function regenerate() {
  const machine = state.machines.get(state.machineId);
  const material = state.materials.get(state.materialId);
  const errors = $('#errors');
  try {
    const result = generate(machine, material, state.textile);
    state.result = result;
    errors.hidden = true;
    errors.textContent = '';
    $('#btn-download').disabled = false;
    renderStats(result);
    renderWarnings(result);
    preview.update(result);
    const scrub = $('#scrub');
    scrub.max = String(result.moves.length);
    scrub.value = scrub.max;
    preview.setScrub(result.moves.length);
    store.set('textile-params', JSON.stringify({ machineId: state.machineId, materialId: state.materialId, textile: state.textile }));
  } catch (e) {
    errors.hidden = false;
    errors.textContent = Array.isArray(e.errors) ? e.errors.join('\n') : String(e.message || e);
    $('#btn-download').disabled = true;
    $('#warnings').replaceChildren();
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(regenerate, 200);
}

function download() {
  if (!state.result) return;
  const t = state.result.cfg.t;
  const name = `textile_${t.sample_width}x${t.sample_height}_${state.materialId}_seed${t.random_seed}.gcode`;
  const url = URL.createObjectURL(new Blob([state.result.gcode], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveParams() {
  const payload = { version: 1, machineId: state.machineId, materialId: state.materialId, textile: state.textile };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'textile-parameters.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadParams(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data.textile !== 'object') throw new Error('not a parameters file');
    const known = Object.keys(DEFAULT_TEXTILE);
    const next = { ...DEFAULT_TEXTILE };
    for (const key of known) if (key in data.textile) next[key] = data.textile[key];
    state.textile = next;
    if (state.machines.has(data.machineId)) state.machineId = data.machineId;
    if (state.materials.has(data.materialId)) state.materialId = data.materialId;
    fillSelect($('#machine'), state.machines, state.machineId);
    fillSelect($('#material'), state.materials, state.materialId);
    syncForm();
    regenerate();
  } catch (e) {
    const errors = $('#errors');
    errors.hidden = false;
    errors.textContent = `Could not load parameters: ${e.message}`;
  }
}

async function init() {
  preview = createPreview($('#preview'));
  await loadProfiles();
  try {
    const saved = JSON.parse(store.get('textile-params') ?? 'null');
    if (saved && typeof saved.textile === 'object') {
      for (const key of Object.keys(DEFAULT_TEXTILE)) if (key in saved.textile) state.textile[key] = saved.textile[key];
      if (state.machines.has(saved.machineId)) state.machineId = saved.machineId;
      if (state.materials.has(saved.materialId)) state.materialId = saved.materialId;
    }
  } catch { /* ignore a corrupt saved value */ }
  fillSelect($('#machine'), state.machines, state.machineId);
  fillSelect($('#material'), state.materials, state.materialId);
  $('#machine').addEventListener('change', (e) => { state.machineId = e.target.value; schedule(); });
  $('#material').addEventListener('change', (e) => { state.materialId = e.target.value; schedule(); });
  $('#btn-download').addEventListener('click', download);
  $('#btn-save').addEventListener('click', saveParams);
  $('#file-load').addEventListener('change', (e) => { if (e.target.files[0]) loadParams(e.target.files[0]); e.target.value = ''; });
  $('#show-travel').addEventListener('change', (e) => preview.setShowTravel(e.target.checked));
  $('#z-scale').addEventListener('input', (e) => preview.setZScale(Number(e.target.value)));
  $('#scrub').addEventListener('input', (e) => preview.setScrub(Number(e.target.value)));
  buildForm();
  regenerate();
}

init().catch((e) => {
  const errors = $('#errors');
  errors.hidden = false;
  errors.textContent = `Startup failed: ${e.message}`;
});
```

- [ ] **Step 3: Verify in the browser**

Run: `node tools/serve.mjs` (leave it running), then open `http://localhost:5173/`.

Expected, in order:
1. No errors in the browser console.
2. The left column shows grouped parameters; "Sample" and "Loops" are open; the machine dropdown shows "Original Prusa i3 MK3S / MK3S+", the material dropdown "Recreus Filaflex 95A Foamy (unverified)".
3. The stats show `Loops 567`, a time of a few tens of minutes, and Download is enabled (the preview area just says the preview loads next).
4. Set "Width" to 300: a red error "Sample (300 x 100 mm) does not fit the bed (250 x 210 mm)" appears, Download is disabled. Set it back to 100: the error clears.
5. Clear the "Line spacing" field: an error mentions `base_spacing`; the page does not crash. Type 5 again.
6. Click Download: a file `textile_100x100_filaflex-95-foamy_seed1.gcode` downloads and starts with `; Textile G-code generator v1`.
7. Save parameters, change Width to 50, then Load the saved file: Width returns to 100.

- [ ] **Step 4: Commit**

```bash
git add index.html src/ui/styles.css src/ui/param-schema.js src/ui/main.js src/ui/preview.js
git commit -m "feat: add UI shell with parameter form, stats and download" -- index.html src/ui/styles.css src/ui/param-schema.js src/ui/main.js src/ui/preview.js
```

---

### Task 12: three.js preview with scrub, travel toggle and violations

**Files:**
- Create: `tools/vendor-three.mjs`, `vendor/three/three.module.js`, `vendor/three/addons/controls/OrbitControls.js`, `vendor/three/LICENSE`
- Modify: `package.json` (devDependency added by `npm install`), `src/ui/preview.js` (replace the stub)

**Interfaces:**
- Produces: `createPreview(container) → { update(result), setScrub(moveIndex), setShowTravel(bool), setZScale(n) }`. `update` takes the `generate()` result (`moves`, `cfg`).

- [ ] **Step 1: Vendor three.js**

Create `tools/vendor-three.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'three');
const dst = path.join(root, 'vendor', 'three');
fs.mkdirSync(path.join(dst, 'addons', 'controls'), { recursive: true });
fs.copyFileSync(path.join(src, 'build', 'three.module.js'), path.join(dst, 'three.module.js'));
fs.copyFileSync(path.join(src, 'examples', 'jsm', 'controls', 'OrbitControls.js'), path.join(dst, 'addons', 'controls', 'OrbitControls.js'));
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(dst, 'LICENSE'));
const version = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')).version;
console.log(`vendored three ${version} into vendor/three`);
```

Run:

```bash
npm install --save-dev three@0.169.0
npm run vendor
```

Expected: `vendored three 0.169.0 into vendor/three`; the three files exist under `vendor/three/`.

- [ ] **Step 2: Replace the preview stub**

Replace `src/ui/preview.js`:

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CLASS_COLORS = {
  base: 0x4f7cff,
  supported: 0x22b573,
  rising: 0xf5a623,
  falling: 0xe8743b,
  unsupported: 0xd6336c,
  travel: 0x8a909a,
};

export function createPreview(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.replaceChildren(renderer.domElement);
  renderer.domElement.style.display = 'block';
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const world = new THREE.Group();
  scene.add(world);

  const state = {
    extrude: null, travel: null, violations: null, outlines: [],
    eCount: new Uint32Array(1), tCount: new Uint32Array(1),
    framedFor: '', showTravel: true,
  };

  function resize() {
    const w = Math.max(container.clientWidth, 50);
    const h = Math.max(container.clientHeight, 50);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function discard(object) {
    if (!object) return;
    world.remove(object);
    object.geometry?.dispose();
    object.material?.dispose();
  }

  function segments(positions, colors) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }));
  }

  function rectangle(x0, y0, x1, y1, color) {
    const pts = [x0, y0, 0, x1, y0, 0, x1, y0, 0, x1, y1, 0, x1, y1, 0, x0, y1, 0, x0, y1, 0, x0, y0, 0];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
  }

  function update(result) {
    const { moves, cfg } = result;
    discard(state.extrude);
    discard(state.travel);
    discard(state.violations);
    state.outlines.forEach(discard);
    state.outlines = [];

    const ePos = [], eCol = [], tPos = [], tCol = [], vPos = [];
    const eCount = new Uint32Array(moves.length + 1);
    const tCount = new Uint32Array(moves.length + 1);
    const color = new THREE.Color();
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (i > 0) {
        const p = moves[i - 1];
        const target = m.extrude ? [ePos, eCol] : [tPos, tCol];
        target[0].push(p.x, p.y, p.z, m.x, m.y, m.z);
        color.setHex(CLASS_COLORS[m.cls] ?? 0xffffff);
        target[1].push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
      if (m.violation) vPos.push(m.x, m.y, m.z);
      eCount[i + 1] = ePos.length / 6;
      tCount[i + 1] = tPos.length / 6;
    }
    state.eCount = eCount;
    state.tCount = tCount;

    state.extrude = segments(ePos, eCol);
    state.travel = segments(tPos, tCol);
    state.travel.visible = state.showTravel;
    world.add(state.extrude, state.travel);

    if (vPos.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
      state.violations = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xff0000, size: 1.4 }));
      world.add(state.violations);
    } else {
      state.violations = null;
    }

    const o = cfg.derived.origin;
    const bed = cfg.machine.bed;
    state.outlines.push(rectangle(-o.x, -o.y, bed.width - o.x, bed.depth - o.y, 0x6b7280));
    state.outlines.push(rectangle(0, 0, cfg.t.sample_width, cfg.t.sample_height, 0x3b6df0));
    world.add(...state.outlines);

    const key = `${cfg.t.sample_width}x${cfg.t.sample_height}`;
    if (state.framedFor !== key) {
      const w = cfg.t.sample_width, h = cfg.t.sample_height;
      const size = Math.max(w, h);
      controls.target.set(w / 2, h / 2, 0);
      camera.position.set(w / 2, h / 2 - size * 1.4, size * 1.1);
      controls.update();
      state.framedFor = key;
    }
  }

  function setScrub(index) {
    const k = Math.max(0, Math.min(index, state.eCount.length - 1));
    if (state.extrude) state.extrude.geometry.setDrawRange(0, state.eCount[k] * 2);
    if (state.travel) state.travel.geometry.setDrawRange(0, state.tCount[k] * 2);
  }

  function setShowTravel(show) {
    state.showTravel = show;
    if (state.travel) state.travel.visible = show;
  }

  function setZScale(scale) {
    world.scale.z = scale;
  }

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return { update, setScrub, setShowTravel, setZScale };
}
```

- [ ] **Step 3: Verify in the browser**

Run: `node tools/serve.mjs`, open `http://localhost:5173/`.

Expected:
1. No console errors (an import-map or 404 error for `vendor/three/...` means Step 1 was skipped).
2. A 3D view shows a blue serpentine base on a grey bed outline, with a blue sample outline, and dense raised loops in green (supported), orange (rising), red-orange (falling) and magenta (unsupported). Orbit with the mouse; the model stays centred on the sample.
3. Drag the "Print order" slider to the left: the drawing shrinks back through the print order (base first, then the far rows of loops). Back to the right: complete.
4. Untick "Show travel": the grey travel lines disappear. Z scale 4: loops look taller.
5. Set "Pitch" to 3 and "Leg gap" to 0: the stats `Violations` stays the same or changes, no crash. Set "Z lift" to 8: raised loops get taller and violation points (red dots) may appear; the max slope stat increases.
6. Narrow the browser window below 820 px: the layout stacks, no horizontal page scroll.

- [ ] **Step 4: Commit**

```bash
git add tools/vendor-three.mjs vendor/three package.json package-lock.json src/ui/preview.js
git commit -m "feat: add three.js toolpath preview" -- tools/vendor-three.mjs vendor/three package.json package-lock.json src/ui/preview.js
```

---

### Task 13: Documentation, final verification and handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md` (only if implementation findings differ from §12)

- [ ] **Step 1: Update README**

Replace the **Status** line with `**Status:** v1 implemented (MK3S); first physical print not yet done.` and add a "Run it" section after the intro:

```md
## Run it

Double-click `Run Textile Tool.bat` (needs Node 20+). It starts a local server and opens
http://localhost:5173/. Close the window to stop it. Or from a terminal:

    npm run serve        # server + browser
    npm test             # engine tests
    npm run golden       # re-record the 20 x 20 golden summary after an intended change

## First prints (see spec §9)

1. Width 30, height 30, untick "Print loops": base only. Check adhesion, flow and corners.
2. Width 30, height 15, both ticked: exactly one row of loops. Check that the feet bond and the unsupported
   strands hold their height.
3. Width 30, height 30, both ticked, starting speeds: check clearance warnings against real collisions.
4. Width 100, height 100: the full sample.

Filaflex Foamy 95 values are unverified until the first print; raise or lower flow, temperature and the
unsupported speed one change at a time.
```

(Use the real sentence for step 2 that matches what the UI offers: "30 x 30 mm, base + loops, watch the anchoring of the first rows".)

- [ ] **Step 2: Full verification**

Run each and read the output:

```bash
npm test
node tools/serve.mjs & SERVER_PID=$!; sleep 1; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/vendor/three/three.module.js; kill $SERVER_PID
git status --short
```

Expected: all tests pass; `200`; `git status` shows only intended files (no stray scratch files; the user's sample `.gcode` and `.3mf` stay untracked and unmodified).

Generate the default 100 × 100 file once from Node and compare against the user's real file for structure:

```bash
node -e "import('./src/engine/generate.js').then(async (g)=>{const fs=await import('node:fs');const m=JSON.parse(fs.readFileSync('profiles/machines/prusa-mk3s.json'));const t=JSON.parse(fs.readFileSync('profiles/materials/filaflex-95-foamy.json'));const r=g.generate(m,t,{});fs.writeFileSync('textile_100x100_default.gcode',r.gcode);console.log(r.stats.loops,'loops',(r.stats.timeSec/60).toFixed(0),'min',r.stats.filamentMm.toFixed(0),'mm',r.stats.violations,'violations');})"
```

Expected: `567 loops`, a plausible time (tens of minutes), a few metres of filament. Open the file: the first lines are the header comments, then `M201 …`, `M862.3 P "MK3S"`, `M83`, `M221 S100`, the prime line, `; BODY START`. Delete `textile_100x100_default.gcode` afterwards (it is a throwaway check).

- [ ] **Step 3: Record findings and commit**

If verification shows differences from spec §12 (for example the real violation count on the default tile), add one line to the spec §12 under a new item 9 stating the observed value, then:

```bash
git add README.md docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md
git commit -m "docs: update README with run instructions and first-print steps" -- README.md docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md
```

- [ ] **Step 4: Tell the user how to run it**

Report: "Double-click `Run Textile Tool.bat` in `fashionPrinting Tools`", what the default tile generates (loops, time, filament, violations), which defaults are unverified (Foamy), and that the first print should follow README's staged plan.
