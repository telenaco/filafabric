# Fashion Printing Tools — Textile G-code Generator

A browser-based toolbox that generates direct G-code for experimental non-planar FDM textile: a sparse serpentine
base plus a dense pile of raised, anchored 3D loops. First target: Prusa MK3S, Filaflex Foamy 95, a 100 × 100 mm
sample. Machine and material profiles are data files, so more machines can be added from G-code you share.

**Status:** design approved and amended with the user's real MK3S G-code; implementation plan written
(awaiting review); no code yet.

## Where things are

| Path | What |
|---|---|
| `docs/original-brief.md` | The original brief (verbatim) and the decisions made while brainstorming |
| `docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md` | The v1 design spec (architecture, data model, engine behaviour, tests, first-print plan) |
| `docs/superpowers/plans/2026-10-14-textile-gcode-generator.md` | The v1 implementation plan (13 tasks, test-first) |
| `reference/research-notes-2026-10-14.md` | MK3S limits, PrusaSlicer Generic FLEX values, Recreus Foamy parameters, sources |
| `reference/g-code-analysis-2026-10-14.md` | What the user's own MK3S G-code and Bambu A1 mini 3MF contain (verified values, start/end blocks, Bambu notes) |
| `Shape-Box_0.2mm_FLEX_MK3S_5m.gcode` | User's sliced MK3S sample (PrusaSlicer 2.9.6, Generic FLEX): ground truth for the MK3S profile |
| `bambu lab a1 mini.gcode.3mf` | User's Bambu Studio sample for the A1 mini (future sub-project 5) |

Planned (from the spec):

| Path | What |
|---|---|
| `index.html`, `src/engine/`, `src/ui/` | The site and the pure-JS engine |
| `profiles/machines/`, `profiles/materials/` | Machine and material profile JSON |
| `vendor/three/` | Vendored three.js for the preview |
| `tests/` | `node --test` engine tests |

## Roadmap

1. Textile generator + website + profiles (current spec)
2. G-code → machine-profile extractor (from G-code you share)
3. SVG silhouette boundary with rotate-to-fit
4. Interwoven base + loops as one continuous extrusion path

## Open requests

A PrusaSlicer-sliced `.gcode` made with **Filaflex Foamy 95** (not Generic FLEX) on the MK3S would let the Foamy
material profile be verified; the MK3S machine and Generic FLEX values are already confirmed from the sample
in this folder.
