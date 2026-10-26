# FilaFabric Printable Textile Pattern Catalogue

*A design-family map, paper-based context, and practical pattern-design notes for soft-material FDM textile structures.*

## Current direction and reading order

**Existing-library follow-up:** the [current-code audit and proposed grouping](FilaFabric_Existing_Pattern_Audit_and_Grouping.md) reviews all 31 ready IDs and the preset alias, distinguishes coordinated networks from motif/carrier assemblies, and records actual backing insertion and local Z settlement. Use that audit for the present implementation; the older family descriptions below are conceptual/source-document descriptions, not a complete account of final exported support.

**Revised 23 October 2026.** The target is a textile sheet printed **lying on the bed**, organised into single-layer, multiple flat layers, and shallow non-planar texture. Upright walls, stacked blobs, tall pillars, thick spacers, and standing pile are outside this brief. Those papers may contribute a calibration or path-planning lesson without becoming candidate patterns.

**Second full-text pass, 24 October 2026.** All 65 sources were re-read in full. The [research reference](FilaFabric_Research_Reference_and_Design_Notes.md) now has a section 5 per paper. This catalogue gains new candidate records (S6–S7, M7–M9), extended records (S2, S4, S5, M2, M3, M6, N1), an [edge and joining details](#edge-joining-and-handling-details) section, [design rules distilled from the sources](#design-rules-distilled-from-the-sources), and a [table of process settings reported by the direct FDM sources](#process-settings-reported-by-the-sources). One correction affects this catalogue: Kabir 2024 and 2025 are one dataset reported twice. An attribution check on 26 October 2026 corrected several cross-paper statements. The main one: an earlier draft called Bastian's mesostructure (the basis of Peleg's FilaFlex textiles) a tall-wall structure "according to Sitotaw". Sitotaw never mentions Peleg, and Keefe's Fig. 7 shows the pattern both as deep blocks and as thin sheets. See the top of the research reference for the full list.

Start with these classes and candidate records. The older family survey below remains background; raised/upright examples are retained for comparison, not implementation priority. The [research reference](FilaFabric_Research_Reference_and_Design_Notes.md) contains the paper summaries and a dated, page-referenced review of all 65 sources. Source numbers below follow its existing Paper numbering; PDF locators count physical pages including covers.

### The three library classes

| Class | Deposition rule | Target structures | Required distinction |
|---|---|---|---|
| **S — Single layer** | One nominal deposition plane without deliberate Z texture. | Connected lace, planar meanders with ties, wave nets, perforated and auxetic cells. | State how paths stay connected and whether crossing passes create local thick spots. Unjoined lines/dots are not a free-standing fabric. |
| **M — Multiple flat layers** | A small, declared number of planar layers built on the bed. | Halftone nets, crossed waves, lace plus open backing, paired loops, fused pseudo-weaves. | Record count/order, backing coverage, colours, and bonded versus independent crossings. |
| **N — Shallow non-planar sheet** | Deliberate local Z modulation within a bed-based sheet. | Low crossing bridges, shallow corrugations, image-driven relief and texture. | Record total thickness, local rise, ramp slope, unsupported span and nozzle-body clearance. Excludes upright pillar/wall printing. |

These are **manufacturing classes**, separate from appearance. Halftoning can be M without Z texture. A level-sorted pseudo-weave with crossing ramps is M with an N crossing treatment. Kirigami buckling after printing does not make its deposition non-planar. A nominal single layer can have locally stacked intersections: document actual thickness rather than equating one layer with a constant-height surface.

Evidence labels used here are **direct process evidence** (a relevant sheet is fabricated), **transferable method** (a different process supplies geometry, representations or tests), and **design proposal** (an untested translation or combination). None validates FilaFabric's specific geometry/material without printed swatches.

## Candidate records for later library implementation

These are development records, not newly implemented presets. Existing-card mappings were checked against `docs/fabric-structures.md`, `src/engine/weave.js`, and `src/engine/svgdesign.js` on 23 October 2026. Extend an existing construction before adding a duplicate card.

### S1 — Connected planar lace

**Construction:** rings, petals, scallops or drawing lines joined into one planar net by shared segments or bonded necks. **Evidence:** Sun (59–60) and Sterman (58, PDF pp. 6–7) provide lace/panel precedents; Kalman (29, PDF pp. 5–8) supplies direct single-layer FDM context. A one-layer version of those decorative lace designs is a **proposal**. **Existing home:** Drawing & Infill without backing; planar Bubbles/Coil/Voronoi variants require connectivity checks first. **Controls:** motif scale, neck width, overlap, open fraction and edge finish. **Gate:** the swatch releases as one sheet, without isolated islands or unjoined rows; inspect tears and snagging at motif joins.

### S2 — Flat raster and wave nets

**Construction:** connected straight, sinusoidal, zigzag or multi-direction lines at one nominal height. **Direct evidence:** Kalman (29, PDF pp. 5–8) prints one 0.25 mm layer, with local intersection stacks. **Existing home:** Crosshatch & Isogrid and Squiggle & Gyroid currently use multiple layers; single-layer modes would need explicit implementation checks. **Controls:** pitch, angle set, wave amplitude/wavelength, gauge and boundary ties. **Gate:** inspect intersection mounds and dragging, connectivity and directional drape. Retain an unmodulated straight-net control before adding an image.

*Added 24 October 2026.*
- **Direction sets:** offer Kalman's isogrid sets by name, π/m for m = 2–6 (0/90; 0/±60; 0/±45/90; 0/±36/±72; 0/±30/±60/90).
- **Crossing height:** in a nominal single layer each crossing stacks m strands in print order, so report maximum crossing height as m × strand height.
- **Symmetry class** (Schumacher 2018, 54): a 0/90 grid is *tetragonal* (soft on the bias); π/3, π/6 and kagome are in-plane *isotropic*.
- **Drape:** at low density, align directions with the intended drape or load axes deliberately. At high density, mass dominates (29).
- **Same-layer crossings:** Diak & Diak (9) warn that printing both directions in one layer breaks strand continuity at each crossing. Compare a true two-pass version against the settled single-height version.
- **Wavy instead of straight:** for stretch, prefer wave or zigzag lines. Steinmetz & Ehrmann (57) built their patterns on elastic fabric (waves and a Fibonacci spiral) without linear parts, so the fabric could extend without stretching the polymer.

### S3 — Meanders and loops with sparse ties

**Construction proposal:** connect planar serpentine, looped or space-filling paths using selected in-plane ties instead of a full second hatch. **Evidence:** Kabir (25), Schumacher (54) and Sterman (58) offer loop/network or flat-toolpath context, not this exact route. Kabir's knit courses require assembly; they are not tall pile. **Existing home:** Meander and Coil; Meander currently uses backing. **Controls:** bend radius, loop aspect ratio, tie location/interval and gap. **Gate:** attached regions after release, open apertures, extension and cyclic set. A long continuous path alone need not hold its two-dimensional shape.

### S4 — Auxetic and slit-sheet variants

**Construction:** re-entrant, rotating-unit, floral or compliant-hinge cells, or kirigami-like openings in a thin deposited sheet. **Evidence:** Kabir (24, 26–27), Nakajima (48), and Konaković (34, sheet/computational transfer); their specimens are not all single-layer. **Existing home:** Auxetic Mesh. **Controls:** cell dimensions, arm angle, hinge width, slit-end radius and perimeter restraint. **Gate:** measure transverse strain and recovery; inspect hinge failure and buckling. A filled slit sheet differs from an open strand net even where outlines resemble each other.

*Added 24 October 2026: concrete variants with their published controls.*
- **Re-entrant star and floral** (Kabir 26/27; one dataset): set the angle between the centre-facing arm and the unit's corner-to-corner boundary. Show arm length too, because it grows with angle (star 5.94–6.73 mm, floral 7.84–8.79 mm at a 0.6 in diagonal). Use 10° comparison steps.
- **Rotating-triangle hexagon** (Chen 6, Konaković 34): inclination θ within ±π/6, thickness ratio t/l, hinge width. Fully open, the linkage *is* the kagome lattice, a good pairing with S2. Edge vertices add freedom, so add a border band.
- **Rotating squares and triangles** (Shajoo 55): Shajoo printed ABS squares or triangles over a PLA first layer on slit, pre-stretched knit, with the fabric as the hinge. Proposed single-material FilaFabric version: polygons joined only at corners by short TPU necks. Fillet the corners, where Shajoo's 3 × 3 square version delaminated under repeated loading.
- **Nodule-and-fibril net** (named in Kabir 2025's review, primaries not held): thick nodes joined by thin angled fibrils.
- **Arrowhead band with side rails** (Ariel 1): band width, cell size, hinge angle, rail width. Related precedent: Spahiu et al. 2020's arrowhead-shaped auxetic dress in FilaFlex (Shore A82, 130 × 130 mm per Jayswal-Adanur, 23; arrowhead and Filaflex also per Manaia, 43). Brad (5) cites the same dress without naming the shape.
- **Kirigami slit sheet** (Nakajima 48): minimum printable slit about 1 mm at a 0.4 mm nozzle. Best h/i was about 0.2–0.32 depending on layup, and alternating 90/0 passes gave the most robust result.
- **Drape by geometry** (Kabir 2022, 24): in this review's visual reading of the paper's Fig. 1, convoluted, long-ligament cells (floral, curly) draped most, and geometries with continuous straight or gently curved lines spanning many cells draped least. The authors give only sample numbers, so this is an interpretation to test.

### S5 — Four-arm spiral cells

**Construction proposal:** repeat connected compliant spiral arms to form a flat lace-like lattice. **Evidence:** FlexMaps (42) provides four-arm Archimedean spiral geometry, winding angle, scale and arm-width controls; its PolyJet/laser-cut sheets do not establish thin FDM performance. **Existing home:** a new cellular variant, rather than equating it with a decorative Spirograph curve. **Controls:** arm width, winding, handedness, node spacing, thickness and edge cells. **Gate:** continuous junctions, minimum gaps through the full winding, directional bending and neck fatigue. Preserve the paper's mechanism while validating a thinner deposited version.

*Added 24 October 2026: exact geometry* (42, p. 6). One arm is $x(t) = r(t)\cos(t\varphi)$, $y(t) = r(t)\sin(t\varphi)$ with $r(t) = 0.5\,s\,(1-t)$ for $t \in [0,1]$; the other three arms are rotated 90°, 180° and 270°. Neighbouring cells join at the midpoints of their shared edges. Scale $s$ follows pitch; twist $\varphi$ and arm width $w$ are the user controls and can be graded across a panel. Keep cells at least about 10 mm across at first (the paper's robustness floor) and check the gap between windings against the actual bead width. On an average deformed spiral, 99% of the material stays within about ±0.5% strain while the sheet deforms by arm bending, which is why the geometry may suit soft TPU.

### S6 — Directional stochastic net (new, 24 October 2026)

**Construction:** jittered nodes, one per virtual grid cell, each connected to its *k* nearest neighbours under a locally stretched metric $M = E^\top \mathrm{diag}(H^{-2}) E$ (Martínez 2017, 45). Longer edges appear along the stretch direction, so the sheet is stiffer that way. **Evidence:** 45 printed 2D versions of these graphs one extrusion wide in SemiFlex (3.2 mm thick). Its tests found the stretch ratio sets the stiffness ratio and node density sets magnitude; *k* shifts stiffness without widening the property range. **Generation rule:** seed nodes deterministically from each grid cell's coordinates (Martínez 2016, 44), so the net regenerates identically when resized, cropped or tiled; density can follow a picture through the subdivision rule. **Existing home:** a sibling of Voronoi Lace and Flow Lines. **Controls:** node density, k, stretch ratio, orientation field (garment grain, flow field or picture), strand width. **Gate:** remove nodes isolated by clipping, add a border strand, and test stiffness along and across the orientation field. A one-layer version is untested; the source used thick sheets.

### S7 — Star-metric curved-cell lattice and isohedral tilings (new, 24 October 2026)

**Construction:** Voronoi cells on a lattice, grown under a star-shaped distance $d_S(p,q) = \lVert q-p\rVert / f(\angle(q-p))$ whose radial span $f$ is set by a few control spans (Martínez 2019, 46). **Symmetry rule** (46, 54): metric and lattice symmetry fix the material class. Three- or six-fold patterns are in-plane isotropic, one-axis reflection gives orthotropic, and 4-fold gives tetragonal. Triangular lattices with 3-fold metrics produced *isotropic* sheets with Poisson's ratio from −0.47 to 0.99, auxetic and non-auxetic in one family. **Tilings:** Schumacher 2018 (54) builds its sheets from isohedral tilings, which fall into 93 families (it tests structures from IH02, IH07, IH21 and IH29). FlexScale (47) generates its tessellations with the *Tactile* library (JavaScript, isohedral.ca; check the licence), a parametric source of tileable cell outlines. **Existing home:** Star Lattice and Voronoi Lace. **Controls:** lattice (triangular, honeycomb, diagonal square), symmetry, 3–7 radial spans (a "petal shape" editor), polygonal or smooth outline, wall width. **Gate:** a connected network after clipping (the growth model guarantees that each cell is connected, not that the whole network is); compare behaviour along 0°, 45° and 90° against the predicted class. Linear blending between two metrics can change mechanics abruptly, so prefer per-site assignment for zone boundaries.

### M1 — Lace plus open printed backing

**Construction:** decorative drawing/lace followed by one open backing layer, optionally a second at another angle. **Evidence:** Sterman (58) supports lace and layered toolpath practice; Sun (59–60) supplies garment-design context, not this exact backing recipe. **Existing home:** Drawing & Infill already implements drawing plus backing over the swatch, shapes or drawing box. **Controls:** motif and backing pitch, backing angle/count/area, overlap and border. **Gate:** each decorative island intersects its carrier; layers bond without closing intended holes; document image face and actual thickness. A printed backing differs from printing onto conventional cloth, which needs its own substrate category.

### M2 — Calibrated two-colour halftone net

**Construction:** two continuous overlapping planar path layers; image tone sets their relative visible widths. **Direct evidence:** Gispan (17, PDF pp. 5–11; June 2026 preprint) compares orthogonal, diagonal, chevron and curvilinear nets. **Existing home:** Halftone Net; assess its current straight/wave/zigzag modes before adding duplicates. **Controls:** pitch/grid, image coordinates, tone curve, width range, colour order and calibrated flow/speed. **Gate:** tone wedges and abrupt transitions print continuously; measure width separately on the bed and over another net. Complementary brightness values alone do not guarantee complementary visible colour because the upper line occludes the lower. Visual fidelity and mechanical response need separate evaluation.

*Added 24 October 2026 (17, 15, 40).*
- **Width maps:** keep separate maps for lines on the bed and lines over the other net. At the same E-factor, bed lines measured 0.44–1.25 mm and over-net lines 0.41–1.05 mm.
- **Drive width by extrusion, not speed:** extrusion per millimetre dominated width; feed rate changed it by only about 0.01–0.10 mm.
- **Nozzle height:** Gispan used 0.2 mm for the first layer and 0.4 mm for the second.
- **Limit step changes** in speed and extrusion between neighbouring cells. The speed-prioritized strategy failed three times, mostly at abrupt fast-to-slow, high-to-low-E-factor transitions, and its abrupt transitions also reduced image accuracy.
- **Cheap calibration:** print test lines onto paper, both bare and pre-covered with perpendicular lines; discard the first group as start-up transient; measure three probes per line from a scan.
- **Tone wedge:** borrow Lloyd-Taylor's anchor-and-interval method (40). Lloyd-Taylor mixed two print pastes at mass ratios of 1:0, 9:1, 8:1, 3:1, 1:1, 1:3 and 0:1 between calibrated anchors. The FilaFabric analogue is a set of stepped width ratios, each measured, interpolating only between measured anchors.
- **Optical mixing** (Gaston, 15): state the viewing distance; muted pairs blend better; saturated reds and oranges dominate; similar colours read as stripes rather than a mix.
- **Garment extras** (17): per-panel placement images, a reinforced contour band, and local solid zones for fasteners and lacing.

### M3 — Fused pseudo-weave from a draft

**Construction:** convert plain/twill/basket/satin/herringbone/diamond/irregular drafts into lower and upper pieces and print by height. **Evidence:** Gelosi & Devendorf (16) and Wu (64) supply draft representations; their loom results are method transfer. Jayswal's plain/twill specimens (22) were printed upright, so that fabrication route is excluded. **Existing home:** Weave already offers eight bindings and ramped segmented transitions; class M with N crossing treatment. **Controls:** draft, pitch, float length, ramp envelope, border and piece count. **Gate:** periodic draft, reachable print order, sound mid-gap joins and bounded unsupported floats. Record fused crossings; do not call this a free-sliding weave. Parquet's crossed blocks are a separate construction.

*Added 24 October 2026.*
- **Generate drafts like a shaft loom** (LOOMING, 39): a short threading × tie-up × treadling triple produces whole binding families (plain, twills, point/herringbone, blocks). Because LOOMING lets the threading change, weavers explored drifting a block draft, which the authors say was almost impossible on shaft looms.
- **Draft as chainable operations** (AdaCAD, 8, 16): each operation takes a draft and parameters and returns a new draft, which the authors compare to a guitar pedal. A twill is a row sequence that shifts one unit per row. Gelosi & Devendorf (16) add a *cross-section* operation that shows layer structure and colour interaction better than the top view.
- **Stencil constructions with an index image** (Weavecraft, 64): each pixel picks which block to use. Each block is tiled to the stencil's size, and corresponding stacks must have matching numbers of warps and wefts. This matches FilaFabric's whole-repeat rule.
- **Binary picture from which strand is on top** (Takahashi & Kim, 61): a jacquard-style woven image.
- **Flaps need a returning binding pass** (16): a loop bound on only one side peels.
- **Separation clearance** (Jayswal, 22): in an upright-printed PLA 2/1 twill with 1 mm yarns, a 0.5 mm designed gap left the yarns stuck together; 0.65 mm let them be separated by hand. That is too much clearance for a thin sheet, which supports treating planar crossings as fused.

### M4 — Paired loops and staggered lace

**Construction proposal:** offset flat loop rows in two planes, connected at chosen overlaps. **Evidence:** Kabir (25) provides assembled knit tensile context; Beecroft (3–4) provides independent SLS loop geometry; Lee (37–38) supplies exploratory networks. **Existing home:** Coil, Bouclé & Picots, Ring Mail or Squiggle geometry. **Controls:** loop aspect ratio/radius, offset, overlap and anchor spacing. **Gate:** distinguish bonded loop lattices from independent stitches, check roots and open holes, and test peeling/extension/recovery. Overlapping rings alone do not establish mobile chain mail.

### M5 — Graded directional cellular sheets

**Construction:** vary cell size, orientation or width within a connected network. **Evidence:** Gispan (17) for images; Martínez (45–46), FlexMaps (42), and Schumacher (54) for property-aware geometry. Martínez (45) includes planar 3.2 mm FDM coupons; Schumacher (54) prints 1.2 mm NinjaFlex network sheets. These are valuable planar precedents, not single-layer textile recipes. **Existing home:** Voronoi Lace, Flow Lines, Conformal Mesh, Meander and Halftone Net. **Controls:** orientation field, pitch range, transition length, gauge and seed. **Gate:** inspect necks and connectivity through gradients. Image appearance, porosity and mechanical grading are separate objectives.

### M6 — Step, ripple and petal lace over a carrier

**Construction:** a flat decorative path is joined by an open second path family. **Direct/adjacent evidence:** Diak (10, PDF pp. 5–10) distinguishes single-layer waves/meanders and two-layer line-plus-step/hexagon constructions. Lee (37–38) provides exploratory ripple and radial-petal textile designs, without a standardized mechanics dataset. **Existing home:** Drawing & Infill for motif plus backing, and Squiggle/Crosshatch for repeated path families. **Controls:** step/ripple wavelength, turn rounding, petal count, carrier pitch/angle and bond frequency. **Gate:** inspect corner rounding, unsupported spans, bonds and motif connectivity. A two-layer fused translation of a visual precedent must be identified as a proposal where the source's fabrication or topology differs.

*Added 24 October 2026: Diak's five tested models* (10, Tables 3–4, 67 × 10 mm; PLA/PA6, 0.26–0.36 mm thick, 174–258 g/m², 23.8–44.5 N):

| Model | Layers | Construction |
|---|---|---|
| Mesh/Net | 2 | straight lines bonded at some crossings |
| Wave | 1 | single-layer waves |
| Line/Hexagon | 2 | straight lines, with a hexagon network on top |
| Line/Step | 2 | straight lines tied together by a second-layer zigzag "step" |
| Line/Meander | 1 | single-layer meander |

Line/Step and Line/Hexagon are explicit cases of *a second pass chosen to tie down free first-pass lines*, the carrier role in FilaFabric's grouping. Related ideas:
- a weft-loop motif (Drews' account of Collingwood, 11);
- a ripple lace with seam allowances that vary with curvature (Lee 37: 0.25 in on curved seams, 0.5 in on straighter ones);
- grouped-unit sampling, printing one motif in several arrangements on one test sheet before choosing (Sun 60).

### M7 — Moiré interference net (new, 24 October 2026)

**Construction:** two path families with slightly different pitch (for example 2.0 and 2.1 mm) or angle (0° and 3°). Their overlap produces large interference bands, or an image if one family's pitch or phase is modulated. **Evidence:** three independent mentions, none measured. Polymaker and Covestro's fabric design software lets users create moiré patterns (Manaia, 43); a student apron made a hamster image by moiré (Sterman, 58); Takahashi & Kim say a moiré-like stripe pattern can be obtained by fine-tuning pillar spacing (61). **Existing home:** any two-family net (Squiggle, Crosshatch, Halftone Net) with a per-family pitch or angle offset. **Controls:** pitch difference, angle difference, phase modulation, colours. **Gate:** the bonded-crossing density varies with the moiré period, so check that the sparsest band still holds together. The pattern is optical and also changes mechanics locally.

### M8 — Scales on a continuous carrier (new, 24 October 2026)

**Construction:** a thin continuous carrier with an array of raised tiles on top, each tile inset from its neighbours by a constant gap. **Evidence:** FlexScale (47) on a Prusa MK3S+: a 0.4 mm NinjaFlex 85A substrate, 4 mm PETG scales, a 0.4 mm gap, 0.1 mm layers and an interlocking groove at each scale base. Contact between scales stiffens bending in a direction-dependent way. **Existing home:** new. Tile outlines could come from Star Lattice, Truchet or isohedral tilings (S7). **Controls:** tile family, pitch, gap, scale height, scale material, carrier thickness. **Gate:** a single-material, shallower N version is unproven, and lowering scale height delays contact. Test bending in both directions, because the paper found opening and closing differ. Taller versions sit outside the shallow-texture brief.

### M9 — Bond masks and release zones (new, 24 October 2026)

**Construction:** chosen regions or crossings deliberately left **unbonded**, so stacked passes or crossing strands can slide or separate there. **Evidence and leads:**
- Pattinson et al. 2019, cited in Sitotaw (56) and not held: printed meshes where the toolpath lets the strand cool before it touches the earlier strand in chosen areas, so those strands are not connected, slide, and give noticeably more drape.
- Li et al., cited in Sapkota (52), not held: one strand printed flat and the other laid over it with the print head slightly raised, forming an arc-shaped channel that lets the strands move without direct attachment. All-sliding grids were very flexible; all-fused grids were stiffer and quasi-isotropic.
- Takahashi & Kim (61): fibre-to-pillar adhesion varied with print speed and wave amplitude (an upright pillar build).
- Release layers: Loh & Pei used tape on the polymer before an inserted layer (41); a Sterman student placed a separator during a pause (58); Wang's stacked chain-mail layers were deliberately unlinked to stay flexible (63).

**Existing home:** a crossing-treatment option on two-family nets and Weave. **Controls:** bond pattern (all fused, alternate, zone-only), lift height or cool-down delay, mask image. **Gate:** confirm that masked crossings actually move after printing; inspect sag, stringing and snagging; compare drape and stretch against an all-fused control. Retrieve Pattinson et al. and Li et al. before choosing settings.

### N1 — Low crossing bridges and dipped strands

**Construction:** strands rise locally over earlier paths and return to the sheet envelope. **Existing home:** Dip Weave and Weave's ramps. **Method transfer:** Takahashi & Kim (61) contributes sequencing/clearance lessons; its upright pillar-and-drawn-fibre architecture is excluded. **Controls:** rise, ramp length, span, crossing angle and support position. **Gate:** inspect touchdown and snagging; check support/bed clearance and the whole nozzle body around previously deposited paths. A weft deposited after all warps crosses over all of them even if it dips between: it does not become alternating independent yarn interlace.

*Added 24 October 2026.*
- **Sliding crossing:** a local arch over each crossing, sized from bead height plus clearance, so the upper strand bridges without fusing (Li et al., via 52). This is the bed-flat route to non-fused crossings; see M9.
- **Filleted up/down strand:** Kim & Lee (31) modelled each crossing strand as a filleted zigzag whose crossing height is line thickness plus half its radius.
- **Bridges may be stiff:** Laput (36) found strands made by bridging between two supports fairly rigid, "more bristle-like than hair-like", compared with its own drawn hairs. A raised FilaFabric span may likewise be stiffer than expected; measure it.
- **Print-order graph for lifts:** any raised path must be printed before a nearby lower path whose nozzle-body clearance it would block. Wu (64, chapter 3) orders edges with a collision graph that must be acyclic. For a cycle, Wu suggests splitting edges into smaller pieces but did not implement it.
- **Crossing quality metric:** report mean and maximum crossing-angle deviation from 90° for field-aligned nets (Guo, 18).

### N2 — Shallow corrugation and tactile relief

**Construction proposal:** a bed-based row/net with small smooth Z modulation producing low ridges or waves. **Existing home:** low-amplitude Relief experiments. **References:** Sterman (58) for toolpath exploration and Nozzle Boss below for editable paths, neither a verified shallow-TPU recipe. **Controls:** rise, wavelength, phase, slope, support spacing and maximum total height. **Gate:** compare with a printed flat control; check support beneath crests, continuity and drape. Reducing a tall loop's height does not by itself make the route printable.

### N3 — Colour exposure through shallow texture

**Construction proposal:** two coloured path families with bounded local height/phase changes that alter visible exposure while retaining an open sheet. **Evidence:** Gispan (17) supports M2, not this extension. The meditat workflow supplied by Luis is a separate lead pending the exact fork/node files. **Controls:** exposure area, phase, gauge, colour order, Z envelope and backing. **Gate:** compare tone wedges against M2 at a fixed thickness budget; photograph front/back and several viewing angles; ensure no detached colour dots. Develop after M2/N1 because optical changes may increase bonding, thickness and stiffness.

## Nozzle Boss and Blender halftone research

### Verified upstream functionality

Heinz Loepmeier's upstream Nozzle Boss imports G-code into a Blender mesh and re-exports modified paths. Its README documents vertex Flow/Speed maps, Tool-command text blocks and planar editing with Z locked. It lists relative extrusion and firmware-retraction limitations. This establishes an editing precedent, not a verified full-colour textile-halftone implementation. [Upstream repository](https://github.com/Heinz-Loepmeier/nozzleboss), accessed 23 October 2026.

The upstream wiki describes subdivision, vertex-based flow/speed control, and export units: UI speeds use mm/s while G-code feed rates use mm/min. Upright mesh polygons encode layer height; their upper edge is the actual nozzle path. This representation does not require upright fabric printing. Fine subdivision increases data density and may strain motion processing. [Upstream wiki](https://github.com/Heinz-Loepmeier/nozzleboss/wiki), accessed 23 October 2026.

### The meditat workflow supplied by Luis

Luis supplied a custom-fork/Geometry-Nodes full-colour halftone workflow and a tutorial reportedly dated 12 October 2026. **The exact fork, node-group version and creator-hosted files were not independently retrieved.** Keep these as a research lead. Verify its subdivision, dot counts, layer heights, speeds, UV-map name, single-change-per-layer claim and separated-STL route against the actual files before adopting them. They are not FilaFabric defaults. Attribute upstream Nozzle Boss to Heinz Loepmeier and the supplied fork workflow separately.

### Proposed translation to a textile sheet

1. Generate a connected S/M net with stable strand IDs and a declared thickness budget. Sample the image in sheet coordinates; a textured upright 3D model is unnecessary for this experiment.
2. Keep geometry, image sampling and the measured process lookup separate so the same image can be compared on several grids.
3. Start with M2 calibrated line widths per colour layer. Compare with constant-width controls before introducing dots or Z displacement.
4. Attach dot-like marks to a carrier/backing; isolated deposits cannot form a self-supporting textile. Record any extra layer cost.
5. Add N only after support, clearance, ramp slope and flow limits can be checked along the whole path; recalculate extrusion after geometry changes.
6. Schedule actual tool/filament commands, compatible start/end code and extrusion modes. Count changes from emitted commands: multiple colours in a layer may require several changes. Purging and tool-change costs depend on the machine.

Separate optical colour-area halftoning, flow/speed texture, XY wave/phase texture and Z relief as future controls. Halftone does not require non-planar printing, and non-planar texture does not establish tonal accuracy. Use the local Gispan paper as the primary textile reference for the first two-colour sheet experiment.

## Implementation order and swatch evidence

| Stage | Later development | Evidence before promotion |
|---|---|---|
| 1 | S1/S2 flat controls, M1 lace/backing, M2 halftone calibration, M7 moiré (cheap, uses existing two-family nets). Reuse existing cards. | Connected releasable sheets; measured width/height; bed and over-net calibration. |
| 2 | S3–S7 cells/ties and new cell families, M3 bindings, M4 loops, M5 gradients, M6 tie-down constructions. | Correct repeats/order, bonded/mobile crossing status, float limits, directional extension and peeling; symmetry class confirmed by 0°/45°/90° tests. |
| 3 | M8 scales, M9 bond masks (after retrieving Pattinson and Li), N1 crossing lifts, N2 texture, then N3 colour-exposure trials. | Printed support, clearance, actual Z envelope, ramp continuity, verified sliding where claimed, and comparison with flat controls. |

Each candidate should retain: stable ID, class and crossing treatment, source/page locators, evidence type, existing-card mapping, repeat, path order/connectivity, colours/tools, material/profile, nominal layers, measured thickness, local rise/slope/span, width/pitch limits, edge treatment and validation state. These are proposed documentation fields, not an existing engine schema.

For comparison swatches use equal outside dimensions and the same material batch; record areal mass and actual strand geometry rather than assuming equal infill percentages are equivalent. Photograph both faces flat and on the same drape support. Measure low-force extension in both axes/on the bias, unloading, recovery and repeated-cycle damage. For images include tone wedges, flat-tone regions and sharp transitions under recorded lighting/background/camera conditions. For lace inspect joins/bridges/edges after removal; for N measure height and nozzle dragging. Rendered appearance alone cannot establish drape, wear comfort or strength.

*Added 24 October 2026: measurement details from the second pass.*
- **Drape geometry:** drape coefficients compare only at the same specimen-to-support ratio. Cusick-style tests use a 30 cm disc on an 18 cm support (35), which allows comparison with the reference fabrics there (thin loose knit 14%, silk pongé 54%, poplin 68%, organza 92%, heavy twill 95%). Kalman (29) used 10 cm discs with 1.5 g bolt-and-nut perimeter weights and photographed 12 views at 30° steps; Kabir (24) used 200 mm discs on an 81 mm stand. Report drape mode as (convex, concave) pleat counts alongside DC.
- **Textile-likeness screen** (Diak, 10): areal density, deflection under self-weight above 2 cm for a 10 × 1 cm strip, at least 100 full bend–unbend cycles to 180°, and tensile strength above 1 MPa for cross-sections under 1 mm². These are the authors' proposal, not a standard.
- **Cycling:** report the first conditioning cycles separately (20, 45), and fit linear stiffness only on the initial range (45 used the first 0.5 mm).
- **Faces and states:** record which face was on the bed (the bed side measured stiffer in 31), shrinkage or edge curl after release (65 saw both as its bacterial-cellulose prints dried), and, for thin sheets, out-of-plane buckling during tension (48).
- **Construction record:** list the ordered stack at each crossing type (family on top, fused or separated), as in Weavecraft's stack notation (64).

## Edge, joining and handling details

Added 24 October 2026. These are construction details at panel scale, not new nets. Each is a proposal drawn from the cited garment or process source.

| Detail | Source | FilaFabric translation |
|---|---|---|
| Side rails on an auxetic band | Ariel & Sterman (1) | Continuous outline rails anchor every cell end and stop edge fraying. |
| Sacrificial handling frame | Ariel & Sterman (1) | A thin border joined to the piece keeps it flat while peeling from the bed and gives a cutting or bonding register; trim it afterwards. |
| Reinforced contour band | Gispan (17) | A denser band along the panel outline for sewing or fusion. Cui & Sun (7) and Sun (59) sewed printed pieces into fabric with ordinary techniques but describe no edge band. |
| Seam allowance by curvature | Lee et al. (37) | About 0.25 in on tightly curved seams and 0.5 in on straighter ones. |
| Overprinted zigzag seam | Sterman (58) | Print a zigzag stitch path across two placed panels to join them; same material, so recyclable. |
| Thermal or pen fusion | Gispan (17), Sterman (58), Spahiu (via 23, 52) | Iron through baking paper, nozzle or soldering-iron welds, or a 3D pen. |
| Flap-and-notch and loop interlock | Sterman (58, 11 projects) | Printed tabs and slots, or interlocking loop arrays, as mechanical seams. |
| Colour-coded dovetail connectors | FlexMaps (42) | Keyed edge connectors with a grip tolerance for multi-panel assembly. |
| Rigid tabs inside a fine mesh | Diak & Diak (9), DefeXtiles (14) | Solid pads for fasteners, labels or electrodes, printed in the same job. |
| Whole repeats per region | Janssen & McQuillan (21), Wu (64) | Every region holds complete repeats; neighbouring regions need commensurate pitches. |
| Border band at floppy edges | Konaković (34), Martínez (44) | Close edge cells, where degree-2 boundary nodes add freedom, with a border strand. |

## Design rules distilled from the sources

Added 24 October 2026. These are hypotheses to adopt as defaults or warnings, each tied to its evidence. None is validated on Foamy TPU.

1. **No straight segments where stretch is wanted.** Steinmetz & Ehrmann (57) built every pattern from curves so it could extend "without stretching of the polymer". Schumacher 2018 (54) found straighter paths gave a stretching-dominated response up to three times stiffer, and in this review's visual reading Kabir 2022's least drapable geometries contained long straight lines (24).
2. **No point-only contacts.** Elements touching at a single point are weak joins (the anti-checkerboard term in Schumacher 2015, 53). Require a minimum overlap or neck width at every intended bond.
3. **Symmetry sets isotropy.** 3- or 6-fold patterns are isotropic in-plane, 4-fold are tetragonal (soft on the bias), and single-mirror patterns are orthotropic (54, 46). Panetta's measure $A = 2(1+\nu)G/E$ (51) quantifies the departure from isotropy.
4. **Alternate directions between passes.** Crossed (0/90) layups kept material aligned with the load everywhere and gave the lowest scatter (Nakajima, 48).
5. **Avoid printing both directions in one layer** where strand continuity matters (Diak 2024, 9). Report actual crossing height: m strands at an m-direction crossing (Kalman, 29).
6. **Layer budget:** keep total thickness below about 0.5 mm, with at most about 3 layers below 150 µm height, 5 below 100 µm and 7 below 50 µm (Diak 2024, 9, author guidance).
7. **Smallest features:** about 1 mm minimum printable slit or opening at a 0.4 mm nozzle (48). Hexagon holes down to about 0.8 mm were printed in PLA, with defects documented (10). Effective line width is at least 1.2× the nozzle (10).
8. **Grade by density, not by thinning** (44). Keep strand width at a reliably printable value and change cell size or pitch. Blend graded cells continuously and keep neighbouring edges coincident (6, 53).
9. **Seed deterministically** per grid cell, so stochastic nets regenerate identically (44, 45).
10. **Limit parameter jumps:** abrupt speed or extrusion changes caused flexible-filament failures and image errors (17).
11. **Separate image channels for separate controls** (Cilllia, 49): one physical parameter per channel; density set by sampling interval.
12. **Interrupt long straight load paths and lengthen ligaments** to increase drape (24, interpretation). Expect strain stiffening once strands straighten (54).

## Process settings reported by the sources

Added 24 October 2026. These are the authors' own machines and materials, listed for orientation only. They are **not FilaFabric defaults**, and none was tested with Foamy.

| Source | Printer / nozzle | Material | Temp nozzle / bed | Speed | Layer | Notes |
|---|---|---|---|---|---|---|
| Kalman (29) | ADIMLab, direct drive, 0.4 | TPU 91A | 220 / 50 °C | 900 mm/min | 0.25 | single-layer isogrids |
| Kabir 2025 (27) | direct drive, 0.4 | TPU | 220 / 60 °C | — | 0.2 | 0.4 mm-thick nets |
| Gispan (17) | Prusa XL, 0.4 | TPU 95A | — | 750–2,550 mm/min | Z 0.2 / 0.4 | width by E-factor 5–23 |
| Nakajima (48) | Creality CR-10S, 0.4 | TPU | 230 / 70 °C | 288 mm/min (≈5 mm/s) | 0.25 | jammed at ≥432 mm/min |
| Kim & Lee (31) | Cubicon (fixed bed), 0.4 | eSun TPU 95A | 230 / 65 or 80 °C | 30 mm/s | 0.2 | below 220 °C no smooth flow |
| Özev & Ehrmann (50) | Anycubic i3 Mega S, 0.4 | TPU 95A | 230 / 70 °C | 20 mm/s | 0.2 | ±45° layers |
| Steinmetz & Ehrmann (57) | Creality CR-10 V2, 0.4 | Filaflex 82A | 230 °C / room temp. | — | 0.1 | on fabric; 1.5 × 1.5 mm lines |
| FlexScale (47) | Prusa MK3S+, 0.4 | NinjaFlex 85A carrier | — | — | 0.1 | 0.4 mm carrier, 0.4 mm gaps |
| Schumacher 2018 (54) | Ultimaker 2 + Flex3Drive | NinjaFlex | — | — | — | 1.2 mm sheets; base E 15.5 MPa |
| Martínez 2019 (46) | Ultimaker 3 | NinjaFlex 85A | — | — | — | 3 mm coupons |
| Martínez 2017 (45) | Ultimaker 2+, 0.25 | SemiFlex | — | — | — | beams one extrusion wide |
| DefeXtiles (14) | Prusa i3 MK3S, 0.4 | TPU | 220 / 50 °C | 1,250 mm/min | 0.2 | extrusion multiplier 0.30; upright, excluded |
| Diak 2024 (9) | — | TPU (advice) | ±5 °C window | <15 mm/s | — | direct drive, low jerk |
| Loh & Pei (41) | Prusa i3 MK3, 0.4 | PLA | 215 / 60 °C | 20 mm/s first layer | 0.2 / 0.1 | Live-Z only +0.005 mm with mesh inserted |

Patterns across the TPU rows: about 220–240 °C, slow speeds (5–30 mm/s), direct drive, and 0.1–0.25 mm layers. Faster speeds jammed or under-melted, and the slowest dripped (48).

## Scope and how to use this catalogue

This catalogue focuses on **patterns made by depositing soft/flexible material as textile-like paths**. It is not a catalogue of every technology sometimes called a 3D-printed textile. In particular, it does not treat rigid linked rings, rigid interlocking particles, slit sheet, or prints bonded onto conventional cloth as equivalent to FilaFabric's free-standing soft-filament structures. Those works can offer useful ideas, but their mechanics are different.

The catalogue has two related inventories:

1. **The FilaFabric library:** the 31 named structures/cards currently listed in the project README (32 tiles when the Advanced Zigzag Mesh preset is counted). Their path descriptions below follow the project's `docs/fabric-structures.md`; they are design descriptions, **not claims about measured physical behavior**.
2. **Research design families:** structures and methods described across the 65 collected papers. A paper may call a geometry “knit,” “woven,” or “fabric” even when it is a different topology or made using SLS, a loom, laser cutting, or a conveyor printer. Such a name alone does not make its measurements transferable.

**Physical-validation status matters:** older project documentation says the structures had not yet been printed. Luis has since reported poor Parquet printing and acceptable Bubbles construction; the new audit records those observations without inferring a universal cause or measured performance. Controlled FilaFabric-specific drape, stretch, recovery, durability and comfort results are still absent here. Research values below describe the authors' specimens and setups, not FilaFabric results.

## A useful vocabulary

- **Planar / flat path:** strands are deposited mainly in one plane or in ordinary flat layers. A single-layer open net can be flexible without being “non-planar.”
- **Layered 2.5D path:** a mostly planar design uses a small number of height levels, for example two crossed nets or lower and upper strands. This is still layer-based FDM, but the architecture can be open and fabric-like rather than a solid object.
- **Non-planar sheet path:** the nozzle deliberately changes height locally within a shallow bed-based sheet. Priorities here are small crossing lifts and texture; upright walls, tall pile and pillars are separate background processes.
- **Continuous path:** a strand remains connected through a long route, often reducing starts/stops. It can still have local lifts, crossings, and weak regions.
- **Topology:** how the paths connect and repeat (loops, cells, crossings, branches, or separate elements). Topology is distinct from material, strand thickness, and spacing.
- **Auxetic:** a structure with negative Poisson's ratio over a measured deformation range: when stretched in one direction, it expands in a transverse direction. This does not mean “soft” or “easy to stretch.”
- **Drape coefficient (DC):** in the cited circular-sample methods, the draped projected area divided by the undraped area, multiplied by 100. A higher DC means the sample remains more spread out and therefore drapes less in that specific test.

## Main families of soft-material printed textile designs

### A. Flat open nets and line grids

**Design idea:** one or more families of strands leave open spaces rather than filling a solid area. Flexibility may come from strand bending, cell rotation, and movement at intersections.

**Common forms and names:** zigzag/wave nets; orthogonal grid; diagonal grid; crosshatch; isogrid/triangular grid; kagome; chevron; curvilinear grid; raster/isogrid sheets; halftone nets.

**FilaFabric cards:** Zigzag Mesh, Advanced Zigzag Mesh, Squiggle & Gyroid, Crosshatch & Isogrid, Halftone Net. Drawing & Infill can also create open infill, although its imported drawing and optional backing layers make it a more general construction tool.

**Mechanical expectations to test:**
- A single family of parallel lines can be easy to bend across the strands but weak or highly extensible along them; an intersecting family can stabilize the sheet.
- Crossing angle, strand length between supports, line spacing, strand thickness, and whether crossings fuse can all change response.
- A second layer often adds thickness and crossing support, which may reduce bending compliance, but added cross-support can also prevent strand collapse. Do not infer a simple “two layers = twice as stiff” relation.
- Sparse lines can sag or break when they bridge long unsupported spans. Very tight spacing can increase material, contact, and local stiffness, and can create nozzle-clearance or extrusion problems.

**Paper evidence:** Diak & Diak (2024, 2025) discuss strand continuity, unsupported spans, effective line width, moisture, flow, and layer count as interacting printability factors. Their 2025 PLA/PA6 meshes were 0.26–0.36 mm thick, 174–258 g/m² and broke at 23.8–44.5 N. Their 2025 review/prototype work recommends reporting actual dimensions, mass per area, bending, and tensile behavior; its values are not universal. Kalman et al. (2021) measured DC from 21.9% to 91.5% across single-layer TPU isogrid/raster specimens and loading conditions. At low infill, pattern influenced drape; mass alone did not explain it. Gispan et al. (2026 preprint) compare orthogonal, diagonal, chevron, and curved grids for image-bearing two-colour nets; they found geometry changes the balance of image detail, stretch, and stability. Their Prusa XL/95A TPU calibration is not a FilaFabric recipe.

**Design tips:**
1. Choose the dominant direction of expected stretch and bending before choosing grid orientation.
2. For a fabric intended to deform in two directions, avoid assuming a 0/90 grid is balanced; compare diagonal, chevron, and curved variants with equal outer size and material mass.
3. Keep crossings connected, but treat a fused crossing as a local stiff point and possible tear initiator.
4. Test one-layer and two-layer versions separately. Record strand thickness and actual—not merely requested—spacing.
5. Report both areal mass and drape; equal mass does not guarantee equal drape.

### B. Auxetic and re-entrant cells

**Design idea:** cells open or rotate under tension so the structure expands transversely. Common mechanisms include re-entrant honeycombs, rotating units, bow-tie cells, and star/floral cells with angled arms.

**FilaFabric card:** Auxetic Mesh. Star Lattice is a separate tiling construction; the name “star” does not mean it has the same topology or mechanics as the paper's star-shaped Voronoi metrics or auxetic star cells.

**Useful relationship:** Poisson's ratio is commonly written as `nu = -epsilon_transverse / epsilon_axial` for small, approximately uniform strains. `nu < 0` indicates transverse expansion under axial extension. For large-deformation textile structures, the measured value can vary with strain and direction, so the test definition and strain interval must be reported.

**Mechanical expectations to test:**
- Unit-cell angle, re-entrant depth, arm length, hinge width, and cell aspect ratio can tune how easily cells open.
- Auxeticity is not the same as high stretchability: a strongly auxetic cell may require substantial force, have low maximum extension, or fail at hinges.
- A structure can have different response along two axes and may bend into a curved/synclastic shape as it expands.
- For garment use, recovery, repeated loading, local pressure, and seam/join behavior matter in addition to negative Poisson's ratio.

**Paper evidence:** Kabir et al. (2024, 2025) tested re-entrant/star-arm and floral auxetic TPU geometries. The two papers report **one dataset**: their statistics are identical, and the floral angles are relabelled by 45°. Within the tested angle ranges, larger centre-facing arm angles, which also mean longer arms, reduced force per unit extension at low loads, and breaking force did not differ significantly (n = 3). This is a narrow result for two designs, a small number of specimens and one process/material set-up, not a universal angle law. Shajoo et al. (2021) obtained negative-Poisson behavior in printed rotating-square/triangular frameworks attached to pre-stretched, slit elastic knit, but repeated loading caused delamination; the textile substrate and printed hinges are part of the mechanism. Chen et al. (2021) and Konakovic et al. (2016) are useful computational/sheet-material precedents, but their bistable or slit-sheet mechanisms are not FDM auxetic nets.

**Design tips:**
1. Change one cell parameter at a time and preserve connected paths and printable hinge thickness.
2. Measure axial and transverse strain together; an “auxetic” label needs a measured transverse response.
3. Plot force versus extension, not just the final elongation. Add unloading/recovery and repeated-cycle tests.
4. Check cell behavior in both principal directions and at the boundary; edge cells may be constrained differently from interior cells.
5. Do not use the term “auxetic” for a visually star-like pattern unless the deformation actually shows negative Poisson's ratio.

### C. Loops, knit-like paths, coils, and interlooping

**Design idea:** repeated loops can deform by rotating, opening, or changing shape. This differs from a grid whose straight strands simply bend between fused crossings.

**FilaFabric cards:** Loop Pile, Coil, Boucle & Picots, and some strand-shape options in Squiggle & Gyroid. These are not all knitted fabrics: for example, a raised anchored pile loop, a flat self-crossing coil, and a round picot ring have different load paths.

**Mechanical expectations to test:**
- Longer or more open loops may provide more geometric extension before the material itself stretches, but may also snag, collapse, or fail at loop roots.
- Thicker loop walls/strands can resist breakage but reduce articulation and increase mass.
- Loop structures are often directional: course and wale directions can have different extension and stiffness.
- Large extension at break is not the same as comfortable stretch or elastic recovery. A sample can stretch far and remain permanently deformed.

**Paper evidence:** Kabir et al. (2023) tested five FDM TPU knit-like structures assembled from continuous loops. Their 7 × 3 inch specimens were tested in the wale direction and reached approximately 229–339 mm elongation, with maximum forces around 80–118 N; traces showed an initial elastic region, nonlinear deformation, and later permanent deformation/failure. They did not test both directions or fatigue life. Beecroft's SLS PA12 studies model continuous knitted loops and show a fineness-versus-breakage trade-off; useful geometrically, but not a direct FDM material comparison. Takahashi & Kim (2019) also make textile-like strands, but their upright pillar-and-drawn-fibre architecture is a distinct family.

**Design tips:**
1. Draw and inspect a single loop route before filling a panel; identify where each loop is anchored and what holds it open.
2. Test course and wale (or horizontal/vertical) directions separately.
3. Include unload/recovery and cycle tests; note permanent set and where breaks start.
4. For raised loops/pile, record loop height and foot geometry independently from base-net spacing.
5. Compare open, overlapping, and dense coil states at equal specimen dimensions; do not compare only by appearance.

### D. Raised, non-planar, and multi-height paths — background and scope limits

Only shallow bed-based relief and crossing lifts are class N priorities for this brief. Tall loops, standing fringe, spacers, upright pillar weaving and DefeXtiles wall printing below are retained as comparison references.

**Design idea:** the strand deliberately leaves the bed or a lower layer and travels in Z, creating a loop, ridge, pile, relief, bridge, or free end. This is the family most distinct from conventional flat-layer textile nets.

**FilaFabric cards:** Loop Pile (base plus raised arches); Relief (rows with Z variation); Fringe (raised hair paths and free ends); Spacer Net (lower net, pillars, upper net); Pillar Weave (pillars with a serpentine strand locking around them); Boucle & Picots (raised rings); Coil and Dip Weave use local crossing lifts but are not the same as long non-planar spans.

**Mechanical expectations to test:**
- Raised height may increase loft, thickness, compressibility, or tactile texture, but can also make a sample easier to snag or permanently flatten.
- A long unsupported segment is more likely to sag than a short one. Loop length, height, curvature, strand gauge, anchoring-foot size, and spacing all matter.
- A 3D spacer can compress through pillar bending/buckling; its recovery and compression set are separate from in-plane drape.
- Raised features add Z motion, travel/collision risk, and potentially more starts/stops. Reliable path planning is part of the material behavior because an unprinted or dragged strand changes the structure.
- More height does not necessarily mean more in-plane flexibility. It may add soft loft in compression while making the base sheet no more extensible.

**Paper evidence:** Forman et al.'s DefeXtiles uses intentional under-extrusion to make a thin quasi-woven sheet of deposits and stretched connecting strands; it is a process-specific mechanism, not a normal dense mesh recipe. Laput et al. exploit stringing to create hair-like fibres, but strand diameter varies and the method is not a uniform sheet. Takahashi & Kim's pillar weave uses upright supports and drawn strands; their samples were flexible in the weft direction but vulnerable under warp bending, and the drawn fibres required careful calibration. Kalman et al.'s drape study shows that even a single flat layer can have a broad range of drape, so height is not required for textile-like response. The collected literature contains little standardized mechanical data for FilaFabric-style raised TPU loops specifically.

**Design tips:**
1. Start with short raised spans and small swatches; increase height only after the strand reliably rises, turns, and lands.
2. Separate base behavior from pile behavior: test the base alone, then add loops/fringe/relief.
3. Measure compression and recovery for pile/spacer structures, not only tensile stretch.
4. Inspect loop feet, tops, crossing lifts, and free ends for the first failure points.
5. For fringes, compare pull-out/snags and root strength; visual softness is not a durability test.
6. Treat any printer/material profile as unvalidated until the actual soft filament has been printed.

### E. Woven-like over/under path layouts

**Design idea:** paths appear to pass over and under one another. In a conventional loom, threads interlace while remaining distinct. In FDM, a deposited upper path cannot literally be placed beneath an already printed lower path; height sequencing typically creates a crossing where strands fuse or touch.

**FilaFabric cards:** Weave, Dip Weave, Pillar Weave, Parquet, and some Ring Mail-like layouts. The project's Weave card uses two height levels and prints lower pieces before upper pieces; it is an over/under *layout*, not yarn weaving with free-sliding intersections. Dip Weave uses a strand that rises over warp paths and returns toward the bed between them.

**Mechanical expectations to test:**
- Fused crossings transfer load and can stabilize a sheet but reduce the freedom for yarn-like sliding.
- Long floats between crossings may bend more easily but can snag, sag, or break.
- Binding (plain, twill, basket, satin, herringbone, etc.) changes float length and crossing frequency; it can change surface appearance and anisotropy, but the exact response depends on strand size and bonding.
- A visually woven pattern is not necessarily mechanically equivalent to woven cloth.

**Paper evidence:** Takahashi & Kim offer a true pillar-supported printed path architecture, but with raised supports and drawn strands. Guo et al.'s harmonic foliations are demonstrated using manually interlaced cut-paper strips; Harvey et al.'s volumetric weaving uses yarn/loom methods. Both inform path representation, not nozzle-fused FDM mechanics. Beecroft's loops are interlooped structures made with SLS, not an FDM over/under weave.

**Design tips:**
1. State plainly whether crossings are fused, separated, or merely represented at different heights.
2. Track crossing angle, lift height, number of lifts, and unsupported float length.
3. Check whether the pattern can peel apart between layers or instead becomes a stiff bonded sheet.
4. Compare bindings at constant strand dimensions and areal mass where possible.

#### Woven bindings worth translating into nozzle paths

These are **candidate path patterns** from conventional weaving, not evidence that an FDM version will have the same handle or mechanical properties. A weave draft can be represented as a periodic binary matrix `D[i,j]`, where each cell records which thread is on top at that crossing. The matrix gives a repeatable design description; an FDM generator must still turn it into reachable, collision-free nozzle trajectories.

| Binding / draft family | Conventional interlacement idea | Candidate soft-FDM translation | Design implication / risk |
|---|---|---|---|
| **Plain weave (1/1)** | Each warp alternates over and under successive wefts; neighboring warps use the opposite phase. | Dense alternating crossing draft; lower-level path pieces first, then raised pieces, or separate warp/weft passes at carefully chosen height levels. | Many intersections may stabilize the sheet and increase local bonding, but can make it less able to shear or slide. Short crossing intervals mean many Z transitions or segmented paths. |
| **Twill 2/1** | A warp passes over two wefts and under one; the offset advances each row to form a diagonal rib. | Repeat a 3-by-3 draft with a one-cell phase shift between adjacent warp paths. | Fewer alternations per path than plain weave and visible diagonal directionality. Test bias and principal directions; do not assume it is softer simply because the binding is less uniform. |
| **Twill 2/2** | Two-over/two-under repeat, staggered to create a diagonal pattern. | Periodic 4-by-4 draft advancing one position per neighboring row/column; the current engine uses `(i + j) % 4 < 2`. | Longer floats than plain weave may allow more local bending, but also increase unsupported span/sag and possible snagging. |
| **Basket weave** | Groups of neighboring warp and weft threads pass over/under together (e.g., 2-by-2 blocks). | Treat small bundles of parallel paths as one draft unit; alternate bundle-level crossings. | Larger blocks reduce crossing frequency and can increase open/pliant regions, but the bundled strands may behave as a thicker rib. Keep bundle spacing and mass controlled in comparisons. |
| **Satin** | A binding point is spaced out so each thread has a relatively long float before the next tie-down. | Sparse crossing/anchor points with long raised or lower-level spans between them. | Potentially compliant along the floats, but in FDM long unsupported spans may sag, snag, or break. This is a high-risk candidate for raised nozzle paths and should start with short spans. |
| **Herringbone** | Twill direction reverses periodically, creating a zigzag chevron of diagonal ribs. | Combine two mirrored twill drafts with a reversal line in the repeat. | The reversal line can concentrate path turns and stiffness; inspect the transition and edge repeat carefully. |
| **Diamond twill** | Twill direction changes in a repeat that creates diamond-shaped motifs. | Mirror/rotate twill draft blocks around repeat boundaries. | Motif junctions and corners may have different crossing density from the field; check for local thick spots and weak boundary cells. |
| **Crepe / irregular binding** | A broken or irregular-looking distribution of interlacements reduces an obvious directional rib. | Use a deterministic pseudo-random draft or tile pattern with bounded float length and a repeatable seed. | May reduce strong visual directionality, but irregular path ordering can create uneven junction density. Measure local mass and test multiple directions. |

The FilaFabric **Weave** card already documents plain, twill 2/1, twill 2/2, basket, satin, herringbone, diamond twill, and crepe bindings. That is a useful starting menu. The important translation is from **draft → path schedule → height assignment → crossing construction**. A draft is only the over/under intention; the emitted G-code determines whether crossings become fused joints, fragile bridges, or unprintable moves.

#### Three nozzle-path strategies for woven-looking soft structures

1. **Two-level, level-sorted weave (best first prototype).** Convert a small draft repeat to lower and upper crossing levels. Print lower-level segments first, then upper-level segments. This is close to the current FilaFabric Weave concept. It creates a bonded crossing network, not free-sliding cloth; raising and splitting every crossing can also increase time and weak endpoints.
2. **Outside target: raised strand around supports (pillar weave).** Print soft-material pillars/anchors, then route a continuous serpentine strand around alternating sides of them. Takahashi & Kim (2019) demonstrate this architecture on a consumer FDM printer, but their drawn strands relied on a stringing process and their TPU was difficult to use as the fibre. For Foamy TPU, this is a design hypothesis requiring its own extrusion trials—not a proven recipe.
3. **Method transfer only: multi-height 3D paths / conformal weaving.** Route two path families over a curved or shaped surface, assigning local height and crossing clearance. Guo et al. compute warp/weft foliations on curved surfaces for manual weaving; Wu's dissertation addresses computational fabrication and collision-aware ordering on a 5-axis wireframe printer; Harvey et al. study volumetric woven objects and visualization. These works motivate algorithms and representations, but do not show that the same paths can be deposited reliably as soft-FDM cloth on FilaFabric's printer.

**A fundamental limitation:** an FDM nozzle cannot normally pass beneath a strand that has already been deposited if the nozzle body collides with that strand. Even when a lower and upper crossing is successfully printed, the contacting polymer usually fuses; it does not behave like two freely sliding yarns. Therefore call these designs **woven-look**, **draft-based**, or **over/under-path structures** unless the build truly creates independent interlaced strands and that independence is verified physically.

#### Practical design rules for the first woven-path experiments

- Begin with one repeat cell and a small swatch, then scale. Use a short float and few binding options first; test satin-like long floats only after sagging limits are known.
- Make the draft periodic in both axes and design the boundary so a partial repeat is not cut at the edge. A repeat that tiles geometrically may still create an abrupt path termination at the specimen boundary.
- Track the **maximum unsupported span**, not just average float length. Include transitions, corners, and repeat boundaries.
- Make each Z transition gradual enough for the filament and path planner; avoid sharp climbs and inspect nozzle-body clearance, not just bead-to-bead clearance.
- Decide if you are optimizing for continuous paths, few travel moves, or clean binding pattern. These goals can conflict: a path split by level may be mechanically clearer but create many endpoints and travels.
- Compare plain, twill, basket, and one longer-float draft at equal outside dimensions, similar strand gauge, and measured mass per area. Test drape, directional force-extension, recovery, and repeated cycles.
- If crossings fuse, inspect them as possible stress concentrators. If they are intended to remain mobile, test whether they actually slide after printing rather than assuming so from the CAD preview.

**Relevant papers:** Takahashi & Kim (2019), *3D Printed Fabric: Programmable Textiles* (pillar-supported drawn strands and custom G-code); Wu (2020), *Computational Tools for 3D Printing and Woven Textile Design* (wireframe collision ordering, Weavecraft, and 3D weaving); Guo et al. (2020), *Woven Fabric Structures by Harmonic Foliation* (surface path families for weaving); Harvey et al. (2019), *Weaving Objects* (volumetric woven structures and visualization); Sterman (2026), toolpath-based textile design practice. Their fabrication modes differ, so use them as separate sources of design logic, not one pooled performance dataset.

### F. Spatially varying patterns, image mapping, and graded designs

**Design idea:** vary a geometric parameter across the swatch—cell size, line thickness/flow, loop fullness, pile height, relief height, or pattern spacing—to create an image, texture, or local mechanical difference.

**FilaFabric cards with picture-driven geometry include:** Loop Pile, Coil, Boucle & Picots, Relief, Meander, Voronoi Lace, Flow Lines, Bubbles, Halftone Net, and Star Lattice. The same image does not mean the same mechanical map: each card maps tone to a different feature.

**Mechanical expectations to test:**
- A gradient in line thickness or cell size can produce a gradient in stiffness, stretch, drape, or print stability—but which property changes, and by how much, must be measured.
- Abrupt transitions can create local stress concentrations or unstable extrusion; smoothness in the image does not guarantee smoothness in mechanical response.
- Changing cell size can change both visual resolution and mechanical behavior. Smaller cells may increase the number of junctions and material per area, but topology determines the result.

**Paper evidence:** Gispan et al. (2026 preprint) are directly relevant to image-bearing nets: they empirically calibrated a two-colour TPU process and found grid topology affected visual fidelity, stretch, and stability. Their numeric mapping is specific to their Prusa XL/95A TPU setup. Schumacher et al. (2018) and Panetta et al. (2015) provide property-aware design precedents for structured sheets and volumetric microstructures, respectively; neither supplies direct mechanical values for FilaFabric paths. Those papers support the *workflow* of linking geometry to measured response, not assigning properties by image tone alone.

**Design tips:**
1. Keep the pattern's visual scale and the fabric cell scale conceptually separate; a fine image may require a coarser structural feature to remain printable.
2. Limit abrupt changes in strand width/flow and verify that thin and thick extremes both print continuously.
3. For a claimed stiffness or stretch gradient, test coupons from dark, mid-tone, and light regions rather than relying on the preview.
4. Record whether picture tone changes geometry, material amount, or path height; these are different interventions.

### G. Curved, radial, space-filling, and procedural patterns

These patterns create a distinctive appearance or distribute paths over a region. They are not automatically a distinct mechanical class; most still behave as connected line networks whose mechanics depend on spacing, orientation, crossings, and edge conditions.

**FilaFabric cards:** Spiral Panel, Spiderweb, Meander, Harmonograph, Truchet Tiles, Voronoi Lace, Turing Stripes, Conformal Mesh, Sunflower, Rosette, Flow Lines, Bubbles, Parquet, Spirograph, and Star Lattice. Crosshatch & Isogrid and Drawing & Infill also support procedural/infill alternatives.

**Subfamilies:**
- **Radial/spiral:** Spiderweb, Rosette, Spirograph, Sunflower, Spiral Panel. Expect mechanical response to vary between radial, circumferential, and diagonal directions; centres and edges can concentrate or interrupt paths.
- **Space-filling/curve paths:** Meander (Hilbert, Moore, Peano, Sierpinski, Gosper, random maze, stipple tour), Harmonograph, Turing Stripes. Long continuous routes can reduce starts/stops but may create many turns, local crowding, and anisotropy.
- **Cell/packing networks:** Voronoi Lace, Bubbles, Truchet Tiles, Parquet, Star Lattice. Cell-size distribution, wall continuity, junction count, and pattern boundaries affect load paths. A “Voronoi” or “star” name alone says nothing about its effective modulus.
- **Surface-coordinate patterns:** Conformal Mesh and Flow Lines can bend path families around holes, poles, or a vector field. Geometric smoothness does not ensure nozzle clearance or mechanically uniform cells.

**Paper evidence:** Martínez et al.'s Voronoi foams and star-metric metamaterials show that Voronoi/star-derived geometries can be optimized for mechanical properties, but they use different cell models and often volumetric structures. Do not infer FilaFabric Voronoi Lace or Star Lattice properties from the shared mathematical family/name. Guo et al.'s harmonic foliation is a computational method for warp/weft families on curved surfaces and physical weaving—not direct FDM evidence.

**Design tips:**
1. Treat the construction algorithm and the mechanical topology as separate descriptions. Document both.
2. Examine local minima/maxima in cell size and junction density; a global average can hide weak spots.
3. For radial patterns, test with loads in radial and circumferential directions and inspect the centre/edge transitions.
4. For any cell pattern, test a specimen with a representative edge, because cutting cells at the boundary changes connectivity.

## Inventory of all current FilaFabric structures

For a complete per-ID inventory with current carrier behavior, hidden-card status and migration recommendations, see the [existing-pattern audit](FilaFabric_Existing_Pattern_Audit_and_Grouping.md). In particular, default ring-only Spiral and Coil Rings/Bouclé receive automatic crossed support, Meander/Turing have selected native carriers, and Voronoi is a coordinated Delaunay/Voronoi dual. Logical pass counts do not guarantee flat Z planes in the current shared settlement pipeline.

This table groups the current project cards by *path architecture*. A card can appear conceptually related to more than one family; the grouping indicates its primary construction, not a measured mechanical classification.

| Family | FilaFabric structures | Path idea / design knobs |
|---|---|---|
| **Raised 3D loops / pile** | Loop Pile | Anchored arches above an open base; pile height, loop size/spacing, base openness, strand thickness, and pattern modulation. |
| **Raised relief / free strands** | Relief; Fringe | Z-varying rows form bobbles, seersucker, or pleats; fringe uses anchored hairs/free ends. Tune height, span, length, spacing, and anchor/root geometry. |
| **Pillared / spacer** | Spacer Net; Pillar Weave | Two nets separated by pillars, or a serpentine strand locked around a pillar grid. Tune pillar height/radius/pitch, net pitch, and path order. |
| **Flat or lightly lifted line nets** | Zigzag Mesh; Advanced Zigzag Mesh; Squiggle & Gyroid; Halftone Net; Crosshatch & Isogrid | Single or crossed families of straight/wavy/zigzag lines; tune line spacing, wave dimensions, direction, crossing angle, and strand thickness/flow. |
| **Looped / self-crossing paths** | Coil; Boucle & Picots | Continuous rows of loops/coils, with local lifts at crossings; tune loop/ring size, overlap, row spacing, density, and pattern. |
| **Over/under-like / draft-based woven paths** | Weave; Dip Weave; Pillar Weave; Parquet | Plain/twill/basket/satin/herringbone/diamond/crepe drafts, dipped weft-like paths, pillar-supported serpentine strands, or blocks of orthogonal lines. Tune binding repeat, float length, Z levels, crossings, support pitch, and edge repeat. |
| **Auxetic / re-entrant** | Auxetic Mesh | Mirrored zigzag rows and re-entrant/honeycomb-like cells; tune cell type, width/depth, and row spacing. Verify transverse strain to claim auxeticity. |
| **Radial / rosette / spiral** | Spiral Panel; Spiderweb; Rosette; Sunflower; Spirograph | Nested edge-following rings, radial spokes, wrapped waves, golden-angle seeds, or trochoid rings; tune centre, turns, spokes/lobes, and spacing. |
| **Space-filling and curved networks** | Meander; Harmonograph; Truchet Tiles; Turing Stripes; Flow Lines | Continuous space-filling curves, crossing Lissajous curves, seeded tile motifs, reaction-diffusion stripes, or flow-field streamlines; tune curve/tile scale, phase, seed, spacing, and crossings. |
| **Cellular / packed patterns** | Voronoi Lace; Bubbles; Ring Mail; Star Lattice | Voronoi cells and triangulation, packed ring clusters, overlapping ring paths, or star polygons/straps; tune cell/feature size, density, tiling, overlap, and contact angle. FilaFabric's Ring Mail is a soft-filament path design; do not conflate it with rigid linked-ring fabrics or pressure-jammed particle systems from other papers. Names do not specify mechanical performance. |
| **General drawing and infill** | Drawing & Infill | Imported line/shape drawing plus optional infill/backing; select infill topology, spacing, angle, and region. This is a construction toolkit rather than one textile topology. |

The listed names reflect the README and `docs/fabric-structures.md`; their descriptions can lag final geometry/support behavior, as the new code audit documents. Luis's Parquet/Bubbles observations update the older no-prints status, but do not establish comparative mechanical or wearable properties for the library.

## What the mechanical papers collectively teach

### There is no single “flexibility” score

At minimum, separate:

- **Bending/drape:** resistance to out-of-plane folding or hanging.
- **Tensile compliance:** force required to extend by a stated amount.
- **Maximum extension and strength:** extension and load at failure.
- **Recovery:** return after unloading; distinguish immediate recovery from permanent set.
- **Cyclic durability:** how properties and damage change with repeated deformation.
- **Compression/loft:** thickness loss and recovery for pile/spacer designs.
- **Directional response:** differences along two axes and on the bias.
- **Surface/wear behavior:** abrasion, snagging, and skin-contact comfort.

One pattern can rank differently on each measure. A high elongation at break does not imply low-force stretch; a low drape coefficient does not mean high tensile strength; an auxetic response does not imply good recovery.

### Geometry, material, and process are coupled

The FDM quasi-textile papers repeatedly show that nominal CAD dimensions are not the finished strand dimensions. Actual width, height, adhesion, and continuity depend on extrusion, speed, nozzle gap, material rheology/moisture, cooling, path curvature, layer height, and printer. This is especially important for soft TPU-like filaments. A geometry that is mechanically attractive but intermittently extrudes is not a reliable textile design.

### Layer count and density are useful controls, not universal laws

More material and thickness often increase bending resistance and reduce open space; but pattern topology can make equal-mass structures behave differently. Additional intersections can stabilize a network, or constrain its motion. Added layers can either bridge gaps and reinforce a sheet, or create a thicker/stiffer laminate. Compare designs with controlled dimensions and report both mass and geometry.

### Drape must be measured, not guessed from the render

The drape papers demonstrate large differences among printed geometries and use repeatable image-based methods. For a meaningful FilaFabric comparison, hold specimen diameter/shape, material, print orientation, support, and conditioning constant; photograph flat and draped states; report the calculation and repetitions. A 3D preview is useful for geometry, but it cannot establish physical drape until compared with printed samples.

## Suggested naming scheme for future pattern documentation

For each structure, record these properties rather than relying on a visual name alone:

1. **Topology:** mesh/grid, loop/knit, auxetic/re-entrant, over-under, radial/spiral, packed cells, or raised pile/spacer.
2. **Path dimensionality:** flat single plane; multi-layer 2.5D; variable-Z relief; raised loop; pillar/spacer; or free strand.
3. **Connectivity:** continuous route, connected at crossings, separately linked, or multiple disconnected paths.
4. **Unit-cell/parameter definition:** cell dimensions, angle, loop length, line pitch, strand dimensions, overlap, and boundary treatment.
5. **Expected deformation modes (hypotheses):** bend, rotate, stretch, shear, compress, buckle, slide, or recover.
6. **Evidence status:** conceptual only; simulated; printed but visually inspected; mechanically tested; repeated/cyclic tested; or wear-tested.

That taxonomy lets two patterns with similar names be distinguished when their topology, path height, or connectivity differ—and prevents a result from one printed structure being generalized to an unrelated one.

## Source map: strongest paper families for learning pattern mechanics

- **FDM quasi-textile construction and process limits:** Forman (2020, DefeXtiles); Diak & Diak (2024, 2025); Sterman (2026); Takahashi & Kim (2019).
- **Drape and geometry comparisons:** Kalman et al. (2021); Kabir et al. (2022); Kuijpers et al. (2026) for representation/communication, not printed-net validation.
- **Tensile/stretch behavior:** Kabir et al. (2023, 2024, 2025); Nakajima et al. (2020, flexible kirigami); Jayswal (2023 dissertation).
- **Continuous textile designs and multiple mechanical tests:** Kim & Lee (2025), including fixed-bed and conveyor processes; conveyor results require specialized hardware.
- **Loops and knit-like geometries:** Kabir et al. (2023); Beecroft (2016, 2019, SLS PA12 rather than FDM).
- **Woven layouts and nozzle-path adaptation:** Takahashi & Kim (2019); Wu (2020 dissertation); Guo et al. (2020); Harvey et al. (2019); Sterman (2026). Distinguish loom/wireframe methods from soft-FDM validation.
- **Property-aware sheet/lattice design methods:** Schumacher et al. (2018, rod-network sheets); Panetta et al. (2015, volumetric elastic textures); Martínez et al. (2019, star-shaped metrics). These inform methods for linking geometry to behavior, but do not characterize FilaFabric's paths.
- **Hybrid print-on-fabric (a separate scope):** Eutionnat-Diffo et al. (2019); Firicel et al. (2025 review); Loh & Pei; Steinmetz & Ehrmann (2021); Özev & Ehrmann (2023).
- **Closest material matches to the current FilaFabric profiles:** NinjaFlex 85A in Martínez et al. (2019) and FlexScale (2024, on a Prusa MK3S+), and NinjaFlex with no grade stated in Schumacher et al. (2018); Filaflex 82A in Steinmetz & Ehrmann (2021). Their geometries and settings still differ.
- **Primary sources to retrieve next (cited but not held):** Pattinson et al. 2019, *Adv. Funct. Mater.* 29:1901815 (bond-modulated sliding strands, regionally auxetic meshes and conformal meshes printed onto a template; via Sitotaw); Li et al. (sliding-connection printed weaves; via Sapkota); Lu et al. 2022 (TPU mesh parameter regression; via Brad); Spahiu et al. 2020 (FilaFlex auxetic dress; the arrowhead shape is named by Jayswal-Adanur and Manaia, not by Brad or Keefe); Bastian's mesostructure prototypes, Thingiverse thing:289650 (Peleg's basis per Keefe; classed as plate kinematics by Sitotaw), to settle their height; Uysal & Stubbs 2019 (Sitotaw cites it for an ankle brace and an embedded-mesh glove); Kabir et al. 2023 CTRJ (journal version of the drape study). Kabir et al. 2023 CTRJ (journal version of the drape study).

## Recommended next evidence

The next step is a controlled set of bed-based S/M swatches, followed by bounded N textures. Prioritize connected single-layer nets, lace plus open backing, two-colour halftone and fused pseudo-weave. Compare drape, directional low-force extension, recovery and repeated-cycle damage at recorded mass and thickness. Upright wall/pillar and tall-pile studies remain process background. Follow the candidate records above when deciding which existing card to extend.
