# Strand experiments and Layered defaults — 28 October 2026

## Implementation baseline

This work starts at local commit d84c3329, after the Raised shelf and Flat weight pass. The earlier missing-pattern list described an older tree. Grid lifts, grid channels, corrugation, parallel bundles and most planar research families already exist.

## Layered weight pass

Reference: Prusa MK3S + Filaflex 95A Foamy, 100 × 100 mm, one-colour default, no extra brim/perimeters. The target is **estimated filament mass**, 1.2 g ±10%; it is not measured specimen mass, drape or connectivity evidence.

The pre-existing shelf has 33 visible cards. Thirty now fall in the 1.08–1.32 g band. Settings and preset scaling are centralized in `site/src/ui/density.js`. Carrier settings are applied before the common Support wrapper. Flat and Raised comparison variants keep independent defaults; the comparison links remain.

Exceptions:
- Your drawing: artwork-dependent; an empty card measures only its carrier.
- Rotated stack: three planes and the existing Lu gap range retained, about 2.38 g at the widest gap.
- Conformal: a 0.8–1.8 mm spacing sweep peaks near 1.06 g; denser settings lose paths in the current pipeline. Geometry repair is separate.

Scales now defaults to the existing open-net carrier, one scale layer, 4 mm pitch and 2 mm gap (about 1.30 g). Solid carrier remains selectable. This is not the FlexScale dual-material construction or its interlocking groove.

## New research constructions

| Addition | Source/evidence | Translation |
|---|---|---|
| Sliding squares/circles | Li 2022, Paper 67, pp. 4–5, Figs. 5–8 | Closed checkerboard loops with tangent channels. Fused, one-family, alternating and mixed masks. Geometric reconstruction; not source CAD or validated TPU sliding. |
| Independent bridge height | Kim & Lee 2025, Paper 31, pp. 9–10 | Height and ramp rounding separated. Their CAD forms were conventionally sliced: continuous Z tracing is our adaptation. |
| Localized wave cells | Pattinson 2019, Paper 66, published pp. 3–4 | One/two trapezoidal slack waves between straight junctions, per-direction choice. No claimed stiffening strain. |
| Trapezoid strand primitive/net | Same | Available in the shared strand engine and wavy grid shape choices, plus a dedicated net card. |
| Four-direction isogrid | Kalman 2021, Paper 29 | 0/45/90/135 degrees. Four planar passes. Raised grid variants remain restricted to two directions. |
| Star re-entrant | Kabir 2025, Paper 27, pp. 6–7, 9–10, Figs. 1/4 | Square-corner star reconstruction with 25/30/35-degree straight arms; approximately 15.24 mm diagonal initially. Original CAD unavailable. Corner joints need print tests. |
| Floral re-entrant study | Same | Experimental curved-arm interpolation. The source lacks spline control points; our shape angle is not its measured chord angle. No transfer of measured elongation. |

Shaped-support mesh printing, independently interlooped knit topology and Bastian's original mesostructure remain deferred for the workflow, print-evidence and original-model reasons in the owner's review.

The sliding-loop defaults use a coarse 40 mm trial pitch. Smaller loops produced nozzle-order conflicts in mixed masks; custom combinations with unresolved conflicts remain blocked. A small preview window may fit only one complete loop, in which case it explicitly reports that no sliding crossings fit. Channels use the triangle profile without a bed-level segment through the captive crossing. Default all-sliding, alternating and mixed arrangements were checked at 100 × 100 mm.

Density tuning also exposed two attachment issues: petal ties now enforce a repeat at least twice the carrier spacing, and carrier-backed lace motifs are inset by half a bead plus 0.05 mm so clipping does not split closed edge motifs into weak one-crossing fragments.

## Experimental shelf

The owner explicitly expanded scope beyond shallow-sheet production to strand/process trials. This shelf separates proposed recipes from the established shelf classification. All cards are untested, have an attached crossed carrier, and expose finite paths through the ordinary preview/export pipeline. No claim is made that a commanded path predicts cooled filament geometry.

| Card | Mechanism | Research basis and boundary |
|---|---|---|
| Slub strands | Smooth flow pulses on continuous finite segments | Owner's yarn/bulge idea; Gispan 17 supports flow-controlled width, not a calibrated slub recipe. |
| Pearl-loop deposits | Small attached circular paths at elevated flow | Owner's circular deposit idea; Sterman 58 circular-net precedent, Gispan 17 flow calibration. No isolated dots or stationary extrusion command. |
| Couched waves | Wavy face strand rises between carrier nodes | Curved/slack strands in Steinmetz 57 and Pattinson 66; raised couching recipe proposed here. |
| Tuck-loop texture | Lifted loop returns to a shared root | Beecroft 3/4 and Kim & Lee 31 geometry inspiration; fused carrier texture, not a mobile knit. |
| Long-float ladder | Staggered two-cell arched spans | Draft/float representation in Gelosi 16, partial crossings in Sterman 58, lift context in Pattinson 66. New bed-based recipe. |
| Tapered bridge threads | Metered thick anchors, low-flow centre, touchdown at both ends | Laput 36 pp. 2–3 distinguishes bridge fibres from true drawn hairs; Forman 14 upright glob/hairline process is not replicated. |
| Fan tufts | Three tapered free ends from one root | Laput 36 hair distribution and Ou 49 parameter mapping; TPU metered-flow adaptation, not PLA stringing or DLP hairs. |

Together with the floral study there are eight Experimental cards. Unsupported paths retain their geometry findings; this shelf does not waive collision or export checks. Flow-only bulges keep commanded Z constant. Arches limit requested rise by span; physical sag, cooling, swelling, fusion and residual stress are not simulated. The 1.2 g normalization does not apply to these new study recipes.

## Output changes

Intentional snapshot changes: Layered default/preset density settings; independent bridge-height settings and description; new cards and masks; new shared strand-shape enum. Existing grid channel behavior is preserved by keeping fused-height constraints opt-in for the new closed-loop construction. Card estimates are regenerated at 100 × 100 mm. Snapshot fixtures are regenerated at 40 × 30 mm.

Testing and visual inspection are performed after all additions, per the owner's instruction. No source papers are redistributed. The subsequent handover commit is local only; nothing is pushed.

## Verification results

- Final `npm test`: 1,402 tests; 1,391 passed, 11 pre-existing skipped, zero failed (about 14.5 minutes).
- Generated output fixtures: 340 default/preset snapshots. Card estimates: 305 entries, including all visible presets.
- Browser: screenshots inspected at 375, 768 and 1440 px. No horizontal document overflow. All new cards and the bridge card were opened through the real UI with enabled export for their default configurations.
- No browser JavaScript exceptions. The static development server returns the expected 404 for `/api/study/status`, whose Cloudflare function is absent locally.
- New loop tests cover fused controls, captive channels, mixed masks, default clearance, and finite G-code. Experimental tests cover carrier attachment, bounds, Z and flow propagation, increased deposit volume, and oversized-layout refusal.
- Whitespace check passed. The local source offer was rebuilt after the final code and generated-data changes.

## Local handover

- Development checkout: `G:\Luis\Desktop\__CLI projects\Websites\fashionPrinting Tools`, branch `t-density-layered-defaults`.
- Server: `http://localhost:5185/`, launched with `node dev/tools/serve.mjs --port=5185` from this checkout. The previous listener served the older `filafabric-integration` worktree under OpenCode's worktree directory.
- Find the new eight-card **Experimental** shelf after Raised. Sliding squares/circles are on Raised; localized wave cells and the trapezoid net are on Layered; star re-entrant is on Flat. Reload an already-open tab to load the new modules.
- Commit is local only. The pre-existing launcher edit (`Run Textile Tool.bat`) and untracked `publication/` are excluded. The source package is prepared from the intended Git index so it describes the committed tree rather than including that unrelated launcher edit.
