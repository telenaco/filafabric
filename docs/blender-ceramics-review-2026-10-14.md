# Blender ceramics tools: what transfers to fabric

Reviewed 2026-10-14 from `Obsidian Vaults/LSAD vault/Tools/blender Ceramics designs/` (read-only; no plugin was run).

## What is in the folder

| Item | What it is |
|---|---|
| `ceramic_generator` (v1) | Blender add-on that builds a **continuous vase-mode path** (a spiral, a surface of revolution, a loft between cross-sections, or a perimeter sliced from a mesh) and then applies a stack of **modifiers** to it |
| `ceramic_generator_v2` | The same plus `core/texture_engine.py`: snapshot the base shape, then apply a separate **texture stack** on top and clear it again without regenerating |
| `nozzleboss_clay` | Imports G-code as an edge mesh, lets you edit it and paint per-vertex **Flow / Speed / Tool** maps, and exports G-code for clay printers (G10/G11 retraction, no heating) |
| `bouncyPiramid`, `clothDrop`, `nozzleboss_example` `.blend` | Blender 4.0 / 4.0.1 / 3.2 scenes. Not opened: `clothDrop` (40 and 135 MB) is the one to look at for drape studies |
| `Superslicer/`, `toDelete/`, `Fixes V*.md`, `tutorial.html` | Reference notes and older write-ups |

## The idea that makes most of it transfer

Every decorative modifier is a **scalar field over the surface**: a function `d(angle, height)` that pushes each point of
the path radially outward by `amplitude × d`. Nothing about that is specific to clay. A flat textile is the same surface
unrolled: `angle → x / width`, `height → y / height`, and "radially outward" becomes whatever we choose to modulate:

- **pile height** (how far a loop lifts), 
- **squiggle amplitude** (the sideways swing of a strand), 
- **line spacing** (density), or 
- **strand flow** (thickness and softness).

The squiggle design in this repo already does exactly this with its "tone" samplers (`centerSpot`, `gradientX`, `gradientY`,
`waves`, `uniform`, and an image). The Blender patterns are more of the same kind of thing.

## Design-by-design assessment

Effort: **S** = a day or less, **M** = a few days, **L** = a sub-project.

| Blender design | What it does there | Fabric use | Fits the current engine as | Effort | Caveats for flexible filament |
|---|---|---|---|---|---|
| **Deep Spiral**, **Ocean Waves**, **Mountain Peaks**, **Lotus Petals**, **Hexagon Cells**, **Diamond Grid**, **Tribal Feathers** | Smooth multi-frequency relief fields | Relief and shading across a swatch; patterned pile height or squiggle amplitude | New tone samplers (`(x, y, w, h) → 0..1`) | **S** each | Keep slope under about 17° (Z limit 12 mm/s, jerk 0.4); scale amplitude to the strand spacing so neighbours don't touch |
| **Brick Pattern**, **Circuit Board**, **Lightning Bolts** | Thresholded 0 / amplitude fields | **Motifs and masks**: where the pile is tall, where it is flat | Tone samplers **with smoothing** (a short ramp, not a step) | **S** | A hard step is an instant Z jump; smooth it over at least 1 to 2 mm |
| **Weaving** (ZIGZAG, HELIX, FIGURE8, SQUARE, DOUBLE_HELIX) | Oscillates the path perpendicular and tangential to its direction | Different strand shapes for the squiggle layers: figure-eight and helix strands interlock and hold open an auxetic mesh | The `waveFn` of `buildSerpentine` already returns `{ coordOffset, spanOffset }`, which is this exact model | **S** | SQUARE needs rounded corners; FIGURE8 and DOUBLE_HELIX self-cross, so keep the amplitude below the lane spacing |
| **Circular Loop** | Inserts a horizontal circle tangent to the path at intervals, in bands | **Bouclé** (flat looped yarn) and **picot edging** along the boundary | A new fiber shape `ring` in `fiber.js`, placed by the tiler | **M** | The loop re-crosses its own start point; fine for TPU, but keep the radius above about 3 mm so it does not close up |
| **Bell Curve** | Gaussian bumps in bands, with amplitude growth | **Seersucker or bobble** relief; scalloped lace edges when applied sideways | The `bell` z profile already exists; add a lateral bump wave | **S to M** | Bumps in Z follow the same slope limit as loops |
| **Zigzag** with turn offset | Alternating in and out segments, phase flipped each turn | Rib and chevron structures; the parallel squiggle mode is already close to this | A wave shape plus a per-lane phase | **S** | Needs rounded turns, as for SQUARE |
| **Wave / Vertical Wave** | Sinusoidal radial or Z undulation | **Corrugated or ruffled** fabric; a Z wave along the base lanes | A Z modulation on the base layer | **M** | The base is a single thin layer; amplitude above about 1 mm needs the clearance model's care |
| **Noise** (Perlin) | Spatially coherent random displacement | **Organic variation**, much better than per-loop white jitter | A noise tone sampler (seeded) | **S** | None beyond amplitude limits |
| **Gradient modes, layer range, banding** (`loop_spacing` / `no_loop_turns`) | Where a modifier applies, and how strongly it fades | **Zones**: stripes of different structures, soft-to-stiff or low-to-tall gradients | Row ranges and a per-row multiplier in the tiler (it already accepts a `rows` list) | **S** | None |
| **Adaptive Base** (shape-conforming spiral infill) | Concentric rings clipped to a boundary polygon | A **continuous spiral fill**: one strand, no hops, for rounds and soft shapes | A new fill strategy beside `serpentineChains` in `fill.js` | **M** | Clipping a circle set to a concave polygon breaks the strand; use contour-parallel offsets for those |
| **Perimeter from mesh** | Slices a mesh and makes conforming perimeter rings | **Contour-offset fabric**: nested outlines like a topographic map | `outline.js` + offsetting rings, printed as one spiral | **M** | Same as above |
| **Entropy / "Vases Generator"** | Randomises a modifier stack for exploration | A **"Surprise me"** button for textiles | UI only, on top of the field library | **S** | None |
| **Presets** (JSON) | Named configurations | A preset gallery | Already close: shared links carry the whole state | **S** | None |
| **nozzleboss Flow / Speed maps** | Per-vertex flow and speed multipliers | **Zoned stiffness**: thicker and softer strands in painted regions, driven by a field instead of painted by hand | A per-move flow factor from a tone field (extrusion is currently one constant per class) | **M** | Stay inside the material's volumetric ceiling; flow above 1.0 has to slow the strand |

## What does not transfer

- **Spiral vase generators, Revolution, Loft, Superformula** produce *vessels*. They only matter for **tubular textiles**
  (cuffs, sleeves, bags) printed upright. That is a separate sub-project (a printer-axis and support question as much as a
  design one), not a pattern to port into the flat-swatch engine.
- **Twist, Taper, Interior Offset** reshape a vessel's silhouette; on a flat sheet they have no equivalent.
- **Weaving's original purpose** (thick clay walls needing overhang support) does not apply; its geometry does.
- **nozzleboss export** writes clay G-code (G10/G11, no temperatures). Our engine already writes MK3S G-code from profiles,
  so the useful part is only the *idea* of painted maps.
- **Print Upside Down, solid base generation, vertex-colour tool channel**: clay-specific workflow.
- **Importing our G-code into Blender** works in principle (islands, linear chains) but is not needed: the browser preview
  already shows every move class, hops and thickness.

## Suggested order

1. **A pattern library** (S, biggest return): the seven smooth fields plus noise, with the three thresholded ones smoothed.
   Offer each as a tone sampler for the squiggle design, and as a **pile-height map** for the loop pile (the tiler samples
   the field per loop to set its lift). One field library, two designs, and an obvious "Pattern" picker.
2. **Weaving strand shapes** (S): HELIX, FIGURE8, DOUBLE_HELIX and a rounded SQUARE as a "Strand shape" control on the
   squiggle design.
3. **Zones** (S): row ranges and gradient modes, so one swatch can carry two structures.
4. **Ring loops** (M): the `ring` fiber shape, then picot edging along an outline.
5. **Continuous spiral fill** (M): for the "fewer hops" goal; pairs with the planned overlapping-line path.
6. **Flow field** (M): zoned stiffness.
7. **Tubular textiles** (L): only if you want cuffs and sleeves; needs its own brainstorm.

## Rules the ported fields must respect (from the engine and the MK3S)

- Z moves are limited to 12 mm/s with 0.4 mm/s jerk, so a field has to be **smooth**: no steps, slope under about 17° as
  measured on the default loop.
- Neighbouring strands must stay at least one strand width apart (about 0.49 mm foamed), so amplitude is bounded by the
  lane spacing; the Strand layer in the preview shows when they touch.
- Prefer **continuous strands** (no retraction, few hops): fields should modulate a path, not cut it.
- Everything must remain deterministic for a given seed and parameter set.

## Questions

1. Which of the seven is first: the pattern library for the squiggle, for the pile, or both?
2. Do you want tubular textiles (sleeves, cuffs, bags), or flat swatches only for now?
3. Do you want `clothDrop.blend` looked at? Opening it needs Blender (it is a Blender 4.0 file); a screenshot or an
   export of what it shows would be enough to judge whether a cloth-sim result could feed a non-planar print.
