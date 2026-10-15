# Printers and filaments

The studio reads every file in `machines/` and `materials/` (listed in `index.json`). A file can be

- a **PrusaSlicer** config export: `.ini` (Printer Settings, Filament Settings or a whole config export), or a sliced
  `.gcode`, which ends with the config it was sliced with. One file with both a printer and a filament gives you both;
- a **Bambu Studio / OrcaSlicer** preset exported as `.json`;
- this tool's own `.json` profile (see `machines/prusa-mk3s.json` for the shape).

To add a printer or filament: put the file in the right folder and run `node tools/profiles-index.mjs` (the local
server picks new files up by itself). To remove one: delete the file and run the same command. A person can also add
a file in the studio's *Printer setup*: it is kept in their browser only, and has a *Remove* button there.

## The printer library

`library/` holds printers taken from the slicers' own vendor profiles, so a printer can be picked in the printer setup
(type a little of its name in the search) without anyone exporting a file first. For now it holds the most used
**Bambu Lab** printers (A1 mini, A1, P1S, P1P, P2S, X1 Carbon, X1E, H2D, from Bambu Studio) and **Prusa** printers
(CORE One, MK4S, MK4, MK3.9S, MK3.5, MINI, XL, from PrusaSlicer's vendor bundle), each with a 0.4, 0.6 and 0.8 mm nozzle.
The studio's own `machines/prusa-mk3s.json` stays the MK3S.

The library is generated: `node tools/import-vendor-profiles.mjs` downloads the latest vendor files from GitHub and
rebuilds it (`--all` adds Creality, Anycubic, Elegoo, Voron and a dozen more, about 500 printers). Only the small
`index.json` is read when the studio opens; a vendor's file is read when one of its printers is chosen.

A vendor's start and end G-code is kept as the vendor wrote it, less the parts this tool cannot fill: lines inside a
`{if}` block (none of its branches is kept), lines that need a slicer value it does not have, and the arguments of a
Klipper `PRINT_START` macro that it cannot fill. The printer setup says how many lines were left out. Bambu Lab
printers are sent `.gcode.3mf` files by Bambu Studio: check that yours prints a plain `.gcode` before relying on it.

## Defaults

What a slicer file does not say gets a plain default, and the printer setup says so: how much a foaming filament
swells in the air (`flow.foam_expansion`, 1 unless you set it), and a prime line along the front edge when the printer
has no purge area. Look at the start and end G-code the setup shows before printing on a new machine.
