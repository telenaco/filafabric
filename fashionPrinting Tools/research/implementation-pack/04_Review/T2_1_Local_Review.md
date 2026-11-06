# T2.1 — Rotated stack

Added L-09 **Rotated stack** as a layered, self-supporting card. It prints 2–8 straight-strand planes at angles `k × turn`, with the turn chosen from 30°, 45°, 60° or 90°. Hatch lanes use a fixed centre anchor, pitch `strand × (1 + gapFactor)`, and each strand's extrusion flow is scaled to the chosen width and active profile bead.

The card uses the ticket's three presets and ranges. It goes through the deliberately non-coherent plane path: each plane stays at its own layer height, rather than being settled into one height. Construction records the `S1...Sn` families. The printability table was regenerated as an estimate only (`physical verification: false`). New output snapshots cover the default and all three presets.

Checks: at 90° and two planes, maximum Z is exactly two layer heights; at 60° and three planes, each pair of families crosses; strands carry the selected flow. No physical print is claimed.
