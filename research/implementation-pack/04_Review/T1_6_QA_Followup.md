# T1.6 local QA follow-up

- Owner direction: retain Flat / Layered / Raised; remove visible family subheadings (Cells, Lattices, etc.). Metadata remains for migration and variant grouping.
- Fixed lightweight overviews for Figure-8 rows and legacy Coil shapes, and supplied the missing Figure-8 gallery thumbnail.
- Zigzag depth modulation now happens on each lane before clipping/chaining, so the entire joined fabric is not compressed toward its average centre.
- Spacer/Pillar weave declare their real intended families rather than deriving fictitious L1–Ln names from their physical layer count. The tall-solid clearance regression test passes without weakening export checks.
- Updated obsolete fixed-shape filename assertions, preset coverage, and the ready-card count check. Effect/thickness now distinguish filenames when active.
- Regenerated geometry-only printability estimates for the current registry. No physical verification is claimed.
- Honeycomb flat has the same provisional shelf discrepancy as its Auxetic generator (two native families at 0.4 mm); recorded for review, not relabelled as physically validated.

Validation: 74 focused regression checks and 49 snapshot/effect/gallery checks passed. The 154 output snapshots remain unchanged. Browser screenshots at 375/768/1440 px have no horizontal overflow or page errors. Source-archive currentness is still intentionally outstanding: do not run `source:snapshot`.

All changes remain local; no push, merge, or physical print.
