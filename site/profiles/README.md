# Printers and filaments

The studio reads the approved printer files in `machines/` and the filaments in `materials/` (listed in `index.json`). The development importer accepts

- a **PrusaSlicer** config export: `.ini` (Printer Settings, Filament Settings or a whole config export), or a sliced
  `.gcode`, which ends with the config it was sliced with. One file with both a printer and a filament gives you both;
- a **Bambu Studio / OrcaSlicer** preset exported as `.json`;
- this tool's own `.json` profile (see `machines/prusa-mk3s.json` for the shape).

To add a bundled filament, put its file in `materials/` and run `npm run profiles` (the local server picks new files up automatically). Bundled printers also need to be approved in `loadProfiles()` in `site/src/ui/main.js`. The public studio does not currently accept printer or filament uploads.

## The printer library

Only the Prusa vendor library, the bundled MK3S, and the bundled Anycubic Kobra 3 Max V2 appear in the public printer picker. Other vendor data is retained for development.

The library is generated: `node dev/tools/import-vendor-profiles.mjs` downloads the latest vendor files from GitHub and
rebuilds it (`--all` adds Creality, Anycubic, Elegoo, Voron and a dozen more, about 500 printers). Only the small
`index.json` is read when the studio opens; a vendor's file is read when one of its printers is chosen. Printer and
filament pickers each show the selected profile in one editable box. Click the box or its arrow to browse the names
alphabetically, or type to filter. Arrow keys and Enter select; Escape or leaving the field restores the selected
name if no option was chosen.

### Anycubic Kobra 3 Max V2

The experimental profile uses [Anycubic's 420 × 420 × 500 mm build volume and 0.4 mm stock nozzle](https://store.anycubic.com/products/kobra-3-max-v2-combo-3d-printer?variant=47591944388770). It exports a plain `.gcode` file. For an initial single-filament test, run the printer's levelling routine, verify that the default mesh is saved, prime the nozzle, and compare the startup with a small swatch sliced for this exact model in Anycubic Slicer Next. The FilaFabric startup uses a saved mesh and standard heating and homing commands. It has not been verified on the hardware and does not configure ACE 2 Pro slot changes.

## Generic Prusa filaments

The bundled generic materials cover ABS, FLEX/TPU, HIPS, PETG, PLA, PLA Silk and PVA from the installed
PrusaResearch 2.5.12 bundle. FLEX is Prusa's generic TPU baseline; it is labelled with both terms for searching.
PLA Silk and PVA keep their upstream printer-specific suffixes. Existing Foamy, NinjaFlex and generic TPE
profiles remain available. See [material sources](MATERIAL_SOURCES.md) for reference printers and adaptations.

To add missing generic materials from a newer locally installed vendor bundle:

```powershell
node dev/tools/import-generic-filaments.mjs "$env:APPDATA/PrusaSlicer/vendor/PrusaResearch.ini"
```

The importer resolves inherited settings and regenerates the public index. It preserves existing files so updating
the library does not overwrite tuned materials; review existing profiles separately when upgrading a bundle.

## Import requirements and samples

For importer development, see [an example .ini](../samples/printer-profile.ini) or [an example .json](../samples/printer-profile.json). These are **illustrations, not qualified printer presets**. Replace the values and startup/shutdown commands for the actual machine.

Supported formats are PrusaSlicer/Slic3r-style `key = value` configs and bundles, PrusaSlicer text G-code config trailers, Bambu Studio/OrcaSlicer self-contained JSON printer or filament presets, and Filafabric JSON profiles. This is **not a universal importer**: Cura `.curaprofile`, zipped preset bundles, `.3mf`, binary `.bgcode` and arbitrary firmware `.cfg` files are not supported.
Filafabric generates single-extruder prints: when a slicer supplies arrays of nozzle/filament values, only the first extruder's values are read. A successful import is not physical qualification; check firmware commands, temperatures and the import notes, then print a small swatch.

A usable printer export should include:

| Setting | PrusaSlicer .ini | Bambu/Orca .json |
| --- | --- | --- |
| Bed polygon (required) | `bed_shape = 0x0,250x0,250x210,0x210` | `"printable_area": ["0x0", "250x0", "250x210", "0x210"]` |
| Maximum Z | `max_print_height = 210` | `"printable_height": "210"` |
| Nozzle diameter | `nozzle_diameter = 0.9` | `"nozzle_diameter": ["0.9"]` |
| Print layer height (optional) | `layer_height = 0.45` | `"layer_height": "0.45"` in a complete config |
| Firmware | `gcode_flavor = marlin2` | `"gcode_flavor": "marlin2"` |
| Startup/shutdown | `start_gcode`, `end_gcode` | `machine_start_gcode`, `machine_end_gcode` |
| Machine limits | `machine_max_feedrate_*`, `machine_max_acceleration_*`, `machine_max_jerk_*` | `machine_max_speed_*`, `machine_max_acceleration_*`, `machine_max_jerk_*` |

In PrusaSlicer, prefer **File → Export → Export Config** for the current printer, filament and print settings together. A bundle also works when all inherited presets are in that file: hidden `*parent*` presets are resolved, not offered as printers. For a bundle with several print presets, only the active `[presets]` print/printer pairing supplies a layer height (or the unambiguous single print/single printer pair).

Bambu/Orca often export only differences from an `inherits` preset. A file with no bed because it expects a separate system parent is **not complete**: export resolved settings instead. The importer does not fetch arbitrary missing parents. A print/process-only JSON contains no printer and is rejected with an explanation. A filename extension alone does not establish compatibility.

### Layer defaults

`layer_height` belongs to the **print/process preset**, not necessarily the printer preset. When it is present, it becomes the printer's `print_defaults.layer_height`; selecting or importing that printer applies it. Exact values such as 0.28 or 0.32 mm are retained rather than rounded to a 0.05 mm button. Without a print height, a nozzle-based default is chosen: 0.2 mm for a 0.4 mm nozzle, 0.3 mm for 0.6 mm, and 0.45 mm for 0.9 mm. The suggested buttons remain available for manual changes; explicitly saved/shared thicknesses are restored instead of reset on reload. Imported heights must be positive and no greater than 80% of the nozzle diameter; that is a compatibility check, not material qualification. Nominal extrusion width scales with the nozzle unless overridden by the material/design.

A vendor's start and end G-code is kept as the vendor wrote it, less the parts this tool cannot fill: lines inside a
`{if}` block (none of its branches is kept), lines that need a slicer value it does not have, and the arguments of a
Klipper `PRINT_START` macro that it cannot fill. The printer setup says how many lines were left out. Bambu Lab
printers are sent `.gcode.3mf` files by Bambu Studio: check that yours prints a plain `.gcode` before relying on it.

## Defaults

What a slicer file does not say gets a plain default, and the printer setup says so: how much a foaming filament
swells in the air (`flow.foam_expansion`, 1 unless you set it), and a prime line along the front edge when the printer
has no purge area. Look at the start and end G-code the setup shows before printing on a new machine.
