# FilaFabric pattern library: plan of action

*26 October 2026. A plan only: nothing in the app has been changed by it. It turns the conversation of 26 October, the [pattern catalogue][CAT], the [research reference][REF] and the [existing-pattern audit][AUD] into numbered steps that can be implemented one at a time.*

This plan **supersedes one decision** in the 14 October library spec ([`docs/superpowers/specs/2026-10-14-fabric-design-library-design.md`](../docs/superpowers/specs/2026-10-14-fabric-design-library-design.md), §1 point 1): strand shapes are no longer variations inside a card. Each visibly different style becomes its own card with its own picture.

---

## 1. What was decided

| # | Decision | From |
|---|---|---|
| D1 | The left column stays a gallery of cards, **one card per style**, each with a picture of what it makes. Sixty or more cards is fine as long as each has its own clear picture. | Luis, 26 Oct |
| D2 | Cards sit on **three shelves**: **Flat (2D)**, one layer that joins in the plane; **Layered (2.5D)**, flat layers stacked so things cross at different heights, or a flat motif with a backing; **Raised (non-planar)**, strands that deliberately leave the plane. Raised is the area to grow. | Luis, 26 Oct |
| D3 | **One style can sit on more than one shelf.** Rings appears as *Rings · flat*, *Rings · layered* and *Rings · raised*. The variants **share their settings**, so the same rings can be printed three ways and compared by hand. | Luis, 26 Oct |
| D4 | Opening a card shows a **side view** and one line saying **how it joins**, above the panel. | Luis, 26 Oct |
| D5 | Every card's panel has the **same six sections in the same order**: Size and shape, Structure, Look and feel, Pattern, Colour, Support. Support appears only on cards that need a carrier. There is no Strand shape section. | Luis, 26 Oct (first mockup) |
| D6 | **Halftone becomes a Pattern/Colour choice**, not a design of its own. | Luis, 26 Oct |
| D7 | **Backing comes with the card.** Zigzag net never offers one, because it is one. Meander, Turing and Your drawing get theirs automatically. | Luis, 26 Oct |
| D8 | **Colour** means filament colour: the bottom layer, the face on the bed, can be a different colour, and more colours mean more layers in different colours. | Luis, 26 Oct |
| D9 | **Look and feel** controls are named and explained using what the papers measured. | Luis, 26 Oct |
| D10 | **Colour regions**, as in LightBurn: every colour in an SVG is listed in a bar next to *3D / 2D / 3D sample*, each with a tick box. Each ticked colour gets its own card and settings, for example denser under the arm. **Export becomes Apply**, and **Export moves next to Share** and writes the whole piece as one file. | Luis, 26 Oct |
| D11 | **Line alignment is FilaFabric's job**, not the SVG editor's: closed paths get *Inside / Centre / Outside*, open paths *Left / Centre / Right*. Stroke width sets the printed width. Bead width and pass spacing are kept as separate numbers. | Luis, 26 Oct (with the note he forwarded) |
| D12 | Print the variants of a style **side by side** and measure them. The papers predict different stiffness and drape, but none tested these exact builds (§3). | Luis + papers |

**Calls made in this plan for Luis to check** (each is marked **[call]** where it appears):

1. **Region borders.** Where two colour regions meet, a printed **seam line** runs along the border, and both patterns are clipped to it and tie into it.
2. **Coil.** Coil's wave, zigzag, square and honeycomb row shapes become legacy-only: old links still open them. The library keeps the loop shapes as cards.
3. **Ring mail** is renamed *Rings · layered*.
4. **Parquet and Truchet** stay visible with a *Needs repair* badge and are never a default.
5. **Graded cells** (catalogue M5) and **bond masks** (M9) become Pattern or Look and feel options, not cards.
6. **Trio export:** one button prints all of a style's variants on one bed.
7. **Order of the phases** in §6.

---

## 2. Where everything is

**Reports**
- [Pattern catalogue][CAT] has the candidate records S1–S7, M1–M9 and N1–N3, plus [edge and joining details][CAT-EDGE], [design rules][CAT-RULES], [process settings reported by the sources][CAT-SET] and the [swatch protocol][CAT-SWATCH].
- [Research reference][REF] has one entry per paper (Papers 1–69); section 5 of each entry gives the exact settings and page locators.
- [Existing-pattern audit][AUD] covers what each current design really prints: hidden carriers, ties, Parquet failures.

**Registry, where cards are defined** (pure data, tested in Node)
- [`src/ui/designs.js`][designs]: `DESIGNS`, `ESSENTIALS`, `galleryGroups()`.
- [`more-designs.js`][more], [`line-designs.js`][line], [`pub-designs.js`][pub], [`basic-designs.js`][basic], [`svg-design.js`][svgdesignUI].
- [`structure-controls.js`][structctl], [`squiggle-controls.js`][sqctl], [`coil-controls.js`][coilctl].

**Panel and shell**
- [`src/ui/panels.js`][panels]: section kinds `presets`, `size`, `choice`, `sliders`, `pattern`, `switch`, `shape`; also `SectionFold`, `BackingCard` (line 857) and the print setup.
- [`src/ui/main.js`][main]:
  - the gallery is built at line 1663;
  - `renderPreviewMode()` is at line 803;
  - Export is wired at lines 1221 and 2325, Share at 2327.
- [`index.html`][index]: the 3D sample button at line 107, Share at line 70, Export at line 284.
- [`thumbs.js`][thumbs] and [`option-thumbs.js`][optthumbs] draw the card and option pictures; [`share.js`][share] handles links and sanitising; [`verdict.js`][verdict] writes the crossing report text.

**Shared engine**
- [`layers.js`][layers]: `layersToStrands`, `layeredResult`, `hatch`, `clipPolyline`, `crossingReport`.
- [`fabric-result.js`][fabricresult]: `finishFabric`, with its `flat` and `reinforce` options.
- [`stack.js`][stack]: `nativeLayerInfo`, `addExtraLayers`, `stackStrands`.
- [`crossings.js`][crossings]: finds and resolves crossings.
- [`backing.js`][backing]: `backingStack` and the global `BACKING_MESH`.
- [`picture.js`][picture] and [`fields.js`][fields]: the pattern fields, 13 built-in plus Your picture.
- [`shapes.js`][shapes]: the seven strand primitives.
- [`emit.js`][emit]: writes `M600` at a strand's `pauseBefore` (line 57).
- [`drawing.js`][drawing]: SVG meaning, `linePasses`, `passesFor`, `offsetPolyline`.
- [`svg-parse.js`][svgparse]: `paintClass` (line 148) reduces each colour to red, blue, green, yellow or other.
- [`svg-lines.js`][svglines] and [`polygon-region.js`][polyregion].

**Tests**
- [`tests/`](../tests) holds 126 test files, plus fixtures and golden outputs, including `designs.test.js`, `golden.test.js`, `layers.test.js`, `crossings.test.js`, `pub-designs.test.js` and one test file per generator.
- The repo rule ([`CLAUDE.md`](../CLAUDE.md)) is that `npm test` passes and any UI change is checked in a browser (`npm run serve`, port 5173) before a push. Luis's standing instruction: commit only when asked, and never push unasked.

**Local reference files** (git-ignored)
- Li et al.'s G-code: [`Li-2022_Programmable-Digital-Weaves_GCode/`](Li-2022_Programmable-Digital-Weaves_GCode/) (`SlidingGrid.gcode`, `FusedGrid.gcode`, `CircleSliding.gcode`, `CircleFused.gcode`).
- The papers' PDFs are in this folder.

---

## 3. What the papers say about Flat vs Layered vs Raised

None of the papers tested these exact ring builds, but they agree on direction. Use this to word the cards and to set up the comparison prints, not to promise results.

| Finding | Source | What it means for the variants |
|---|---|---|
| Parallel strands printed touching were about 5× stiffer at low stretch than the same strands with a small gap (110 vs 20 N/m). | Pattinson, [Paper 66][P66], p. 7 | More fused contact means stiffer. Flat variants with large overlaps will be the stiffest. |
| Crossings left unbonded by lifting the nozzle drooped about 230% more as a cantilever and draped over a ball; the bonded twin did not. | [Paper 66][P66], p. 13 | Raised variants whose crossings land after cooling should drape more. |
| Fused and sliding grids behave the same pulled along the strands, but very differently in shear: fused buckles out of plane, sliding shears flat. Simulated diagonal stiffness 20.17 → 0 as crossings slide. | Li, [Paper 67][P67], pp. 4–5 | Test the variants on the bias and in drape, not only along the strands. |
| Covering same-layer crossings with more layers stiffens the sheet; printing both directions in one layer breaks strand continuity. | Diak & Diak, [Paper 9][P9] | The Flat and Layered variants of a grid differ in continuity, not just thickness. |
| At the same total thickness, fewer and thicker layers stretched further (384–508% vs 248–333%). | Lu, [Paper 69][P69], Table IV | Layer count and height are real controls for Layered cards. |
| Bridged strands came out stiffer than expected. | Laput, [Paper 36][P36] | Raised is not automatically softer. Measure it. |
| Two unbonded stacked layers bend far more easily than interlocked ones. | Wang, [Paper 63][P63] | Layered variants with deliberately unbonded layers are a further option. |

---

## 4. The card and its panel (the template every card follows)

### 4.1 What a card carries

Add these fields to each registry entry in [`designs.js`][designs] and the files it gathers. The existing fields `id`, `name`, `blurb`, `status`, `controls`, `generate` and `presets` stay.

| Field | Meaning | Example |
|---|---|---|
| `shelf` | `'flat' \| 'layered' \| 'raised'` | `'raised'` |
| `family` | Style family used for grouping and variants | `'rings'` |
| `variants` | Card IDs of the same style on other shelves; they share one settings object | `['rings-flat', 'rings-layered', 'rings-raised']` |
| `settingsKey` | Where the shared settings live (`designs[settingsKey]`), so switching variant keeps them | `'rings'` |
| `joins` | One plain line on how it joins, shown under the side view | "Each ring climbs over the one before; joins by height." |
| `support` | `'self'` (no Support section) \| `'auto'` (carrier added by default; Support section shown) \| `'built-in'` (carrier is part of the design; Support section shows it read-only) | `'self'` |
| `sources` | Catalogue record and paper numbers | `{ catalogue: ['M4'], papers: [53, 66] }` |
| `state` | `'tested' \| 'untested' \| 'needs-repair'` (badge) | `'untested'` |
| `legacy` | Old IDs and settings patches that open this card | `[{ id: 'chainmail' }]` |

Tests: extend [`tests/designs.test.js`](../tests/designs.test.js) so that:
- every card has a valid `shelf`, `family` and `support`;
- every `variants` group shares one `settingsKey`;
- every `legacy` ID resolves to exactly one card.

### 4.2 The card face and the open card

- **Card face** (left column): the picture from the generator at default settings ([`thumbs.js`][thumbs] `thumbFromLayers`); the name; a thin **side-view strip**; and a badge for support (*holds itself* / *+ backing*) and for state (*Untested* / *Needs repair*).
- **Open card** (top of the right panel):
  - the side view, drawn large;
  - the `joins` line;
  - "Also on: Flat · Layered", which switches variant and keeps settings;
  - a *Print all variants* button **[call 6]**.
- **Side view:** a new module, `src/ui/sideview.js`. It samples the generated strands' Z along a short section line through the centre of the swatch and draws Z against distance. It uses the real result, not a hand-drawn icon, so it shows the truth.

### 4.3 The six sections

| # | Section | What it holds | Today's code |
|---|---|---|---|
| 1 | **Size and shape** | Size, outline SVG and perimeters (unchanged). | `size` kind in [`panels.js`][panels] |
| 2 | **Structure** | Only this card's own choices (for example Crossed / Parallel, Tiling, Directions, Curve). No strand shapes. | `choice` kind |
| 3 | **Look and feel** | Three to five sliders named by what they do to the cloth (§4.4). Raised cards add *Height*; Layered cards add *Layers*. | `sliders` kind |
| 4 | **Pattern** | A **source** (Even, the 13 built-in patterns, Your picture) and an **effect** listed by the card: depth, thickness (halftone), spacing, size, height or bonding. | `pattern` kind; [`picture.js`][picture] `patternField` |
| 5 | **Colour** | One colour; Face colour (layer 1 in a different colour); Colour per layer; Two-colour halftone (complementary families). | `switch key=colorChange`; [`stack.js`][stack] `addExtraLayers`; [`emit.js`][emit] `pauseBefore` |
| 6 | **Support** | Only when `support` is `'auto'` or `'built-in'`. One carrier choice: carrier style, openness and layers. | `BackingCard` in [`panels.js`][panels]; [`backing.js`][backing] |
| — | Advanced | Speeds, nozzle, strand and seed: unchanged. | existing |

### 4.4 Look and feel names, with what the papers say

Use these labels and help lines. Keep the slider keys (`spacing`, `depth`, `wavelength` and so on) so old links keep working.

| Label (was) | Help line | Source |
|---|---|---|
| **Gap between strands** (Line spacing) | The main softness control: a wider gap gives a softer, more open net. | Lu, [Paper 69][P69]: going from a gap of 1× to 2× the strand width cut stiffness by 39–47% in NinjaFlex meshes. |
| **Wave depth** | How far it stretches before the strands pull straight. | Pattinson, [Paper 66][P66]: wave height moved the stiffening point to above 40% strain. |
| **Wave length** | With depth, how much slack each strand holds. | [Paper 66][P66] model, Table S1 |
| **Strand thickness** | Thicker strands give a stronger, firmer net. | [Paper 69][P69]; Gispan [Paper 17][P17]: set width with extrusion, not speed |
| **Overlap** (rings, cells) | How much neighbours share at each join. More is stronger and stiffer; never let them touch at a point. | Schumacher 2015 [Paper 53][P53]; [Paper 66][P66] |
| **Neighbouring strands: touching / gap** (new, parallel-strand cards) | Touching strands fuse into one thicker strand; a small gap keeps them separate and softer. | [Paper 66][P66] p. 7 |
| **Layers** and **Layer height** (Layered) | At the same thickness, fewer and thicker layers stretch further. | [Paper 69][P69] |
| **Directions** (grids) | 0/90 is soft on the bias; 60° grids (isogrid, kagome) feel the same in every direction. | Schumacher 2018 [Paper 54][P54]; Kalman [Paper 29][P29] |
| **Height** (Raised) | How high a strand rises over the one below. | Kim & Lee [Paper 31][P31]: crossing height = line thickness + half its radius |
| **Cell size** (cells) | Grade softness by changing cell size, not by thinning strands. | Martínez [Paper 44][P44] |

---

## 5. The library: every card

**Columns:**
- **Source** is the current ID and file, or *new*.
- **Phase** refers to §6.
- **Refs** links catalogue records and papers.

Unless the row says otherwise, each card's Pattern effect is the one its current panel uses.

### 5.1 Flat (2D): one layer, joins in the plane, holds itself together

| ID | Card | Source | Joins / support | Look and feel | Phase | Refs |
|---|---|---|---|---|---|---|
| F-01 | **Rings · flat** | new; ring primitive in [`shapes.js`][shapes], staggered lattice from [`chainmail.js`][chainmail] | Rings overlap and fuse in one pass. Self. | Ring size, Overlap, Strand thickness | 2 | [M4][CAT-M4], [Paper 53][P53], [Paper 66][P66] |
| F-02 | **Honeycomb · flat** | `auxetic` with `cell: 'hexagon'` ([`auxetic.js`][auxetic]) | Hexagon cells share their walls. Self. | Cell size, Strand thickness | 1 | [S4][CAT-S4], [Paper 54][P54] (6-fold, same in every direction) |
| F-03 | **Re-entrant (bow-tie)** | `auxetic` with `cell: 're-entrant'` | Bow-tie cells. Self. | Cell size, Arm angle, Hinge width | 1 | [S4][CAT-S4], [Paper 24][P24], [Paper 26][P26], [Paper 55][P55] |
| F-04 | **Star lattice** | `starlattice` ([`starlattice.js`][star]) | Hankin straps in non-crossing families. Self. | Contact angle, Strap width, Tile size | 1 | [S7][CAT-S7], [Paper 54][P54] |
| F-05 | *withdrawn on 26 October* | — | Kalman's single-layer isogrid ([Paper 29][P29]) is what L-08 Grid & isogrid already prints: today's engine lays every direction at one nominal height and settles the crossings ([audit][AUD]). The real choices for grids are fused, lifted or sliding crossings (L-08, R-09, R-10). | — | — | [S2][CAT-S2] |
| F-06 | **Rotating squares** | new | Squares joined only at corners by short necks; corners filleted. Self. | Square size, Neck width, Neck length, Opening angle | 2 | [S4][CAT-S4], Shajoo [Paper 55][P55] |
| F-07 | **Rotating triangles** | new | Kagome linkage; border band at free edges. Self. | Triangle size, Inclination θ (±π/6), Thickness ratio t/l, Hinge width | 2 | [S4][CAT-S4], Chen [Paper 6][P6], Konaković [Paper 34][P34] |
| F-08 | **Arrowhead band** | new | Arrowheads anchored to two side rails. Self. | Band width, Cell size, Hinge angle, Rail width | 2 | [S4][CAT-S4], Ariel & Sterman [Paper 1][P1], Spahiu [Paper 68][P68] (4 × 8 hollow arrowheads per 130 mm panel) |
| F-09 | **Spiral cells** | new | Four-arm Archimedean spirals joined at shared-edge midpoints. Self. | Cell size (≥ 10 mm at first), Twist φ, Arm width | 2 | [S5][CAT-S5], FlexMaps [Paper 42][P42] (formula in S5) |
| F-10 | **Stochastic net** | new | Jittered nodes joined to their k nearest neighbours under a stretched metric. Self. | Node density, k, Stretch ratio, Direction | 2 | [S6][CAT-S6], Martínez [Paper 44][P44], [Paper 45][P45] |
| F-11 | **Star-metric cells** | new | Voronoi cells under a star-shaped distance; 3-fold symmetry gives the same feel in every direction. Self. | Lattice, Symmetry, Petal shape (3–7 spans), Wall width | 2 | [S7][CAT-S7], Martínez [Paper 46][P46] |
| F-12 | **Isohedral tiles** | new | Tile outlines from the 93 isohedral families. Self. | Family, Shape parameters, Scale, Line width | 2 | [S7][CAT-S7], [Paper 54][P54], [Paper 47][P47] (Tactile library: check licence) |
| F-13 | **Connected lace** | new | Rings, petals and scallops joined by shared necks. Self. | Motif scale, Neck width, Open fraction | 2 | [S1][CAT-S1], Sun [Paper 59][P59] / [Paper 60][P60], Sterman [Paper 58][P58] |
| F-14 | **Meander with ties** | `meander` curves ([`meander.js`][meander]), ties instead of a backing | One curve held by in-plane ties. Self. | Curve, Turn radius, Tie interval | 2 | [S3][CAT-S3] |
| F-15 | **Voronoi cells** | new variant of `voronoi` ([`voronoi.js`][voronoi]): cells only, plus a border strand | Convex cells joined in the plane. Self. | Cell size, Regularity, Strand thickness | 2 | [Paper 44][P44] |
| F-16 | **Looped rows** | `coil` with `shape: 'looped'` ([`coil.js`][coil]) | One strand in rows; loops cross themselves and touch the next row. Self. | Loop size, Pitch, Row overlap | 1 | [C. Loops][CAT-C], Beecroft [Paper 3][P3] / [Paper 4][P4] |
| F-17 | **Figure-8 rows** | `coil` with `shape: 'figure8'` | Same as F-16, with figure-8s. Self. | Loop size, Pitch, Row overlap | 1 | as F-16 |
| F-18 | **Harmonograph** | `harmonograph` ([`lissajous.js`][lissajous]), single curve | One closed curve that crosses itself in diamonds. Self. | Frequencies, Phase, Damping | 1 | [G. Curved][CAT-G] |
| F-19 | **Kirigami sheet** | new; solid sheet via [`solid-fill.js`][solidfill] | Thin solid sheet with staggered slits. Self. | Slit width (≥ 1 mm at a 0.4 mm nozzle), Slit gap h/i, Thickness | 2 | [S4][CAT-S4], Nakajima [Paper 48][P48] |

### 5.2 Layered (2.5D): stacked flat layers, or a motif with a backing

| ID | Card | Source | Joins / support | Look and feel | Phase | Refs |
|---|---|---|---|---|---|---|
| L-01 | **Wave net** | `squiggle` with `shape: 'wave'` ([`squiggle.js`][squiggle]) | Two wavy families cross (or offset rows cross). Self. | Gap between strands, Wave depth, Wave length, Neighbouring strands | 1 | [S2][CAT-S2], [Paper 66][P66], [Paper 69][P69], Steinmetz [Paper 57][P57] |
| L-02 | **Zigzag net** | `zigzag` ([`wavegrid.js`][wavegrid], [`basic-designs.js`][basic]) + `squiggle` zigzag + alias `zigzag-mesh` | Two zigzag families. Self: it is a backing. | Gap, Zigzag depth, Zigzag length | 1 | [S2][CAT-S2] |
| L-03 | **Square-wave net** | `squiggle` with `shape: 'square'` | Two square-wave families. Self. | Gap, Depth, Length | 1 | [S2][CAT-S2] |
| L-04 | **Honeycomb · layered** | `squiggle` with `shape: 'honeycomb'` | Two half-hexagon families meet as cells. Self. | Gap, Cell depth, Cell length | 1 | [S2][CAT-S2] |
| L-05 | **Figure-8 net** | `squiggle` with `shape: 'figure8'` | Two figure-8 families. Self. | Gap, Depth, Length | 1 | — |
| L-06 | **Rings · layered** **[call 3]** | `chainmail` ([`chainmail.js`][chainmail]) + `squiggle` with `shape: 'ring'` | Alternate rings on layer 1 and layer 2, bonded on top. Self. | Ring size, Overlap, Strand thickness | 1 | [M4][CAT-M4], Wang [Paper 63][P63] |
| L-07 | **Bubbles** | `bubbles` ([`bubbles.js`][bubbles]) | Packed rings held by a ring in every gap. Self. | Bubble size, Spread, Link | 1 | [Paper 44][P44] (seeding); audit: Luis reports it prints well |
| L-08 | **Grid & isogrid · layered** | `crosshatch`, currently hidden: unhide | Two or three direction families in true passes. Self. | Gap, Directions, Strand thickness | 1 | [S2][CAT-S2], [Paper 29][P29], [Paper 54][P54], [Paper 9][P9] |
| L-09 | **Rotated stack** | new; parallel-strand layers, each turned θ from the one below | Stacked layers bond where they cross. Self. | Strand thickness, Gap (as × thickness), Turn per layer (30/45/60/90°), Layers, Layer height | 2 | [Paper 69][P69] (all three tables), [S2][CAT-S2] |
| L-10 | **Moiré net** | new; two families with a pitch or angle offset | Two families; the bonded-crossing density varies with the moiré band. Self. | Pitch difference, Angle difference, Phase pattern | 2 | [M7][CAT-M7] |
| L-11 | **Voronoi lace** | `voronoi` | Delaunay first, Voronoi dual second, from the same seeds. Self. | Cell size, Regularity | 1 | audit Nets table |
| L-12 | **Spiderweb** | `web` ([`web.js`][web]) | Spiral plus a radial zigzag. Self. | Ring pitch, Spokes, Centre | 1 | audit radial note |
| L-13 | **Sunflower** | `sunflower` ([`sunflower.js`][sunflower]) | Opposite parastichies meet at shared seeds. Self. | Seeds, Spacing, Centre | 1 | — |
| L-14 | **Rosette** | `rosette` ([`rosette.js`][rosette]) | Opposite-phase wavy spirals cross. Self. | Rings, Waves, Depth, Centre | 1 | — |
| L-15 | **Spirograph** | `spirograph` ([`spirograph.js`][spirograph]) | Two trochoid ring families half a ring apart. Self. | Curl size, Rings, Centre | 1 | — |
| L-16 | **Conformal mesh** | `conformal` ([`conformal.js`][conformal]) | Square grid bent round holes and poles. Self. | Map, Cell size | 1 | — |
| L-17 | **Flow lines** | `flowlines` ([`flowlines.js`][flowlines]) | Lines along a flow, crossed at 90°. Self. | Flow, Gap | 1 | Guo [Paper 18][P18] (report crossing-angle deviation) |
| L-18 | **Spiral panel** | `spiral` ([`spiral.js`][spiral]) | Nested rings; the carrier is inserted by `reinforce`. Built-in. | Ring pitch, Second layer | 1 | audit Pattern-on-a-mesh table |
| L-19 | **Woven draft** | `weave` ([`weave.js`][weave]), 8 bindings | Lower and upper pieces at two levels with ramps; fused, not sliding. Self. | Binding, Pitch, Float length | 1, then 3 | [M3][CAT-M3], [Paper 16][P16], [Paper 39][P39], [Paper 64][P64], [Paper 61][P61] |
| L-20 | **Truchet tiles** | `truchet` ([`truchet.js`][truchet]) | Diagonals or arcs; the arcs' second family is half-tile shifted. Self. *Needs repair* **[call 4]** | Tile, Tile size | 6 | audit Nets table |
| L-21 | **Parquet** | `parquet` ([`parquet.js`][parquet]) | Tile-local serpentines; seams currently rely on ties. *Needs repair* **[call 4]** | Floor, Block, Ratio | 6 | [audit Parquet findings][AUD], [Paper 53][P53], [Paper 6][P6] |
| L-22 | **Meander** | `meander` | A curve on an automatic backing. Auto. | Curve, Scale | 1, repair 6 | audit; [M6][CAT-M6] |
| L-23 | **Turing stripes** | `turing` ([`turing.js`][turing]) | Stripes on an automatic backing; every fragment must touch it. Auto. | Stripe width, Scale | 1, repair 6 | audit |
| L-24 | **Your drawing** | `svgdesign` ([`svgdesign.js`][svgdesign], [`infill.js`][infill]), currently hidden: unhide | Drawing lines or fills on an automatic backing. Auto. | Fill, Backing openness | 1 | audit; §7 |
| L-25 | **Lace + backing** | new | Decorative lace on one open backing layer (optionally two, at an angle). Auto. | Motif scale, Backing pitch and angle, Overlap | 3 | [M1][CAT-M1], [Paper 58][P58], [Paper 59][P59] |
| L-26 | **Step, ripple and petal lace** | new | Straight lines tied together by a second-layer zigzag "step", or a hexagon or ripple network on top. Built-in. | Step wavelength, Petal count, Carrier pitch | 3 | [M6][CAT-M6], Diak & Diak [Paper 10][P10] (five tested models), Lee [Paper 37][P37] / [Paper 38][P38] |
| L-27 | **Paired loops** | new | Offset loop rows in two planes, joined at chosen overlaps. Self. | Loop aspect, Offset, Anchor spacing | 3 | [M4][CAT-M4], [Paper 25][P25] |
| L-28 | **Scales on a carrier** | new | Tiles on a thin continuous carrier, inset by a constant gap. Built-in. | Tile family, Pitch, Gap, Scale height | 3 | [M8][CAT-M8], FlexScale [Paper 47][P47] (0.4 mm NinjaFlex carrier, 0.4 mm gap, Prusa MK3S+) |
| L-29 | **Bouclé & picots** | `boucle` (calls `generateCoil` with `shape: 'ring'`) | Rings on a line, for edges; carrier inserted. Built-in. | Ring size, Pitch | 1 | audit Pattern-on-a-mesh table |

**Retired as cards** (their IDs migrate, §6 Phase 1):
- **Halftone net** (`halftone`, [`halftone.js`][halftone]) becomes Pattern effect *Thickness* plus Colour *Two-colour halftone* on L-01, L-02 and L-08. Refs: [M2][CAT-M2], Gispan [Paper 17][P17].
- **Advanced zigzag mesh** (`zigzag-mesh`, a preset alias) becomes L-02.

### 5.3 Raised (non-planar): strands deliberately leave the plane

| ID | Card | Source | Joins / support | Look and feel | Phase | Refs |
|---|---|---|---|---|---|---|
| R-01 | **Rings · raised** | new engine capability E9 | Each ring climbs over the rings printed before it, building 3–4 levels. Self. | Ring size, Overlap, Level height, Max levels, Ramp length | 5 | §3; [Paper 31][P31]; [Paper 64][P64] (print order) |
| R-02 | **Loop pile** | `loop-pile` ([`generate.js`][generate], legacy panel) | Raised anchored loops over its own base. Built-in. | Pile height, Loop size, Loop spacing, Base openness | 1 | [D. Raised][CAT-D] |
| R-03 | **Relief** | `relief` ([`relief.js`][relief]) | Varying-Z rows over a crossed base. Built-in. | Relief height, Wavelength, Base openness | 1 | [N2][CAT-N2] |
| R-04 | **Dip weave** | `dipweave` ([`dipweave.js`][dipweave]) | Straight warps; wefts rise over and dip between them. Self. | Warp pitch, Dip depth | 1 | [N1][CAT-N1], [Paper 61][P61] |
| R-05 | **Looped net** | `squiggle` with `shape: 'looped'` | Loops circle over themselves and lift over the earlier pass. Self. | Gap, Loop size, Length | 1 | — |
| R-06 | **Fringe** | `fringe` ([`fringe.js`][fringe]) | Base rows with free-ended hair loops. Built-in. | Lift, Length, Spacing | 1 | [Paper 36][P36] |
| R-07 | **Spacer net** | `spacer` ([`pillars.js`][pillars]) | Two nets held apart by small pillars. Built-in. | Gap height, Pillar pitch | 1 | [D. Raised][CAT-D] |
| R-08 | **Pillar weave** | `pillarweave` ([`pillars.js`][pillars]) | Fibre locked round upright pillars. Built-in. | Pillar pitch, Fibre height | 1 | [Paper 61][P61] |
| R-09 | **Grid · lifted crossings** | new; engine capability E10 on L-08 / L-01 | Each crossing strand lifts so it lands after cooling: unbonded crossings. Self. | Lift height, Lift length, Fan on lifts | 5 | [M9][CAT-M9], [N1][CAT-N1], Pattinson [Paper 66][P66] p. 13 |
| R-10 | **Grid · sliding channels** | new; engine capability E11 | Raised second family held by a printed channel at every crossing; the channel's direction sets which strand slides. Self. | Channel height, Leg lengths, Channel direction mask, Pitch | 5 | [M9][CAT-M9], [N1][CAT-N1], Li [Paper 67][P67] + [`SlidingGrid.gcode`](Li-2022_Programmable-Digital-Weaves_GCode/SlidingGrid.gcode) |
| R-11 | **Wave net · bridged crossings** | new; engine capability E12 | Filleted up/down strand over each crossing. Self. | Crossing height, Fillet radius | 5 | [N1][CAT-N1], Kim & Lee [Paper 31][P31] |
| R-12 | **Corrugation** | new; on a base net | Low smooth ridges or waves in Z. Built-in. | Rise, Wavelength, Slope limit | 5 | [N2][CAT-N2] |
| R-13 | **Colour exposure texture** | new; after halftone calibration | Two colour families with small height changes that alter which colour shows. Built-in. | Exposure, Phase, Z envelope | 5 | [N3][CAT-N3], [M2][CAT-M2] |

**Variant groups** (cards that share settings, D3):
- Rings: F-01 / L-06 / R-01
- Honeycomb: F-02 / L-04
- Grid & isogrid: L-08 / R-09 / R-10
- Wave net: L-01 / R-11

The total is 60 cards: 18 Flat, 29 Layered, 13 Raised.

**Which shelf a card belongs on** is checked from what it actually prints (the construction report, Phase 0):
- **Flat:** one native path family, or several that meet without crossing over each other, at the first layer height. Local settling where a strand crosses itself is allowed.
- **Layered:** two or more native families that cross each other, or a motif with a carrier.
- **Raised:** deliberate height beyond crossing settles and stacked layers.

The implementation pack's Phase 0 tickets turn this into a test.

---

## 6. Phases

Each step lists the files, what to change, the tests to add, and what *done* means. Every step ends with `npm test` passing and a browser check. Make one commit per step, and only when Luis asks; never push unasked.

### Phase 0: Foundations (no visible change in what gets printed)

**0.1 Card fields.**
- **Files:** add the §4.1 fields in [`designs.js`][designs], [`more-designs.js`][more], [`line-designs.js`][line], [`pub-designs.js`][pub], [`basic-designs.js`][basic] and [`svg-design.js`][svgdesignUI].
- **Change:** fill them in for the 31 existing cards, using §5's shelves.
- **Tests:** the §4.1 assertions in [`tests/designs.test.js`](../tests/designs.test.js).
- **Done:** every current card has a shelf, family, support and state. Nothing printed changes ([`tests/golden.test.js`](../tests/golden.test.js) unchanged).

**0.2 A truthful construction report** (audit step 0, [AUD][AUD]).
- **Files:** [`layers.js`][layers] (`crossingReport`), [`fabric-result.js`][fabricresult], [`stack.js`][stack] (`nativeLayerInfo`), [`verdict.js`][verdict].
- **Change:** derive from the *final strands*:
  - the families that survive clipping;
  - per-crossing stacks (which family is on top, fused or separated);
  - tie count and where the ties are (carry their provenance through `layersToStrands`);
  - carrier passes counted separately;
  - the actual min/max Z.
  - Report a family lost to clipping as an error, not as "exportable".
- **Tests:**
  - Parquet at block 0.8 mm, ratio 2, spacing 5 mm reports a lost family ([audit Parquet table][AUD]);
  - a Wave net reports two families and the crossing heights;
  - Relief reports its Z envelope.
- **Done:** the report describes what prints, not the card's label.

**0.3 Side view.**
- **Files:** new `src/ui/sideview.js`; draw it in the open-card header (from [`panels.js`][panels]) and as a strip on the card face (from [`thumbs.js`][thumbs]).
- **Change:** sample the strands' Z along a centre section about 20 mm long and draw Z against distance. Exaggerate the vertical scale and label it, for example "×5 height".
- **Tests:** Flat gives one level; Layered gives two; R-02 Loop pile shows its pile height.
- **Done:** the side views of the three Rings variants look different (checked after Phase 5).

**0.4 Shelves in the gallery.**
- **Files:** [`main.js`][main] gallery (line 1663) and `galleryGroups()` in [`designs.js`][designs].
- **Change:** replace *Essentials / More structures* with the three shelves. Within each shelf, group by `family` and show tested cards first. Show the badges.
- **Done:** all ready cards appear on their shelf, and hidden cards still open from old links.

**0.5 Migration map.**
- **Files:** [`share.js`][share] (`sanitizeState`), [`designs.js`][designs] (`designById`).
- **Change:** a `MIGRATIONS` table from old ID + settings to new card ID + settings patch:
  - `squiggle` maps by `shape`: wave → L-01, zigzag → L-02, square → L-03, honeycomb → L-04, figure8 → L-05, ring → L-06, looped → R-05;
  - `zigzag-mesh` → L-02;
  - `chainmail` → L-06;
  - `auxetic` maps by `cell` → F-02 / F-03;
  - `halftone` → L-01, L-02 or L-08 according to its `shape` (straight → L-08), with Pattern effect *thickness* and Colour *two-colour halftone* when `second: 'complement'`;
  - `coil` with a looped or figure-8 shape → F-16 / F-17; with other shapes, the legacy-only Coil card **[call 2]**.
- **Tests:** every old ID with its presets opens a card. Exact moves (same generator, same settings) produce byte-identical G-code to today.
- **Done:** no saved link or swatch code breaks.

### Phase 1: Move the existing designs into the library (no new geometry)

**1.1 Split Squiggle & Gyroid.**
- **Files:** [`squiggle-controls.js`][sqctl], [`designs.js`][designs] (legacy panel), [`main.js`][main] (`SQ_SLIDERS`, line 2115), [`squiggle.js`][squiggle].
- **Change:** register L-01, L-02, L-03, L-04, L-05, L-06 and R-05 as cards that call `generateSquiggle` with a fixed `shape`. Move Squiggle from its hand-written panel to the shared `controls` panel so each card gets the §4.3 sections. Remove the Strand shape section.
- **Tests:** each card produces the same G-code as the old `squiggle` with that shape.
- **Done:** no card shows a shape picker.

**1.2 Zigzag.**
- **Change:** L-02 uses the `zigzag` generator ([`wavegrid.js`][wavegrid]). Check parity against `squiggle` zigzag; if they differ, keep `zigzag` and route `squiggle` zigzag links through migration. Remove the `zigzag-mesh` preset tile. Hide the Support section (`support: 'self'`).
- **Tests:** [`tests/basic-designs.test.js`](../tests/basic-designs.test.js) unchanged.
- **Done:** Zigzag net offers no backing (D7).

**1.3 Coil.**
- **Change:** F-16 (looped) and F-17 (figure-8) become cards that call [`coil.js`][coil] with a fixed shape. Keep `coil`'s other shapes reachable from old links only **[call 2]**.
- **Tests:** [`tests/coil.test.js`](../tests/coil.test.js) and [`tests/coil-controls.test.js`](../tests/coil-controls.test.js).

**1.4 Cells and lattices.**
- **Change:** F-02 and F-03 come from `auxetic` with a fixed `cell`. F-04 Star lattice keeps its tilings. Unhide L-08 (`crosshatch`) and move its *Line shape* choice to legacy (straight lines only on the card). F-18 Harmonograph: the optional phase-shifted copy stays a Structure choice.
- **Tests:** [`tests/auxetic.test.js`](../tests/auxetic.test.js), [`tests/crosshatch.test.js`](../tests/crosshatch.test.js), [`tests/lissajous.test.js`](../tests/lissajous.test.js).

**1.5 Halftone into Pattern and Colour.**
- **Files:** [`halftone.js`][halftone], [`pub-designs.js`][pub], [`panels.js`][panels] (`pattern` kind).
- **Change:** add effect *Thickness* to the Pattern section of L-01, L-02 and L-08, implemented by `halftoneLayers`'s flow/speed modulation. Add Colour *Two-colour halftone*, which inverts the second family (`second: 'complement'`) and sets `pauseBefore` on its first strand.
- **Tests:** an old `halftone` link reproduces today's G-code.
- **Catalogue rules to keep:** separate width maps for lines on the bed and over the other net; drive width by extrusion, not speed; limit step changes ([M2][CAT-M2], [Paper 17][P17]).

**1.6 Colour section.**
- **Files:** [`stack.js`][stack] (`addExtraLayers` `colorChange`), [`emit.js`][emit] (`pauseBefore`), [`main.js`][main] (lines 421, 894, 917), [`panels.js`][panels].
- **Change:** replace the *Two colours* switch with a Colour section:
  - *One colour*;
  - *Face colour*: pause after layer 1, which is today's behaviour;
  - *Colour per layer*: a list of layers, each with a colour swatch, and a pause before each change;
  - *Two-colour halftone* (1.5).
- **Preview:** colour the layers in the 3D view.
- **Tests:** M600 count equals the number of colour changes; *Face colour* equals today's `colorChange: true`.

**1.7 Support section.**
- **Files:** [`backing.js`][backing], [`panels.js`][panels] (`BackingCard`, line 857), [`more-designs.js`][more] (the native backings of Meander and Turing), [`svgdesign.js`][svgdesign], [`fabric-result.js`][fabricresult] (`reinforce`).
- **Change:** one carrier model with style (Wave, Gyroid, Straight, Zigzag), openness and layers (one or two). It is shown only for `support: 'auto'` (default on) and `'built-in'` (shown read-only). Remove the global Backing mesh switch from `'self'` cards. Never stack the global carrier on top of a native one: the audit's duplicate-support finding.
- **Tests:** [`tests/backing-mesh.test.js`](../tests/backing-mesh.test.js); no export contains two carriers.
- **Done:** Meander, Turing and Your drawing get their carrier automatically; Zigzag net shows none.

**1.8 Look and feel labels.**
- **Change:** apply the §4.4 labels and help lines across all cards, keeping the keys.
- **Tests:** [`tests/panel.test.js`](../tests/panel.test.js) snapshots updated.

**1.9 Everything else, moved as is.**
- **Change:** L-07, L-11 to L-19, L-22, L-23, L-24 (unhidden), L-29, and R-02 to R-04 and R-06 to R-08 get their shelf, family, support and state. L-20 Truchet and L-21 Parquet move too, with the *Needs repair* badge and never as a default **[call 4]**.
- **Done:** every card in §5 marked phase 1 opens, previews and exports.

### Phase 2: New Flat and Layered cards from the papers

Order inside the phase: cheapest first.

| Step | Card | What to build | Key numbers and checks |
|---|---|---|---|
| 2.1 | L-09 Rotated stack | Parallel-strand layers, layer i rotated i·θ; gap as a multiple of strand width. | Lu's matrix as defaults: T 0.4–0.6 mm, D 0.5–2 × T, θ 30/45/60/90°, H 0.1/0.15/0.3 ([Paper 69][P69]). |
| 2.2 | L-10 Moiré net | Two families with a pitch difference (e.g. 2.0 / 2.1 mm) or angle difference (0° / 3°). | Check that the sparsest moiré band still holds ([M7][CAT-M7]). |
| 2.3 | F-01 Rings · flat | Staggered ring lattice in one pass; overlap as contact width. | No point-only contacts: minimum overlap = bead width ([Paper 53][P53]). |
| 2.4 | F-06 Rotating squares | Squares joined at corners by necks; fillets; border band. | Fillet the corners where Shajoo's version failed ([Paper 55][P55]). |
| 2.5 | F-07 Rotating triangles | Triangles joined at corners by necks (kagome linkage); border band. | Inclination θ within ±π/6 ([Paper 6][P6]). |
| 2.6 | F-08 Arrowhead band | Re-entrant arrowheads anchored to two continuous side rails. | ~15 mm cells, four 0.2 mm layers in Ariel ([Paper 1][P1]); 4 × 8 cells per 130 mm in Spahiu ([Paper 68][P68]). |
| 2.7 | F-09 Spiral cells | x(t) = r(t)cos(tφ), y(t) = r(t)sin(tφ), r(t) = 0.5 s (1−t), four arms at 90°; join at shared-edge midpoints. | Cells ≥ 10 mm at first; check the gap between windings against the bead ([S5][CAT-S5], [Paper 42][P42]). |
| 2.8 | F-10 Stochastic net | One jittered node per grid cell, seeded from the cell's coordinates; k nearest neighbours under M = Eᵀdiag(H⁻²)E. | Deterministic seeding so it regenerates identically ([Paper 44][P44], [Paper 45][P45]); drop nodes isolated by clipping and add a border strand. |
| 2.9 | F-15 Voronoi cells | `voronoi` cells only, with a border strand. | Convex cells stay connected except at the boundary ([Paper 44][P44]). |
| 2.10 | F-11 Star-metric cells | Voronoi growth under d = ‖q−p‖ / f(angle), with 3–7 radial spans. | Triangular lattice + 3-fold metric gives isotropic sheets with Poisson ratio −0.47 to 0.99 ([Paper 46][P46]); per-site assignment at zone boundaries. |
| 2.11 | F-12 Isohedral tiles | Tile outlines from the 93 families (Tactile, JavaScript). | Check the library's licence before adding it under `vendor/` ([Paper 47][P47]). |
| 2.12 | F-13 Connected lace | Motifs (rings, petals, scallops) joined by necks of minimum width. | The sheet must release as one piece, with no isolated islands ([S1][CAT-S1]). |
| 2.13 | F-14 Meander with ties | `meander` curves with in-plane ties at an interval, no backing. | Measure attached area after release ([S3][CAT-S3]). |
| 2.14 | F-19 Kirigami sheet | Thin solid sheet with staggered slits via [`solid-fill.js`][solidfill]. | Slit ≥ 1 mm at a 0.4 mm nozzle; best h/i about 0.2–0.32; alternate 90/0 passes ([Paper 48][P48]). |

Each card needs:
- a generator test (families survive, one component, no dangling ends, valence bounded: Panetta, [Paper 51][P51]);
- a thumbnail and a side view;
- a §5 row with its sources;
- `state: 'untested'` until printed.

### Phase 3: Motif-on-carrier cards and woven drafts

| Step | Card | What to build | Checks |
|---|---|---|---|
| 3.1 | L-25 Lace + backing | Motif (from F-13) printed first, then one open carrier, optionally a second at another angle. | Each motif island touches the carrier; record which face is on the bed ([M1][CAT-M1]). |
| 3.2 | L-26 Step, ripple and petal lace | Diak's Line/Step and Line/Hexagon: straight lines tied by a second-layer zigzag or hexagon network. | Diak's five models, 67 × 10 mm, 0.26–0.36 mm thick ([Paper 10][P10]); seam allowance 0.25–0.5 in by curvature ([Paper 37][P37]). |
| 3.3 | L-27 Paired loops | Offset loop rows in two planes, joined at chosen overlaps. | Bonded lattice, not stitches; peel test ([M4][CAT-M4]). |
| 3.4 | L-28 Scales on a carrier | Tile outlines (from F-12) inset by a constant gap, on a thin carrier. | FlexScale: 0.4 mm carrier, 0.4 mm gaps; contact stiffens bending one way ([Paper 47][P47]). Test both bending directions. |
| 3.5 | L-19 Woven draft generator | A threading × tie-up × treadling input that yields bindings; a cross-section view of pick order; flaps need a returning pass. | LOOMING [Paper 39][P39]; AdaCAD [Paper 8][P8] / [Paper 16][P16]; Weavecraft stencils [Paper 64][P64]; still **fused** (call it so). |

### Phase 4: Raised engine capabilities

These are new shared engine pieces, used by Phase 5's cards. Each lives in its own module with its own tests.

| ID | Capability | Module | How it works | Starting numbers (proposals to calibrate) |
|---|---|---|---|---|
| E9 | **Climbing overlaps** | new `src/engine/climb.js` | Walk each new path. Where it overlaps material already printed, raise Z by one level (one layer height) over the overlap, with ramps either side. A path may sit at most *Max levels* up. | Level = layer height (0.2 mm); 3–4 levels (Luis); ramp ≥ 3 × rise; slower speed on ramps. |
| E10 | **Per-crossing lift** (Pattinson) | new `src/engine/lift.js` | Before each crossing with an earlier strand, lift by *h* over length *L*, so the new strand lands after cooling. Fan on for lifted segments. Optional mask: which crossings lift. | Pattinson gives no height. Test h = 0.5 / 1.0 / 1.5 mm with L = 3h ([Paper 66][P66] p. 13). |
| E11 | **Sliding channels** (Li) | new `src/engine/channels.js` | Lower family at Z₀. The second family is one raised span at Z₀ + 1.0 mm, anchored on the bed with 12 mm ramps at each end. Then a channel per crossing: from the lower strand 1.20 mm before the crossing, up to Z₀ + 2.0 mm above it, down 1.68 mm after; channel flow about 47% of a normal strand. A three-state mask per crossing: fused, slide along X, slide along Y. | Li's G-code (PLA, 180 °C, fan off, 0.5 mm strands, 4 mm pitch); channel speeds 100 / 200 mm/min ([Paper 67][P67], [`SlidingGrid.gcode`](Li-2022_Programmable-Digital-Weaves_GCode/SlidingGrid.gcode)). TPU bonds far more readily: start at 4 mm pitch. |
| E12 | **Bridged crossings** (Kim & Lee) | extend [`crossings.js`][crossings] | A filleted up/down profile over each crossing. | Crossing height = line thickness + half the fillet radius ([Paper 31][P31]). |
| E13 | **Bond control** | extend [`layers.js`][layers] `hatch` | Neighbouring parallel strands at contact spacing (fuse) or with a gap (stay apart), per zone or from a mask image. | Gapped vs bonded: about 5× softer at low strain ([Paper 66][P66] p. 7). |
| E14 | **Print order and clearance** | new `src/engine/order.js` | A graph of "must print before" constraints from nozzle-body clearance (tip radius and cone angle are already in Advanced). Split a path if the constraints form a cycle. | Wu, [Paper 64][P64] ch. 3. |

All of them need tests for:
- the Z envelope (max Z = the stated height);
- ramps within the slope limit;
- no nozzle-body collision (E14);
- the construction report (0.2) showing the new crossing types.

### Phase 5: Raised cards and comparison prints

| Step | Card | Built from | Check |
|---|---|---|---|
| 5.1 | R-01 Rings · raised | F-01 geometry + E9 + E14 | The three Rings variants share settings; the side views differ. |
| 5.2 | R-09 Grid · lifted crossings | L-08 + E10 | Compare with L-08 fused: cantilever deflection and drape ([Paper 66][P66]). |
| 5.3 | R-10 Grid · sliding channels | L-08 + E11 | Masked crossings must actually move after printing; test in shear and on the bias ([Paper 67][P67]). |
| 5.4 | R-11 Wave net · bridged crossings | L-01 + E12 | Touchdown and snagging; compare with L-01. |
| 5.5 | R-12 Corrugation | base net + bounded Z wave | Support under crests; measured Z envelope ([N2][CAT-N2]). |
| 5.6 | R-13 Colour exposure | L-01 halftone + bounded Z | After 1.5 is calibrated ([N3][CAT-N3]). |
| 5.7 | **Print all variants [call 6]** | [`design-export.js`][designexport], [`main.js`][main] | One export placing every variant of the open card side by side on the bed with identical settings, each labelled in the swatch code. |

### Phase 6: Repairs

- **6.1 Parquet** ([`parquet.js`][parquet]). Follow the [audit's Parquet findings][AUD]:
  - design tile edges to coincide, with a minimum contact width at seams ([Paper 53][P53]; Chen [Paper 6][P6]);
  - require both families to survive clipping;
  - report ties.
  - **Test:** the three audit diagnostics no longer lose a family or need hundreds of ties.
  - **Done:** remove the *Needs repair* badge after a good print.
- **6.2 Truchet** ([`truchet.js`][truchet]). Verify tile joins, edge fragments and that the second family survives on small swatches.
- **6.3 Meander and Turing.** Every retained fragment must touch the carrier (the audit's Pattern-on-a-mesh acceptance). Seed by grid-cell coordinates ([Paper 44][P44]).

### Phase 7: Drawing tools

**7.1 Line alignment** (D11). Small and independent; it can be done any time after Phase 0.
- **Files:** [`svg-parse.js`][svgparse], [`drawing.js`][drawing] (`passesFor` line 214, `offsetPolyline` line 220, `linePasses`), [`svg-lines.js`][svglines], [`share.js`][share] (`sanitizeOutline`), [`panels.js`][panels] (the "How a drawing prints" block in Size and shape).
- **Two numbers, kept separate:** bead width *b* (the profile's strand width, about 0.42–0.45 mm at a 0.4 mm nozzle) and pass spacing *p* (default 0.8 b, today's 20% overlap). Pass count for a stroke of width W: n = max(1, round((W − b)/p) + 1), capped at `MAX_PASSES`. The printed band is (n−1)p + b wide.
- **Offsets of pass k** (k = 0 … n−1), positive to the left of the path direction as `offsetPolyline` uses:
  - **Centre:** d = (k − (n−1)/2)·p. This is today's behaviour.
  - **Left:** d = +(b/2 + k·p). **Right:** d = −(b/2 + k·p).
  - **Inside / Outside** (closed paths): Left or Right, chosen from the ring's signed area so that Inside points to the interior.
  - **Correction to the forwarded note:** the first one-sided pass is inset by **half a bead**, not placed on the path. Otherwise half of it prints outside the drawn line, and "inside" would not stay inside.
- **Behaviour:**
  - Offer *Inside / Centre / Outside* for closed paths and *Left / Centre / Right* for open ones, detected automatically.
  - Drop passes that collapse inside small shapes (offset beyond the shape's inner radius).
  - Show the result in the 2D preview.
  - The setting is per colour once 7.2 exists, global until then.
- **Tests:**
  - a 100 × 100 mm square with W = 1 mm, drawn both clockwise and anticlockwise: *Inside* keeps every bead inside the square, and *Outside* keeps them outside;
  - a 3 mm circle with W = 2 mm drops collapsed passes;
  - *Centre* output is unchanged ([`tests/drawing-union.test.js`](../tests/drawing-union.test.js), [`tests/outline.test.js`](../tests/outline.test.js)).
- **Reference for the geometry:** Hector Vector (github.com/asuramaya/hector-vector, MIT) reportedly implements centre/inside/outside strokes. This has not been checked.

**7.2 Colour regions** (D10).
- **Keep the colour.**
  - `paintClass` ([`svg-parse.js`][svgparse] line 148) reduces colours to five classes. Also keep each path's normalised hex colour (`#rrggbb`) in `styles`, and let [`drawing.js`][drawing] `sanitizeSvgLines` accept it.
  - **Test:** an SVG with five reds of different hex values yields five distinct colours.
- **Region model.**
  - Regions are the distinct colours of closed shapes. Each region holds a colour, `enabled`, a role (Pattern / Hole / Solid / Line), a card ID and that card's settings.
  - **Default roles reproduce today:** pure red → Pattern with the current card; blue → Hole; green and yellow → Solid; other → Line.
  - **Test:** a single-red drawing exports byte-identical G-code to today.
- **Colour bar.**
  - Next to *3D / 2D / 3D sample* ([`index.html`][index] line 107; [`main.js`][main] `renderPreviewMode()` line 803): one swatch per region, each with a tick box.
  - Unticked regions are left out of the preview and the export, and drawn as a faint outline.
  - Clicking a swatch shows that region's card picker and panel on the right.
- **Apply and Export.**
  - The current Export button ([`index.html`][index] line 284; [`main.js`][main] lines 1221 and 2325) becomes **Apply**: it builds every enabled region and the seams into one result.
  - **Export** moves next to **Share** ([`index.html`][index] line 70) and is enabled once the applied result is current; changing anything marks it stale.
  - Export writes one G-code file for the whole piece.
- **Building the piece.**
  - **Per region:** the boundary is the region polygon minus holes ([`polygon-region.js`][polyregion] `unionFilledRegions`), and the region's card is generated with that outline.
  - **Seams [call 1]:** a printed seam line along every border between two enabled regions. Both patterns are clipped to it and must tie into it, as in the catalogue's [reinforced contour band][CAT-EDGE] (Gispan [Paper 17][P17]).
  - **Print order:** by layer across regions (every region's layer 1, then every region's layer 2), so that a taller region never blocks the nozzle over a lower one (E14).
  - **Report:** the construction report (0.2) lists each region and its seam contacts.
- **Sharing:** regions are stored in the share state ([`share.js`][share], with sanitising and size limits) and in the swatch code.
- **Tests:**
  - two regions produce both patterns and a seam;
  - a disabled region is absent;
  - region settings survive a share link;
  - the worker paths still run ([`panel-worker.js`][panelworker], [`swatch-worker.js`][swatchworker]).
- **Done:** a garment panel with a denser underarm region and a lighter body region exports as one connected piece.

### Phase 8: Physical validation (runs alongside every phase)

- **Swatch protocol** ([catalogue][CAT-SWATCH]): equal outside size and the same material batch. Record areal mass and actual strand geometry. Photograph both faces flat and on the same drape support. Measure low-force extension along both axes and on the bias, unloading, recovery and repeated-cycle damage.
- **Comparison sets** (from §3):
  - Rings F-01 / L-06 / R-01;
  - Grid L-08 / R-09 / R-10;
  - Wave net with touching vs gapped strands (E13);
  - Rotated stack L-09 at 0.1 / 0.15 / 0.3 mm layers.
- **Badges:** a card becomes *Tested* once a swatch has been printed and recorded with its swatch code. Keep the record format of [`docs/foamy-calibration.md`](../docs/foamy-calibration.md).
- **Settings:** no paper's settings are FilaFabric defaults. Use the [process-settings table][CAT-SET] for orientation only. Li's PLA at 180 °C with no fan, and Spahiu's 245 °C / 50 mm/s, are their own machines and materials.

---

## 7. Order at a glance

| Order | What | Why first |
|---|---|---|
| 1 | Phase 0 (fields, truthful report, side view, shelves, migration) | Everything else depends on it; nothing printed changes. |
| 2 | Phase 1 (move 31 cards, split Squiggle, Colour and Support sections) | Gives the new library with today's geometry; shows whether the organisation works. |
| 3 | 7.1 Line alignment | Small, independent, asked for now. |
| 4 | Phase 2 (new Flat and Layered cards) | Cheap geometry, and fills the shelves. |
| 5 | Phase 4 → Phase 5 (Raised capabilities, then Raised cards and trios) | The area Luis wants to grow; needs Phase 0's report and side view. |
| 6 | Phase 3 (motif-on-carrier, woven drafts) | Needs the Support section from Phase 1. |
| 7 | 7.2 Colour regions | Needs cards, Support and seams to be settled. |
| 8 | Phase 6 repairs | Can be done any time; kept out of defaults until fixed. |
| always | Phase 8 prints | Turns *Untested* into *Tested*. |

---

[CAT]: FilaFabric_Printable_Textile_Pattern_Catalogue.md
[CAT-S1]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#s1--connected-planar-lace
[CAT-S2]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#s2--flat-raster-and-wave-nets
[CAT-S3]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#s3--meanders-and-loops-with-sparse-ties
[CAT-S4]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#s4--auxetic-and-slit-sheet-variants
[CAT-S5]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#s5--four-arm-spiral-cells
[CAT-S6]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#s6--directional-stochastic-net-new-24-october-2026
[CAT-S7]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#s7--star-metric-curved-cell-lattice-and-isohedral-tilings-new-24-october-2026
[CAT-M1]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m1--lace-plus-open-printed-backing
[CAT-M2]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m2--calibrated-two-colour-halftone-net
[CAT-M3]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m3--fused-pseudo-weave-from-a-draft
[CAT-M4]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m4--paired-loops-and-staggered-lace
[CAT-M6]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m6--step-ripple-and-petal-lace-over-a-carrier
[CAT-M7]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m7--moiré-interference-net-new-24-october-2026
[CAT-M8]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m8--scales-on-a-continuous-carrier-new-24-october-2026
[CAT-M9]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#m9--bond-masks-and-release-zones-new-24-october-2026
[CAT-N1]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#n1--low-crossing-bridges-and-dipped-strands
[CAT-N2]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#n2--shallow-corrugation-and-tactile-relief
[CAT-N3]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#n3--colour-exposure-through-shallow-texture
[CAT-C]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#c-loops-knit-like-paths-coils-and-interlooping
[CAT-D]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#d-raised-non-planar-and-multi-height-paths--background-and-scope-limits
[CAT-G]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#g-curved-radial-space-filling-and-procedural-patterns
[CAT-EDGE]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#edge-joining-and-handling-details
[CAT-RULES]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#design-rules-distilled-from-the-sources
[CAT-SET]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#process-settings-reported-by-the-sources
[CAT-SWATCH]: FilaFabric_Printable_Textile_Pattern_Catalogue.md#implementation-order-and-swatch-evidence
[REF]: FilaFabric_Research_Reference_and_Design_Notes.md
[AUD]: FilaFabric_Existing_Pattern_Audit_and_Grouping.md
[P1]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-1-ariel-sterman-2026--compostable-garments-via-digital-fabrication-a-nursing-bra-case-study
[P3]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-3-beecroft-2016--3d-printed-weft-knitted-structures-by-sls-of-nylon-powder
[P4]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-4-beecroft-2019--digital-interlooping-3d-printed-weft-knitted-tubular-structures
[P6]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-6-chen-2021--bistable-auxetic-surface-structures
[P8]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-8-devendorf-gelosi-2026--imagining-open-source-ecosystems-for-experimental-weaving-a-view-from-the-adacad-project
[P9]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-9-diak-diak-2024--features-and-limitations-of-fdm-in-textile-like-structures
[P10]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-10-diak-diak-2025--3d-printed-textile-concept-and-production-challenges
[P16]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-16-gelosi-devendorf-2026--designing-with-drafts-and-cross-sections-reflections-on-how-representations-of-woven-structure-shape-design-practice
[P17]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-17-gispan-et-al-2026--halftoning-for-3d-printed-textile-nets
[P18]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-18-guo-2020--woven-fabric-structures-by-harmonic-foliation
[P24]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-24-kabir-2022--drapability-of-3d-printed-auxetic-structure-textiles
[P25]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-25-kabir-2023--tensile-behavior-of-3d-printed-knit-textiles
[P26]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-26-kabir-2024--orientation-angle-and-stretchability-of-3d-printed-auxetic-textiles
[P29]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-29-kalman-2021--automated-draping-analysis-3d-printed-flexible-isogrids
[P31]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-31-kim-lee-2025--continuous-textile-structures-utilizing-3d-printing
[P34]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-34-konakovic-2016--beyond-developable-auxetic-materials
[P36]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-36-laput-2015--3d-printed-hair-soft-strands-fibers-and-bristles
[P37]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-37-lee-2023--digital-waves
[P38]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-38-lee-li-2022--consonance-of-3d-printed-fiber-network
[P39]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-39-lin-mclean-2026--looming-between-shaft-looms-and-a-tc2-jacquard-loom-a-serendipitous-expedition-with-live-weaving
[P42]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-42-malomo-2018--flexmaps-flat-flexible-shells
[P44]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-44-martinez-2016--procedural-voronoi-foams-for-additive-manufacturing
[P45]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-45-martinez-2017--orthotropic-k-nearest-foams-for-additive-manufacturing
[P46]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-46-martinez-2019--star-shaped-metrics-for-mechanical-metamaterial-design
[P47]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-47-montes-maestre-2024--flexscale-flexible-scaled-sheets
[P48]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-48-nakajima-2020--tensile-properties-of-3d-printed-flexible-kirigami-specimens
[P51]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-51-panetta-2015--elastic-textures-for-additive-fabrication
[P53]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-53-schumacher-2015--microstructures-to-control-elasticity-in-3d-printing
[P54]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-54-schumacher-2018--mechanical-characterization-of-structured-sheet-materials
[P55]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-55-shajoo-2021--auxetic-structures-from-3d-printed-hybrid-textiles
[P57]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-57-steinmetz-ehrmann-2021--elastic-3d-printed-polymers-on-textile-fabrics
[P58]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-58-sterman-2026--opportunities-and-challenges-of-toolpath-based-3d-printed-textiles-insights-from-digital-design-and-craft-course
[P59]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-59-sun-2017--daring-to-sprint-3d-printing-textiles
[P60]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-60-sun-2018--instilled-3d-printing-elastic-lace
[P61]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-61-takahashi-kim-2019--3d-printed-fabric-programmable-textiles
[P63]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-63-wang-2021--structured-fabrics-with-tunable-mechanical-properties
[P64]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-64-wu-2020--phd-dissertation_computational-tools-for-3d-printing-and-woven-textile-design
[P66]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-66-pattinson-2019--biomechanically-tailored-meshes-for-compliant-wearable-and-implantable-devices
[P67]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-67-li-2022--programmable-digital-weaves
[P68]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-68-spahiu-2020--3d-printing-for-clothing-production
[P69]: FilaFabric_Research_Reference_and_Design_Notes.md#paper-69-lu-2022--modeling-and-characterization-of-3d-printed-flexible-mesh-structure-for-wearable-interface
[designs]: ../src/ui/designs.js
[more]: ../src/ui/more-designs.js
[line]: ../src/ui/line-designs.js
[pub]: ../src/ui/pub-designs.js
[basic]: ../src/ui/basic-designs.js
[svgdesignUI]: ../src/ui/svg-design.js
[structctl]: ../src/ui/structure-controls.js
[sqctl]: ../src/ui/squiggle-controls.js
[coilctl]: ../src/ui/coil-controls.js
[panels]: ../src/ui/panels.js
[main]: ../src/ui/main.js
[index]: ../index.html
[thumbs]: ../src/ui/thumbs.js
[optthumbs]: ../src/ui/option-thumbs.js
[share]: ../src/ui/share.js
[verdict]: ../src/ui/verdict.js
[panelworker]: ../src/ui/panel-worker.js
[swatchworker]: ../src/ui/swatch-worker.js
[layers]: ../src/engine/layers.js
[fabricresult]: ../src/engine/fabric-result.js
[stack]: ../src/engine/stack.js
[crossings]: ../src/engine/crossings.js
[backing]: ../src/engine/backing.js
[picture]: ../src/engine/picture.js
[fields]: ../src/engine/fields.js
[shapes]: ../src/engine/shapes.js
[emit]: ../src/engine/emit.js
[drawing]: ../src/engine/drawing.js
[svgparse]: ../src/engine/svg-parse.js
[svglines]: ../src/engine/svg-lines.js
[polyregion]: ../src/engine/polygon-region.js
[solidfill]: ../src/engine/solid-fill.js
[designexport]: ../src/engine/design-export.js
[generate]: ../src/engine/generate.js
[squiggle]: ../src/engine/squiggle.js
[wavegrid]: ../src/engine/wavegrid.js
[coil]: ../src/engine/coil.js
[chainmail]: ../src/engine/chainmail.js
[auxetic]: ../src/engine/auxetic.js
[star]: ../src/engine/starlattice.js
[crosshatch]: ../src/engine/crosshatch.js
[voronoi]: ../src/engine/voronoi.js
[bubbles]: ../src/engine/bubbles.js
[web]: ../src/engine/web.js
[sunflower]: ../src/engine/sunflower.js
[rosette]: ../src/engine/rosette.js
[spirograph]: ../src/engine/spirograph.js
[conformal]: ../src/engine/conformal.js
[flowlines]: ../src/engine/flowlines.js
[spiral]: ../src/engine/spiral.js
[weave]: ../src/engine/weave.js
[dipweave]: ../src/engine/dipweave.js
[meander]: ../src/engine/meander.js
[turing]: ../src/engine/turing.js
[svgdesign]: ../src/engine/svgdesign.js
[infill]: ../src/engine/infill.js
[truchet]: ../src/engine/truchet.js
[parquet]: ../src/engine/parquet.js
[lissajous]: ../src/engine/lissajous.js
[halftone]: ../src/engine/halftone.js
[relief]: ../src/engine/relief.js
[fringe]: ../src/engine/fringe.js
[pillars]: ../src/engine/pillars.js
