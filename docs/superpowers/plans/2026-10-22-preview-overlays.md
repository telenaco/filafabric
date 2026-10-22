# Flow, speed, width and travel preview overlays

User requested implementation of diagnostic overlays after reviewing the Three_Slicer candidates. Extend the existing Three.js preview and View menu; no renderer replacement, print-setting changes, deployment or push. Existing project is clean at 79ddc60.

## Design

Keep Instrument Sans, the existing neutral surfaces and compact View controls. Add a labelled colour-view selector with Structure / Flow / Speed / Width / Travel, a numeric colour legend and concise diagnostic totals below the canvas. Use a cool-to-warm numeric scale with printed units; colours indicate relative values, not physical printability. Travel shows a subdued printed piece with horizontal moves and lifts distinguished. Keep role filtering and print-order playback working. All 3D views use identical data and analysis; the flat 2D overview hides these controls.

Flow is raw filament input in mm³/s, speed is commanded F/60 after limits, flat width is commanded geometry and air width is the existing foam-model estimate. Read the generated move commands through GcodeWriter to account for coordinate/E/F rounding, zero-length segments, material/printer flow and adaptive local flow once. Never infer physical under-extrusion from a heatmap. Summarize flow changes between consecutive extruding commands without crossing travels, and expose the largest relative change as a diagnostic rather than a defect verdict. Analyse travels as contiguous non-extruding spatial moves: route length, Z range and lift counts. Retraction-only commands are not travels or deposited material.

## Implementation sequence

1. Add failing behavioral tests for raw volume and exact speed, variable widths and calibration, air strands, quantized coordinates, pure retraction, travel routes, flow-change boundaries and empty input. Implement a pure src/ui/toolpath-metrics.js module that consumes {moves,cfg}, exposes move-indexed segment metrics plus compact totals and view legends. Use export's writer, not inferred UI speed settings. Commit verified analysis.
2. Add a pure colour/bucket adapter for the existing renderer and tests for metric ranges, missing/constant data, travel categories and input immutability. Wire segment colours into existing thin/true-width geometry while retaining role hiding, playback and theme rebuilds. Numeric modes must remain visible when both optional geometry toggles are off.
3. Add the selector, accessible legend, ranges and totals in the existing preview UI. Switching views must not rebuild geometry generation, alter saved print setup or invalidate ready G-code. Check the real drawing at mobile/desktop sizes, all modes, playback and 2D transitions; inspect console errors.
4. Run the full suite and regenerate drawing-2.svg to assert byte-identical output against SHA 133dcf4962eb7e238d7f7fe717d84dabf01a79466729f784898ce61835cd5035. Refresh source snapshot, verify matching source files and commit locally. Record results and screenshots in chat outputs.

## Review focus

- Use raw E once, including printer .95; no duplicate M221 or foam expansion in flow.
- No fake width/flow for coasting, retraction, collapsed or missing segments.
- Nonplanar Z transitions and travel route grouping stay distinct from physical layers.
- Numeric ranges remain stable during playback and role filtering, and equal-valued ranges stay finite.
- A stale/empty/failed preview and switching back to 2D do not show misleading previous metrics.
