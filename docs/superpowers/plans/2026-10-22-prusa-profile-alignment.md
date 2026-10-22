# Prusa reference profile alignment

User authorized importing the supplied Prusa comparison's no-retraction policy, extrusion amount and printer motor-current command. Baseline 129ea0e commits the preceding Arachne/routing/calibration work before these changes. No push or deployment.

## Decisions from the actual reference

- Source: `drawing-2.svg` and `prusaSlicer.gcode`, profile `0.20mm SPEED @MK3`, filament settings `Generic FLEX`; the physical filament is the user's Filaflex 95 Foamy.
- `filament_retract_length=0` overrides printer `retract_length=0.8`. Zero must survive import and export. No print-body retract/prime commands; necessary nonplanar nozzle clearance is retained.
- Raw material extrusion multiplier 1.15, printer `M221 S95`, first-layer extrusion width 0.42 mm at layer height 0.2 mm. Resolve the effective multiplier as 1.15 x .95 = 1.0925 and emit M221 S100 so the .95 factor is applied once, not twice. Constant-width mesh extrusion should be about .03425 mm filament/mm, within 1% of the reference's measured variable-width infill average .03442.
- Match reference material temperature 240 C / bed 50 C, nominal volume ceiling 1.2 mm3/s and first-layer requested speed 20 mm/s; existing axis/volume caps still apply. The first-layer width is commanded geometry, not a measured foamed bead.
- Store `motor_current` on the printer profile; the SPEED preset's actual command is M907 E538. Do not take E430 from the inactive QUALITY branch or apply MK3 commands to unrelated printers.
- Keep two native raised mesh passes and one selected solid layer. No automatic unsupported-strand reclassification is included in this profile change.

## Tasks

- [x] Import and validate explicit printer current and firmware flow; choose concrete G-code commands over inactive preset branches, and expose resolved diagnostics.
- [x] Resolve the printer flow factor once; honor imported commanded flat width and preserve explicit measured-width calibration precedence.
- [x] Update Foamy defaults to the authorized Prusa comparison settings, preserve previous seam-test provenance and adjust old behavior tests to opt into their old retraction fixtures explicitly.
- [x] Verify zero body retract/prime commands, nominal mesh filament/mm within 1% of Prusa, safe raised clearance, exact M907 and M221 commands, profile round trips and full test suite.
- [x] Regenerate the user's drawing, independently compare output commands, update corresponding source snapshot and docs, commit all changes locally and confirm the project subtree is clean.

Use test-first behavior checks for each resolver/import change. Physical quality remains a new print comparison, not a consequence of passing software tests.

## Verification result

Final full suite: 970 tests, 959 passed, 11 intentional skips, zero failures. Review findings for machine-aware inherited volume ceilings and commanded-width validation were corrected and rechecked. A regression test also verifies that sub-resolution kernel segments carry E into the next moving extrusion instead of creating stationary pushes.

The independent drawing audit confirms zero retract/prime commands, nominal flat input 0.0342546 mm/mm versus Prusa solid average 0.0344227 (0.49% lower), M221 S100 with effective flow 1.0925, E538 start/restore, one solid layer and two raised native mesh passes. Motion estimates: 26.10 versus 21.84 minutes. Actual physical comparison remains pending. See ../../prusa-profile-alignment.md for paths, hashes and limitations. Browser preview confirmed the actual SVG and profile controls.
