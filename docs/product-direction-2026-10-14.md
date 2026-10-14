# Product direction: a gallery of designs with preconfigured printers

Recorded 2026-10-14 from the user's request. This is a new sub-project (6) that needs its own brainstorm → spec →
plan before any code; v1 (the MK3S loop-pile generator) is the engine and the first design it will host.

## What the user asked for

- Ultimately something like Plotcaster (https://www.plotcaster.com/app/): **designs/tools on the left, the
  configuration of the selected design on the right**.
- **Users should not have to tune the printer.** The printer, material and safe settings are a preconfigured setup
  for the particular printer; people just choose a design and adjust a few creative controls.
- Start with **one design** (the loop-pile textile) and **add more designs to the left over time**.
- Reference for the wider family of tools: https://drawingbots.com/knowledge/tools/

## What Plotcaster does (observed 2026-10-14)

| Area | Behaviour |
|---|---|
| Header | Logo, document name, undo / redo, help, a single **Export** button |
| Left column | Input source (Photo / Place), then a **gallery of style tiles with thumbnails** grouped by family (Lines: Sketch, Flow, Scribble, Words, Hatch, Squiggle, …) |
| Centre | Paper preview with zoom, Fit, a View menu; footer status: page size, line count, estimated plot time, ink length |
| Right column | Settings for the **selected style**: 2–3 primary sliders up front, then collapsible groups ("More controls", "Pen and inks", "Photo", "Paper", "Plotter"), each showing a one-line summary of its current value; "Reset all settings" |
| State | Encoded in the URL hash, so a drawing can be shared as a link |

## Where v1 differs

| Today (v1) | Direction |
|---|---|
| All parameters in one long left column, preview on the right | Designs gallery left, preview centre, settings right |
| Machine and material dropdowns are always visible | One curated "setup" per printer, collapsed by default; the full form becomes an advanced/expert view |
| Raw parameter names and many controls | Plain-language primary controls (pile density, loop height, base openness) with the rest under advanced groups |
| No sharing | State in the URL hash, shareable link |
| One design hard-wired | Designs registered as plug-ins |

## Proposed shape (to be validated in the brainstorm)

1. **Design registry.** Each design is `{ id, name, thumbnail, primaryControls, advancedControls, generate(cfg) → Move[] }`.
   The engine stays pure and shared; the loop-pile textile is design number one. Future designs could be fiber
   variants, an interwoven single-path weave, an SVG silhouette fill with rotate-to-fit, and other patterns.
2. **Printer bundles.** A bundle = machine profile + material profile + vetted defaults + clamped parameter ranges
   (e.g. "Prusa MK3S · Filaflex Foamy 95"). Users pick a bundle; bundles are authored from G-code the user shares.
3. **Layout and chrome.** Left: design tiles. Centre: 3D preview with the print-order scrubber, stats footer
   (loops, time, filament, warnings). Right: settings for the selected design. Header: undo/redo, Export.
4. **Shareable state** in the URL hash (design, bundle, parameters, seed).
5. **Safety stays in the engine**: bounds, speed clamps and preflight are not user-tunable per bundle.

## Open questions for that brainstorm

- Which designs come after the loop pile, and which of them need new engine pieces (SVG boundary, interwoven path)?
- How are thumbnails produced (static images or a tiny live render)?
- How are bundles curated and versioned; who may add one?
- What is the minimum set of "primary controls" for the loop pile that still lets people experiment?
- Mobile layout and whether a design can carry its own preview camera/zoom.

## Prior art worth knowing (from the naming search)

DefeXtiles (MIT Media Lab, under-extruded quasi-woven fabric on FDM), Weavecraft (Cornell, 3D weaving design
and simulation), PunchPrint (UCSB, printed base for punch-needle embroidery). None is a plotter-style gallery tool.

## Naming

Candidate names (no product found under these exact names in a quick web search; **domains and trademarks have
not been checked**):

| Name | Why | Caveat |
|---|---|---|
| **Filafabric** (chosen) | Filament + fabric; fits loops now, squiggle/weave and lace designs | Selected by user |
| Meltloom (prior candidate) | Molten filament + loom; fits loops now and weave/mesh designs later; not tied to a printer brand | Check `.com` / `.app` and trademarks |
| Pilework | Names the raised loop pile | Narrower once designs go beyond loops |
| Threadform | Says "thread" and "form" | Generic |
| Fibrecast | Echoes Plotcaster's "-caster" | Too derivative of the reference |
| Selvage | Textile word for the finished edge; distinctive | Obscure outside textile circles |

## Design canvas and preview layers (added 2026-10-14)

A review of v1 and an interactive redesign were made as a design canvas:
https://claude.ai/artifact/1fYdnmtwtvNqobN3NRr5uj (private to the owner until shared). It holds a written review
(ten findings), the current screen annotated, the redesign (try it: camera, layers, playback, test/full swatch,
"Give loops more room"), and a phone layout.

Preview requirements from the user's notes:

| Layer | What it shows | Notes |
|---|---|---|
| **Path** | The G-code centreline, coloured by role (base, anchored, lifting, free-hanging) | Always the exact nozzle route |
| **Strand** | The same route at true thickness (base 0.45 mm, free strand about 0.49 mm once foamed) | Makes near-touching neighbours visible; default leg gap leaves about 0.1 mm of air |
| **Travel** | Horizontal travel moves between strands, at hop height | Dashed |
| **Hops** | The vertical lift and drop at each strand start and end | Separate from Travel by request |

Related measurements for the default full swatch: 568 strands, 567 hops, 3.4 m of travel, about 4 % of print time.
The user's idea of overlapping each loop onto the previous print line (to hop less) is recorded as a planned
"Overlapping line" path option; its main benefit is fewer start/stop blobs and stronger bonds, not speed.

## Built so far (2026-10-14)

The redesign from the design canvas is implemented in the running tool: designs column and printer card on the
left, the preview with Path / Strand / Travel / Hops layers in the centre, and the verdict card, swatch choice,
five sliders and the Advanced drawer on the right, with undo/redo, share link, reset, plain-language field errors
and a phone layout. Not built: a second design, curated printer bundles beyond the two profiles, and the
overlapping-line path (shown as "Planned").
