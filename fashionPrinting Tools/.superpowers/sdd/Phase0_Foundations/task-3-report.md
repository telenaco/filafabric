# T0.3 — Construction report

Implemented on `t0-3-construction-report`, based on T0.2 `15b9c5b`. No push or merge.

## Implementation

`buildConstructionReport` reads final strand geometry and family/role metadata. It measures family lengths and counts, lost native families, crossing pairs and Z stacks, tie arc midpoints, distinct carrier passes, deposition height, XY components with/without ties, interior loose ends and crossing valence. Lost families produce blocking plain-language errors; disconnected topology and loose ends produce notes. The existing `result.report` remains available with its previous behavior.

All generator results pass through `finishFabric`; it attaches `construction`. `layeredResult` records intended native families before clipping, excluding carrier-tagged backing arrays. Final export and synchronous UI pipelines refresh after stacking, SVG composition, backing and brim. Compact worker output includes construction. The UI disables Export on construction errors, shows notes using existing verdict presentation, and the actual export entry points reject errors, including the full-preview shortcut. Raw generators remain inspectable and do not throw solely because a family was lost.

Reports normalize legacy SVG/brim metadata locally without mutating print strands. Raised intrinsic bases are tagged carrier; existing raised placements retain the native role. Weave lower/upper passes receive L1/L2; dipweave paths receive warp/weft; spacer paths receive bottom/pillars/top; pillar weave receives pillars/fibre rather than one invented family per deposition pass.

## Geometry and snapshot evidence

The narrowly guarded `task-3-snapshot-check.mjs` generated all 133 existing default/preset summaries and asserted every field except `families` against the T0.2 snapshots before writing anything. All 133 comparisons passed: G-code hashes, settings hashes, moves, strand counts, extrusion lengths, Z envelopes and tie counts are identical. Under the parent's explicit metadata correction ruling, 23 cases in seven files updated only their families arrays:

- loop-pile (1), relief (4), fringe (4): L1 → carrier-base/motif; motif is a family name and its role remains native.
- weave (1): L1 → L1/L2.
- dipweave (4): L1 → warp/weft.
- spacer (5): layer-index fallbacks → bottom/pillars/top.
- pillarweave (4): layer-index fallbacks → fibre/pillars.

No printing geometry or G-code was changed. No full suite or source snapshot was run.

## Audit findings and specification resolutions

- Parquet, herringbone, 20 × 20 mm, block 0.8, ratio 2, spacing 5, turn 45: lost families and a blocking error are observable; raw result inspection works and direct export rejects the result.
- Default herringbone 100 × 100 mm: 44 ties and 23 components without ties. The brief's historical three-component count differs from current geometry; tests assert the requested qualitative tie dependence instead of rewriting geometry to match an old number.
- Crosshatch directions `0-90`: both L1/L2 remain, their pair is counted, and all crossings are fused.
- Relief: actual peak 1.9896634486 plus actual configured loop base 0.6000 gives measured Z max 2.5896634486 mm; using only one 0.2 mm layer as the base would misstate the current generator.
- Bubbles: one component without ties.
- Component topology follows the ticket's XY crossing/contact rule; separated Z is recorded independently in crossing stack classifications, without claiming adhesion or strength.
- The existing sampled `boundaryArea` helper provides even-odd area, including same-winding holes. Carrier families are excluded from intended native families and from native shelf-family counts.

## Shelf diagnostics: all 31 ready defaults, 100 × 100 mm

`SHELF_EXCEPTIONS` contains nine provisional measured disagreements. Every exception requires human batch review; none is marked approved. Provenance mistakes in weave and pillar weave were corrected rather than suppressed as shelf exceptions.

| Card | Declared | Measured | Z max mm | Provisional exception |
|---|---|---|---:|---|
| loop-pile | raised | raised | 3.600 | |
| squiggle | layered | layered | 0.400 | |
| coil | flat | flat | 0.400 | No exception needed at current default |
| weave | layered | layered | 0.400 | |
| spiral | layered | raised | 0.687 | One native family plus carrier exceeds 0.450 ceiling |
| boucle | layered | raised | 0.594 | One native family plus carrier exceeds 0.450 ceiling |
| relief | raised | raised | 2.590 | |
| fringe | raised | raised | 2.932 | |
| zigzag | layered | layered | 0.400 | |
| svgdesign | layered | layered | 0.599 | |
| crosshatch | layered | layered | 0.400 | |
| auxetic | flat | layered | 0.400 | Two crossing native families satisfy layered rule |
| dipweave | raised | layered | 0.400 | Warp/weft dip technique remains within layered envelope |
| web | layered | layered | 0.400 | |
| chainmail | layered | layered | 0.619 | |
| meander | layered | layered | 0.400 | |
| harmonograph | flat | layered | 0.400 | Two crossing native families satisfy layered rule |
| truchet | layered | layered | 0.600 | |
| voronoi | layered | raised | 0.800 | Exceeds two-family 0.650 ceiling |
| turing | layered | raised | 0.578 | One native family plus carrier exceeds 0.450 ceiling |
| conformal | layered | layered | 0.400 | |
| sunflower | layered | layered | 0.400 | |
| rosette | layered | layered | 0.400 | |
| flowlines | layered | layered | 0.537 | |
| bubbles | layered | layered | 0.600 | |
| parquet | layered | layered | 0.400 | |
| spirograph | layered | raised | 0.656 | Exceeds two-family 0.650 ceiling by 0.0064 mm |
| starlattice | flat | layered | 0.400 | Two crossing native families satisfy layered rule |
| halftone | layered | layered | 0.400 | |
| spacer | raised | raised | 1.800 | |
| pillarweave | raised | raised | 1.000 | |

## Performance

Initial profiling identified spacer valence queries as the cause of a 12.5 second report: families 4.5 ms, crossings 176.2, grid 17.5, stack/valence 12206.2, endpoints 0.4, graphs 97.0. This was corrected, not accepted.

Final analyzer crossings/arcs and connected graph are shared through a private WeakMap keyed by final strand-array identity and width/height parameters, consumed/deleted on the immediate report build. Later public builds recompute, so in-place edits cannot use the finished result's old cache. Components can reuse a connected physical graph because it necessarily implies a connected XY graph; otherwise the planar grid graph is calculated. Ties get a separate graph only when present.

Valence and endpoint queries use a fine uniform segment grid, skip strands already found at the same query, memoize identical XY crossings, and use the exact point-projection specialization of segment distance. Family pairs are cached. No quadratic strand all-pairs pass is used.

Measured report-added cost after the existing final analyzer, on 100 × 100 mm defaults:

| Card | Total ms | Crossings | Valence | Grid ms | Stack/valence ms |
|---|---:|---:|---:|---:|---:|
| crosshatch | 6.9 | 812 | 2 | 3.5 | 2.8 |
| spacer | 86.9 | 61,264 | 8 | 9.5 | 72.5 |
| pillarweave | 112.0 | 66,852 | 8 | 21.8 | 84.8 |
| bubbles | 53.6 | 5,019 | 2 | 21.1 | 28.0 |

These representative dense cases satisfy the 200 ms report-added target. A standalone report without prior analyzer data must also pay crossing/graph costs; final compositions that already analyze their strands share that work once. Timings are machine-dependent and are not print or material guarantees.

## Validation

- Guarded snapshot comparison: all 133 non-family summaries unchanged, then 23 authorized family-only cases updated.
- Final focused `construction-report.test.js`, `design-export.test.js`, `verdict.test.js`: 32 tests, 30 passed, two existing SVG-guide skips, zero failures (37.75 seconds).
- Final UI note composition preserves existing geometry warnings and appends construction notes; `node --check site/src/ui/main.js` passed and a fresh verdict-only run passed 9/9.
- Required five audit cases, all 31 ready cards, public in-place mutation refresh, same-winding hole area, stack types, valence, tie midpoint, arbitrary named family loss, compact report retention, direct export blocking, final brim geometry and legacy report preservation are covered.
- `git diff --check` passed.

## Remaining review concerns

Nine shelf exceptions await human approval; exact current geometry and metadata are recorded above. Cache reuse is intentionally one-shot, rather than persistent under mutable public geometry. Reports are geometric diagnostics and do not claim physical material verification. The parent will perform independent review and the final broader suite.

## Review follow-up: intentional all-solid SVG pattern removal

The independent reviewer found that `withoutPattern` removed native geometry for a valid green-only SVG but retained the discarded pattern's intended families. The final construction guard therefore incorrectly blocked all-solid exports with lost L1/L2 errors. The new regression reproduced that failure before the fix. `withoutPattern` now clears intended families when intentionally removing the pattern; the final solids still receive the ordinary construction report and export guard. This changes no print geometry. Focused regression and SVG solids tests are recorded in the follow-up commit.

The reviewer also found that final report refresh ignored `pieceOutline`, so solids extending beyond pattern windows used the smaller pattern boundary for density and loose ends. A composed SVG regression reproduced a wrong 10.9375 crossings/cm² instead of 2.1604938272. Refresh now follows `pieceOutline ?? outline ?? rectangle`, matching the final composed piece. Both reviewer regressions passed after the fixes, along with all six SVG solids tests. No printing geometry changed.
