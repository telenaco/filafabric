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

- [ ] Add tests: default single layer, explicit two, invalid counts; state round trip; swatch and panel honor the choice.
- [ ] Watch the default-count and override tests fail.
- [ ] Add solidLayers (integer 1–8, default 1), expose an existing-style number control and propagate it through all paths.
- [ ] Verify focused tests and full suite; commit this independently.

### Task 2: Selective travel retracts and hops

Files: src/engine/emit.js, params.js, profiles.js; profiles/materials/filaflex-95-foamy.json; src/ui/filament-settings.js/main.js; emit/retraction/profile/settings tests.

- [ ] Tests first: minimum travel 2 mm for Foamy; balanced retract pairs; short flat travel avoids optional lift; elevated obstruction and pause still lift; explicit zero hop is honored; threshold survives saved settings.
- [ ] Change Foamy minimum travel to 2 mm and add controllable lift-on-retract-only policy. Preserve other profiles' behavior unless they select it.
- [ ] Use actual seam/wipe end for travel distance and start. Keep conservative global clearance where raised geometry exists.
- [ ] Run focused tests and full suite; commit.

### Task 3: Diagnostics and final validation

Files: src/engine/gcode.js, stats.js, docs/lace-solid-fill.md; diagnostic tests.

- [ ] Tests first: resolved temperatures, flow, retraction threshold and lift policy in header; motion breakdown and print-height summary from generated output.
- [ ] Implement diagnostic metadata without claiming acceleration-aware print time.
- [ ] Reproduce supplied lace and compare default one-solid-layer versus explicit two with identical mesh and material.
- [ ] Browser-check new controls; run full suite, independent review, commit and confirm FilaFabric is clean. No push.

## Execution ledger

- Baseline f32143a was clean and committed before edits.
- Ruling: one solid layer is the new default; two or more remain explicit choices, since the user asked for single infill without removing the mesh structure.
- Ruling: material temperature, flow and motor-current changes require physical calibration and are not included in the software fix.
