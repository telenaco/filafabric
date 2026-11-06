# T1.8 — Support section and one carrier: local review

**Ticket:** [T1.8](../03_Tickets/Phase1_Move_Existing_Designs.md#t18-support-section-and-one-carrier)
**Branch:** `t1-8-support-carriers`, stacked on `t1-7-colour-plan` (`4e85c8e4`). No push.
**Finished and reviewed by:** Claude (technical lead), 26 October 2026, completing work another agent left unfinished when it reached a usage limit. The first draft of the engine and panel work was theirs; the fixes and checks below are the review.

## What this does

Meander, Turing stripes and Your drawing now share **one Support section** with one canonical `support` setting (style wave, gyroid, straight or zigzag; openness, depth, wavelength, layers, angle; and for Your drawing, an on/off switch and what the carrier covers). Self-supporting cards show no backing control anywhere, and built-in cards say *"This design prints its own carrier."* The global **Backing mesh** card is gone, and no export can now carry two carriers. Your drawing is back in the gallery.

How it fits together:
- **One source of truth.** `support` is canonical (`site/src/engine/backing.js`: `carrierLayers`, `sanitizeSupport`, `legacySupport`). The old keys (`backing`, `spacing`, `angle`, `backingDepth`, `backingLength`, `backingLayers`, and the Your drawing `backing1…`/`backing2…` keys) are **derived from it** on every `sanitize`, so engine code and old tests that read them keep working. An old saved link carries only the old keys, and `sanitize` builds `support` from them. A test proves an old link prints the same G-code as the equivalent canonical `support` for all three cards.
- **Same output.** The G-code of Meander, Turing and Your drawing is byte-identical to the T0.0 snapshots (all 20 cases). Only the settings fingerprint changed, because the settings now include `support`; those three snapshot files were refreshed and nothing else.
- **Old global backing.** A link that had the global backing switched on is shown without it on self-supporting cards, with the note *"This design no longer takes an extra backing; your link is shown without it."* On the three carrier cards it becomes a two-layer zigzag carrier, with a note. `addBackingMesh` stays in `backing.js` as the ticket says, but nothing calls it.

## Changes made while finishing and reviewing

| What | Why |
|---|---|
| Updated the old SVG-design tests (`svgdesign`, `svg-edge-regressions`) to build settings from the old keys through `sanitize` | They spread `defaults()` (which now carries `support`) and then overrode `backing*` keys the engine correctly ignores. They now test the real old-link path. |
| Replaced the wave-edges test of the old global mesh with a bound that holds for every carrier style: with two layers, no edge leaves a gap wider than half the line spacing | The old mesh (two anti-phase zigzags in one direction) no longer exists; a carrier's second layer turns 90°, so its sides differ slightly by design. |
| **Shelf rule: carrier passes now count toward the layered height allowance** (`shelfFromConstruction`), and the Spiral, Bouclé and Turing exceptions were removed | Tagging Your drawing's backing as a carrier made it measure as *raised*. Four carrier cards had the same cause. Twelve exceptions became nine; no card changed shelf. |
| `support.order` is now always `motif-first` | `carrier-first` was accepted and saved but nothing implements it, so a link could promise an order that never prints. The audit says to offer one verified order until swatches compare them. |
| Removed the unused `BackingCard` panel class | Nothing imports it after the global backing card was removed. |
| Fixed the source-archive tool to treat `LICENSE`/`NOTICE` files in **any folder** as text, with a test that fails on the old rule | This is the "source-offer line endings" item on the board; it is what made the archive fail on Windows checkouts. |
| Refreshed `meander.json`, `turing.json`, `svgdesign.json` snapshots | `settingsHash` only (20 cases); gcode hash, strands, moves, heights, families and ties are unchanged. |
| Harmonograph: moved its *Structure* choice above *Look and feel*, and emptied the temporary panel-order allowance | A T1.5 miss: it was the one card still off the panel template. `ALLOWED_LEGACY` in `library.test.js` is now empty, which is what T1.11 asks for. |
| Added two tests to `support.test.js` | The honest support order, and old-link equivalence for all three cards. |

## Validation

- Before this work the branch's committed state (T0.0–T1.7) passed everything except the known stale source archive (1,106 of 1,118). The unfinished T1.8 working tree had 13 failures; all are resolved.
- Browser sweep of all 36 visible cards: each opens, generates, enables Export and shows its sections in the template order, with no script errors.
- Browser (desktop and 375 px): Meander, Turing and Your drawing each show one Support section with four styles and no other backing controls; Zigzag net shows none; Relief shows the read-only Support. Changing style, switching the carrier off, setting two layers and typing an invalid layer count all behave (motion estimate 5.7 → 6.5 → 2.8 → 6.5 → 11 min; the invalid count snaps back). No page errors; no horizontal overflow at phone width.

## Decisions for Luis

1. **The nine shelf exceptions** still need your approval. They are measured defaults, not physical-print validation: Auxetic, Honeycomb · flat, Star lattice and Harmonograph are declared Flat but print as two crossing families; Dip weave, Looped net and Squiggle rings differ in height from their declared shelf; Voronoi and Spirograph just exceed the layered ceiling. Each is a choice between relabelling the card and changing how it prints.
2. **Old global backing on the three carrier cards** becomes a two-layer zigzag carrier (the old mesh was two anti-phase zigzags in one direction, which the carrier cannot reproduce). Dropped entirely on every other card. Say if you would rather drop it everywhere.
3. **Source archive.** The archive is rebuilt as the last step so that the currentness test passes; any later source change makes it stale again, so every pull request must rebuild it.

## Not done

No push, no merge into `filafabric-library`, no physical print. Meander's and Turing's carriers have not been printed against each other in the other order, so `carrier-first` stays unavailable.
