# Adaptive solids and efficient fabric routing

User authorization: implement all four improvements discussed on 22 October 2026; document them, commit locally, never push. Baseline: 74d4e85.

Preserve two native zigzag passes, raised crossings, layer precedence, holes, bed limits, and the single selected solid layer. Keep the physically tested 238 C, .73 flow, 1 mm retraction at 40 mm/s, 20 mm/s priming, .2 mm lift and seam defaults. No unmeasured claim of print quality or flow calibration.

Use the real Orca/Cura-derived Arachne implementation already compiled to WebAssembly by Three_Slicer, pinned to 8ee934d183a9f60ab09bab9e05cd7bb747c6a51a. This is not a claim of bit-identical Prusa paths. Convert flat SVG regions with holes into a one-layer closed mesh, obtain real variable-width walls and dense core paths, and retain only geometry and widths. All printer commands, thermal/flow calibration, mesh crossings, travel and final G-code remain FilaFabric's. Include notices, the AGPL licence and a corresponding-source archive. Arachne initialization is asynchronous and explicit; errors must not silently substitute a different generator. Existing synchronous callers retain the classic generator unless requesting Arachne.

The browser's real preview and export should use Arachne for flat solids when perimeters are enabled. Zero perimeters and existing coil fills remain supported. Wall/core paths must carry per-segment area ratios through clipping, simplification, reversal, ordering, preview and G-code. Keep selectable solid layer count and native mesh untouched.

Improve deterministic ordering and seams only inside dependency barriers. Preserve destination-attached segment flow when reversing. Use local printed-height clearance for travels, with conservative fallback where history/boundary information is unavailable. Do not skip retraction over voids merely because the endpoints are close.

Expose an optional measured flat bead width and the commanded width/layer height of its calibration print, explicit flow multiplier and a flat speed override. Resolve the measured bead geometry with a matching area correction so recording a wider measured bead does not itself increase filament. Do not interpret the material's reference width as a physical measurement. Continue to enforce volumetric and axis speed limits.

Verify thin tapered features, holes, empty/collapsed regions, variable-width reversal, disconnected islands, raised-strand crossings and saved settings. Regenerate drawing-2.svg at 170 x 80 mm, perimeters 2, solid layers 1, mesh passes 2, and compare emitted commands to the prior FilaFabric and Prusa files. Report calculation-only estimates separately from physical print results.
