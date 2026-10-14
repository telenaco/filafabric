# Fabric design library: looped lines, overlapping rows and the Blender patterns

Status: **draft for approval** (2026-10-14). Nothing in this document is built yet.
Companion: [`docs/blender-ceramics-review-2026-10-14.md`](../../blender-ceramics-review-2026-10-14.md) (which Blender designs transfer, and why).

## 1. What was asked, and what is assumed

Said by Luis:

1. Build **all the Blender patterns that are applicable to fabric** as design cards in the studio.
2. Instead of wavy lines, print **loops that overlap as a single line** (one continuous strand).
3. Some designs should not be a flat 2D pattern. The loops should be **non-parametric, in a single layer, where the loop row above lies on top of the previous one**.
4. Create **cards for every design type** that can be made.

Assumed (please correct):

| # | Assumption | Why it matters |
|---|---|---|
| A1 | "Overlapping loops as a single line" is a *looped line*: one strand that makes a small circle every few millimetres and crosses itself, like cursive "eee" or a prolate trochoid seen from above. | It sets the strand geometry for the new cards. |
| A2 | "Non-parametric, single layer" means the loops are **flat in the plane** (no lifted arch like the loop pile) and the fabric stays **one layer thick**. Strands sit on the bed and a strand lifts by *one layer height only at a crossing*, then drops back. Where a row overlaps the row before it, the later row lies on top. | It means no Z arch per loop, no support problem, and a thin soft fabric. |
| A3 | The ten Blender patterns are **fields** (a value 0..1 across the swatch), not ten different structures. Each structure card gets a *Pattern* picker, and the patterns also appear as **preset cards** (structure + pattern + sensible settings). | One engine, many cards; no ten copies of the same UI. |
| A4 | Flat swatches only. Tubular textiles (cuffs, sleeves) and `clothDrop.blend` stay out of scope. | Separate sub-project. |

Sketch of A1 and A2 (shown in chat): wavy line | looped line | two overlapping rows, with a side view of one crossing.

## 2. Path

**Architectural**: it restructures how designs register (today two designs are hard-coded through `main.js`, `share.js` and `index.html`) and adds a shared engine layer. It is delivered in four phases; each phase ships and is usable on its own.

## 3. Card catalogue

Structures (cards in the left column):

| Card | Structure | Notes | Phase |
|---|---|---|---|
| **Loop pile** (exists) | Raised arches anchored on an open base | Gains a *Pattern → pile height* control | 0, 3 |
| **Squiggle & Gyroid** (exists) | Two fused layers of lines | Gains *Strand shape* (wave, looped, helix, figure-8, double helix, rounded square) and the pattern picker | 0, 2 |
| **Stitch rows** (new) | Rows of looped line, one layer thick, each row crossing over the one before | The A1 + A2 structure. Controls: loop size, loop spacing, row overlap, crossing lift | 2 |
| **Relief** (new) | One layer with a Z relief: bobbles, seersucker, ruffles | Pattern drives height; slope-limited | 4 |
| **Spiral fill** (new) | One continuous contour-parallel strand, no hops | Pairs with the outline fill | 4 |
| **Bouclé & picots** (new) | Flat ring loops along base lines and the edge | The `ring` fibre shape | 4 |

Preset cards (a design + a pattern + tuned settings, generated from the same data; they open the structure card with those values):

Deep spiral · Brick · Diamond grid · Tribal feathers · Circuit board · Ocean waves · Hexagon cells · Mountain peaks · Lotus petals · Lightning bolts.

## 4. Engine design

New code is small modules with one job each, tested without the UI.

### 4.1 `emit.js` (extracted, no behaviour change)

`emitStrands(cfg, strands) → moves`: today's loop at the end of `generateSquiggle` (travel at `safeZ`, M600 pause, `base`/`supported` classes) moved out so every strand-based design shares it. `generateSquiggle` calls it; its output must stay byte-identical.

### 4.2 `fields.js`: the pattern library

A field is `(x, y, w, h) → 0..1`, the same signature as the squiggle samplers, so the existing `SAMPLERS` and the image sampler join the same registry.

The ten patterns are an exact port of `ceramic_generator/modifiers/patterns.py`, with the vase unrolled:

```
angle = 2π · x / w          (the vase's angle becomes the width)
zNorm = y / h               (the vase's height becomes the length)
freqX, freqY                (Blender's pattern_frequency and pattern_z_frequency, default 6 and 6)
```

Each Blender formula returns a displacement in mm; the port divides by that pattern's analytic range to give 0..1. Thresholded patterns (Brick, Circuit Board, Lightning Bolts) replace the hard `if` by a smoothstep ramp whose width keeps `amplitude × slope` under the limit (§6).

Also in the library: noise (seeded, coherent), bell bumps in bands, linear and radial gradients, uniform, and a *zones* combinator (row ranges, each with its own field).

Interface: `FIELDS[id] = { id, label, hint, make({ freqX, freqY, seed, smooth }) → sampler }`.

### 4.3 `shapes.js`: strand shapes

A shape turns a lane into a polyline: `(lane, params) → offsets(s)` in the same `{coordOffset, spanOffset}` form `buildSerpentine` already uses, plus a `loop` generator that needs a parametric path:

| Shape | Path | Notes |
|---|---|---|
| wave | `v = A sin(ks)` | today |
| **looped** | prolate trochoid `u = (P/2π)θ − R sinθ`, `v = −R cosθ` | loops exist when `R > P/2π`; overlap shown as `1 − P/(2R)` |
| helix | trochoid with small `R`, tangential and perpendicular offsets | Blender HELIX |
| figure-8 | `u = R sin 2θ`, `v = R sinθ` | self-crosses; amplitude below lane spacing |
| double helix | two phase-shifted trochoids joined at the ends | Blender DOUBLE_HELIX |
| rounded square | superellipse wave, corner radius ≥ 1 strand | Blender SQUARE, rounded |

The field modulates the loop radius (`R` between 40% and 100% of its maximum) while the spacing `P` stays constant, so loops keep in step like the parallel squiggle's crossings.

### 4.4 `crossings.js`: over and under

Input: strands in print order (each a polyline with a base Z). Output: the same strands with Z raised where they cross.

1. Index every segment in a uniform grid (cell ≈ 2 strand widths).
2. For each pair of segments from different passes that intersect, the **later** one (by print order; for a self-crossing, the later part of the strand) is marked.
3. Around each mark add a smooth bump `lift · w(d)` along the later pass, where `w` is a raised cosine of half-width `ramp` (default 1.2 mm), summing where bumps meet. The bump never goes below the bed.
4. Report `crossings`, `maxLift`, `maxSlope` for the verdict; flag any slope above the limit.

Move class for lifted samples: `supported` (so the preview shows them as the crossing role). Stroke order stays the strand order, so there are still no hops inside a strand.

### 4.5 Stitch rows (the new structure)

- One continuous serpentine: rows run along X, alternating direction, joined by a rounded turn (as `buildSerpentine` does).
- Row pitch `L = 2R · (1 − rowOverlap)`; at `rowOverlap > 0` the loops of row k+1 overlap row k and `crossings.js` lifts the later strand over it.
- Outlines use `serpentineChains` and the same row generator per chain, so the SVG fill works.
- Everything is one layer thick: base Z is the first layer height; only crossings lift.
- Defaults chosen so a 30 × 30 mm swatch prints in a few minutes with no hops.

## 5. Registry and UI

### 5.1 Design module

```js
{
  id, name, blurb, file,             // file: G-code name prefix
  thumb,                             // SVG string for the card
  roles: [{ id, label, cls }],       // legend and preview colours
  defaults, sanitize(raw), describe(state),
  controls: [                        // rendered by a generic panel builder
    { kind: 'size' },
    { kind: 'choice',  key, label, options: [{ id, label, sub }] },
    { kind: 'pattern', key, drives: 'Loop size' },
    { kind: 'slider',  key, label, min, max, step, format },
    { kind: 'switch',  key, label, help }
  ],
  generate(machine, material, state, ctx) → { cfg, strands, moves, stats, warnings, gcode, outline },
  verdict(result, state) → { level, title, body, action? },
  figures(result)
}
```

- The two existing designs are wrapped as modules with **their hand-written panels left as they are** (no risk to what works); new designs use the generic builder.
- `main.js` loses every `state.design === 'squiggle'` branch: it asks the registry.
- Share format **v3**: `{ v: 3, design, machine, material, primary, advanced, designs: { [id]: state }, outline, name }`. v1 and v2 links open exactly as before (`squiggle` maps to `designs.squiggle`). `sanitizeState` delegates to each module's `sanitize`.
- `DESIGN_IDS` comes from the registry; unknown ids fall back to the loop pile.

### 5.2 Left column

Structure cards on top, a **Presets** shelf below (the ten pattern cards). Phone: the list scrolls horizontally as today.

## 6. Rules every ported field and shape must meet

From the MK3S and the engine:

- Z moves are 12 mm/s with jerk 0.4: **slope under 17°** (tested over the whole swatch on a grid at default amplitude).
- Neighbouring strands stay at least one strand width apart (≈ 0.49 mm foamed) except where they are meant to cross.
- Continuous strands: fields modulate a path, they never cut it.
- Deterministic for a given seed and parameter set.
- Every design stays inside the move budget (`MAX_MOVES`, 250 000) and gives a plain error when it would not.

## 7. Phases and acceptance

| Phase | Delivers | Done when |
|---|---|---|
| **0 Registry** | Design module interface; `main.js`, `share.js`, `index.html` driven by it; `emit.js` extracted | All 164 tests pass; goldens unchanged; v1 and v2 links open identically; squiggle G-code byte-identical |
| **1 Libraries** | `fields.js` (10 patterns, noise, bell, gradients, zones), `shapes.js`, `crossings.js` with unit tests | Field range and slope tests; shape self-crossing counts; crossing bump height, ramp and no-bump cases |
| **2 Cards** | Stitch rows card; Strand shape and Pattern pickers on Squiggle; the ten preset cards | Browser check of each card; zero preflight errors; verdict names crossings and lifts; share round trip |
| **3 Pile pattern** | Pattern → pile height on the loop pile | Heights follow the field within the lift limit; default output unchanged |
| **4 Further structures** | Relief, Spiral fill, Bouclé & picots, flow field | Per card: tests, verdict, thumbnail, browser check |

Each phase is committed separately, rebased on `filafabric/main` before any push.

## 8. Risks

- **Crossing lift on foamed TPU** is a guess (default `0.25 mm`, adjustable in Advanced). If strands squash into each other it needs a first print to tune.
- **Looped line + tight rows** can leave less than one strand width between non-crossing neighbours; the verdict will count "too close" separately from "crossing" (this is also the open clearance-model question for the loop pile).
- **Thresholded patterns** smoothed to the slope limit look softer than the clay originals; the ramp width is a control.
- **Move count** grows with loop count; the guard and plain-language error exist already for the loop pile and will be reused.

## 9. Questions for Luis

1. **A1 + A2**: is the sketch what you meant (looped line; rows lying on top of each other at the crossings; one layer thick)? If you want the fabric to **build up in height**, with each row printed on a new layer, say so and it becomes a different card.
2. **Cards**: structure cards with a Pattern picker, plus the ten patterns as preset cards, as in §3. Is that the card list you want, or should the structures be only one level (a card per pattern, no picker)?
3. **Order**: phase 0, 1 and 2 first (registry, libraries, Stitch rows and the pickers), then the rest. OK?
