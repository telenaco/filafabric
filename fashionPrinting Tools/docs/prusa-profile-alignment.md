# Prusa comparison profile alignment

The supplied `prusaSlicer.gcode` uses `0.20mm SPEED @MK3` and `Generic FLEX`; the user prints Filaflex 95 Foamy. Defaults deliberately reproduce this successful comparison setup, rather than claiming a new manufacturer recommendation or bead calibration.

| Setting | Owner | Comparison value |
| --- | --- | --- |
| Retraction length | Filament | 0 mm; overrides printer default 0.8 mm |
| Material multiplier | Filament | 1.15 |
| Temperature / bed | Filament | 240 / 50 °C |
| Commanded first-layer width | Imported print setting, carried with material defaults | 0.42 mm |
| Requested flat speed | Imported print setting, carried with material defaults | 20 mm/s, subject to limits |
| Raw filament volume ceiling | Filament | 1.311 mm³/s (reference nominal 1.2 × 1.15 × 0.95) |
| Firmware flow factor | Printer startup profile | 0.95, incorporated into E once |
| Extruder motor current | Printer | M907 E538, from the actual SPEED startup |

FilaFabric emits `M221 S100` because its E values already include the printer's 0.95 factor. Applying S95 again would underfeed by another 5%. Material retraction stays zero; an explicit user override can still enable it. Required clearance over raised geometry remains active independently of retraction. The inactive Prusa QUALITY branch's E430 is not used.

For a 0.42 × 0.2 mm rounded-rectangle bead and 1.75 mm filament, commanded E is about 0.03425 mm filament/mm of path. The supplied Prusa solid infill averages 0.03442 after firmware flow, with variable widths. The difference is under 1%. This compares commanded filament input, not the measured foamed bead. Unsupported round strands still use their separate cross-section model; equal filament input does not prove equal printed geometry.

Import resolves zero filament retraction before the printer fallback, positive first-layer widths, return-speed fallback, explicit current and firmware flow. Concrete commands in sliced G-code take precedence over footer template branches. The importer evaluates only recognized print-preset and layer-height conditions; it does not execute arbitrary slicer expressions. A measured bead width overrides commanded geometry while preserving calibration E. Explicit print overrides retain precedence.

The comparison export uses drawing-2.svg at 170 × 80 mm, parallel zigzag spacing 3 mm / depth 1.5 mm / wavelength 6 mm, two native mesh passes, one solid layer, two inside perimeters and Arachne solids. It retains the raised mesh instead of turning the entire garment into a planar single layer.

Physical quality remains to be checked on the same spool and printer. The original photo establishes poor previous quality; software checks alone cannot establish that stringing, adhesion or line finish now match Prusa.

## Regenerated drawing check

The independent modal G-code audit gives 26.10 minutes of commanded motion versus Prusa's 21.84, excluding acceleration, heating and startup. Latest FilaFabric prints 23.00 m of extrusion path, travels 15.19 m in XY and feeds 791.50 mm of filament, versus Prusa's 20.26 m / 6.40 m / 694.81 mm. The two raised passes remain at extrusion Z 0.2–0.6 mm, versus Prusa's planar 0.2 mm. Retractions and body stationary prime commands are zero. The remaining estimated gap is 4.26 minutes; these are not new actual print times.

The final drawing output is `FilaFabric_drawing-2_prusa-profile_perimeters2_solid1_mesh2_170x80mm.gcode`, saved beside the SVG and copied to the chat's outputs. SHA-256: `133dcf4962eb7e238d7f7fe717d84dabf01a79466729f784898ce61835cd5035`. Reference Prusa SHA-256 remains `2927d42f963c1e9223095cf07f15ab79a0cd85e21ffec26fb27e889f1f52c755`.
Final verification: 970 tests, 959 passed, 11 intentional skips, zero failures. Focused regressions cover zero overrides, exact flow/current import, measured-width precedence, inherited volume ceilings and sub-resolution extrusion without stationary pushes. The actual drawing preview was also checked in the browser.
