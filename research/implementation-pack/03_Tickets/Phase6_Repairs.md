# Phase 6: Repairs

**Goal:** make Parquet, Truchet, Meander and Turing print as reliably as the rest. Luis reported that they don't work well; the audit found why for Parquet. Each repair removes the card's *Needs repair* badge only after a good print (Phase 8).

**Depends on:** T0.3 (construction report: the measure of success), T1.8 (Support, for Meander and Turing).

| Ticket | Card | Size |
|---|---|---|
| T6.1 | Parquet (`parquet`) | L |
| T6.2 | Truchet tiles (`truchet`) | M |
| T6.3 | Meander and Turing stripes (`meander`, `turing`) | M |

---

## T6.1 Parquet (`site/src/engine/parquet.js`)

**Evidence:** [audit, "Parquet findings and repair choices"](../../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md#parquet-findings-and-repair-choices). Three diagnostics:

| Case | Problem |
|---|---|
| Default herringbone: block 8 mm, ratio 2, spacing 2 mm, turn 45°, 100 × 100 mm | 2,546 crossings between families but 3 raw components; 23 after clipping; held together by 44 added ties |
| *Long planks*: block 5, ratio 3, spacing 2, turn 0°, 100 × 100 mm | 138 raw components; 292 ties |
| 20 × 20 mm, block 0.8, ratio 2, spacing 5, turn 45° | a whole family lost (counts `[2, 0]`) because `clipPolyline` drops pieces under 1 mm |

**Approach** (the audit's option 1: keep Parquet a structural net):
1. **Coinciding tile edges:**
   - generate each block's two serpentine families so that their turnarounds land **on the block edges**, at positions shared with the neighbouring block;
   - snap the turnaround points of neighbouring blocks to common points on the shared edge;
   - where the neighbour's lines run perpendicular, add a short **seam segment** along the shared edge joining consecutive turnarounds;
   - give seam segments `role: 'native'` and family `seams`. They are a designed family, not engine ties.
2. **Minimum contact:** every seam joint overlaps both blocks' lines by at least one bead width. This is the no-point-contact rule from Schumacher 2015, [Paper 53](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-53-schumacher-2015--microstructures-to-control-elasticity-in-3d-printing); Chen, [Paper 6](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-6-chen-2021--bistable-auxetic-surface-structures), averages cut endpoints across shared edges, which is the same idea.
3. **Range limits:** the sanitiser rejects settings where a block's shorter serpentine run would be under 3 × bead. That rules out the 0.8 mm block case; say why in the hint.
4. **Ties:** generic ties may still run for odd boundary fragments, but the result must hold together without them (below).

**Tests** (`dev/tests/parquet.test.js`, extended)
- For each of the three audit cases (the third becoming the nearest allowed setting): no lost family; `componentsWithoutTies === 1`; `ties.count ≤ 5`.
- Every preset (Basket weave, Herringbone, Chevron, Long planks) passes the same.
- The seam family exists and touches both neighbouring blocks at each joint.

**Acceptance:** the report shows Parquet holding together without generic ties. The *Needs repair* badge comes off after Luis prints one (T8.1).

---

## T6.2 Truchet tiles (`site/src/engine/truchet.js`)

**Evidence:** [audit, Nets table](../../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md#nets-and-coordinated-path-families). Diagonals use complementary tile diagonals; arcs use a second, independently seeded, half-tile-shifted tiling. Tile joins, edge fragments and the survival of the second family need verifying on small swatches.

**Implementation**
1. Run the construction report on every preset at 40 × 30 mm and at 100 × 100 mm, and record the lost families, components and ties in the PR. **This is the diagnosis; do it first and show the reviewer.**
2. **Edge fragments:** drop arc fragments shorter than one tile quarter; join the remaining fragments to a border strand (family `border`).
3. **Second family:** seed it by grid-cell coordinates (`createRng(hash(seed, i, j))`) so it regenerates identically when cropped (Martínez 2016, [Paper 44](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-44-martinez-2016--procedural-voronoi-foams-for-additive-manufacturing)). **This changes the output for the same seed:** list it in the PR, and keep old links on the old generator through a hidden `truchet-legacy` card if Luis wants exact reproduction.
4. **Tile joins:** arcs end exactly at tile-edge midpoints. Assert that neighbouring tiles' arc ends coincide within 0.01 mm.

**Tests:** no lost family at either size; `componentsWithoutTies === 1` with the border; the arc ends coincide; resize stability (as T2.8).

---

## T6.3 Meander and Turing stripes (`site/src/engine/meander.js`, `site/src/engine/turing.js`)

**Evidence:**
- The [audit's "Pattern on a mesh" acceptance](../../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md#1--pattern-on-a-mesh): every motif fragment must really touch the carrier.
- Turing produces separate stripe fragments.
- Both are seeded.

**Implementation**
1. **Attachment check:**
   - after generating, compute for each motif fragment (`role: 'motif'`) its crossings with the carrier (`role: 'carrier'`);
   - a fragment with fewer than 2 crossings is either dropped (if under 3 mm long) or extended along its own direction until it reaches 2 crossings, without leaving the boundary;
   - report how many were dropped or extended.
2. **Seeding** by grid-cell coordinates, as in T6.2 (with the same legacy-card rule).
3. **Turing fragments:** merge stripe fragments closer than one bead into one strand before checking attachment.

**Tests:**
- Every fragment has at least 2 carrier crossings, at defaults and at every preset, for both cards.
- The report shows `componentsWithoutTies === 1`.
- Snapshots change only as listed in the PR.
