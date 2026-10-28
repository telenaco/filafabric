# Ticket board

## Where things stand — 28 October 2026

Every ticket below is implemented in software and committed **locally** on `filafabric-integration` (under `fashionPrinting Tools/`, the main repository's history). Nothing is pushed, nothing is merged into `library`, and no ticket has been reviewed or approved by Luis yet. Branch names in the tables are historical provenance: the per-ticket branches of the separate Codex history were folded into one integration commit, with the later work on top. Full suite: 1,359 tests. See the [status note of 28 October](Status_2026-10-28.md) for the plan against what is built, what needs Luis, and what physical work remains, and the [integration QA](Integration_QA_2026-10-27.md) for the first full run.

**How to read the State column now:** *In review (local)* and *Implemented locally* mean built and tested, waiting for Luis's review; *Done locally* means the same for work finished in the later passes. *Deferred* acceptance items need physical prints. Nothing is *Approved* or *Merged*.

The single place to see what is ready, who has it and where it stands. The reviewer keeps the *State* column current; implementers fill in *Owner* and *PR* when they start. States: **Ready**, **Blocked** (dependencies not merged), **In progress**, **In review**, **Changes requested**, **Approved**, **Merged** (into `library`), **Printed** (cards, Phase 8) ([handbook §2.2](../01_Team_Handbook.md#22-ticket-lifecycle)).

**Suggested order:** Phase 0 → Phase 1 → T7.1 → Phase 2 → Phase 4 → Phase 5 → Phase 3 → T7.2–T7.7 → Phase 6; Phase 8 runs alongside. Tickets marked ∥ in the same phase can be worked on in parallel by different people.

## Phase 0: Foundations

| Ticket | Title | Depends on | Size | ∥ | State | Owner | PR |
|---|---|---|---|---|---|---|---|
| T0.0 | Output snapshots of every card | — | S | | In review (local; known baseline test exception) | Codex | [Local handoff](T0_0_Local_Review.md); `t0-0-output-snapshots`, no push |
| T0.1 | Card IDs, metadata and `library.js` | T0.0 | M | ∥ T0.2 | In review (local) | Codex | `t0-1-card-metadata`, no push |
| T0.2 | Strand provenance tags | T0.0 | M | ∥ T0.1 | In review (local) | Codex | `t0-2-strand-provenance`, no push |
| T0.3 | Construction report + shelf check | T0.2 | M | ∥ T0.4 | In review (local) | Codex | `t0-3-construction-report`, no push |
| T0.4 | Side profile and side view | T0.2 | M | ∥ T0.3 | In review (local) | Codex | `t0-4-side-profile`, no push |
| T0.5 | Shelves in the gallery | T0.1, T0.4 | M | ∥ T0.6 | In review (local) | Codex | `t0-5-gallery-shelves`, no push |
| T0.6 | State schema v4 and migration map | T0.1 | L | ∥ T0.5 | In review (local) | Codex | `t0-6-state-migrations`, no push |
| T0.7 | Variant groups | T0.5, T0.6 | M | | In review (local) | Codex | `t0-7-variant-groups`, no push |

## Phase 1: Move the existing designs

| Ticket | Title | Depends on | Size | ∥ | State | Owner | PR |
|---|---|---|---|---|---|---|---|
| T1.1 | Panel template, Colour and Support kinds, card header | Phase 0 | M | | In review (local) | Codex | `t1-1-panel-template`, no push |
| T1.2 | Split Squiggle & Gyroid into seven cards | T1.1 | L | ∥ T1.4, T1.5, T1.7, T1.8, T1.10 | In review (local) | Codex | `t1-2-squiggle-cards`, no push |
| T1.3 | Zigzag net and the preset alias | T1.2 | S | | In review (local) | Codex | `t1-3-zigzag-alias`, no push |
| T1.4 | Coil: Looped rows and Figure-8 rows | T1.1 | S | ∥ | In review (local) | Codex | `t1-4-coil-cards`, no push |
| T1.5 | Cells and grids | T1.1 | M | ∥ | In review (local) | Codex | `t1-5-cells-grids`, no push |
| T1.6 | Pattern section; halftone as Line thickness | T1.2, T1.5 | L | | In review (local) | Codex | `t1-6-pattern-effects`, no push |
| T1.7 | Colour section and colour plan | T1.1 | M | ∥ | In review (local) | Codex | `t1-7-colour-plan`; [handoff](T1_7_Local_Review.md), no push |
| T1.8 | Support section and one carrier | T1.1 | L | ∥ | In review (local) | Codex, finished by Claude | `t1-8-support-carriers`; [review note](T1_8_Local_Review.md), no push |
| T1.9 | Look and feel labels and help text | T1.2–T1.5 | S | | In review (local) | Codex | [T1.9 handoff](T1_9_Local_Review.md), no push |
| T1.10 | Move the remaining cards | T1.1 | M | ∥ | In review (local; already complete) | Codex | `t1-8-support-carriers`; no push |
| T1.11 | Library QA pass | all of Phase 1 | S | | In review (local) | Codex | [browser sweep](T1_11_Local_QA.md), no push |

## Phase 2: New Flat and Layered cards (all ∥ with each other, except T2.5 after or with T2.4)

| Ticket | Card | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T2.1 | L-09 Rotated stack | Phase 1 | M | In review (local) | Codex | [T2.1 handoff](T2_1_Local_Review.md), no push |
| T2.2 | L-10 Moiré net | Phase 1 | S | In review (local) | Codex | [T2.2 handoff](T2_2_Local_Review.md), no push |
| T2.3 | F-01 Rings · flat | Phase 1 | M | In review (local) | Codex | [T2.3 handoff](T2_3_Local_Review.md), no push |
| T2.4 | F-06 Rotating squares | Phase 1 | M | In review (local) | Codex | [T2.4 handoff](T2_4_Local_Review.md), no push |
| T2.5 | F-07 Rotating triangles | T2.4 helpers | M | In review (local) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.6 | F-08 Arrowhead band | Phase 1 | M | In review (local) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.7 | F-09 Spiral cells | Phase 1 | M | In review (local) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.8 | F-10 Stochastic net | Phase 1 | L | In review (local) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.9 | F-15 Voronoi cells | Phase 1 | S | In review (local) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.10 | F-11 Star-metric cells | Phase 1 | L | In review (local) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.11 | F-12 Isohedral tiles (licence gate) | Phase 1 + licence check | L | In review (local; BSD-3-Clause TactileJS pinned and approved) | Codex | [T2.11 review](T2_11_Local_Review.md), no push |
| T2.12 | F-13 Connected lace | Phase 1 | L | In review (local; export bug fixed in review) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.13 | F-14 Meander with ties | Phase 1 | M | In review (local; rebuilt in review) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |
| T2.14 | F-19 Kirigami sheet | Phase 1 | M | In review (local; generation time halved in review) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md), no push |

## Phase 3: Motif on carrier and weave

| Ticket | Card | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T3.1 | L-25 Lace + backing | T1.8, T2.12 | M | In review (local; built with T2.12) | Codex, reviewed by Claude | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md#t31-built-alongside-t212), no push |
| T3.2 | L-26 Step, ripple and petal lace | T1.8 | M | Done locally (branch `t3-2-acceptance`): every tying pattern keeps free spans within 1.5 x the tie length; `step-lace-span.test.js` | Claude | no push |
| T3.3 | L-27 Paired loops | T2.1 (planes option) | M | Done locally (branch `t3-2-acceptance`): every second-family loop crosses at least two below it, one component, Z within two layers | Claude | no push |
| T3.4 | L-28 Scales on a carrier | T1.8 (T2.11 optional) | L | Done locally (branch `t3-2-acceptance`): true tilings (the hexagons used to overlap), gap equals the setting, tiles on the carrier, Z = (carrier + tile layers) x layer height; default is 1 + 2 layers, the ticket recipe 2 + 4 also fits | Claude | no push |
| T3.5 | L-19 Woven draft generator | Phase 1 | M | In review (local; draft editor, presets, drawdown/cross-section and engine tests; browser review pending) | Codex | no push |

## Phase 4: Raised engine

| Ticket | Capability | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T4.1 | Print order from nozzle clearance | Phase 0 | M | In review (local; focused acceptance tests pass) | Codex | no push |
| T4.2 | Bond control | Phase 0 | M | In review (local; bundle geometry and mask tests pass) | Codex | no push |
| T4.3 | Lifted crossings | T4.1 | M | In review (local; focused acceptance tests pass) | Codex | no push |
| T4.4 | Bridged crossings | T4.1 (shares T4.3 helper) | S | In review (local; focused acceptance tests pass) | Codex | no push |
| T4.5 | Sliding channels | T4.1 | L | In review (local; the raised cards that use it, Grid · sliding channels and its checks, are built in T5.3) | Codex | no push |
| T4.6 | Climbing overlaps | T4.1 | L | In review (local; focused acceptance tests pass) | Codex | no push |
| T4.7 | Raised reporting and preview | T4.3–T4.6 | M | In review (local; focused diagnostics tests pass) | Codex | no push |

## Phase 5: Raised cards and comparisons

| Ticket | Card / feature | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T5.0 | Strand transform hook | Phase 1 | S | In review (local; no-op and raised-Z regressions pass) | Codex | no push |
| T5.1 | R-01 Rings · raised | T2.3, T4.6, T5.0 | M | In review (local; settings, level cap, ordering and clearance tests pass) | Codex | no push |
| T5.2 | R-09 Grid · lifted crossings | T4.3, T5.0 | M | Done locally (branch `t5-2-raised-cards`): `all` default kept; a grid with every crossing lifted is two unbonded directions by design, so the card accepts that finding (and says so in its verdict) instead of blocking export | Claude | no push |
| T5.3 | R-10 Grid · sliding channels | T4.5, T5.0 | M | Done locally (branch `t5-2-raised-cards`): channels are cut at the held strand's height so the default prints in a safe order (0 conflicts, under 1 s at 100 mm); mixed masks keep a bounded search and warn; Li's steep legs accepted by design | Claude | no push |
| T5.4 | R-11 Wave net · bridged | T4.4, T5.0 | S | Done locally (branch `t5-2-raised-cards`): bridges at line thickness + R/2; bridged crossings are unfused by design | Claude | no push |
| T5.5 | R-12 Corrugation | Phase 1 | M | In review (local; bounded height/slope and supporting-net test pass) | Codex | no push |
| T5.6 | R-13 Colour exposure | T1.6, T1.7, T8.3 calibration | M | Done locally (branch `t5-2-raised-cards`): software only; the effect depends on measured widths, so T8.3 calibration prints must come first | Claude | no push |
| T5.7 | Print all variants | T0.7 | M | In review (local; bed layout, one-file export, preview dialog and focused acceptance tests; browser review pending) | Codex | no push |

## Phase 6: Repairs

| Ticket | Card | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T6.1 | Parquet | T0.3 | L | Implemented locally: edge turnarounds, designed seam family/border and three-bead minimum. Acceptance deferred; Needs repair retained. | Codex | `filafabric-integration`, no push |
| T6.2 | Truchet tiles | T0.3 | M | Implemented locally: world-grid seeds, quarter-tile fragment filter and border; hidden old generator preserves saved drawings. Validation deferred. | Codex | [diagnosis](T6_2_Diagnosis.md); no push |
| T6.3 | Meander and Turing | T0.3, T1.8 | M | Implemented locally: carrier attachment, short-fragment pruning, directional extension, near-stripe merging, coordinate seeds and legacy generators. Unattachable long fragments block generation. Validation deferred. | Codex | `filafabric-integration`, no push |

## Phase 7: Drawing tools

| Ticket | Title | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T7.1 | Line alignment and pass spacing | Phase 0 | M | In review (local) | Codex | [T7.1 handoff](T7_1_Local_Review.md), no push |
| T7.2 | Keep each path's colour on import | Phase 0 | S | In review (local implementation already present; SVG parsing and legacy sanitization tests pass) | Codex | no push |
| T7.3 | Region model and default roles | T7.2 | M | In review (local pure model, default roles, disjoint nested polygons and disabled-region geometry; focused tests pass) | Codex | no push |
| T7.4 | The colour bar | T7.3 | M | Implemented locally: inclusion checkboxes, arrow navigation, role/card/alignment controls and independent settings. Phone selection opens the region panel. Regression review deferred. | Codex | no push |
| T7.5 | Apply and Export | T7.4 | M | Implemented locally: worker progress, whole-piece Apply, header Export and stale-state gating. Single-pattern workflow still generates automatically. | Codex | no push |
| T7.6 | Building a piece from regions, with seams | T7.3, T4.1, T1.8 | L | Implemented locally: seams/attachments, holes, solids, line passes, region reports, layer and clearance ordering; first pause plan wins with a warning. Full acceptance deferred. | Codex | no push |
| T7.7 | Regions in links, files and swatch codes | T7.6 | S | Implemented locally: derived membership, per-card sanitization, explicit colour/URL limits, complete files/links, hashes and G-code metadata. Validation deferred. | Codex | no push |

## Phase 8: Physical validation

| Ticket | Title | Owner | State |
|---|---|---|---|
| T8.1 | Swatch records and the *Tested* badge | implementer + Luis | Software record downloads implemented; records say Not printed. The Tested-badge rule is enforced in software (`swatch-records.js`, `swatch-records.test.js`): a card may be Tested only with a good, successful, dated record approved by Luis in `docs/swatches/`; the template has an Approved by line. Physical evidence and Luis approval remain user-gated. No badges promoted. |
| T8.2 | Comparison sets | Luis + implementer | ZIP generation implemented for Rings, Grid, Bonding, Layers and Waves: exact-size G-code and blank records. Physical prints pending. |
| T8.3 | Calibration for the new capabilities | Luis + implementer | ZIP recipes implemented for lift/fan, channels, climbing, bridges, thickness and exposure. Separate measured bed/over-net tables can be entered and saved/exported with a profile. No measurements or calibrated defaults invented. |

## Small items found along the way

| Item | Found | Size | State |
|---|---|---|---|
| ~~The source-offer tool normalised line endings only for `LICENSE`/`NOTICE` at the repository root~~ **Fixed in T1.8's branch:** files with those names in any folder are canonicalised, with a test that fails on the old rule. | reorganisation, 26 Oct 2026 | S | Done (local, `t1-8-support-carriers`) |
| Wave net bundles (bond control for the Squiggle generator) | T4.2 | M | Implemented locally: 1–5 strands, bonded/gapped spacing and a bonding field; validation deferred. |
| Collapsible Flat / Layered / Raised shelves and Pattern controls | Luis | S | Implemented locally; Flat opens by default. |
| ~~Resolve C13/T0.2 snapshot wording~~ **Resolved:** `families` stays in the snapshot schema. T0.0 records `[]`; T0.2 may change only the `families` field of every snapshot (every other field, including the G-code hash, must stay identical). Done that way. | T0.0 review, 26 Oct 2026 | S | Resolved |
| Done 28 Oct 2026 (Luis): estimates on every card and preset at 100 x 100 mm, side-view strip and "How a drawing prints" removed, page fits the window, Export G-code, simplest-first order, finer cell width (Re-entrant mesh, Honeycomb · flat), name filter above the designs | Luis | S | Implemented locally (branch `filafabric-integration`). |
| 2D view that plays the print order, with the G-code building in the background; SVG export of the 2D view; slider limits tied to the nozzle bead (Luis, 28 Oct 2026) | Luis | M | Implemented locally (`filafabric-integration`, commit `b78e7da4`). Checked in the browser; Luis has not tried it. |
| Flat, single-layer versions of Truchet tiles, Turing stripes, Meander, Bouclé & picots and Parquet, without the backing (Luis, 28 Oct 2026). Each is the first layer on its own, marked **Needs a backing** (a new support label), with no backing controls. The backing itself is **not built**: Luis will supply it (a six-sack option for the back). | Luis | M | Implemented locally (branch `flat-variants`): `truchet-flat`, `turing-flat`, `meander-flat`, `parquet-flat`, `boucle-flat`. The two-layer cards are unchanged. |
| Flat versions of the Squiggle strand types (Wave net, Square-wave net, Figure-8 net, Zigzag mesh), a one-plane Rings · flat, and a design list that can be dragged wider (Luis, 28 Oct 2026). Every build stays its own card on its own shelf; nothing is nested. | Luis | M | Implemented locally (`filafabric-integration`): `squiggle-flat`, `square-net-flat`, `figure8-net-flat`, `zigzag-flat`; `designs-resizer.js`. |
| Print order on the Flat shelf: every row first, then the struts a column at a time (Honeycomb · flat, Re-entrant mesh · flat); layers printed one after the other; lines that meet joined into the fewest strokes (Rings · flat, Spiral cells, Kirigami, Isohedral tiles, Arrowhead band and others). The public `study.html` removed; its text is now a dialog in the studio (Luis, 28 Oct 2026). | Luis | M | Implemented locally (`filafabric-integration`): `strokesPerGroup` and `auxeticFlatLayers` in `engine/flat-variants.js`, the `singleLine` card option, `#study-dialog`. Fourteen output snapshots changed, each because its print order changed. |
| Truly flat versions of the cards listed as Flat that print two layers (Luis, 28 Oct 2026). Looped rows, Figure-8 rows, Re-entrant mesh, Honeycomb, Star lattice and Harmonograph keep their two-layer card (Layered shelf, or Raised for the two rows cards, whose strand lifts over itself) and gain a flat card in one layer with the same settings, as variants. Honeycomb and Re-entrant mesh are rebuilt as rows plus struts that end on the rows; the others join every crossing in the plane. | Luis | M | Implemented locally (branch `flat-variants`): `honeycomb-planar`, `auxetic-flat`, `coil-flat`, `figure8-rows-flat`, `starlattice-flat`, `harmonograph-flat`. Print them to compare the flat and layered builds. |

## Open decisions for Luis

| # | Decision | Default until confirmed | Where |
|---|---|---|---|
| 1 | ~~Branch-and-PR workflow~~ **Confirmed 26 October 2026:** pull requests into `library`; `library` goes to `main` only when the whole plan is done; `CLAUDE.md` updated | branches + PRs into `library`; Luis merges | [Handbook §2.1](../01_Team_Handbook.md#21-branches-and-merging) |
| 2 | Region borders: a printed seam line | seam on | [T7.6](../03_Tickets/Phase7_Drawing_Tools.md#t76-building-a-piece-from-regions-with-seams) |
| 3 | Coil's non-loop shapes: legacy only | legacy only | [T1.4](../03_Tickets/Phase1_Move_Existing_Designs.md#t14-coil-looped-rows-and-figure-8-rows) |
| 4 | ~~Ring mail renamed Rings · layered~~ **Applied 28 October 2026:** the card (id `chainmail`) now reads *Rings · layered* | renamed | [T1.10](../03_Tickets/Phase1_Move_Existing_Designs.md#t110-move-the-remaining-cards) |
| 5 | Parquet and Truchet visible with *Needs repair* | visible, never default | [T1.10](../03_Tickets/Phase1_Move_Existing_Designs.md#t110-move-the-remaining-cards) |
| 6 | Graded cells and bond masks as options, not cards | options | [plan §1](../../reports/FilaFabric_Pattern_Library_Plan_of_Action.md#1-what-was-decided) |
| 7 | *Print all variants* export | built | [T5.7](../03_Tickets/Phase5_Raised_Cards_and_Comparisons.md#t57-print-all-variants) |
| 8 | Phase order | as above | [plan §7](../../reports/FilaFabric_Pattern_Library_Plan_of_Action.md#7-order-at-a-glance) |
| 9 | Old links with a global backing on a self-supporting card: drop the extra backing | dropped, with a note | [T1.8](../03_Tickets/Phase1_Move_Existing_Designs.md#t18-support-section-and-one-carrier) |
| 10 | Colour plan when regions ask for different filament changes | first region's plan, with a warning | [T7.6](../03_Tickets/Phase7_Drawing_Tools.md#t76-building-a-piece-from-regions-with-seams) |
| 11 | Which current cards are already printed (for *Tested* badges) | none except Bubbles once recorded | [T8.1](../03_Tickets/Phase8_Physical_Validation.md#t81-swatch-records-and-the-tested-badge) |
| 12 | ~~The nine measured shelf exceptions: relabel each card, or change how it prints~~ **Resolved 28 October 2026 (Luis):** change how they print. The four that measured layered (Re-entrant mesh, Honeycomb, Star lattice, Harmonograph) are now declared layered and have a flat card beside them; Looped rows and Figure-8 rows are declared raised (a strand lifts over itself) and have a flat card beside them. The remaining exceptions (Dip weave, Looped net, Squiggle rings, Voronoi, Spirograph, Kirigami, Scales, Colour exposure, and Looped rows and Figure-8 rows, whose envelope is only 0.4 mm) are unchanged. | | [T0.3](../03_Tickets/Phase0_Foundations.md) |
| 13 | ~~Isohedral tiles: vendor the Tactile library or implement starter families~~ **Resolved 27 October 2026:** use TactileJS; BSD 3-Clause reviewed, Luis approved; source pinned under `site/vendor/tactile/` | TactileJS, pinned | [T2.11](../03_Tickets/Phase2_New_Flat_and_Layered_Cards.md#t211-f-12-isohedral-tiles-isohedral-tiles) |
| 14 | An old link with the global backing switched on, opened on Meander, Turing or Your drawing: becomes a two-layer zigzag carrier (the old mesh cannot be reproduced exactly), or is dropped everywhere | zigzag carrier on those three, dropped elsewhere | [T1.8 review](T1_8_Local_Review.md#decisions-for-luis) |
| 15 | Free line ends in the new cards: Spiral cells has 32 along the sheet edge (its arms stop 2 mm inside the edge and it has no border option); Voronoi cells (12) and Stochastic net (9) have interior dead-end stubs from their random structure. Add a border or prune the stubs, or accept them | accepted as they are (they are reported, not blocked) | [T2.5–T2.14 review](T2_5_to_T2_14_Local_Review.md) |
