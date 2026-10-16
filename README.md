# Fashion Printing Tools — Textile G-code Generator

A browser-based toolbox that generates direct G-code for experimental non-planar FDM textile: a crossed supporting
base plus a dense pile of raised, anchored 3D loops. First target: Prusa MK3S, Filaflex Foamy 95, a 100 × 100 mm
sample. Machine and material profiles are data files, so more machines can be added from G-code you share.

**Status:** the generator and the studio are built for the Prusa MK3S, with thirty-one structures (thirty-two tiles, with the Advanced zigzag mesh preset) (Zigzag mesh, Loop pile, Squiggle &
Gyroid, Advanced zigzag mesh, SVG design, Halftone net, Spacer net, Pillar weave, Coil, Weave, Spiral panel, Bouclé & picots, Relief, Fringe, Crosshatch & isogrid, Auxetic mesh, Dip weave,
Spiderweb, Ring mail, Meander, Harmonograph, Truchet tiles, Voronoi lace, Turing stripes, Conformal mesh, Sunflower, Rosette,
Flow lines, Bubbles, Parquet, Spirograph, Star lattice), a strand-shape and pattern library,
and the automated tests passing. See `docs/fabric-structures.md` for the library.
The first physical print has not been done yet, so start with a small test swatch.

**Live site:** https://filafabric.pages.dev (Cloudflare Pages publishes every push to `main`; nothing to install).

## Whole repeats at the edge

A swatch is sewn or welded to the next piece, so a pattern meets the edge at the end of a repeat, never part-way
through one (`src/engine/repeats.js`). The wave length, line spacing, tile or cell size you set is a target: the
pattern uses the nearest size that fits a whole number of times (9.6 zigzags in 100 mm become 10 of 10 mm), its lanes
run from one edge to the other with a wavy line kept a full swing in, and cells are whole: bubbles and chainmail rings
sit inside the edge, Voronoi cells are closed by a wall along it, Truchet and basket blocks fill the swatch, star
lattices meet the edge on a line of symmetry. A pattern that meets a straight edge at a slant (a 45° hatch, a
herringbone, a radial web or rosette) cannot end on a whole repeat, and is cut there as before.

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
settings: a check (amber with an "Add room" fix when loops are tight), print time, filament, and one **Export** button. Every design starts at **100 × 100 mm**; saved custom dimensions remain available.
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
settings in groups that show what you changed). The page always opens on the Zigzag mesh (what was set in the other
designs is kept for when you choose them; a shared link opens the design it was made from). The printer chip in the
header opens the printer setup: printer, filament, the **layer thickness** (only what the nozzle can lay down: a 0.4 mm
nozzle prints 0.10, 0.15, 0.20 and 0.25 mm) and **Extra layers**. Settings sections start folded under a title
and a summary of their current values. Open a section to see its cards or sliders; choosing a card keeps the section
open. Option and preset pictures use the same line colours as the preview. The **···** menu has Getting started,
Save/Open settings file, Download error log and Reset this design. Undo/redo and **Share** (a link that
reopens the design and its settings) work for every design. Every exported file records its full parameter set
and seed in comment lines.

## Printers and filaments

The printer and filament lists are the files in `profiles/machines/` and `profiles/materials/`, read the way a slicer reads its own folders. Each file can be this tool's JSON or what a slicer exports as it is:

| Export | What it gives |
|---|---|
| PrusaSlicer config (`.ini`, `File > Export > Export Config`), or a bundle | A printer and a filament per section, named as in the slicer |
| A `.gcode` PrusaSlicer sliced | The config it carries at the end of the file |
| Bambu Studio / OrcaSlicer preset (`.json`) | A printer or a filament |

Bed size, nozzle and filament diameter, temperatures, flow, retraction, machine limits and start/end G-code are read; the slicer's own start and end G-code is kept where its placeholders can be filled and the rest is left out, with a note saying so. Run `node tools/profiles-index.mjs` (or `npm run profiles`) after adding or removing a file to refresh `profiles/index.json`; the local server does it on the fly. In the printer setup dialog **Add a printer or filament file…** keeps a file in this browser only, with a **Remove** button; to share it, put the file in the folder.

The bundled filament choices include **NinjaTek NinjaFlex 85A (Midnight Black)**, **Generic TPE Flexible**, and
**Generic PLA**, alongside the existing Filaflex and Generic FLEX profiles. These use PrusaResearch 2.5.12's
classic MK3 / 0.4 mm reference settings. Generic TPE is a labelled Generic FLEX starting point for an unspecified
spool; PLA is rigid. [Material sources and adaptations](profiles/MATERIAL_SOURCES.md) record the pinned upstream
revision and how cooling is mapped to this tool's path roles. First-layer heat is retained through bed extrusion;
the printing temperature is sent once extrusion rises above the bed layer, including streamed exports.

## Printable SVG and garment panels

**Import SVG** sits above the pattern settings. Colour and stroke width say what each part of the drawing does:

| In the drawing | What it prints |
|---|---|
| A closed shape in pure **red** (`#ff0000`) | Filled with the pattern |
| A closed shape in pure **blue** (`#0000ff`) | Left empty: a hole |
| Blue inside red | Cuts a hole in the red; a red shape inside that blue is filled again (the innermost shape decides) |
| A shape that is not closed | Never filled; it is a line |
| Any open path, or a closed shape in another colour | A line, printed as drawn |
| A line's stroke width | The number of passes: width ÷ extrusion width, rounded, at least one. A line as wide as the nozzle is one pass; a 0.8 mm line is two passes side by side and a 1.2 mm line three |

Colour comes from the fill, or from the stroke when the fill is `none`; the stroke width of a red or blue shape is only a marker. Physical document dimensions, margins and transforms are retained; resizing the design scales the drawing (and its line widths) too. A drawing that carries no colours at all (an older saved file) keeps the previous rule: closed paths are shapes and shapes inside shapes alternate fill, hole. **Fill its shapes with this pattern** cuts the pattern to the red area, less the blue holes in it. Save/Open settings includes the imported paths and their colours; share links omit them to keep links small. `tests/fixtures/red-blue-lines.svg` is a small example of all of this.

**Export** saves the selected design at its chosen dimensions and settings directly. It never substitutes the preview dimensions or repeats a smaller motif. Previews up to 250 × 250 mm that fit the bed show the whole design; larger designs show a labelled 100 × 100 mm portion. Full-size generation runs in a worker, and machine limits or generation budgets produce an error rather than a smaller file. **More → Export repeating garment panel** is a separate advanced tool for repeating texture sections over one continuous crossed backing, with the SVG drawing printed once across the full document. Radial motifs repeat per section in that tool. Repeating panels use one filament, support progress and cancellation, and stream to a file in supported browsers with a 128 MB download fallback limit. The generic 1000 × 1000 × 300 mm profile is a template: add your own printer from a slicer export (see *Printers and filaments*) or edit its startup, levelling and priming.

The gallery lists estimated easier prints first, using the default 100 mm geometry: connection faults, unsupported spans, slopes, starts and loop-pile clearance flags. This is a comparative screen, not physical qualification. Details show the actual geometry and between-path travel for the current settings. Flat patterns start near the lower-left corner and choose the nearest remaining endpoint or closed-loop seam within each pass; raised pile and fringe preserve safe row order. Short structural ties connect isolated motifs, and crossing heights follow the previously printed material.

Spacing sliders reach 0.8 mm. Click any slider value to enter an exact value beyond its range; valid manual values survive saving and reopening. Invalid geometry, machine limits and generation budgets produce errors instead of silently changing the requested value.

## Local files

G-code names describe the design, preset, actual exported dimensions, relevant settings and print setup. Long suggestions retain a compact settings identifier so two different
designs do not acquire the same shortened name; the G-code header keeps the complete settings. Full-panel names
include texture repeat and backing spacing, and describe their single-filament output. Imported SVG designs also export at the selected document dimensions.

To count designs and settings in a folder of automatically named exports, run:

```bash
node tools/tally-exports.mjs "C:/Users/me/Downloads"
node tools/tally-exports.mjs "C:/Users/me/Downloads" --json
```

This local tally reads filenames and sends nothing to a server. Renamed files may not be recognizable. For online
anonymous export and build-failure statistics, see [STUDY_SETUP.md](STUDY_SETUP.md). Collection stays off until the
Cloudflare database and enable flag are configured; visitors then see a notice above Export. Download error log saves
recent failures and the current design locally, including any drawing, so share that file deliberately.

The original printer samples now live in ignored `reference/local-samples/`. They are retained as profile provenance, outside the deployable source. There were no STL files in this project. Engine modules, tests, vendored preview code and reference documentation remain in use.

## First prints (spec section 9)

1. Choose a 30 × 30 mm test swatch, Advanced settings → What to print → untick "Print the loops": base only. Check adhesion,
   flow and corners.
2. Custom size 30 × 15 mm, base and loops on, Loops at the back edge → **Inside the swatch**: exactly one row of
   loops. Check that the feet bond and the unsupported strands hold their height.
3. The 30 × 30 mm swatch with the defaults: compare the tight-spot markers with real collisions.
4. A 100 × 100 mm swatch.

Filaflex Foamy 95 values come from the maker's guidance and have not been printed here yet; change flow, temperature and the unsupported
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
| `profiles/machines/`, `profiles/materials/` | Printers and filaments: this tool's JSON, or a PrusaSlicer / Bambu Studio export dropped in as it is (see `profiles/README.md`) |
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

## Brim

Brim is available in **Size and shape** for every design, including imported SVG outlines. It prints once on the
bed before the fabric: two adjacent runs by default, overlapping by 20% of the configured extrusion width. Runs
sit inside the selected outline, including hole edges, so the chosen dimensions stay unchanged. Set Brim to 0
to turn it off, or type an exact count up to 50. Short connections join exposed fabric ends where needed; complete
motifs and native raised paths keep their geometry. Very narrow outline features may accommodate fewer runs.

## Extra layers

Printer setup shows the original pass count, the extra passes and their total. **0** keeps the original design.
A one-pass pattern alternates with a regenerated 90° pass that fills the same outline, including rectangular
pieces and SVG holes. Multi-pass patterns continue their original order: A/B plus one extra becomes A/B/A.
Added paths follow the actual native heights and lift at crossings to stay bonded. The imported SVG paths and
brim print once. For raised designs, extra passes reinforce the bottom backing, while the raised texture prints
once above it with its original height and density. The readout shows backing counts separately. Counts above
the slider's 0–10 range can be typed, up to 250, subject to the
normal geometry and move budgets. Old saved whole-copy counts migrate using the selected design's native passes.
Exported settings and anonymous study records include original, extra and total pass counts. These are logical
pattern passes: local crossing lifts can make the finished fabric taller than the count times the layer height.

## Open requests

A PrusaSlicer-sliced `.gcode` made with **Filaflex Foamy 95** (not Generic FLEX) on the MK3S would let the Foamy
values be checked against a real profile; the MK3S machine and Generic FLEX values already come from the sample
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
