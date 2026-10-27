# T2.4 — Rotating squares

Added the `rotating-squares` flat card and shared `rotating-units.js` geometry helper. It numerically solves for square side length from cell spacing, alternating rotation and target neck length; rounds each square corner with six arc segments; adds two-pass necks when wider than the active bead; and adds an inset perimeter band. The three families occupy one plane. Explicit shared-joint metadata prevents the crossing resolver from lifting the intended neck-to-square T-junctions, so the default remains flat rather than being mistaken for a layered weave.

Checks: default 100 × 100 mm geometry has one component without ties, no dangling ends, max valence 2, and classifies flat. Geometry is deterministic and bounded; neck path length is 1.2 ± 0.05 mm. Angle extremes and the 40 × 30 mm swatch generate valid geometry. Output snapshots cover default and three presets. Chainmail's existing G-code hashes and move counts remain unchanged after the shared ring settings were added.

The associated Shajoo result used ABS units on a pre-stretched knit; this single-material implementation is untested. No physical print is claimed.
