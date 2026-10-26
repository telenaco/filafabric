# Phase 1: Move the existing designs into the library

**Goal:** every existing design becomes one or more library cards, all following the six-section panel. Squiggle's shapes become their own cards, halftone becomes a Pattern/Colour choice, the Colour and Support sections replace the old switches, and the labels follow the research. **No new geometry.**

**Snapshot rule:** a card that is the same generator with the same settings keeps an identical snapshot. Any change must be listed and explained in the PR.

Plan references:
- [Plan §4 (the template)](../../reports/FilaFabric_Pattern_Library_Plan_of_Action.md#4-the-card-and-its-panel-the-template-every-card-follows)
- [Plan §5 (card list)](../../reports/FilaFabric_Pattern_Library_Plan_of_Action.md#5-the-library-every-card)
- [audit](../../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md)

| Ticket | Title | Depends on | Size |
|---|---|---|---|
| T1.1 | Panel template: order check, Colour and Support kinds, card header | Phase 0 | M |
| T1.2 | Split Squiggle & Gyroid into seven cards | T1.1 | L |
| T1.3 | Zigzag net and the preset alias | T1.2 | S |
| T1.4 | Coil: Looped rows and Figure-8 rows | T1.1 | S |
| T1.5 | Cells and grids: Honeycomb · flat, Re-entrant, Star lattice, Grid & isogrid, Harmonograph | T1.1 | M |
| T1.6 | Pattern section: source and effect; halftone as Line thickness | T1.2, T1.5 | L |
| T1.7 | Colour section and colour plan | T1.1 | M |
| T1.8 | Support section and one carrier | T1.1 | L |
| T1.9 | Look and feel labels and help text | T1.2–T1.5 | S |
| T1.10 | Move the remaining cards | T1.1 | M |
| T1.11 | Library QA pass | all above | S |

---

## T1.1 Panel template: order check, Colour and Support kinds, card header

**Files:** `site/src/ui/panels.js`, `site/src/ui/styles.css`, `dev/tests/panel.test.js`, `dev/tests/library.test.js`

**Implementation**
1. **`panelOrderErrors(controls)`** implements Contract C2:
   - Walk the list and map each kind to its group number: `presets` → 0, `size` → 1, `choice` → 2, `sliders` → 3, `switch` directly after `sliders` → 3, `pattern` → 4, `colour` → 5, `support` → 6.
   - Report any decrease, any group (other than 2) appearing twice, any `shape` kind, and any `switch` with `key: 'colorChange'`.
2. **Registry test** (`dev/tests/library.test.js`): run it on every visible ready card. Keep an `ALLOWED_LEGACY` list of card IDs that may still fail; **each Phase 1 ticket removes its IDs from the list.** T1.11 asserts the list is empty.
3. **`ColourSection`** (new section kind `colour`, class extending the same base as `ChoiceSection`):
   - A row of options for the card's `colourModes` (C1; default `['one', 'face', 'per-layer']`).
   - *Per-layer* shows one colour swatch per printed layer (a native `<input type="color">` is fine), stored in `layerColours`.
   - Labels and hints:

     | id | label | hint |
     |---|---|---|
     | `one` | One colour | The whole piece in one filament. |
     | `face` | Face colour | The first layer, the side on the bed, in its own colour. Pauses once to change filament. |
     | `per-layer` | Colour per layer | Choose a colour for every layer. Pauses before each change. |
     | `halftone2` | Two-colour halftone | Each line family in its own colour, so the picture shows in two tones. |

4. **`SupportSection`** (new kind `support`): the controls of Contract C8. Style is a choice with thumbnails, then openness, depth, wavelength, layers and angle sliders.
   - For `support: 'built-in'` cards, render it read-only with the sentence *"This design prints its own carrier."*
5. **Card header** in `DesignPanel` (built on T0.4 and T0.7): side view; the `joins` line; "Also on"; and the badges (support, state). The *Print all variants* button comes in T5.7.
6. Add both kinds to `SECTION_TYPES`.

**Tests:** `panelOrderErrors` on good and bad fixtures; `ColourSection` and `SupportSection` read and write settings through the host binding the same way other sections do (copy an existing section test from `dev/tests/panel.test.js`).

**Acceptance:** the new kinds work on a fixture card; no live card uses them yet.

**Review focus:** the new sections follow the existing `Control` pattern (constructor with host and spec; `update()` and `redraw()`); accessibility of the colour inputs.

---

## T1.2 Split Squiggle & Gyroid into seven cards

**Why:** decision D5. No Strand shape section: each shape is its own card.

**Today:**
- Squiggle has a hand-written panel: about 30 `sq-` elements in `site/index.html` and about 22 references in `site/src/ui/main.js`.
- Its registry entry in `site/src/ui/designs.js` (id `squiggle`, `legacy: true`) has no `controls` and no `generate`; `main.js` calls `generateSquiggle(machine, material, params)` from `site/src/engine/squiggle.js`.
- Its settings: `SQUIGGLE_DEFAULTS` in `site/src/ui/squiggle-controls.js` (`mode`, `shape`, `width`, `height`, `pattern`, `spacing`, `amplitude`, `wavelength`, `colorChange`), and patterns `SQ_PATTERNS` (`uniform`, `gradientX`, `gradientY`, `centerSpot`, `waves`, the 13 fields, `image`).

**Files**
- `site/src/ui/squiggle-controls.js`: add a `defineControls` description
- `site/src/ui/designs.js`: replace the legacy entry with a factory
- `site/src/ui/main.js`: remove the squiggle panel code
- `site/index.html`: remove the `sq-` markup
- `dev/tests/squiggle-cards.test.js` (new); `dev/tests/design-snapshots.test.js`

**Implementation**
1. In `squiggle-controls.js`, build `SQUIGGLE = defineControls({ ranges: SQ_RANGES, defaults: SQUIGGLE_DEFAULTS, enums: { mode: ['cross', 'parallel'], shape: SHAPE_IDS, pattern: SQ_PATTERNS }, bools: ['colorChange'], describe })`, so it behaves exactly like `sanitizeSquiggle`.
   - Test: `SQUIGGLE.sanitize` gives the same result as `sanitizeSquiggle` on a set of inputs, including garbage.
2. In `designs.js`, add `squiggleCard({ id, name, shape, shelf, family, joins, settingsKey, hidden, legacy })`. It returns a registry entry with:
   - `controls`:
     - `size`;
     - `choice` for `mode`, titled *Structure*, with options Crossed / Parallel and today's hints;
     - `sliders` titled *Look and feel*: `spacing`, `amplitude`, `wavelength`, with the T1.9 labels;
     - `pattern` (`SQ_PATTERNS`);
     - `colour`.
   - `sanitize: (raw) => ({ ...SQUIGGLE.sanitize(raw), shape })`: the card's shape is forced.
   - `generate: (machine, material, s, ctx) => generateSquiggle(machine, material, { ...the same mapping main.js uses today, shape })`. Copy the mapping from `main.js` exactly; don't re-derive it.
   - `thumb` from a small generation, as `layered()` does.
3. Register the cards:

   | id | name | shape | shelf | family | settingsKey | hidden |
   |---|---|---|---|---|---|---|
   | `squiggle` | Wave net | `wave` | layered | waves | `wave` | no |
   | `square-net` | Square-wave net | `square` | layered | waves | `square-net` | no |
   | `honeycomb-layered` | Honeycomb · layered | `honeycomb` | layered | cells | `honeycomb` | no |
   | `figure8-net` | Figure-8 net | `figure8` | layered | loops | `figure8-net` | no |
   | `looped-net` | Looped net | `looped` | raised | loops | `looped-net` | no |
   | `squiggle-rings` | Squiggle rings (legacy) | `ring` | layered | rings | `squiggle-rings` | yes |
   | `squiggle-zigzag` | Squiggle zigzag (legacy) | `zigzag` | layered | waves | `squiggle-zigzag` | yes, unless T1.3 proves parity |

   The `joins` sentences:
   - Wave net: *Two wavy families cross and fuse where they meet.*
   - Square-wave net: *Two square-wave families cross and fuse.*
   - Honeycomb · layered: *Two half-hexagon families meet as cells.*
   - Figure-8 net: *Two figure-8 families cross and fuse.*
   - Looped net: *Loops circle over themselves and lift over the earlier pass.*
   - Squiggle rings: *Wavy ring families cross.*
4. **Remove the hand-written panel:** delete the `sq-` markup in `site/index.html` and the matching handlers in `main.js` (search for `sq-` and `state.squiggle`). The panel is now built by `DesignPanel`.
   - Keep the M600 behaviour through the Colour section (T1.7). Until T1.7 lands, keep a `switch key=colorChange` and leave the IDs in `ALLOWED_LEGACY`.
5. **Migration (T0.6):** `squiggle` with each shape maps to the cards above; `designs.squiggle` moves to `designs.wave`. Squiggle's `shape` key is now ignored except for picking the card.

**Tests** (`dev/tests/squiggle-cards.test.js`)
- For every shape, the new card's G-code equals today's `generateSquiggle` output for the same settings and shape (compare the hash with the T0.0 snapshot of `squiggle` with that shape; add those cases to the snapshot tool first, in this PR, *before* changing code).
- Each card's `sanitize` forces its shape.
- `panelOrderErrors` is empty for the five visible cards.

**Acceptance**
- The gallery shows Wave net, Square-wave net, Honeycomb · layered and Figure-8 net (Layered shelf) and Looped net (Raised shelf), with no Strand shape section.
- Old squiggle links open the right card with identical output.

**Review focus**
- Byte-identical output.
- Nothing of the old panel left in `site/index.html` or `main.js`.
- Undo/redo and share links work across the new cards.

---

## T1.3 Zigzag net and the preset alias

**Files:** `site/src/ui/basic-designs.js`, `site/src/engine/wavegrid.js` (read only), `site/src/ui/designs.js` (remove `zigzag-mesh`), `dev/tests/basic-designs.test.js`

**Implementation**
1. **Parity check:** for the same width, height, spacing, depth and wavelength, compare `zigzag` (in parallel and in cross mode) with `squiggle` + `shape: 'zigzag'`, by G-code hash.
   - If they are identical, `squiggle-zigzag` is not needed: map `squiggle` + zigzag to `zigzag`.
   - If they differ (expected), keep `squiggle-zigzag` hidden for old links, and the library shows only `zigzag`. Write the result in the PR.
2. On `zigzag`:
   - set `support: 'self'`, so the Support section and the global backing never appear (decision D7);
   - Structure: the existing `mode` choice (Side by side / Crossed);
   - add `colour` (T1.7) and `pattern` (T1.6, effects `['depth', 'thickness']`).
3. Remove the `zigzag-mesh` preset tile from `DESIGNS`. Its links go through T0.6.

**Tests:** `dev/tests/basic-designs.test.js` unchanged; a migration test for `zigzag-mesh`.

**Acceptance:** one Zigzag net card, with no backing option; old Advanced zigzag links still open.

---

## T1.4 Coil: Looped rows and Figure-8 rows

**Files:** `site/src/ui/designs.js` (the `coil` entry), `site/src/ui/coil-controls.js`, `dev/tests/coil-controls.test.js`

**Implementation**
1. `coil` becomes **Looped rows**:
   - `shape` forced to `'looped'` in `sanitize`;
   - the `shape` section removed from `controls`;
   - presets kept (Open chain, Overlapping and Dense; drop Zigzag cells, which uses another shape).
2. New card `figure8-rows`: the same entry with `shape: 'figure8'`, `settingsKey: 'figure8-rows'`, *Joins: One strand in rows of figure-8s; each touches the next row.*
3. New hidden card `coil-shapes`: today's full Coil card with its shape picker, for old links whose shape is wave, zigzag, square, honeycomb or ring **[call 2]**.
4. Metadata: flat shelf, family `loops`, support `self`.

**Tests:** outputs for looped and figure8 match today's Coil with those shapes; old Coil links with the other shapes open `coil-shapes` with identical output.

---

## T1.5 Cells and grids

**Files:** `site/src/ui/more-designs.js` (`auxetic`, `crosshatch`, `harmonograph`), `site/src/ui/line-designs.js` (`starlattice`), `dev/tests/auxetic.test.js`, `dev/tests/crosshatch.test.js`

**Implementation**
1. **`auxetic` → Re-entrant (bow-tie):**
   - force `cell: 'reentrant'`; remove the cell choice;
   - keep the presets Re-entrant and Deep auxetic;
   - *Joins: Bow-tie cells joined by struts; they widen when pulled.*
   - sources `{ catalogue: ['S4'], papers: [24, 26, 55] }`.
2. **New `honeycomb-flat`:** the same `auxeticLayers` with `cell: 'hexagon'`, `settingsKey: 'honeycomb'`, sharing a controls object with `honeycomb-layered` (T1.2), whose defaults include `rowPitch`, `period` and `amplitude` as well as Squiggle's keys (T0.7 contract).
   - *Joins: Hexagon cells share their walls in one pass.*
   - **Decision for the implementer to bring to review:** if sharing one controls object between an `auxetic`-based and a Squiggle-based card is awkward, propose giving `honeycomb-flat` its own settingsKey instead, and say why in the PR.
3. **`crosshatch` → Grid & isogrid · layered:**
   - unhide it; `settingsKey: 'grid'`;
   - remove the *Line shape* choice and the wave sliders from the card (straight lines only); old links with a wave size above zero keep their output through a hidden `crosshatch-wavy` card;
   - Directions stays as Structure;
   - sources `{ catalogue: ['S2'], papers: [29, 54, 9] }`.
4. **`starlattice`:** only metadata, and panel order fixes (move `pattern` after `sliders`).
5. **`harmonograph`:** the second-curve switch becomes a Structure choice, *One curve / Two curves*.
   - Keep the key `second`.
   - Metadata: flat shelf while `second` is false. **Ask in the PR whether a two-curve harmonograph should move to the Layered shelf as a variant;** default is no.

**Tests:** snapshots identical for the default settings and presets that survive; old links with removed options open the hidden cards with identical output.

---

## T1.6 Pattern section: source and effect; halftone as Line thickness

**Why:** decision D6, and Contract C6.

**Files**
- `site/src/engine/pattern-effects.js` (new)
- `site/src/engine/picture.js` (`patternField`)
- `site/src/engine/halftone.js` (`halftoneLayers`)
- `site/src/ui/panels.js` (`PatternSection`)
- `site/src/ui/pub-designs.js` (`halftone` becomes hidden)
- the build functions of `squiggle`, `zigzag` and `crosshatch`
- `dev/tests/pattern-effects.test.js` (new)

**Implementation**
1. `PATTERN_EFFECTS` as in C6. `PatternSection` shows:
   - the source picker, as today;
   - an **Effect** choice listing the card's `patternEffects` (hidden when only one);
   - the pattern scale slider.
2. **Default effects per card** (the first is today's behaviour, so snapshots stay identical):

   | Card | patternEffects |
   |---|---|
   | `squiggle`, `square-net`, `figure8-net`, `looped-net`, `honeycomb-layered` | `['depth', 'thickness']` |
   | `zigzag` | `['depth', 'thickness']` |
   | `crosshatch` | `['thickness']`; the pattern section is new here |
   | `bubbles`, `voronoi`, `starlattice` | `['size']` (today's grading) |
   | `relief`, `loop-pile` | `['height']` |
   | `meander` | `['size']` (dot grading) |
   | `flowlines` | keep today's turning behaviour, under the label *Direction*: add `direction: { label: 'Direction', hint: 'The lines turn one way where dark and the other where light' }` to `PATTERN_EFFECTS` |

3. **Thickness:**
   - Extract the tone-to-width mapping from `halftoneLayers` into `thicknessAlong(polyline, field, { thin, thick, bead })` in `pattern-effects.js`. It returns per-point `flow`, which `layersToStrands` already passes through (`q.flow`).
   - `halftoneLayers` calls the extracted function, so `halftone` output is unchanged.
   - The `squiggle`, `zigzag` and `crosshatch` builds apply it when `patternEffect === 'thickness'`.
   - Add sliders *Thinnest* and *Thickest* (keys `thin`, `thick`, the defaults from `halftoneLayers`: 0.6 and 1.8 × bead), shown only with this effect.
4. **Research rules to follow** ([catalogue M2](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m2--calibrated-two-colour-halftone-net), [Paper 17](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-17-gispan-et-al-2026--halftoning-for-3d-printed-textile-nets)):
   - width is set by extrusion (flow), not by speed;
   - clamp the flow change between neighbouring points to at most 25% per millimetre;
   - lines over another net get their own width scale, `overNet` = 0.85 × the bed value, from Gispan's measured 0.41–1.05 mm over the net against 0.44–1.25 mm on the bed.
5. **`halftone`** becomes hidden (old links open it unchanged, with a note pointing to Wave net → Pattern → Line thickness). Its *Second layer: Complement* moves to Colour → Two-colour halftone (T1.7).

**Tests**
- The default effect gives identical snapshots on every card.
- Thickness on `squiggle` produces flows within `[thin, thick] / bead`.
- `halftone` output is unchanged after the extraction.
- The per-millimetre clamp holds.

**Acceptance:** Wave net, Zigzag net and Grid offer Line thickness; Halftone net is gone from the gallery and still opens from old links.

---

## T1.7 Colour section and colour plan

**Why:** decision D8, and Contract C7.

**Files**
- `site/src/engine/colour-plan.js` (new)
- `site/src/engine/layers.js` (`layersToStrands` currently sets `pauseBefore` itself)
- `site/src/engine/stack.js` (`addExtraLayers` `colorChange`)
- `site/src/engine/emit.js` (reads `pauseBefore`; unchanged)
- `site/src/ui/main.js` (lines 421, 894, 917: `colorChange` uses)
- `site/src/ui/preview.js` (layer colours)
- every card's `controls` (`switch key=colorChange` → `colour`)
- `dev/tests/colour-plan.test.js` (new)

**Implementation**
1. `applyColourPlan(strands, { mode, layerColours })` as in C7:
   - **face:** `pauseBefore` on the first strand with `layer >= 1`, in print order. This must reproduce exactly where `layersToStrands` puts it today: `colorChange && k > 0 && i === 0`.
   - **per-layer:** compare `layerColours[layer]` with `layerColours[layer - 1]`; pause before the first strand of each layer that differs.
   - **halftone2:** pause before the first strand of the second native family (`family === 'L2'`, or the name the card gives).
   - **preview:** set `previewColour` on every strand from `layerColours`, or from the profile's filament colour when absent.
2. Remove `pauseBefore` logic from `layersToStrands` and `addExtraLayers`; call `applyColourPlan` once, after ordering and before `emitStrands`, in `layeredResult` and in the raised results.
3. Settings: `colourMode` (default `'one'`) and `layerColours` (default `[]`), added to every card's `defineControls` through a shared helper `withColour(c)` in `structure-controls.js`. T0.6 already migrates `colorChange: true` to `'face'`.
4. **Preview:** `preview.js` uses `previewColour` when present.
5. **Swatch record:** the export's G-code header comment lists the colour plan, for example `; colour plan: face (#f2e6d8 → #222222)`.

**Tests**
- `face` reproduces today's single M600 at the same move index (compare G-code from the T0.0 snapshot cases that had `colorChange: true`; add those cases to the snapshot tool first).
- `per-layer` with colours A, A, B gives one pause before layer 3.
- `halftone2` pauses before family L2.
- `one` gives no M600.

**Acceptance:** the Colour section replaces *Two colours* on every card; the M600 positions are unchanged for migrated links.

---

## T1.8 Support section and one carrier

**Why:** decision D7, Contract C8, and the audit's finding that today there are several overlapping backing systems ([audit, "There are several different backing operations"](../../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md#there-are-several-different-backing-operations)).

**Files**
- `site/src/engine/backing.js` (`backingStack`, `BACKING_MESH`, `addBackingMesh`)
- `site/src/ui/more-designs.js` (Meander and Turing native `backing` and `backingLayers` choices)
- `site/src/engine/svgdesign.js` and `site/src/ui/svg-design.js` (backing layers on top)
- `site/src/engine/fabric-result.js` (`reinforce`)
- `site/src/ui/panels.js` (`BackingCard`, line 857; `SupportSection`)
- `site/src/ui/main.js` (`backingFor()` at line 396 reads the global `state.print.backing`; it is passed to the export at line 652; `RAISED_DESIGNS` excludes raised cards today)
- `dev/tests/backing-mesh.test.js`, `dev/tests/support.test.js` (new)

**Implementation**
1. `carrierLayers(boundary, support)` in `backing.js` returns one or two polyline layers (C8), tagged `role: 'carrier'` (T0.2).
   - Styles `wave`, `gyroid` and `straight` reuse `backingLines`; `zigzag` reuses `waveLines(... shape: 'zigzag')` from `wavegrid.js`.
2. **Meander and Turing** (`support: 'auto'`):
   - replace their own *Backing*, *Backing wave* and *Backing layers* controls with the `support` section;
   - map their saved keys (`backing`, `backingLayers`, and the backing wave sliders) to `support` in T0.6's migration;
   - **keep their print order `motif-first`** (C8 `order`), because that is today's order and it has not been compared physically ([audit, "Decorative face and print order are different things"](../../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md#decorative-face-and-print-order-are-different-things));
   - snapshots identical.
3. **`svgdesign` (Your drawing):** its *Backing layers on top* and *Backing covers* become the `support` section plus a `support.area` choice (the whole swatch, the shapes only, the drawing's box). `support: 'auto'`. Unhide the card (L-24).
4. **Built-in carriers** (`spiral`, `boucle`, `relief`, `loop-pile`, `spacer`): `support: 'built-in'`; the section shows read-only text. No behaviour change.
5. **The global Backing mesh (`BackingCard`, stored in `state.print.backing`):**
   - replace the `RAISED_DESIGNS` test in `backingFor()` with the card's `support` policy;
   - hide it on cards with `support: 'self'` or `'built-in'`;
   - on `'auto'` cards it is replaced by the Support section;
   - remove `addBackingMesh` from the export path for `'self'` cards, and add a test that it never runs there;
   - keep `addBackingMesh` itself for migrated old links only (state with the global backing on, on a `'self'` card, opens with a note: *"This design no longer takes an extra backing; your link is shown without it."*). Ask Luis in the PR whether to keep it instead; the default is to drop it.

**Tests**
- No export contains two carriers: the construction report's `carrier.passes` is at most 2, from one source.
- Meander and Turing snapshots are identical.
- A `'self'` card never calls `addBackingMesh`.
- Support settings survive a share link.

**Acceptance**
- Zigzag net, Wave net and the other `'self'` cards show no backing anywhere.
- Meander, Turing and Your drawing show one Support section.
- Built-in cards say they carry their own.

---

## T1.9 Look and feel labels and help text

**Files:** every card's `sliders` items (`site/src/ui/*designs.js`, `structure-controls.js`, `squiggle-controls.js`, `coil-controls.js`), `dev/tests/panel.test.js` (label snapshots)

**Implementation:** apply the [plan's §4.4 table](../../reports/FilaFabric_Pattern_Library_Plan_of_Action.md#44-look-and-feel-names-with-what-the-papers-say). **Change the labels and help text only; never the keys.**

| Key (examples) | New label | Help text |
|---|---|---|
| `spacing` (line nets) | Gap between strands | The main softness control: a wider gap gives a softer, more open net. |
| `amplitude`, `depth`, `size` (waves) | Wave depth | How far it stretches before the strands pull straight. |
| `wavelength`, `pitch` (waves) | Wave length | With depth, how much slack each strand holds. |
| `strand` / flow sliders | Strand thickness | Thicker strands give a stronger, firmer net. |
| `overlap`, `rowOverlap` | Overlap | How much neighbours share at each join. More is stronger and stiffer; never let them touch at a point. |
| cell size keys | Cell size | Grade softness by changing cell size, not by thinning strands. |
| `directions` (choice hint) | Directions | 0/90 is soft on the bias; 60° grids feel the same in every direction. |
| height keys (raised) | Height | How high a strand rises over the one below. |

Keep each card's existing `lo` and `hi` end labels unless they contradict the new help text.

**Acceptance:** no slider keeps the old wording; share links are unaffected.

---

## T1.10 Move the remaining cards

**Files:** `site/src/ui/more-designs.js`, `line-designs.js`, `pub-designs.js`, `designs.js`

**Implementation:** for every card not handled above (`bubbles`, `voronoi`, `web`, `sunflower`, `rosette`, `spirograph`, `conformal`, `flowlines`, `spiral`, `weave`, `truchet`, `parquet`, `meander`, `turing`, `svgdesign`, `boucle`, `loop-pile`, `relief`, `dipweave`, `fringe`, `spacer`, `pillarweave`):
1. Reorder `controls` to Contract C2 (`panelOrderErrors` empty).
2. Replace `switch key=colorChange` with `colour`.
3. Add `pattern` only where the card already has one.
4. Set the metadata from the T0.1 table, and update names: `crosshatch` → Grid & isogrid · layered; `chainmail` → Rings · layered; `svgdesign` → Your drawing; `weave` → Woven draft; `coil` → Looped rows.
5. `truchet` and `parquet` keep `state: 'needs-repair'`; they are never selected by default **[call 4]**.
6. **The loop pile's hand-written panel:** move it to the shared panel like Squiggle in T1.2, if it fits the six sections.
   - If it needs more (its Advanced groups are extensive), keep its Advanced drawer as-is but put its primary controls in the template order.
   - Tell the reviewer which option you chose before starting.

**Acceptance:** `ALLOWED_LEGACY` in `dev/tests/library.test.js` is empty.

---

## T1.11 Library QA pass

**What:** open every visible card in the browser and check that:
- the preview renders;
- the side view and badges show;
- every section works;
- export runs;
- an old link (from the snapshot cases) opens the right card.

Record the results in the PR as a table: card, preview OK, export OK, notes. Fix what you can within Phase 1's scope; list anything else on the [board](../04_Review/Ticket_Board.md).

**Acceptance:** all cards pass, or each failure has a ticket.
