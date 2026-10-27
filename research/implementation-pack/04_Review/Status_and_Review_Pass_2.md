# Status and review pass, 27 October 2026 (afternoon)

Reviewed by Claude (technical lead) while a second Codex session was still working in the same worktree. Nothing here is pushed.

## Where things stand

**Committed locally** on `t1-8-support-carriers`, nine commits on top of T1.7 (nothing pushed):
1. T1.8
2. T1.9 and T1.11
3. T7.1 and T7.2
4. T2.1–T2.10, T2.12–T2.14 and T3.1
5. T2.11 (TactileJS)
6. the raised engine: T4.1–T4.7 and T5.0
7. T5.1, T5.5 and T5.7
8. T3.2–T3.5, with the review fixes below
9. T7.3, the T6.2 diagnosis, the T8.1 template, this note and the board

Each commit was built from its own tree with its own output snapshots, printability data and source archive, and its full suite passed. The Phase 2 cards are one commit because they share one registry, one test list and one printability dataset. T7.4's colour-bar UI is not built; only its pure model is.

## What was checked

- The full suite on a consistent copy of the live tree: **1,262 tests, 1,251 pass, 0 fail, 11 skipped**, after regenerating the output snapshots, the printability data and the source archive (the way the second session will have to finish). Before that regeneration the only failures were the stale `weave` snapshot fingerprint and the stale archive.
- Every one of the 225 snapshot cases (every card and preset at 40 × 30 mm) passes the export gate.
- A browser pass of all 56 gallery cards at 1280 px and at 375 px: no script errors, Export enabled, no horizontal overflow. The Print all variants dialog and the weave draft editor were opened and used.
- A property sweep (defaults, presets, every slider at its minimum and maximum, 100 × 100 mm) of Step lace, Paired loops, Scales, Corrugation, Rings · raised, Isohedral tiles and Weave.

## Defects found and fixed (uncommitted, in the live tree)

| Where | What was wrong | Fix |
|---|---|---|
| `research-designs.js` (T3.3) | `r2` was used by Paired loops and never imported, so every card's slider readouts threw on every change. | Imported it. `card-readouts.test.js` calls every card's readouts at its default and in every preset; it fails without the fix. |
| Scales (T3.4) | Every layer is a solid fill: about 440,000 points at 100 × 100 mm. The studio sat on "Updating" for minutes and the smallest tile size never finished. | Oversized sheets are refused in plain words (limit 260,000 points), and the default recipe is one carrier layer and two tile layers (about 20 s at 100 mm) instead of the ticket's 2 + 4. Every card opens at 100 × 100 mm (a test enforces it), so the swatch stays at 100 mm. `scales-budget.test.js`. |
| Paired loops (T3.3) | Neighbouring loops overlapped by a fixed fraction: the smallest loops barely touched and a wide row pitch left the rows apart, so up to 23 pieces at the ends of the sliders. | Overlap never drops below 0.7 mm; the default is unchanged. `paired-loops-connected.test.js`. |
| `order.js` (T4.1) | `Math.max(...every point)` overflowed the stack: Rings · raised with 3 mm rings crashed with "Maximum call stack size exceeded". | A loop instead. `order-limits.test.js` fails on the old line. |
| `order.js` (T4.1) | The search for a cut that breaks a nozzle-clearance cycle tried every cut point against a full re-check of the sheet: Rings · raised with 3 mm overlap ran for over a minute. | Past about 200 candidate cuts only every nth is tried, and the whole search is bounded by the work done (points re-checked), which is the same on every machine. Ordinary cases are unchanged (the snapshot and the 21 raised-engine tests pass); the 3 mm overlap case takes 14 s. |
| Print all variants dialog (T5.7) | Sizes and positions showed as `76.49999999999999 × 76.49999999999999 mm at (86.49999999999999, 0)`. | Rounded to 0.1 mm for display; the layout is unchanged. |

## Open items

- **Scales default.** The ticket's table says 2 carrier layers and 4 tile layers. That is about 440,000 points and a preview of well over a minute, so the card opens with 1 + 2 instead. Luis could accept that, or ask for a cheaper solid fill (the points come from 0.5 mm steps along straight fill lines).
- **Slow at the end of a slider:** Rings · raised with 3 mm rings (33 s, 2,565 rings), Paired loops with 2 mm loops (15 s), Scales with the ticket's 2 + 4 layers at 60 mm and above.
- **Weave** has a stale snapshot fingerprint until the second session runs `npm run snapshots`; G-code is unchanged.
- **Preview of heavy cards** is a worker with a Cancel button, so the page stays usable, but there is no time estimate.
- No physical print has been made for any card; every figure is a geometry estimate.
