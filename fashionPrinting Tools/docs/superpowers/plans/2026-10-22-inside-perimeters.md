# Inside Perimeters and Continuous Zigzag Rows

> Execute inline with superpowers:executing-plans; independent code review after implementation.

**Goal:** Try a perimeter count that reinforces solid edges inward and keeps basic zigzag rows connected, without changing the mesh into a single flat layer.

**Architecture:** Reuse the existing safe inward contour generator. Keep the legacy brim field and API compatible, while the UI exports an explicit perimeters option. Dense solids reserve space for the chosen contours, basic zigzag waves receive their clearance before row chaining, and saved state/preview/swatches/panels carry the count.

**Tech stack:** Existing JavaScript modules and Node test runner; no dependencies.

**Spec:** User request in this chat, 22 October 2026: inside perimeters instead of brim; choose their number; continue extrusion from one basic zigzag row into the next; keep one solid layer and both non-planar mesh passes. Existing authorization: local progress commits only, no push.

## Constraints and review focus

- Perimeters count adjacent XY contours, not vertical layers. Default 2; 0 disables explicit contours; accepted 0–50.
- Preserve existing temperature, flow, native layer plans and raised pattern classes.
- Join only inside material with bead clearance; never bridge windows or disconnected islands.
- Collapse narrow offset regions safely; do not remove existing narrow solid fill merely because the requested contour count does not fit.
- Keep legacy brim-only programmatic exports compatible. New UI uses explicit perimeters; old saved brim counts migrate.
- Preview cropping must not invent edges; streamed panels use whole-panel contours once.

## Task 1: Continuous basic zigzag

Files: src/engine/wavegrid.js, layers.js, src/ui/basic-designs.js/more-designs.js; tests/perimeters.test.js.

- [x] Reproduce boundary joins being removed by later clearance clipping; tests require one continuous strand per mesh pass in an unclipped rectangle, raised crossings retained, holes respected.
- [x] Clip waves with bead clearance before connecting rows; exact clearance check for new connectors. Pass independent perimeter reserve into basic zigzag generation without refitting its phase.
- [x] Run focused tests; commit a working routing fix.

## Task 2: Solid perimeters and integration

Files: src/engine/solid-fill.js, svg-solids.js, brim.js, design-export.js, svg-lines.js, panel.js; src/ui/main.js/panels.js/share.js/file-name.js; perimeter tests.

- [x] Tests first: 0/1/2 contours reserve the solid core, overlap inner contour, retain narrow details, stay on material side of holes, preserve single solid layer and two mesh passes.
- [x] Generate explicit inside contours with safe offset helper; retain coil fill for round cores and zigzag for other cores. Fall back to existing coverage in narrow regions not reached by the requested inner core.
- [x] Reuse the existing edge slider with Perimeters label; export canonical count, accept legacy brim input, record effective count and distinguish filenames.
- [x] Propagate through whole/sample previews and streamed panels; avoid extending mesh back across the reserved band during SVG composition.
- [x] Independent review, browser verification, full suite, regenerate supplied drawing comparison, final local commit and clean scoped status. No push.

## Ledger

- Baseline 1073b47 is committed and the FilaFabric subtree is clean.
- Root cause: waveLines connects at the geometric outline; layersToStrands subsequently clips at half bead width and cuts off those connectors.
- Existing brim geometry already runs inward; this change reuses it instead of introducing a second offset algorithm.

## Inside perimeter trial — 22 October 2026

The former Brim control is now **Perimeters** in Size and shape. It selects adjacent outlines inside the material (default 2; typed range 0–50), independently of Solid layers. Opening contours expand into surrounding material. Dense infill reserves the wall band and overlaps its innermost outline. Narrow regions keep contours that fit and bead-safe detail fill where needed. Explicit counts appear in filenames and full/streamed exports; old saved brim counts remain readable.

The basic zigzag now receives bead clearance before rows are chained. Previously it chained at the geometric edge and later clipping removed the turnarounds. A plain 40×30 mm parallel zigzag now has two continuous strands instead of 48, one per pass, including raised crossings. SVG composition preserves the perimeter reserve. Streamed panels rejoin ordered fragments with exact clearance checks, preserve native XYZ and settle added crossings before anchoring.

The supplied 2,019-point outer contour and 56 openings exposed two offset-kernel issues: disjoint pairs spending the interaction budget, and side probes skipping thin intermediate slivers. Both are fixed without increasing safety limits. Final garment generation has no omitted-perimeter or separate-region warnings. Curve simplification is bounded at 0.005 mm and requires full-bead clearance for each replacement segment; only flat contours/solids are simplified before crossing planning.

| Actual emitted body metric | Prusa reference | Final FilaFabric | Original FilaFabric |
| --- | ---: | ---: | ---: |
| Commanded motion, no acceleration/startup | 21.84 min | 30.36 min | 61.81 min |
| Extrusion path | 20.26 m | 24.17 m | 34.97 m |
| XY travel | 6.40 m | 14.20 m | 49.51 m |
| Retraction commands | 0 | 904 | 6,398 |
| Extrusion Z | 0.2 mm | 0.2–0.6 mm | 0.2–0.741 mm |
| Filament per path mm | 0.03429 mm | 0.02471 mm | 0.02471 mm |

Final output retains one solid layer, two selected perimeters and both native mesh passes. It was generated from drawing-2.svg and saved as FilaFabric_drawing-2_perimeters2_solid1_mesh2_170x80mm.gcode beside that SVG, with a copy and comparison evidence in chat outputs. The Prusa reference hash is unchanged.

Prusa's G-code selects Arachne and its WIDTH comments vary: external 0.383–0.618 mm, inner 0.302–0.692 mm. It completes the walls before switching to Solid infill at line 39,178; it does not interleave that dense fill with perimeter blocks. Its infill overlap is 15%. This trial retains fixed 0.45 mm FilaFabric walls with 20% pitch overlap; it does not implement Arachne.

Safe contour simplification reduces final extrusion segments below 0.05 mm from 25,237 to 2,077 (Prusa: 574). Median segment length is 0.360 mm versus Prusa's 0.323 mm. No raised mesh knots are simplified.

The commanded time is an estimate; Prusa's measured approximately 24 minutes includes effects excluded here. FilaFabric still commands about 28% less filament per path mm. Its flow 0.73 and temperature 238 C differ from Prusa's Generic FLEX multiplier 1.15, M221 S95 and 240 C. These material settings are retained; a physical deposited-width/flow comparison is still necessary to establish finishing quality. Physical quality parity is not claimed.

Verification: 922 tests, 911 passed, 11 intentional skips, no failures. Independent reviews and rechecks cover fallback safety, streamed continuity, contour budgets, simplification clearance and metadata. Browser verification exercises Perimeters separately from Solid layers.

Progress commits: c816530 (continuous zigzag), 39a7706 (detailed contour kernel). The final perimeter integration is committed after validation. All work is local; no push.
