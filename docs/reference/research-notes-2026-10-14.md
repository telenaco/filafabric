# Research notes — MK3S machine limits and flexible-filament settings

Collected 2026-10-14 for the textile G-code generator. These are **unverified against the user's own printer**.
The authoritative check is a PrusaSlicer-sliced MK3S G-code from the user: PrusaSlicer appends its full config
at the end of the file, which pins down exactly what was used.

## 1. PrusaSlicer presets (master branch)

Prusa's vendor profiles are no longer a single `PrusaResearch.ini`; they live as per-preset YAML files in the
PrusaSlicer repository under `resources/presets/prusa-research-fff/PrusaResearch/`.

Files read:
- `preset-filament-FLEX-Generic-FLEX.yaml` — `Generic FLEX` inherits `*FLEX*`, type TPU, vendor Generic, cost 40
- `preset-filament-common-FLEX.yaml` — the `*FLEX*` base and per-printer variants
- `preset-printer-mk3.yaml` — MK3 / MK3S / MK3S+ printer preset (limits, start/end G-code)

### 1.1 Generic FLEX, MK3 / MK3S / MK2.5 family (applies to the MK3S)

| Setting | Value |
|---|---|
| nozzle temp (first layer / rest) | 240 / 240 °C |
| bed temp | 50 °C |
| idle temperature | 70 °C |
| extrusion multiplier | 1.15 |
| max volumetric speed | 1.2 mm³/s at 0.4 mm nozzle (1.3 at 0.6, 4 at 0.8) |
| retract length / lift | 0 mm / 0 mm (retraction effectively disabled) |
| deretract speed | 25 mm/s |
| travel ramping lift | 0 |
| cooling (auto) | disabled (`cooling: 0`) |
| fan always on | 0 |
| min / max fan speed | 70 / 90 (inert while cooling is disabled) |
| slowdown below layer time | 15 s |
| bridge fan speed (common) | 80 |
| disable fan first layers (common) | 3 |
| filament diameter / density | 1.75 mm / 1.22 g/cm³ |
| min print speed (common) | 15 mm/s |

For comparison, the common `*FLEX*` base (used by newer printers) has 230 °C, multiplier 1.08, max volumetric
3 mm³/s, retract 2.5 mm at 60 mm/s, fan 30–60 %. The MK3 variant overrides most of this.

### 1.2 MK3S printer preset

| Item | Value |
|---|---|
| bed shape | 250 × 210 mm; max print height 210 mm |
| G-code flavour | Marlin; relative E (`use_relative_e_distances: 1`) |
| machine limits emitted to G-code | yes (`machine_limits_usage: emit_to_gcode`) |
| max feedrate X / Y (normal, stealth) | 200, 100 mm/s |
| max feedrate Z / E | 12 / 120 mm/s (both modes) |
| max acceleration X / Y (normal, stealth) | 1000, 960 mm/s² |
| max acceleration Z / E | 200 / 5000 mm/s² |
| acceleration extruding (normal, stealth) | 1250, 1250 mm/s² |
| acceleration retracting (normal, stealth) | 1250, 1250 mm/s² |
| acceleration travel (normal, stealth) | 1500, 1250 mm/s² |
| jerk X / Y / Z / E | 8 / 8 / 0.4 / 4.5 mm/s |
| silent mode | 1 |

Note: `machine_max_acceleration_e` is 5000 on the base MK3 and 8000 in the MMU single-mode variants.

Start G-code sequence (0.4 mm nozzle): `M862.3 P "[printer_model]"`, `M862.1 P[nozzle_diameter]`,
`M115 U3.14.1`, `G90`, `M83`, heat commands (`M104/M140/M190/M109`), `G28 W`, `G80 X Y W H` (mesh bed levelling
over the print area), `G1 Z0.2`, `G1 Y-3`, `G92 E0`, intro line (`G1 X60 E9 F1000`, `G1 X100 E12.5 F1000`),
`G92 E0`, then **`M221 S95`** (flow 95 % unless layer height < 0.075).

End G-code sequence: raise Z, `G1 X0 Y200 F3600` park, raise Z further, `G4`, `M221 S100`, `M900 K0`,
`M104 S0`, `M140 S0`, `M107`, `M84`.

## 2. Recreus Filaflex 95 Foamy (95A) — recommended starting parameters

Source: `recreus.com/en/products/filaflex-95-foamy`. Recreus calls these "initial recommendations".

| Nozzle | Layer | Line width at 100 % | Flow for 0.4 mm line | Volumetric speed (nominal) | Nozzle temp |
|---|---|---|---|---|---|
| 0.4 mm | 0.2 mm | 0.55 mm | 73 % | 5.0 mm³/s | 248 °C |
| 0.6 mm | 0.3 mm | 0.825 mm | 73 % | 11.3 mm³/s | 248 °C |
| 0.8 mm | 0.4 mm | 1.1 mm | 73 % | 20.0 mm³/s | 250 °C |
| 1.0 mm | 0.5 mm | 1.375 mm | 73 % | 31.3 mm³/s | 252 °C |

| Feature (0.4 mm) | Speed |
|---|---|
| external perimeter (50 %) | 22.73 mm/s |
| internal perimeters (75 %) | 34.09 mm/s |
| infill (100 %) | 45.45 mm/s |
| top/bottom (60 %) | 27.27 mm/s |
| first layer (30 %) | 13.64 mm/s |

Other guidance:
- **Foaming:** at 100 % flow the line is about 37.5 % wider than the nozzle, so flow must be reduced. Flow can go
  down to 60 % in 5 % steps for lower weight. Lower flow and higher temperature foam more (lighter colour).
  Reducing volumetric speed by 10–15 % gives the foaming agent more time to activate.
- **Retraction:** 2.5–6.0 mm at 75 mm/s, Z-hop 0.2 mm. Stringing is worse than standard TPU.
- **Travel speed:** 200–500 mm/s (use the maximum the machine allows).
- **Bed:** room temperature for small parts; 50–55 °C for large parts.
- **Cooling:** fan off (0 %); force-fan for overhangs/bridges off; 50 % only when a layer takes under 15 s;
  first layer 0 %.
- **Drying:** 55 °C for at least 1 h ("crucial").
- **Extruder:** direct drive preferred (the MK3S is direct drive).

Standard Filaflex Foamy (non-95), `recreus.com/en/products/filaflex-foamy`, differs: 75 % flow, 3.5 mm³/s at
0.4 mm, retraction speed 65 mm/s, fan 40 % under 10 s, same 245–250 °C range. A third-party retailer listing
gives retraction 35–50 mm/s and bed 40 °C; treat that as lower-reliability than Recreus's own page.

## 3. Derived numbers used in the design

- Filament area (1.75 mm): π · 0.875² = 2.405 mm².
- Recreus nominal 5.0 mm³/s × 0.73 multiplier ≈ 3.65 mm³/s actual deposited volume. Generic FLEX 1.2 × 1.15 ≈
  1.38 mm³/s actual.
- Default hairpin (15 mm long, 6 mm wide, 3 mm lift): arc length ≈ 33.4 mm; peak slope with `sin²` profile and 1 mm
  anchor dwell ≈ 17°; Z speed stays under 12 mm/s up to about 40 mm/s of 3D speed.
- Default tile: 21 base lines (≈ 2.2 m), 18 rows × 32 loops = 576 loops.

## 4. Things to verify with the user's own G-code

1. Actual nozzle and bed temperatures, extrusion multiplier and retraction used with Filaflex Foamy 95.
2. Whether stealth or normal mode is used, and the `M201/M203/M204/M205` values in the file header.
3. Firmware version on the printer (the preset's start block advertises `M115 U3.14.1`).
4. Any linear-advance (`M900 K…`) value used with this filament.
5. Whether the printer has a changed nozzle (size, brand), which affects the clearance model.

## 5. Sources

- https://recreus.com/en/products/filaflex-95-foamy
- https://recreus.com/en/products/filaflex-foamy
- https://github.com/prusa3d/PrusaSlicer/blob/master/resources/presets/prusa-research-fff/PrusaResearch/preset-filament-common-FLEX.yaml
- https://github.com/prusa3d/PrusaSlicer/blob/master/resources/presets/prusa-research-fff/PrusaResearch/preset-filament-FLEX-Generic-FLEX.yaml
- https://github.com/prusa3d/PrusaSlicer/blob/master/resources/presets/prusa-research-fff/PrusaResearch/preset-printer-mk3.yaml
