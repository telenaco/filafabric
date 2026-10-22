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

- [ ] Reproduce boundary joins being removed by later clearance clipping; tests require one continuous strand per mesh pass in an unclipped rectangle, raised crossings retained, holes respected.
- [ ] Clip waves with bead clearance before connecting rows; exact clearance check for new connectors. Pass independent perimeter reserve into basic zigzag generation without refitting its phase.
- [ ] Run focused tests; commit a working routing fix.

## Task 2: Solid perimeters and integration

Files: src/engine/solid-fill.js, svg-solids.js, brim.js, design-export.js, svg-lines.js, panel.js; src/ui/main.js/panels.js/share.js/file-name.js; perimeter tests.

- [ ] Tests first: 0/1/2 contours reserve the solid core, overlap inner contour, retain narrow details, stay on material side of holes, preserve single solid layer and two mesh passes.
- [ ] Generate explicit inside contours with safe offset helper; retain coil fill for round cores and zigzag for other cores. Fall back to existing coverage in narrow regions not reached by the requested inner core.
- [ ] Reuse the existing edge slider with Perimeters label; export canonical count, accept legacy brim input, record effective count and distinguish filenames.
- [ ] Propagate through whole/sample previews and streamed panels; avoid extending mesh back across the reserved band during SVG composition.
- [ ] Independent review, browser verification, full suite, regenerate supplied drawing comparison, final local commit and clean scoped status. No push.

## Ledger

- Baseline 1073b47 is committed and the FilaFabric subtree is clean.
- Root cause: waveLines connects at the geometric outline; layersToStrands subsequently clips at half bead width and cuts off those connectors.
- Existing brim geometry already runs inward; this change reuses it instead of introducing a second offset algorithm.
