# Local integration QA — 27 October 2026

Branch: `filafabric-integration`. Merge remains uncommitted; nothing pushed.

## Test status

- Initial `npm test`: **1,174 passed, 32 failed, 11 skipped**. The snapshot coverage assertion stopped snapshot generation early because the three hidden compatibility cards had no recorded files yet.
- Focused export/gate/library/Parquet/repeats/picture/provenance rerun: **64 passed**.
- Focused construction/default-design/fabric rerun: **39 passed**, including every default at full size and every preset.
- New integration regression file: **22 passed**, including all 11 comparison/calibration sets.
- Final full-suite rerun: **in progress**; no final passing claim yet.

## Fixed implementation defects

- Saved generator revision is retained through repeated save/load cycles, instead of unexpectedly reverting current drawings to legacy geometry.
- Region sanitization tolerates malformed colour fields and continues deriving path membership from the actual drawing.
- Positive islands nested inside holes survive the whole-piece build.
- Calibration settings keep exact positive thickness values, including both ends of uniform-flow swatches, rather than silently reverting to slider defaults.
- Carrier contacts use the actual closest point on each segment, avoiding duplicate contacts caused by point sampling.
- Turing seeds are contiguous nuclei on a coordinate-seeded grid; isolated one-cell specks previously diffused away and produced no stripes.
- Clipped Meander fragments can use a disclosed perimeter in the existing Support carrier. Long fragments that still cannot attach remain a blocking error; no silent omission or automatic shrinking.
- Parquet uses designed coplanar seam/turnaround joints instead of diagonal inter-block connectors. Both path-joining passes now retain every contributing strand's joint metadata. The default measures two print planes, one connected component, zero automatic ties and zero reversed crossings.

## Reviewed snapshot updates

`npm run snapshots` recorded **250 default/preset cases across 68 ready cards**.

- All three hidden legacy generators matched every field of their original recorded summaries, including G-code hashes, before new compatibility snapshots were created (only the card ID differs).
- The nine shaped Wave-net/bridge/exposure defaults changed only settings hashes because bundle settings are now explicit. Their default G-code and geometry did not change.
- Parquet, Truchet, Meander and Turing output changes are intentional: designed seams/borders, coordinate seeds, motif metadata and carrier attachment. All other existing snapshots were unchanged.
- Parquet's default 40 × 30 mm case moved from a 0.479 mm maximum Z to 0.400 mm, and from 14 automatic ties to zero. This is software geometry, not physical evidence.

## Browser and supplementary checks

- Screenshots reviewed at **375, 768 and 1440 px**. Colour controls share the preview-mode row, align right and scroll on narrow screens.
- Browser interaction passed: 2D whole-piece view, full 3D, 3D sample, single-pattern automatic rebuilding, stale multi-pattern Export blocking and whole-piece Apply restoring Export.
- Details starts closed and opens/closes on click. The estimate disclaimer is absent. Temporary quiet-warning mode remains enabled; blocking errors and bed limits are not disabled.
- No application errors or uncaught browser exceptions observed during these checks.
- Parquet, Truchet, Meander and Turing exported at 60 × 40 mm with a 12 × 12 mm hole: no lost families, reversed crossings or outside segments.
- Full export responds to measured width tables and bundle settings; saved calibration tables round-trip.
- Python's independent `zipfile` reader validated ZIP entries, Unicode filenames and CRC checksums.
- Source archive rebuilt and `npm run source:verify` passed. All runtime JavaScript passed `node --check`.

## Not established by software tests

Physical print quality, calibration measurements, drape, stiffness, recovery and actual sliding remain unverified. No Tested badges were added and Needs repair badges were not removed.
