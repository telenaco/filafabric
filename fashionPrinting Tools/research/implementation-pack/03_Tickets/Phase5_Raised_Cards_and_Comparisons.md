# Phase 5: Raised cards and comparison prints

**Goal:** six Raised cards built from the Phase 4 capabilities, and the *Print all variants* export that puts a style's Flat, Layered and Raised versions side by side on one bed (decision D12, **[call 6]**).

**Depends on:** Phase 4, T2.3 (Rings · flat), T1.5 (Grid & isogrid) and T1.6–T1.7 (Pattern, Colour).

| Ticket | Card / feature | ID | Builds on | Size |
|---|---|---|---|---|
| T5.0 | A strand transform hook in the result builders | — | — | S (do first) |
| T5.1 | R-01 Rings · raised | `rings-raised` | T2.3 + T4.6 + T4.1 | M |
| T5.2 | R-09 Grid · lifted crossings | `grid-lifted` | L-08 + T4.3 | M |
| T5.3 | R-10 Grid · sliding channels | `grid-sliding` | L-08 + T4.5 | M |
| T5.4 | R-11 Wave net · bridged crossings | `wave-bridged` | L-01 + T4.4 | S |
| T5.5 | R-12 Corrugation | `corrugation` | `relief.js` | M |
| T5.6 | R-13 Colour exposure texture | `colour-exposure` | T1.6 + T1.7 + T8.3 calibration | M |
| T5.7 | Print all variants | — | T0.7 | M |

---

## T5.0 A strand transform hook

**Why:** the raised capabilities work on strands after the crossings settle and before ordering, colour and emission. Today each result builder (`layeredResult` in `site/src/engine/layers.js`, `generateSquiggle` in `site/src/engine/squiggle.js`) goes straight from settling to emission.

**Implementation**
- Add an option `transform: (strands, cfg) => strands` to `layeredResult` and `generateSquiggle`. Apply it after `resolveCrossings` (or `finishFabric`'s resettle, for Squiggle) and before `clearanceOrder`, `applyColourPlan` and `emitStrands`.
- In `layered()`, a card's `build()` may return `extra.transform`, which `generate` passes through.
- **Default: none,** so snapshots are unchanged.

**Tests:** a no-op transform gives identical G-code; a transform that raises every point by 0.1 mm raises the emitted Z by 0.1 mm.

---

## T5.1 R-01 Rings · raised (`rings-raised`)

**What it is:** the same rings as Rings · flat, built so that each ring climbs over the rings printed before it (T4.6). **Shares `settingsKey: 'rings'`** with `rings-flat` and `chainmail`, so the same ring size and overlap can be printed three ways.

**Card**
- `build`: `ringsLayers(...)` (T2.3) gives the ring paths. Order them by the chosen build order; then `extra.transform = (strands, cfg) => climbOverlaps(...)`, followed by `clearanceOrder` (T4.1, `extra.clearanceOrder: true`).
- **Metadata:** shelf `raised`, family `rings`, support `self`; *joins: Each ring climbs over the rings printed before it, building up in levels.*; sources `{ papers: [31, 36] }` and the note *"Luis's construction; not from a paper"*.

**Settings** (added to the shared `rings` controls; the other variants ignore them):

| key | label | default | range | section |
|---|---|---|---|---|
| `buildOrder` | Build order | `rows` | choice: rows (staircase), checker (two levels), spiral (from the centre) | Structure |
| `levelHeight` | Level height | layer height | 0.15–0.4 mm | Look and feel |
| `maxLevels` | Most levels | 4 | 2–6 | Look and feel |
| `rampLength` | Ramp length | 1.5 | 0.8–4 mm | Look and feel |

**Checks**
- With identical shared settings, `rings-flat`, `chainmail` and `rings-raised` produce different side views: one level, two levels, and up to `maxLevels`.
- The construction report's `levels.max ≤ maxLevels`.
- `clearanceOrder` reports no conflicts at defaults.
- **Note when `clipped > 0`:** *"Some rings could not climb higher and fuse into the layer below."*

---

## T5.2 R-09 Grid · lifted crossings (`grid-lifted`)

**Source:** Pattinson et al. 2019, [Paper 66](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-66-pattinson-2019--biomechanically-tailored-meshes-for-compliant-wearable-and-implantable-devices), p. 13; [catalogue M9](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m9--bond-masks-and-release-zones-new-24-october-2026).

**Card**
- Geometry from `crosshatchLayers` (the `grid` settings: directions, spacing).
- `extra.transform` = `liftCrossings` (T4.3) with the card's mask, then `clearanceOrder`.
- **Shares `settingsKey: 'grid'`** with `crosshatch` and `grid-sliding`.

**Settings**

| key | label | default | range | section |
|---|---|---|---|---|
| `liftWhere` | Which crossings lift | `all` | choice: all, alternate (checkerboard), by pattern | Structure |
| `lift` | Lift height | 1.0 | 0.4–2.0 mm | Look and feel |
| `liftLength` | Ramp length | 3.0 | 1–8 mm | Look and feel |
| `liftFan` | Fan on lifted strands | 60 | 0–100 % | Advanced |

*By pattern* uses the Pattern source with the effect `bonding` (C6): dark crossings stay bonded, light ones lift.

**About text:** *"The later strands lift over the earlier ones and land after they have cooled, so those crossings stay unbonded. Pattinson's unbonded mesh drooped about 230% more than its bonded twin. The lift height here is a starting value: Pattinson does not give one."*

**Checks:**
- The report's `lifted` count equals the crossings selected by `liftWhere`.
- The lifted Z is right (T4.3's tests apply).
- The side view shows lifts.
- **The card warns when the profile's fan is 0 and `liftFan` is 0:** *"Lifted strands need cooling to stay unbonded."*

---

## T5.3 R-10 Grid · sliding channels (`grid-sliding`)

**Source:** Li et al. 2022, [Paper 67](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-67-li-2022--programmable-digital-weaves).

**Card**
- Geometry from `crosshatchLayers`, **two-direction sets only** (0/90, 45/135, 60/120). Li's method does not handle crossings of more than two strands, so three-direction sets are disabled with that hint.
- `extra.transform` = `slidingChannels` (T4.5) with the card's mask, then `clearanceOrder`.
- Shares `settingsKey: 'grid'`.

**Settings**

| key | label | default | range | section |
|---|---|---|---|---|
| `slideMask` | Which strands slide | `b` | choice: second direction slides (Li's grid), first direction slides, alternate (Li's Type 3 idea), by pattern | Structure |
| `spanLift` | Raised strand height | 1.0 | 0.6–2.0 mm | Look and feel |
| `channelLift` | Channel height | 2.0 | 1.2–3.0 mm | Look and feel |
| `legBefore` | Channel length | 1.2 | 0.8–3 mm | Advanced |
| `channelSpeed` | Channel speed | 3.3 | 1.5–6 mm/s | Advanced |

- **Sanitiser:** the grid spacing must be at least `legBefore × (1 + legAfterFactor) + bead`; otherwise the channels of neighbouring crossings overlap. Clamp the spacing and show a note.
- **By pattern** gives three states from the picture: dark → fused, mid → first slides, light → second slides.

**About text:** *"Each crossing gets a small printed channel that holds one strand while letting it slide along its length. Fused and sliding grids feel the same pulled along the strands but very different in shear and drape. The settings are Li's PLA values; TPU has not been tested."*

**Checks:**
- With Li's numbers at 4 mm pitch, the counts and heights match T4.5's tests.
- The report shows `channel` crossings.
- **The relief is about 2–2.5 mm:** the verdict states the Z envelope.

---

## T5.4 R-11 Wave net · bridged crossings (`wave-bridged`)

**Source:** Kim & Lee 2025, [Paper 31](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-31-kim-lee-2025--continuous-textile-structures-utilizing-3d-printing).

**Card:** the Squiggle generator with `shape: 'wave'` (the `wave` settings, shared with `squiggle`), plus `transform` = `bridgeCrossings` (T4.4) and `clearanceOrder`.

**Settings:** `filletRadius` (*Bridge roundness*, 0.4–3 mm, default 1.0). The crossing height is shown, not set: *"crossing height h = line thickness + R/2 = 0.7 mm"*.

**Checks:** T4.4's tests apply; the side view shows the bridges; with identical settings, `squiggle` and `wave-bridged` differ only at the crossings.

---

## T5.5 R-12 Corrugation (`corrugation`)

**Source:** [catalogue N2](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#n2--shallow-corrugation-and-tactile-relief).

**What it is:** low, smooth ridges in Z over a base net, a bounded version of Relief. **Reuse `site/src/engine/relief.js`;** do not write a second relief generator.

**Card**
- Relief's generator, with a fixed sine field along a chosen direction, plus these limits:
  - rise at most 1.2 mm;
  - slope at most 0.35;
  - a base net under every crest (the relief base is mandatory and already crossed).
- **Metadata:** shelf `raised`, family `textures`, support `built-in`.

**Settings:** `rise` (0.2–1.2 mm, default 0.6), `wavelength` (4–30 mm, default 10), `direction` (0–180°), `baseOpenness` (Relief's base spacing).

**Checks:**
- `z.max − baseTop ≤ rise + 0.05`.
- The slope never exceeds 0.35.
- Every crest point has a base strand within 2 mm below it (horizontal distance).
- Snapshot added.

---

## T5.6 R-13 Colour exposure texture (`colour-exposure`)

**Sources:**
- [catalogue N3](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#n3--colour-exposure-through-shallow-texture);
- [catalogue M2](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m2--calibrated-two-colour-halftone-net);
- Gispan, [Paper 17](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-17-gispan-et-al-2026--halftoning-for-3d-printed-textile-nets).

**Gate:** start only after the two-colour halftone calibration swatches exist (T8.3), because the effect depends on measured widths.

**What it is:** two coloured line families (Colour → Two-colour halftone) where the upper family's height **and** thickness follow the picture, so more or less of the lower colour shows.

**Card**
- The Squiggle or Zigzag geometry, with `patternEffect: 'thickness'` (T1.6) and colour mode `halftone2` (T1.7).
- A `transform` adds a Z offset of `0…exposureHeight` to family L2's points, following the picture (dark = lower, exposing less of the bottom colour).
- **Metadata:** shelf `raised`, family `textures`.

**Settings:** `exposureHeight` (0–0.4 mm, default 0.2), plus the thickness effect's `thin` and `thick`.

**Checks:**
- With `exposureHeight = 0` the card equals the halftone Wave net (identical G-code).
- `z.max` is within the envelope.
- No family-L2 point floats more than `exposureHeight` above the strand below it.

---

## T5.7 Print all variants

**Why:** decision D12. Print the same style built several ways on one bed, with identical settings, so they can be compared by hand.

**Files:** `site/src/engine/design-export.js`, `site/src/ui/main.js` (export flow), `site/src/ui/panels.js` (the header button), `site/src/ui/file-name.js`, `dev/tests/variants-export.test.js` (new)

**Implementation**
1. The header button *Print all variants* appears when `variantsOf(id).length > 1` (T0.7).
2. **Generate** each variant with the shared settings at the current swatch size.
3. **Layout:**
   - place the pieces left to right, 10 mm apart, on the bed of the current machine profile (the MK3S bed is 250 × 210 mm);
   - if they don't fit, scale the swatch size down until they do, keeping the aspect ratio and a minimum of 40 × 40 mm, and tell the user the size used;
   - if they still don't fit, refuse with a message.
4. **One G-code file:** the pieces are printed one after another, with a travel and a Z hop between them, and the colour plan applied per piece. Each piece starts with a comment `; piece N: <card id> <settings hash>`.
5. **File name and swatch code:** `<family>-variants-<hash>.gcode`. The swatch record lists each piece, its card, its position and its settings hash.
6. **The preview** shows all pieces before export (a dialog with the 2D overview).

**Tests**
- Three variants of `rings` fit at 60 × 60 mm.
- The pieces don't overlap; each piece's strands are an offset copy of that variant's own result.
- The comments list the pieces.
- An oversized request is refused with a message.

**Acceptance:** Luis can print Rings · flat, Rings · layered and Rings · raised from one button.
