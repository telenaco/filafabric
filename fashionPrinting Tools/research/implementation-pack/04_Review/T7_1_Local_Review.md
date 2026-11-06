# T7.1 — line alignment and pass spacing

`linePasses(line, bead, { align, spacing })` now supports centre, inside/outside on closed paths, and left/right on open paths. Centre keeps the old pass count, pitch and coordinates. One-sided alignments use the C10 count and bead-relative pitch; the first bead centre is half a bead from the drawn path. Closed inside/outside selection follows signed area in the parser's y-up drawing frame, so both windings work.

Inside offsets stop before a self-crossing, escaping point, sign reversal or collapsed region and report the omitted pass count. Your drawing exposes Lines sit and pass spacing; saved settings retain `lineAlign` and `passSpacing`. In a drawing that mixes open and closed paths, each path accepts only its corresponding alignment choices; incompatible paths stay centred. This keeps one drawing-level setting usable without moving closed paths to their left/right side or open paths to an undefined interior.

Validation: 61 focused checks passed, including the full output snapshots. Every SVG G-code hash, move count and extrusion summary is unchanged with the default centre alignment; only the settings fingerprints change for Your drawing. Browser-tested its Inside control at 375, 768 and 1440 px; it selected, regenerated and enabled Export with no page errors or horizontal overflow.

No external Hector Vector code was copied. No physical print or licence validation is claimed.
