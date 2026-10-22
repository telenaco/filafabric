# Adaptive flat solids and fabric routing

The browser now uses the real Arachne variable-width wall engine for non-round SVG solid regions with one or more inside perimeters. Round solid regions retain their continuous coil; zero perimeters uses the existing wall-free fill. Solid layer count remains independent of the native mesh passes. Existing synchronous API callers default to classic geometry; use `generateDesignExportAsync({...input, solidGenerator:'arachne'})` for explicit adaptive generation.

The unmodified WASM build is pinned to Three_Slicer commit `8ee934d183a9f60ab09bab9e05cd7bb747c6a51a`, which ports OrcaSlicer's Cura-derived Arachne engine. This is a real upstream implementation, not a claim of bit-identical Prusa output. Attribution, the AGPL licence and corresponding engine build sources are in `vendor/arachne/`. `source.html` offers both those sources and a complete snapshot of this app. Run `node tools/source-snapshot.mjs` after changing the integration and before distributing it.

Each flat region and its holes are triangulated into a watertight one-layer mesh. Arachne supplies variable-width walls and a 15% wall-overlap dense core. Its printer commands are discarded. FilaFabric applies its own material flow, measured-width correction, axis/volume limits, seams, retracts, temperatures and final G-code. The upstream bridge is tuned to a 0.4 mm nozzle; a similarity transform scales geometry/width/height to that frame for other nozzle sizes, then restores physical millimetres. Failed initialization or invalid geometry raises an error instead of silently changing generators.

Width travels with its incoming segment, including after clipping, reversal and loop-seam rotation. Wall paths precede dense core paths within each solid layer. The already resolved mesh order, direction, raised crossings and colour-change precedence remain constraints on path optimization. The travel planner uses locally printed geometry to clear nearby raised strands rather than the highest distant point everywhere. Travel across a known void retains a retract and lift even below the normal travel-length threshold; streamed callers without a local height history retain the conservative global fallback.

See `foamy-calibration.md` for recording measured bead width and qualified flat-print speed. No new physical calibration is assumed here. The tested 238 C and retraction settings remain the defaults.

## Verification

The tests exercise real WASM variable widths, holes, one-layer solids, invalid input and nozzle normalization, plus segment-flow preservation, loop seams, dependency groups, nearby/distant raised obstacles, known voids, calibration persistence and volume limits. The user drawing is regenerated at 170 x 80 mm, two inside perimeters, one solid layer and the original two raised mesh passes. Final metrics and remaining physical validation are recorded after the full test and comparison run.

## Recorded comparison (22 October 2026)

Full verification: 944 passed, 11 skipped, 0 failed (955 tests). Independent review's air-strand clearance and source-build output-directory findings were corrected and verified. The worker protocol now awaits async initialization; legacy golden hashes changed only because new diagnostics were added, with unchanged printer commands verified separately.

For drawing-2.svg at 170 x 80 mm, perimeters 2, solids 1 and native mesh passes 2: calculated body motion 27.8575 min; Prusa 21.8385 min; earlier fixed-width FilaFabric 30.3590 min. New extrusion path 21,898.38 mm, XY travel 15,284.54 mm, 904 retracts, extrusion Z 0.2-0.6 mm, no generator warnings. These exclude heating and acceleration and are not a physical print result. The supplied Prusa reference SHA-256 remains 2927d42f963c1e9223095cf07f15ab79a0cd85e21ffec26fb27e889f1f52c755.

The user's photograph and the flow audit identify remaining work: default mesh extrusion is 0.0247096 mm filament/mm path versus Prusa solid infill 0.0344227 (28.2% lower). Raised zigzag portions are classed supported and do not use the unsupported-strand flow setting. Arachne fixes the flat solid regions, not this material-flow difference. Motor current is still M907 E430 compared with the reference's E538. Physical quality parity has not been established. These are carried forward to the separately authorized Prusa-profile alignment task.
