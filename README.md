# Fashion Printing Tools — Textile G-code Generator

A browser-based toolbox that generates direct G-code for experimental non-planar FDM textile: a sparse serpentine
base plus a dense pile of raised, anchored 3D loops. First target: Prusa MK3S, Filaflex Foamy 95, a 100 × 100 mm
sample. Machine and material profiles are data files, so more machines can be added from G-code you share.

**Status:** the generator and the studio are built for the Prusa MK3S, with two designs (Loop pile, Squiggle &
Gyroid) and 145 automated tests passing.
The first physical print has not been done yet; the Foamy material profile stays unverified until then.

**Live site:** https://telenaco.github.io/filafabric/ (published from `main` by `.github/workflows/pages.yml` after
the tests pass; nothing to install).

## Run it

Double-click `Run Textile Tool.bat` (needs Node 20 or newer). It starts a small local server and opens
http://localhost:5173/ in your browser. Close the window to stop it. From a terminal instead:

```bash
npm run serve     # server + browser
npm test          # engine and UI-logic tests (145)
npm run golden    # re-record the 20 x 20 golden summary after an intended engine change
```

In the page, work left to right: pick a **design**, shape it with the **settings** on the right (swatch size, then a
few sliders; click a slider's value to type an exact number), and read the **print summary** at the bottom of the
settings: a check (amber with an "Add room" fix when loops are tight), print time, filament, and **Export G-code**.
**Strand thickness** adds flow only where the loops are in the air (rising, falling and free-hanging; the base and
the anchored feet stay at normal flow), from 80 to 200 %, and shows the expected foamed strand diameter. Moves slow
down on their own if the extra flow would exceed what the hotend can melt, and the clearance check and the
true-thickness preview both use the thicker strands.
The preview opens on the strands at their true thickness; drag to turn, scroll to zoom, use Top / Angled / Side,
and press play to watch the print order. The **View** menu adds the nozzle path, travel moves, lifts, exaggerated
height and the red tight-spot marks (the clearance model's moves that come too close to printed strands; "Show
where" in the check turns them on too). For the loop pile, everything else lives under Advanced settings (39
settings in groups that show what you changed). The printer chip in the header opens the printer setup; the
**···** menu has Getting started, Save/Open settings file and Reset this design. Undo/redo and **Share** (a link that
reopens the design and its settings) work for every design. Every exported file records its full parameter set
and seed in comment lines.

## First prints (spec section 9)

1. Test swatch (30 × 30 mm), Advanced settings → What to print → untick "Print the loops": base only. Check adhesion,
   flow and corners.
2. Custom size 30 × 15 mm, base and loops on: exactly one row of loops. Check that the feet bond and the
   unsupported strands hold their height.
3. Test swatch (30 × 30 mm) with the defaults: compare the tight-spot markers with real collisions.
4. Full swatch (100 × 100 mm).

Filaflex Foamy 95 values are unverified until the first print; change flow, temperature and the unsupported
speed one at a time. If the loops come out thin or break, raise Strand thickness in steps of 10 to 20 %. With the spec defaults the clearance model flags about 40 % of moves on the full sample.
There are two causes: legs only 0.6 mm apart sit inside the nozzle keep-out, and neighbouring loops' caps cross
at the same height (normal at 50 % overlap, and not removed by more room). `leg_gap` 1.5 mm with `clearance`
0.5 mm (the "Roomy" option, or "Give loops more room" on the verdict card) brings the count to about 6 %; with
`clearance` 0 the crossings alone still flag about 1,600 moves (3 %).
Use the count to compare layouts, not as pass or fail.

## Where things are

| Path | What |
|---|---|
| `docs/original-brief.md` | The original brief (verbatim) and the decisions made while brainstorming |
| `docs/product-direction-2026-10-14.md` | Where the UI is heading (Plotcaster-style gallery + preconfigured printers) and name candidates |
| `docs/ux-round-2-2026-10-14.md` | Second UX review: what was still in the way, the reference tools, and what changed |
| `docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md` | The v1 design spec (architecture, data model, engine behaviour, tests, first-print plan) |
| `docs/superpowers/plans/2026-10-14-textile-gcode-generator.md` | The v1 implementation plan (13 tasks, test-first) |
| `reference/research-notes-2026-10-14.md` | MK3S limits, PrusaSlicer Generic FLEX values, Recreus Foamy parameters, sources |
| `reference/g-code-analysis-2026-10-14.md` | What the user's own MK3S G-code and Bambu A1 mini 3MF contain (verified values, start/end blocks, Bambu notes) |
| `Shape-Box_0.2mm_FLEX_MK3S_5m.gcode` | The user's sliced MK3S sample (PrusaSlicer 2.9.6, Generic FLEX): ground truth for the MK3S profile. **Local only, not published** |
| `bambu lab a1 mini.gcode.3mf` | The user's Bambu Studio sample for the A1 mini (future sub-project 5). **Local only, not published** |

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
6. Product shell: design gallery on the left, settings on the right, preconfigured printer bundles, shareable
   links (see `docs/product-direction-2026-10-14.md`, which also lists candidate names)

## Open requests

A PrusaSlicer-sliced `.gcode` made with **Filaflex Foamy 95** (not Generic FLEX) on the MK3S would let the Foamy
material profile be verified; the MK3S machine and Generic FLEX values are already confirmed from the sample
in this folder.

## Contributors

- [Bubaki Design](https://github.com/bubakiDesign)

## Publishing

The site: every push to `main` runs the tests and, if they pass, publishes `index.html`, `src/`, `profiles/` and
`vendor/` to GitHub Pages (`.github/workflows/pages.yml`). It needs one setting, once: Settings → Pages → Build and
deployment → Source: **GitHub Actions**. To republish without a code change, run the "Deploy site" workflow from
the Actions tab.

The repository:

This folder lives inside a larger local repository that also holds other sites, so only this folder is published,
to https://github.com/telenaco/filafabric (branch `main`). From the parent repository:

```bash
git subtree split --prefix="fashionPrinting Tools" -b filafabric-main     # this folder's history only
git push filafabric filafabric-main:main                                   # remote: https://github.com/telenaco/filafabric.git
```

Later updates: `git subtree push --prefix="fashionPrinting Tools" filafabric main`.
