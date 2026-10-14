# Fabric structures: the library

Each card in the studio is one physically different structure, so every one can be printed, photographed and draped
into a library. Patterns, strand shapes, sliders and presets are variations inside a card.

Nothing here has been printed yet: every drape or handle description below is a hypothesis until a swatch exists.

## The cards

| Card | Structure | Layers | What changes the fabric |
|---|---|---|---|
| **Loop pile** | Soft raised arches anchored on an open base; each loop arches over the lines beneath it | base + arches | pile height, loop size, spacing, base openness, strand thickness, variation, **pattern** (raises some loops, lowers others) |
| **Squiggle & Gyroid** | Two fused layers of lines (columns then rows, or two offset rows that cross) | 2 | mode, strand shape, pattern, line spacing, wave depth and length, two colours |
| **Zigzag mesh** | Squiggle & Gyroid, parallel mode, zigzag strand: two anti-phase layers that open into diamonds | 2 | as Squiggle & Gyroid |
| **Coil** | Flat rows of one continuous looped strand; where it crosses itself or the row before it lifts over by about a layer | 1 (+ lift at crossings) | presets (Open chain, Overlapping, Dense), strand shape, loop size and spacing, **row overlap**, crossing lift, pattern |
| **Weave** | Warp and weft lines over and under each other: plain, twill 2/1, twill 2/2, basket, satin. Printed in two passes by level, a lift for every piece | 2 levels | binding, line spacing |
| **Spiral panel** | Rings that follow the edge of the panel, nested inwards and joined by short jogs: one strand, no lifts | 1 | ring spacing, any SVG outline |
| **Bouclé & picots** | Rows of line with a round ring standing on it, alternately above and below, as one strand | 1 (+ lift where rings meet a row) | presets (Picot trim, Bouclé, Curls), ring size and spacing, row spacing, pattern |
| **Relief** | Rows of one strand that rise and fall with a pattern: bobbles, puckered stripes, pleats | 1 + Z | presets (Seersucker, Bobbles, Pleats), relief height, row spacing, pattern |
| **Fringe** | A base of lines with hairs standing off them, rising then hanging free | base + free ends | presets (Fringe, Shag, Fine pile), hair length, height, spacing, row gap, variation |
| **Crosshatch & isogrid** | Layers of parallel lines, each at its own angle: 0/90, 45/135, 60/120 or three ways 60° apart; lines can be wavy | 2 or 3 | directions, line shape and wave size, spacing |
| **Auxetic mesh** | Rows of zigzag, each the mirror of the one below, with staircases of struts: honeycomb cells, or re-entrant bow-ties that widen when pulled | 2 | cell type, row spacing, cell width and depth |
| **Dip weave** | Straight warp on the bed, straight weft that rides over each warp and dips back to the bed between | 1 (+ lift at crossings) | warp and weft spacing |
| **Spiderweb** | One continuous spiral crossed by a radial zigzag out along one spoke and back along the next | 2 | turn spacing, spokes, hub hole, sawtooth |
| **Ring mail** | Overlapping rings on a hexagonal lattice, a second layer of rings shifted into the triangular gaps | 2 | ring spacing, ring overlap |
| **Meander** | One strand that never crosses itself (Hilbert, Peano, a random maze, or a stipple tour through graded dots), held by a hatch at an angle | 2 | curve, fold size, hatch angle and spacing, pattern |
| **Harmonograph** | A closed Lissajous curve that crosses itself in a diamond lattice, optionally with a phase-turned copy | 1 or 2 | lobes across and up, phase |
| **Truchet tiles** | Random tiles per cell: diagonals (an X in every cell) or arcs that flow into curves, seeded | 2 | tile, size, pattern number |
| **Voronoi lace** | Relaxed Voronoi cells with their Delaunay triangulation across; cells smaller where a pattern is bright | 2 | cell size, evenness, pattern number, pattern |
| **Turing stripes** | Reaction-diffusion stripes grown from a few specks, crossed by a hatch; the same number grows the same pattern | 2 | stripe spacing, pattern number, hatch |

Strand shapes (Coil, Bouclé's ring, Crosshatch and Squiggle & Gyroid): looped, figure-8, zigzag, honeycomb (flat tops and
bottoms, so neighbouring layers stack), wave, square and rings.

Patterns (a brightness map that shrinks or deepens the loops, waves, lifts or relief) are ported from the Blender
ceramics add-on: deep spiral, brick, diamond grid, tribal feathers, circuit board, ocean waves, hexagon cells, mountain
peaks, lotus petals, lightning bolts, plus soft noise, bumps and stripes.

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

- Start with a 30 × 30 mm swatch of each new structure. Increase size once it prints cleanly.
- The Foamy filament profile is unverified; see *Your first prints* in the studio's help. That profile retracts
  nothing; if strings hurt (Fringe, Weave), raise the retraction in the material profile.
- Crossings are printed as strand lying on strand, so the nozzle passes over a strand one layer high. If the nozzle
  drags a strand at a crossing, raise *Crossing lift* by 0.05 mm.
- Large swatches of fine detail are refused with a plain message rather than building millions of moves (limit
  250 000 moves; the weave also limits itself to 3 000 pieces).
