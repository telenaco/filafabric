# Textile G-code Generator — Design Spec (v1)

Date: 2026-10-14
Status: draft, awaiting review
Location: `fashionPrinting Tools/` (static website, part of the Websites workspace)

## 1. Intent

A browser-based toolbox that generates **direct G-code for experimental non-planar FDM textile** — no slicer. The
output is a sparse, flexible serpentine base plus a dense pile of raised, anchored 3D loops, printed in flexible
filament on a Prusa MK3S. The tool is meant to grow: new machines are added by dropping in a machine profile
(derived from G-code the user shares), and the boundary will later be an uploaded SVG silhouette.

The core abstraction is the **fiber**: a parametric 3D curve `P(t) = (x(t), y(t), z(t))`, `0 ≤ t ≤ 1`. The XY shape
and the Z lift are independent functions, so new fiber shapes need no change to the G-code engine.

Primary use: Luis's textile / 3D-printed-fabric experiments. Success is a repeatable, comparable test print and a
tool that is easy to extend, not print speed.

## 2. Success criteria

1. For the v1 sample (100 × 100 mm rectangle) the tool produces a `.gcode` file the MK3S can print, with every
   X/Y/Z/E value computed by the engine.
2. The 3D preview and the G-code are generated from the **same** tagged toolpath, so the preview is what prints.
3. With randomness off, output is byte-identical for identical parameters. With randomness on, the same seed gives
   the same file.
4. Adding a machine or a material is adding a JSON file; no engine code changes.
5. Boundary, fiber shape and path planner are replaceable behind small interfaces (SVG boundary and interwoven
   path must fit without restructuring).
6. Every generated file records its full parameter set and seed in comment lines, so any print can be reproduced.

## 3. Scope and decomposition

| # | Sub-project | Status |
|---|---|---|
| 1 | Textile generator + website + profile format + MK3S/Foamy/Generic FLEX profiles | **this spec** |
| 2 | G-code → machine-profile extractor (reads speeds, accelerations, jerk, start/end G-code, E mode from shared G-code and PrusaSlicer/Orca/Cura embedded config) | later; until then profiles are authored by hand from shared G-code |
| 3 | SVG silhouette boundary: upload, rotate, scale, fill | later; interface specified in §6.4 |
| 4 | Interwoven base + loops as one continuous extrusion path | later; planner interface leaves room (§6.5) |

**In v1:** rectangle boundary, hairpin fiber (+ one trivial second shape to exercise the interface), sin² Z
profile, serpentine base, tiler with stagger, seeded randomness, machine/material profiles, preview, G-code
download, parameter JSON save/load.

**Out of v1 (designed for):** SVG boundary, profile extractor, interwoven path, any fiber shape beyond hairpin and
arch, multi-material, multiple extruders.

## 4. Architecture

Stack: static site, plain ES modules, no build step. three.js (vendored in `vendor/three/`) for the preview.
Engine modules are pure JS with no DOM access so Node's built-in test runner exercises the same code the browser
runs. ES modules require `http://`, so local use is `python -m http.server` (or any static server).

```
profiles/machines/prusa-mk3s.json
profiles/materials/filaflex-95-foamy.json
profiles/materials/generic-flex-mk3.json
        + textile parameters (UI / JSON)
                         │
src/engine/
  params.js      defaults, validation, merging profiles + textile params into one resolved config
  rng.js         seeded PRNG (mulberry32)
  fiber.js       fiber shapes: footprint(t) + zProfile(s) → local (x, y, z_rel) samples
  base.js        serpentine base path
  boundary.js    Boundary interface + RectBoundary
  tiler.js       fiber placement: rows, stagger, leg_gap, randomness, ordering
  planner.js     tagged 3D polyline: classifies moves, inserts travels, clearance + height map
  extrusion.js   strand area, E computation, speed clamping
  gcode.js       header / body / footer emission
  stats.js       time, filament length/mass, loop count, slope, clearance, warnings
src/ui/
  main.js        wiring, form, localStorage conveniences (always wrapped in try/catch)
  preview.js     three.js scene, colour-by-class, scrub slider, violation highlights
tests/           node --test
vendor/three/
index.html
```

### 4.1 Toolpath representation

The planner outputs `Move[]`. Each `Move` is the **target** of one `G1`:

```
{ x, y, z,            // mm, machine coordinates
  cls,                // 'base' | 'supported' | 'rising' | 'falling' | 'unsupported' | 'travel'
  extrude,            // boolean; false for travel
  retract?,           // 'retract' | 'unretract' marker emitted before/after long travels
  tag?                // optional debug label, e.g. 'row 3 loop 12'
}
```

The preview and `gcode.js` both consume this array. E and F are derived in `extrusion.js`, never stored by the
planner.

## 5. Data model

### 5.1 Machine profile (`profiles/machines/*.json`)

Describes the machine only. Values below are from Prusa's PrusaSlicer MK3 printer preset (master branch,
2026-10-14) and are marked `verified: false` until confirmed against G-code from the user's own printer.

```json
{
  "id": "prusa-mk3s",
  "name": "Original Prusa i3 MK3S / MK3S+",
  "firmware": "prusa-marlin",
  "verified": false,
  "source": "PrusaSlicer preset-printer-mk3.yaml (master)",
  "bed": { "width": 250, "depth": 210, "max_z": 210, "origin": "front-left" },
  "extrusion": { "relative_e": true, "reset_e_per_move": false },
  "limits": {
    "default_mode": "normal",
    "modes": {
      "normal": {
        "max_feedrate": { "x": 200, "y": 200, "z": 12, "e": 120 },
        "max_accel": { "x": 1000, "y": 1000, "z": 200, "e": 5000 },
        "accel_extruding": 1250, "accel_retracting": 1250, "accel_travel": 1500,
        "jerk": { "x": 8, "y": 8, "z": 0.4, "e": 4.5 }
      },
      "stealth": {
        "max_feedrate": { "x": 100, "y": 100, "z": 12, "e": 120 },
        "max_accel": { "x": 960, "y": 960, "z": 200, "e": 5000 },
        "accel_extruding": 1250, "accel_retracting": 1250, "accel_travel": 1250,
        "jerk": { "x": 8, "y": 8, "z": 0.4, "e": 4.5 }
      }
    },
    "emit_to_gcode": true
  },
  "printer_model_check": "MK3S",
  "start_gcode": ["...one array element per line of the start block below..."],
  "end_gcode": ["...one array element per line of the end sequence below..."]
}
```

In the file, `start_gcode` and `end_gcode` are arrays of strings, one per G-code line. The start block (placeholders
in `{braces}`) is adapted from Prusa's MK3 start block:

```
M862.3 P "{printer_model_check}" ; printer model check
M862.1 P{nozzle_diameter} ; nozzle diameter check
M115 U3.14.1 ; tell printer latest fw version
G90 ; absolute coordinates
M83 ; relative E
M104 S{first_layer_temp} ; set extruder temp
M140 S{bed_temp} ; set bed temp
M190 S{bed_temp} ; wait for bed
M109 S{first_layer_temp} ; wait for extruder
G28 W ; home all without mesh bed level
G80 X{print_min_x} Y{print_min_y} W{print_width} H{print_height} ; mesh bed levelling
{machine_limits}
M221 S100 ; flow 100% (Prusa's stock start G-code sets 95%; E is computed exactly by the engine)
{prime_line}
G92 E0
```

`{prime_line}` is generated by the engine from the active material's volumetric ceiling, not copied from Prusa's
PLA-oriented intro line, which would exceed a flexible filament's flow limit. `end_gcode` follows Prusa's MK3
sequence: raise Z, park, `G4`, `M221 S100`, `M900 K0`, `M104 S0`, `M140 S0`, `M107`, `M84`.

### 5.2 Material profile (`profiles/materials/*.json`)

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
  "retraction": { "length": 2.5, "speed": 75, "deretract_speed": 25, "z_hop": 0.2, "min_travel": 10 },
  "fan": { "default": 0, "note": "Recreus: fan off; unsupported-strand cooling is an experiment parameter" },
  "travel_speed_hint": 200,
  "pressure_advance_k": null,
  "notes": "Dry at 55 C for at least 1 h. Direct-drive extruder recommended. Foams at 245-250 C; lower flow and higher temperature foam more."
}
```

`flow.max_volumetric_speed_nominal` is Recreus's slicer-style figure (nominal line area × speed, before the
multiplier). The engine converts it to **actual deposited volume** = nominal × multiplier (5.0 × 0.73 ≈ 3.65
mm³/s) and clamps against that. `generic-flex-mk3.json` carries Prusa's stock Generic FLEX values for the MK3
family at 0.4 mm: 240 / 240 °C, bed 50, multiplier 1.15, max volumetric 1.2 nominal, retraction length 0 and no
Z-hop, fan effectively off, `deretract_speed` 25, density 1.22.

### 5.3 Textile parameters (UI / JSON) and defaults

| Group | Parameter | Default | Notes |
|---|---|---|---|
| Sample | `sample_width`, `sample_height` | 100, 100 mm | v1 boundary: 100 × 100 mm (10 × 10 cm) |
| Sample | `include_base`, `include_loops` | true, true | for staged first prints |
| Base | `base_spacing` | 5 mm | spacing between serpentine lines |
| Base | `corner_radius` | 1 mm | fillet at serpentine turns |
| Strand | `layer_height` | 0.2 mm | base strand height / first-layer Z |
| Strand | `extrusion_width` | 0.45 mm | base strand width (assumption: Prusa 0.4 nozzle default) |
| Strand | `free_strand_diameter` | nozzle diameter | in-air strand cross-section |
| Machine | `nozzle_diameter`, `filament_diameter` | 0.4, 1.75 mm | filament overridden by material |
| Loop | `loop_width` | 6 mm | centre-to-centre leg distance |
| Loop | `loop_length` | 15 mm | foot line to far end of cap |
| Loop | `loop_pitch` | 3 mm | spacing along a row (50 % overlap) |
| Loop | `loop_z_lift` | 3 mm | peak height above base |
| Loop | `anchor_dwell` | 1 mm | flat run at each foot |
| Loop | `z_profile` | `sin2` | alternatives: `bell`, `smoothstep` |
| Loop | `leg_gap` | 0.6 mm | minimum leg-to-leg XY distance (see §6.3) |
| Pattern | `row_pitch_multiple` | 1 | `row_pitch = multiple × base_spacing` |
| Pattern | `row_stagger` | 0.5 | alternate rows offset by this fraction of `loop_pitch` |
| Pattern | `boundary_policy` | `footprint` | `footprint` (all sampled XY inside) or `feet-only` |
| Resolution | `curve_resolution` | 0.4 mm | max distance between calculated points |
| Classes | `support_threshold` | 0.4 mm | z_rel below which a loop strand is `supported` |
| Classes | `unsupported_fraction` | 0.6 | z_rel ≥ fraction × lift ⇒ `unsupported` |
| Speeds | `speed_base`, `speed_supported`, `speed_nonplanar`, `speed_unsupported`, `speed_travel` | 15, 12, 8, 5, 150 mm/s | starting values to tune; `nonplanar` applies to rising/falling |
| Fans | `fan_<class>` | 0 % each | per class; material default 0 |
| Clearance | `nozzle_tip_radius` | 0.6 mm | clearance model (assumption, to calibrate) |
| Clearance | `nozzle_cone_half_angle` | 30° | clearance model (assumption, to calibrate) |
| Clearance | `clearance` | 1.0 mm | extra margin used by travels and validation |
| Retraction | from material profile | | overridable in UI |
| Randomness | `random_enabled` | false | master switch |
| Randomness | `random_seed` | 1 | |
| Randomness | `amp_length`, `amp_width`, `amp_lift`, `amp_xy`, `amp_orientation`, `amp_spacing` | 0 each | per-attribute amplitude (mm or degrees) |
| Machine | `limits_mode` | `normal` | `normal` or `stealth` |

Expected scale for the defaults: base lines at y = 0, 5, …, 100 (21 lines, ≈ 2.2 m of path); rows with feet at
y = 0 … 85 (18 rows); 32 loops per row ⇒ 576 loops of ≈ 33 mm arc length each.

## 6. Engine behaviour

### 6.1 Fiber (`fiber.js`)

A fiber shape is a function of the shape parameters returning an ordered list of samples in a **local frame**:
origin at the midpoint between the two feet, +Y toward the far end, `z_rel` above the textile.

Default shape `hairpin`: two straight legs `loop_width` apart, running `loop_length − r` along +Y (`r =
loop_width / 2`), joined at the far end by a semicircular cap of radius `r`. Total arc length
`S = 2(loop_length − r) + π r` (≈ 33.4 mm with the defaults). Samples are spaced ≤ `curve_resolution` along arc
length. A second trivial shape `arch` (a single strand from one foot to a second foot) exists to keep the shape
interface honest.

Z profile, with arc length `s ∈ [0, S]` and `anchor_dwell = d`:

- `sin2`: `z_rel(s) = lift · sin²(π · u)` where `u = clamp((s − d) / (S − 2d), 0, 1)`; flat at both feet and
  peaking mid-cap. Peak slope = `lift · π / (S − 2d)`; with the defaults ≈ 17°, so the Z component stays under
  the MK3S's 12 mm/s limit at any 3D speed up to ≈ 40 mm/s.
- `bell`, `smoothstep`: alternative smooth profiles with the same endpoints and peak.

Z is **continuous** across every XY step; the engine never emits "move up, move over, move down".

### 6.2 Base (`base.js`)

Serpentine lines parallel to X, `base_spacing` apart, covering the boundary bounding box, joined at alternate
ends by a short Y step along the edge with `corner_radius` fillets. The base is generated as **one continuous
extrusion path** over the rectangle. With a non-rectangular boundary (future) lines are clipped to the boundary
into runs, and the planner stitches the runs, using the shortest travel and retracting only when the travel
exceeds the retraction threshold.

### 6.3 Tiler (`tiler.js`)

- **Anchoring.** Loops lean along +Y; both feet lie on the same base line (perpendicular legs). Therefore
  `row_pitch = row_pitch_multiple × base_spacing`, and feet rows coincide with base lines.
- **Counts.** Loops per row and row count are derived from the boundary bbox, `loop_width`, `loop_length` and
  `loop_pitch`; nothing is hard-coded.
- **Stagger.** Alternate rows are offset by `row_stagger × loop_pitch` in X.
- **Leg coincidence.** With `loop_pitch = loop_width / 2`, loop *i*'s right leg would land on loop *i+2*'s left
  leg. The tiler applies a lateral nudge of `leg_gap` in a `0, 0, +δ, +δ` pattern along the row so no two legs'
  XY polylines come closer than `leg_gap` anywhere they are both above `support_threshold`. This is an invariant
  checked by a unit test and verified at runtime (violations become warnings).
- **Ordering ("shingle order").** Rows are printed from the largest foot Y down to the smallest, and loops
  within a row in increasing X. Each new loop therefore climbs *over* material already printed, and the nozzle
  never needs to descend under a raised strand.
- **Boundary selection.** A loop is kept if `boundary.containsPolyline(footprint, policy)`; `policy` is
  `footprint` (every sampled XY inside) or `feet-only`.

### 6.4 Boundary (`boundary.js`)

```
Boundary {
  bbox()                          → { minX, minY, maxX, maxY }
  contains(x, y)                  → boolean
  containsPolyline(points, policy)→ boolean
}
RectBoundary(width, height)       // v1
```

v1 ships `RectBoundary` only; the tiler and base depend solely on this interface.

**Planned SVG boundary (sub-project 3, recorded here so the interface is not painted into a corner):** the user
uploads an SVG; the tool flattens Bézier paths to polygons (even-odd fill, holes supported), scales to a target
width in mm, and lets the user **rotate the silhouette** relative to the pattern axes (quick 0° / 90° buttons and
a free angle), because the pattern's axes are fixed to the machine (base lines along X, loops leaning +Y) and the
fit depends on that relative angle. The rotated polygon is recentred on the bed and fed through the same
`Boundary` interface. Point-in-polygon and flattening live in the pure engine so they stay Node-testable. An
automatic "suggest best rotation" (maximise loop count or minimise discarded area) is a possible later
addition.

### 6.5 Planner (`planner.js`)

1. Emit base moves, then loops in the order from §6.3 (v1 is "base then pile"). The planner takes a list of
   *strands* (base runs, fibers) and an ordering strategy, so an interwoven single path (sub-project 4) is a new
   strategy, not a rewrite.
2. Classify every extruded move: `base`; for loops by `z_rel` and slope — `supported` (`z_rel ≤
   support_threshold`), `unsupported` (`z_rel ≥ unsupported_fraction × lift`), otherwise `rising` or `falling` by
   the sign of `dz/ds`.
3. Insert travels between strands. Travel Z = tallest earlier strand within the travel corridor from a
   **printed-height map** (0.5 mm grid) + `clearance`, falling back to the material's `z_hop` when nothing is
   in the way. Retract/unretract markers are placed around travels longer than `retraction.min_travel`.
4. **Clearance validation.** For each extruding move, any earlier strand point at horizontal distance `d` and
   height `z_e` collides if `z_e > z_nozzle + 0.05` and `d < nozzle_tip_radius + (z_e − z_nozzle) ·
   tan(nozzle_cone_half_angle)`, plus `clearance`. Violations are flagged on the move and highlighted in the
   preview; they do not abort generation.

### 6.6 Extrusion and speeds (`extrusion.js`)

- Filament area `A_f = π (d_f / 2)²` (2.405 mm² for 1.75 mm).
- Strand area `A_s`: on-bed / supported strands use the rounded-rectangle model `h · (w − h · (1 − π/4))`;
  in-air strands (`rising`, `falling`, `unsupported`) are round with diameter `free_strand_diameter`.
- Per move: `ΔE = Δs₃D · A_s · multiplier / A_f`, with `Δs₃D = √(dx² + dy² + dz²)`. E is relative (`M83`).
- Foamy flow: `multiplier` and `reference_line_width` are stored exactly as Recreus gives them (73 % on a
  0.55 mm line); `foam_expansion` is used only to estimate real strand thickness for clearance and `leg_gap`.
- **Speed clamp.** Each move's linear speed `v` (mm/s along the 3D vector) is the minimum of:
  1. the class target speed;
  2. material volumetric ceiling ÷ `(A_s · multiplier)` (ceiling on **actual** deposited volume);
  3. machine X/Y feedrate limit applied to the XY component;
  4. machine Z limit: `v · |dz/ds| ≤ max_feedrate.z` (12 mm/s on the MK3S);
  5. machine E limit: `v · A_s · multiplier / A_f ≤ max_feedrate.e`.
- Marlin applies `F` to the XYZ vector, so `F = v · 60`. Travel moves use `speed_travel` clamped by the machine.
- Fans: `M106 S…` emitted when the class changes and the class's fan value differs from the current fan value.

### 6.7 G-code writer (`gcode.js`)

Header comments (full parameter block, profile ids/versions, seed, generator version, estimated time/length),
machine start block (§5.1 template with machine limits emitted as `M201/M203/M204/M205` when
`emit_to_gcode`), body (`G1 X Y Z E F`, with `F` written only when it changes), retract/unretract as relative-E
moves, and the end block. Numbers are fixed-precision (XYZ 3 decimals, E 5 decimals). A final pre-flight
validation rejects output if any coordinate leaves the bed or exceeds `max_z`, any feedrate exceeds the machine
limit, or any temperature is outside 0–300 °C.

### 6.8 Randomness (`rng.js`, applied in `tiler.js`)

A seeded PRNG draws per-fiber perturbations of length, width, lift, XY position, orientation (rotation about the
foot midpoint) and row/loop spacing, each scaled by its own amplitude. Randomness is applied **only when fiber
parameters are drawn**; with `random_enabled = false` no PRNG calls happen, so deterministic comparisons are
exact. The leg_gap invariant is re-checked after perturbation.

## 7. UI

One page. Left column: collapsible parameter groups (sample, base, loops, pattern & randomness, speeds & fans,
material, machine) with machine/material dropdowns populated from `profiles/`. Right: orbitable three.js preview,
coloured by move class, with a travel toggle, highlighted clearance violations and a **scrub slider** that
replays print order. A stats panel shows estimated time, filament length and mass, loop count, max slope, min
clearance and warnings. Buttons: Download `.gcode`; Save / Load parameters JSON. Last-used parameters may be
remembered in `localStorage`; every storage access is wrapped in try/catch and the page renders correctly
without it.

## 8. Testing

`node --test`, engine only:

- E uses true 3D distance (known helix/ramp).
- Loop and row counts follow from boundary size and pitch; boundary clipping selects the right loops.
- Same seed ⇒ identical output; randomness off ⇒ byte-identical output; different seed ⇒ different output.
- `leg_gap` invariant holds across a full tile.
- Speed clamps never exceed material or machine limits (incl. the Z-component limit on steep moves).
- Shingle ordering: on the default tile, printing rows near-to-far produces strictly more clearance violations
  than the shingle (far-to-near) order, and the violation count for the default order is recorded in the golden
  stats so regressions are visible.
- G-code round trip: a small parser re-reads the generated file; assert bounds, total E equals the engine's
  computed total, all feedrates ≤ limits, and `M221 S100` precedes the first extrusion.
- Golden file for a 20 × 20 mm sample.
- Profile schema validation for every file in `profiles/`.

UI: manual verification in the browser (preview renders, scrub slider, download, parameter round trip).

## 9. First-print validation plan

Because this is novel toolpath on a real machine, prints are staged. The UI toggles `include_base` /
`include_loops` and a small `sample_width/height` exist for this:

1. 30 × 30 mm, base only: confirm adhesion, flow, and corner behaviour.
2. 30 × 30 mm, one row of loops: confirm anchoring and that unsupported strands hold their shape.
3. 30 × 30 mm full pattern at the starting speeds: check clearance warnings against actual collisions.
4. 100 × 100 mm full sample.

## 10. Risks and assumptions

- Profile values come from PrusaSlicer master and Recreus's published guidance; none is verified on the user's
  printer until a sliced MK3S G-code is shared. Profiles carry `verified: false` until then.
- Foam expansion (≈ 1.4–1.6×) changes real strand diameter after deposition; `leg_gap` and clearance use an
  estimate that may need tuning.
- The nozzle-cone clearance model is an assumption and needs calibration against real collisions.
- Unsupported foamed TPU strands may sag or fail to hold height; speeds, fan, and lift are the first things to
  adjust. These are the purpose of the experiment, not defects of the tool.
- The MK3S firmware planner may slow down on very short segments at higher speeds; the default speeds and
  `curve_resolution` are chosen well below any expected limit, but this should be observed on the first print.
- Prusa's stock start G-code applies `M221 S95`; the generator overrides with `M221 S100` so E is exactly the
  computed value.

## 11. Future work

- **Sub-project 3 — SVG boundary:** upload, flatten, scale, rotate (see §6.4), fill; base clipped into runs.
- **Sub-project 2 — profile extractor:** read limits, E mode, start/end G-code and embedded slicer config from
  shared G-code; emit a machine or material profile JSON; optionally an in-browser import.
- **Sub-project 4 — interwoven path:** base and loops as one continuous extrusion, as a new planner ordering
  strategy.
- More fiber shapes (teardrop, horseshoe, asymmetric), automatic rotation suggestion, per-region randomness.
