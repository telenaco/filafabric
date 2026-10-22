# Remaining Lace Fixes Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, tests before production changes, one independent review at the end.

**Goal:** Finish the remaining verified lace planning fixes with single-layer solid fill by default, adjustable solid thickness, selective retract/lift behavior and reproducible export diagnostics.

**Architecture:** Keep the existing engine and UI. Solid layer count is an independent print setting propagated through preview, full export, streamed panels, saved state and G-code metadata. Short planar travels omit optional hops; required clearance over raised geometry and filament-change pauses remains protected.

**Tech Stack:** Existing browser ES modules, Node test runner; no dependencies added.

**Spec:** User's 22 October 2026 instructions in this chat: implement the remaining fixes, single solid layer, commit progress locally, no push. Earlier lace audit and docs/lace-solid-fill.md provide baseline evidence.

## Global constraints

- Stay in the user's existing checkout and create scoped local commits. Do not push.
- Retain the two-pass zigzag mesh and existing temperature/flow calibration.
- Retain narrow solid details; do not delete slivers for speed.
- Preserve clearance over raised geometry, heights, seam/wipe behavior and balanced retraction.
- Keep timing labeled as commanded motion without acceleration; do not substitute an unvalidated physical simulation.

## Review focus

- Single-layer solids in both flat and raised designs, and streamed panel output.
- Explicit two-layer choice and invalid layer settings.
- Short travel after a seam gap or wipe must start at the actual nozzle position.
- Zero optional hop must not disable required clearance over raised geometry or pauses.
- Saved settings and export metadata must reflect effective values.

### Task 1: Independent solid layer setting

Files: src/engine/svg-solids.js, design-export.js, panel.js; src/ui/share.js, main.js, panels.js; corresponding solid/share/panel tests.

- [x] Add tests: default single layer, explicit two, invalid counts; state round trip; swatch and panel honor the choice.
- [x] Watch the default-count and override tests fail.
- [x] Add solidLayers (integer 1–8, default 1), expose an existing-style number control and propagate it through all paths.
- [x] Verify focused tests and full suite; commit this independently.

### Task 2: Selective travel retracts and hops

Files: src/engine/emit.js, params.js, profiles.js; profiles/materials/filaflex-95-foamy.json; src/ui/filament-settings.js/main.js; emit/retraction/profile/settings tests.

- [x] Tests first: minimum travel 2 mm for Foamy; balanced retract pairs; short flat travel avoids optional lift; elevated obstruction and pause still lift; explicit zero hop is honored; threshold survives saved settings.
- [x] Change Foamy minimum travel to 2 mm and add controllable lift-on-retract-only policy. Preserve other profiles' behavior unless they select it.
- [x] Use actual seam/wipe end for travel distance and start. Keep conservative global clearance where raised geometry exists.
- [x] Run focused tests and full suite; commit.

### Task 3: Diagnostics and final validation

Files: src/engine/gcode.js, stats.js, docs/lace-solid-fill.md; diagnostic tests.

- [x] Tests first: resolved temperatures, flow, retraction threshold and lift policy in header; motion breakdown and print-height summary from generated output.
- [x] Implement diagnostic metadata without claiming acceleration-aware print time.
- [x] Reproduce supplied lace and compare default one-solid-layer versus explicit two with identical mesh and material.
- [x] Browser-check new controls; run full suite, independent review, commit and confirm FilaFabric is clean. No push.

## Execution ledger

- Baseline f32143a was clean and committed before edits.
- Ruling: one solid layer is the new default; two or more remain explicit choices, since the user asked for single infill without removing the mesh structure.
- Ruling: material temperature, flow and motor-current changes require physical calibration and are not included in the software fix.

- Task 1 committed as 6fc3157 after focused and full-suite verification; mesh coordinates remain identical with solid counts 1 and 2.
- Task 2 implements the 2 mm Foamy threshold, conditional optional hops, actual seam/wipe endpoints and mandatory raised clearance. Review regressions cover a wipe landing at the next start and zero-hop solid/native handoff.
- Task 3 records resolved configuration and full/streamed motion summaries. The diagnostics parity test found and corrected an initial-approach counting difference; the existing travel metric excludes that approach.
- Browser check: local studio loaded without console errors; Solid layers changed to 2 then back to 1; minimum retraction travel displayed 2 mm.
- Reproduction: 27.66 minutes for solid 1; 49.76 for solid 2 (commanded motion without acceleration). Both retain the same two-pass non-planar mesh. No physical finishing-quality claim is made.
- Final full-suite result and local commit hashes are recorded in the completion message. No push authorized or performed.

- Final verification: npm test completed with 902 tests: 891 passed, 11 skipped, 0 failures. Independent review recheck passed all 18 focused regressions with no further findings. Remaining travel, diagnostics and their metadata snapshots are committed together after the complete-suite check.
