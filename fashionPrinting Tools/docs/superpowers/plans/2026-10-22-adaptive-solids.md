# Adaptive solids and routing implementation plan

> For agentic workers: execute with TDD, domain ownership and a fresh whole-change review. Scope approved by the user's explicit request to document, implement all suggestions, and commit locally.

**Goal:** Improve solid coverage and print efficiency while retaining FilaFabric's raised two-pass structure.

**Architecture:** A pinned self-contained Arachne WASM kernel supplies only flat wall/core geometry and widths. FilaFabric retains printer configuration, extrusion, travel and nonplanar generation. Routing and calibration are independent workstreams.

**Tech stack:** Existing JavaScript ES modules, Node test runner, Three.js triangulation, upstream WebAssembly.

**Spec:** `docs/superpowers/specs/2026-10-22-adaptive-solids-design.md`.

## Global constraints

- Baseline 74d4e85; only FilaFabric files; local commits, no push or deployment.
- Preserve mesh passes, raised crossings, voids, single solid layer and tested Foamy defaults.
- No silent fallback from requested Arachne; no fabricated physical calibration.
- Include exact pinned vendor provenance, licence and corresponding build sources.

## Review focus

- Reversed variable-flow paths retain the same volume on each physical segment.
- Thin features and holes survive triangulation and adaptive walls without filling windows.
- Layer/row/pause precedence survives ordering; distant peaks do not force unsafe local descents.
- Async initialization and preview/export select the same generator and report errors.
- Calibration survives sharing and applies area correction once, including variable-width paths.

## Tasks and verification ledger

- [x] Vendor and attribute the pinned Arachne build and matching sources; prove the real WASM produces variable widths for a tapered solid.
- [x] Implement and test `prepareAdaptiveSolids()` and `adaptiveSolidPaths(ring, options)`; validate bounded inputs, triangulate holes, extract geometry/widths, preserve narrow features and single vertical layer.
- [x] Integrate adaptive geometry into SVG solid strands, async swatch worker and panel export; emit clear generator metadata, preserve variable flow through existing clipping and ordering.
- [x] Improve same-layer path ordering and seams with flow-correct reversal and dependency barriers; focused travel tests (routing worker owns travel.js, emit.js and fabric.js orderStrands).
- [x] Use local printed-height clearance and boundary-aware selective travel, retaining conservative fallbacks; near/distant raised obstacles and void tests.
- [x] Implement measured-width/flow/flat-speed calibration settings with persistence and volumetric limits; preserve unmeasured defaults (calibration worker owns params/extrusion/profile/UI calibration).
- [x] Run focused then full `npm test`; fresh independent review and fix confirmed findings.
- [x] Generate the requested drawing comparison, independently parse emitted G-code, document results and residual physical validation, commit locally and verify a clean project subtree.

For each implementation task: write a behavior test, observe the expected failure, implement, observe green, then commit its scoped files with verification evidence. Source/build dependencies and classic compatibility are checked before enabling browser Arachne by default. The source archive is offered through the local app; no publication is part of this task.

Ruling: use the existing clean user checkout and scoped commits as in the approved prior task. Do not move or reset the parent repository's unrelated work.
