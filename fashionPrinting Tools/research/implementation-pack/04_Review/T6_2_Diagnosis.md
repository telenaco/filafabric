# T6.2 — Truchet diagnosis (local)

## Scope

Ran the construction report before changing `site/src/engine/truchet.js`, as required by the ticket. These are algorithmic measurements, not physical-print results. Profiles were the current default MK3S/Foamy set, with normal automatic ties, no optional backing, and the three registered presets at their stated tile size and default seed 7.

## Construction report

| Preset | Size | Lost families | Components without ties | Ties | Final components | L1 strands | L2 strands | Crossings |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Arcs (5 mm) | 40 × 30 | none | 4 | 6 | 1 | 16 | 13 | 77 |
| Arcs (5 mm) | 100 × 100 | none | 2 | 2 | 1 | 71 | 58 | 746 |
| Diagonals (5 mm) | 40 × 30 | none | 1 | 0 | 1 | 13 | 16 | 72 |
| Diagonals (5 mm) | 100 × 100 | none | 1 | 0 | 1 | 101 | 98 | 648 |
| Big arcs (8 mm) | 40 × 30 | none | 5 | 8 | 1 | 10 | 7 | 35 |
| Big arcs (8 mm) | 100 × 100 | none | 2 | 2 | 1 | 36 | 30 | 302 |

## Findings

- Both intended families survive in every diagnostic case.
- Diagonals already form one connected component without generic ties at both sizes.
- Arc presets depend on generic ties: the small 40 × 30 swatches need 6 and 8 ties, respectively; both 100 × 100 arc cases need 2.
- The current arcs use one sequential RNG for both grids. Changing to per-cell seeds would change same-seed output and needs an explicit compatibility choice (legacy card versus accepting the new seeded layout).
- The current Truchet test checks repeatability, broad strand-count reduction, crossings and print generation, but does not yet assert resize stability or a complete edge-fragment/border strategy.

## Status

Diagnosis is complete; no generator geometry or seed behavior was changed. The arc repair remains pending review and the seed-compatibility choice. No print has been made or claimed.
