# Continuous solid fill for lace

The green solid regions of an imported drawing now print adjacent rows as connected zigzags within each branch. Remaining paths are ordered for shorter travel within each shape and solid layer.

## Geometry and ordering

- Solid fill uses branch-by-branch row ordering instead of inheriting the general pattern planner's 60 mm gap grouping. Other patterns retain their existing defaults.
- Rows are placed in the same inset fill core as before. A short connection may leave that core beside a curved rim, provided it stays inside the half-bead inset printable region and outside every window. The connection check includes boundary intersections, so narrow windows are not missed by coarse sampling.
- Short scanline spans are retained. This change does not remove small details to reduce the path count.
- Travel ordering preserves the extrusion segments, each shape's height and layer precedence. Single-path coils keep their original spiral direction.
- The continuity/routing commits retained the existing two solid layers and material settings. The subsequent independent solid-layer and travel changes are documented below.

## Drawing-2 reproduction

Measured with the supplied 170 x 80 mm drawing, zigzag parallel mode, 3 mm spacing, 1.5 mm depth, 6 mm wavelength, 0.2 mm layers, zero extra layers and the Filaflex 95 Foamy/MK3S profiles:

| Metric | Before | After |
| --- | ---: | ---: |
| Solid-fill paths, both layers | 5,538 | 1,088 |
| Retraction cycles, complete design | 6,398 | 1,948 |
| Non-extruding XY travel, print body | 49.51 m | 7.24 m |
| Estimated motion time, without acceleration | 61.81 min | 51.26 min |
| Extrusion path, print body | 34.97 m | 37.07 m |

The added extrusion length consists of short links that replace separate row starts. The travel and stop reductions are measured from regenerated paths; the time remains the engine's estimate, excludes acceleration and startup heating, and is not a physical print result. The output still has two solid layers and raised mesh crossings, so it is not yet equivalent to the single flat 0.2 mm PrusaSlicer comparison.

## Verification

`node --test tests/solid-fill.test.js tests/svg-solids.test.js` covers continuous filling around curved windows, narrow slots, full bead clearance between closely spaced tiny windows, interior coverage, extrusion-segment preservation and layer heights/order. `npm test` runs the complete suite.

The clearance regression also rejects an in-memory mutant that accepts every proposed connector: its unsafe connection comes within 0.1613 mm of a window, below the 0.225 mm bead-radius clearance.

## Independent solid thickness and selective travel

Printer setup > Layers > Solid layers now defaults to **1**. Choose 1–8 for green/yellow dense solid shapes independently of the pattern. The setting survives saved/shared state and applies to preview, swatch export and streamed panels. Old saved states without a solid-layer count use the new single-layer default; select 2 to reproduce their previous solid thickness. Export filenames carry the selected solid count and export metadata records it.

Both native zigzag mesh passes and their non-planar crossings remain intact. Changing the solid count does not flatten, repeat or reroute those mesh strands. Other patterns keep their own structural layer plans.

The Foamy profile now retracts for travels of at least **2 mm**, adjustable under Temperatures and retraction. Its optional lift follows retraction; short flat travels omit both. The 1 mm retract at 40 mm/s, 0.2 mm optional lift, 0.2 mm seam gap, 238 C temperature and calibrated flow remain. Setting the minimum travel to 0 restores retraction on every actual travel. Explicit zero optional lift is honored, but clearance over raised geometry and color-change pauses still lifts at least the layer thickness. Travel distance starts at the actual seam/wipe endpoint, with balanced retract/unretract handling.

Final drawing-2 reproduction, using the same mesh, dimensions and material as above:

| Metric | Original export | All fixes, solid 1 | All fixes, solid 2 |
| --- | ---: | ---: | ---: |
| Solid paths | 5,538 | 532 | 1,088 |
| Retraction cycles | 6,398 | 787 | 929 |
| XY travel between body moves | 49.51 m | 6.32 m | 7.24 m |
| Commanded motion, no acceleration | 61.81 min | 27.66 min | 49.76 min |

The single-solid-layer result still has two mesh passes, with actual extrusion reaching Z0.7413 mm. The two regenerated cases have identical native mesh strand coordinates. The XY metric excludes the initial prime-line approach. Time excludes heating, startup, acceleration and operator pauses; 27.66 minutes is a software estimate, not a measured print time or a guarantee of PrusaSlicer finishing quality. One solid layer also uses less material and may change the solid region's strength.

G-code records resolved temperature/flow/retraction settings, motion time by category, retract counts and actual extrusion Z range. Streamed output records its completed motion summary in the footer. The legacy estimate remains explicitly labeled as excluding acceleration.

Regression coverage includes solid-layer persistence and mesh preservation, short flat travel, raised crossings, pauses, zero-hop solid-to-native handoff, seam/wipe distances, wipe endpoints coinciding with the next start, and agreement between incremental and full-export diagnostics. Independent review found the wipe endpoint, zero-hop handoff and missing streamed summary issues; each was fixed with a regression. Browser verification confirmed the independent 1–8 control, the 2 mm threshold, and leaving Solid layers at 1 without console errors.

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
