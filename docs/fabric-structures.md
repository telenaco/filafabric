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

Strand shapes (Coil, Bouclé's ring, and Squiggle & Gyroid): looped, figure-8, zigzag, honeycomb (flat tops and
bottoms, so neighbouring layers stack), wave, square and rings.

Patterns (a brightness map that shrinks or deepens the loops, waves, lifts or relief) are ported from the Blender
ceramics add-on: deep spiral, brick, diamond grid, tribal feathers, circuit board, ocean waves, hexagon cells, mountain
peaks, lotus petals, lightning bolts, plus soft noise, bumps and stripes.

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
