# Fashion Printing Tools — Textile G-code Generator

A browser-based toolbox that generates direct G-code for experimental non-planar FDM textile: a crossed supporting
base plus a dense pile of raised, anchored 3D loops. First target: Prusa MK3S, Filaflex Foamy 95, a 100 × 100 mm
sample. Machine and material profiles are data files, so more machines can be added from G-code you share.

**Status:** the generator and the studio are built for the Prusa MK3S, with thirty-two structures (thirty-three tiles, with the Advanced zigzag mesh preset) (Zigzag mesh, Zigzag single layer, Loop pile, Squiggle &
Gyroid, Advanced zigzag mesh, SVG design, Halftone net, Spacer net, Pillar weave, Coil, Weave, Spiral panel, Bouclé & picots, Relief, Fringe, Crosshatch & isogrid, Auxetic mesh, Dip weave,
Spiderweb, Ring mail, Meander, Harmonograph, Truchet tiles, Voronoi lace, Turing stripes, Conformal mesh, Sunflower, Rosette,
Flow lines, Bubbles, Parquet, Spirograph, Star lattice), a strand-shape and pattern library,
and the automated tests passing. See `docs/fabric-structures.md` for the library.
The first physical print has not been done yet; the Foamy material profile stays unverified until then.

**Live site:** https://filafabric.pages.dev (Cloudflare Pages publishes every push to `main`; nothing to install).

## Demo prints

`node tools/export-demo-prints.mjs` writes twenty small swatches (60 × 60 mm, or `--size=80`) to `DemoTestingPrints/`, easiest
to hardest, numbered 01 to 20 so they can be laid out in order. Each file name is the number, the design, the preset it
started from, the size and the values of its settings; the first lines of the file repeat them, and `INDEX.md` lists what to
look at in each. The folder is git-ignored: the files are made on your machine.

## The password gate

The studio opens on a "Coming soon" page that says what it is and asks for one password (no username). Only a salted hash of the
password is in the repository (`src/ui/gate-config.json`); the studio itself is loaded only after the password is right.

```bash
node tools/set-password.mjs                  # a new random password, printed once
node tools/set-password.mjs "a longer phrase"  # or choose your own (8 characters or more)
```

Then commit `src/ui/gate-config.json` and push. **This is a soft gate**: the site is static, so anyone who knows the file
names can still download the studio's code. It keeps casual visitors out; for real access control put the site behind
Cloudflare Access (free for small teams) instead of, or as well as, this page. *Lock the studio* in the ⋯ menu locks this
browser again.

## Run it

Double-click `Run Textile Tool.bat` (needs Node 20 or newer). It starts a small local server and opens
http://localhost:5173/ in your browser. Close the window to stop it. From a terminal instead:

```bash
npm run serve     # server + browser
npm test          # engine and UI-logic regression tests
node tools/audit-printability.mjs # regenerate the default-swatch gallery ranking
npm run golden    # re-record the 20 x 20 golden summary after an intended engine change
```

In the page, work left to right: pick a **design**, shape it with the **settings** on the right (a width and height,
or an **SVG outline** to fill; then a few sliders, and you can click a slider's value to type an exact number), and
read the **print summary** at the bottom of the
settings: a check (amber with an "Add room" fix when loops are tight), print time, filament, and **Export swatch**. Every design starts at **100 × 100 mm**; saved custom dimensions remain available.
**Outlines:** drop an SVG under Size and shape (paths, polygons, rectangles, circles and ellipses, with curves and
transforms; text must be converted to paths). The shape fills both designs: holes stay open (even-odd), concave
parts print as separate strands instead of across the gap, and "Match its shape" sets the height to the outline's
proportions. Rotate it with the slider. The outline travels in share links and settings files; scripts and links
inside the SVG are stripped before it is read.
**Squiggle & Gyroid, Parallel:** layer 2 runs halfway between the layer 1 lines in opposite phase, and every wave is
kept at least a quarter of the line spacing plus half a strand deep, so each layer 2 line crosses the lines on both
sides and the two layers form one connected net (two layers of parallel lines that never cross would come apart).
**Loops at the back edge** decides what happens on the last base lines: a loop reaches one loop length past its
feet, so "On every line" gives every line loops and lets the last rows overhang the back edge, while
"Inside the swatch" (the default) keeps whole loops inside and leaves the last lines without loops of their own.
**Strand thickness** adds flow only where the loops are in the air (rising, falling and free-hanging; the base and
the anchored feet stay at normal flow), from 80 to 200 %, and shows the expected foamed strand diameter. Moves slow
down on their own if the extra flow would exceed what the hotend can melt, and the clearance check and the
true-thickness preview both use the thicker strands.
The preview opens on the strands at their true thickness; drag to turn, scroll to zoom, use Top / Angled / Side,
and press play to watch the print order. The **View** menu adds the nozzle path, travel moves, lifts, exaggerated
height and the red tight-spot marks (the clearance model's moves that come too close to printed strands; "Show
where" in the check turns them on too). For the loop pile, everything else lives under Advanced settings (38
settings in groups that show what you changed). The printer chip in the header opens the printer setup; the
**···** menu has Getting started, Save/Open settings file and Reset this design. Undo/redo and **Share** (a link that
reopens the design and its settings) work for every design. Every exported file records its full parameter set
and seed in comment lines.

## Printable SVG and garment panels

**Import printable SVG lines** sits above the pattern settings. SVG strokes become actual extruded first-layer paths, with the selected pattern above them. Open subpaths stay open. Physical document dimensions, margins and transforms are retained; resizing the design scales the drawing too. This is separate from **Fill an outline instead**, which only defines the garment boundary. Save/Open settings includes the imported paths; share links omit them to keep links small.

The live preview and **Export swatch** are bounded to 100 × 100 mm. **Full panel…** exports the selected texture as repeated sections over one continuous crossed backing, with the SVG drawing printed once across the full document. Radial motifs repeat per section. It runs in a worker with progress and cancellation, streams to a file in supported browsers, and limits the download fallback to 128 MB. Full panels currently use one filament. Select a printer that actually fits the panel. The generic 1000 × 1000 × 300 mm profile is an unverified template: configure homing, levelling and priming for the real machine.

The gallery lists estimated easier prints first, using the default 100 mm geometry: connection faults, unsupported spans, slopes, starts and loop-pile clearance flags. This is a comparative screen, not physical qualification. Details show the actual geometry and between-path travel for the current settings. Flat patterns start near the lower-left corner and choose the nearest remaining endpoint or closed-loop seam within each pass; raised pile and fringe preserve safe row order. Short structural ties connect isolated motifs, and crossing heights follow the previously printed material.

Spacing sliders reach 0.8 mm. Click any slider value to enter an exact value beyond its range; valid manual values survive saving and reopening. Invalid geometry, machine limits and generation budgets produce errors instead of silently changing the requested value.

## Local files

The original printer samples now live in ignored `reference/local-samples/`. They are retained as profile provenance, outside the deployable source. There were no STL files in this project. Engine modules, tests, vendored preview code and reference documentation remain in use.

## First prints (spec section 9)

1. Choose a 30 × 30 mm test swatch, Advanced settings → What to print → untick "Print the loops": base only. Check adhesion,
   flow and corners.
2. Custom size 30 × 15 mm, base and loops on, Loops at the back edge → **Inside the swatch**: exactly one row of
   loops. Check that the feet bond and the unsupported strands hold their height.
3. The 30 × 30 mm swatch with the defaults: compare the tight-spot markers with real collisions.
4. A 100 × 100 mm swatch.

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
| `docs/fabric-structures.md` | The structure library: what each card is, what is on the way, how to keep a swatch library |
| `docs/blender-ceramics-review-2026-10-14.md` | Which Blender ceramics designs transfer to fabric, and how |
| `docs/superpowers/specs/2026-10-14-fabric-design-library-design.md`, `docs/superpowers/plans/2026-10-14-fabric-design-library.md` | The structure-library spec and phase 0 to 2 plan |
| `docs/product-direction-2026-10-14.md` | Where the UI is heading (Plotcaster-style gallery + preconfigured printers) and name candidates |
| `docs/ux-round-2-2026-10-14.md` | Second UX review: what was still in the way, the reference tools, and what changed |
| `docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md` | The v1 design spec (architecture, data model, engine behaviour, tests, first-print plan) |
| `docs/superpowers/plans/2026-10-14-textile-gcode-generator.md` | The v1 implementation plan (13 tasks, test-first) |
| `reference/research-notes-2026-10-14.md` | MK3S limits, PrusaSlicer Generic FLEX values, Recreus Foamy parameters, sources |
| `reference/line-algorithms-for-fabric-2026-10-14.md` | Research: which plotter line styles can become two-layer printed fabric, with a recipe for layer 2 and the next three designs to build |
| `reference/g-code-analysis-2026-10-14.md` | What the user's own MK3S G-code and Bambu A1 mini 3MF contain (verified values, start/end blocks, Bambu notes) |
| `reference/local-samples/Shape-Box_0.2mm_FLEX_MK3S_5m.gcode` | The user's sliced MK3S sample (PrusaSlicer 2.9.6, Generic FLEX): ground truth for the MK3S profile. **Local only, not published** |
| `reference/local-samples/bambu lab a1 mini.gcode.3mf` | The user's Bambu Studio sample for the A1 mini (future sub-project 5). **Local only, not published** |

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
3. SVG outline boundary with rotate (done, both designs)
4. Interwoven base + loops as one continuous extrusion path
   - Structure library done (registry, pattern/shape/crossing libraries, nine cards, swatch codes). Next: the first
     prints, then tune the crossing lift, the relief limits and the weave from what they show
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

The site: Cloudflare Pages is connected to this repository. `main` is the production branch, so every push to
`main` publishes the live site; any other branch gets its own preview link instead. Work therefore goes straight to
`main`. The site is static, so there is no build step. GitHub Actions runs `npm test` on every push
(`.github/workflows/test.yml`) and marks a commit red if a test fails; it does not block the deploy.

The repository:

This folder lives inside a larger local repository that also holds other sites, so only this folder is published,
to https://github.com/telenaco/filafabric (branch `main`). From the parent repository:

```bash
git subtree split --prefix="fashionPrinting Tools" -b filafabric-main     # this folder's history only
git push filafabric filafabric-main:main                                   # remote: https://github.com/telenaco/filafabric.git
```

Later updates: `git subtree push --prefix="fashionPrinting Tools" filafabric main`.
