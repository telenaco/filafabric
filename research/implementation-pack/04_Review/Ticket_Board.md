# Ticket board

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
| T1.5 | Cells and grids | T1.1 | M | ∥ | Blocked | | |
| T1.6 | Pattern section; halftone as Line thickness | T1.2, T1.5 | L | | Blocked | | |
| T1.7 | Colour section and colour plan | T1.1 | M | ∥ | Blocked | | |
| T1.8 | Support section and one carrier | T1.1 | L | ∥ | Blocked | | |
| T1.9 | Look and feel labels and help text | T1.2–T1.5 | S | | Blocked | | |
| T1.10 | Move the remaining cards | T1.1 | M | ∥ | Blocked | | |
| T1.11 | Library QA pass | all of Phase 1 | S | | Blocked | | |

## Phase 2: New Flat and Layered cards (all ∥ with each other, except T2.5 after or with T2.4)

| Ticket | Card | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T2.1 | L-09 Rotated stack | Phase 1 | M | Blocked | | |
| T2.2 | L-10 Moiré net | Phase 1 | S | Blocked | | |
| T2.3 | F-01 Rings · flat | Phase 1 | M | Blocked | | |
| T2.4 | F-06 Rotating squares | Phase 1 | M | Blocked | | |
| T2.5 | F-07 Rotating triangles | T2.4 helpers | M | Blocked | | |
| T2.6 | F-08 Arrowhead band | Phase 1 | M | Blocked | | |
| T2.7 | F-09 Spiral cells | Phase 1 | M | Blocked | | |
| T2.8 | F-10 Stochastic net | Phase 1 | L | Blocked | | |
| T2.9 | F-15 Voronoi cells | Phase 1 | S | Blocked | | |
| T2.10 | F-11 Star-metric cells | Phase 1 | L | Blocked | | |
| T2.11 | F-12 Isohedral tiles (licence gate) | Phase 1 + licence check | L | Blocked | | |
| T2.12 | F-13 Connected lace | Phase 1 | L | Blocked | | |
| T2.13 | F-14 Meander with ties | Phase 1 | M | Blocked | | |
| T2.14 | F-19 Kirigami sheet | Phase 1 | M | Blocked | | |

## Phase 3: Motif on carrier and weave

| Ticket | Card | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T3.1 | L-25 Lace + backing | T1.8, T2.12 | M | Blocked | | |
| T3.2 | L-26 Step, ripple and petal lace | T1.8 | M | Blocked | | |
| T3.3 | L-27 Paired loops | T2.1 (planes option) | M | Blocked | | |
| T3.4 | L-28 Scales on a carrier | T1.8 (T2.11 optional) | L | Blocked | | |
| T3.5 | L-19 Woven draft generator | Phase 1 | M | Blocked | | |

## Phase 4: Raised engine

| Ticket | Capability | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T4.1 | Print order from nozzle clearance | Phase 0 | M | Blocked | | |
| T4.2 | Bond control | Phase 0 | M | Blocked | | |
| T4.3 | Lifted crossings | T4.1 | M | Blocked | | |
| T4.4 | Bridged crossings | T4.1 (shares T4.3 helper) | S | Blocked | | |
| T4.5 | Sliding channels | T4.1 | L | Blocked | | |
| T4.6 | Climbing overlaps | T4.1 | L | Blocked | | |
| T4.7 | Raised reporting and preview | T4.3–T4.6 | M | Blocked | | |

## Phase 5: Raised cards and comparisons

| Ticket | Card / feature | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T5.0 | Strand transform hook | Phase 1 | S | Blocked | | |
| T5.1 | R-01 Rings · raised | T2.3, T4.6, T5.0 | M | Blocked | | |
| T5.2 | R-09 Grid · lifted crossings | T4.3, T5.0 | M | Blocked | | |
| T5.3 | R-10 Grid · sliding channels | T4.5, T5.0 | M | Blocked | | |
| T5.4 | R-11 Wave net · bridged | T4.4, T5.0 | S | Blocked | | |
| T5.5 | R-12 Corrugation | Phase 1 | M | Blocked | | |
| T5.6 | R-13 Colour exposure | T1.6, T1.7, T8.3 calibration | M | Blocked | | |
| T5.7 | Print all variants | T0.7 | M | Blocked | | |

## Phase 6: Repairs

| Ticket | Card | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T6.1 | Parquet | T0.3 | L | Blocked | | |
| T6.2 | Truchet tiles | T0.3 | M | Blocked | | |
| T6.3 | Meander and Turing | T0.3, T1.8 | M | Blocked | | |

## Phase 7: Drawing tools

| Ticket | Title | Depends on | Size | State | Owner | PR |
|---|---|---|---|---|---|---|
| T7.1 | Line alignment and pass spacing | Phase 0 | M | Blocked | | |
| T7.2 | Keep each path's colour on import | Phase 0 | S | Blocked | | |
| T7.3 | Region model and default roles | T7.2 | M | Blocked | | |
| T7.4 | The colour bar | T7.3 | M | Blocked | | |
| T7.5 | Apply and Export | T7.4 | M | Blocked | | |
| T7.6 | Building a piece from regions, with seams | T7.3, T4.1, T1.8 | L | Blocked | | |
| T7.7 | Regions in links, files and swatch codes | T7.6 | S | Blocked | | |

## Phase 8: Physical validation

| Ticket | Title | Owner | State |
|---|---|---|---|
| T8.1 | Swatch records and the *Tested* badge | implementer + Luis | Ready (record format can start now) |
| T8.2 | Comparison sets | Luis + implementer | Blocked (needs Phase 5) |
| T8.3 | Calibration for the new capabilities | Luis + implementer | Blocked (needs Phase 4) |

## Small items found along the way

| Item | Found | Size | State |
|---|---|---|---|
| The source-offer tool (`dev/tools/source-bundle.mjs`) normalises line endings only for listed text extensions and for files named exactly `LICENSE` or `NOTICE` at the root. A checkout with Windows line endings therefore fails the source-currentness test because of `site/vendor/three/LICENSE`. Treat any file named `LICENSE`/`NOTICE` in any folder as text. Not seen on Linux (GitHub, Cloudflare). | reorganisation, 26 Oct 2026 | S | Ready |
| Wave net bundles (bond control for the Squiggle generator) | T4.2 | M | Blocked (after T4.2) |
| Resolve C13/T0.2 snapshot wording: C13 records `families`, but T0.2 introduces those tags while requiring unchanged snapshots. See [T0.0 review note](T0_0_Local_Review.md#clarification-before-t02). | T0.0 review, 26 Oct 2026 | S | Reviewer clarification before T0.2 |

## Open decisions for Luis

| # | Decision | Default until confirmed | Where |
|---|---|---|---|
| 1 | ~~Branch-and-PR workflow~~ **Confirmed 26 October 2026:** pull requests into `library`; `library` goes to `main` only when the whole plan is done; `CLAUDE.md` updated | branches + PRs into `library`; Luis merges | [Handbook §2.1](../01_Team_Handbook.md#21-branches-and-merging) |
| 2 | Region borders: a printed seam line | seam on | [T7.6](../03_Tickets/Phase7_Drawing_Tools.md#t76-building-a-piece-from-regions-with-seams) |
| 3 | Coil's non-loop shapes: legacy only | legacy only | [T1.4](../03_Tickets/Phase1_Move_Existing_Designs.md#t14-coil-looped-rows-and-figure-8-rows) |
| 4 | Ring mail renamed Rings · layered | renamed | [T1.10](../03_Tickets/Phase1_Move_Existing_Designs.md#t110-move-the-remaining-cards) |
| 5 | Parquet and Truchet visible with *Needs repair* | visible, never default | [T1.10](../03_Tickets/Phase1_Move_Existing_Designs.md#t110-move-the-remaining-cards) |
| 6 | Graded cells and bond masks as options, not cards | options | [plan §1](../../reports/FilaFabric_Pattern_Library_Plan_of_Action.md#1-what-was-decided) |
| 7 | *Print all variants* export | built | [T5.7](../03_Tickets/Phase5_Raised_Cards_and_Comparisons.md#t57-print-all-variants) |
| 8 | Phase order | as above | [plan §7](../../reports/FilaFabric_Pattern_Library_Plan_of_Action.md#7-order-at-a-glance) |
| 9 | Old links with a global backing on a self-supporting card: drop the extra backing | dropped, with a note | [T1.8](../03_Tickets/Phase1_Move_Existing_Designs.md#t18-support-section-and-one-carrier) |
| 10 | Colour plan when regions ask for different filament changes | first region's plan, with a warning | [T7.6](../03_Tickets/Phase7_Drawing_Tools.md#t76-building-a-piece-from-regions-with-seams) |
| 11 | Which current cards are already printed (for *Tested* badges) | none except Bubbles once recorded | [T8.1](../03_Tickets/Phase8_Physical_Validation.md#t81-swatch-records-and-the-tested-badge) |
