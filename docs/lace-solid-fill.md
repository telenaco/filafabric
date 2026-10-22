# Continuous solid fill for lace

The green solid regions of an imported drawing now print adjacent rows as connected zigzags within each branch. Remaining paths are ordered for shorter travel within each shape and solid layer.

## Geometry and ordering

- Solid fill uses branch-by-branch row ordering instead of inheriting the general pattern planner's 60 mm gap grouping. Other patterns retain their existing defaults.
- Rows are placed in the same inset fill core as before. A short connection may leave that core beside a curved rim, provided it stays inside the half-bead inset printable region and outside every window. The connection check includes boundary intersections, so narrow windows are not missed by coarse sampling.
- Short scanline spans are retained. This change does not remove small details to reduce the path count.
- Travel ordering preserves the extrusion segments, each shape's height and layer precedence. Single-path coils keep their original spiral direction.
- The existing two solid layers, mesh paths, material temperatures, flow and retract/lift settings are retained for this change.

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
