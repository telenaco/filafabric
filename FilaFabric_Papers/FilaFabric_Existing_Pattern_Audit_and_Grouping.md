# FilaFabric existing pattern audit and proposed grouping

**23 October 2026. Research and implementation brief; the app has not been reorganised by this review.**

FilaFabric should ask what holds the sheet together before asking which decorative algorithm to use. The recommended entry groups are **Nets**, **Pattern on a mesh**, and **Shallow texture**. Keep the existing S/M/N manufacturing classes as technical descriptions beneath those groups. Preserve the different generators internally where necessary; users should encounter a few constructions and their relevant presets rather than a catalogue of every algorithm and shared strand shape.

This audit covers all **31 ready design IDs**, including two hidden cards, plus the Advanced Zigzag preset tile. The registry has 32 entries: 29 visible ready cards, one visible preset, and two hidden ready cards. Here `ready` means selectable by the engine, not physically validated. The current gallery separates ten visible essentials from twenty other tiles. The source registry, not the older README count alone, is the inventory authority.

Luis reports that Parquet prints poorly and that Bubbles' paired ring construction is acceptable. Those are useful physical observations, but the exact saved settings, material/profile and specimens have not been inspected here. The remaining findings come from code, existing tests and diagnostic geometry runs. A connected geometric graph does not establish adequate weld area, drape, strength or reliable extrusion.

Related reports: [research pattern catalogue](FilaFabric_Printable_Textile_Pattern_Catalogue.md) and [paper reference](FilaFabric_Research_Reference_and_Design_Notes.md).

## Separate the four meanings currently called a pattern

| Term to use | What it controls | Examples | Where it belongs |
|---|---|---|---|
| **Construction** | The paths and contacts that make a coherent sheet. | Crossed net, paired cells, motif on carrier, low relief on carrier. | First choice. |
| **Motif or layout** | The drawing distributed across that construction. | Meander, Turing stripes, parquet blocks, petal lace, concentric curves. | A relevant preset or motif choice inside its construction. |
| **Strand shape** | How an individual route bends or loops. | Sine, zigzag, rings, figure-eight, square wave. | Available only where the selected construction supports it. |
| **Image or modulation** | A field that changes width, size, direction or height. | Photograph, stripes, noise, flow modulation, shallow relief. | One shared image/texture operation with an explicit physical effect. |

Halftone is chiefly a colour/exposure operation on a network; “ring” is a strand primitive; Voronoi is a geometric network construction; a backing is a structural role. Presenting all four as equivalent top-level fabric types causes duplication and makes consequences hard to predict.

## How the proposed groups relate to S M and N

| User-facing group | Structural rule | Manufacturing tags | Initial controls |
|---|---|---|---|
| **Nets** | The chosen paths and their designed contacts jointly form the sheet. Includes a coordinated pair of path families. | S candidate; M for several coordinated passes; local crossing lifts recorded separately. | Size, construction preset, openness/spacing, one relevant geometry control. Woven effects live here as an experimental subfamily. |
| **Pattern on a mesh** | A visual motif is attached to an explicit carrier. The carrier is selected to hold the motif and the sheet together. | Usually M; N only if deliberate motif relief is added. | Motif, motif scale, carrier preset/openness, colour. Show the entire stack. |
| **Shallow texture** | A bed-based supporting network carries deliberately varying local height. | N with its base passes declared. | Base openness, bounded texture height, texture scale. Support, slope and thickness limits are part of the construction. |
| **Experimental archive** | Tall pile, free hairs, upright pillars and spacers. | Outside this brief. | Retain old files and links; omit from the normal flat-sheet choice. This is an archive, not a fourth competing starter group. |

These are proposed roles, not a claim that an S, M or N label can be assigned permanently from the card ID. For example, a looped Coil can form a network while its ring mode receives a carrier. A pure curve with no carrier is a single route, not necessarily a stable textile sheet. Classify the selected configuration and final stack.

For a supporting mesh, a single hatch family is not automatically a self-supporting backing: its lines may depend on the motif for connection. A two-direction connected carrier can be evaluated on its own. “Decorative” describes the intended role of the motif; it does not mean that deposited motif material contributes no stiffness or load transfer.

## What actually reaches the printer

### Logical passes are not necessarily flat Z layers

Most line designs call `layeredResult`, which uses `layersToStrands` with `coherent: true`. That branch initially places all input path families at the first deposition height, adds connectivity ties, then settles later strands over earlier crossings. Squiggle and Coil also have a flatten-and-resettle stage in `finishFabric`. Paths can return toward the bed between crossings. Consequently, two source arrays, two preview colours or `layerCount: 2` do **not** prove two uniformly separated planes or a total thickness of twice the layer height.

Weave is a different path: it deliberately segments and schedules lower/upper pieces at two levels. Raised Relief and pillar designs preserve their intended height construction. Do not infer a common layer policy from their similar thumbnails.

For later implementation, report separately: source path families, deposition order, functional roles, automatic ties, carrier passes, intentional relief, and the actual minimum/maximum deposited Z. Crossing lifts are a manufacturing treatment; they should not force every ordinary net into the Shallow Texture menu.

Evidence: [layers.js](../src/engine/layers.js), especially `layersToStrands` and `layeredResult`; [fabric-result.js](../src/engine/fabric-result.js), `finishFabric`; [stack.js](../src/engine/stack.js), `nativeLayerInfo` and `addExtraLayers`.

### There are several different backing operations

| Current operation | Sequence and role | Consequence for simplification |
|---|---|---|
| Meander/Turing native backing | Motif, then one or two backing path families. Two backing families are turned across one another. | Expose as one motif/carrier construction. Preserve its current order until an alternative is verified. |
| Drawing & Infill | Drawing/fill, then zero, one or two backing layers over the selected region. | A natural home for the shared Pattern on a Mesh workflow; zero backing requires a connectivity decision. |
| Ring Coil/Bouclé and ring-only Spiral reinforcement | `finishFabric(...reinforce: true)` inserts `gridStrands` before the motif, then flattens and resolves crossings. | These are already carrier-supported constructions, despite descriptions that suggest a lone ring/curve layer. Carrier is not a user-selected native hatch. |
| Automatic structural ties | `connectStrands` bridges components using short paired links where possible. | Ties repair a particular graph; they are not a complete, designed backing. Report them explicitly. |
| Optional global Backing Mesh | Two anti-phase zigzag passes are prepended beneath the complete design and the original output is raised. | This adds two passes to whatever backing already exists. It can duplicate native support. |
| Extra layers | Flat designs repeat logical passes; a one-pass construction can regenerate a 90-degree alternate. Raised designs reinforce their base instead. | This is neither a new carrier choice nor a simple universal “number of layers” operation. |

Evidence: [backing.js](../src/engine/backing.js), [svgdesign.js](../src/engine/svgdesign.js), [fabric.js](../src/engine/fabric.js), [design-export.js](../src/engine/design-export.js), [stack.js](../src/engine/stack.js).

The proposed normal experience should have **one carrier decision**, with advanced access to old arrangements when needed. Adding a standard carrier beneath an existing motif-plus-backing result should not be the default way to migrate it: that retains the duplicate support and extra thickness.

### Decorative face and print order are different things

A decorative motif can print first against the bed and receive its carrier above; “backing” names its role, not necessarily the earliest print. Alternatively, a connected carrier can print first and receive decoration above. Reversing the order changes support, the bed-facing image, occlusion and bonding. Do not swap arrays or Z offsets and assume equivalent cloth.

For the requested criss-cross carrier case, an explicit three-pass proposal is carrier A → carrier B at another angle → decorative motif. The current motif-first version is motif → backing A → backing B. Both have three logical passes. A visual layer preview should label which face is shown. Keep the initial implementation to one verified order/preset, and add the alternate only after comparison swatches.

## Complete current design inventory

This table describes source geometry **before any optional global backing, imported drawing, perimeter, solid addition or extra-pass operation**. Automatic internal ties/reinforcement and support-following processing still apply. Pass counts are logical path families unless explicit Z planes are stated.

### Nets and coordinated path families

| Current card and ID | Construction and connection responsibility | Proposed organisation or issue |
|---|---|---|
| Squiggle & Gyroid `squiggle` | Two crossed or anti-phase parallel strand families; final flattening/resettling and ties. Shared strand primitives can make waves, zigzags or rings. | Main crossed-line network family. Keep mode, shape and modulation inside it. The title's Gyroid does not make every variant a mathematical gyroid. |
| Zigzag mesh `zigzag` | Two related zigzag families, crossed or shifted to form cells. | A simple preset within Nets; keep its easy starting controls and stable ID. Candidate for a common paired-line implementation with Squiggle, after parity checks. |
| Coil `coil` | Rows of one looped/oscillating route, using overlap and crossing treatment. Ring mode additionally receives crossed reinforcement. | Loop/serpentine construction in Nets; route ring-on-carrier configurations into Pattern on a Mesh. Do not promise every Coil shape is a standalone one-pass fabric. |
| Crosshatch & isogrid `crosshatch` **hidden** | Two or three direction families, including isogrid/kagome arrangements. Processed through the common support-following layered pipeline. | Restore its useful construction ideas as Nets presets rather than another large card menu. Keep multi-direction geometry distinct from merely changing a line shape. |
| Auxetic mesh `auxetic` | Mirrored zigzags with connecting struts, not a decorative image on an arbitrary hatch. | Connected-cell net subfamily. Name the re-entrant mechanism; auxetic performance still needs measurement. |
| Halftone net `halftone` | Two coordinated line families with image-driven flow/speed and optional inverse tone on the second family. | Image/colour mode on compatible Nets, with calibration. Retain its current ID and generator until equivalent output is verified. |
| Weave `weave` | Draft-based lower/upper segments printed by level, with ramps and many piece boundaries; contacts fuse. | Experimental woven-effects preset within Nets, not independent sliding yarn. Separate binding from structural carrier choices. |
| Dip weave `dipweave` | Straight warps and subsequent wefts that rise over warps and dip between them. | Keep as a distinct crossing treatment within woven effects. It does not alternate freely sliding over/under yarn. |
| Spiderweb `web` | Spiral plus radial zigzag/spoke family, with an optional central hub. | Radial Nets preset. Its second family is chosen to connect the first, not an unrelated decorative hatch. |
| Ring mail `chainmail` | Staggered overlapping ring families on a lattice; contacts become a fused network. | Ring-cell net preset. Rename/descriptively label fused rings; do not imply mobile chain mail. Distinct from a ring sitting on a carrier line. |
| Harmonograph `harmonograph` | Self-crossing Lissajous route, with an optional phase-shifted copy. | Curve net candidate. One continuous/self-crossing line is not by itself proof of stable sheet geometry. Record one/two-family configuration. |
| Truchet tiles `truchet` | Diagonals use complementary tile diagonals; arcs use a second independently seeded, half-tile-shifted tiling. | Tiled network preset; preserve the two different rules, and verify tile joins, edge fragments and second-family survival on small swatches. |
| Voronoi lace `voronoi` | Delaunay edges print first; the Voronoi dual prints second, derived from the same seed sites. | Coordinated cellular Nets. Do not group its native second pass with arbitrary Meander/Turing backing. A carrier-supported Voronoi-only option would be a separate proposal. |
| Conformal mesh `conformal` | Related function/field contours with hole hems. | Field-aligned Nets preset. Check near poles/holes and avoid promising constant strand spacing merely because fields are orthogonal. |
| Sunflower `sunflower` | Oppositely winding parastichy families join common golden-angle seed sites; optional centre hub. | Radial Nets preset, with its shared-site connection logic preserved. |
| Rosette `rosette` | Opposite-phase wavy spirals designed to meet/cross; optional central hub. | Radial paired-wave preset, reusing shared line-shape/image controls where appropriate. |
| Flow lines `flowlines` | Streamlines from a flow and its perpendicular field; connectivity also depends on clipped paths and added ties. | Field-aligned Nets preset. A pair of mathematically related fields still needs finite-sheet contact checks. |
| Bubbles `bubbles` | Packed primary rings and secondary gap rings computed from neighbouring bubble centres; optional touring joins nearby rings. | Coordinated cellular Nets. Preserve both co-designed families and gap-bridging logic; do not replace the second with a generic hatch. Luis reports this construction is acceptable. |
| Parquet `parquet` | Tile-local perpendicular serpentines; inter-tile continuity depends on geometry, chaining and repair ties. | Nets candidate **held for repair/validation**, or a decorative parquet motif on a carrier. Current default and parameter-limit problems are described below. |
| Spirograph `spirograph` | Two offset/phase-shifted trochoid ring families, with optional hub. | Radial loop-network preset. Similar curls do not make this equivalent to repeated Coil rows. |
| Star lattice `starlattice` | Hankin strap networks split into two, three or four non-crossing families depending on tiling. | Geometric lattice Nets preset. Do not label these star motifs as the same mechanism as auxetic star cells. |

### Pattern on a mesh

| Current card and ID | Construction and connection responsibility | Proposed organisation or issue |
|---|---|---|
| Meander `meander` | A space-filling/maze/stipple route plus one or two separately selected hatch/wave/gyroid backing families. | Canonical motif-plus-carrier case. Show motif and carrier independently; retain the curve as a motif preset. |
| Turing stripes `turing` | Reaction-diffusion stripes, potentially separate fragments, plus one or two independent backing families. | Same carrier workflow as Meander, with a different motif source. Check every retained fragment's attachment. |
| Drawing & infill `svgdesign` **hidden** | Imported lines and/or filled shapes, optionally followed by one/two backing layers over swatch, shapes or drawing box. | Shared drawing/motif construction engine; do not expose all infill/coverage options by default. Backing off is conditional, not a guarantee that a drawing is a fabric. |
| Bouclé & picots `boucle` | Calls `generateCoil` with `shape: 'ring'`, explicit row pitch and zero row-overlap input; the ring mode adds crossed reinforcement. | Merge as a ring/picot preset in the common line/motif family. Preserve the edge-trim intent and row-spacing behavior. |
| Spiral panel `spiral` | Default `second: 'none'` still inserts a crossed carrier through reinforcement; explicit `normals` creates a geometry-related crossing family instead. | Default belongs here; normals configuration belongs with coordinated Nets. Do not call current default output a truly unsupported single-layer spiral. |

### Shallow texture candidate and excluded experiments

| Current card and ID | Construction and connection responsibility | Proposed organisation or issue |
|---|---|---|
| Relief `relief` | Deliberately varying-Z rows over a mandatory crossed base; current default relief is 2 mm, not a validated shallow limit. | Candidate foundation for Shallow Texture after low-height, support and slope limits are measured. Keep base and relief controls separate. |
| Loop pile `loop-pile` | Raised anchored loops over its own base; default pile height 3 mm. | Experimental archive. Flattening this is a new construction, not a safe renaming. |
| Fringe `fringe` | Base rows and raised, free-ended hair paths; default lift 3 mm. | Experimental archive; free-ended standing fibres are outside this brief. |
| Spacer net `spacer` | Lower net, stacked pillar rings and an upper net. | Experimental archive; its height is fundamental to the architecture. |
| Pillar weave `pillarweave` | Upright pillars plus serpentine fibres around alternating sides. | Experimental archive; preserve files/links, do not mix into flat woven effects. |

### Preset alias rather than a thirty-second construction

`zigzag-mesh` (**Advanced zigzag mesh**) has `status: 'preset'` and opens `squiggle` with `{shape: 'zigzag', mode: 'parallel'}`. It has no independent fabric generator. Remove the duplicate top-level tile in the future grouping while resolving old links to the same settings. Do not confuse this alias with the ready `zigzag` design ID.

## Parquet findings and repair choices

### What is established

The user's poor-print report is retained. The code does not support a blanket claim that Parquet's two families never overlap: each block deliberately contains perpendicular passes, and default raw geometry has thousands of crossings. The problem must be evaluated at **whole-sheet seams, retained path families, final support and weld quality**.

Diagnostic conditions: rectangular 100 × 100 mm swatch unless noted; herringbone block 8 mm, ratio 2, spacing 2 mm, turn 45 degrees; raw contact evaluation uses the profile's nominal bead width 0.42 mm and layer height 0.2 mm. Raw path-family counts and crossings are measured before shared repairs. Final generation uses the current card and standard MK3S/Foamy profile, without optional global backing, brim, extra passes or imported drawings. These are algorithmic diagnostics, not physical prints.

| Diagnostic | Raw result | Final implication |
|---|---|---|
| Default herringbone | 2,546 between-family crossings and three geometric components. | Current output adds 44 structural-tie strands and reports one component. Many crossings do not establish robust inter-tile seams. |
| Long-planks preset: block 5 mm, ratio 3, spacing 2 mm, turn 0 degrees; 100 × 100 mm | 3,207 between-family crossings but 138 components. | Bead-inset clipping yields 147 components; current output uses 292 ties and reports one component. The repair materially changes the construction. |
| 20 × 20 mm; block 0.8 mm, ratio 2, spacing 5 mm, turn 45 degrees | Retained family counts `[2, 0]`: zero between-family crossings. | A permitted configuration loses an entire family, while the final geometry can still be marked exportable based on self-crossings/connectivity. |

The small-block case arises because tile-local serpentine lengths become very short and `clipPolyline` drops pieces shorter than 1 mm before chaining. At block 0.8 mm/ratio 2, long-axis paths are 1.2 mm while perpendicular paths are 0.4 mm: only the former survive. A layout designed as a two-family mesh can therefore stop being one. A separate basket case at similarly small block/wide spacing can retain no paths. Existing Parquet tests cover particular reasonable block/pitch combinations, not this full control-range failure. Default herringbone's raw three components become 23 after bead-inset clipping, before the 44 ties reconnect them.

Two reporting weaknesses can hide this distinction. `repairs.ties` can be zero for ties inserted in the coherent layered stage; count the actual `Structural tie` strands or carry their provenance through the pipeline. The final crossing report combines strands as base versus supported, so supplemental ties can produce a positive “between” count even when the native second family disappeared. Neither field currently proves native family-to-family attachment. Also, `exportable` does not reject every separated crossing or long unsupported span; these quantities need separate assessment.

### Proposed paths forward

1. **Keep Parquet as a structural net:** redesign inter-tile joins explicitly; require both intended families, adequate seam contacts and bounded spans after clipping. Test the tile-field boundaries, not just each tile. Report tie count and location and compare a version without generic repairs.
2. **Make Parquet a decorative motif on a carrier:** use a connected mesh to carry the sheet while parquet controls appearance. Preserve colour/block direction, but accept that this is a new motif/carrier construction with different thickness and mechanics.

Recommendation: retain Parquet's old ID for compatibility, mark it as needing repair in the implementation backlog, and keep it out of the initial simplified starter selection until one route is validated. No automatic hiding or geometry changes were made in this audit. There is not enough evidence to choose the cause of Luis's particular specimen without its saved configuration.

## Duplicates and shared geometry

| Relationship | Finding | Proposed action |
|---|---|---|
| Advanced Zigzag → Squiggle | Exact registry alias. | One preset, no separate construction tile. |
| Bouclé → Coil ring | Same generator and ring primitive, with different parameter exposure and defaults. | One implementation/preset family; preserve trim-specific settings. |
| Ring shapes in Squiggle versus Coil | Shared primitive, but arranged as paired wave families versus ring rows; support insertion and settings differ. | Reuse the primitive and naming; merge UI choices only after equivalent configurations are demonstrated. |
| Zigzag versus Squiggle zigzag | Same design family, separate present pipelines/defaults. | Candidate preset migration with before/after geometry and saved-link checks; do not assume byte-identical exports. |
| Meander versus Turing | Different motif algorithms using the same backing stack. | Shared Pattern on a Mesh workflow; retain motif algorithms. |
| Bubbles versus Ring mail | Both look circular; Bubbles uses variable packing/gap rings, Ring mail a regular staggered ring lattice. | Keep distinct network presets. |
| Voronoi versus decorative Voronoi | Current implementation is a dual network. A Voronoi outline on an arbitrary mesh would be different. | Retain current network; do not silently replace its second family. |
| Radial motifs | Spiderweb, Rosette, Sunflower and Spirograph have different paired-family rules. | One browsing subfamily and shared centre controls, not one assumed interchangeable generator. |

No existing parameters, saved patterns or generator IDs should be deleted merely because their starting tiles are consolidated. Keep a migration map from old ID/settings to construction, motif, carrier and image treatment. Separate exact alias migrations from geometry-changing replacements.

## Implement one group at a time

### 0 — Make the construction report truthful

Before changing the gallery, derive a proposed assembly description from the **final output**, not its card label: construction role, native families, carrier families, print order, tie count, intentional Z envelope, source ID/settings and validation state. Count carrier passes separately from optional repeated passes. Audit the existing layer/legend strings that call hidden reinforcement a single layer. Keep current saved files and links loadable.

Acceptance: every current ID maps to a documented construction; previews and exports use the same assembly; support and added ties are visible in the report. This does not require presenting engineering vocabulary in the normal user controls.

### 1 — Pattern on a mesh

Use Meander and Turing as the first pair, then incorporate drawing motifs, ring/picot rows and carrier-supported spirals. Define one explicit carrier preset with a known print order and expose its openness, not three overlapping backing systems. Start with one verified stack; preserve legacy arrangements as advanced/legacy configurations.

Acceptance: test the carrier alone where independent support is claimed; check each motif fragment for real contact; inspect gaps and edges; show both faces and all actual passes. Export does not contain duplicate native and global backings. A motif plus a two-direction carrier is described as three logical passes, not “one layer.”

### 2 — Nets

Start with a paired straight/wave/zigzag family and Bubbles/Voronoi as distinct cellular examples. Add radial/field layouts only after their contacts survive clipping and shape changes. Bring halftone in as a calibrated image treatment on compatible nets. Keep woven bindings experimental and repair Parquet before promotion.

Acceptance: both intended families survive; isolated clipped pieces are removed or intentionally attached; repeat boundaries and local contacts are checked; before/after tie counts and contact locations are recorded. Print directional extension and drape comparisons rather than accepting a one-component graph as proof of a good fabric.

### 3 — Shallow texture

Reduce Relief to a bounded bed-based texture experiment over an explicit carrier. Expose only a small number of texture presets initially. Keep standing loops, pillars, spacers and free-ended hairs in the archive.

Acceptance: support under the texture, measured Z envelope and slope, consistent touchdown and no nozzle dragging; compare against the identical flat carrier/motif control. Determine actual permissible heights from the selected printer/material, not the existing default slider range.

### 4 — Simplify the choice architecture

Move exact aliases and shared shapes inside their relevant constructions. For the first screen show Nets, Pattern on a Mesh and Shallow Texture; within each show a small verified starter set. Reveal motif-specific settings only after selection. Do not solve the problem by moving the same thirty tiles into three large lists.

Keep size and print setup shared. Provide one carrier section only where needed, one image operation with a named physical effect, and one advanced section for overrides. Internally retain IDs and all necessary specialist generators. The goal is fewer decisions per task, not merely fewer lines of source code.

## Literature that bears on these findings (added 24 October 2026)

The second full-text pass of the 65 papers (see section 5 of each entry in the [reference](FilaFabric_Research_Reference_and_Design_Notes.md)) bears directly on several audit findings. These are pointers for the implementation steps above, not validation of any current card.

| Audit finding or step | Relevant source evidence | Implication |
|---|---|---|
| Coherent layering puts all families at the first height, then settles crossings | Diak & Diak 2024 (9): same-layer crossings break strand continuity, and covering them with extra layers stiffens the sheet. Kalman (29): one-layer isogrids stack m strands at each crossing in print order. | Report actual crossing height and order per crossing type. Compare a true two-pass crossing against the settled one on swatches before choosing a default. |
| Step 0, truthful construction report | Wu/Weavecraft (64): an ordered *stack* (which family on top, empty) per crossing. Panetta (51): valid nets are one connected component with no dangling edges and bounded node valence. | Express the report as per-crossing stacks plus a topology check (components, dangling ends, strands per node), separate from the top-view picture. |
| Parquet loses a family or relies on ties at tile seams | Schumacher 2015 (53) chooses neighbouring cells by boundary agreement and forbids point-only contacts; Chen (6) averages cut endpoints across shared edges. | For a structural Parquet, design tile edges to coincide and require a minimum contact width at seams, rather than repairing with generic ties. |
| Bubbles, Voronoi, Turing and Meander use seeds and fragments | Martínez 2016/2017 (44, 45): deterministic per-grid-cell seeding and density fields; convex cells keep connectivity except at the boundary. | Seed by grid-cell coordinates so a design regenerates identically when cropped or tiled; close boundary cells with a border strand. |
| Weave and Dip Weave are fused, not mobile | Jayswal (22): in an upright-printed PLA twill with 1 mm yarns, a 0.5 mm designed gap fused; 0.65 mm let the yarns be separated by hand. Li et al. (via 52) and Pattinson et al. (via 56) describe printed crossings left *unbonded*, by an arc-shaped lift (Li) or by letting the strand cool before it touches the earlier one (Pattinson). | Keep calling the current cards fused. A future "sliding crossing" or bond-mask option (catalogue M9) is the only literature-backed route to mobility; retrieve the two primaries first. |
| Woven-effects presets | LOOMING (39) generates drafts from threading × tie-up × treadling; Weavecraft (64) stencils blocks from an index image, tiling each block to the stencil's size with matching warp and weft counts. | A compact way to expose many bindings and regional binding changes without growing the card list. |
| Choosing starter presets in Nets | Schumacher 2018 (54) and Martínez 2019 (46): tiling symmetry sets the material class (3- or 6-fold isotropic, 4-fold tetragonal, one mirror orthotropic). | Label each Nets preset with its expected in-plane class. Include at least one isotropic option (isogrid π/3 or kagome) next to the 0/90 grid. |
| Shallow Texture limits | Kim & Lee (31): filleted up/down crossing strands, with height equal to line thickness plus half the radius. Wu (64): a print-order graph avoids nozzle-body collisions. | A concrete starting rule and an ordering check for bounded crossing lifts, still to be measured on the actual printer. |

## Evidence and limits

Verification for this handoff: the registry was enumerated programmatically; all 31 ready IDs appear once in the inventory and the preset alias is accounted for. The three Parquet cases in the table were reproduced against the current generators. Two focused existing test runs passed, with 66 carrier/connectivity tests and 96 layout/texture tests. These runs cover their existing fixtures, not the full parameter space or physical print quality. Relative report/source links were checked. A separate read-only review found the grouping counts and staged handoff internally consistent.

Registry and controls: [designs.js](../src/ui/designs.js), [more-designs.js](../src/ui/more-designs.js), [line-designs.js](../src/ui/line-designs.js), [pub-designs.js](../src/ui/pub-designs.js), [svg-design.js](../src/ui/svg-design.js), [panels.js](../src/ui/panels.js).

Critical constructions: [parquet.js](../src/engine/parquet.js), [bubbles.js](../src/engine/bubbles.js), [voronoi.js](../src/engine/voronoi.js), [meander.js](../src/engine/meander.js), [turing.js](../src/engine/turing.js), [coil.js](../src/engine/coil.js), [squiggle.js](../src/engine/squiggle.js), [spiral.js](../src/engine/spiral.js), [relief.js](../src/engine/relief.js). Tests include [parquet.test.js](../tests/parquet.test.js), [bubbles.test.js](../tests/bubbles.test.js), [meander.test.js](../tests/meander.test.js), [turing.test.js](../tests/turing.test.js), and [voronoi.test.js](../tests/voronoi.test.js).

Detailed read-only audit notes and diagnostic scratch files are retained in the ignored `.review-cache/` folder. They include generator/control line locators and reproducible Parquet settings; the authored brief above is the trackable result. No physical testing, app migration or UI redesign has been completed by this review. The older research catalogue's card descriptions follow project prose and should be read alongside this audit where generated support or layer ordering differs.
