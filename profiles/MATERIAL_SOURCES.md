# Added filament profiles — 16 October 2026

All three profiles use 1.75 mm filament and non-foaming extrusion. Reference printer: the classic direct-drive
Original Prusa i3 MK3S & MK3S+ with a 0.4 mm nozzle. They are reference presets, not physically qualified garment
prints. The existing Filaflex 95A Foamy and Generic FLEX profiles are unchanged.

| Studio choice | Prusa filament preset | Nozzle, first / printing | Bed | Flow multiplier | Nominal flow cap | Retraction |
|---|---|---|---|---|---|---|
| NinjaTek NinjaFlex 85A (Midnight Black) | NinjaTek NinjaFlex TPU | 238 / 238°C | 50°C | 1.20 | 1.2 mm³/s | 2.5 mm at 60 mm/s; restore at 25 mm/s |
| Generic TPE Flexible | Generic FLEX | 240 / 240°C | 50°C | 1.15 | 1.2 mm³/s | Off |
| Generic PLA | Generic PLA | 215 / 210°C | 60°C | 1.00 | 15 mm³/s | 0.8 mm at 35 mm/s |

Source: [PrusaResearch bundle 2.5.12](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff/blob/c712aaf177a915da19acad20262ab9379010b3aa/PrusaResearch/2.5.12.ini),
revision `c712aaf177a915da19acad20262ab9379010b3aa`. Filament inheritance was resolved before copying values;
the generic PLA retraction values come from the reference printer. Prusa's deretraction speed of 0 means use its
retraction speed, represented here explicitly as 35 mm/s. The generic TPE retraction speed/lift are unused while
retraction is off. Pressure advance remains disabled, as in this studio's existing printer setup.

NinjaFlex matches the requested [Midnight Black spool](https://www.123-3d.ie/NinjaTek-NinjaFlex-midnight-black-TPU-filament-1-75mm-1kg-3DNF0117510-i3686.html),
SKU 3DNF0117510. NinjaTek's [technical specifications](https://ninjatek.com/support/technical-specs/) give
85A hardness and 1.19 g/cm³ density. Its current [printing guidelines](https://ninjatek.com/support/printing-guidelines/)
recommend 225–250°C nozzle and room temperature to 50°C bed; the Prusa preset lies within those ranges.

Generic TPE is an explicit Generic FLEX baseline. An unspecified TPE formulation has no universal temperature,
hardness, density, or flow multiplier; compare the spool's own data before using this baseline. Generic PLA uses
1.24 g/cm³; the TPE baseline uses 1.22 g/cm³. These densities also drive the filament mass estimates.

Cooling uses the existing material `print_defaults` fields so it reaches actual exported commands: base paths
stay at 0%, supported and raised paths use 60% for NinjaFlex and 100% for PLA. Generic FLEX/TPE cooling stays
off. Prusa's gradual layer-based fan ramps and short-layer logic are not reproduced by this path-based generator.
Its conservative textile speeds remain in use, with volumetric limits enforced by the engine. For profiles with
different first-layer and printing temperatures, the exporter sends the printing temperature once on extrusion
above the configured bed layer; travel hops do not trigger it.

Each JSON records its own upstream revision, preset name, source links and `physically_verified: false`.
