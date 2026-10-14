# Coherent Fabric Implementation Plan

**Goal:** Connected, structurally checked textile paths and bounded garment-panel export.

**Architecture:** Shared geometry/contact diagnostics and repair feed the existing generators. A separate panel iterator reuses bounded swatches above a continuous foundation and one stateful G-code writer.

**Tech stack:** Browser ES modules, Node test runner, Web Workers, existing Three.js preview.

**Spec:** `docs/superpowers/specs/2026-10-14-coherent-fabric-design.md`.

## Constraints and review focus

Keep edits inside this project. Preserve separate SVG regions; never bridge a hole or a concavity. Keep settings and exports deterministic. Reject empty or unresolved fabric. No full-panel geometry in WebGL. No firmware-specific commands in the generic profile. Physical qualification remains pending.

- [x] Geometry/contact diagnostics and ties: `src/engine/fabric.js`, `tests/fabric.test.js`. Test two disconnected crosses, collinear/end contacts, Z gaps, and clipping with a hole.
- [x] Ordered crossing support: `crossings.js`, `layers.js`, `emit.js`. Test a third strand crossing an already lifted second strand and travel over an interior peak. Integrate clipping, ties and final diagnostics into all generators; use crossed bases for weak row structures.
- [x] Honest verdicts and all-design audit: registry wrappers, `verdict.js`, `tools/audit-printability.mjs`. Exercise defaults, presets and concave/holed boundaries. Retain meaningful existing tests; update intended golden outputs.
- [x] Stateful G-code writer and panel export: `gcode.js`, `panel.js`, worker, generic gantry profile. Test byte equivalence, bounds, all design families, 1000 mm size, outlines, cancellation and small edge tiles.
- [x] Panel controls, progress/cancel and swatch protocol. Verify browser integration, run the full suite and audit, review changes and document remaining physical tests.

## Execution record

User authorized the complete overhaul with “go ahead do all that”. Execute in this workspace; the user subsequently authorized commit and push to production. Existing unrelated parent-repository edits stay untouched. Each behavior change receives a failing regression before implementation. This file records completed steps and any deviations.


The user added nearest-path routing, printable SVG first layers beneath the selected design, consistent explicit 100 mm defaults, frontend-design UX changes, 0.8 mm spacing, exact manual values, printability ordering and safe root cleanup. Implemented together and reviewed independently. Original ignored printer samples moved to reference/local-samples; no STL files existed.

Validation: every default/preset has exportable connected geometry; crossing/anchor and SVG regressions; 1000 mm bounded streaming; holed/concave panels; cancellation; normal-login browser upload, transformed/open SVG paths, manual settings persistence, swatch/full-panel downloads and mobile layout. Physical qualification remains pending. Full-panel motifs repeat per section and use one filament; these choices are visible before export.

Remote reconciliation preserved upstream machine-fit and performance fixes and the two-column gallery, while retaining explicit 100 mm defaults. Additional regressions cover staggered fringe feet at the edge; spiral normals stop at ridges without diagonal connectors. Presets are checked at both 60 and 100 mm.
