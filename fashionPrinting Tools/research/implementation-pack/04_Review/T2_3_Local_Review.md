# T2.3 — Rings · flat

Added the new `rings-flat` card and pure `site/src/engine/rings.js` generator. It places one family of closed rings on a square or staggered hex lattice, clips partial edge rings from an outside start point, and preserves row order. Picture grading holds the centres fixed and recomputes local diameter so overlap never falls below one bead. The card is registered in `research-designs.js` with the shared `rings` settings group.

`chainmail` now includes the shared `ringSize`, `overlap` and `lattice` defaults: `ringSize = spacing × ratio`, `overlap = spacing × (ratio − 1)`, `lattice = hex`. The legacy keys remain its generator inputs. Explicit regression assertions confirm all four existing G-code hashes and move counts remain byte-identical.

Checks: default 100 × 100 geometry is one connected component, has no dangling ends, maximum valence 2, and classifies as flat. Both lattice modes are deterministic and in bounds; minimum overlap remains at least 0.45 mm. Snapshots cover default and all presets.

No physical print has been made; `state` remains `untested`.
