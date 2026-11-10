# Coherent fabric and garment panels

The target is freestanding fabric. Geometric checks must distinguish an extrusion path from a sheet with distributed joints. Printed bond strength, drape and durability remain physical measurements.

## Structure

Validate final 3D strands, including strand-width contacts, separate components, unsupported stretches, reversed crossing heights and boundary escapes. Clip full segments against outlines, including holes. Join separate motifs with short ties inside the boundary. Set crossing heights in print order across all layers. Use a crossed supporting base for pile, fringe, bouclé and relief. Do not mark unresolved structural problems as ready.

## Garment panels

Bound the interactive swatch to at most 100 × 100 mm while retaining the selected full document dimensions. A separate panel exporter repeats this texture in bounded sections over a continuous, two-pass backing lattice. Panel dimensions and repeat size are explicit; radial designs repeat per section. Outlines and their holes apply to the full panel. Generate and emit one section at a time, in a worker in the browser, with progress and cancellation. Maintain one G-code writer state across sections and a global travel clearance. Never send the full panel to WebGL.

The generic large gantry profile has a 1000 × 1000 × 300 mm volume, conservative limits, no Prusa macros, and is unverified. Printer-specific startup must be checked before a physical run. File output is streamed where supported; the bounded-memory download fallback has an explicit byte limit.

## Validation

Regression fixtures must catch disconnected crossing-rich islands, crossings separated in Z, lower later passes, holes and concavities, and travel over a raised middle section. Exercise all 26 designs and presets. Test a 1000 mm panel, cancellation, small edge sections, outline holes and G-code equivalence across chunk boundaries. Supply a swatch print protocol and an executable audit. No claim of physical qualification without prints.
