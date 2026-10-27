# Phase 2: New Flat and Layered cards from the papers

**Goal:** fourteen new cards, each a new generator with its own picture, panel and tests. Read the shared scaffolding first; each ticket then gives the card's algorithm, parameters and checks.

**Depends on:** Phase 0 and T1.1, T1.6 and T1.7 (the panel template, Pattern and Colour). The cards in this phase are independent of each other and can be built in parallel by different people, except where a ticket says otherwise.

| Ticket | Card | ID | Shelf | Size |
|---|---|---|---|---|
| T2.1 | L-09 Rotated stack | `rotated-stack` | layered | M |
| T2.2 | L-10 Moiré net | `moire-net` | layered | S |
| T2.3 | F-01 Rings · flat | `rings-flat` | flat | M |
| T2.4 | F-06 Rotating squares | `rotating-squares` | flat | M |
| T2.5 | F-07 Rotating triangles | `rotating-triangles` | flat | M |
| T2.6 | F-08 Arrowhead band | `arrowhead-band` | flat | M |
| T2.7 | F-09 Spiral cells | `spiral-cells` | flat | M |
| T2.8 | F-10 Stochastic net | `stochastic-net` | flat | L |
| T2.9 | F-15 Voronoi cells | `voronoi-cells` | flat | S |
| T2.10 | F-11 Star-metric cells | `star-metric` | flat | L |
| T2.11 | F-12 Isohedral tiles | `isohedral-tiles` | flat | L |
| T2.12 | F-13 Connected lace | `connected-lace` | flat | L |
| T2.13 | F-14 Meander with ties | `meander-ties` | flat | M |
| T2.14 | F-19 Kirigami sheet | `kirigami` | flat | M |

---

## Shared scaffolding for every new card

**1. Engine module.** `site/src/engine/<name>.js`, pure:

```js
// site/src/engine/rings.js (example)
// <header: what the structure is, why it holds together, and the paper it comes from>
import { clipPolyline, densify } from './layers.js';
import { createRng } from './rng.js';

export const RING_LATTICES = Object.freeze({ square: { label: 'Square', hint: '…' }, hex: { label: 'Staggered', hint: '…' } });
export const RING_LATTICE_IDS = Object.freeze(Object.keys(RING_LATTICES));

/** @returns {{ layers: {x:number,y:number}[][][], families: string[] }} */
export function ringsLayers(boundary, { /* the ticket's parameters with defaults */ } = {}) { … }
```

- Use `boundary.bbox()` and `boundary.contains(x, y)`; clip with `clipPolyline(pts, boundary, minLength)`.
- Densify curves with `densify(pts, step)` (default step 0.5 mm).
- Randomness only from `createRng(seed)`.
- Throw `ConfigError` (from `site/src/engine/params.js`) with a plain message when the settings would exceed `MAX_MOVES` or produce nothing.

**2. Registry entry.** New cards go in a new file `site/src/ui/research-designs.js`, exporting `RESEARCH_DESIGNS`, which `site/src/ui/designs.js` adds to `DESIGNS` in the same way it adds `MORE_DESIGNS`. Use `layered({ … })` from `site/src/ui/more-designs.js`, and `defineControls` with `withColour()` (T1.7):

```js
const RINGS = withColour(defineControls({
  ranges: { ...SIZE, ringSize: { min: 3, max: 20, step: 0.5 }, overlap: { min: 0.3, max: 3, step: 0.1 } },
  defaults: { width: 100, height: 100, ringSize: 8, overlap: 0.9, lattice: 'hex', pattern: 'even', patternScale: 1, patternEffect: 'size' },
  enums: { lattice: RING_LATTICE_IDS },
  presets: [ … ],
  describe: (s) => ({ ringSize: `${r1(s.ringSize)} mm`, overlap: `${r1(s.overlap)} mm` }),
}));

RESEARCH_DESIGNS.push(layered({
  id: 'rings-flat', name: 'Rings · flat', blurb: '…', about: '…', file: 'rings-flat', c: RINGS,
  shelf: 'flat', family: 'rings', support: 'self', state: 'untested', settingsKey: 'rings',
  joins: 'Rings overlap and fuse in one pass.',
  sources: { catalogue: ['M4'], papers: [53, 66] },
  patternEffects: ['size'],
  controls: [ /* size, structure choices, sliders, pattern, colour (in that order, Contract C2) */ ],
  build: (s, boundary, ctx) => ringsLayers(boundary, { … }),
  summary: (result) => `rings in ${result.layerCount} pass, ${result.report.crossings} joins`,
}));
```

**3. Copy.**
- `about`: two or three plain sentences: what it is, what it feels like, where it comes from.
- `blurb`: under 60 characters.
- Slider labels follow the plan's §4.4.

**4. Tests** (`dev/tests/<name>.test.js`). Every card needs at least:
- a. All output inside the boundary (with the boundary's own tolerance).
- b. Every family listed in `families` has at least one polyline after clipping, on a 40 × 30 mm swatch and on a 100 × 100 mm swatch.
- c. The construction report (T0.3) through `layeredResult`: no lost family; `componentsWithoutTies === 1` on 100 × 100 mm at defaults; `danglingEnds === 0`; `maxValence ≤ 3`, unless the ticket says otherwise.
- d. Determinism: the same settings give deep-equal layers.
- e. Every slider at its minimum and maximum (others at defaults) gives a valid result or a clear `ConfigError`.
- f. Every Structure option changes the geometry.
- g. `shelfFromConstruction` agrees with the card's shelf (T0.3).
- h. The snapshot is added (`npm run snapshots`).

**5. Definition of Done extras for cards:**
- a screenshot of the card face, the open panel, the side view and the 3D preview;
- export runs;
- the card's row in the plan's §5 is still accurate (if the ticket changed something, update the row in the same PR);
- `state: 'untested'` until Luis prints it (Phase 8).

---

## T2.1 L-09 Rotated stack (`rotated-stack`)

**Source:** Lu et al. 2022, [Paper 69](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-69-lu-2022--modeling-and-characterization-of-3d-printed-flexible-mesh-structure-for-wearable-interface). A NinjaFlex mesh made of stacked layers of parallel strands, each layer turned θ from the one below. Lu measured how strand thickness T, gap D, rotation θ and layer height H change strength, stretch and stiffness.

**What it is:** each layer is a set of parallel straight strands at width T, with gap D between strands (pitch T + D); layer *i* is at angle *i*·θ. The layers print on their own planes, so each layer bonds where it crosses the one below.

**Engine:** `site/src/engine/rotated-stack.js`
- `rotatedStackLayers(boundary, { layers = 3, turn = 90, strand = 0.45, gapFactor = 1, anchor = centre })`.
- For `k` in `0..layers-1`: `hatch(boundary, { angle: k * turn, spacing: strand * (1 + gapFactor), anchor, whole: true })`.
- `families = ['S1', 'S2', …]`.
- Lines are straight (no `shape`).

**Printing:** this card **must not** use the coherent single-height mode. In `build`, return `{ layers, families, extra: { planes: true } }`, and make `layered()`'s `generate` pass `coherent: false` to `layeredResult` when `extra.planes` is set. That needs a small change in `layeredResult`: an option `planes` that calls `layersToStrands(..., { coherent: false })`. The non-coherent branch already puts layer *k* at `z = layerHeight × (k + 1)` and lifts over its own earlier passes.

**Settings**

| key | label | default | range | unit | note |
|---|---|---|---|---|---|
| `layers` | Layers | 3 | 2–8, step 1 | — | Lu printed 6–18 at 1.8 mm thick; FilaFabric sheets are thin |
| `turn` | Turn per layer | 90 | choice: 30, 45, 60, 90 | ° | Structure choice with option pictures |
| `strand` | Strand thickness | profile bead (0.45) | 0.4–0.9, step 0.05 | mm | sets the extrusion width multiplier through `flow` = strand / bead |
| `gapFactor` | Gap between strands | 1 | 0.5–2, step 0.25 | × strand | Lu's D = 0.5–2 × T |

Presets:
- *Lu's wearable mesh*: turn 90, gapFactor 0.5, layers 3. Lu's own was T 0.4, D 0.2, H 0.3.
- *Open 60°*: turn 60, gapFactor 1.5, layers 3.
- *Fine 45°*: turn 45, gapFactor 1, layers 4.

**About text:** "Layers of straight strands, each turned from the one below. The gap between strands is the main softness control: in Lu's NinjaFlex meshes, doubling it from one to two strand widths cut stiffness by about 40%."

**Checks beyond the shared list**
- With `turn = 90` and `layers = 2`: `z.max ≈ 2 × layerHeight` (+ settle tolerance).
- With `turn = 60` and `layers = 3`: the families cross pairwise.
- The help text quotes Lu as *in Lu's 1.8 mm NinjaFlex meshes*, not as a FilaFabric property.

---

## T2.2 L-10 Moiré net (`moire-net`)

**Source:** [catalogue M7](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m7--moiré-interference-net-new-24-october-2026). Mentioned in Manaia (43), Sterman (58) and Takahashi & Kim (61); none measured it.

**What it is:** two families of straight or wavy lines with a slightly different pitch or angle. Their overlap makes large interference bands; modulating one family's phase from a picture draws an image.

**Engine:** `site/src/engine/moire.js`
- `moireLayers(boundary, { pitchA = 2.0, pitchB = 2.1, angleA = 0, angleB = 3, shape = null, size = 0, wavelength = 6, phaseField = null })`.
- Family A: `hatch(boundary, { angle: angleA, spacing: pitchA, shape, size, pitch: wavelength })`.
- Family B: the same with `angleB`, `pitchB`, plus a per-line phase offset taken from `phaseField(x, y)` (0–1, multiplied by `pitchB`) when a pattern is set.
- `families = ['A', 'B']`.

**Settings**

| key | label | default | range | unit |
|---|---|---|---|---|
| `pitchA` | Gap between strands | 2.0 | 1.2–6, step 0.1 | mm |
| `pitchDiff` | Pitch difference | 0.1 | 0–1, step 0.02 | mm (pitchB = pitchA + pitchDiff) |
| `angleDiff` | Angle difference | 3 | 0–15, step 0.5 | ° |
| `size` | Wave depth | 0 | 0–2, step 0.1 | mm (0 = straight) |

The Pattern effect is `phase`. Add `phase: { label: 'Moiré image', hint: 'Shifts the second family to draw the picture in the bands' }` to `PATTERN_EFFECTS`.

**Checks**
- With `pitchDiff = 0` and `angleDiff = 0`, the two families coincide. Forbid this: the sanitiser forces `angleDiff ≥ 0.5` when `pitchDiff` is 0, and the help text explains why.
- The sparsest band still connects: compute crossings per cm² in 10 × 10 mm tiles over the swatch; **every tile has at least one crossing**, otherwise a warning in the construction report ("*The bands are too sparse to hold together; reduce the difference*").

---

## T2.3 F-01 Rings · flat (`rings-flat`)

**Sources:**
- [catalogue M4](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#m4--paired-loops-and-staggered-lace);
- no point-only contacts, from Schumacher 2015, [Paper 53](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-53-schumacher-2015--microstructures-to-control-elasticity-in-3d-printing);
- contact makes it stiffer, from Pattinson, [Paper 66](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-66-pattinson-2019--biomechanically-tailored-meshes-for-compliant-wearable-and-implantable-devices).

**What it is:** rings on a lattice, all printed in **one pass**. Each ring overlaps its neighbours by a set contact width, and where two rings cross, the second settles over the first locally. This is the Flat member of the Rings group (settingsKey `rings`, shared with `chainmail` and `rings-raised`).

**Engine:** `site/src/engine/rings.js`
- `ringsLayers(boundary, { lattice = 'hex', ringSize = 8, overlap = 0.9, segments = 48, order = 'rows' })`.
- Ring centres:
  - `hex`: rows `ringSize − overlap` apart in x, rows `(ringSize − overlap) × √3/2` apart in y, every other row shifted half a pitch;
  - `square`: a square grid at pitch `ringSize − overlap`.
- Each ring is a circle of radius `ringSize / 2` with `segments` points, closed.
- Rings wholly outside the boundary are dropped; rings cut by the boundary are clipped to arcs only if the arc is longer than one ring radius, otherwise dropped.
- **One family** (`families = ['rings']`), ordered row by row (`rowOrder`), so the print goes row after row.
- Must share defaults with `chainmail`'s controls (T0.7): add `ringSize`, `overlap` and `lattice` to the shared `rings` controls, and map `chainmail`'s existing keys (`spacing`, `ratio`) onto them in the shared defaults without changing `chainmail` output. Define the shared defaults as the union; `chainmail` keeps reading its own keys. Tell the reviewer in the PR how the keys line up.

**Settings**

| key | label | default | range | unit |
|---|---|---|---|---|
| `ringSize` | Ring size | 8 | 3–20, step 0.5 | mm (outer diameter) |
| `overlap` | Overlap | 0.9 | 0.45 (= one bead) – 3, step 0.05 | mm (how far each ring reaches into its neighbour) |
| `lattice` | Arrangement | `hex` | choice: `hex` (Staggered), `square` (Square) | — |

The Pattern effect is `size` (the ring size grades with the picture while centres stay on the lattice; the overlap is recomputed per ring so it never drops below one bead).

**Checks**
- **No point contacts:** the minimum overlap between neighbouring rings, measured on the geometry, is at least one bead width (0.45 mm); test at the minimum `overlap`.
- One component without ties at defaults.
- `shelfFromConstruction` gives `flat`.

---

## T2.4 F-06 Rotating squares (`rotating-squares`)

**Sources:**
- [catalogue S4](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#s4--auxetic-and-slit-sheet-variants);
- Shajoo et al., [Paper 55](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-55-shajoo-2021--auxetic-structures-from-3d-printed-hybrid-textiles): ABS squares on slit, pre-stretched knit gave ν ≈ −0.9 (7 × 7); the 3 × 3 version delaminated at the corners.

**What it is:** a single-material version of rotating squares. Square outlines in a checkerboard of alternating rotations (+α and −α), joined only at their corners by short, narrow necks. Pulled, the squares counter-rotate and the sheet widens: an auxetic mechanism.

**Engine:** `site/src/engine/rotating-units.js`, shared with T2.5:
- `rotatingSquaresLayers(boundary, { cell = 10, angle = 15, neck = 0.9, neckLength = 1.2, fillet = 0.8, outline = true })`.
- **Lattice:** squares of side `s` centred on a square grid of pitch `cell`, square (i, j) rotated by `(−1)^(i+j) × angle`. Choose `s` so that neighbouring corners are `neckLength` apart: solve numerically for the side at which the gap between facing corners equals `neckLength`, and test it.
- **Each square:** a closed outline with corners rounded by `fillet` (arcs of 6 segments).
- **Necks:** a short straight segment joining facing corners, `neckLength` long, drawn as two parallel passes `neck` apart when `neck > bead`, otherwise one pass.
- **Border band:** a perimeter strand around the swatch connecting the outer squares' free corners, as recommended for free edges ([catalogue edge details](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#edge-joining-and-handling-details): border band at floppy edges).
- `families = ['squares', 'necks', 'border']`. They touch but do not cross, so the shelf is flat (T0.3's rule allows several families that do not cross).

**Settings**

| key | label | default | range | unit |
|---|---|---|---|---|
| `cell` | Cell size | 10 | 5–25, step 0.5 | mm |
| `angle` | Opening angle | 15 | 0–35, step 1 | ° |
| `neck` | Neck width | 0.9 | 0.45–2, step 0.05 | mm |
| `neckLength` | Neck length | 1.2 | 0.6–4, step 0.1 | mm |
| `fillet` | Corner rounding | 0.8 | 0–2, step 0.1 | mm |

**Checks**
- Every square connects to at least two others through necks (except at the border, where the border band connects it).
- The neck length measured on the geometry equals `neckLength` ± 0.05 mm.
- No neck is shorter than its width (no point contacts).

---

## T2.5 F-07 Rotating triangles (`rotating-triangles`)

**Sources:**
- Chen et al. 2021, [Paper 6](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-6-chen-2021--bistable-auxetic-surface-structures): rotating-triangle hexagons with inclination θ within ±π/6, and a thickness ratio t/l;
- Konaković 2016, [Paper 34](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-34-konakovic-2016--beyond-developable-auxetic-materials): the fully open linkage *is* the kagome lattice; edge vertices add freedom, so close them with a border band.

**What it is:** triangles on a triangular lattice, each rotated by θ with alternating sign, joined at corners by necks. It is the same construction as T2.4 on a triangular lattice.

**Engine:** in `site/src/engine/rotating-units.js`: `rotatingTrianglesLayers(boundary, { cell = 10, angle = 15, neck = 0.9, neckLength = 1.2, fillet = 0.6 })`. It reuses the neck, fillet and border helpers from T2.4, so implement T2.4 first, or agree on the helpers' API with whoever does T2.4.

**Settings:** as T2.4, but `angle` is limited to −30…30° (±π/6, Chen) and labelled *Inclination*.

**Checks:** as T2.4. In addition, at `angle = 0` the outlines form a kagome-like net. Assert that every interior node has exactly 4 connections.

---

## T2.6 F-08 Arrowhead band (`arrowhead-band`)

**Sources:**
- Ariel & Sterman 2026, [Paper 1](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-1-ariel-sterman-2026--compostable-garments-via-digital-fabrication-a-nursing-bra-case-study): re-entrant band, about 15 mm cells, four 0.2 mm layers, 5 mm side outlines; the controls that mattered most were internal hinge angle, cell scale and layer count;
- Spahiu et al. 2020, [Paper 68](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-68-spahiu-2020--3d-printing-for-clothing-production): 130 × 130 mm FilaFlex panels of 4 × 8 hollow arrowheads; joining was hard because edge contact areas were small.

**What it is:** rows of hollow arrowheads (chevron outlines with a re-entrant notch), each nested into the one below, anchored to **two continuous side rails** so that every cell end is held and the edges don't fray.

**Engine:** `site/src/engine/arrowhead.js`
- `arrowheadLayers(boundary, { columns = 4, cellHeight = 15, hingeAngle = 60, depth = 0.45, rail = 5, strand = 0.45 })`.
- **One arrowhead:** an outer chevron (two arms meeting at the apex at `hingeAngle`) and an inner chevron offset inward, so the outline is a hollow arrow with wall `strand`. The notch depth is `depth × cellHeight`.
- **Tiling:** `columns` across the band width, rows every `cellHeight × (1 − depth)`, so each arrowhead nests into the one below.
- **Rails:** solid strips `rail` wide down each side (zigzag fill as in `solid-fill.js`), overlapping the outer arrowheads by one bead.
- `families = ['arrows', 'rails']`.

**Settings**

| key | label | default | range | unit |
|---|---|---|---|---|
| `columns` | Arrowheads across | 4 | 1–12 | — |
| `cellHeight` | Cell size | 15 | 6–30, step 0.5 | mm |
| `hingeAngle` | Hinge angle | 60 | 30–110, step 1 | ° |
| `depth` | Notch depth | 0.45 | 0.2–0.7, step 0.05 | × cell |
| `rail` | Rail width | 5 | 0–10, step 0.5 | mm (0 = no rails; then a warning: edges will fray) |

Presets:
- *Ariel band*: 15 mm cells, rail 5;
- *Spahiu panel*: columns 4, cellHeight about 16, rail 0, with the warning.

**Checks**
- Every arrowhead touches its row neighbours and the one below.
- With rails on, every outer arrowhead overlaps its rail by at least one bead.

---

## T2.7 F-09 Spiral cells (`spiral-cells`)

**Sources:**
- FlexMaps, Malomo et al. 2018, [Paper 42](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-42-malomo-2018--flexmaps-flat-flexible-shells);
- [catalogue S5](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#s5--four-arm-spiral-cells), with the exact formula.

**What it is:** each cell holds four Archimedean spiral arms rotated 90° apart; neighbouring cells join at the midpoints of their shared edges. The material stays within about ±0.5% strain while the sheet deforms by arm bending; 99% of an average spiral stays inside that, per the 26 October attribution check.

**Engine:** `site/src/engine/spiral-cells.js`
- `spiralCellsLayers(boundary, { cell = 12, twist = 2.2, armWidth = 0.45, handedness = 1 })`.
- One arm, for t ∈ [0, 1] sampled every 0.5 mm: `x(t) = r(t)·cos(t·φ)`, `y(t) = r(t)·sin(t·φ)`, with `r(t) = 0.5·s·(1 − t)`, `s = cell` and `φ = twist` (radians, multiplied by `handedness`).
- Rotate copies by 90°, 180° and 270° around the cell centre.
- Each arm's outer end is extended straight to the midpoint of its cell edge; this is where neighbouring cells join.
- Arms are drawn from the centre outward and joined at the centre by a small closed ring of radius `armWidth`.
- `families = ['arms']`: one family whose arms meet at shared midpoints.

**Settings**

| key | label | default | range | unit |
|---|---|---|---|---|
| `cell` | Cell size | 12 | 10–30, step 0.5 | mm (keep ≥ 10 at first: FlexMaps' robustness floor) |
| `twist` | Twist | 2.2 | 0.5–4, step 0.1 | radians |
| `armWidth` | Arm width | 0.45 | 0.45–1.2, step 0.05 | mm |
| `handedness` | Turning | 1 | choice: 1 (clockwise), −1 (anticlockwise) | — |

The Pattern effect is `twist`. Add `twist: { label: 'Twist', hint: 'Tighter spirals where dark: softer there' }` to `PATTERN_EFFECTS`; grading is per cell, continuous, with neighbouring edges still meeting at midpoints.

**Checks**
- **The gap between windings never falls below one bead plus 0.2 mm:** compute the minimum distance between non-adjacent sections of the same arm and between arms.
- **The sanitiser refuses twist values that break this** at the current cell size: clamp the twist and show a note.

---

## T2.8 F-10 Stochastic net (`stochastic-net`)

**Sources:**
- Martínez et al. 2016, [Paper 44](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-44-martinez-2016--procedural-voronoi-foams-for-additive-manufacturing): deterministic seeding per grid cell; convex cells stay connected except at the boundary;
- Martínez et al. 2017, [Paper 45](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-45-martinez-2017--orthotropic-k-nearest-foams-for-additive-manufacturing): k nearest neighbours under a stretched metric; the stretch ratio sets the stiffness ratio and node density sets its size;
- [catalogue S6](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#s6--directional-stochastic-net-new-24-october-2026).

**What it is:** a random-looking net whose links are longer along one direction, so the sheet is stiffer that way. It regenerates identically when resized.

**Engine:** `site/src/engine/stochastic-net.js`
- `stochasticNetLayers(boundary, { density = 0.04, k = 5, stretch = 1.5, direction = 0, seed = 1, border = true })`.
1. **Nodes:** cover the bounding box with a virtual grid of cell size `1 / √density` mm. For each grid cell (i, j), seed `createRng(hash(seed, i, j))` and place **one** node at a jittered position inside the cell. Because each cell's node depends only on (seed, i, j), resizing keeps existing nodes in place.
2. **Metric:** `M = Eᵀ·diag(H⁻²)·E`, with E the rotation by `direction` and `H = [stretch, 1]`. Distance `d(p, q) = √((q−p)ᵀ M (q−p))`.
3. **Edges:** for each node, link it to its `k` nearest neighbours under d, using a grid lookup for speed. Make the graph undirected, then remove duplicates.
4. **Clean-up:**
   - drop nodes outside the boundary and edges crossing it;
   - drop components that clipping isolated;
   - remove crossing edges by keeping the shorter (under d) of any two that cross, so the net is planar;
   - with `border`, add a strand along the boundary inset by one bead, and link the boundary-nearest nodes to it.
5. **Strands:** walk the planar graph into trails (`trailsFromEdges` in `layers.js`) to minimise starts and stops.
- `families = ['net', 'border']`.

**Settings**

| key | label | default | range | unit |
|---|---|---|---|---|
| `density` | Node density | 0.04 | 0.01–0.2, step 0.005 | nodes per mm² |
| `k` | Links per node | 5 | 3–8 | — |
| `stretch` | Stretch | 1.5 | 1–3, step 0.1 | — (1 = the same in every direction) |
| `direction` | Direction | 0 | 0–180, step 5 | ° (the stiff direction) |
| `seed` | Variation | 1 | 1–9999 | — |

The Pattern effect is `size`: density follows the picture through the subdivision rule of Martínez 2016 (cells subdivide where it is darker).

**Checks**
- **Resize stability:** nodes inside a 40 × 30 mm swatch are identical to the same region of a 100 × 100 mm swatch with the same seed and origin.
- Planar: no crossings except at shared nodes.
- One component with the border.
- With `stretch > 1`, the mean edge direction is aligned with `direction` within ±10°.

---

## T2.9 F-15 Voronoi cells (`voronoi-cells`)

**Source:** Martínez et al. 2016, [Paper 44](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-44-martinez-2016--procedural-voronoi-foams-for-additive-manufacturing).

**What it is:** the Voronoi cell walls of `voronoi` without the Delaunay family, closed by a border strand: a one-family cellular net (Flat), next to the existing two-family Voronoi lace (Layered).

**Engine:** add `voronoiCellsLayers(boundary, { spacing, relax, seed, tone, border = true })` to `site/src/engine/voronoi.js`. It reuses the existing site placement (`sites()`) and keeps only the Voronoi edges, clipped, plus the border strand; walk them into trails.
- `families = ['cells', 'border']`.
- It shares site placement with `voronoi`, so the same seed gives the same cells as Voronoi lace's second family. Assert this.

**Settings:** reuse `voronoi`'s `spacing`, `relax` and `seed` (the same keys and ranges), plus `border` (switch, default on).

**Checks:** one component; there is no Delaunay family; the cells equal Voronoi lace's dual for the same seed.

---

## T2.10 F-11 Star-metric cells (`star-metric`)

**Sources:**
- Martínez et al. 2019, [Paper 46](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-46-martinez-2019--star-shaped-metrics-for-mechanical-metamaterial-design): Voronoi cells on a lattice grown under a star-shaped distance; triangular lattices with 3-fold metrics gave isotropic sheets with Poisson's ratio from −0.47 to 0.99;
- [catalogue S7](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#s7--star-metric-curved-cell-lattice-and-isohedral-tilings-new-24-october-2026).

**What it is:** cells whose shape is set by a small "petal" of 3–7 radial spans; changing the petal moves the sheet from auxetic to ordinary while keeping the same symmetry.

**Engine:** `site/src/engine/star-metric.js`
- `starMetricLayers(boundary, { lattice = 'triangular', spans = [1, 0.6, 1], symmetry = 3, cell = 10, wall = 0.45, smooth = true })`.
1. **Sites** on the chosen lattice (`triangular`, `honeycomb`, `square`, `diagonal-square`) at pitch `cell`.
2. **Star distance:** `d_S(p, q) = ‖q − p‖ / f(angle(q − p))`, where `f` interpolates the control spans around the circle, repeated by `symmetry` (the spans give one sector, mirrored when `symmetry` is even). Linear interpolation when `smooth` is false; periodic cubic otherwise.
3. **Cells:** rasterise the swatch at 0.1 mm. Each pixel takes the site with the smallest `d_S`; extract the boundaries between labels (marching squares), simplify to 0.05 mm and smooth lightly. Walls are the shared boundaries.
4. **Per-site assignment** (not blending) when the pattern grades the spans across zones; this is the paper's advice, because linear blending between two metrics can change the mechanics abruptly.
5. Border strand, and walking into trails as T2.8.
- `families = ['walls', 'border']`.

**Settings**

| key | label | default | range |
|---|---|---|---|
| `lattice` | Lattice | `triangular` | choice: triangular, honeycomb, square, diagonal square |
| `symmetry` | Symmetry | 3 | choice: 3, 4, 6 |
| `spans` | Petal shape | `[1, 0.6, 1]` | a petal editor with 3–7 handles, each 0.3–1.5 |
| `cell` | Cell size | 10 | 5–25 mm |

- The petal editor is a small custom section kind `petal`. Implement it in `panels.js` as a `Control` subclass: an SVG with draggable handles, plus keyboard steps of 0.05 per handle.
- **This adds a section kind.** Add it to Contract C2 under Structure, and tell the reviewer before starting.

**Checks**
- Cells connected after clipping. The growth model only guarantees connectivity inside the domain, so the border strand is required.
- **Symmetry check:** with symmetry 3 on the triangular lattice, the stiffness proxy (total wall length projected onto 0°, 60° and 120°) varies by under 5%.
- Performance: a 100 × 100 mm swatch at 10 mm cells in under 2 s. If raster labelling is too slow, use a 0.2 mm raster with sub-pixel boundary refinement.

---

## T2.11 F-12 Isohedral tiles (`isohedral-tiles`)

**Sources:**
- Schumacher et al. 2018, [Paper 54](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-54-schumacher-2018--mechanical-characterization-of-structured-sheet-materials): 93 isohedral families; tiling symmetry sets the material class;
- FlexScale, [Paper 47](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-47-montes-maestre-2024--flexscale-flexible-scaled-sheets), which used the *Tactile* JavaScript library (isohedral.ca).

**Gate before code (resolved 27 October 2026):** TactileJS is BSD 3-Clause; Luis approved vendoring the pinned library under `site/vendor/tactile/`. See [local review](../04_Review/T2_11_Local_Review.md). Keep its upstream licence and provenance with the source.

**What it is:** the outlines of an isohedral tiling, printed as a connected net. Choosing a family and its shape parameters changes the cell outline continuously.

**Engine:** `site/src/engine/isohedral.js`
- `isohedralLayers(boundary, { family = 'IH28', params = [], scale = 10, line = 0.45 })`.
- Generate the tiling's edges over the bounding box, deduplicate shared edges (each shared edge printed once), clip, and walk into trails.
- `families = ['edges', 'border']`.
- Each preset shows its **material class** from the plan's symmetry table (Paper 54): anisotropic, orthotropic, tetragonal or isotropic. Add it to the card's option hints.

**Settings:** family (a choice with pictures for a curated set of 12, the rest under "More"), up to 6 shape-parameter sliders (`params[i]`, −1…2, labelled *Shape 1…n*), `scale` (5–30 mm).

**Checks:** shared edges printed once; one component with the border; each curated family produces a non-empty, connected net at defaults.

---

## T2.12 F-13 Connected lace (`connected-lace`)

**Sources:**
- [catalogue S1](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#s1--connected-planar-lace);
- Sun 2017 and 2018, [Paper 59](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-59-sun-2017--daring-to-sprint-3d-printing-textiles) and [Paper 60](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-60-sun-2018--instilled-3d-printing-elastic-lace);
- Sterman 2026, [Paper 58](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-58-sterman-2026--opportunities-and-challenges-of-toolpath-based-3d-printed-textiles-insights-from-digital-design-and-craft-course).

**What it is:** decorative lace motifs (rings, petals, scallops) on a lattice, joined into **one sheet** by necks of a minimum width, with no backing. It releases from the bed as one piece.

**Engine:** `site/src/engine/lace.js`
- `laceLayers(boundary, { motif = 'petal', scale = 12, neck = 0.9, openness = 0.5, lattice = 'hex' })`.
- **Motifs** are closed outlines in a unit cell:
  - `ring`: a circle;
  - `petal`: a 6-petal rosette from a polar curve `r(θ) = a(1 + b·cos(6θ))`;
  - `scallop`: a circle with an 8-lobe edge.
- Place them on the lattice at pitch `scale`, sizing each motif so that neighbours' outlines come within `neck` of each other. Add a straight neck (one or two passes, as T2.4) between nearest points of neighbouring motifs.
- `openness` scales the motif inside its cell (0.3–0.8 of the pitch); the neck length follows.
- `families = ['motifs', 'necks', 'border']`.
- **Also export the motif geometry on its own** (`laceMotifs(boundary, opts)`), because T3.1 reuses it.

**Settings:** `motif` (choice with pictures), `scale` (6–30 mm), `neck` (0.45–2 mm), `openness` (0.3–0.8), `lattice` (hex, square).

**Checks:** one component at defaults with no ties (`componentsWithoutTies === 1`); no motif island without at least two necks (except at the border); every neck at least one bead wide.

---

## T2.13 F-14 Meander with ties (`meander-ties`)

**Source:** [catalogue S3](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#s3--meanders-and-loops-with-sparse-ties).

**What it is:** the Meander curves (Hilbert, Peano, Moore and the others in `CURVES`), held together by **short in-plane ties** across neighbouring runs, instead of a backing.

**Engine:** add `meanderTiesLayers(boundary, { curve, cell, angle, tieInterval = 6, tieLength = null, seed })` to `site/src/engine/meander.js`.
- Build the curve exactly as `meanderLayers` does, **without** the backing.
- Then find pairs of parallel runs closer than `cell × 1.2`, and every `tieInterval` mm **of curve length** (stations along each run, not at every point of its rounded corners) add a straight tie perpendicular to both. A tie is one bead wide.
- A tie runs from the centreline of one fold to the centreline of the other and **declares a joint at each end** (`joints`, as the other designed-joint cards do). Without the joints the engine reads each end as a tie laid over the curve and lifts it a layer, so the card stops being flat.
- A tie is dropped if it would cross the curve or another tie, or lie closer than half the interval to another tie.
- Ties are a **designed family** (`role: 'native'`, family `ties-designed`), not the engine's automatic ties.
- `families = ['curve', 'ties-designed']`.

**Settings:** `curve` (as in Meander), `cell` (as in Meander), `tieInterval` (2–20 mm), `seed`.

**Checks:**
- One component **without** automatic ties: `report.ties.count === 0` and `componentsWithoutTies === 1`.
- Every run longer than `2 × tieInterval` has at least one tie.
- The default measures as declared: no crossings, Z 0.2 mm everywhere, and `shelfFromConstruction` returns `flat`. The tie count stays near curve length ÷ `tieInterval`.

---

## T2.14 F-19 Kirigami sheet (`kirigami`)

**Sources:**
- Nakajima et al. 2020, [Paper 48](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-48-nakajima-2020--tensile-properties-of-3d-printed-flexible-kirigami-specimens): slit width W 15 mm, slit height h 1 mm, interval i 5 mm, slit-end spacing d 10 mm, thickness 2 mm; best h/i about 0.2–0.32 depending on layup; alternating 90/0 passes most robust; minimum printable slit about 1 mm at a 0.4 mm nozzle;
- [catalogue S4](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#s4--auxetic-and-slit-sheet-variants).

**What it is:** a thin **solid** sheet with staggered straight slits. Pulled, the slits open into diamonds and the sheet stretches far more than solid material would.

**Engine:** `site/src/engine/kirigami.js`
- `kirigamiLayers(boundary, { slitLength = 15, slitGap = 1, interval = 5, endSpacing = 10, passes = 2 })`.
1. **Slits:** rows `interval + slitGap` apart; each row holds slits of length `slitLength` separated by `endSpacing`, and every other row is offset by `(slitLength + endSpacing) / 2`.
2. **Region:** the boundary minus the slit rectangles (`slitLength × slitGap`, with ends rounded by `slitGap / 2`), using `polygon-region.js`.
3. **Fill:** fill the region solid with the existing solid fill (`site/src/engine/solid-fill.js`). Pass 1 at 0° and pass 2 at 90° when `passes = 2` (Nakajima: alternating 90/0 was most robust).
- `families = ['fill-0', 'fill-90']`.
- **The shelf is flat with two passes.** Add a `SHELF_EXCEPTIONS` entry ("*a filled sheet; its two passes are solid fill, not crossing strands*").

**Settings**

| key | label | default | range | unit |
|---|---|---|---|---|
| `slitLength` | Slit length | 15 | 4–30, step 0.5 | mm |
| `slitGap` | Slit width | 1 | 1 (minimum printable) – 3, step 0.1 | mm |
| `interval` | Row spacing | 5 | 2–15, step 0.5 | mm |
| `endSpacing` | Gap between slit ends | 10 | 2–20, step 0.5 | mm |
| `passes` | Passes | 2 | choice: 1, 2 | — |

Show the ratio *h/i* (`slitGap / interval`) in the describe line, with a hint that 0.2–0.32 worked best in Nakajima's TPU specimens.

**Checks**
- **No slit narrower than 1 mm:** the sanitiser clamps.
- **No fill line crosses a slit:** sample points inside each slit rectangle and assert no strand passes through.
- The sheet is one component.
