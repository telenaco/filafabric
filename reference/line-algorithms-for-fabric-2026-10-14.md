# Plotter line algorithms as two-layer printed fabric

Recorded 2026-10-14. A deep-research run (5 search angles, 22 sources read, 85 claims extracted, 25 claims checked
by three independent verifiers: 16 confirmed, 9 rejected) asked which pen-plotter line styles (drawingbots.com's
algorithm catalogue and tools list, Plotcaster's styles, and others like them) can become Filafabric patterns: two or
three thin layers where layer 2 is designed against layer 1 so strands cross and fuse into a garment-like mesh.

**Read the caveats first.** drawingbots.com and plotcaster.com could not be fetched from the research environment.
How the algorithms work comes from DrawingBotV3's repository (documentation and Java source; it is the program behind
the drawingbots.com catalogue), SquiggleCam's code, vpype's source and FullControl's notebooks. Plotcaster's styles
(Sketch, Flow, Scribble, Words, Hatch, Squiggle) are mapped by name to their DrawingBotV3 equivalents. Every
mechanical prediction below is engineering inference: no source tested two-layer, 0.2 mm layers of a foaming TPU.

## The short answer

Most plotter styles draw many short strokes that never meet, so few carry over unchanged. Two kinds do:

- **Continuous by construction:** serpentine hatch and squiggle, spiral sawtooth, TSP art, space-filling and
  differential-growth meanders, Lissajous curves, trochoid loop rows.
- **A connected graph that can be routed into a few long paths:** Voronoi and Delaunay, ring packings, honeycomb rows.

In each case layer 2 must cross or overlap layer 1 **by construction**. That means a rotated or perpendicular
field, a mirrored row shifted half a pitch whose flats stack on layer 1, or a geometric dual (Delaunay over Voronoi).
It must never be the dual tree of a non-crossing meander (a maze or a Hilbert curve): the two interlock like a
puzzle and never cross, the same failure as two layers of parallel lines.

The evidence that does exist agrees with the project's lesson: in printed TPU line meshes the geometry of the
crossings, not just the amount of material, sets drape, stretch and directional stiffness (Kalman, Fayazbakhsh and
Martin 2021; Schumacher et al. 2018; Martinez et al. 2019). The pattern is the main design lever.

## Rules for deriving layer 2

1. **Crossing density.** Two straight families at spacings s1 and s2 crossing at angle θ give one crossing per
   s1·s2/sin θ of area. Two random families cross at about 64 % of an orthogonal grid's rate, with unbounded local
   gaps, so random pairings need a validator.
2. **Crossing angle.** The overlap at a crossing is about w/sin θ. With w = 0.45 mm: 0.45 mm at 90°, 0.52 at 60°,
   0.9 at 30°, 1.7 at 15°. Keep θ at or above about 30–45° to avoid long double-height ridges.
3. **Open area.** A 0/90 grid is (1 − w/s)² open: about 49 % at s = 1.5 mm, 67 % at s = 2.5 mm.
4. **The duality trap.** A non-crossing meander (maze, spanning tree, Hilbert or TSP tour) and its planar dual never
   cross. Never use the "dual maze" as layer 2.
5. **Same-layer crossings.** A self-crossing curve puts the nozzle across its own fresh strand at the same height, a
   double-height node. Slicer grid infill does this every layer, but it is untested in foaming TPU. Crossings
   between layers are the safe default.
6. **Sag.** Layer-2 spans over open cells print 0.2 mm above the bed and drop onto it. Keep the longest free span
   between crossings to about 2–3 spacings, and keep high-degree nodes in layer 1, on the bed.
7. **One validator for every family.** Report crossings per cm², the longest uncrossed strand, the smallest
   crossing angle, and the stroke and lift count.

Filafabric's current parallel mode already follows the two rules the SquiggleCam source makes necessary:
SquiggleCam gives every row its own accumulated phase (so neighbouring rows drift apart in tone-varying areas, which
would break the crossings), and its rows are separate strokes. Filafabric's parallel mode uses one phase for every row
(layer 2 is exactly opposite), a minimum depth of spacing/4 + half a strand, and serpentine joins.

## Ranked shortlist

| # | Family (plotter style) | Layer 1 | Layer 2 | Why they cross | Fabric character (predicted) | Main risk |
|---|---|---|---|---|---|---|
| 1 | Row lattice: honeycomb, re-entrant (auxetic), sine (Squiggle) | Odd rows, one serpentine | Layer 1 mirrored and shifted one row pitch | Its flats stack on both neighbouring rows | Honeycomb near-isotropic; re-entrant should spread under tension and hug curves | Sharp corners in TPU; flats ≥ 1 mm, cells ≥ 3 mm |
| 2 | Trochoid loop rows ("scribble-knit", DrawingBotV3 Circular Scribbles) | Prolate trochoid rows, serpentine | Same rows offset s/2 in opposite phase, or rotated 90° | Same rule as parallel mode: loop half-height ≥ s/4 + w/2 | Knit-like; very easy stretch until loops straighten, then stiff | Every loop crosses itself in-layer; loops ≥ 2 mm |
| 3 | Multi-angle crosshatch / isogrid (Hatch with Crosshatch) | Serpentine hatch or squiggle at α | Same at α + 90° (or 0/60/120° over three layers) | Any non-parallel pair crosses | 0/90 drapes like woven cloth on the bias; three directions more isotropic (Kalman et al.) | Straight strands barely stretch along their axis; three-way nodes are tall |
| 4 | Orthogonal field pair (Flow / Streamlines) | Streamlines of a direction field, or contour offsets of the outline | Streamlines of the perpendicular field, or the outline's normals | Orthogonal everywhere except singularities | Stiffness axes follow the garment piece; contours form a hem | Many strokes of uneven length; pile-ups at singularities |
| 5 | CVT Voronoi with Delaunay (Voronoi Diagram / Triangulation) | Delaunay triangulation (on the bed) | Voronoi diagram | Each Voronoi edge crosses its Delaunay edge at about 90° when triangles are not obtuse | Lace- or foam-like, near-isotropic, gradable by a tone map | Voronoi needs about V/2 strokes unless routed |
| 6 | Spiral sawtooth (Spiral) | One continuous Archimedean spiral with a sawtooth | Radial zigzag: out one spoke, back the next | Each spoke crosses each turn at about 90° | Spiderweb: soft radially, firm around | Spokes crowd at the centre; leave a hub hole |
| 7 | Ring packing (chainmail look, fused) | Hex-packed overlapping rings as one non-crossing Euler circuit | Same lattice shifted to the triangular gaps | Each layer-2 ring crosses three layer-1 rings twice | Near-isotropic, good drape, moderate stretch | Many tight arcs; rings ≥ 3 mm |
| 8 | Single-path meanders: TSP art, Hilbert / Peano / Gosper, maze walls, differential growth | One continuous non-crossing meander | An independent hatch or squiggle at about 45° | No layer-1 stretch longer than s2/sin θ goes uncrossed | Hidden slack: stretches far by unfolding, lace-like | Sharp turns; never use the dual maze or a rotated copy on the same grid |
| 9 | Lissajous, harmonograph, spirograph | One closed self-crossing curve: a diamond lattice in one layer | Optional: phase-shifted or rotated copy | Crosses itself | Bias-lattice drape with a dense edge band (a natural hem) | All crossings in-layer; cannot fill arbitrary outlines |
| 10 | Truchet tiles | One random diagonal per cell | The opposite diagonal (for arc tiles, a grid offset by half a tile) | An X in every cell (arcs in the same cell only touch) | Decorative, pseudo-woven | Many strokes; tiles ≥ 3 mm |
| 11 | Non-planar crimped weft ("dip weave"), experimental | Warp rows on the bed | Weft riding over each warp at 0.4 mm and dipping to 0.2 mm between | Wraps every warp; nothing printed in mid-air | Woven-like crimp and give | Nozzle tip collides unless the warp gap is ≥ 2.5–3 mm |
| 12 | Reaction-diffusion stripes | Iso-lines of a Turing / Gray-Scott field | Gradient lines of the same field | Orthogonal by construction | Organic, near-isotropic | Many closed loops: one lift each |

Ranked last: styles made of many short independent strokes (Sketch, Words, dot stippling, Mosaic shapes), with no
crossing guarantee and many lifts. Stippling is usable only through a TSP tour (rank 8).

## Recipes in more detail

**1. Row lattice.** Row k is centred at y = k·h with waveform (−1)^k·f(x). For a regular honeycomb, f is a trapezoid
wave: flat a, slants at 60°, period 3a, amplitude h/2, row pitch h = a·√3/2. Layer 1 prints rows 0, 2, 4… as one
serpentine; layer 2 prints rows 1, 3, 5…. Each layer-2 flat lands on the layer-1 row below or above, so rows are
joined along segments of length a, not just at points. Lean the slants backwards for re-entrant (bow-tie) cells.
FullControl's star-polygon lattice (sub-family M1) prints rows the same way, out and back with mirrored geometry and no
extrusion stops, for flexible filament. A 0.45 mm strand stacked on another still overlaps under about 0.2 mm of
misalignment.

**2. Trochoid loop rows.** point = c(u) + d·(sin(u/r), −cos(u/r)), with the centre c moving along the row. When
d/r < 1 it is a squiggle; when d/r > 1 each period forms a loop. A loop-ratio slider turns the current squiggle into
loops. Tone can modulate loop size.

**3. Crosshatch / isogrid.** This needs only an angle parameter on the current crossed mode. Use 0/90 for two
layers, or 0/60/120 over three layers. For three layers, offset the third family so nodes stack two strands, not three.

**4. Orthogonal field pair.** The field can come from guide curves, the image's edge directions (Plotcaster's "Flow"
and DrawingBotV3's Streamlines), or the distance to the SVG outline (contours plus normals). Join stroke ends with
connectors along the edge, printed as a band. Contour offsets split into islands at narrow necks.

**5. CVT Voronoi + Delaunay.** Place tone-weighted points in the outline and relax them with Lloyd iterations. Print
the Delaunay triangulation first (it is nearly Eulerian), then the Voronoi diagram. Almost every dual pair crosses
once the triangles are near-equilateral; validate the rest. Route the Voronoi layer with Euler circuits plus doubled
edges (Chinese postman, about a third more length, giving double-height strands), or retrace printed struts with
extrusion off and no Z-lift, as FullControl does.

**6. Spiral + spokes.** Do not pair two opposite spirals: they cross at 2·atan(p / 2πr), under 1° at r = 50 mm with
p = 2 mm, so they overlap rather than cross. Add half-spokes at set radii to keep the rim spacing near s.

**7. Ring packing.** Ring radius about 0.55 × pitch on a hex lattice. Every ring–ring meeting is a degree-4 vertex,
so the drawing is Eulerian. Choose "touch, don't cross" at each vertex and merge loops until one non-crossing loop
remains. Layer-2 centres sit at the gaps, P/√3 from the nearest centres. The same router serves Truchet arcs and
knot patterns.

**8. Meanders.** Smooth sharp TSP corners (TSP-Bot needed curvature smoothing even for a robot pen). Keep at least one
strand width between neighbouring folds. Tours of about 10⁴ points are feasible in a browser with greedy construction
plus 2-opt.

## Recommended next three builds

1. **Row-lattice waveform library** in the existing modes: honeycomb, re-entrant auxetic and trochoid loops. It
   reuses the row generator, serpentine joins and two-layer offset in `src/engine/squiggle.js`. Paths are continuous
   by construction. Stacked flats should bond more strongly than point crossings. It adds two fabric characters the
   current modes lack: auxetic conformity to the body, and knit-like stretch.
2. **Orthogonal field pairs fitted to the SVG outline**: contour spiral plus normals, or a guided flow field plus its
   perpendicular. Garments are shaped panels; this extends the crossed mode to curves with 90° crossings everywhere,
   and steers stiffness across a piece.
3. **CVT Voronoi with a Delaunay second layer**, built together with a reusable **graph-to-path router**
   (Euler circuits, Chinese-postman doubling, retracing with extrusion off instead of lifting). The router then
   unlocks ring packing, Truchet, mazes and knot patterns.

Ship a **crossing validator** first (crossings per cm², longest uncrossed strand, smallest crossing angle, strokes and
lifts), so every new family is checked against the "parallel lines never cross" failure. A 60/120° angle option for
the crossed mode is a near-free extra.

Related, for the existing squiggle: layer 2 currently prints at 0.4 mm everywhere, so between crossings it is laid in
mid-air and drops 0.2 mm to the bed. The "dip weave" idea (rank 11) and rule 6 both point at fixing that: let layer 2
come down to bed height between crossings, or keep its free spans short.

## How this maps onto the studio's cards (as of 2026-10-14)

The structure library in `docs/fabric-structures.md` landed while this research ran, so some of the shortlist
already exists in part:

| Research item | In the studio | What is still missing |
|---|---|---|
| 1. Row lattice | **Zigzag mesh** (parallel mode with a zigzag strand) and the **square** strand shape | Honeycomb (trapezoid wave whose flats stack on the neighbouring rows) and re-entrant (auxetic) shapes: two more entries in the strand-shape library |
| 2. Trochoid loop rows | The **looped** strand shape in Squiggle & Gyroid, and the **Coil** card (one layer, lift at crossings) | Nothing structural; the loop ratio and the in-layer crossing questions are for test prints |
| 3. Crosshatch / isogrid | Crossed mode at 0/90 only | An angle option (for example 60/120), and three-layer isogrids |
| 4. Orthogonal field pair | **Spiral panel** is planned as one contour strand | A second layer along the outline's normals (or a perpendicular field), so the panel has crossings |
| 5. CVT Voronoi + Delaunay | Not started | A new card and the graph-to-path router |
| 11. Dip weave | **Weave** is planned (warp arches where the weft passes beneath) | Same idea; the research adds the nozzle-clearance limit (warp gap at least 2.5–3 mm) |
| Crossing validator | `src/engine/crossings.js` resolves crossings (later strands lift over earlier ones) | A report of crossings per cm², the longest uncrossed strand, the smallest crossing angle and the lift count |

### Built since (later on 2026-10-14)

Every card below states the rule that makes its second layer cross the first, and `tests/` checks it with the crossing
report (crossings between layers, the usual crossing angle, the longest uncrossed stretch).

| Card | From the shortlist | The layer-2 rule |
|---|---|---|
| **Voronoi lace**, **Turing stripes**, **Meander**, **Truchet tiles**, **Ring mail**, **Spiderweb**, **Harmonograph**, **Auxetic mesh** | 5, 12, 8, 10, 7, 6, 9, 1 | As in the recipes above |
| **Crosshatch: isogrid and kagome** | 3 | The three families lie on one lattice: n(0°)·p − n(60°)·p + n(120°)·p = 0, so three lines meet only where their offsets add up to a whole number of spacings. Offsets (0, ½, 0) give the kagome, where no node stacks three strands |
| **Flow lines** | 4 | Jobard–Lefer evenly spaced streamlines of a field and of the field turned 90°. Points with no direction (a whirl's eye, a saddle) are found by their index (the doubled angle's turn round each grid cell) and left open. A pattern turns the lines by an angle that is a smooth function, so it can have no such points at all |
| **Conformal mesh** | 4 | The real and imaginary level lines of an analytic function cross at exactly 90° (Cauchy–Riemann). z + k²/z bends a grid round a hole, log((z − k)/(z + k)) gives a magnet's field, (a + ib)·log z two families of spirals that close after one turn. Lines are cut where they would crowd closer than 1.2 mm, and each hole gets a hem |
| **Sunflower** | (new) | Vogel's phyllotaxis: a seed's nearest neighbours lie n ± F apart for consecutive Fibonacci numbers F, which turn opposite ways; the parity of F's index picks the layer |
| **Rosette** | 1, in polar form | The parallel squiggle's rule wrapped round a centre: a whole number of lobes per turn keeps every turn in phase, and a swing of at least spacing/4 + half a strand guarantees the crossings |
| **Spirograph** | 2 and 9 | Trochoid rings p(t) = ρe^{it} + Ae^{−i(n−1)t}: one layer's rings never touch (A < s/2 − w), the other's lie s/2 further out and reach both neighbours (A ≥ s/4 + w/2) |
| **Bubbles** | 7 | A saturated packing of mixed circles; the circle orthogonal to three bubbles is centred on their radical centre with radius √power, so a ring in every gap meets each of its three bubbles. The tour of a tree of nearly touching circles is one closed strand |
| **Parquet** | 3, in blocks | In every block one layer runs along and the other across; neighbouring blocks are turned 90°. The herringbone is the staircase H_k = [k, k+n] × [k, k+1], V_k = [k+n, k+n+1] × [k+1−n, k+1], repeated every (−n, n) |
| **Star lattice** | (new) | Hankin's polygons-in-contact: straps run straight through edge midpoints and turn where rays from neighbouring edges meet. The strap crossing graph is coloured greedily; squares need two layers, hexagons three, octagons and squares four, and no strap crosses one of its own layer |

## Other routes noted

- **DefeXtiles** (Forman et al., UIST 2020): controlled under-extrusion turns ordinary paths into tulle-like "glob and
  strand" fabric. It could be added on top of any recipe (for example a sheer under-extruded layer 2), but it is not
  a substitute for designed crossings, and it seems to rely on many stacked layers.
- A preliminary Loughborough result reports over twofold strength from half-layer Z offsets at lattice crossings. How
  the offset was applied could not be confirmed, so read the paper before copying it.

## Caveats

- The named starting sites (drawingbots.com, plotcaster.com and its app) were not fetched.
- Most DrawingBotV3 modules discussed (Hatch, Streamlines, Voronoi, TSP, Circular Scribbles) are paid and closed
  source; only their documentation was examined. Only Sketch Lines, Sketch Squares and Spiral are open. The docs are
  wrong in two places: spiral stroke length grows with darkness, not brightness, and "Parabolic" is two separate paths.
- Several academic sources were read only through abstracts or search snippets. Two claims passed on 2–1 votes.
- All mechanical evidence is for standard TPU, single-layer rod networks or thicker isogrids, at other scales. The
  recipes, crossing guarantees, size limits and fabric predictions are engineering synthesis and need test prints.
- Prior art named in the brief (Nervous System's Kinematics, printed chainmail, FullControl's non-planar demos,
  kirigami and auxetic lattices, gyroid lattices, printing onto stretched fabric) was not verified in this run.

### Claims rejected by the verifiers (not relied on)

- DrawingBotV3 streamlines never overlap (1–2).
- vpype `splitall` before `linemerge` fully optimises dense meshes (0–3).
- The TSP-Bot paper defines TSP art as crossing-free (1–2); the non-crossing property here rests on 2-opt maths instead.
- Kalman et al.'s isogrid drape coefficients spanned 21.9–91.5 % (0–3).
- The Disney structured-sheet study covers Truchet-like tilings (0–3).
- The mechanism of the Loughborough half-layer offset (0–3).
- FullControl's layer 2 is an identical copy of layer 1 (1–2).
- PunchPrint's crossing-reinforced grid toolpath, and its "twice the load" result (both 0–3).

## Open questions (test prints to run)

1. What crossing angle and overlap give a reliable fused joint in Foamy 95A at 0.2 mm layers and 0.45 mm strands?
   Would printing layer 2 less than a full layer above layer 1 strengthen the joints?
2. Are crossings within one layer acceptable in foaming TPU, or do double-height nodes and nozzle drag cause blobs and
   tearing? This decides whether trochoid loops, Lissajous curves and ring contacts need flow reduction or a split
   across layers.
3. Do re-entrant two-layer row lattices joined by stacked flats actually behave auxetically at this scale? Which
   standard test should Filafabric adopt to compare recipes (for example a drape coefficient plus stretch at 0, 45 and
   90°)?
4. Can DefeXtiles-style under-extrusion combine with designed crossings in only two or three layers of a foaming
   filament? How much doubled strand from Euler routing can a graph pattern take before it stiffens the fabric?

## Sources

Primary, used for claims:

- DrawingBotV3 path-finding modules documentation: https://drawingbotv3.readthedocs.io/en/latest/pfms.html
- DrawingBotV3 source: https://github.com/SonarSonic/DrawingBotV3
- SquiggleCam source: https://github.com/msurguy/SquiggleCam
- vpype cookbook (1.2.0 and 1.5.1): https://vpype.readthedocs.io/en/1.5.1/cookbook.html
- vpype-flow-imager: https://github.com/serycjon/vpype-flow-imager
- TSP-Bot (Song et al.): https://arxiv.org/pdf/2210.07592v4
- FullControl models: https://github.com/FullControlXYZ/fullcontrol/tree/master/models
- Loughborough lattice microgeometry: https://repository.lboro.ac.uk/articles/journal_contribution/Effect_of_printing_parameters_on_microscale_geometry_for_3D_printed_lattice_structures/21353997
- DefeXtiles (Forman et al.): https://www.media.mit.edu/publications/defextiles-publication/
- Kalman, Fayazbakhsh and Martin 2021, TPU isogrids: https://www.torontomu.ca/content/dam/frames/publications/Kalman_Fayazbakhsh_Martin_2021.pdf
- Schumacher et al. 2018, structured sheet materials: https://studios.disneyresearch.com/wp-content/uploads/2019/03/Mechanical-Characterization-of-Structured-Sheet-Materials-Paper.pdf
- Martinez et al. 2019, star-shaped metric Voronoi: https://hal-ecp.archives-ouvertes.fr/LJK_GI_IMAGINE/hal-02118846
- GNU study of TPU textile mimics: https://scholarworks.gnu.ac.kr/item/81f7b20e-f03e-4c15-8a13-b71937e22867
- PunchPrint: https://par.nsf.gov/biblio/10483025
- Also read: https://www.preprints.org/manuscript/202606.1947, https://cdatp.journals.qucosa.de/cdatp/article/view/110,
  https://www.cs.purdue.edu/homes/bbenes/papers/Zhao16ToG.pdf
