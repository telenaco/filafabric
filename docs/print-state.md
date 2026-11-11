# Print state and history

## Restoring a document

| Action | What the studio restores |
| --- | --- |
| Ordinary reload | The remembered printer, filament, layer height and filament adjustments. The design starts at Zigzag defaults. |
| Shared link | The sanitized settings in the link. Drawings with colour regions include their vector paths. |
| Open a settings file | The sanitized settings and any saved outline, vector paths, region roles, membership and order. |
| Undo or redo | A document snapshot from the current tab. The region editor selects a starting colour and the studio rebuilds from the restored settings. |

`snapshot()` and `sanitizeState()` define the v4 settings format and earlier version fallbacks. Region path membership is rebuilt from the drawing. A missing card leaves its region excluded with a recovery note. Profile IDs refer to the available printer and filament libraries. When an ID cannot be resolved, the studio uses a known profile. Pictures stay in memory. A picture pattern restored without its image falls back to a built-in pattern.

The selected colour is editor state. The checkbox and Apply flags are document state. [Drawing colours](drawing-colours.md) defines which flag combinations build. The studio projects this membership to the engine as a single `enabled` flag. Build products such as previews, estimates, and G-code are derived from the current document and effective print setup.

## Build and export ownership

| Workflow | Owner and transitions |
| --- | --- |
| Preview and estimate | `site/src/ui/main.js` debounces edits and retires the previous generation immediately. A full preview, explicit estimate, or background trace owns its worker until completion or cancellation. A late result or error can update the studio only while its job still owns the current build key. |
| Printable result | `buildKey()` compares the selected profile contents and document inputs. History uses `snapshotKey()` for document changes. Export can reuse only a matching full build. Reference browsing and the alternate 3D sample remain view-only, including when the sample dimensions match the requested dimensions. |
| SVG, settings, picture and printer inputs | `site/src/ui/main.js` tracks the latest request in each input scope. A later document selection, removal or history restore supersedes pending work. A settings file can restore its document while a newer printer choice retains ownership of the print setup. |
| Garment panel | `site/src/ui/panel-ui.js` claims the save picker, worker, and writable together. A chunk is acknowledged only after that job writes it. The file commit owns finalization once close starts. |
| Variants and Swatch Lab | `site/src/ui/main.js` and `site/src/ui/swatch-lab.js` capture setup before building the first piece. Closing or cancelling retires the batch. Ready variants require a matching setup before download. |

Automatic G-code and comparison ZIP names include a readable printer model from the captured job. A typed panel filename is used as entered after filesystem sanitization. Older filenames and demo names still parse. Filename changes do not alter the G-code body.

## Toolpath protocols

| Owner | Transition and invariant | Regression fixtures |
| --- | --- | --- |
| `site/src/engine/emit.js` | Start above the first printable strand and descend to its start. Keep touching endpoints continuous where their heights match and no pause is due. Otherwise retract if required, lift to safe Z, travel and descend, then prime on the first extrusion. A wipe that has already pulled filament prevents a second retract. | `emit.test.js`, `retraction.test.js`, `selective-travel.test.js` |
| `site/src/engine/colour-plan.js` | Mark the first strand of a colour transition without changing strand order. Emit a single `M600` for that boundary after reaching safe travel height. | `colour-plan.test.js`, `emit.test.js` |
| `site/src/engine/order.js` | Respect clearance dependencies before emission. Keep the existing order when it is safe. If dependencies cycle, split within the configured budget and report any unresolved conflicts. | `order.test.js`, `travel.test.js` |
| `site/src/engine/gcode.js` and `gcode-modes.js` | Emit startup, body, then footer. Establish absolute XYZ and relative E before the prime macro and body. Switch from first-layer temperature on the first higher extrusion, and update the fan when the motion class requires it. The incremental writer carries modal state, rounding and cumulative E across chunks. | `gcode.test.js`, `panel.test.js`, `retraction.test.js` |
| `site/src/engine/motion-time.js` | Read emitted commands in order, tracking XYZ/E modes, units, feed, flow and axis limits. Flush the motion queue at barriers. Unsupported motion makes the estimate incomplete. Heating, probing, homing and human wait durations are excluded. | `motion-time.test.js` |
| `site/src/engine/svg-parse.js` and `profile-import.js` | Carry each SVG subpath's current command and point through repeated coordinates and close operations. Track slicer profile sections and config trailers, then validate the resulting printer or filament. Preserve translatable startup commands and report omitted slicer macros. | `svg-import.test.js`, `profile-import.test.js` |
| `site/src/engine/regions.js` | Use the page boundary for dedicated Line regions and the hole-aware outline for other roles, for both clipping and diagnostics. Report out-of-bounds segments without changing routing. | `region-lines-over-holes.test.js`, `regions.test.js` |

Compare unchanged inputs through `golden.test.js` and `design-snapshots.test.js` after an engine change. Use the specific fixture above when investigating an output difference. A change to print motion belongs in the review as a deliberate, explained output change.
