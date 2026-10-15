# Fabric structures: the library

Each card in the studio is one physically different structure, so every one can be printed, photographed and draped
into a library. Patterns, strand shapes, sliders and presets are variations inside a card.

Nothing here has been printed yet: every drape or handle description below is a hypothesis until a swatch exists.

## The cards

| Card | Structure | Layers | What changes the fabric |
|---|---|---|---|
| **Loop pile** | Soft raised arches anchored on an open base; each loop arches over the lines beneath it | base + arches | pile height, loop size, spacing, base openness, strand thickness, variation, **pattern** (raises some loops, lowers others) |
| **Squiggle & Gyroid** | Two fused layers of lines (columns then rows, or two offset rows that cross) | 2 | mode, strand shape, pattern, line spacing, wave depth and length, two colours |
| **SVG design** | Bring a drawing: its lines print as drawn and its closed shapes (holes included) can be filled with any of the 17 PrusaSlicer infill patterns; then one or two backing layers go on top, each with its own infill pattern, spacing and angle, over the whole swatch, the shapes only or the drawing's box | 1 + 1 or 2 | drawing becomes (lines, fill, both), fill pattern, spacing and angle, backing layers, backing area, each backing's pattern, spacing and angle |
| **Halftone net** | Two layers of lines whose thickness (flow, with speed following) carries a pattern: the topology never changes, so the fabric holds the same everywhere; the second layer can be the complement of the first so two colours trade thickness. Straight, wave or zigzag lines | 2 | pattern, line shape, same or complement, spacing, thinnest and thickest flow, grid angle |
| **Spacer net** | A net on the bed, a pillar of stacked rings on its nodes (or every second or third), and a second net on the pillars' tops, printed layer by layer | 2 nets + pillars | net spacing, pillar height, pillar radius, pillar every |
| **Pillar weave** | Pillars on a grid and a serpentine fibre that passes each pillar on one side on one layer and the other side on the next, so the fibre layers lock round the pillars | layers + pillars | pillar spacing, layers, pillar radius |
| **Zigzag mesh** | The plain version: two layers of zigzag lines, side by side (the second half a wave along, crossing all the way) or crossed at 90°, horizontal or vertical. No shapes, no patterns | 2 | layers, direction, line spacing, wave depth, wave length |
| **Advanced zigzag mesh** | Squiggle & Gyroid, parallel mode, zigzag strand: two anti-phase layers that open into diamonds | 2 | as Squiggle & Gyroid |
| **Coil** | Flat rows of one continuous looped strand; where it crosses itself or the row before it lifts over by about a layer | 1 (+ lift at crossings) | presets (Open chain, Overlapping, Dense), strand shape, loop size and spacing, **row overlap**, crossing lift, pattern |
| **Weave** | Warp and weft lines over and under each other: plain, twill 2/1, twill 2/2, basket, satin, herringbone, diamond twill, crepe. Printed in two passes by level, a lift for every piece | 2 levels | binding, line spacing |
| **Spiral panel** | Rings that follow the edge of the panel, nested inwards and joined by short jogs: one strand, no lifts | 1 | ring spacing, any SVG outline |
| **Bouclé & picots** | Rows of line with a round ring standing on it, alternately above and below, as one strand | 1 (+ lift where rings meet a row) | presets (Picot trim, Bouclé, Curls), ring size and spacing, row spacing, pattern |
| **Relief** | Rows of one strand that rise and fall with a pattern: bobbles, puckered stripes, pleats | 1 + Z | presets (Seersucker, Bobbles, Pleats), relief height, row spacing, pattern |
| **Fringe** | A base of lines with hairs standing off them, rising then hanging free | base + free ends | presets (Fringe, Shag, Fine pile), hair length, height, spacing, row gap, variation |
| **Crosshatch & isogrid** | Layers of parallel lines, each at its own angle: 0/90, 45/135, 60/120, three ways 60° apart meeting in triangles (isogrid), or the kagome (hexagons and triangles, never more than two strands at a node); lines can be wavy | 2 or 3 | directions, line shape and wave size, spacing |
| **Auxetic mesh** | Rows of zigzag, each the mirror of the one below, with staircases of struts: honeycomb cells, or re-entrant bow-ties that widen when pulled | 2 | cell type, row spacing, cell width and depth |
| **Dip weave** | Straight warp on the bed, straight weft that rides over each warp and dips back to the bed between | 1 (+ lift at crossings) | warp and weft spacing |
| **Spiderweb** | One continuous spiral crossed by a radial zigzag out along one spoke and back along the next | 2 | turn spacing, spokes, hub hole, sawtooth |
| **Ring mail** | Overlapping rings on a hexagonal lattice, a second layer of rings shifted into the triangular gaps | 2 | ring spacing, ring overlap |
| **Meander** | One strand that never crosses itself (Hilbert, Moore, Peano, Sierpiński, Gosper, a random maze, or a stipple tour through graded dots), held by a hatch at an angle | 2 | curve, fold size, hatch angle and spacing, pattern |
| **Harmonograph** | A closed Lissajous curve that crosses itself in a diamond lattice, optionally with a phase-turned copy | 1 or 2 | lobes across and up, phase |
| **Truchet tiles** | Random tiles per cell: diagonals (an X in every cell) or arcs that flow into curves, seeded | 2 | tile, size, pattern number |
| **Voronoi lace** | Relaxed Voronoi cells with their Delaunay triangulation across; cells smaller where a pattern is bright | 2 | cell size, evenness, pattern number, pattern |
| **Turing stripes** | Reaction-diffusion stripes grown from a few specks, crossed by a hatch; the same number grows the same pattern | 2 | stripe spacing, pattern number, hatch |
| **Conformal mesh** | The level lines of the two halves of one complex function: a square grid bent round a buttonhole, two holes, two poles (a magnet's field) or into two families of spirals, at 90° everywhere; every hole gets a hem | 2 | map, cell size, hole size, spiral lines and twist |
| **Sunflower** | Seeds placed by the golden angle; each layer joins them along the spirals that turn one way (8 and 13, 13 and 21 ... by the parity of the Fibonacci number), so both layers pass through every seed | 2 | seed spacing, open centre |
| **Rosette** | Guilloché: the parallel squiggle wrapped round a centre, two continuous wavy spirals in opposite phase, half a turn spacing apart | 2 | turn spacing, lobes, swing, open centre |
| **Flow lines** | Evenly spaced streamlines of a flow (ripples, a whirlpool, eddies, or a pattern that turns the lines) and of the same flow turned 90°, so they cross square on everywhere; the eye of a whirl is left open | 2 | flow, line spacing, wave size, bend, pattern |
| **Bubbles** | Rings of mixed sizes packed until no gap is left, each cluster of nearly touching rings toured as one strand; a ring in every gap, centred on the radical centre of its three bubbles, holds them | 2 | bubble size, pattern number, clusters, pattern |
| **Parquet** | A floor of blocks (basket weave, herringbone, chevron); in every block the layers run along and across at 90°, and neighbouring blocks are turned a quarter turn, which shows in two colours | 2 | floor, block size, plank length, line spacing, turn |
| **Spirograph** | Rings of trochoid curls out to the corners; a second layer of rings half a spacing out, turned half a curl, swings into the rings on both sides | 2 | ring spacing, curl (waves to big loops), open centre |
| **Star lattice** | Islamic star patterns by Hankin's polygons-in-contact on squares, hexagons or octagons and squares; the straps fall into families that never cross each other, one layer each | 2, 3 or 4 | tiling, tile size, contact angle |

Strand shapes (Coil, Bouclé's ring, Crosshatch and Squiggle & Gyroid): looped, figure-8, zigzag, honeycomb (flat tops and
bottoms, so neighbouring layers stack), wave, square and rings.

Patterns (a brightness map that shrinks or deepens the loops, waves, lifts or relief) are ported from the Blender
ceramics add-on: deep spiral, brick, diamond grid, tribal feathers, circuit board, ocean waves, hexagon cells, mountain
peaks, lotus petals, lightning bolts, plus soft noise, bumps and stripes.

## The list

The design list opens with the **essentials** (Zigzag mesh, Squiggle & Gyroid, Coil, Star lattice, Dip weave, Halftone net,
Meander, Turing stripes): flat lines in one or two layers with only a few controls. Everything else follows,
easiest first. Where a card used to have both a "Start from" row and a choice that said the same thing (the curve of
the Meander, the tiling of the Star lattice, the map of the Conformal mesh), the choice now carries the sizes that
suit it and the row is gone. The Meander and Turing stripes are held by a wavy backing: a sine wave whose depth and
length you set (the default), the fixed lines of a gyroid slice, or straight lines. One backing makes two layers with the
curve; *Backing layers: two* adds a second backing turned across the first, a third layer. Layer thickness is the
printer's *layer height* in the advanced settings.

**Layers.** One card below every design sets the *layer thickness* (the printer's own is 0.2 mm; it reaches every design
through the material, so each design lays its first layer that thick) and the *number of layers*: how many times the whole
pattern is printed on top of itself, each copy one layer above the one before and lifting over what it crosses. Designs of
raised loops keep their own height and say so.

**Typed values.** A number typed past a slider's range, or a size past the usual range, is used as typed and the panel
warns; it never refuses. Geometry problems (lines that overlap, a pile that leaves its outline) show *Check the geometry*
with the setting to change, and the export stays available. Only what cannot be built is refused, with the setting to
change: a bed the swatch does not fit, more moves than the budget, or more than 120,000 crossings (lines laid on top of
each other that many times take minutes to lift over each other).

**Swatches** are 100 × 100 mm everywhere, and `templates/swatch-100x100.svg` is a page of that size to draw on.

Crosshatch & isogrid is kept in the code and left out of the list for now (`hidden: true` on its card); its tests still
run.

A single layer of zigzag, wave or square rows whose peaks meet and close into cells is the **Coil** with that shape (the
*Zigzag cells* preset): neighbouring rows run opposite ways, which puts them half a wave apart, and *row overlap* 0 is
the peaks just meeting; more is crossing. It has no card of its own.

One SVG import serves every design: its lines print first, the swatch takes its size (so the size fields give way to a
line that says so), and a switch cuts the pattern to its closed shapes. The panel is built from classes in
`src/ui/panels.js`, so a change to a control is made once and applies to every design; tooltips are one layer
(`src/ui/tooltip.js`) that shows any element's title in a bubble the moment the pointer rests on it.

What tells the flat line cards apart: **Crosshatch & isogrid** lays straight lines at chosen angles in each layer, so
the angle is the design; **Dip weave** is a straight warp with a weft that dips to the bed between every warp, the
over-and-under look in one layer; **Halftone net** is the same crossed net with its line thickness (flow) carrying a
pattern; **Weave** goes over and under in two printed levels.

## The publications

`reference/publications-to-patterns-2026-10-15.md` says which of the papers in `reference/publications/` became a card
(halftone net, spacer net, pillar weave, the three new weave bindings) and which were only context.

Flow: a strand's points may carry a `flow` multiplier (1 = nominal bead). It scales the extruded volume of the move
ending at that point, lowers its speed through the volumetric limit, and widens the strand in the 3D preview. Moves with
no `flow` produce exactly the G-code they always did.

## The infill library

`src/engine/infill.js` lays one layer of any PrusaSlicer 2.9 infill pattern inside any outline: rectilinear, aligned
rectilinear, grid, triangles, stars, cubic, line, concentric, honeycomb, 3D honeycomb, gyroid, Hilbert curve,
Archimedean chords, octagram spiral, adaptive cubic, support cubic and lightning. All take one `spacing`, meaning
area / line length, so two patterns at the same spacing use about the same filament (lightning is sparse by nature).
Cubic, gyroid, 3D honeycomb, adaptive and support cubic are slices of a 3D lattice: each layer index moves on by a
quarter period, so a second layer is a different slice that crosses the first instead of a copy lying on it. Rectilinear
turns 90° on every layer and aligned rectilinear shifts half a gap. These are 2D slices drawn for a textile, not the
slicer's own code: the shapes match, the exact line placement does not.

## The crossing report

Every layered card (Squiggle onwards) reports, in *Details*, how well its layers hold together: crossings and crossings per
cm², crossings between layers, the smallest usual crossing angle (the 10th percentile, so the short jogs that join lines do
not decide it), and the longest stretch of any strand with nothing crossing it. The verdict warns about the one failure that
matters: layers that never cross, which can simply be peeled apart.

## What is honest about each

- **Weave.** A nozzle cannot go *under* a strand that is already printed (its body is above the tip), so a printed
  weave cannot be woven the way cloth is. The weave here lays every strand at one of two levels and cuts it into
  pieces at each change of level; all the lower pieces print first, then all the upper ones, so at every crossing
  the upper strand is laid over the lower. It is a true over/under layout, two layers thick. The strands fuse where
  they cross, so the binding changes how the fabric looks and where strands float far more than how it stretches.
  A 50 mm swatch needs a lift for every piece (hundreds), so it is slow, and the card is marked experimental.
- **Relief.** A strand floating above the bed sags, so no raised stretch is longer than 16 mm (a long run is dipped
  to the bed at its lowest point), and no climb is steeper than 25° (a bump too narrow for that is cut down). The
  *Peak height* the card reports is what survives those limits.
- **Fringe.** Each hair is a lift, and hairs stand over the rows in front of them, so they print far rows first.
  The verdict counts passes that come close to a neighbour, as the loop pile does.
- **Spiral panel.** The rings are the lines of equal distance from the edge, so a heart gives nested hearts and a
  shape with a hole gets rings round the hole. Concave shapes split into more than one strand.
- **Coil and Bouclé.** The crossing lift (0.25 mm by default) is an estimate for foamed TPU and the number most
  likely to need adjusting after the first print.

## Keeping a library

- Every export gets a **swatch code**, for example `coil-overlapping-50x50-3fa9c1`: the design, the preset (or
  `custom`), the size and a six-digit fingerprint of every setting. It is in the file name, in the G-code header
  (`; swatch ...`) and in the studio's *Details*.
- **Share** copies a link that reopens the exact design with its settings, so a photo can link back to how it was made.
- Photograph each swatch flat and draped over the same object, with the swatch code in frame or in the file name.

## Printing notes

- Every design opens at 100 × 100 mm. For a first physical print, choose a 30 × 30 mm test swatch and increase the size once it prints cleanly.
- The Foamy filament profile is unverified; see *Your first prints* in the studio's help. That profile retracts
  nothing; if strings hurt (Fringe, Weave), raise the retraction in the material profile.
- Crossings are printed as strand lying on strand, so the nozzle passes over a strand one layer high. If the nozzle
  drags a strand at a crossing, raise *Crossing lift* by 0.05 mm.
- Large swatches of fine detail are refused with a plain message rather than building millions of moves (limit
  400 000 moves; the weave also limits itself to 12 000 pieces).
