# Printers and filaments

The studio reads every file in `machines/` and `materials/` (listed in `index.json`). A file can be

- a **PrusaSlicer** config export: `.ini` (Printer Settings, Filament Settings or a whole config export), or a sliced
  `.gcode`, which ends with the config it was sliced with. One file with both a printer and a filament gives you both;
- a **Bambu Studio / OrcaSlicer** preset exported as `.json`;
- this tool's own `.json` profile (see `machines/prusa-mk3s.json` for the shape).

To add a printer or filament: put the file in the right folder and run `node tools/profiles-index.mjs` (the local
server picks new files up by itself). To remove one: delete the file and run the same command. A person can also add
a file in the studio's *Printer setup*: it is kept in their browser only, and has a *Remove* button there.

What a slicer file does not say gets a plain default, and the printer setup says so: how much a foaming filament
swells in the air (`flow.foam_expansion`, 1 unless you set it), and a prime line along the front edge when the printer
has no purge area. Look at the start and end G-code the setup shows before printing on a new machine.
