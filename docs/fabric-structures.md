# Fabric structures: the library

Each card in the studio is one physically different structure, so every one can be printed, photographed and draped
into a library. Patterns, strand shapes, sliders and presets are variations inside a card.

Nothing here has been printed yet: every drape or handle description below is a hypothesis until a swatch exists.

## What is built

| Card | Structure | Layers | Controls that change the fabric |
|---|---|---|---|
| **Loop pile** | Soft raised arches anchored on an open base; each loop arches over the lines beneath it (threaded) | base + arches | pile height, loop size, spacing, base openness, strand thickness, variation, room between loops, edge loops |
| **Squiggle & Gyroid** | Two fused layers of lines (columns then rows, or two offset rows that cross) | 2 | mode, **strand shape** (wave, looped, zigzag, figure-8, square), pattern, line spacing, wave depth and length, two colours |
| **Zigzag mesh** | Squiggle & Gyroid in parallel mode with a zigzag strand: two anti-phase layers that open into diamonds | 2 | as Squiggle & Gyroid |
| **Coil** | Flat rows of one continuous looped strand, one layer thick. Where the strand crosses itself or the row before it lifts over by about a layer | 1 (+ lift at crossings) | presets (Open chain, Overlapping, Dense), strand shape, loop size and spacing, **row overlap**, crossing lift, pattern |

Patterns (a brightness map that shrinks or deepens the loops, waves or lifts) are ported from the Blender ceramics
add-on: deep spiral, brick, diamond grid, tribal feathers, circuit board, ocean waves, hexagon cells, mountain peaks,
lotus petals, lightning bolts, plus soft noise and bumps.

## On the way

Shown as placeholders in the left column until they are built.

| Card | Structure | Why it is worth printing |
|---|---|---|
| **Weave** | Warp then weft; plain, twill 2/1 and 2/2, basket, satin. The warp arches over where the weft passes beneath | The only card that is a real weave; different bindings drape differently |
| **Spiral panel** | One contour-following strand, no hops, follows an SVG outline | Garment panels with no travel moves; radial stretch |
| **Bouclé & picots** | Flat rings along a line | Edges and trims |
| **Relief** | Pattern-driven bobbles, seersucker and pleats in one layer | Anisotropic bend (pleats), texture |
| **Fringe** | Hanging loops with a free end | Soft edges |

## Keeping a library

- Every export gets a **swatch code**, for example `coil-overlapping-50x50-3fa9c1`: the design, the preset (or
  `custom`), the size and a six-digit fingerprint of every setting. It is in the file name, in the G-code header
  (`; swatch ...`) and in the studio's *Details*.
- **Share** copies a link that reopens the exact design with its settings, so a photo can link back to how it was made.
- Photograph each swatch flat and draped over the same object, with the swatch code in frame or in the file name.

## What each setting does to the fabric (so far)

- **Row overlap** (Coil): 0 leaves rows touching only at their loops, so the fabric is open and stretches along the
  rows; higher values lay each row over the one before, which closes the fabric and stiffens it.
- **Loop spacing and size** (Coil): loops overlap each other when the spacing is less than twice the size; below
  `spacing / 2π` they cannot form and the line is only wavy (the card says so).
- **Crossing lift**: about one layer. Too low and strands squash into each other; too high and a strand bridges in the air.
  It is the number most likely to need adjusting after the first print.

## Printing notes

- Start with a 30 × 30 mm swatch of each new structure. Increase size once it prints cleanly.
- The Foamy filament profile is unverified; see *Your first prints* in the studio's help.
- Crossings are printed as strand lying on strand, so the nozzle passes over a strand one layer high. Watch the first
  crossings: if the nozzle drags a strand, raise *Crossing lift* by 0.05 mm.
