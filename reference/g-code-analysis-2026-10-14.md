# G-code analysis — MK3S sample and Bambu Lab A1 mini sample

Analysed 2026-10-14 from the two files the user saved in this folder. Both are the user's own sliced output and
were read as data only (the 3MF was listed first, checked for unsafe paths, and only text members were extracted
to a scratch directory).

| File | Slicer | Printer | Filament |
|---|---|---|---|
| `Shape-Box_0.2mm_FLEX_MK3S_5m.gcode` | PrusaSlicer 2.9.6 | Original Prusa i3 MK3S & MK3S+ (printer profile 2.5.11) | Generic FLEX |
| `bambu lab a1 mini.gcode.3mf` | Bambu Studio 02.08.02.61 | Bambu Lab A1 mini 0.4 nozzle | Bambu PLA Basic @BBL A1M |

## 1. Prusa MK3S + Generic FLEX (verified, replaces the "unverified" status of the earlier notes)

The object is a one-layer 100 × 100 mm box at X 75–175, Y 55–155 (bed centre), 186 mm of filament, 0.55 g, 5 m 2 s.
Everything in the earlier research notes for Generic FLEX @ MK3 is confirmed by the embedded config block.

### 1.1 Machine (from the embedded config and the emitted header)

| Item | Value |
|---|---|
| bed | `0x0,250x0,250x210,0x210`; max print height 210 |
| flavour / E | `gcode_flavor = marlin`, `use_relative_e_distances = 1`, `M83` in start |
| limits emitted | yes (`machine_limits_usage = emit_to_gcode`) |
| emitted header | `M201 X1000 Y1000 Z200 E5000`, `M203 X200 Y200 Z12 E120`, `M204 S1250 T1250`, `M205 X8.00 Y8.00 Z0.40 E4.50`, `M205 S0 T0` |
| accel arrays [normal, stealth] | x/y 1000,960; z 200,200; e 5000,5000; extruding 1250,1250; retracting 1250,1250; travel 1500,1250 |
| feedrate arrays [normal, stealth] | x/y 200,100; z 12,12; e 120,120 |
| jerk | x/y 8, z 0.4, e 4.5 |
| M204 syntax | **`S` and `T` only** (legacy Marlin). No `P`/`R` form; `travel_acceleration = 0` (not used) |
| firmware check | `M115 U3.14.1`, `M862.3 P "MK3S"`, `M862.1 P0.4` |
| extruder current | `M907 E430` in start; `M907 E538` reset in end |

### 1.2 Material and print settings actually used

| Setting | Value |
|---|---|
| filament | Generic FLEX, type FLEX, 1.75 mm, density 1.22 |
| temperature (first / rest) | 240 / 240 °C |
| bed (first / rest) | 50 / 50 °C |
| extrusion multiplier | 1.15 |
| max volumetric speed | 1.2 mm³/s |
| retraction | `filament_retract_length = 0` (none); printer default 0.8 mm @ 35 mm/s, lift 0.4 is overridden; **no `G1 E-` in the file** |
| z-lift | none (only 4 `G1 Z` lines: layer change and park) |
| fan | `cooling = 0`, `fan_always_on = 0`; only `M107` appears, **no `M106`** |
| linear advance | `M900 K0` (from the filament start gcode) |
| first layer | height 0.2, width 0.42, speed 20 mm/s; acceleration 800 (`M204 S800`) |
| travel speed | 180 mm/s (`F10800`) |
| perimeter / infill speeds | 45 / 80 mm/s requested, clamped by the 1.2 mm³/s volumetric ceiling |

### 1.3 Observations

- The extrusion model is exact: a 100 mm first-layer move has `E = 3.60574`, which equals
  `0.2 · (0.42 − 0.2 · (1 − π/4)) · 1.15 / (π · 0.875²)` per mm × 100. So the "rounded-rectangle area × multiplier ÷
  filament area" model matches PrusaSlicer to 5 digits.
- The volumetric ceiling in PrusaSlicer applies to **nominal** flow (before the multiplier): `F954.706` (15.9 mm/s)
  × 0.0754 mm² = 1.2 mm³/s. Actual deposited volume is 1.2 × 1.15 = 1.38 mm³/s.
- The sample is centred on the bed, which matches the design's `origin = ((250 − w) / 2, (210 − h) / 2)`.
- Prusa's start block ends with `M221 S95` (flow 95 %), then `M907 E430`, `G21`, `G90`, `M83`, `M900 K0`, `M107`.
- Prusa's intro line is `G1 X60 E9 F1000` / `G1 X100 E12.5 F1000` at Y −3 after `G1 Z0.2` / `G1 Y-3`.
- `M73` progress/remaining-time commands are emitted throughout; the printer works without them.

### 1.4 Emitted end sequence

```
G1 Z1.2 F720 ; Move print head up
G1 X0 Y200 F3600 ; park
G1 Z49.2 F720 ; Move print head further up
G4 ; wait
M221 S100 ; reset flow
M900 K0 ; reset LA
M907 E538 ; reset extruder motor current
M104 S0 ; turn off temperature
M140 S0 ; turn off heatbed
M107 ; turn off fan
M84 ; disable motors
```

## 2. Bambu Lab A1 mini

### 2.1 Container

`.gcode.3mf` is a zip containing `Metadata/plate_1.gcode` (the G-code), `Metadata/plate_1.gcode.md5` (its MD5),
`Metadata/project_settings.config` (JSON, 580 keys), `Metadata/slice_info.config`, `Metadata/model_settings.config`,
`Metadata/plate_1.json`, `3D/3dmodel.model`, five PNG thumbnails, `Metadata/filament_sequence.json`,
`Metadata/cut_information.xml`, `[Content_Types].xml` and rels. The plate is a 100 × 100 mm cube, 10 layers of
0.2 mm, PLA, 7.17 m / 21.73 g, 32 m 53 s, bbox X 50.4–150.4, Y 18.0–118.0.

### 2.2 Machine

| Item | Value |
|---|---|
| model | `printer_model_id N1`, "Bambu Lab A1 mini 0.4 nozzle", structure i3, direct drive |
| bed | `printable_area 0x0,180x0,180x180,0x180`; `printable_height 180`; textured PEI plate |
| flavour / E | `gcode_flavor = marlin`, `use_relative_e_distances = 1`, `M83` |
| emitted header | `M201 X20000 Y20000 Z1500 E5000`, `M203 X500 Y500 Z30 E30`, `M204 P20000 R5000 T20000`, `M205 X9.00 Y9.00 Z5.00 E3.00` |
| M204 syntax | **`P R T`** |
| max speed [normal, silent] | x/y 500, 200; z 30, 30; e 30, 30 |
| max accel [normal, silent] | x/y/extruding 20000, 20000; travel 9000; retracting 5000; z 1500; e 5000 |
| jerk | x/y 9, z 5, e 3 |
| defaults | default acceleration 6000; travel speed 700 mm/s; `M204 S500` for walls |
| retraction | 0.8 mm @ 30 mm/s, deretract 30, z-hop 0.4 (auto lift), minimum travel 1 mm |
| pressure advance | project value 0.02, disabled in this project (`enable_pressure_advance = 0`) |
| PLA basic | nozzle 220 °C, bed 65 °C, max volumetric 21 mm³/s, fan 60–80 % |

### 2.3 Start/end structure (the expanded block is ~470 lines, lines 592–1061 of the plate G-code)

Machine-specific macros: `M1002` claim/flag commands, `M1006` start/finish sounds, `G392 S0` (clog detect off),
`M9833.2`, `G380 S2/S3` end-stop avoidance, `M17`/`M18` motor and current handling, `M960` lamp, `M982.2` cog noise,
`M109 S100 H170` / `G28 X` / `M211` soft end-stop off, a long nozzle-wipe sequence, `M190 S65` and `M109 S140`
before `G29.2 S1` / `G29 A1 X.. Y.. I.. J..` bed levelling over the object area, `M975 S1` vibration suppression,
a nozzle load line and extrusion calibration line (`G0 X88 E10 …`), `G29.1 Z-0.02` for the textured plate,
`M106 S0` fan-off lines, `M1007 S1`, then `M981 S1 P20000` (**spaghetti detector on**) at the first layer.

Body conventions: `G1 X Y E F`, relative E, `M204 S6000` for travel and `M204 S500` for walls, `M73 P R`
progress, `G17`/`G2`/`G3` arcs (arc fitting on), `M106 S…` per layer, Z lifts by `G1 Z.4` / `G1 Z.2`.

End: `M104 S0`, park at `G1 X-13 Y180`, `M400`, motor current and bed lowering, sounds, `M18 X Y Z`.

### 2.4 What this means for the design

1. **A machine profile needs more fields** than the MK3S one: `accel_syntax` (`S_T` vs `P_R_T`), a different
   bed (180 × 180 × 180) and Z limits (30 mm/s, much more headroom for non-planar moves), and large start/end
   macro blocks with temperature/bed-type placeholders.
2. **The output is a package.** A raw `.gcode` is not what the Bambu workflow uses; a generated G-code would have
   to be put inside a `.gcode.3mf` (zip) with `Metadata/plate_1.gcode` and its MD5, probably reusing this file as
   a template.
3. **Printer features that can get in the way of this experiment:** the spaghetti detector (`M981 S1`), the
   clog detector (`G392`), the first-layer inspection, and the AI/mech-mode checks. A non-planar loop in the air
   may trigger them. The profile should state which are disabled.
4. **Tracked as sub-project 5** in the spec; it needs its own short design (packaging, MD5 in the browser,
   macro templating) once the MK3S v1 works.

## 3. Sources

- `Shape-Box_0.2mm_FLEX_MK3S_5m.gcode` and `bambu lab a1 mini.gcode.3mf` in this folder (user-provided).
