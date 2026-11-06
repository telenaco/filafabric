# Phase 8: Physical validation (runs alongside every phase)

**Goal:** turn *Untested* into *Tested* with real swatches, and calibrate the new capabilities for TPU. Luis prints; the team supplies the files, the record format and the bookkeeping. **No card's mechanics are claimed until this phase has a record for it.**

| Ticket | Title | Owner | Size |
|---|---|---|---|
| T8.1 | Swatch records and the *Tested* badge | implementer + Luis | S |
| T8.2 | Comparison sets | Luis (prints), implementer (files) | ongoing |
| T8.3 | Calibration for the new capabilities | Luis + implementer | ongoing |

---

## T8.1 Swatch records and the *Tested* badge

**Implementation**
1. **Record format:** a Markdown file per swatch in `docs/swatches/` (new folder), following the style of `docs/foamy-calibration.md`. Each record holds:
   - the swatch code (from the export), card ID, settings hash, machine and material profile;
   - the date and who printed it;
   - photos (both faces, flat and draped, on the same support);
   - measurements (below);
   - a verdict: *good*, *usable with notes* or *failed*, with the reason.
2. **Badge:** a card's `state` becomes `'tested'` only in a PR that links at least one *good* record for it. **Luis approves that PR.**
3. **First task:** Luis lists which current cards he has already printed successfully (for example Bubbles, which the audit says prints well). Make one record per card, with whatever photos exist.

**Measurements** ([catalogue swatch protocol](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#implementation-order-and-swatch-evidence)):
- equal outside size; the same material batch; areal mass (g/m²);
- actual strand width and crossing height (calipers, at 5 points);
- low-force extension along both axes and on the bias, then unloading and recovery after 1 and 10 cycles;
- **drape:** a 30 cm disc on an 18 cm support if the size allows (Cusick-style), otherwise Kalman's 10 cm disc with 1.5 g perimeter weights, photographed from 12 angles 30° apart. Report the drape coefficient and the number of folds;
- **for raised cards:** measured Z envelope, any nozzle dragging or snagging, and whether masked crossings actually move (lifted, sliding).

---

## T8.2 Comparison sets

**Why:** the papers predict that the variants differ, but none tested these exact builds (plan §3). Each set is printed with *Print all variants* (T5.7) where possible, so that the settings are identical.

| Set | Cards | What to compare | Paper prediction to check |
|---|---|---|---|
| Rings | `rings-flat`, `chainmail` (layered), `rings-raised` | stretch both axes, drape, recovery | more fused contact = stiffer (Pattinson, [Paper 66](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-66-pattinson-2019--biomechanically-tailored-meshes-for-compliant-wearable-and-implantable-devices)); raised may be stiffer than expected (Laput, [Paper 36](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-36-laput-2015--3d-printed-hair-soft-strands-fibers-and-bristles)) |
| Grid | `crosshatch`, `grid-lifted`, `grid-sliding` | shear (on the bias) and drape, not just along the strands | same along the strands, very different in shear (Li, [Paper 67](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-67-li-2022--programmable-digital-weaves)); lifted drapes more (Pattinson) |
| Bonding | Grid with 5-strand bundles: touching vs gapped (T4.2) | low-strain stiffness | gapped about 5× softer (Pattinson p. 7) |
| Layers | `rotated-stack` at 0.1 / 0.15 / 0.3 mm layers, same total thickness | stretch to break | fewer, thicker layers stretch further (Lu, [Paper 69](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-69-lu-2022--modeling-and-characterization-of-3d-printed-flexible-mesh-structure-for-wearable-interface)) |
| Waves | `squiggle` vs `wave-bridged` | drape and stretch | — (new) |

**Output:** one record per piece (T8.1), plus a short summary per set in `docs/swatches/comparisons.md`, stating whether the prediction held for Foamy or NinjaFlex 85A.

---

## T8.3 Calibration for the new capabilities

These numbers start as paper values or guesses and must be calibrated for FilaFabric's materials **before the cards' defaults are trusted**. Each calibration is a small set of test pieces exported from the card with one setting varied.

| Capability | Vary | Starting values | Measure | Done when |
|---|---|---|---|---|
| Lifted crossings (T4.3) | lift 0.5 / 1.0 / 1.5 mm, fan 0 / 60 / 100 % | none in Pattinson | do lifted crossings separate by hand? sag under the span? | a lift and fan setting where ≥ 90% of crossings separate cleanly |
| Sliding channels (T4.5) | span lift 0.8 / 1.0 / 1.2; channel lift 1.6 / 2.0 / 2.4; nozzle temperature at the profile's low end | Li's PLA: +1.0 / +2.0 mm, 180 °C, fan off | does the captive strand slide? channel fused to the base strand? | strands slide with a light pull and channels stay attached |
| Climbing overlaps (T4.6) | level height 0.2 / 0.3; ramp 1 / 1.5 / 2.5 mm | layer height, 1.5 mm | do climbing rings bond to the ones below without dragging? | no dragging; the levels are visible |
| Bridged crossings (T4.4) | fillet radius 0.6 / 1.0 / 1.6 | Kim & Lee rule | bridge sag, touchdown | bridges hold their shape |
| Thickness (halftone) (T1.6) | thin and thick flow factors on a tone wedge | Gispan: separate bed and over-net maps | measured widths at each step (bed and over net) | a width table per material, stored in the profile |
| Two-colour exposure (T5.6) | exposure height 0 / 0.1 / 0.2 / 0.3 | — | visible tone change | a usable tone range |

**Where results go:** calibrated defaults go into the material profiles (`site/profiles/materials/*.json`) or the card's defaults, **in their own PR**, linking the swatch records. Never change a default without a record.
