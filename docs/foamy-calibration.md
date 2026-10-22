# Foamy flat-bead calibration

The shipped Filaflex 95A Foamy preset retains the MK3S settings from the 21 October seam test: 238 °C, flow multiplier 0.73, 1 mm retraction at 40 mm/s, return at 20 mm/s, 0.2 mm optional lift, 180 mm/s travel, and 0.2 mm seam gap. No new bead-width or maximum-flow measurement has been supplied. The source profile's `reference_line_width: 0.55` is a source setting, **not** a measured bead at 238 °C. Without a measurement, a 0.4 mm nozzle keeps the existing 0.45 mm nominal width and its existing extrusion amount.

## Printer setup controls

- **Filament flow multiplier** changes the commanded amount of filament; it starts at 0.73 for Foamy. Keep that tested value while measuring width.
- **Flat extrusion speed override** is optional. Empty retains the design's speeds (normally 15 mm/s base, 12 mm/s supported). A value applies only to horizontal base/supported extrusion, including flat solids and perimeters. Sloped supported feet and rising/falling/free-hanging strands retain their own targets. Machine, extruder and volumetric limits can still reduce the requested speed.
- **Maximum filament volume** limits raw filament input in mm³/s, before foam expansion. Foamy inherits 5 × 0.73 = 3.65 mm³/s from the existing profile; this is a retained software ceiling, not a newly qualified physical maximum. An explicit ceiling is independent of the flow multiplier, and changing the multiplier in Printer setup preserves the inherited ceiling. Wider local beads reduce allowed speed automatically.
- **Measured flat bead width** stays empty until you measure a cooled isolated straight bead. This becomes the flat coverage width used by spacing and perimeter calculations.
- **Calibration commanded width** and **Calibration layer height** describe the line you actually printed to make that measurement. They default to 0.45 mm and 0.2 mm. They record calibration conditions; changing them does not generate a calibration print or change the selected layer height.

These controls travel in share links, saved settings and undo history. Selecting another filament clears their overrides. The exported G-code's `resolved print setup` comment records the measured/commanded widths, calibration height, flat-flow correction, requested flat speed and raw-filament volume ceiling.

## Physical measurement still required

1. Dry the same spool and use the same printer/nozzle as the intended garment. Keep the known 238 °C and 0.73 flow settings. Leave **Measured flat bead width** empty.
2. Print several separated straight single-bead lines at a known rounded-rectangle commanded width and layer height. For the current 0.4 mm MK3S setup, start with 0.45 mm commanded width and 0.2 mm layers. Record the actual extrusion speed from the G-code; use the intended flat speed consistently. A multiwall strip or merged solid fill cannot supply an isolated-bead width.
3. After cooling, measure the middle of several lines at several points, away from their starts and ends. Record the representative width, temperature, speed, layer height and flow. Enter the actual commanded width and layer height alongside **Measured flat bead width**.
4. Print a small flat solid plus perimeter at the same conditions. Check coverage, edge accuracy and adhesion before a full garment. If speed, temperature, flow, nozzle or layer height changes, repeat the width measurement. Higher flat speed and the physical hotend volume ceiling still need a print test; this implementation supplies controls, not new material qualification.

## Extrusion model

The engine uses `A(w,h) = h × (w − h × (1 − π/4))`. For a measured width `wm` made at commanded width `wc` and calibration height `hc`, flat extrusion is corrected by:

```
C = A(wc,hc) / A(wm,hc)
E = path_length × A(requested_width,current_height) × flow_multiplier × C / filament_area
```

At the calibration height and measured width, E therefore stays exactly the same as for the original commanded calibration line. For example, entering a hypothetical 0.55 mm measurement from a 0.45 × 0.2 mm line changes coverage to 0.55 mm without increasing that line's E. The example is not a supplied measurement.

Adaptive flat paths pass a local factor `A(local_width,h) / A(resolved_width,h)`. The engine applies this factor and `C` once each. Air-strand extrusion and the existing foam-expansion preview model remain independent of the flat-width correction. This is a cross-section model at the recorded conditions; it does not predict Foamy's temperature/speed response or replace a physical test.
