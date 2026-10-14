# Fashion Printing Tools — Textile G-code Generator

A browser-based toolbox that generates direct G-code for experimental non-planar FDM textile: a sparse serpentine
base plus a dense pile of raised, anchored 3D loops. First target: Prusa MK3S, Filaflex Foamy 95, a 100 × 100 mm
sample. Machine and material profiles are data files, so more machines can be added from G-code you share.

**Status:** v1 implemented for the Prusa MK3S (84 automated tests passing). The first physical print has not
been done yet; the Foamy material profile stays unverified until then.

## Run it

Double-click `Run Textile Tool.bat` (needs Node 20 or newer). It starts a small local server and opens
http://localhost:5173/ in your browser. Close the window to stop it. From a terminal instead:

```bash
npm run serve     # server + browser
npm test          # engine tests (84)
npm run golden    # re-record the 20 x 20 golden summary after an intended engine change
```

In the page: pick the machine and material, adjust the parameters (the preview updates as you type), orbit the
3D view, scrub the "Print order" slider to replay the path, then **Download .gcode**. Every file records its full
parameter set and seed in comment lines. Red points mark moves the clearance model thinks come too close to
printed strands (tick "Show violations"; it is on automatically only when there are few).

## First prints (spec section 9)

1. Width 30, height 30, untick "Print loops": base only. Check adhesion, flow and corners.
2. Width 30, height 15, both ticked: exactly one row of loops. Check that the feet bond and the unsupported
   strands hold their height.
3. Width 30, height 30, both ticked, starting speeds: compare the clearance warnings with real collisions.
4. Width 100, height 100: the full sample.

Filaflex Foamy 95 values are unverified until the first print; change flow, temperature and the unsupported
speed one at a time. With the spec defaults the clearance model flags about 40 % of moves on the full sample
(legs 0.6 mm apart sit inside the nozzle keep-out); `leg_gap` 1.5 mm with `clearance` 0.5 mm brings that to
about 6 %, which is a good first comparison against reality.

## Where things are

| Path | What |
|---|---|
| `docs/original-brief.md` | The original brief (verbatim) and the decisions made while brainstorming |
| `docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md` | The v1 design spec (architecture, data model, engine behaviour, tests, first-print plan) |
| `docs/superpowers/plans/2026-10-14-textile-gcode-generator.md` | The v1 implementation plan (13 tasks, test-first) |
| `reference/research-notes-2026-10-14.md` | MK3S limits, PrusaSlicer Generic FLEX values, Recreus Foamy parameters, sources |
| `reference/g-code-analysis-2026-10-14.md` | What the user's own MK3S G-code and Bambu A1 mini 3MF contain (verified values, start/end blocks, Bambu notes) |
| `Shape-Box_0.2mm_FLEX_MK3S_5m.gcode` | User's sliced MK3S sample (PrusaSlicer 2.9.6, Generic FLEX): ground truth for the MK3S profile |
| `bambu lab a1 mini.gcode.3mf` | User's Bambu Studio sample for the A1 mini (future sub-project 5) |

Code:

| Path | What |
|---|---|
| `index.html`, `src/engine/`, `src/ui/` | The site and the pure-JS engine |
| `profiles/machines/`, `profiles/materials/` | Machine and material profile JSON |
| `vendor/three/` | Vendored three.js for the preview |
| `tests/` | `node --test` engine tests, including a golden summary for a 20 x 20 sample |
| `tools/` | Local server, three.js vendoring, golden-file updater |
| `Run Textile Tool.bat` | Double-click launcher |

## Roadmap

1. Textile generator + website + profiles (done, MK3S)
2. G-code → machine-profile extractor (from G-code you share)
3. SVG silhouette boundary with rotate-to-fit
4. Interwoven base + loops as one continuous extrusion path
5. Bambu Lab A1 mini support (`.gcode.3mf` packaging, Bambu start/end macros)

## Open requests

A PrusaSlicer-sliced `.gcode` made with **Filaflex Foamy 95** (not Generic FLEX) on the MK3S would let the Foamy
material profile be verified; the MK3S machine and Generic FLEX values are already confirmed from the sample
in this folder.
