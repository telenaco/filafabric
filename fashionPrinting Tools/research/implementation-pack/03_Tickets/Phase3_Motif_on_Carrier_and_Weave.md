# Phase 3: Motif-on-carrier cards and the woven-draft generator

**Goal:** four new Layered cards in which a decorative motif is held by a carrier or a tying pass, plus a loom-style draft generator for Woven draft.

**Depends on:**
- T1.8 (Support section and `carrierLayers`);
- T2.12 (lace motifs, for T3.1);
- T2.11 (isohedral tiles, optional for T3.4).

Follow the [shared scaffolding](Phase2_New_Flat_and_Layered_Cards.md#shared-scaffolding-for-every-new-card) of Phase 2.

| Ticket | Card | ID | Size |
|---|---|---|---|
| T3.1 | L-25 Lace + backing | `lace-backing` | M |
| T3.2 | L-26 Step, ripple and petal lace | `step-lace` | M |
| T3.3 | L-27 Paired loops | `paired-loops` | M |
| T3.4 | L-28 Scales on a carrier | `scales` | L |
| T3.5 | L-19 Woven draft generator | `weave` (extended) | M |

---

## T3.1 L-25 Lace + backing (`lace-backing`)

**Sources:**
- [catalogue M1](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m1--lace-plus-open-printed-backing);
- Sterman 2026, [Paper 58](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-58-sterman-2026--opportunities-and-challenges-of-toolpath-based-3d-printed-textiles-insights-from-digital-design-and-craft-course);
- Sun, [Paper 59](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-59-sun-2017--daring-to-sprint-3d-printing-textiles).

**What it is:** lace motifs (rings, petals, scallops) printed first, as the face on the bed, then held by one open carrier layer, or two at an angle. Unlike Connected lace (T2.12), the motifs don't need necks: the carrier holds them.

**Engine:** `site/src/engine/lace.js` gains `laceOnCarrierLayers(boundary, { motif, scale, openness, lattice, support })`.
- Motif layer from `laceMotifs` (T2.12), without necks or border, tagged `role: 'motif'` and family `motif`.
- Carrier from `carrierLayers(boundary, support)` (C8).
- Order: `support.order`, default `'motif-first'`, so the motif is the face against the bed (decision D8).
- Return `{ layers: [motif, ...carrier], families: ['motif', 'carrier-1', 'carrier-2'] }`.
- **Metadata:** `support: 'auto'`.

**Settings**
- From T2.12: `motif`, `scale`, `openness`, `lattice`.
- Support (C8), with defaults: `style: 'straight'`, `openness: 3`, `layers: 1`, `angle: 45`.

**Checks**
- **Every motif island has at least two crossings with the carrier.** Assert this per island, using the construction report's crossings filtered to `motif × carrier`.
- The side view shows the motif below the carrier.
- The report counts one carrier.

---

## T3.2 L-26 Step, ripple and petal lace (`step-lace`)

**Sources:**
- Diak & Diak 2025, [Paper 10](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-10-diak-diak-2025--3d-printed-textile-concept-and-production-challenges): five tested models on 67 × 10 mm specimens, 0.26–0.36 mm thick, 174–258 g/m², 23.8–44.5 N. Among them *Line/Step* (straight lines tied together by a second-layer zigzag "step") and *Line/Hexagon* (straight lines with a hexagon network on top);
- [catalogue M6](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m6--step-ripple-and-petal-lace-over-a-carrier);
- Lee 2023, [Paper 37](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-37-lee-2023--digital-waves): ripple lace; seam allowance 0.25 in on curved seams, 0.5 in on straighter ones.

**What it is:** a first pass of straight parallel lines that would fall apart on their own, tied together by a second-pass motif that crosses them: a zigzag **step**, a **hexagon** network, a **ripple** (sine) or **petals**. The second pass is the carrier's job done decoratively.

**Engine:** `site/src/engine/step-lace.js`
- `stepLaceLayers(boundary, { spacing = 3, tie = 'step', tieLength = 6, tieDepth = null, petals = 6 })`.
- **Lines:** `hatch(boundary, { angle: 0, spacing })`, family `lines`.
- **Ties:** family `tie`.
  - `step`: zigzag rows at 90° to the lines; `tieDepth` defaults to `spacing × 1.1`, so each zigzag reaches across at least one line.
  - `hexagon`: two offset zigzag families meeting as hexagons (reuse `auxeticLayers` with `cell: 'hexagon'`, scaled).
  - `ripple`: sine rows, amplitude `tieDepth`.
  - `petal`: rosettes on a hex lattice of pitch `tieLength`, each overlapping at least three lines.
- **Metadata:** `support: 'built-in'`; the tie pass *is* the carrier.

**Settings**

| key | label | default | range |
|---|---|---|---|
| `spacing` | Gap between lines | 3 | 1.5–8 mm |
| `tie` | Tying pattern | `step` | choice: step, hexagon, ripple, petal (with pictures) |
| `tieLength` | Tie length | 6 | 3–20 mm |
| `tieDepth` | Tie depth | auto (spacing × 1.1) | spacing × 1.0 – spacing × 3 |
| `petals` | Petals | 6 | 4–10 (petal only) |

**Checks**
- **No base line has a free span longer than `tieLength × 1.5`** between crossings with the tie family. Assert this from the crossing positions along each line.
- One component without automatic ties.

---

## T3.3 L-27 Paired loops (`paired-loops`)

**Sources:**
- [catalogue M4](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m4--paired-loops-and-staggered-lace);
- Kabir 2023, [Paper 25](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-25-kabir-2023--tensile-behavior-of-3d-printed-knit-textiles): knit-course tensile context;
- Beecroft, [Paper 3](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-3-beecroft-2016--3d-printed-weft-knitted-structures-by-sls-of-nylon-powder) and [Paper 4](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-4-beecroft-2019--digital-interlooping-3d-printed-weft-knitted-tubular-structures): loop height-to-width proportions of about 1.6–2.4, and more give across the courses.

**What it is:** two families of flat loop rows, the second offset by half a loop and printed on the next plane, bonding where they overlap: a knit-looking, bonded loop lattice. **It is not mobile stitches; say so in `about`.**

**Engine:** `site/src/engine/paired-loops.js`
- `pairedLoopsLayers(boundary, { loopWidth = 4, aspect = 1.8, rowPitch = null, offset = 0.5 })`.
- Each row is a looped polyline: reuse the `looped` primitive in `site/src/engine/shapes.js`, scaled to the loop width and to `aspect` × width high.
- Rows `rowPitch` apart (default `loopWidth × aspect × 0.6`, so rows overlap).
- Family A on plane 1; family B shifted by `offset × loopWidth` in x, on plane 2: return `extra.planes: true`, as in T2.1.
- `families = ['loops-A', 'loops-B']`.

**Settings:** `loopWidth` (2–10 mm), `aspect` (1.2–2.6; hint *Beecroft's knit loops were 1.6–2.4 times as tall as wide*), `rowPitch` (auto or 2–15 mm), `offset` (0.25–0.75).

**Checks:** every loop in family B crosses at least two loops of family A; one component; `z.max ≈ 2 × layerHeight`.

---

## T3.4 L-28 Scales on a carrier (`scales`)

**Sources:**
- FlexScale, Montes Maestre et al. 2024, [Paper 47](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-47-montes-maestre-2024--flexscale-flexible-scaled-sheets): Prusa MK3S+, 0.4 mm nozzle, 0.1 mm layers, a 0.4 mm NinjaFlex 85A carrier, 4 mm PETG scales, a 0.4 mm gap between scales, and an interlocking groove at each scale's base. Contact between scales stiffens bending in one direction;
- [catalogue M8](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m8--scales-on-a-continuous-carrier-new-24-october-2026).

**What it is:** a thin continuous carrier sheet with an array of low solid tiles on top, each inset from its neighbours by a constant gap. Single material at first; a second filament for the scales is possible through Colour → Colour per layer.

**Engine:** `site/src/engine/scales.js`
- `scalesLayers(boundary, { tile = 'hex', pitch = 8, gap = 0.4, scaleLayers = 4, carrierLayers = 2, carrier = 'solid' })`.
- **Carrier:**
  - `solid`: `carrierLayers` solid layers, using `site/src/engine/solid-fill.js` over the whole boundary, alternating 0° and 90°;
  - `net`: `carrierLayers(boundary, { style: 'straight', openness: 1.2, layers: 2 })`.
- **Tiles:** a tiling (hex, square or triangle; or an isohedral family if T2.11 is merged) at `pitch`, each tile inset by `gap / 2`. Each tile is solid-filled for `scaleLayers` layers, stacked on the carrier, with alternating fill angle per layer.
- **Interlock** (optional, default off): the first tile layer uses a concentric fill, so its ridges key into the carrier, approximating FlexScale's grooves. Label it as an approximation.
- **Shelf:** layered, with a `SHELF_EXCEPTIONS` entry ("*tiles are stacked flat layers on a carrier*"), because the tiles can be several layers high.
- **Metadata:** `support: 'built-in'`.

**Settings**

| key | label | default | range |
|---|---|---|---|
| `tile` | Tile shape | `hex` | choice: hex, square, triangle (+ isohedral when available) |
| `pitch` | Tile size | 8 | 4–20 mm |
| `gap` | Gap between tiles | 0.4 | 0.4–2 mm |
| `scaleLayers` | Tile thickness | 4 | 1–10 layers |
| `carrier` | Carrier | `solid` | choice: solid, open net |
| `carrierLayers` | Carrier layers | 2 | 1–3 |

**Checks**
- **The gap between neighbouring tiles is at least 0.4 mm:** measure the minimum distance between tile outlines.
- Every tile lies fully on the carrier.
- The construction report's Z envelope is `(carrierLayers + scaleLayers) × layerHeight`.

**Phase 8 note:** test bending both ways, because FlexScale found that opening and closing differ.

---

## T3.5 L-19 Woven draft generator (`weave`, extended)

**Sources:**
- LOOMING, Lin & McLean 2026, [Paper 39](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-39-lin-mclean-2026--looming-between-shaft-looms-and-a-tc2-jacquard-loom-a-serendipitous-expedition-with-live-weaving): threading × tie-up × treadling generates whole binding families;
- AdaCAD, [Paper 8](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-8-devendorf-gelosi-2026--imagining-open-source-ecosystems-for-experimental-weaving-a-view-from-the-adacad-project) and [Paper 16](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-16-gelosi-devendorf-2026--designing-with-drafts-and-cross-sections-reflections-on-how-representations-of-woven-structure-shape-design-practice): a cross-section view explains layers better than the top view; a flap bound on one side only peels;
- Weavecraft, Wu 2020, [Paper 64](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-64-wu-2020--phd-dissertation_computational-tools-for-3d-printing-and-woven-textile-design);
- [catalogue M3](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m3--fused-pseudo-weave-from-a-draft).

**Today:** `site/src/engine/weave.js` has `WEAVE_BINDINGS`, each with `over(i, j)` (true when warp *i* is over weft *j*), and `generateWeaveTextile` prints lower pieces, then upper pieces, with ramps. The crossings fuse.

**Implementation**
1. Add a binding `draft` whose `over` comes from three arrays:
   - `threading` (shaft for each warp, repeating);
   - `tieup` (a shafts × treadles boolean matrix);
   - `treadling` (treadle for each pick, repeating).

   Then `over(i, j) = tieup[threading[i % T.length]][treadling[j % P.length]]`. Export `draftBinding({ threading, tieup, treadling })` from `weave.js`.
2. Settings `draft: { threading: number[], tieup: boolean[][], treadling: number[] }`, sanitised: at most 8 shafts, 8 treadles and 32 entries per sequence.
3. **Structure choices** on the card: *Binding* (the existing 8, plus *Your draft*). When *Your draft* is chosen, a new section kind `draft` shows:
   - three small grids (threading, tie-up, treadling) that can be clicked to toggle;
   - the resulting drawdown, live;
   - a **cross-section strip** for the row under the pointer, drawing which strand is on top at each crossing (AdaCAD's lesson).

   Implement it in `panels.js` as a `Control` subclass and add it to Contract C2 under Structure.
4. **Preset drafts** written as drafts:
   - point twill: threading 1-2-3-4-3-2, tie-up 2/2, straight treadling;
   - block weave: threading in two blocks;
   - herringbone: point threading with straight treadling.

   For the existing bindings that a draft can express exactly, assert that `draftBinding(...)` equals the hand-written `over` for i, j up to 32.
5. **Validation:**
   - warn when any float, a run of `over` or `under` along a warp or weft, is longer than 4 crossings (*"long floats sag and snag"*);
   - **refuse a draft in which any warp or weft is never over or never under:** it would not be bound (AdaCAD's flaps peel).
6. The `about` text keeps saying the crossings **fuse**: this is a pseudo-weave, not sliding yarn ([catalogue M3](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m3--fused-pseudo-weave-from-a-draft)).

**Checks:**
- The existing bindings' snapshots are unchanged.
- `draftBinding` equals the bindings it can express.
- Unbound drafts are refused with a clear message.
- The float warning triggers at 5.
