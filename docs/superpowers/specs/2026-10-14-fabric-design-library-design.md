# Fabric structure library: coils, weaves, meshes and the Blender patterns

Status: **approved direction** (2026-10-14, revision 2). Supersedes revision 1 (pattern preset cards).
Companion: [`docs/blender-ceramics-review-2026-10-14.md`](../../blender-ceramics-review-2026-10-14.md).

## 1. Intent

Luis wants **as many ways of making a garment fabric as possible**, each as a card, so every physically different
structure can be printed, photographed and draped into a library. Flat swatches and outline panels only for now.

Agreed with Luis:

1. A **card is a structure** (a fabric that drapes differently). Patterns, strand shapes, sliders and named presets are
   variations *inside* a card, not cards of their own.
2. Loops can be **flat and non-parametric**: one strand that makes overlapping loops. How they overlap is a control, so
   one layer is enough and no second row is needed.
3. Build order: registry first, then Coil, the Strand shape and Pattern pickers on Squiggle & Gyroid, then Weave. Cards
   that are not built yet appear as **placeholders** (visible, disabled, "coming soon").
4. Every export carries a **swatch code** (file name and G-code header) and Share reopens the exact settings, so a photo
   of a swatch maps back to its settings.

## 2. Path

Architectural: it changes how designs register and adds a shared engine layer. Delivered in phases, each shipped on
`main` when its tests pass and its UI is checked in a browser (repo rule).

## 3. Card catalogue

| Card | Structure | Layers | Phase |
|---|---|---|---|
| Loop pile (exists) | Raised arches anchored on an open base; loops arch over the lines beneath (threaded) | base + arches | 0, 3 |
| Squiggle & Gyroid (exists) | Two fused layers of lines; gains **Strand shape** and **Pattern** | 2 | 0, 2 |
| **Coil** | One flat looped strand per row; **Row overlap** from open chain to overlapping rows lying on each other | 1 (+ lift at crossings) | 2 |
| **Weave** | Warp then weft; binding plain, twill 2/1, 2/2, basket, satin; warp arches over where the weft passes beneath | 1 (+ arches) | 4 |
| Zigzag mesh | Two anti-phase layers that open into diamonds (auxetic); a Strand shape of the two-layer card, shown as its own tile | 2 | 2 |
| Spiral panel | One contour-parallel strand, no hops, follows an outline | 1 | 5 |
| Bouclé & picots | Flat rings along base lines and edges | 1 | 5 |
| Relief | Pattern-driven Z bobbles, seersucker and pleats | 1 + Z | 5 |
| Fringe | Hanging free-end loops | 1 + Z | 5 |

Presets (named variants of one structure) live in the card, for example Coil: Open chain, Overlapping, Dense.
Placeholder tiles: Weave, Spiral panel, Bouclé & picots, Relief, Fringe until their phase lands.

## 4. Engine design

New modules have one job each and are tested without the UI.

### 4.1 `emit.js` (extracted, no behaviour change)

`emitStrands(cfg, strands) → moves`: today's loop at the end of `generateSquiggle` (travel at `safeZ`, M600 pause,
`base` / `supported` classes). `generateSquiggle` calls it; its output stays byte-identical.

### 4.2 `fields.js`: the pattern library

A field is `(x, y, w, h) → 0..1`, the same signature as today's `SAMPLERS`, which join it along with the image sampler.

The ten patterns are an exact port of `ceramic_generator/modifiers/patterns.py` with the vase unrolled:
`angle = 2π·x/w`, `zNorm = y/h`, `freqX` and `freqY` default 6 (Blender's `pattern_frequency`, `pattern_z_frequency`).
Each formula's mm displacement is divided by its analytic range to give 0..1. Thresholded patterns (Brick, Circuit
Board, Lightning Bolts) use a smoothstep ramp sized so `amplitude × slope` stays under the limit (§6). Also: seeded
coherent noise, bell bumps, gradients, uniform. Interface: `FIELDS[id] = { id, label, hint, make({freqX, freqY, seed, smooth}) → sampler }`.

### 4.3 `shapes.js`: strand shapes

| Shape | Path | Notes |
|---|---|---|
| wave | `v = A sin(ks)` | today |
| **looped** | prolate trochoid `u = (P/2π)θ − R sinθ`, `v = −R cosθ` | loops exist when `R > P/2π`; overlap read-out `1 − P/(2R)` |
| zigzag | triangle wave with rounded apex | auxetic when layers are anti-phase |
| figure-8 | `u = R sin 2θ`, `v = R sinθ` | amplitude below lane spacing |
| rounded square | superellipse wave | corner radius ≥ 1 strand |

There is no separate helix: a helix seen from above is a looped line, and the loop spacing and size give the tight
version. A two-strand braid (Blender's DOUBLE_HELIX) is a later card.

A field modulates the loop radius (40 to 100 % of its maximum) while the spacing `P` stays fixed, so loops stay in step.

### 4.4 `crossings.js`: over and under

Input: strands in print order, each a polyline at its base Z. Output: the same strands with Z raised at crossings.

1. Index segments in a uniform grid (cell ≈ 2 strand widths).
2. For each intersection of two different passes (or two parts of one strand), a `decide(a, b, point)` rule returns
   which is on top. Default `later-over`: the later pass lifts by `lift` (default 0.25 mm).
3. A `earlier-over` result (weave) makes the **earlier** pass arch up by `arch` (default 1.0 mm) over a span of
   `archSpan` (default 3 mm) so the later pass runs beneath it at bed level.
4. Bumps are raised cosines of half-width `ramp` (default 1.6 mm, which keeps a 0.25 mm lift under 17°; an arch uses
   `archRamp`, default 3 mm); overlapping bumps take the maximum.
5. Reports `crossings`, `maxLift`, `maxSlope` for the verdict and flags any slope above the limit.

Lifted samples are class `supported` (legend role "Crossing over"). Strand order is unchanged: no extra hops.

### 4.5 Coil

- One continuous serpentine of looped rows, joined by rounded turns (as `buildSerpentine`).
- Row pitch `L = 2R·(1 − rowOverlap)`. At `rowOverlap = 0` the rows only touch; above 0 each row crosses the
  previous one and `crossings.js` lifts the later strand.
- Outlines use `serpentineChains`, one coil row per chain, so the SVG fill works.
- Presets: Open chain (spacing wide, no overlap), Overlapping (30 %), Dense (50 %).

### 4.6 Weave (phase 4)

- Warp: a serpentine of columns along Y. Weft: a serpentine of rows along X, printed second.
- `binding(i, j) → 'weft-over' | 'weft-under'`: plain `(i+j)%2`, twill 2/1 `(i+j)%3<2`, twill 2/2, basket 2×2, satin 5.
- `weft-under` makes the warp arch (§4.4 step 3); the clearance model checks the nozzle can pass beneath
  (`arch ≥ tip radius + strand height + margin`). Marked **experimental** until a swatch prints.

## 5. Registry and UI

```js
{
  id, name, blurb, file, thumb,        // file: G-code name prefix
  status: 'ready' | 'planned',         // planned = placeholder tile
  roles: [{ id, label, cls }],
  defaults, sanitize(raw), describe(state),
  presets: [{ id, name, state }],
  controls: [ {kind:'size'}, {kind:'choice',key,options}, {kind:'pattern',key,drives},
              {kind:'slider',key,min,max,step,format}, {kind:'switch',key,label,help} ],
  generate(machine, material, state, ctx) → { cfg, strands, moves, stats, warnings, gcode, outline },
  verdict(result, state) → { level, title, body, action? },
  figures(result)
}
```

- Loop pile and Squiggle are wrapped as modules **with their hand-written panels kept**; new designs use a generic
  panel builder from `controls`.
- `main.js` asks the registry instead of branching on `state.design === 'squiggle'`.
- Share **v3**: `{ v: 3, design, machine, material, primary, advanced, designs: { [id]: state }, outline, name }`.
  v1 and v2 links open as before; unknown ids fall back to Loop pile. `sanitizeState` delegates to each module.
- Left column: structure tiles; `planned` tiles are visible and not selectable, with a "Coming soon" note.
- Swatch code: `<design>-<preset or custom>-<WxH>-<short hash of state>`, in the G-code file name and a header comment.

## 6. Rules every field and shape must meet

- Z moves 12 mm/s with jerk 0.4: slope under about 17°, tested on a grid at default amplitude.
- Neighbouring non-crossing strands stay at least one strand width apart (≈ 0.49 mm foamed).
- Fields modulate a path, they never cut it. Deterministic for a seed and parameter set.
- Stay inside `MAX_MOVES` (250 000) with a plain-language error.

## 7. Phases and acceptance

| Phase | Delivers | Done when |
|---|---|---|
| 0 Registry | Module interface, `emit.js`, planned tiles, swatch code | All existing tests pass; goldens unchanged; v1/v2 links open identically; squiggle G-code byte-identical |
| 1 Libraries | `fields.js`, `shapes.js`, `crossings.js` | Field range and slope tests; shape crossing counts; bump height, ramp, no-bump and arch cases |
| 2 Coil + pickers | Coil card; Strand shape and Pattern pickers; Zigzag mesh tile | Browser check per card; zero preflight errors; verdict names crossings; share round trip |
| 3 Pile pattern | Pattern → pile height on Loop pile | Heights follow the field within the lift limit; default output unchanged |
| 4 Weave | Weave card, bindings, arch clearance check | Bindings produce the expected over/under grid; clearance verdict; experimental banner |
| 5 Further | Spiral panel, Bouclé & picots, Relief, Fringe | Per card: tests, verdict, thumbnail, browser check |

## 8. Risks

- Crossing lift and arch height on foamed TPU are estimates; both are adjustable in Advanced and need a first print.
- Tight coil rows can leave under one strand width between non-crossing neighbours; the verdict counts "too close"
  separately from "crossing".
- Smoothed thresholded patterns look softer than the clay originals; ramp width is a control.
- Drape descriptions are hypotheses until swatches are printed.
