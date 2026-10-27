# Architecture and contracts

This document describes how FilaFabric works today, what the library adds, and the **data shapes every module must respect**. The tickets refer to the contracts by their section numbers here, for example "Contract C3". A change to a contract needs the reviewer's approval first, because other tickets depend on it.

All paths are relative to the repository root (<https://github.com/telenaco/filafabric>, `library` branch): the website is in `site/`, tests and tools in `dev/`.

---

## 1. How it works today

```
UI state (site/src/ui/main.js, `state`)
   │  state.design = card id; settings in state.designs[id]
   │  (legacy: state.primary for loop-pile, state.squiggle for squiggle)
   ▼
Registry entry (site/src/ui/designs.js → DESIGNS)
   │  mod.generate(machine, material, settings, { outline, vector, picture, … })
   ▼
Card build function (e.g. layered({ build }) in site/src/ui/more-designs.js)
   │  build(settings, boundary, context) → { layers: Polyline[][], extra?, warnings? }
   ▼
Engine generator (e.g. crosshatchLayers in site/src/engine/crosshatch.js)
   ▼
layeredResult (site/src/engine/layers.js)
   │  resolveConfig → layersToStrands(…, coherent: true)
   │     clip to boundary → connectStrands (adds "Structural tie" strands)
   │     → orderStrands → resolveCrossings (settles crossings, lifts over earlier passes)
   │  emitStrands (site/src/engine/emit.js) → moves; M600 where strand.pauseBefore
   │  computeStats, crossingReport, writeGcode (site/src/engine/gcode.js)
   ▼
finishFabric (site/src/engine/fabric-result.js) → result { cfg, strands, moves, stats, warnings, gcode, report, … }
   ▼
verdict (site/src/ui/verdict.js), preview (site/src/ui/preview.js), export (site/src/engine/design-export.js)
```

- **Raised designs** (`relief.js`, `fringe.js`, `pillars.js`, `dipweave.js`, and the loop pile in `generate.js`) produce strands with their own `z` rather than going through the coherent layering.
- **Global extras** are applied around the design in `site/src/ui/main.js` and `site/src/engine/design-export.js`: the optional backing mesh (`addBackingMesh` in `site/src/engine/backing.js`), extra layers (`addExtraLayers` in `site/src/engine/stack.js`), perimeters, and the imported drawing (`composeSvgLines` in `site/src/engine/svg-lines.js`).
- **The share state** is version 3 (`sanitizeState` in `site/src/ui/share.js`): `{ v: 3, design, machine, material, primary, advanced, squiggle, designs, outline, vector, print }`.
- **The gallery** is `galleryGroups()` in `site/src/ui/designs.js`, which splits the cards into `ESSENTIALS` and the rest; it is rendered in `site/src/ui/main.js` (around line 1663).
- **A design's panel** is `DesignPanel` in `site/src/ui/panels.js`, which builds one section per entry of `mod.controls` using `SECTION_TYPES`: `presets`, `size`, `shape`, `choice`, `switch`, `sliders`, `pattern`. Squiggle and the loop pile still use hand-written panels in `site/index.html`.

---

## 2. What the library adds (module map)

| New or changed module | Owns | Tickets |
|---|---|---|
| `site/src/ui/library.js` (new) | Shelves, families, variant groups, `libraryGroups()`, `variantsOf()`, the migration map and `migrateState()` | T0.1, T0.5, T0.6, T0.7 |
| `site/src/ui/designs.js` and registry files | Card metadata on every entry (Contract C1) | T0.1, Phase 1 |
| `site/src/engine/layers.js`, `fabric.js`, `backing.js`, `fabric-result.js` | Strand provenance tags (Contract C3) | T0.2 |
| `site/src/engine/construction-report.js` (new) | The construction report (Contract C4) | T0.3 |
| `site/src/engine/side-profile.js` (new) and `site/src/ui/sideview.js` (new) | Side profile data and its drawing (Contract C5) | T0.4 |
| `site/src/ui/panels.js` | Panel template order (Contract C2); new sections `colour` and `support`; the card header | T1.1, T1.7, T1.8 |
| `site/src/engine/picture.js`, `site/src/engine/pattern-effects.js` (new) | Pattern source and effect (Contract C6) | T1.6 |
| `site/src/engine/colour-plan.js` (new) | Colour modes, giving `pauseBefore` and preview colours (Contract C7) | T1.7 |
| `site/src/engine/backing.js` | The one carrier model (Contract C8) | T1.8 |
| `site/src/engine/order.js`, `lift.js`, `channels.js`, `climb.js` (new); `crossings.js`, `layers.js` (extended) | Raised capabilities (Contract C9) | Phase 4 |
| `site/src/engine/drawing.js`, `site/src/engine/svg-parse.js` | Line alignment and colour retention (Contracts C10, C11) | T7.1, T7.2 |
| `site/src/engine/regions.js` (new) | Colour regions and seams (Contract C11) | T7.3, T7.6 |
| `site/src/ui/share.js` | State schema v4 (Contract C12) | T0.6, T7.7 |
| `dev/tools/update-design-snapshots.mjs` (new), `dev/tests/design-snapshots.test.js` (new) | Output snapshots of every card (Contract C13) | T0.0 |

---

## 3. Contracts

### C1. Card metadata

Every registry entry keeps its existing fields (`id`, `name`, `blurb`, `about`, `file`, `status`, `controls`, `generate`, `defaults`, `sanitize`, `presets`, …) and gains:

```js
/**
 * @typedef {'flat' | 'layered' | 'raised'} Shelf
 * @typedef {'self' | 'auto' | 'built-in'} SupportPolicy
 *   self      the design holds itself together; no Support section, never a global backing
 *   auto      a carrier is added by default; the Support section is shown and can change it
 *   built-in  the carrier is part of the design (e.g. Spiral panel's reinforcement); shown read-only
 * @typedef {'tested' | 'untested' | 'needs-repair'} CardState
 *
 * @typedef {object} CardMeta
 * @property {Shelf} shelf
 * @property {string} family          key of FAMILIES in site/src/ui/library.js, e.g. 'rings'
 * @property {string} joins           one plain sentence: how the fabric joins ("Rings overlap and fuse in one pass.")
 * @property {SupportPolicy} support
 * @property {CardState} state
 * @property {string} [settingsKey]   variants share state.designs[settingsKey]; defaults to the card id
 * @property {{ catalogue?: string[], papers?: number[] }} sources   e.g. { catalogue: ['M4'], papers: [53, 66] }
 * @property {string[]} [patternEffects]  allowed Pattern effects (C6); first is the default
 * @property {string[]} [colourModes]     allowed Colour modes (C7); default ['one', 'face', 'per-layer']
 * @property {{ id: string, patch?: object }[]} [legacy]  old IDs (and setting patches) that open this card (C12)
 */
```

**Shelf rule.** The shelf is not a matter of taste. It is checked from the construction report (C4) by `shelfFromConstruction()`, ticket T0.3:
- **flat:** one native path family, or several that meet without crossing over each other, at the first layer height. Local settling where a strand crosses itself is allowed (up to 2 layer heights).
- **layered:** two or more native families that cross each other, or a motif with a carrier. A carrier pass is a layer of its own, so the allowed height is `(native families + carrier passes + 1) × layer height + 0.05 mm`.
- **raised:** deliberate height beyond crossing settles and stacked layers.

Deliberate exceptions are listed, with a reason, in `SHELF_EXCEPTIONS`.

`site/src/ui/library.js` exports:

```js
export const SHELVES = Object.freeze({
  flat:    { label: 'Flat',    hint: 'One layer that joins in the plane' },
  layered: { label: 'Layered', hint: 'Flat layers that cross at different heights, or a motif on a backing' },
  raised:  { label: 'Raised',  hint: 'Strands that deliberately leave the plane' },
});
export const FAMILIES = Object.freeze({ rings: { label: 'Rings' }, waves: { label: 'Waves' }, /* … */ });
export function validateCard(mod) { /* returns a list of problems; used by tests */ }
export function libraryGroups(designs = DESIGNS) { /* { flat: [{ family, cards }], layered: …, raised: … } */ }
export function variantsOf(id) { /* cards sharing settingsKey, in shelf order flat → layered → raised */ }
```

### C2. Panel template

A card's `controls` list must follow this order. Each group may appear at most once, apart from repeated `choice` entries inside Structure:

| Order | Group | Allowed kinds |
|---|---|---|
| 0 | Start from | `presets` (optional) |
| 1 | Size and shape | `size` |
| 2 | Structure | `choice` (zero or more), `petal` (optional metric editor) |
| 3 | Look and feel | `sliders` (one), optionally followed by a `switch` that belongs to it (for example Link in Bubbles) |
| 4 | Pattern | `pattern` (optional) |
| 5 | Colour | `colour` (new kind; replaces `switch key=colorChange`) |
| 6 | Support | `support` (new kind; present only when `support !== 'self'`) |

- `panelOrderErrors(controls)` in `site/src/ui/panels.js` returns the order violations; a registry test runs it on every card.
- The `shape` section kind is **not allowed** on library cards. It stays only for legacy panels until they are removed.
- The **card header** (side view, `joins` line, "Also on" variant links, *Print all variants*) is drawn by `DesignPanel` itself from C1. It is never listed in `controls`.

### C3. Strand provenance

Every strand that reaches `emitStrands` carries:

```js
/**
 * @typedef {object} Strand
 * @property {string} id
 * @property {number} layer
 * @property {'base' | 'supported'} kind      (existing)
 * @property {string} name                    (existing, e.g. 'Layer 1', 'Structural tie')
 * @property {string} family                  path family: 'L1', 'L2', … by default, or a name the generator gives
 * @property {'native' | 'motif' | 'carrier' | 'tie' | 'seam' | 'channel'} role
 * @property {string} [source]                card id (and region colour in Phase 7), e.g. 'rings-flat' or 'rings-flat@#ff0000'
 * @property {boolean} [pauseBefore]          (existing) M600 before this strand
 * @property {{ x: number, y: number, z: number, flow?: number, cls?: string }[]} pts
 */
```

Rules:
- **Generators may name their families** by returning `{ layers, families: ['warp', 'weft'] }`; `layersToStrands` copies `families[k]` to each strand of layer `k`, or uses `L${k + 1}`.
- **Every tool that adds strands sets `role`:**
  - `connectStrands` (`site/src/engine/fabric.js`) → `'tie'`;
  - backing and reinforcement (`backing.js`, and `gridStrands` via `finishFabric`) → `'carrier'`;
  - motif families of motif-on-carrier cards → `'motif'`;
  - seams (Phase 7) → `'seam'`;
  - Li-style channels (Phase 4) → `'channel'`.
- **Tags survive everything:** splitting, clipping, simplifying, joining, crossing resolution and re-ordering. When two strands are joined, they must share `family` and `role`; otherwise they are not joined.
- Existing behaviour keyed on `name === 'Structural tie'` (`fabric-result.js`, `network.js`) moves to `role === 'tie'`.

### C4. Construction report

`buildConstructionReport(result, { boundary, strandWidth, layerHeight })` in `site/src/engine/construction-report.js` reads only the **final** `result.strands` and returns:

```js
/**
 * @typedef {object} ConstructionReport
 * @property {{ family: string, role: string, strands: number, lengthMm: number }[]} families
 * @property {string[]} lostFamilies        families the generator produced that no final strand carries
 * @property {{ total: number, perCm2: number,
 *              byPair: { a: string, b: string, count: number }[],
 *              byStack: { type: 'fused' | 'separated' | 'lifted' | 'channel', count: number, maxHeightMm: number }[] }} crossings
 * @property {{ count: number, at: { x: number, y: number }[] }} ties
 * @property {{ passes: number, roles: string[] }} carrier     carrier passes counted on their own
 * @property {{ min: number, max: number }} z                  deposition Z envelope, mm
 * @property {number} components                              connected components of the printed graph (ties included)
 * @property {number} componentsWithoutTies                   the same without role 'tie'
 * @property {number} danglingEnds                            free strand ends inside the boundary (not at its edge)
 * @property {number} maxValence                              most strands meeting at one crossing
 * @property {string[]} errors                                e.g. "Layer 2 was lost when the pattern was clipped"
 * @property {string[]} warnings
 */
```

- The generator's *intended* families come from `result.extra.families`, or from `layerCount` (`L1`…`Ln`).
- A lost family is an **error**: it blocks export, with a plain message in the verdict.
- Crossing stack types:
  - `fused`: settled in contact by `resolveCrossings`;
  - `separated`: the upper strand is more than one layer height above the lower one at the crossing;
  - `lifted`: tagged by `lift.js`;
  - `channel`: tagged by `channels.js`.

### C5. Side profile

```js
// site/src/engine/side-profile.js (pure)
/**
 * Heights of the printed strands along a section line.
 * @param {Strand[]} strands
 * @param {{ from: {x,y}, to: {x,y}, band?: number }} section   band = half-width of the slice, mm (default 1)
 * @returns {{ s: number, z: number, family: string, role: string }[]}   s = distance along the section, mm
 */
export function sideProfile(strands, section) {}
/** The default section: a 20 mm line through the swatch centre, across the main print direction. */
export function defaultSection(result) {}
```

`site/src/ui/sideview.js` draws it as inline SVG:
- Z is exaggerated (×5 by default, and the label says so);
- colours follow `role`;
- the same function draws both the small strip on the card face and the large view in the card header.

### C6. Pattern source and effect

The existing keys stay: `pattern` (the source: `'even'`, a field ID from `FIELD_IDS` in `site/src/engine/fields.js`, or `'image'`) and `patternScale`. Add:

```js
// settings key, default = the card's first patternEffects entry (today's behaviour)
patternEffect: 'depth' | 'thickness' | 'spacing' | 'size' | 'height' | 'bonding'

// site/src/engine/pattern-effects.js
export const PATTERN_EFFECTS = Object.freeze({
  depth:     { label: 'Wave depth',   hint: 'Deeper waves where the pattern is dark' },
  thickness: { label: 'Line thickness (halftone)', hint: 'Thicker lines where the pattern is dark' },
  spacing:   { label: 'Spacing',      hint: 'Closer lines where the pattern is dark' },
  size:      { label: 'Cell size',    hint: 'Smaller cells where the pattern is dark' },
  height:    { label: 'Height',       hint: 'Higher where the pattern is dark' },
  bonding:   { label: 'Bonding',      hint: 'Strands touch (bond) where dark and keep a gap where light' },
});
```

- A card's build function receives the sampled field (`patternField` in `site/src/engine/picture.js`) and the effect, and applies it.
- **Thickness** reuses the flow/speed modulation in `site/src/engine/halftone.js` (moved behind this effect in T1.6).
- Rules from the research ([catalogue M2](../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m2--calibrated-two-colour-halftone-net)) apply to thickness:
  - drive width by extrusion, not by speed;
  - keep separate width maps for lines on the bed and lines over another net;
  - limit step changes between neighbouring cells.

### C7. Colour plan

```js
// settings keys (replace colorChange; colorChange: true migrates to colourMode: 'face')
colourMode: 'one' | 'face' | 'per-layer' | 'halftone2'
layerColours: string[]   // '#rrggbb' per printed layer, used for the preview and the swatch record only

// site/src/engine/colour-plan.js (pure)
/**
 * Marks where the printer pauses for a filament change and what colour each strand previews in.
 * one        no pause
 * face       pause before the first strand of layer 2 (today's colorChange)
 * per-layer  pause before the first strand of every layer whose colour differs from the previous layer's
 * halftone2  the second path family (the complement) in the second colour: pause before its first strand
 * @returns {Strand[]} copies with pauseBefore and previewColour set; never reorders strands
 */
export function applyColourPlan(strands, { mode, layerColours }) {}
```

### C8. Carrier (Support)

```js
// settings key, present on cards whose support is 'auto' or 'built-in'
support: {
  style: 'wave' | 'gyroid' | 'straight' | 'zigzag',  // BACKING_STYLES + 'zigzag'
  openness: number,   // mm between carrier lines (today's backing spacing)
  depth: number,      // wave depth, mm (wave and zigzag only)
  wavelength: number, // mm
  layers: 1 | 2,      // second layer turned 90° to the first
  angle: number,      // degrees
  order: 'motif-first' | 'carrier-first'   // default: each card's current order (Meander/Turing: motif-first)
}

// site/src/engine/backing.js
export function carrierLayers(boundary, support) { /* → Polyline[][] tagged role 'carrier' */ }
```

- **One carrier per piece.**
- The global "Backing mesh" switch (`BackingCard`, and `addBackingMesh` in `backing.js`) disappears from `'self'` cards. On `'auto'` cards it is replaced by this section.
- Saved `backing` settings migrate to `support` (C12).
- No export may contain two carriers (C4 counts carrier passes).

### C9. Raised capabilities

Every module is pure, takes and returns `Strand[]` (C3), and must keep the deposition Z envelope it declares. Signatures:

```js
// site/src/engine/order.js: print order from nozzle clearance (Wu 2020, ch. 3)
export function clearanceOrder(strands, { tipRadius, coneHalfAngle, layerHeight }) {}
//   → { strands (re-ordered), split: number, conflicts: [] }; splits a strand when the constraints form a cycle

// site/src/engine/layers.js hatch(): bond control for parallel strands
//   new options: neighbours: 'touch' | 'gap', gap: mm, mask?: (x, y) => boolean  // true = touch (bond)

// site/src/engine/lift.js: unbonded crossings by cooling (Pattinson 2019)
export function liftCrossings(strands, { lift, length, mask, layerHeight }) {}
//   at each crossing over an earlier strand (where mask(x, y) is true): rise to z + lift over `length` before,
//   hold over the crossing, descend after; lifted points get cls 'rising' / 'falling' so fan_nonplanar applies

// site/src/engine/crossings.js: filleted bridges (Kim & Lee 2025)
export function bridgeCrossings(strands, { height, filletRadius }) {}

// site/src/engine/channels.js: sliding channels (Li et al. 2022)
export function slidingChannels(lower, upper, { spanLift, channelLift, legBefore, legAfterFactor, channelFlow, anchor, ramp, mask }) {}
//   → Strand[]: lower family flat; upper family as raised spans with bed anchors; one channel (role 'channel')
//     per crossing whose mask says 'x' or 'y' (the direction that may slide); 'fused' crossings get no channel

// site/src/engine/climb.js: climbing overlaps (rings that build up)
export function climbOverlaps(paths, { bead, levelHeight, maxLevels, rampLength, layerHeight }) {}
//   → Strand[] where each path rises one level where it overlaps material printed before it
```

Defaults and test values are in the Phase 4 tickets.

### C10. Line alignment

```js
// settings (on the imported drawing, per colour from Phase 7): lineAlign, passSpacing
lineAlign: 'centre' | 'inside' | 'outside' | 'left' | 'right'
passSpacing: number   // fraction of bead width, default 0.8

// site/src/engine/drawing.js
export function linePasses(line, bead = 0.45, { align = 'centre', spacing = 0.8 } = {}) {}
```

The formulas are in T7.1.

### C11. Colour regions

```js
// svg-parse keeps each path's colour: styles[i] = { color: 'red' | … | 'other', hex: '#rrggbb', width }
/**
 * @typedef {object} Region
 * @property {string} hex          '#rrggbb', the region's key
 * @property {boolean} enabled
 * @property {'pattern' | 'hole' | 'solid' | 'line'} role
 * @property {string} [card]       card id when role is 'pattern'
 * @property {object} [settings]   that card's settings
 * @property {'centre' | 'inside' | 'outside'} [lineAlign]   for role 'line'
 */
// site/src/engine/regions.js
export function regionsFromDrawing(vector, { currentCard, currentSettings }) {}   // default roles = today's meaning
export function buildRegions(machine, material, vector, regions, { seam, generate }) {}   // one result, seams included
```

### C12. State schema v4 and migration

```js
{
  v: 4,
  design: '<card id>',
  machine, material, advanced,
  designs: { [settingsKey]: settings },   // squiggle and loop-pile move in here; state.squiggle and state.primary go
  outline, vector, print,
  regions: Region[] | null                 // Phase 7
}
```

- `migrateState(raw)` in `site/src/ui/library.js` turns v3 (and older) into v4 **before** `sanitizeState` runs.
- Old design IDs map through the `legacy` field of C1, for example `squiggle` + `{ shape: 'ring' }` → `rings-layered`.
- `colorChange` → `colourMode`; `backing` → `support`.
- Swatch codes and file names (`site/src/ui/file-name.js`) keep encoding the card ID plus a short settings hash. Old codes still parse.

### C13. Output snapshots

`dev/tools/update-design-snapshots.mjs` writes `dev/tests/snapshots/designs/<card>.json` for every ready card, at default settings and every preset, on a 40 × 30 mm swatch with the default profiles (`dev/tests/helpers.js`):

```json
{ "card": "wave-net", "preset": "default", "settingsHash": "…",
  "gcodeSha256": "…", "strands": 12, "moves": 3456, "extrudeMm": 1234.5,
  "zMin": 0.2, "zMax": 0.6, "families": ["L1", "L2"], "ties": 3 }
```

`families` is `[]` when T0.0 first records the snapshots (strands carry no `family` yet). T0.2 adds the tags and may change **only** the `families` field of every snapshot; every other field, including `gcodeSha256`, must stay identical.

`dev/tests/design-snapshots.test.js` regenerates them and compares. Run `npm run snapshots` to update after an intended change, and explain every changed snapshot in the PR.

---

## 4. Pipelines after the library

### 4.1 One card

```
settings (state.designs[settingsKey]) ──▶ card.build(settings, boundary, ctx)
   ├─ pattern: patternField(source) ─▶ effect (C6)
   ├─ geometry: engine generator ─▶ { layers, families }
   └─ support: carrierLayers(boundary, support) (C8), placed by support.order
         ▼
layersToStrands (provenance C3) ─▶ raised capability if the card is raised (C9) ─▶ clearanceOrder (C9)
         ▼
applyColourPlan (C7) ─▶ emitStrands ─▶ writeGcode
         ▼
buildConstructionReport (C4) ─▶ verdict, side view (C5), preview, export
```

### 4.2 Variants

```
"Also on: Layered" clicked ─▶ state.design = 'rings-layered'; state.designs.rings unchanged
   ─▶ panel for rings-layered reads the same settings object ─▶ regenerate
"Print all variants" ─▶ for each variantsOf(id): generate with the same settings ─▶ place side by side (T5.7)
```

### 4.3 Colour regions (Phase 7)

```
SVG ─▶ parseSvg (keeps hex, C11) ─▶ regionsFromDrawing ─▶ colour bar (tick boxes)
Apply ─▶ for each enabled pattern region: card.generate(… outline = region polygon minus holes …)
      ─▶ seams along shared borders (role 'seam') ─▶ merge strands; order by layer across regions; clearanceOrder
      ─▶ one result ─▶ construction report per region ─▶ Export (next to Share)
```
