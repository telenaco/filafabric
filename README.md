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

**Opening the gate for a while:** `"open": true` in `src/ui/gate-config.json` lets everyone straight into the studio, with no
password page and no lock in the menu (it is open now, from 21 October 2026). The password stays set: delete the flag, or set a
new password with `node tools/set-password.mjs` (which writes the file without it), commit and push to close the gate again.

## Feedback

*Feedback* in the top bar opens a short form with three choices: what works and what doesn't, a pattern request, or a
problem report. Messages go to the Formspree form `https://formspree.io/f/xeaevvbn` (set in `src/ui/feedback.js`), which
emails them; a reply address is optional, and Formspree makes it the reply-to. The form sends text only (no file uploads,
which Formspree charges for), so a pattern request offers *Email it with your picture* instead: a mailto to bubakidesign@gmail.com with the description
filled in. A problem report (also opened by *Report this problem* when a design can't build) carries the recent error
history and the current settings, shown in full before sending; never the drawing. These messages are separate from the
anonymous export statistics in `STUDY_SETUP.md`.

## Privacy notice

The site sets no cookies and loads nothing from other sites (its font, Instrument Sans, is served from
`vendor/fonts/instrument-sans/` under the SIL Open Font License). A first visit shows a short *Cookies and privacy* notice
(`src/ui/privacy.js`): it says what stays in the browser and that exports are counted anonymously, links to `study.html`
and to the feedback form, and *Don't count my exports* turns the statistics off for that browser. ⋯ › *Privacy and
cookies* brings it back. Bump `PRIVACY_VERSION` there to show the notice again to everyone after changing what is counted.

## Check the geometry: Fix it

When the fabric check finds a problem (pieces that don't touch, strands steeper than 25°, strands leaving the outline,
or crossings under a strand already printed), the summary says so in plain words and offers *Fix it*
(`src/ui/fix-geometry.js`). It builds up to 14 variants in the background worker, each moving one of the design's own
sliders a little, then more, then several together, and applies the first one after which the check passes, as one step
that Undo takes back. Changing any setting, or *Stop looking*, ends the search.

## Patterns and your picture

Every design with a pattern (Squiggle & Gyroid, Loop pile, Coil, Bouclé, Relief, Meander, Voronoi lace, Flow lines,
Bubbles, Halftone net and Star lattice) offers **Your picture** next to its built-in patterns. One picture is shared by all
of them: load it once (choose it, or drop it on the pattern picker) and any of those designs can use it with one click.
It is laid over the whole piece, a preview corner or an export takes its part of it, and its tones are stretched to its
own darkest and lightest (`src/engine/picture.js`), so a flat photo still uses the whole range. The design's own sliders
set the range (loop size, line thickness, cell size); the picture says where in it each place falls.

Each design reads it one way, set by `picture: 'positive'` or `'negative'` on its pattern control. They are all positive
for now: **dark is more**, as with ink. Fuller loops (Coil, Bouclé), a taller pile (Loop pile), the strand rising (Relief),
denser dots (Meander's stipple tour), smaller cells and bubbles (Voronoi lace, Bubbles), thicker lines (Halftone net),
sharper stars (Star lattice: each tile takes its own contact angle), and Flow lines turning one way. The picture never
travels in a share link or a saved file; reopened without it, a pattern set to it goes back to the design's default.
The repeating garment panel does not use the picture yet. Designs whose geometry cannot show a gradient have no pattern.

## Print order: row after row

Lines laid in lanes (the squiggle, coil, zigzag, crosshatch and the other hatched designs) print the way a person would lay
them: each layer from its bottom-left corner (vertical lines from the left), row after row, each row the opposite way to
the one before, and every piece of a row before the next row. Where the outline cuts a row with a gap narrower than
**60 mm** (`BRANCH_GAP` in `src/engine/fill.js`) the nozzle jumps the gap and carries on along the row, so both sides grow
together; a wider gap splits the piece into branches, and the branch being printed is finished before the next one starts
(where branches join again, the joined part comes after all of them). The strand ordering keeps that order instead of
reordering lines for less travel, because the order is what keeps the texture even; an imported drawing's own lines are
still ordered for the least travel, before the pattern.

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
Small-design 3D previews open on the strands at their true thickness; drag to turn, scroll to zoom, use Top / Angled / Side,
and press play to watch the print order. The **View** menu adds the nozzle path, travel moves, lifts, exaggerated
height and the red tight-spot marks (the clearance model's moves that come too close to printed strands; "Show
where" in the check turns them on too). For the loop pile, everything else lives under Advanced settings (38
settings in groups that show what you changed). The page always opens on the Zigzag mesh (what was set in the other
designs is kept for when you choose them; a shared link opens the design it was made from). The printer chip in the
header opens the printer setup: printer, filament, the **layer thickness** (suggested buttons plus an imported print preset's exact height) and **Extra layers**. Printer search starts with two suggestions and includes the Ender-3 family; typing searches all profiles. Imported print defaults follow the selected printer/nozzle. Sample `.ini` and `.json` downloads and [import requirements](profiles/README.md) are linked in Printer setup. Settings sections start folded under a title
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

**Temperatures and retraction** in the printer setup show the chosen filament's nozzle temperature (first layer and
the rest), bed temperature and retraction length, and can be changed there (`src/ui/filament-settings.js`). A change is
kept with the print setup (undo, links, saved files) and only for that filament: choosing another starts from its own
values, and *Use the filament's values* undoes it. Retraction applies before every travel the filament's
`min_travel` allows. **Filaflex 95A Foamy retracts 2.5 mm at 75 mm/s before every travel, however short** (from 21
October 2026; it had retraction off): the low end of Recreus's 2.5–6 mm, and Prusa's NinjaFlex length.

## Printable SVG and garment panels

**Import SVG** sits above the pattern settings. No drawing to hand? `samples/filafabric-sample.svg` is a 200 × 200 mm
sample with the main colours in it (red shapes to fill, a blue star cut out of one, green solids, wide red lines), and
`samples/lace-sample.svg` is a 170 × 110 mm lace medallion drawn with the lace rules below: the import
card offers to try it in one click or to download it and open it in Inkscape or Illustrator to see how it is set up.
Colour and stroke width say what each part of the drawing does:

| In the drawing | What it prints |
|---|---|
| A closed shape in pure **red** (`#ff0000`) | Filled with the pattern |
| A closed shape in pure **blue** (`#0000ff`) | Left empty: a hole |
| A closed shape in pure **green** (`#00ff00`) | Printed solid: a coil if it is round, a zigzag otherwise, two layers, 20% overlap |
| A closed shape in pure **yellow** (`#ffff00`) | For now printed solid, exactly like green. (Yellow will later carry the conformal mesh guides that bend the pattern; that machinery is kept, switched off by `YELLOW_PRINTS_SOLID` in `src/engine/drawing.js`.) |
| Shapes inside shapes | **The innermost shape decides** what prints in each place: red the pattern, blue nothing, green solid. Blue inside red cuts a hole in the pattern; red inside that blue is pattern again; green inside red is a solid on top of the pattern (a button) |
| A lace | A green outline is the solid lace body; draw its openings inside it in blue and its patterned parts in red. The body lies on the bed round them and prints layer by layer with a flat pattern, as a slicer would: the body's first layer, the pattern's first, the body's second, the pattern's second; the pattern fills the red windows; a green shape inside a window is solid again, on top, last. With no red at all, the piece is the solid alone (no pattern, no brim) |
| A shape that is not closed (a red line, for example) | Never filled; it is a line, printed as drawn at its stroke width |
| Any open path, or a closed shape in another colour | A line, printed as drawn |
| A line's stroke width | The number of passes: width ÷ extrusion width, rounded, at least one. A line as wide as the nozzle is one pass; a 0.8 mm line is two passes side by side and a 1.2 mm line three |

The drawing's lines print first, on the first layer. A flat pattern keeps its own layers with a drawing: its first lies on the bed beside the lines (lifting over a line where it crosses one, and finishing on the edges it meets), its second one layer up; a raised design stands on the lines' layer. (Before 21 October 2026 every layer of a flat pattern was put at one height, a layer above the lines.)

Colour comes from the fill, or from the stroke when the fill is `none`; the stroke width of a red or blue shape is only a marker. Physical document dimensions, margins and transforms are retained; resizing the design scales the drawing (and its line widths) too. A drawing that carries no colours at all (an older saved file) keeps the previous rule: closed paths are shapes and shapes inside shapes alternate fill, hole. **Fill its shapes with this pattern** cuts the pattern to the red area, less the blue holes in it. Save/Open settings includes the imported paths and their colours; share links omit them to keep links small. `tests/fixtures/red-blue-lines.svg` is a small example of all of this.

**3D** tries the complete selected piece at its actual print settings in a cancellable worker, including pieces larger than 250 mm when the selected printer can fit them. There is no automatic 100 mm crop, 250 mm cutoff or 400,000-move ceiling in this mode. The shared full-toolpath move, loop/hair and default crossing-count ceilings are removed rather than raised to another arbitrary number. Available browser memory and JavaScript's actual array capacity still apply; independent algorithm-specific validity and input-format guards remain. **Cancel preview** stops it and opens the lightweight view. Choosing 3D explicitly keeps any failure visible rather than silently reducing settings.

**2D** draws the complete piece from above: its outline, holes and drawing strokes, and the texture **at the size it prints**, with strands at their real width and a scale bar for judging loop and cell sizes. Oversized imported artwork can still be inspected in this mode, but cannot be exported on a smaller printer. The texture is built in a cancellable worker without print planning or G-code. Only when a design cannot build the whole piece at once (its own limits, for example more than 8,000 bubbles) or the drawing would pass four million points is the pattern drawn larger, and a banner on the drawing says by how much (src/engine/overview.js, OVERVIEW_FACTORS). Lines are never dropped. The outline appears immediately; changing a setting keeps the zoom and the previous texture until the new one arrives, and only a new piece size fits the view again. **Fit piece** resets the view; scroll or + / − zoom about the pointer (up to 40×), drag or arrow keys pan, and 0 fits it. The hidden 3D renderer pauses and releases its previous geometry.

**3D sample** is a separate, explicitly selected bounded detail view, normally 100 × 100 mm, for inspecting texture and print order. 2D is a composition preview, **not a toolpath or printability check**; it does not report sample estimates as full-garment print time or filament. Manual width/height edits have the selected printer's real bed dimensions as hard maxima; rejected sizes are not applied and disable Export until corrected. Overhanging loops reserve the necessary depth. Imported files or saved settings that exceed the bed remain viewable, with a clear warning and Export disabled until the size or printer is corrected. Nothing is silently shrunk.

Switching to 2D retains any whole-piece time/filament estimate already worked out for the exact current settings, and keeps a finished 3D build's G-code for Export. If only a 3D sample has been built, its figures remain labelled **Sample**, with the sample dimensions, and are never extrapolated to the whole garment. Otherwise the summary says plainly that a drawing has no print time and offers **Generate G-code for time and filament**: the real full-size toolpath, built in the background without loading the 3D meshes (Stop generating ends it). The G-code it makes is kept for those exact settings, so **Export saves it straight away** instead of building it again; changing any setting or the printer drops it and the old figures. Estimates still ignore acceleration.

**Export** saves the selected design at its chosen dimensions and settings directly. It never substitutes the preview dimensions or repeats a smaller motif. Full-size generation runs in a worker, and machine limits or generation budgets produce an error rather than a smaller file. Seeing a large piece in the preview does not bypass physical bed limits. **More → Export repeating garment panel** is a separate advanced tool for repeating texture sections over one continuous crossed backing, with the SVG drawing printed once across the full document. Its sections bound memory, not the physical bed: the **whole panel must fit the selected machine**. Radial motifs repeat per section in that tool. Repeating panels use one filament, support progress and cancellation, and stream to a file in supported browsers with a 128 MB download fallback limit. The generic 1000 × 1000 × 300 mm profile is a template: add your own printer from a slicer export (see *Printers and filaments*) or edit its startup, levelling and priming.

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

## Backing mesh

**Backing mesh**, the last card of every flat design's panel (a lace, the coil, any one-layer pattern), prints a
zigzag mesh under the whole piece first: two flat layers, the second half a wave along so the two cross all along,
lines **3.7 mm apart, 2 mm each way, 6 mm waves** as standard (the Zigzag mesh settings it was tuned with). The design
and the drawing then print as they would on their own, two layers higher; the brim goes round it on the bed. Its three
sliders show while it is on, and *Change colour after the backing* pauses (M600) once the mesh is down, so the design
can be another filament. The setting is shared by every design, like the brim, and travels in links and saved files.
Raised designs (loop pile, relief, fringe, spacer, pillar weave) stand on their own base and do not offer it: use
**Extra layers** there. `src/engine/backing.js` `addBackingMesh()`.

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
