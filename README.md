# Fashion Printing Tools — Textile G-code Generator

A browser-based toolbox that generates direct G-code for experimental non-planar FDM textile: a crossed supporting
base plus a dense pile of raised, anchored 3D loops. First target: Prusa MK3S, Filaflex Foamy 95, a 100 × 100 mm
sample. Machine and material profiles are data files, so more machines can be added from G-code you share.

**Status:** the generator and the studio are built for the Prusa MK3S, with thirty-one structures (thirty-two tiles, with the Advanced zigzag mesh preset) (Zigzag mesh, Loop pile, Squiggle &
Gyroid, Advanced zigzag mesh, Drawing & infill, Halftone net, Spacer net, Pillar weave, Coil, Weave, Spiral panel, Bouclé & picots, Relief, Fringe, Crosshatch & isogrid, Auxetic mesh, Dip weave,
Spiderweb, Ring mail, Meander, Harmonograph, Truchet tiles, Voronoi lace, Turing stripes, Conformal mesh, Sunflower, Rosette,
Flow lines, Bubbles, Parquet, Spirograph, Star lattice), a strand-shape and pattern library,
and the automated tests passing. See `docs/fabric-structures.md` for the library.
The first physical print has not been done yet, so start with a small test swatch.

**Live site:** https://filafabric.pages.dev (Cloudflare Pages publishes every push to `main`; nothing to install).

## Whole repeats at the edge

A swatch is sewn or welded to the next piece, so a pattern meets the edge at the end of a repeat, never part-way
through one (`site/src/engine/repeats.js`). The wave length, line spacing, tile or cell size you set is a target: the
pattern uses the nearest size that fits a whole number of times (9.6 zigzags in 100 mm become 10 of 10 mm), its lanes
run from one edge to the other, and cells are whole: bubbles and chainmail rings
sit inside the edge, Voronoi cells are closed by a wall along it, Truchet and basket blocks fill the swatch, star
lattices meet the edge on a line of symmetry. A pattern that meets a straight edge at a slant (a 45° hatch, a
herringbone, a radial web or rosette) cannot end on a whole repeat, and is cut there as before.

Wavy lanes (the Zigzag mesh, the backing mesh, the wavy backings; `site/src/engine/wavegrid.js`) lie half a spacing in from
the edges they run along, as if the swatch were cut from a larger piece: a piece above or below carries them on at the
same spacing, and a wave that swings past the edge is cut by it, so the top and bottom meet the pattern the way the
sides do. (Until 21 October 2026 the outermost lines were kept a full swing in, which left a row of open notches
along the top and bottom deeper than the cells inside.)

## Demo prints

`node dev/tools/export-demo-prints.mjs` writes twenty small swatches (60 × 60 mm, or `--size=80`) to `local/demo-prints/`, easiest
to hardest, numbered 01 to 20 so they can be laid out in order. Each file name is the number, the design, the preset it
started from, the size and the values of its settings; the first lines of the file repeat them, and `INDEX.md` lists what to
look at in each. The folder is git-ignored: the files are made on your machine.

## The password gate

The studio opens on a "Coming soon" page that says what it is and asks for one password (no username). Only a salted hash of the
password is in the repository (`site/src/ui/gate-config.json`); the studio itself is loaded only after the password is right.

```bash
node dev/tools/set-password.mjs                  # a new random password, printed once
node dev/tools/set-password.mjs "a longer phrase"  # or choose your own (8 characters or more)
```

Then commit `site/src/ui/gate-config.json` and push. **This is a soft gate**: the site is static, so anyone who knows the file
names can still download the studio's code. It keeps casual visitors out; for real access control put the site behind
Cloudflare Access (free for small teams) instead of, or as well as, this page. *Lock the studio* in the ⋯ menu locks this
browser again.

**Opening the gate for a while:** `"open": true` in `site/src/ui/gate-config.json` lets everyone straight into the studio, with no
password page and no lock in the menu. The password stays set: delete the flag, or set a new password with
`node dev/tools/set-password.mjs` (which writes the file without it), commit and push to close the gate again. The gate is currently
closed and uses the existing password hash.

## Feedback

*Feedback* in the top bar opens a short form with three choices: what works and what doesn't, a pattern request, or a
problem report. Messages go to the Formspree form `https://formspree.io/f/xeaevvbn` (set in `site/src/ui/feedback.js`), which
emails them; a reply address is optional, and Formspree makes it the reply-to. The form sends text only (no file uploads,
which Formspree charges for), so a pattern request offers *Email it with your picture* instead: a mailto to bubakidesign@gmail.com with the description
filled in. A problem report (also opened by *Report this problem* when a design can't build) carries the recent error
history and the current settings, shown in full before sending; never the drawing. These messages are separate from the
anonymous export statistics in `docs/STUDY_SETUP.md`.

## Privacy notice

The site sets no cookies and loads nothing from other sites (its font, Instrument Sans, is served from
`site/vendor/fonts/instrument-sans/` under the SIL Open Font License). A first visit shows a short *Cookies and privacy* notice
(`site/src/ui/privacy.js`): it says what stays in the browser and that exports are counted anonymously, opens the same details in a dialog inside the studio (there is no public page for it, so a search engine cannot find it)
and links to the feedback form, and *Don't count my exports* turns the statistics off for that browser. ⋯ › *Privacy and
cookies* brings it back. Bump `PRIVACY_VERSION` there to show the notice again to everyone after changing what is counted.

## Check the geometry: Fix it

When the fabric check finds a problem (pieces that don't touch, strands steeper than 25°, strands leaving the outline,
or crossings under a strand already printed), the summary says so in plain words and offers *Fix it*
(`site/src/ui/fix-geometry.js`). It builds up to 14 variants in the background worker, each moving one of the design's own
sliders a little, then more, then several together, and applies the first one after which the check passes, as one step
that Undo takes back. Changing any setting, or *Stop looking*, ends the search.

## Patterns and your picture

Every design with a pattern (Squiggle & Gyroid, Loop pile, Coil, Bouclé, Relief, Meander, Voronoi lace, Flow lines,
Bubbles, Halftone net and Star lattice) offers **Your picture** next to its built-in patterns. One picture is shared by all
of them: load it once (choose it, or drop it on the pattern picker) and any of those designs can use it with one click.
It is laid over the whole piece, a preview corner or an export takes its part of it, and its tones are stretched to its
own darkest and lightest (`site/src/engine/picture.js`), so a flat photo still uses the whole range. The design's own sliders
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
**60 mm** (`BRANCH_GAP` in `site/src/engine/fill.js`) the nozzle jumps the gap and carries on along the row, so both sides grow
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
node dev/tools/audit-printability.mjs # regenerate the default-swatch gallery ranking
npm run golden    # re-record the 20 x 20 golden summary after an intended engine change
```

In the page, work left to right: pick a **design**, shape it with the **settings** on the right (a width and height,
or an **SVG outline** to fill; then a few sliders, and you can click a slider's value to type an exact number), and
read the **print summary** at the bottom of the
settings: a check (amber with an "Add room" fix when loops are tight), print time, filament, and one **Export** button. Every design starts at **100 × 100 mm**; saved custom dimensions remain available.
In the structure library, choose **All**, **Flat**, **Layered** or **Raised** and use the name search to narrow that list. **All** includes experimental designs.
Under **⋯ → Appearance**, choose Violet, Graphite, or Terracotta, or let **System** follow your device. The choice stays in this browser.
**Outlines:** drop an SVG under Size and shape (paths, polygons, rectangles, circles and ellipses, with curves and
transforms; text must be converted to paths). The shape fills both designs: holes stay open (even-odd), concave
parts print as separate strands instead of across the gap, and "Match its shape" sets the height to the outline's
proportions. Rotate it with the slider. The outline travels in share links and settings files; scripts and links
inside the SVG are stripped before it is read.
For an SVG with color regions, **Outside outline** in **Size and shape** adds first-layer lines around the included shapes. Select a color in the preview to open **Drawing colours**, where a pattern color can use the default outline or set its own width and placement. Only one inspector section stays open at a time. **Apply** reuses the current build and marks colors applied when their toolpath is ready. Build progress appears at the top of the preview.
SVG cutouts are included on import. Their rims print on the surrounding material and around any islands inside the opening. **Hole rim width** in **Drawing colours** uses the SVG stroke when left blank, or one pass for a shape with no stroke. Set it to 0 to keep the cutout open without a rim.
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
Small-design 3D previews open on the strands at their true thickness. Drag to turn, scroll to zoom, or use the camera menu
on the preview to choose **Top**, **Angled**, **Side** or **Fit piece**. The expand button opens fullscreen in browsers
that support it. Press play to watch the print order. The **View** menu adds the nozzle path, travel moves, lifts, exaggerated
height and the red tight-spot marks (the clearance model's moves that come too close to printed strands; "Show
where" in the check turns them on too). For the loop pile, everything else lives under Advanced settings (38
settings in groups that show what you changed). The page always opens on the Zigzag mesh (what was set in the other
designs is kept for when you choose them; a shared link opens the design it was made from). The printer chip in the
header opens the printer setup: printer, filament, **layer thickness** and **Extra layers**. Search the Prusa profiles or choose the experimental **Anycubic Kobra 3 Max V2**. Settings sections start folded under a title
and a summary of their current values. Open a section to see its cards or sliders; choosing a card keeps the section
open. Option and preset pictures use the same line colours as the preview. **Reset** in Parameters restores the current
design's defaults. The **⋯** menu has Getting started and Save/Open settings file. Download error log appears after a build error.
Undo/redo and **Share** (a link that
reopens the design and its settings) work for every design. Every exported file records its full parameter set
and seed in comment lines.

## Printers and filaments

The public studio uses the curated printer catalogue in `site/src/ui/main.js` and the filaments in `site/profiles/materials/`. Printer and filament file upload is paused. Maintainers can still use the profile importer in development with these files:

| Export | What it gives |
|---|---|
| PrusaSlicer config (`.ini`, `File > Export > Export Config`), or a bundle | A printer and a filament per section, named as in the slicer |
| A `.gcode` PrusaSlicer sliced | The config it carries at the end of the file |
| Bambu Studio / OrcaSlicer preset (`.json`) | A printer or a filament |

Bed size, nozzle and filament diameter, temperatures, flow, retraction, machine limits and start/end G-code are read; the slicer's own start and end G-code is kept where its placeholders can be filled and the rest is left out, with a note saying so. Run `npm run profiles` after adding or removing a bundled file to refresh `site/profiles/index.json`; the local server does it on the fly. See the [printer profile notes](site/profiles/README.md) for the Anycubic test setup.

The bundled filament choices include **NinjaTek NinjaFlex 85A (Midnight Black)**, **Generic TPE Flexible**, and
**Generic PLA**, alongside the existing Filaflex and Generic FLEX profiles. These use PrusaResearch 2.5.12's
classic MK3 / 0.4 mm reference settings. Generic TPE is a labelled Generic FLEX starting point for an unspecified
spool; PLA is rigid. [Material sources and adaptations](site/profiles/MATERIAL_SOURCES.md) record the pinned upstream
revision and how cooling is mapped to this tool's path roles. First-layer heat is retained through bed extrusion;
the printing temperature is sent once extrusion rises above the bed layer, including streamed exports.

**Temperatures and retraction** in the printer setup show the chosen filament's nozzle temperature (first layer and
the rest), bed temperature, retraction length and speed, the extra push after a travel, the seam gap and the lift on a
travel, and can be changed there (`site/src/ui/filament-settings.js`). A change is kept with the print setup (undo, links,
saved files) and only for that filament: choosing another starts from its own values, and *Use the filament's values*
undoes it. Retraction applies before every travel the filament's `min_travel` allows; after it, the filament is pushed
back the same length plus its `restart_extra` (PrusaSlicer's *extra length on restart*, read from imported slicer
files). A travel lifts the filament's `z_hop` over the highest thing printed so far (3 mm when it sets none), at its
`travel_speed_hint` (150 mm/s when it sets none; a design's own travel speed wins), and a closed loop stops its
`seam_gap` short of its own start before a travel (`site/src/engine/emit.js`).

**Filaflex 95A Foamy prints at 238 °C, retracts 1 mm at 40 mm/s before every travel, however short, pushes the same
1 mm back at 20 mm/s, lifts 0.2 mm on a travel at 180 mm/s, and stops each loop 0.2 mm short of its start** (from 21
October 2026). That is the cleanest of a full-bed seam test printed on the MK3S (`FOAM99_45PAIRS`: 45 pairs of 20 mm
two-line circles, all with the 0.2 mm lift at 180 mm/s): 238 °C was the cleanest row, 1 mm (and 2.5 mm) at 40 mm/s
the cleanest retraction, 75 mm/s lost circles, and a 0.2 mm seam gap looked good (at 245 °C). Before it, 4 mm at
65 mm/s, 4.2 back, a 3 mm lift and 248 °C left a knot and a string at every seam; 2.5 out and 2.5 back started thin for
6 cm after a travel, and 6 out and 7 back left a blob. 238 °C is below Recreus's 248 °C, so the foam rises a little less:
check a swatch's width and weight. Circles at the very edges of that bed (it ran from 5 to 245 mm) printed dashed
whatever their settings: keep test prints in the middle of the bed.
`node dev/tools/export-retraction-test.mjs` writes six 50 × 30 mm Zigzag mesh swatches, A to F (3, 4 and 5 mm, each with
no extra and with 0.2 mm), to `local/demo-prints/retraction-test/` with an `INDEX.md`: one print with all six on the
bed (A B C in front, D E F behind, each printed whole with its own retraction and marked by one to six short bars at
its left), and each on its own. A move may carry its own retraction for this (`m.retraction`, read by the G-code writer
and the statistics); the move between two swatches retracts and primes with the settings of the one it leaves
(`dev/tools/plate.mjs`). The swatches look much alike, as the difference is only where a strand starts and stops, so
`node dev/tools/export-seam-test.mjs` writes one print where that is all there is: circles of 20 mm, each a two-line brim
as the studio prints one (two loops overlapping 20%, first layer only, each starting and closing on one spot), to
`local/demo-prints/seam-test/` with an `INDEX.md`. A first version (nine blocks: 0.1–0.3 mm extra push, 15–40 mm/s
push-back) showed the same knot and strings at every seam whatever the push, a little worse at 40 mm/s; so it is now
twelve pairs, each changing one thing from the filament's own settings: the lift on a travel (0.2 mm, Recreus's z-hop,
and 1 mm against the usual 3), the retraction (2.5 and 5 mm), its speed (40 and 90 mm/s), no extra push, the two loops
joined into one strand, and the temperature (243 and 238 °C, waited for with `M109 R`, and 238 °C with the 0.2 mm lift).

## Printable SVG and garment panels

**Import SVG** sits above the pattern settings. No drawing to hand? `site/samples/filafabric-sample.svg` is a 200 × 200 mm
sample with the main colours in it (red shapes to fill, a blue star cut out of one, green solids, wide red lines), and
`site/samples/lace-sample.svg` is a 170 × 110 mm lace medallion drawn with the lace rules below: the import
card offers to try it in one click or to download it and open it in Inkscape or Illustrator to see how it is set up.
Every design takes a drawing and fills its red shapes with its own pattern; **Drawing & infill** is the one for a
drawing on its own, its red shapes filled with a slicer infill pattern (gyroid, honeycomb…) instead, or only outlined.
It is out of the gallery for now (`hidden: true` on its card, from 21 October 2026); links and saved files still open it.
Colour and stroke width say what each part of the drawing does, and the import card says it too, under **How a drawing
prints** (`DRAWING_GUIDE` in `site/src/ui/panels.js`, in every design):

| In the drawing | What it prints |
|---|---|
| A closed shape in pure **red** (`#ff0000`) | Filled with the pattern |
| A closed shape in pure **blue** (`#0000ff`) | Left empty: a hole |
| A closed shape in pure **green** (`#00ff00`) | Printed solid: a coil if it is round, a zigzag otherwise, two layers, 20% overlap |
| A closed shape in pure **yellow** (`#ffff00`) | For now printed solid, exactly like green. (Yellow will later carry the conformal mesh guides that bend the pattern; that machinery is kept, switched off by `YELLOW_PRINTS_SOLID` in `site/src/engine/drawing.js`.) |
| Shapes inside shapes | **The innermost shape decides** what prints in each place: red the pattern, blue nothing, green solid. Blue inside red cuts a hole in the pattern; red inside that blue is pattern again; green inside red is a solid on top of the pattern (a button) |
| A lace | A green outline is the solid lace body; draw its openings inside it in blue and its patterned parts in red. The body lies on the bed round them and prints layer by layer with a flat pattern, as a slicer would: the body's first layer, the pattern's first, the body's second, the pattern's second; the pattern fills the red windows; a green shape inside a window is solid again, on top, last. With no red at all, the piece is the solid alone (no pattern, no brim) |
| A shape that is not closed (a red line, for example) | Never filled; it is a line, printed as drawn at its stroke width |
| Any open path, or a closed shape in another colour | A line, printed as drawn |
| A line's stroke width | The number of passes: width ÷ extrusion width, rounded, at least one. A line as wide as the nozzle is one pass; a 0.8 mm line is two passes side by side and a 1.2 mm line three |

The drawing's lines print first, on the first layer. A flat pattern keeps its own layers with a drawing: its first lies on the bed beside the lines (lifting over a line where it crosses one, and finishing on the edges it meets), its second one layer up; a raised design stands on the lines' layer. (Before 21 October 2026 every layer of a flat pattern was put at one height, a layer above the lines.)

Colour comes from the fill, or from the stroke when the fill is `none`; the stroke width of a red or blue shape is only a marker. Physical document dimensions, margins and transforms are retained; resizing the design scales the drawing (and its line widths) too. A drawing that carries no colours at all (an older saved file) keeps the previous rule: closed paths are shapes and shapes inside shapes alternate fill, hole. **Fill its shapes with this pattern** cuts the pattern to the red area, less the blue holes in it. Save/Open settings includes the imported paths and their colours; share links omit them to keep links small. `dev/tests/fixtures/red-blue-lines.svg` is a small example of all of this.

**3D** tries the complete selected piece at its actual print settings in a cancellable worker, including pieces larger than 250 mm when the selected printer can fit them. There is no automatic 100 mm crop, 250 mm cutoff or 400,000-move ceiling in this mode. The shared full-toolpath move, loop/hair and default crossing-count ceilings are removed rather than raised to another arbitrary number. Available browser memory and JavaScript's actual array capacity still apply; independent algorithm-specific validity and input-format guards remain. A change to settings or view stops the previous preview build. Choosing 3D explicitly keeps any failure visible rather than silently reducing settings.

**2D** draws the complete piece from above: its outline, holes and drawing strokes, and the texture **at the size it prints**, with strands at their real width and a scale bar for judging loop and cell sizes. Oversized imported artwork can still be inspected in this mode, but cannot be exported on a smaller printer. The texture is built in a cancellable worker without print planning or G-code. Only when a design cannot build the whole piece at once (its own limits, for example more than 8,000 bubbles) or the drawing would pass four million points is the pattern drawn larger, and a banner on the drawing says by how much (src/engine/overview.js, OVERVIEW_FACTORS). Lines are never dropped. The outline appears immediately; changing a setting keeps the zoom and the previous texture until the new one arrives, and only a new piece size fits the view again. **Fit piece** resets the view; scroll or + / − zoom about the pointer (up to 40×), drag or arrow keys pan, and 0 fits it. The hidden 3D renderer pauses and releases its previous geometry.

**Print order in 2D:** the picture appears at once, and the whole piece's G-code is built behind it, the same build Export uses (so Export then saves it without waiting, and time and filament appear). When it is ready the play button and print-order scrubber appear under the picture and draw the toolpath growing over it, on the same pan and zoom: the finished picture steps back while the print is partly shown, and a dot marks the nozzle (src/engine/trace.js). Until then the bar says it is building. **Export SVG** (next to Fit piece) saves the finished top view at true size: millimetres, the back of the bed at the top, one path per strand role (and preview colour) at the width it prints, plus the outline. It leaves out heights and layer order, travel moves and lifts, speeds, flow and colour-change pauses.

**Sizes follow the nozzle.** A size that counts in beads (ring, cell and tile sizes, pitches, wavelengths, necks and walls) has a minimum written as a number of bead widths, so a finer nozzle can go smaller: the shipped minimum holds for the 0.4 mm nozzle (0.45 mm bead), and the slider ends move with the bead width the printer and filament give (half for 0.2 mm, a third more for 0.6 mm). The floor, for the finest 0.2 mm nozzle, is checked to build a connected, exportable fabric (src/ui/nozzle-limits.js, dev/tests/nozzle-limits.test.js). A filament that sets its own bead width (Foamy: 0.42 mm) keeps it until a measured flat bead width is entered in Printer setup. A typed value below the end is still used, with a warning.

**3D sample** is a separate, explicitly selected bounded detail view, normally 100 × 100 mm, for inspecting texture and print order. 2D is a composition preview, **not a toolpath or printability check**; it does not report sample estimates as full-garment print time or filament. Manual width/height edits have the selected printer's real bed dimensions as hard maxima; rejected sizes are not applied and disable Export until corrected. Overhanging loops reserve the necessary depth. Imported files or saved settings that exceed the bed remain viewable, with a clear warning and Export disabled until the size or printer is corrected. Nothing is silently shrunk.

Switching to 2D retains any whole-piece time/filament estimate already worked out for the exact current settings, and keeps a finished 3D build's G-code for Export. If only a 3D sample has been built, its figures remain labelled **Sample**, with the sample dimensions, and are never extrapolated to the whole garment. Otherwise the summary says plainly that a drawing has no print time and offers **Generate G-code for time and filament**: the real full-size toolpath, built in the background without loading the 3D meshes. The G-code it makes is kept for those exact settings, so **Export saves it straight away** instead of building it again; changing any setting or the printer drops it and the old figures. Estimates still ignore acceleration.

**Export** saves the selected design at its chosen dimensions and settings directly. It never substitutes the preview dimensions or repeats a smaller motif. Full-size generation runs in a worker, and machine limits or generation budgets produce an error rather than a smaller file. Seeing a large piece in the preview does not bypass physical bed limits. Repeating garment panels, calibration bundles and print worksheets are hidden from the public studio while their workflows are being reviewed. The source and licence link remains under **⋯ → Tools and information**.

The gallery lists estimated easier prints first, using the default 100 mm geometry: connection faults, unsupported spans, slopes, starts and loop-pile clearance flags. This is a comparative screen, not physical qualification. Details show the actual geometry and between-path travel for the current settings. Flat patterns start near the lower-left corner and choose the nearest remaining endpoint or closed-loop seam within each pass; raised pile and fringe preserve safe row order. Short structural ties connect isolated motifs, and crossing heights follow the previously printed material.

Spacing sliders reach 0.8 mm. Click any slider value to enter an exact value beyond its range; valid manual values survive saving and reopening. Invalid geometry, machine limits and generation budgets produce errors instead of silently changing the requested value.

## Local files

G-code names describe the design, preset, actual exported dimensions, relevant settings and print setup. Long suggestions retain a compact settings identifier so two different
designs do not acquire the same shortened name; the G-code header keeps the complete settings. Full-panel names
include texture repeat and backing spacing, and describe their single-filament output. Imported SVG designs also export at the selected document dimensions.

To count designs and settings in a folder of automatically named exports, run:

```bash
node dev/tools/tally-exports.mjs "C:/Users/me/Downloads"
node dev/tools/tally-exports.mjs "C:/Users/me/Downloads" --json
```

This local tally reads filenames and sends nothing to a server. Renamed files may not be recognizable. For online
anonymous export and build-failure statistics, see [STUDY_SETUP.md](docs/STUDY_SETUP.md). Collection stays off until the
Cloudflare database and enable flag are configured; visitors then see a notice above Export. Download error log saves
recent failures and the current design locally, including any drawing, so share that file deliberately.

The original printer samples now live in ignored `local/printer-samples/`. They are retained as profile provenance, outside the deployable source. There were no STL files in this project. Engine modules, tests, vendored preview code and reference documentation remain in use.

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

## Project layout

| Folder | What it holds | In git | Served by the website |
|---|---|---|---|
| `site/` | The website: pages, `src/` (engine and UI), `profiles/`, `vendor/`, `samples/`, `functions/` (study API) | yes | yes: Cloudflare serves this folder |
| `dev/` | `tests/`, `tools/` (local server, snapshot and export scripts), `migrations/` (study database), `templates/` | yes | no |
| `docs/` | Project documents, specs and plans, reference notes, study setup | yes | no |
| `research/` | `reports/` (pattern research and the library plan), `implementation-pack/` (handbook, tickets, review), `papers/` (source PDFs) | reports and pack yes; papers no | no |
| `local/` | Demo prints, printer samples, personal test files | no | no |
| `_to-delete/` | Leftovers waiting to be checked and deleted | no | no |

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
| `docs/reference/research-notes-2026-10-14.md` | MK3S limits, PrusaSlicer Generic FLEX values, Recreus Foamy parameters, sources |
| `docs/reference/line-algorithms-for-fabric-2026-10-14.md` | Research: which plotter line styles can become two-layer printed fabric, with a recipe for layer 2 and the next three designs to build |
| `docs/reference/g-code-analysis-2026-10-14.md` | What the user's own MK3S G-code and Bambu A1 mini 3MF contain (verified values, start/end blocks, Bambu notes) |
| `local/printer-samples/Shape-Box_0.2mm_FLEX_MK3S_5m.gcode` | The user's sliced MK3S sample (PrusaSlicer 2.9.6, Generic FLEX): ground truth for the MK3S profile. **Local only, not published** |
| `local/printer-samples/bambu lab a1 mini.gcode.3mf` | The user's Bambu Studio sample for the A1 mini (future sub-project 5). **Local only, not published** |

Code:

| Path | What |
|---|---|
| `site/index.html`, `site/src/engine/`, `site/src/ui/` | The site and the pure-JS engine |
| `site/profiles/machines/`, `site/profiles/materials/` | Printers and filaments: this tool's JSON, or a PrusaSlicer / Bambu Studio export dropped in as it is (see `site/profiles/README.md`) |
| `site/vendor/three/` | Vendored three.js for the preview |
| `dev/tests/` | `node --test` engine tests, including a golden summary for a 20 x 20 sample |
| `dev/tools/` | Local server, three.js vendoring, golden-file updater |
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
**Extra layers** there. `site/src/engine/backing.js` `addBackingMesh()`.

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
