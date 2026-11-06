# Phase 0: Foundations

**Goal:** prepare the code for the library without changing anything that prints. When Phase 0 is merged:
- every card carries its shelf, family and support;
- the gallery shows the three shelves;
- the construction report tells the truth about what prints;
- side views exist;
- old links migrate through one map;
- variant groups can share settings.

**Rule for the whole phase:** the output snapshots from T0.0 must not change, except where a ticket explicitly says so.

Contracts are in [02_Architecture_and_Contracts.md](../02_Architecture_and_Contracts.md). Paths are relative to the repository root.

| Ticket | Title | Depends on | Size | Parallel with |
|---|---|---|---|---|
| T0.0 | Output snapshots of every card | — | S | — (do first) |
| T0.1 | Card IDs, metadata and `library.js` | T0.0 | M | T0.2 |
| T0.2 | Strand provenance tags | T0.0 | M | T0.1 |
| T0.3 | Construction report | T0.2 | M | T0.4 |
| T0.4 | Side profile and side view | T0.2 | M | T0.3 |
| T0.5 | Shelves in the gallery | T0.1, T0.4 | M | T0.6 |
| T0.6 | State schema v4 and migration map | T0.1 | L | T0.5 |
| T0.7 | Variant groups (shared settings, "Also on") | T0.5, T0.6 | M | — |

---

## T0.0 Output snapshots of every card

**Why:** Phase 0 and Phase 1 move a lot of code. Snapshots prove that a card still prints exactly what it printed before (Contract C13).

**Files**
- `dev/tools/update-design-snapshots.mjs` (new)
- `dev/tests/design-snapshots.test.js` (new)
- `dev/tests/snapshots/designs/*.json` (generated)
- `package.json`: add `"snapshots": "node dev/tools/update-design-snapshots.mjs"`

**Implementation**
1. In the tool, load the default profiles exactly as `dev/tests/helpers.js` does: `site/profiles/machines/prusa-mk3s.json` and `site/profiles/materials/filaflex-95-foamy.json`.
2. Import `DESIGNS` from `site/src/ui/designs.js`. For every entry with `status === 'ready'` (hidden ones included):
   1. **Default settings:**
      - Use `d.defaults()`, then set the size to 40 × 30 mm with `d.setSize(s, 40, 30)` where it exists, otherwise `s.width = 40; s.height = 30`.
      - Legacy entries (`loop-pile`, `squiggle`): find how `site/src/ui/main.js` generates them (search for `.generate(` and `generate(machine` there) and call the same function with the same arguments, at 40 × 30 mm.
   2. **Each preset:** `d.sanitize({ ...defaults, ...preset.patch, width: 40, height: 30 })`.
   3. **Generate:** `const result = d.generate(machine, material, settings, {})`.
   4. **Summarise:**
      - `gcodeSha256`: SHA-256 of `result.gcode`, using `node:crypto`. If the G-code contains a date, time or version line, remove those lines before hashing and list the pattern you remove in a comment at the top of the tool.
      - `strands`: `result.strands.length`;
      - `moves`: `result.moves.length`;
      - `extrudeMm`: the sum of extruding move lengths, rounded to 0.1;
      - `zMin` and `zMax` over extruding moves;
      - `ties`: the number of strands named `'Structural tie'`;
      - `settingsHash`: SHA-256 of `JSON.stringify(settings)` with sorted keys, first 12 characters.
3. Write one JSON file per card, `dev/tests/snapshots/designs/<id>.json`, holding an array of the summaries (default first, then presets in registry order), pretty-printed with 2 spaces and a trailing newline.
4. The test regenerates every summary and compares it with `assert.deepEqual`. On failure, the message names the card and preset and says: *"run `npm run snapshots` only if this change is intended, and explain it in the PR"*.

**Tests**
- `dev/tests/design-snapshots.test.js` covers every ready card and preset.
- Run it twice in a row: the hashes must match (determinism).

**Acceptance**
- There is a snapshot file for each of the 31 ready cards.
- `npm test` passes.
- The test takes under 60 s in total; if slower, say so in the PR with the measurement.

**Review focus**
- No card is skipped.
- Legacy designs are generated through the same path as the app.
- The hash is stable.
- No snapshot is produced from an error result (a card that throws must fail loudly).

---

## T0.1 Card IDs, metadata and `library.js`

**Why:** every later ticket uses the shelf, family, support and state of a card (Contract C1), and the card IDs below.

**Files**
- `site/src/ui/library.js` (new)
- `site/src/ui/more-designs.js`: `layered()` passes the new fields through
- `site/src/ui/designs.js`, `line-designs.js`, `pub-designs.js`, `basic-designs.js`, `svg-design.js`: metadata on each entry
- `dev/tests/library.test.js` (new), `dev/tests/designs.test.js`

**Implementation**
1. Create `site/src/ui/library.js` with `SHELVES`, `FAMILIES`, `validateCard(mod)`, `libraryGroups()` and `variantsOf(id)`, exactly as in Contract C1. `FAMILIES` keys and labels:

   | key | label | key | label | key | label |
   |---|---|---|---|---|---|
   | `waves` | Waves | `grids` | Grids | `cells` | Cells |
   | `lattices` | Lattices | `rings` | Rings and bubbles | `loops` | Loops |
   | `curves` | Curves | `radial` | Radial | `fields` | Field lines |
   | `tiles` | Tiles | `lace` | Lace | `sheets` | Sheets |
   | `nets` | Random nets | `motif` | Motif on a backing | `woven` | Woven |
   | `textures` | Textures | `pile` | Pile and fringe | `spacers` | Spacers |

2. `validateCard(mod)` returns a list of problems. It checks that:
   - `shelf` is a key of `SHELVES`, and `family` a key of `FAMILIES`;
   - `joins` is a non-empty sentence of at most 120 characters ending in a full stop;
   - `support` is one of the three policies, and `state` one of the three states;
   - `sources` is an object;
   - `settingsKey` is absent or a string;
   - `legacy` is absent or an array of `{ id, patch? }`.
3. In `layered(def)` (`site/src/ui/more-designs.js`), copy `shelf`, `family`, `joins`, `support`, `state`, `settingsKey`, `sources`, `patternEffects`, `colourModes` and `legacy` from `def` onto the returned object. Do the same for the entries written out in full in `site/src/ui/designs.js`.
4. Fill in the metadata of the **31 existing cards** from this table. Leave `sources` as `{}` where the table has none. These are the values until Phase 1 splits the cards.

   | id | shelf | family | support | state | joins |
   |---|---|---|---|---|---|
   | `loop-pile` | raised | pile | built-in | untested | Raised loops are anchored to an open base mesh. |
   | `squiggle` | layered | waves | self | untested | Two wavy layers cross and fuse where they meet. |
   | `coil` | flat | loops | self | untested | One strand in rows; each loop touches the next row. |
   | `weave` | layered | woven | self | untested | Lower and upper pieces at two levels, joined by ramps; crossings fuse. |
   | `spiral` | layered | radial | built-in | untested | Nested rings held by a crossing carrier. |
   | `boucle` | layered | rings | built-in | untested | Rings sit on a carrier line, for edges. |
   | `relief` | raised | textures | built-in | untested | Rows rise and fall over a crossed base. |
   | `fringe` | raised | pile | built-in | untested | Hanging loops with free ends, anchored to base rows. |
   | `zigzag` | layered | waves | self | untested | Two zigzag layers fuse where they meet. |
   | `svgdesign` | layered | motif | auto | untested | Your drawing, held by a backing printed with it. |
   | `crosshatch` | layered | grids | self | untested | Straight lines in two or three directions fuse where they cross. |
   | `auxetic` | flat | cells | self | untested | Zigzag rows joined by struts into cells. |
   | `dipweave` | raised | woven | self | untested | Wefts rise over the warps and dip between them. |
   | `web` | layered | radial | self | untested | A spiral crossed by a radial zigzag. |
   | `chainmail` | layered | rings | self | untested | Rings on two layers overlap and fuse. |
   | `meander` | layered | motif | auto | untested | A space-filling curve held by a backing. |
   | `harmonograph` | flat | curves | self | untested | One closed curve crosses itself in diamonds. |
   | `truchet` | layered | tiles | self | needs-repair | Tile curves meet at tile edges; a shifted second layer crosses them. |
   | `voronoi` | layered | cells | self | untested | Triangle edges print first, then the cells over them. |
   | `turing` | layered | motif | auto | untested | Grown stripes held by a backing. |
   | `conformal` | layered | fields | self | untested | A square grid bent round holes; its two directions cross. |
   | `sunflower` | layered | radial | self | untested | Two seed spirals wind opposite ways and meet at the seeds. |
   | `rosette` | layered | radial | self | untested | Two wavy spirals in opposite phase cross. |
   | `flowlines` | layered | fields | self | untested | Lines along a flow, crossed at 90 degrees. |
   | `bubbles` | layered | rings | self | untested | Packed rings held by a ring in every gap. |
   | `parquet` | layered | tiles | self | needs-repair | Blocks of crossed lines; the seams between blocks rely on ties. |
   | `spirograph` | layered | radial | self | untested | Two rings of curls, half a ring apart, cross. |
   | `starlattice` | flat | lattices | self | untested | Star straps in non-crossing families meet at the tile edges. |
   | `halftone` | layered | waves | self | untested | A crossed net whose line thickness carries a picture. |
   | `spacer` | raised | spacers | built-in | untested | Two nets held apart by small pillars. |
   | `pillarweave` | raised | spacers | self | untested | Fibre locked round upright pillars. |

   The preset tile `zigzag-mesh` gets no metadata; `validateCard` skips entries with `status: 'preset'`. **Luis will tell us which cards are already printed** (Phase 8, T8.1); until then everything except Parquet and Truchet is `untested`.

5. **Reserve the card IDs for the whole plan.** Add this table as a comment block at the top of `library.js`, so nobody invents a different ID later. **IDs are permanent.** Existing designs keep their ID when the card *is* that design; where a card shows a different name, the name changes and the ID does not.

   | Plan ID | Card ID | Name | Notes |
   |---|---|---|---|
   | F-01 | `rings-flat` | Rings · flat | new; settingsKey `rings` |
   | F-02 | `honeycomb-flat` | Honeycomb · flat | from `auxetic` with `cell: 'hexagon'`; settingsKey `honeycomb` |
   | F-03 | `auxetic` | Re-entrant (bow-tie) | existing ID |
   | F-04 | `starlattice` | Star lattice | existing |
   | F-05 | — | *withdrawn* | the same as L-08 (see the plan's §5.1); do not use the ID `isogrid-flat` |
   | F-06 | `rotating-squares` | Rotating squares | new |
   | F-07 | `rotating-triangles` | Rotating triangles | new |
   | F-08 | `arrowhead-band` | Arrowhead band | new |
   | F-09 | `spiral-cells` | Spiral cells | new |
   | F-10 | `stochastic-net` | Stochastic net | new |
   | F-11 | `star-metric` | Star-metric cells | new |
   | F-12 | `isohedral-tiles` | Isohedral tiles | new |
   | F-13 | `connected-lace` | Connected lace | new |
   | F-14 | `meander-ties` | Meander with ties | new |
   | F-15 | `voronoi-cells` | Voronoi cells | new |
   | F-16 | `coil` | Looped rows | existing ID |
   | F-17 | `figure8-rows` | Figure-8 rows | new ID, Coil generator |
   | F-18 | `harmonograph` | Harmonograph | existing |
   | F-19 | `kirigami` | Kirigami sheet | new |
   | L-01 | `squiggle` | Wave net | existing ID; settingsKey `wave` |
   | L-02 | `zigzag` | Zigzag net | existing ID |
   | L-03 | `square-net` | Square-wave net | new ID, Squiggle generator |
   | L-04 | `honeycomb-layered` | Honeycomb · layered | new ID, Squiggle generator; settingsKey `honeycomb` |
   | L-05 | `figure8-net` | Figure-8 net | new ID, Squiggle generator |
   | L-06 | `chainmail` | Rings · layered | existing ID; settingsKey `rings` |
   | L-07 | `bubbles` | Bubbles | existing |
   | L-08 | `crosshatch` | Grid & isogrid · layered | existing ID; settingsKey `grid` |
   | L-09 | `rotated-stack` | Rotated stack | new |
   | L-10 | `moire-net` | Moiré net | new |
   | L-11 … L-18 | `voronoi`, `web`, `sunflower`, `rosette`, `spirograph`, `conformal`, `flowlines`, `spiral` | unchanged names | existing |
   | L-19 | `weave` | Woven draft | existing ID |
   | L-20, L-21 | `truchet`, `parquet` | unchanged | existing |
   | L-22, L-23 | `meander`, `turing` | unchanged | existing |
   | L-24 | `svgdesign` | Your drawing | existing ID |
   | L-25 | `lace-backing` | Lace + backing | new |
   | L-26 | `step-lace` | Step, ripple and petal lace | new |
   | L-27 | `paired-loops` | Paired loops | new |
   | L-28 | `scales` | Scales on a carrier | new |
   | L-29 | `boucle` | Bouclé & picots | existing |
   | R-01 | `rings-raised` | Rings · raised | new; settingsKey `rings` |
   | R-02 … R-04 | `loop-pile`, `relief`, `dipweave` | unchanged | existing |
   | R-05 | `looped-net` | Looped net | new ID, Squiggle generator |
   | R-06 … R-08 | `fringe`, `spacer`, `pillarweave` | unchanged | existing |
   | R-09 | `grid-lifted` | Grid · lifted crossings | new; settingsKey `grid` |
   | R-10 | `grid-sliding` | Grid · sliding channels | new; settingsKey `grid` |
   | R-11 | `wave-bridged` | Wave net · bridged crossings | new; settingsKey `wave` |
   | R-12 | `corrugation` | Corrugation | new |
   | R-13 | `colour-exposure` | Colour exposure texture | new |
   | (hidden) | `squiggle-rings`, `squiggle-zigzag`, `coil-shapes`, `halftone` | legacy only | open old links exactly (T1.2, T1.3, T1.4, T1.5) |

**Tests**
- `dev/tests/library.test.js`:
  - every ready card passes `validateCard`;
  - every `family` used exists;
  - `libraryGroups()` puts every visible ready card on exactly one shelf;
  - the ID table in the header comment matches no existing ID with a different meaning.
- `dev/tests/designs.test.js`: unchanged expectations still pass.

**Acceptance**
- No visible change and no snapshot change.
- `validateCard` reports nothing for the 31 cards.

**Review focus**
- The values match the tables exactly.
- No ID is reused.
- `layered()` passes every field through.

---

## T0.2 Strand provenance tags

**Why:** the construction report, carriers, seams and raised capabilities need to know which family and role every strand has (Contract C3). Today, ties are recognised by name and carriers are not marked at all.

**Files**
- `site/src/engine/layers.js` (`layersToStrands`, `layeredResult`)
- `site/src/engine/fabric.js` (`clipStrands`, `connectStrands`)
- `site/src/engine/fabric-result.js` (`finishFabric`)
- `site/src/engine/backing.js` (`backingStack`, `addBackingMesh`)
- `site/src/engine/network.js` (`name === 'Structural tie'`)
- `site/src/engine/crossings.js` (`resolveCrossings` must copy tags onto pieces)
- `site/src/engine/stack.js` (`addExtraLayers`, `stackStrands`)
- `dev/tests/provenance.test.js` (new)

**Implementation**
1. In `layersToStrands`, both branches:
   - accept generators that return `families` (an array of names) through a new option `families`;
   - give each strand `family: families?.[k] ?? `L${k + 1}``, `role: 'native'` and `source` (a new option, the card ID).
   - `layeredResult` passes `families: built.extra?.families` and `source`. `layered()` in `site/src/ui/more-designs.js` passes `families` from `build()`'s return value: change `build` to allow `{ layers, families }`.
2. In `connectStrands`, created ties get `family: 'ties'` and `role: 'tie'`, and keep `name: 'Structural tie'` for display.
3. In `clipStrands`, `simplifyStrands`, `joinStrokes`, `orderStrands` and `resolveCrossings`, make sure **every new strand object copies `family`, `role` and `source`** from the strand it comes from. `joinStrokes` must only join strands with equal `family` and `role`. Search for every `({ ...s,` and `id: \`` in these files.
4. Carriers: `backingStack` and `addBackingMesh` produce `role: 'carrier'` and `family: 'carrier-1'` / `'carrier-2'`. `gridStrands` inside `finishFabric(... reinforce: true)` does the same.
5. In `stack.js`, repeated passes keep their source's tags; rotated alternates get `family` with a `-r` suffix.
6. Replace `name === 'Structural tie'` checks with `role === 'tie'` in `fabric-result.js` (line 26) and `network.js` (line 24).

**Tests** (`dev/tests/provenance.test.js`)
- For `crosshatchLayers` 0/90 through `layeredResult`: strands carry families `L1` and `L2` and role `native`, and ties carry role `tie`.
- For `meander` (with its backing): motif strands are `native` and backing strands `carrier`. The motif is set to `role: 'motif'` in Phase 1; here, only check that the carrier is tagged.
- After crossing resolution, no strand lacks `family` or `role`.

**Acceptance:** all snapshots unchanged; `npm test` passes.

**Review focus**
- No path through the pipeline drops the tags (look for object spreads that rebuild strands).
- `joinStrokes` does not merge different families.

---

## T0.3 Construction report

**Why:** the audit found that the current report can count a card as fine when a whole path family was lost to clipping, or when ties are holding it together ([audit, "Parquet findings"](../../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md)). The library's side views, badges and raised cards rely on a truthful report (Contract C4).

**Files**
- `site/src/engine/construction-report.js` (new)
- `site/src/engine/layers.js` (`layeredResult` calls it)
- the raised generators' result builders (`relief.js`, `fringe.js`, `pillars.js`, `dipweave.js`, `generate.js`) call it too
- `site/src/ui/verdict.js` (shows errors and warnings in plain words)
- `dev/tests/construction-report.test.js` (new)

**Implementation**
1. `buildConstructionReport(result, { boundary, strandWidth, layerHeight, intendedFamilies })`:
   1. **families:** group `result.strands` by `family`, then by `role`; count strands and sum lengths.
   2. **lostFamilies:** `intendedFamilies` (from `extra.families`, or `L1…Ln` from `layerCount`) minus the families present among `role === 'native' | 'motif'`.
   3. **crossings:** use `findCrossings` (`site/src/engine/crossings.js`) on all extruding strands.
      - For each crossing, read the Z of both strands at the crossing point. If the difference is at most `layerHeight × 1.5`, the type is `fused`; otherwise it is `separated`, unless a strand point carries `cls === 'lifted'` (`lifted`) or the upper strand's role is `channel` (`channel`).
      - Fill in `byPair` (unordered family pairs) and `byStack`.
   4. **ties:** strands with `role: 'tie'`, recording each one's midpoint.
   5. **carrier:** the distinct carrier families and their count.
   6. **z:** min and max `z` over extruding points.
   7. **components:** union-find over strands, joining two strands when they cross or when an endpoint lies within `strandWidth` of the other.
   8. **componentsWithoutTies:** the same, excluding `role: 'tie'`.
   9. **danglingEnds:** strand endpoints that are further than `strandWidth` from the boundary and touch no other strand within `strandWidth`.
   10. **maxValence:** the largest number of strands passing within `strandWidth / 2` of one crossing point.
   11. **errors:** each lost family produces "*Layer 2 (L2) was lost when the pattern was cut to the shape.*"
   12. **warnings:**
       - `componentsWithoutTies > 1`: "*Held together by N added ties.*"
       - `danglingEnds > 0`: "*N loose ends inside the piece.*"
2. Put the report on `result.construction` and **keep the existing `result.report` unchanged**, because other code reads it.
3. In `verdict.js`, show `construction.errors` as blocking (Export disabled with the message) and `warnings` as notes. Use the existing verdict styles.

4. **Shelf check.** Add `shelfFromConstruction(report, { layerHeight })` to `construction-report.js`. It implements the plan's shelf rule:
   - **flat:** exactly one native family, or several whose `byPair` crossings are under 1 per cm², and `z.max ≤ 2 × layerHeight + 0.05`;
   - **layered:** two or more native families that cross, or any `carrier` role, with `z.max ≤ (native families + carrier passes + 1) × layerHeight + 0.05` (a carrier pass is a layer of its own);
   - **raised:** anything higher.

   A registry test generates every visible ready card at default settings and asserts `shelfFromConstruction(...) === card.shelf`. Keep an `SHELF_EXCEPTIONS` map of card ID → one-sentence reason for the few cards whose declared shelf is a deliberate choice; for example, `coil` is declared flat although its self-crossings lift by one layer. **The reviewer approves every exception.**

**Tests** (`dev/tests/construction-report.test.js`)
- **Parquet**, 20 × 20 mm, block 0.8 mm, ratio 2, spacing 5 mm, turn 45°: `lostFamilies` is not empty, and there is an error (the audit's third diagnostic).
- **Parquet default herringbone**, 100 × 100 mm: `ties.count > 0` and `componentsWithoutTies > 1` (the audit found 3 raw components and 44 ties).
- **Crosshatch 0/90**: no lost family; `byPair` contains `L1–L2`; every crossing is `fused`.
- **Relief default**: `z.max` is about the relief height plus the base (within 0.05 mm).
- **Bubbles default**: `componentsWithoutTies === 1`.

**Acceptance**
- The report is attached to every result.
- Parquet's audit cases now show errors or warnings in the verdict.
- The snapshots are unchanged (the report is not part of the G-code).

**Review focus**
- The report is computed from the final strands only, not from the inputs.
- Messages are plain English.
- Performance: a 100 × 100 mm swatch adds under 200 ms. Use the existing crossing grid (`findCrossings` with `cell`).

---

## T0.4 Side profile and side view

**Why:** the side view is how a card shows *how it joins* (decision D4). It must come from the real strands (Contract C5).

**Files**
- `site/src/engine/side-profile.js` (new)
- `site/src/ui/sideview.js` (new)
- `site/src/ui/thumbs.js` (strip on card faces)
- `site/src/ui/panels.js` (`DesignPanel` header)
- `site/src/ui/styles.css`
- `dev/tests/side-profile.test.js` (new)

**Implementation**
1. `sideProfile(strands, { from, to, band = 1 })`:
   1. For each strand segment, find where it crosses the slab of half-width `band` around the section line.
   2. Project the points onto the line: `s` = distance from `from`.
   3. Interpolate `z`.
   4. Return the samples sorted by `s`, keeping `family` and `role`.
2. `defaultSection(result)`: a 20 mm line through the centre of the bounding box of the native strands, perpendicular to the longest native strand's mean direction, so it cuts across the strands.
3. `drawSideView(profile, { width, height, exaggerate = 5, compact = false })` returns an SVG string:
   - draws circles of diameter `bead` at each sample, scaled so that Z × `exaggerate` fits;
   - colours them by role (native: currentColor; carrier: muted; tie: dashed outline; channel: accent);
   - in non-compact mode, adds a label *"height × 5"*.
4. **Card face:** below the existing thumbnail, a 36 × 6 px strip from a small generation. Reuse the thumbnail's generation in `layered()`'s `picture()` path and keep it lazy.
5. **Card header:** in `DesignPanel`, above the first section, add the side view (full width, about 60 px high) and the `joins` line from C1. The "Also on" links come in T0.7.

**Tests** (`dev/tests/side-profile.test.js`)
- A crosshatch 0/90 profile has two distinct Z levels (the settled crossing lift).
- A relief profile spans its relief height.
- A flat single-family net has one Z level.
- The samples lie within the swatch.

**Acceptance**
- Every card shows a strip and a header side view.
- Opening the panel is no slower than now: the side view is computed from the existing preview result, not from a second generation.

**Review focus**
- The profile is real data, not an icon.
- Laziness is kept.
- The drawing is legible in the app's light and dark styles.

---

## T0.5 Shelves in the gallery

**Why:** decision D2. Replace *Essentials / More structures* with the three shelves.

**Files:** `site/src/ui/library.js` (`libraryGroups`), `site/src/ui/main.js` (the gallery, around line 1663), `site/src/ui/styles.css`, `site/index.html` (only if the gallery container needs headings), `dev/tests/library.test.js`.

**Implementation**
1. `libraryGroups()` returns, for each shelf in the order flat → layered → raised, the families in the order of `FAMILIES`. Within a family, cards are sorted by state (`tested` first, then `untested`, then `needs-repair`), then by name.
2. In `main.js`, render each shelf as a heading (the shelf label, plus its hint as subtitle text) followed by family groups. Each group has a small family label and the cards.
3. **Card face:** the thumbnail, the side-view strip (T0.4), the name and badges.
   - Support badge: *Holds itself* for `self`, *+ backing* for `auto`, *Built-in carrier* for `built-in`.
   - State badge: *Untested* or *Needs repair*; tested cards have none.
   - Badges are text with an `aria-label`.
4. Keep hidden cards out of the gallery; they still open from links.
5. Keep keyboard navigation: arrow keys and Tab move between cards the same way as now.

**Tests:** `libraryGroups()` ordering. The UI change is checked in the browser.

**Acceptance**
- The three shelves are visible, with the cards in their family groups and readable badges at desktop and phone width.
- Selecting a card works as before.

**Review focus**
- No card disappears.
- The gallery's existing lazy thumbnail loading is kept.
- Accessibility.

---

## T0.6 State schema v4 and migration map

**Why:** splitting and renaming cards must never break a saved link, file or swatch code (Contract C12).

**Files**
- `site/src/ui/library.js` (`MIGRATIONS`, `migrateState`)
- `site/src/ui/share.js` (`sanitizeState`, `DESIGN_IDS`)
- `site/src/ui/main.js` (`settingsOf`, line 1697; `state.primary` and `state.squiggle` uses)
- `site/src/ui/file-name.js`
- `dev/tests/migration.test.js` (new), `dev/tests/share.test.js`

**Implementation**
1. `migrateState(raw)`:
   1. If `raw.v === 4`, return it as is.
   2. **v3 → v4:**
      - move `primary` to `designs['loop-pile']` and `squiggle` to `designs.squiggle`;
      - turn `colorChange: true` into `colourMode: 'face'` on every settings object (C7);
      - turn the global backing state into `support` on `auto` cards (C8);
      - set `v: 4`.
   3. Then map the design ID through `MIGRATIONS`.
2. `MIGRATIONS` is generated from each card's `legacy` field (C1), plus these rules. **Exact** means the same generator with the same settings, so the snapshot must be identical.

   | Old | Condition | New card | Exact? |
   |---|---|---|---|
   | `squiggle` | `shape: 'wave'` | `squiggle` (Wave net) | exact |
   | `squiggle` | `shape: 'square'` / `'honeycomb'` / `'figure8'` / `'looped'` | `square-net` / `honeycomb-layered` / `figure8-net` / `looped-net` | exact (they call the Squiggle generator with that shape) |
   | `squiggle` | `shape: 'zigzag'` | `zigzag` if T1.3 proves parity, otherwise `squiggle-zigzag` (hidden) | exact by construction |
   | `squiggle` | `shape: 'ring'` | `squiggle-rings` (hidden) | exact |
   | `zigzag-mesh` | — | as `squiggle` + `{ shape: 'zigzag', mode: 'parallel' }`, then the row above | exact |
   | `coil` | `shape: 'looped'` | `coil` | exact |
   | `coil` | `shape: 'figure8'` | `figure8-rows` | exact |
   | `coil` | any other shape | `coil-shapes` (hidden) | exact |
   | `auxetic` | `cell: 'hexagon'` | `honeycomb-flat` | exact |
   | `auxetic` | `cell: 'reentrant'` | `auxetic` | exact |
   | `halftone` | — | `halftone` (hidden; shows a note: "Now in Wave net → Pattern → Line thickness") | exact |

3. `sanitizeState` calls `migrateState` first, then sanitises. `DESIGN_IDS` includes hidden legacy cards.
4. **Settings keys that differ from the card ID** (`squiggle` → `wave`, `chainmail` → `rings`, `crosshatch` → `grid`; the new hexagon card → `honeycomb`): `migrateState` moves `designs[id]` to `designs[settingsKey]`. When a settings key is introduced in a later ticket, that ticket adds its move to this function, with a test.
5. `settingsOf(id)` becomes `state.designs[card.settingsKey ?? id]`. Remove the `loop-pile` and `squiggle` special cases once T1.2 has moved Squiggle to the shared panel. Until then, keep them reading `designs[...]`.
6. **Swatch codes and file names** (`file-name.js`): keep the format, and make sure old codes with old IDs parse through `MIGRATIONS`.

**Tests** (`dev/tests/migration.test.js`)
- Every old ID, with each of its presets, opens a card that exists and is ready.
- A v3 state with `colorChange: true` gives `colourMode: 'face'`.
- A v3 state with squiggle settings round-trips to `designs.squiggle`.
- For each **exact** row, the G-code of the migrated state equals the G-code of the old state (use the T0.0 summaries).
- Garbage input (wrong types, unknown IDs) gives the default state without throwing.

**Acceptance:** links made before this change open the same design with the same output.

**Review focus**
- Migration is pure and runs before sanitising.
- No key is silently dropped.
- The hidden legacy cards are reachable only by links.

---

## T0.7 Variant groups (shared settings, "Also on")

**Why:** decision D3. Cards with the same `settingsKey` share one settings object, and the header links to the other shelves.

**Files:** `site/src/ui/library.js` (`variantsOf`), `site/src/ui/panels.js` (`DesignPanel` header), `site/src/ui/main.js` (switching design), `dev/tests/library.test.js`.

**Implementation**
1. `variantsOf(id)` returns the ready, non-hidden cards with the same `settingsKey`, ordered flat → layered → raised.
2. **The variant contract:** all cards in a group use **one shared `defineControls` object.** Its defaults cover every key any variant uses; a variant ignores keys it doesn't use. The test enforces that the cards of a group have identical `defaults()` key sets.
3. **Header:** "Also on:" followed by one button per other variant (label: the shelf name), shown only when `variantsOf(id).length > 1`.
   - Clicking sets `state.design` to that card and leaves `state.designs[settingsKey]` untouched, then regenerates.
   - Undo/redo records it like any design change.
4. **No variant group exists yet** (they arrive in Phases 1, 2 and 5). Test with a fixture: two fake registry entries sharing a key.

**Tests**
- With fixture cards: switching keeps settings.
- `variantsOf` order.
- A group whose cards have mismatched defaults fails the registry test.

**Acceptance:** the infrastructure is merged with no visible change, because no group exists yet.

**Review focus:** state handling under undo/redo and share links (`design` changes, `designs[settingsKey]` stays).
