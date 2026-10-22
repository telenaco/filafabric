# Independent lace review fixes — 22 October 2026

The review correctly identified disconnected adaptive hatch strokes, unsorted mesh-side window rings, crowded window edges, coupled perimeter counts and a misleading acceleration-free UI estimate. Its scratch files were treated as evidence; fixes were verified against the current engine and supplied drawing.

## Print-path changes

Dense Arachne hatches are ordered, then joined only across short same-shape/same-height links whose entire bead footprint stays within the solid. Exact segment-to-boundary distance checks cover grazing narrow holes missed by sampling. Original segment widths/flow are retained; walls, phases, layers, pauses and raised segments remain barriers. The actual drawing's core now has 511 strokes rather than 2,326, with only 42 independent strokes shorter than 1 mm rather than the review's 735.

Mesh-side outlines now have an independent `meshPerimeters` setting. Solid walls keep `perimeters: 2`. Fresh UI settings use zero extra mesh-side outlines; older saved files preserve their previous shared count. With zero mesh outlines, mesh ends reach the already printed SVG window edges; the two native mesh passes and structural ties remain. The actual drawing has one connected fabric region, and all 1,260 open mesh endpoints reach their printed window edge within 0.00000005 mm.

When extra mesh rings are selected, their first centreline sits one full 80%-width pitch from an already printed edge. Their order and seams are optimized together with bed ties. Four-window tests and the actual drawing verify shorter routing and unchanged native body moves. On the drawing, this stage's travel falls from 5,981 mm to 552 mm. Positive-count mesh reservation follows the same pitch convention. Zero filament retraction no longer forces a cosmetic hop over an empty planar opening; clearance over raised printed material and pauses remains active.

## Independent output comparison

All variants use the supplied drawing at 170 × 80 mm, parallel zigzag spacing 3 / depth 1.5 / wavelength 6, two native mesh passes, one solid layer, solid perimeters 2 and the matched Foamy/MK3 profiles.

| Metric | Prior FilaFabric | Updated, mesh outlines 0 | Updated, mesh outlines 2 | Supplied Prusa |
| --- | ---: | ---: | ---: | ---: |
| Acceleration-aware modeled motion | 31.47 min | 27.68 min | 29.96 min | 24.89 min |
| Commanded body motion, without acceleration | 26.10 min | 23.48 min | 25.85 min | 21.84 min |
| XY travel, including sloped travel | 15.35 m | 7.27 m | 9.03 m | 6.40 m |
| Separate printed runs | 3,185 | 1,405 | 1,371 | 937 |
| Travel ascents | 406 | 177 | 265 | 0 |
| Extrusion path | 23.00 m | 21.19 m | 23.42 m | 20.26 m |
| Filament input | 791.50 mm | 729.40 mm | 805.76 mm | 694.81 mm |
| Retractions | 0 | 0 | 0 | 0 |

The timing model reads actual rounded G-code and applies profile/command acceleration, axis speed limits and classic jerk. It has bounded lookahead and declares unsupported motion instead of supplying a complete estimate. Startup/end motion and specified dwells are included; heating, homing, probing, human waits and firmware overhead are excluded. The UI now uses this estimate, while playback retains its explicitly labelled commanded-motion clock. These remain estimates, not actual print-time or physical-quality measurements.

The updated no-extra-ring file is `FilaFabric_drawing-2_review-fixed_perimeters2_mesh-rings0_solid1_mesh2_170x80mm.gcode`, saved beside the original SVG. Its SHA-256 is `b671ad290ec5ffdde54fd457f146c12ed3db83505c4682030f1eaa814c928ac6`. The optional ring-2 comparison is saved alongside it. The supplied Prusa reference is unchanged (`2927d42f963c1e9223095cf07f15ab79a0cd85e21ffec26fb27e889f1f52c755`).

## Source and remaining physical decisions

Source offers now include only intended tracked/staged allowlisted paths, with deterministic archive contents, an external checksum manifest and a default-suite currentness test. See [source-offer.md](source-offer.md). A whole-app licence decision before any public Arachne release remains the owner's decision; no licence was chosen or publication performed here.

No physical print has been performed. Compare the updated mesh-outline-0 file against the Prusa print on the same spool, nozzle and bed conditions. Check window-edge ridges, joined-core coverage, mesh/body attachment and strings across long travels. Retraction remains off by default as requested. If a print demonstrates long-travel strings, the existing filament controls allow a separate trial with retraction length 1 mm and minimum travel 20 mm; do not treat that untested recipe as an established improvement. The slow prime line is intentionally bounded by the selected raw filament-volume ceiling.
## Verification

Final npm test: 1,008 tests, 997 passed, 11 intentional skips, zero failures. This includes the root source-currentness gate, deterministic/private-file source-offer fixtures, streamed panel parity, independent perimeter settings, exact bead-clearance regression, native mesh ordering, profile flow/current and analytical timing cases. Browser checked the actual drawing with solid perimeters 2, mesh outlines 0, the 28-minute modeled estimate and explicit timing exclusions. An independent emitted-command parser verified both drawing exports and the unchanged Prusa reference. Source archive and manifest were rebuilt after documentation and checked again. Physical print validation remains outstanding.
