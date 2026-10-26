# FilaFabric Research Reference and Pattern Design Notes
*Paper evidence and proposed translations for a library of bed-based textile patterns.*

## Review scope and evidence policy

**Existing-library follow-up:** the [current pattern audit and grouping brief](FilaFabric_Existing_Pattern_Audit_and_Grouping.md) adds a code-based review of every current design, actual carrier/pass roles, duplicates and Parquet failure cases. It complements the paper evidence below and is the starting point for simplifying the present library one construction group at a time.

**Updated 23 October 2026.** All 65 local sources (64 PDFs and one Word paper) were screened for printable patterns and useful methods. The dated review in section 4 of each paper entry records relevant methods/results passages and physical PDF page locators; long dissertations were reviewed by relevant chapters. Key figures were also inspected for the flat-grid, halftone, layered-lace and toolpath examples. This is a design-focused source review, not a systematic review or an independent replication of the papers.

The target has three classes: **S single-layer planar sheets**, **M multiple flat layers** (including halftone and lace with printed backing), and **N shallow non-planar sheet textures**. All are built lying on the bed. Upright DefeXtiles walls, upright woven specimens, pillar-weave, tall pile, spacers and bulk particle systems remain background references. Their algorithms or tests may transfer; their fabrication routes are outside this brief.

Use the [pattern catalogue](FilaFabric_Printable_Textile_Pattern_Catalogue.md) for candidate records, existing-card mappings, the implementation order and the Nozzle Boss/Blender research lead. The older broad summaries below provide context; the dated flat-sheet review makes current relevance explicit. Paper performance values describe the authors' own specimens. Proposed thin-sheet adaptations are labelled as proposals, and no mechanical or wearable claim is established for FilaFabric until it is printed and tested.

Page locators count physical pages including covers; the Word source uses section headings. Dates/years follow the supplied files. The local halftone paper is a preprint. A single-layer nominal toolpath may have thicker crossing mounds; a fused pseudo-weave is distinct from mobile interlaced yarn. Formulas are retained only where supported by the source and with their scope identified.

**Second full-text pass, 24 October 2026.** Every source was re-read in full (dissertations by relevant chapter, appendices and tables included). Section 5 of each entry lists what the first pass missed: settings, dimensions, tables, named patterns and primary leads. Generic placeholder text in sections 2 and 3 was replaced with paper-specific content. Equations and tables whose extracted text was ambiguous were checked against the typeset PDF pages. Corrections made in this pass:
- Diak & Diak 2025 (10): specimen thickness is **0.26–0.36 mm**, not 0.35–1.0 mm.
- Kabir 2024 (26) and Kabir 2025 (27) report **the same specimens**: identical statistics, with the floral angles relabelled by 45°. They are one experiment, not two.
- Cilllia's printed tilt formula (49) does not reduce dimensionally.

**Attribution check, 26 October 2026.** A first draft of this pass misattributed several cross-paper statements. They were re-checked against the source text and corrected:
- *Bastian's mesostructure.* Keefe (30) says Peleg's FilaFlex textiles were based on mesostructures designed by Andreas Bastian. Sitotaw (56) classes "Mesostructure of A. Bastian" as thin-layer plate kinematics but **never mentions Peleg**. Neither text gives a height. Keefe's own Fig. 7 photographs show the pattern both as deep blocks of tall walls and as thin sheets flexed by hand. The draft's claim that the structure is a tall-wall lattice and not a flat net was wrong.
- *Sun (60)* says Peleg used an "open source pattern" and does not name Bastian or cite Sitotaw.
- *Ankle brace.* Sitotaw cites its ankle-brace and embedded-mesh-glove sentence to its ref. 17 (Uysal & Stubbs 2019), not to Pattinson et al. Sitotaw never calls Pattinson's meshes strain-limiting.
- *Spahiu et al. 2020.* Only Jayswal-Adanur (23) and Manaia (43) name the arrowhead shape; only 23 gives Shore A82 and 130 × 130 mm. Brad (5) names FilaFlex and captions the dress as joined with stitches and belts, while 23 and Sapkota (52) say a Dikale 07A 3D pen. Keefe (30) says only "an auxetic structure" in Filaflex.
- *Smaller fixes:*
  - Jayswal (22): a 0.5 mm gap fused and 0.65 mm separated, with 1 mm yarns.
  - Kim & Lee (31): the tested grades (87A to 75D) do not reach NinjaFlex's 85A.
  - Wang (63): unlinked layers are compared with layers interlocked through the thickness, not with fused layers.
  - Laput (36): bridged strands are compared with its own drawn hairs.
  - Beecroft (4): does not state the process for Mallinson's swatches.
  - Sterman (58): the two-layer glove is welded in one run, with a separator placed mid-print.
  - FlexMaps (42): 99% of an average spiral stays within about ±0.5% strain.
  - Schumacher 2018 (54): uses isohedral tilings but does not mention the Tactile library.
  - Cui & Sun (7) and Sun (59): describe no edge band.
  - Kalman, Nakajima, Gispan, Diak, Martínez and the process-settings table: re-checked and unchanged.

**Primary sources retrieved, 26 October 2026.** All four priority primaries are now held locally and reviewed as **Papers 66–69**. Published versions of Pattinson and Li are also held; their key numbers match the manuscripts reviewed. What they change:
- *Pattinson et al. 2019 (66):* bond modulation is confirmed. Two separate controls are demonstrated: a nozzle lift at crossings, so the strand cools before contact (drape shown, with no lift height given), and a lateral gap between parallel strands (stiffness measured). The **ankle brace** with a non-linear response is this paper's, so Sitotaw's attribution of it to ref. 17 is a citation error. Strain stiffening comes from waves that straighten.
- *Li et al. 2022, "Programmable Digital Weaves" (67):* a sliding crossing is **not** one arched strand, as Sapkota (52) describes it. The crossing strand is laid raised, then a separate printed **channel** fused to the lower strand holds it captive. The authors' G-code gives the heights and speeds. The flat-to-parabolic deployment uses one sliding strand in an otherwise fused structure.
- *Spahiu et al. 2020 (68):* the dress was joined with a 3D pen; the needle stitching was a mannequin trial and the belts are dressing aids. The panel is 1.8 mm thick, and there is no mechanical test.
- *Lu et al. 2022 (69):* a 30-configuration NinjaFlex mesh sweep. Strength and modulus fall about linearly as the strand gap widens; thicker layers stretched furthest; rotation angle mattered little. The specimens are 1.8 mm thick, and the paper's regression text and tables disagree in places.

Still to retrieve: **Bastian's mesostructure prototypes** (Thingiverse thing:289650, Sitotaw ref. 98), to settle their height.

The two legacy generator scripts are retired (moved to `_to-delete/` on 26 October 2026): their keyword-based summaries could overwrite this reviewed document and misattribute equations. Maintain the authored Markdown directly. Source PDFs, the Word source and `.review-cache/` stay local under the project ignore rules; the reports can be tracked without redistributing the papers.

---

## Executive Summary & Architectural Mapping
This reference indexes 69 collected works (65 reviewed on 23–24 October, plus four primaries added on 26 October as Papers 66–69) relevant to or adjacent to **FilaFabric**, a browser-based textile G-code generator. The original summaries have three dimensions, followed by the dated review:
1. **Core Focus & Abstract Findings:** Empirical and theoretical contributions to digital textiles, additive manufacturing, metamaterials, and computational design.
2. **Mathematical & Structural Formulations:** Governing equations, homogenization models, auxetic kinematics, under-extrusion mechanics, and yarn interlooping geometries.
3. **Relevance & Design Takeaways for FilaFabric:** Mapping to FilaFabric's 32 registry entries (31 design IDs plus one preset alias), whole-repeat edge alignment, the geometry check and *Fix it*, picture-driven mapping (*Your picture*) and process settings. The reference machine is the Prusa MK3S; flexible material profiles now include Recreus Filaflex 95A Foamy, NinjaTek NinjaFlex 85A, Generic FLEX and Generic TPE. NinjaFlex 85A is also the material used by Schumacher 2018 (54), Martínez 2019 (46) and FlexScale (47). Those are the closest material matches in the collection, but none uses FilaFabric's printer, settings or geometries.
4. **Second full-text pass (section 5, 24 October 2026):** added details, patterns and leads from re-reading each full text.

---

## Paper 1: Ariel-Sterman-2026 — Compostable Garments via Digital Fabrication a Nursing Bra Case Study
**File Name:** `Ariel-Sterman-2026_Compostable-Garments-via-Digital-Fabrication-a-Nursing-Bra-Case-Study.pdf`

### 1. Summary & Core Focus
This CHI 2026 case study explores how digital fabrication and material-driven design can replace difficult-to-recycle garment components with industrially compostable alternatives. The authors developed a functional nursing-bra prototype from 100% cotton interlock and two bioplastic filaments: flexible Biocirflex (80A) for elastic elements and heat-bonded stabilizers, and stiff Nonoilen (71D) for nursing clips and strap sliders. The work addresses the end-of-life problem created by elastane blends, adhesives, and metal or plastic closures, while emphasizing that compostability depends on the specified industrial conditions and certified materials.

The central intervention is a printed re-entrant auxetic band heat-pressed between cotton layers to provide mechanical extension and recovery without elastane yarn. A Grasshopper parametric workflow controls cell size, cell count, hinge angle, layer count, and print toolpath, generating G-code directly; repeated prototypes were used to tune elasticity and stability. The reported prototype used approximately 15 mm cells, four 0.2 mm layers, a 5 mm edge outline, and 160 °C heat pressing. Separate tests selected a 0.2 mm printed stabilizer as sufficient for edge stabilization without excessive stiffness. The authors report a functional wearable prototype, but identify durability and miniaturization of FDM-printed rigid fasteners as limitations and point to injection molding for later-scale manufacture.

### 2. Mathematical & Structural Formulations
The bra study uses a re-entrant auxetic unit cell and Grasshopper parameters for cell size/count, hinge angle, layer count, and toolpath, then heat-presses the printed structure between cotton layers. Its reported parameters are prototype-specific; the paper does not supply a general constitutive law or standardized cyclic-fatigue model.

### 3. Relevance & Design Takeaways for FilaFabric
**Directly relevant to Auxetic mesh**, and secondarily to configurable garment-scale lattice placement. The paper supports exposing unit-cell dimensions and hinge/re-entrant geometry as meaningful controls, while evaluating the printed structure in its substrate context (orientation, edge stabilization, bonding, and garment function), not just as a free-standing lattice. Its direct-G-code Grasshopper workflow is a useful precedent for coupling parametric geometry with process moves and limiting travel moves when flexible filament stringing or jams are concerns. Do not transfer its bioplastic temperatures or bonding recipe to FilaFabric's Filaflex Foamy profile: the polymers, printer, and heat-bonding process differ. A future extension might import garment pattern regions and assign structural or material zones; this is an opportunity suggested by the paper, not current FilaFabric functionality.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 2-4, §§3-5, Figs. 2-4. **Status:** M, directly relevant planar lattice; fabric encapsulation is an additional process.

The printed elastic component is a re-entrant arrowhead band, not a knitted filament structure. Grasshopper writes G-code controlling cell dimensions/count, hinge angle, layers and travel. The example uses approximately 15 mm cells, four 0.2 mm layers and 5 mm side outlines; Biocirflex is subsequently heat-pressed between cotton interlock layers at 160 °C, aligned with the knit course direction. A separate single printed 0.2 mm stabilizer supplies edge support. **Proposed translation:** an arrowhead-band generator with independent hinge, cell, border and layer controls, plus swatches comparing free-standing and fabric-backed response. The paper reports iterative functional garment prototyping, not fatigue curves or a constitutive formula. Its heat recipe and claimed biodegradability do not transfer to Foamy TPU; the cited ASTM D6866 designation should not itself be treated as compostability certification.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–4, §§3–5).** The bands were printed on a Flashforge FDM printer at the width of the straps and under-bust band. The 5 mm side outlines stabilize the strand ends at the band edges against fraying, as well as finishing them. The stabilizer was chosen from solid flexible-filament test layers 0.2, 0.3 and 0.4 mm thick, heat-bonded to one cotton layer and laser-cut; 0.2 mm was the thinnest that stabilized without overly stiffening or thickening. It was then printed as 2 cm strips along pattern-piece edges and around the nursing openings. **A frame was printed around each stabilizer shape** to hold it in shape while it moved from the bed to the heat press and to register it for laser cutting. The authors name internal hinge angle, cell scale and number of layers as the controls that changed the result most. Stiff Nonoilen clips and sliders were printed 3 mm thick for durability.

**Pattern implications.** (1) *Arrowhead band with side rails:* a re-entrant arrowhead strip whose two continuous outline rails anchor every cell end. Controls are band width, cell size, hinge angle, rail width and layer count. (2) *Sacrificial handling frame:* a thin connected border, trimmed off after release, that keeps a delicate open piece flat while it is peeled off the bed and gives a registration edge for later cutting or bonding. Both are proposed FilaFabric edge treatments based on this garment workflow, not tested Foamy settings.

---

## Paper 2: Barbot-Fuzier-2026 — Designing with Evolutive Colors A Proof of Concept for Bio based Dye Integration in Textile Design Digital Workflow
**File Name:** `Barbot-Fuzier-2026_Designing-with-Evolutive-Colors-A-Proof-of-Concept-for-Bio-based-Dye-Integration-in-Textile-Design-Digital-Workflow.pdf`

### 1. Summary & Core Focus
This 2026 proof-of-concept paper asks how textile-design software could treat bio-based dye colour change as expected material behaviour rather than a defect. The authors built a browser-based workflow for knitted jacquard colourways that combines pattern and dye-data import, colour selection, 2D previews, and 3D garment previews. Its example dataset covers five natural dyes applied to alum-mordanted felted wool, with initial and post-exposure CIELAB measurements after 530 hours of xenon-lamp exposure; intermediate states are linearly interpolated. The tool supports patterns of up to six colours, treating each image pixel as a stitch, and enables comparison of shades that look similar initially but evolve differently.

The contribution is as much about design practice as software: colour selection can account for time, exposure, and use instead of only appearance at manufacture. In 3D, user-authored heatmaps approximate uneven exposure on a garment, such as more exposed shoulders versus protected underarms. The authors find 2D comparison more dependable than their 3D rendering, whose lighting reduces colour accuracy; the garment scenario is manually configured and not yet scalable. They stress that the dataset is illustrative rather than ground truth: natural dyes are mixtures, and light, humidity, temperature, and use affect fading. They call for validated datasets, uncertainty ranges, richer exposure models, non-linear comparative workflows, and designer evaluation; wash and friction fastness are outside the prototype's scope.

### 2. Mathematical & Structural Formulations
The principal representation is colourimetric, not a knitting-geometry or toolpath model. Dye states are represented in CIELAB coordinates $(L^*,a^*,b^*)$; the example interpolates between measured initial and final coordinates and samples a timeline at regular intervals. A spatial exposure heatmap modulates displayed ageing across a 3D garment. This is a deliberately simple proof-of-concept model: the paper does not establish a general kinetic law, quantify prediction error, or account for uncertainty and interacting environmental factors. The knitted jacquard is represented as a pixel/stitch colour map, with structure constrained to isolate colour-related variables.

### 3. Relevance & Design Takeaways for FilaFabric
This paper is **not evidence for loop-pile geometry, stitch density, or Z-lift calibration**. Its useful connection is the design-tool principle of making material behaviour and its uncertainty visible. FilaFabric's shared image-pattern workflow already maps image tone to structural parameters (for example, loop fullness, pile height, or line thickness); by analogy, a future material-preview feature could communicate how a selected filament or textile substrate changes appearance or performance under use conditions. The paper reinforces comparing outcomes across a range of states rather than presenting a single preview. Any such extension would need measured, material-specific data and explicit uncertainty; colour ageing and CIELAB simulation are outside the current G-code generator's demonstrated functionality.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 6-13, §§3-5, Figs. 2-7, Table 1. **Status:** indirect design-method transfer to S/M/N; no printed geometry.

This browser prototype recolours knitted-jacquard imagery using measured initial/final CIELAB dye states and interpolated intermediate colours. Each image pixel represents a stitch; up to six colours are supported. Five named dyes on mordanted felted wool have measurements before/after 530 hours of xenon exposure, although the prose inconsistently calls them four. Manually authored garment heatmaps model uneven exposure. **Proposed translation:** show a pattern across measured material/process scenarios, with explicit uncertainty and independent geometry/appearance previews, rather than presenting one preview as a performance prediction. This is not a source for line density, shallow Z modulation, extrusion or loop geometry. The authors find 2D colour comparison more reliable than their lit 3D view and identify limited data, manual setup and absent wash/friction modelling. The master correctly rejects a pile-geometry connection, but should remove pile-based examples from its target-scope discussion.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 6–10, §3).** The prototype is a next.js/three.js web page with deliberately no back end or server storage, so organisations can test it without sharing data. The six-colour ceiling comes from the knitting machine: eight yarn guides, two reserved for cast-on and joining yarn. Users import an image (24 × 24 px examples), the tool detects its colour regions, and each region is linked to a dye record loaded as a CIELAB CSV. The timeline runs 0–990 units, sampled every 30 units (33 colour states). The colour picker shows a **tolerance range** around the requested shade: nearby colours that the dataset can actually produce, each with its own projected evolution.

**Pattern implications.** No geometry. Two workflow ideas transfer to FilaFabric's picture and colour handling: (1) derive the colour or tool count limit from the machine and say why (here, yarn guides; for FilaFabric, the actual extruder/tool-change set-up), and (2) when a picture asks for a tone or width the calibrated process cannot produce, show the nearest achievable values instead of silently clipping them. The local-only data handling matches FilaFabric's existing practice of keeping a user's picture on their computer.

---

## Paper 3: Beecroft-2016 — 3D Printed Weft Knitted Structures by SLS of Nylon Powder
**File Name:** `Beecroft-2016_3D-Printed-Weft-Knitted-Structures-by-SLS-of-Nylon-Powder.pdf`

### 1. Summary & Core Focus
Beecroft (2016) models plain single-face and double-face interlock weft-knitted structures as continuous loop geometries and fabricates them by SLS using PA12 nylon powder. A loop is drawn, piped to a chosen wall thickness, and arrayed into courses and wales; CAD spacing is checked to maintain at least 0.4 mm between neighboring/intersecting parts. In the single-face tests, 0.4 mm pipe walls were too fragile, while 0.5 mm retained a flexible, articulated form and recovered toward its original shape. The paper reports that the printed knit stretches horizontally across courses. Later interlock samples used thicker loop walls (including 1.2 mm) and showed compression, extension, and bending flexibility.

This is an exploratory SLS study with mostly hand-applied compression, stretching, bending, and recovery tests rather than standardized tensile testing. Its principal trade-off is clear: reducing loop thickness improves fineness but risks breakage, while thicker loops remain functional but are unlike fine conventional yarn. The SLS nylon powder, build process, and loop topology differ substantially from FilaFabric's FDM toolpaths.

### 2. Mathematical & Structural Formulations
The knit is constructed from continuous, repeated loop paths: a piped loop is arrayed horizontally into courses and vertically into wales, with loop size and pipe-wall thickness controlling clearance and structural durability. Single-face loops are compared with double-face interlock geometry; the interlock adds a ribbed face and greater material thickness. SLS layer height was 0.1 mm, while CAD clearance between neighboring/intersecting loops was maintained at 0.4 mm. No analytical mechanical model is proposed.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **structural precedent for knit/loop-inspired pattern design**, especially how continuous loop topology, loop dimensions, and spacing govern articulation and failure. It can inform proposed flat loop-shaped S/M motifs at a conceptual level; raised loop pile is a different topology outside this brief, but it does not provide FDM settings or validate FilaFabric's loop behavior. Its 0.4–1.2 mm SLS PA12 results should not be equated with FDM strand widths or Foamy performance.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 3-7, §§2-4, Figs. 2-19. **Status:** outside target as SLS interlooped geometry; topology/clearance transfer only.

Rhino curves are piped and repeated into courses/wales; PA12 powder supports otherwise inaccessible interlooped paths during SLS. The single-face 0.4 mm pipe version was too fragile; 0.5 mm retained flexible articulation. Double-face interlock samples use 1.2, 0.6 and 0.4 mm pipes. The finest interlock version bends but breaks readily and partially fuses between close faces, limiting transverse stretch. Magics checks a nominal 0.4 mm separation; this is an SLS condition, not an FDM clearance guarantee. **Proposed translation:** compare a continuous planar loop-shaped meander (S) with a fused two-layer loop motif (M), deliberately identifying both as visual/structural translations rather than independent knitted loops. Vary motif pitch, neck width and intended bond positions. The earlier summary’s suggestion of “Loop pile” is misleading for the present scope: these are interlooped knit paths, not raised pile, and neither validates an FDM preset.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–7).** The samples were made by a bureau on an EOS Formiga P1 (±0.15% XY calibration, 0.1 mm layers) from PA12 powder mixed 1:1 new to used. The first Autodesk 123D models were built by copying a loop row, angling it and pasting it again. That accidentally produced alternating plain and purl courses, so the construction method changes the knit, not just the drawing. Every version stretches mainly across the courses (horizontally). The two faces of the 0.4 mm interlock fuse at intervals where they sit closest together. That is the SLS version of the FDM problem of unintended contact welds.

**Pattern implications.** The workflow is useful as written: draw one loop-unit centreline, check the clearance to its neighbours, then array it into courses and wales. For FilaFabric the planar projection of a course of loops is a candidate continuous motif under S3/M4, but where neighbouring loops touch they will fuse. Plan those contacts as deliberate bonds rather than inheriting them from the knit drawing. There is no new FDM value to add.

---

## Paper 4: Beecroft-2019 — Digital Interlooping 3D Printed Weft Knitted Tubular Structures
**File Name:** `Beecroft-2019_Digital-Interlooping-3D-Printed-Weft-Knitted-Tubular-Structures.pdf`

### 1. Summary & Core Focus
Beecroft (2019) extends the earlier SLS work to tubular plain and interlock weft-knit forms, focusing on continuous loop geometry rather than separate chainmail links. Rhino models repeat a piped loop unit into courses and wales, then map it along a curve to form tubes; the author evaluates compression/extension, stretching over a cone, recovery after ten stretch cycles, and manual bending/folding. Nylon PA12 SLS samples with loop-wall thicknesses of 1.42 and 0.94 mm underwent cone-expansion and repeated recovery demonstrations; a 0.64 mm sample failed during transverse stretching. The source has inconsistent units: prose gives 25/55 cm, whereas Table 1 gives a stretched diameter of 55 mm, alongside internal diameters of approximately 15–32 mm. Do not present the centimetre figure as established. Other extension prose/table discrepancies also limit precise derived percentages.

The study is speculative and uses manually applied loads/observations, not standardized mechanical characterization. The breakage of the thinnest sample illustrates the fineness-versus-durability trade-off. Its SLS PA12 tubes and substantial wall thicknesses are not direct analogues of FilaFabric's flat FDM textile paths.

### 2. Mathematical & Structural Formulations
The modeled geometry is a repeated piped loop arrayed into courses and wales, then mapped along a curve to form a tube. The study reports loop-wall thickness and manual extension/recovery observations; it does not derive a constitutive mechanics model.

### 3. Relevance & Design Takeaways for FilaFabric
Relevant as a **loop-geometry and tubular-form reference** for any future FilaFabric knit/interlooping or garment-shaping workflow. It illustrates the added modeling steps needed to convert a repeated loop into a continuous tube and to check minimum clearances, and it highlights the importance of testing extension and recovery repeatedly. It does not validate FilaFabric's exported loops, current planar patterns, or FDM material settings; transfer requires fabricating and testing the actual FDM geometry.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 4-7, §§3-4, Tables 1-2, Figs. 1-5. **Status:** outside S/M/N; SLS tubes, with testing/topology transfer.

Repeated piped plain/interlock loops are mapped around tubes and SLS-printed in PA12. Manual testing measures compression/extension, cone expansion, ten repetitions and bending/folding. Table 1 records 1.42/0.94/0.64 mm pipe thicknesses; the finest plain tube fails during transverse stretching. **Proposed translation:** use matched planar S/M swatches to compare longitudinal/transverse extension, residual set after ten cycles, and bendability separately. This avoids assuming a pliable sample is safely stretchable. A continuous-loop-looking fused planar motif may borrow proportions, but does not retain SLS knit articulation. **Review correction:** “stretched over a 55 cm cone” is unreliable. Prose gives 25/55 cm, but Table 1 explicitly gives 55 mm stretched diameter, consistent with roughly 15-32 mm internal diameters. Flag the source’s unit inconsistency rather than reproducing centimetres as established. Tube C extension prose also conflicts with its table, so avoid a precise derived percentage.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–8, §§2–4, Tables 1–2).** Loop geometry from the tables:

| Tube | Structure | Pipe wall (mm) | Loop height × width (mm) | Compressed / extended (from 180 mm) | ×10 cone recovery |
|---|---|---|---|---|---|
| A | plain | 1.42 | 21.11 × 9.43 | −16.7% / +36.1% | yes |
| B | plain | 0.94 | 8.73 × 5.56 | −13.9% / +30.6% | yes |
| C | plain | 0.64 | 5.51 × 3.26 | −13.9% / +22.2% (prose: 41.9%) | no, loops broke |
| D | interlock | 0.94 | 13.67 × 5.73 | −13.9% / +28.9% | yes |
| E | interlock | 0.92 | 9.14 × 5.65 | −13.9% / +30.0% | yes |

The discussion on p. 8 also gives the cone as 55 **mm**, which supports the table against the 25/55 cm in the method. The author explains the direction effect: a loop pulled widthwise can open by its whole length, so lateral (course-direction) extension exceeds longitudinal. Compression and extension are hand-applied to "maximum without loop deformation", so the percentages are observational. The literature review gives a useful taxonomy, separating **multiple assemblies** (discontinuous linked parts that articulate, such as chain mail) from **continuous fibre-type geometry** (one interlooped route that stretches). It also quotes the earlier FDM knit attempt (Melnikova et al. 2014): nozzle extrusion produced "fine undesirable connections between stitches".

**Pattern implications.** For a planar knit-looking motif, the tabled loops give real height-to-width proportions of about 1.6–2.4. Expect more give across the courses than along the wales. The Melnikova quotation is a direct FDM warning: extruded loop routes can leave fine connections to their neighbours, so loop clearance must be checked against actual bead width and stringing, not CAD centrelines. Mallinson's swatches (squares, hemispheres, petals and leaves on an interlocking linked-loop base) are a precedent for decorative tiles on a flexible carrier; compare FlexScale (47), which is FDM. Beecroft does not state the swatches' process; Mallinson works at Digits2Widgets, the nylon SLS bureau that printed Beecroft's own tubes.

---

## Paper 5: Brad-2025 — Advances in Textile Manufacturing with 3D Printing Technology
**File Name:** `Brad-2025_Advances-in-Textile-Manufacturing-with-3D-Printing-Technology.pdf`

### 1. Summary & Core Focus
Brad (2025) provides a narrative overview of FDM, SLA, and SLS for textile applications, discussing common thermoplastics and resins, textile integration, and examples including chain structures, auxetic materials, and responsive systems. It surveys potential benefits such as customization and reduced cutting waste alongside challenges in scalability, flexibility, material choice, and process optimization. It is a short secondary overview, not a systematic review or original comparative experiment; it reports no new mechanical dataset. Use it for orientation and source discovery, not quantitative design rules or FilaFabric calibration.

### 2. Mathematical & Structural Formulations
None of its own. The only equation-like content is cited from others: a Kriging/Cuckoo-search optimum (31 mm/s, 225 °C) for PLA tensile bars, and a regression model for TPU meshes (Lu et al. 2022), which is reported but not reproduced.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **secondary source map** across printed-textile technologies. Its garment and auxetic examples are largely other authors’ work, not an original wearable/panel-assembly experiment. Follow the cited primary studies for bed-based geometry and process evidence; its examples do not validate FilaFabric mechanics or material settings.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 1-6, especially pp. 3-4, §2 and Figs. 1-2. **Status:** secondary background across S/M/N and excluded volumetric processes.

This overview compares FDM, SLA and SLS materials and summarizes other authors’ garments, chainmail, auxetics, biaxial weaves and print-on-fabric studies. Figure 2 includes downloaded PLA models printed as examples, but supplies no controlled process-to-mechanics investigation or original garment validation. **Proposed translation:** organize candidate flat-sheet tests by how compliance is achieved—thin fused lines, cut-like rotating ligaments, or textile-supported reinforcement—and trace numerical recommendations to their primary experiments. Its cited 31 mm/s/225 °C optimization concerns PLA tensile specimens, not general textile or Foamy settings. **Review correction:** the current takeaway calls this “a wearable design and panel-assembly precedent” and describes garment functionality; that wrongly shifts a secondary survey toward an original wearable case study. Retain it as a source map. Independent links, pressure-jammed chain structures and responsive bulk materials are contextual examples, outside the three target construction classes.

### 5. Second full-text pass — 24 October 2026

**Primary leads cited here but not held locally (PDF pp. 3–5).** These are worth retrieving before relying on the review's one-line summaries:
- **Lu et al. (2022)**, TPU flexible mesh for wearable interfaces. It relates *strand thickness, strand distance, rotation angle and layer height* to tensile strength, elongation at break and Young's modulus, with a regression model. This is the nearest cited study to a FilaFabric open-net parameter sweep.
- **Wirth, Shea and Chen (2023)**, biaxial "weaves" made by material jetting. Two-stage design of experiments; bilinear stress–strain that depends on load direction, weave pattern, yarn diameter and spacing; reduced delamination.
- **Spahiu et al. (2020)** (ref. 4): the review says they used FilaFlex, and its Fig. 1 caption describes printed parts assembled into a dress with stitches and belts. Jayswal-Adanur (23) and Sapkota (52) instead say the parts were joined with a Dikale 07A 3D pen; the primary would settle it. Brad does not name the arrowhead shape. Same material family as the Foamy profile, but not the foaming grade.
- **Lekeckas et al. (2023)**, TPU elements printed on chiffon, tested by uniaxial tension.
- **Jayswal et al. (2023)**, PLA weft knit (12–15 mm displacement, ~250 N peak) and braids. The primary work is in Paper 22.

**Pattern implications.** Fig. 2c, hexagonal PLA elements printed on nylon fabric from downloaded models, is a print-on-fabric tile example, not a free-standing net. The conclusion's claim that open fabrics such as tulle give the best adhesion is unsourced in this paper; use Loh and Pei (41) and Firicel (13) for evidence. No new FilaFabric pattern follows directly.

**Primaries checked, 26 October 2026.** Spahiu et al. is now Paper 68. Its Fig. 9 shows a needle-stitched mannequin trial, the dress joined by 3D pen, and belts added for dressing, so both descriptions above are partly right. Lu et al. 2022 (IEEE BioRob, DOI 10.1109/BioRob52689.2022.9925405) is now Paper 69. Brad's summary is accurate, but the regression covers only the 90° meshes and is weak for elongation and modulus.

---

## Paper 6: Chen-2021 — Bistable Auxetic Surface Structures
**File Name:** `Chen-2021_Bistable-Auxetic-Surface-Structures.pdf`

### 1. Summary & Core Focus
Chen et al. introduce a computational design system for flat-fabricated sheets that deploy into target doubly curved surfaces through optimized bistable auxetic cells. The method precomputes a cell library spanning in-plane expansion/contraction ratios, conformally flattens the target, tiles the 2D layout, then selects cells by local scale factor while favoring stiffness in the deployed state. Switching between stable cell configurations creates metric frustration that drives the assembled sheet toward its target shape. Physical prototypes validate deployment, including stable shapes without external supports. This is a laser-cut sheet-material mechanism, not an FDM textile net; its relevance is computational surface mapping and auxetic design methodology, not direct FilaFabric pattern validation.

### 2. Mathematical & Structural Formulations
Each regular hexagonal cell (edge $l_o$) holds chiral triangular units set by a cut inclination $\theta$ and a thickness $t$; the inner rotating triangle has edge $l_i$. A kinematic estimate of the second stable strain, checked against the typeset PDF on p. 4, is $\varepsilon_{bist} \approx \frac{2}{l_o}\, l_i \sin(\theta + \pi/6)$; the expansion factor is $\varepsilon + 1$. Nonlinear periodic homogenization (plane-stress neo-Hookean membrane, Poisson 0.45) then measures bistability, the energy barrier and the stiffness at the deployed state (Eq. 2). Ideal linkages reach factor 2; the finite hinges reach 1.129–1.775. Repeating the sweep with sheet Poisson 0.30 changed almost nothing: the tiling's response is set mostly by cell geometry, and Young's modulus only scales energies and stiffnesses.

### 3. Relevance & Design Takeaways for FilaFabric
Relevant as a **surface-shaping and auxetic-design precedent**, but not directly transferable to FilaFabric's FDM paths. The paper's cells rely on bistability, laser-cut elastic sheet material, and actuation between two stable configurations; FilaFabric's pattern presets do not reproduce those mechanics. Its conformal mapping and local cell-library selection may inform future surface-aware design concepts, but require a new implementation and physical testing.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 3-7, §§3-5, Figs. 2-6; Appendix II on p. 9. **Status:** S geometry/method transfer; fabrication is laser-cut rubber, not FDM.

Hexagonal cells contain six rotating triangular units linked by compliant hinges. Parameters are cut inclination and ligament thickness; finite-element homogenization locates the second stable state, its energy barrier and stiffness. Physical models use 2.3 mm rubber sheets, 0.125 mm cut width and 0.25 mm hinges; the demonstrated expansion-factor range is approximately 1.129-1.775. The conformal target map selects compatible local cells from a precomputed library. **Proposed translation:** a planar rotating-triangle lattice with independently variable neck width and opening angle, first evaluated as an ordinary compliant sheet. A calibrated cell library could later support regional stiffness choices. Bistability and deployed curvature require material-specific nonlinear verification: geometric resemblance is insufficient. The current master summary is sound but omits these useful geometric controls. Do not turn the paper’s laser kerf/hinge dimensions into FDM defaults or advertise shallow printed relief as equivalent self-deployment.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–8, §§3–5).** Parameter bounds: $\theta$ lies within ±π/6. Smaller values give a different, non-bistable mechanism; larger ones would need negative $t$. For each $\theta$, $t$ runs from $t_{min}$ (inner triangle fills the unit) to $t_{max}$ (inner triangle vanishes), with a fabrication floor of $t \ge 0.5$ mm. The library samples 43 $\theta$ values and steps $t$ by 0.01 mm. Hinge width $w = 0.25$ mm was the smallest that survived repeated opening and closing. **Graded tiling:** where neighbouring units have different $t$, the cut endpoints are averaged pairwise along their shared edge so the cuts meet. With a smooth scale field this correction is invisible. **Trade-off:** the same target can be made from different flat states. Lower expansion factors need a larger sheet but give a denser deployed surface, about 2× stiffer in the indentation test. Deployment cascades (opening one cell opens its neighbours), while flattening needs several cells held at once. The same cell also works contractively: printed open, it closes to a nearly solid surface. Proposed future work: mix bistable cells with passive ones, and warn when a target exceeds the admissible range, suggesting the closest feasible one. Example cell edge: $l_o$ = 10 mm.

**Pattern implications.** (1) *Rotating-triangle hexagon sheet* (extends S4): expose $\theta$, $t/l_o$ and hinge width as the three geometry controls, and use the published $\theta$ bounds as the range where the rotating mechanism exists. Bistability itself is not expected from a thin TPU net. (2) *Graded cell field rule* (extends M5): when a picture or field changes cell parameters, reconcile each shared edge between neighbouring cells, here by averaging, so walls stay continuous. This is a concrete connectivity rule for graded Voronoi, star or auxetic sheets. (3) The "closest feasible target" warning parallels FilaFabric's existing *Fix it* search.

---

## Paper 7: Cui-Sun-2018 — Hybrid Comfort 3D Printing Interwoven
**File Name:** `Cui-Sun-2018_Hybrid-Comfort-3D-Printing-Interwoven.pdf`

### 1. Summary & Core Focus
Cui and Sun report a research-through-design beach-vest case study using a hybrid textile-like structure that combines woven- and knit-inspired TPU geometry with conventional neoprene knit. The repeated hybrid unit was modeled in Rhino, checked for collisions, sampled at different dimensions, and printed as 2 × 4 inch pieces; printed lines were about 1.4 mm thick and the overall structure about 4 mm thick. Eight pieces were integrated into the vest by sewing them to the neoprene panels. The authors observed flexibility, resilience, porosity/ventilation, and cushioning potential, but note support material and post-print cleanup limited production.

This is a design case study, not a controlled comfort or durability trial. It demonstrates material/structure hybridization and garment integration, but does not quantify mechanical performance or wearer response; the authors call for further investigation.

### 2. Mathematical & Structural Formulations
The study describes a repeated hybrid woven/knit-inspired unit and reports prototype dimensions, printed line thickness, panel thickness, and sewing-based assembly. It does not derive a mechanics equation or measure a constitutive response.

### 3. Relevance & Design Takeaways for FilaFabric
Useful as a **hybrid-garment integration precedent**: FilaFabric could help designers generate or preview printed textile panels intended to be sewn into conventional fabric, while communicating thickness, porosity, support needs, and assembly boundaries. The article does not validate a specific FilaFabric pattern or prove that its structure improves comfort; its observations are limited to the described TPU/neoprene vest prototype.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 1-2, design/process description and findings. **Status:** method transfer toward M/N; original interwoven geometry requires supports.

The beach-vest study combines printed TPU weave/knit-inspired structures with conventional neoprene knit. Designers construct a unit, repeat it, check collisions and sample thickness/dimensions. Final printed patches measure 2 × 4 inches with approximately 1.4 mm lines and 4 mm overall thickness; eight patches are sewn into the vest. Porosity, cushioning and resilience are observed rather than established by controlled comfort testing. Support generation and removal are explicit production limitations. **Proposed translation:** a shallow two-layer fused zigzag/loop mesh with a flat reinforced sewing margin, varying window size and backing coverage while keeping thickness modest. This changes the original topology and must be labelled a fused translation, not replicated interweaving. The master accurately describes the garment example but should not imply its 4 mm supported architecture is already an admissible thin-sheet recipe. No nozzle settings or mechanics formula are supplied for direct reuse.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 1–2).** "Hybrid" here means one repeat unit that **joins a woven-mimicking zone to a knit-mimicking zone**, not hybrid materials. The three-step CAD loop is (1) imitate the woven and knitted structures, (2) connect the two into one repeatable pattern, (3) check the repeat for collisions. Iterations varied structure dimensions and thickness on TPU swatches, and the final patch was tested for resilience before use. Placement in the vest: six patches on the front midriff (three each side) and two on the back shoulder yoke, sewn into neoprene beside a waterproof zipper, so the printed zones sit where venting is wanted. The authors list minimum printable thickness and the need for supports as the FDM limits.

**Pattern implications.** A *two-structure repeat* (a grid zone and a loop zone sharing boundary nodes inside one tile) is a concrete S/M motif idea. It overlaps the zoned-transition proposal from Drews (11), but here the change happens within each repeat rather than across a garment. Keep it support-free and fused for FilaFabric. The supported 4 mm interwoven original is outside scope.

---

## Paper 8: Devendorf-Gelosi-2026 — Imagining Open Source Ecosystems for Experimental Weaving A View from the AdaCAD Project
**File Name:** `Devendorf-Gelosi-2026_Imagining-Open-Source-Ecosystems-for-Experimental-Weaving-A-View-from-the-AdaCAD-Project.pdf`

### 1. Summary & Core Focus
Devendorf, Gelosi, and Sandry analyze AdaCAD as an open-source ecosystem for experimental weaving. Their practice-based account draws on 60 semi-structured stakeholder interviews, iterative software/documentation changes, workshops, a three-day gathering with ten weaving/open-source experts, and observations of community growth (about 400 registered users by summer 2025). They discuss how a sustainable experimental tool requires more than code: documentation, teaching, contributor pathways, maintenance, funding, and shared definitions of “experimental weaving” shape participation. Workshop/community findings are partly anecdotal rather than systematically evaluated. This is a software-ecosystem study of weaving, not FDM; for FilaFabric it is indirect guidance on onboarding, open documentation, and participatory development, not technical evidence for print features.

### 2. Mathematical & Structural Formulations
No mechanics. The structural idea is AdaCAD's view of a draft as a **parametric sequence**. A twill is a row of values that shifts one unit left or right per pick, and drafts are built by chaining operations (shift, repeat, mirror, combine), which the authors liken to guitar pedals applied to a signal (PDF pp. 3, 8). Drafts export as WIF for dobby looms and other weaving software.

### 3. Relevance & Design Takeaways for FilaFabric
Indirect but concrete: FilaFabric's Weave card already builds bindings from rules such as `(i + j) % 4 < 2`. Exposing those as chainable, previewable operations, with the printed result shown beside the draft, follows AdaCAD's lesson that real-time parameter changes make conventions explainable. This does not validate FilaFabric's geometries, printer settings or material performance.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5-9, methods and §4. **Status:** indirect workflow transfer to S/M/N; no FDM geometry experiment.

AdaCAD’s ecosystem development combines sixty stakeholder interviews, documentation/software changes, workshops and a ten-expert gathering. Established weavers encounter a new parametric representation; newcomers can mistake the binary draft for the final cloth’s visible image. Responses include side-by-side translations, material samples, image-to-weave examples, workspace sharing and WIF export. Workshop observations are explicitly informal/anecdotal. **Proposed translation:** pair every S/M/N preset’s top view with an actual toolpath/layer explanation and a photographed calibration swatch; explain how image tone changes physical coverage rather than promising that source pixels reproduce unchanged. Expose continuous-path operations through reusable examples and shareable settings. This supports education and interoperability, not a mechanical rule or proof of a particular pattern’s printability. The master is broadly accurate but its generic relevance sentence could be replaced with these concrete teaching implications. Conventional loom drafts still need an explicit conversion before any fused printed sheet can be generated.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–9).** Registered users grew from about 100 at the start of the grant to about 400 by summer 2025. The authors cannot say how many used it more than once. To help newcomers who read the draft as a black-and-white graphic rather than machine instructions, they added **ready-made conversions** from a graphic to cloth (overshot, damask), loom-first tutorials (threading and treadling plans) and paper-weaving exercises. Image weaving is taught by contrasting AdaCAD with *The Woven Pixel* method. Established weavers valued the software being online and largely loom-agnostic, so one design can move between the looms available in a class.

**Pattern implications.** No new geometry. For FilaFabric's picture and weave workflows: offer named, ready-made conversions from an image to a printable structure (for example tone → line width, or tone → binding density) rather than one implicit mapping, and keep the conversion visible. Also show when a requested draft is not feasible for the chosen printer or material, as AdaCAD users met with loom limits.

---

## Paper 9: Diak-Diak-2024 — Features and Limitations of FDM in Textile Like Structures
**File Name:** `Diak-Diak-2024_Features-and-Limitations-of-FDM-in-Textile-Like-Structures.pdf`

### 1. Summary & Core Focus
Diak and Diak provide a critical, experience-informed review of FDM constraints in making fine textile-like structures; it is not a controlled parameter experiment. They argue that textile-like behavior depends on thin, continuous, homogeneous extruded “f-fibres,” while conventional printers are optimized for fused layers. Their discussion covers first-layer adhesion and bed flatness, nozzle geometry and flow, material moisture and rheology, under-extrusion, sagging/bridging in later layers, and TPU feeding limitations. They cite a target fibre diameter near 0.1 mm, while noting practical FDM ranges and the difficulty of producing such paths consistently.

The paper gives conditional design guidance: thin single-layer paths demand precise nozzle gap and a flat bed; the authors say bed deviations above about ±50 μm make lines below 0.3 mm and 0.1–0.2 mm high unpredictable without a raft. They discuss DefeXtiles as an under-extrusion “drop-and-hairline” process, but note anchor drops and short hairlines are integral to that method. For grids, upper layers bridge between sparse supports and can sag or break; increasing layer count/height compromises flexibility. Their suggested limits for total thickness (<0.5 mm), fibre width (<200 μm), and layer count at different heights are the authors’ synthesis, not universally validated thresholds. TPU is especially challenging: they cite direct-drive feeding, low speeds, careful extrusion/temperature calibration, and a narrow usable process window, with results dependent on Shore hardness and filament.

The paper’s scope is a technical analysis based on prior work and practical reasoning, without a new standardized mechanical dataset. Some numerical recommendations are therefore hypotheses or experience-based guidance and need printer/material-specific verification. Its strongest contribution is a useful failure-mode map and reminder that visual textile resemblance does not establish textile-level flexibility, strength, or durability.

### 2. Mathematical & Structural Formulations
The paper does not formulate weave topology or a predictive constitutive model. It describes process constraints qualitatively and through geometric quantities: nozzle gap/bed flatness relative to fibre width and layer height; extrusion coefficient and feed rate controlling the under-extrusion drop/hairline effect; and unsupported span between contact points controlling sagging and breakage. The cited thickness/fibre-width/layer-count thresholds are practical rules proposed by the authors, not universal equations.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **highly relevant printability and calibration reference** for FilaFabric’s thin textile toolpaths. It reinforces checks for minimum feature width, path continuity, bed adhesion, unsupported spans, layer count, and flexible-filament feed stability. It is particularly useful for explaining why an apparently valid design can still fail in extrusion or release from the bed. Treat its thresholds as test hypotheses, not certified MK3S/Filaflex Foamy limits: the article is a review/technical analysis, and FilaFabric’s exact nozzle, material, profile, and path geometry require their own calibration. It does not substantiate weave-analysis or conformal-mapping features.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 4-6 and 10-12, §§3.1-3.4, Figs. 2-4 and 9-10. **Status:** directly useful S/M process analysis.

The authors distinguish thin fused grids from independent woven threads and describe practical failure modes rather than a standardized calibration experiment. Bed deviations above approximately ±50 μm are problematic for narrow first-layer strands; upper grid layers bridge between contacts and can sag or break. Their suggested total thickness below 0.5 mm and strand width below 200 μm are conditional author guidance, not universal textile requirements. Same-layer crossings can disrupt strand continuity. **Proposed translation:** compare S continuous waves/meanders against M orthogonal and angled bonded grids, recording actual line width, unsupported span, bond area and released thickness. Sweep span and layer height together; inspect both crossing integrity and bed release. Upright DefeXtiles is discussed in the source but remains excluded here. The earlier summary’s failure-map interpretation is accurate; its numerical thresholds should remain hypotheses to test, particularly for foaming filament whose deposited dimensions differ from nominal settings.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–12).**
- **Layer budget by layer height** (p. 12, author guidance for a grid like Fig. 9A, total height < 0.5 mm, fibre width < 200 μm): Lh < 150 μm allows at most 3 layers; Lh < 100 μm up to 5; Lh < 50 μm up to 7.
- **Upper-layer bridging** (p. 11): second and later grid layers touch the layer below only at crossing points. Thin, sparse strands break between those points. This matters less below about 100 μm layer height or at higher grid density, and gets worse (sag, breaks) as layer height rises.
- **Same-layer crossings** (p. 11, Fig. 9E): printing both warp and weft directions in one layer disrupts the strand at every intersection. The authors do not recommend it unless necessary, because covering the defects with duplicate layers makes the sheet rigid. This bears directly on FilaFabric's coherent layered pipeline, which first places all path families at the first deposition height and then settles later strands over crossings (see the audit).
- **First-layer failure catalogue** (Fig. 2C): (c1) width/height inconsistency, (c2) strand breaks, (c3) strand pressed into the bed (height → 0, width grows, print cannot be removed), (c4) "spaghetti" mid-air extrusion, (c5) warping. Bed adhesives work above about 1 mm structure height but make removal of structures under 0.4 mm laborious and risky. Clean the bed between materials.
- **TPU specifics** (pp. 8–9): direct drive, low speed (< 15 mm/s), much lower acceleration and jerk. Below about Shore 80A the filament sticks inside the hotend tube, so a smooth PTFE-lined path is needed. The usable temperature window is only about ±5 °C. Retraction (deliberate strand breaks) gets harder at lower Shore and higher temperature. Thinner TPU strands come mainly from a smaller nozzle (problems mitigated "even at 0.2 mm" with precise temperature, speed and extrusion) rather than from under-extrusion. Printed TPU strands showed high porosity where PLA was homogeneous (Fig. 6).
- **Under-extrusion** (pp. 6–7, 12): flow reductions of 10–20% to 50–70% give "drop and hairline" strands. DefeXtiles' anchor drops are about 0.5 mm, hairlines about 45 μm and shorter than 2 mm. An under-extruded 200 μm strand on an imprecise machine can be weaker than a homogeneous 100 μm one.
- **Mixed rigid and fine elements** (p. 11, Fig. 10): volumetric rigid PLA or PA6 parts were printed in the same job as a fine strand mesh.

**Pattern implications.** Treat the layer budget as a default *warning* threshold, not a rule. For Foamy TPU, the authors' TPU advice favours a smaller nozzle over flow reduction to thin strands. The same-layer-crossing warning gives a literature reason to report FilaFabric's actual crossing heights and to compare a true two-plane crossing against the current settled crossing on swatches. Rigid nodes or tabs inside a fine mesh (Fig. 10) are a candidate M detail for fastener points or edge anchors.

---

## Paper 10: Diak-Diak-2025 — 3D Printed Textile Concept and Production Challenges
**File Name:** `Diak-Diak-2025_3D-Printed-Textile-Concept-and-Production-Challenges.pdf`

### 1. Summary & Core Focus
Diak and Diak (2025) review printed “quasi-textiles,” propose explicit criteria for evaluating textile-likeness, and report prototype FDM mesh/net structures made mainly with PLA and PA6. Their criteria cover independent functional elements and their discrete connections, mass/thickness/dimensions, repeated bending flexibility, and tensile strength. They recommend standardized bending and tensile methods and normalization by cross-sectional area, addressing a major problem in the literature: many studies report incomplete and non-comparable specimen geometry, mass, and mechanical data.

Their prototypes compare one- and two-layer mesh/wave/line structures and materials, reporting sample thicknesses of 0.26–0.36 mm (Table 4, checked against the typeset PDF; an earlier reading of a footnote mark as "1 mm" was wrong), densities of 174–258 g/m², flexural rigidity values, and breaking forces around 23.8–44.5 N for the tabulated cases. The authors also document process defects: nominal 0.4 mm nozzle/line-width settings can yield effective widths ≥0.48 mm; reducing nozzle size and flow complicates continuity; reduced flow creates irregular/drop-like fibres; higher speed distorts curved paths; moisture produces surface craters; TPU hardness changes feeding/stringing behavior; sparse upper-layer strands sag; and dissimilar melting temperatures can undermine bonding. They report initial-layer fibre widths down to roughly 0.15 mm in optimized trials, but stress reproducibility and material dependence.

This is a conceptual review plus a limited prototype study, not a validated universal test standard or a demonstration that printed meshes substitute for conventional cloth. Its proposed threshold values (for example, tensile strength above 1 MPa and cycle-based bending criteria) are author-proposed screening criteria. Use them as a framework for validation, not established industry requirements.

### 2. Mathematical & Structural Formulations
The proposed textile-likeness criteria (PDF pp. 3–4, §2.3), checked against the typeset page:
1. **Independent elements** joined only at discrete points, by weaving or bonding.
2. **Areal density** within textile-like bounds: conventional textiles are 20–700 g/m²; printed structures may reach about 1500 g/m².
3. **Flexibility:** a strip about 10+ cm × 1 cm should deflect more than 2 cm under its own weight (ASTM D1388); stiffer samples are tested by ASTM D4032 or D790. It should survive at least 100 full 180° bend–unbend cycles without severe creasing or element failure. Bending stiffness is reported in N·m.
4. **Strength:** breaking force normalized by cross-section, above 1 MPa for cross-sections under 1 mm². Worked example: 0.5 mm × 10 mm = 5 mm²; 4 N gives 0.8 MPa, which fails. Specific breaking force is $F_r = F/(\rho \times w)$, with $\rho$ the areal density (g/mm²) and $w$ the specimen width, in N·mm/g (ASTM D5034/5).

The paper's proposed assessment framework measures f-fibre width/diameter, structure thickness and areal density, flexural rigidity, repeated bend–unbend performance, and tensile breaking force normalized by cross-sectional area. It classifies structures by element type and connection method (e.g., chainmail/interlooped, woven, mesh/net, single-layer, or geometric). Its prototype observations relate nozzle diameter/effective line width, flow, speed, material, layer count, spacing, and temperature to continuity, sagging, stringing, and thermobonding. These are measured/proposed criteria and process observations, not a constitutive model.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **highly relevant evaluation and printability reference** for FilaFabric. The proposed reporting set—actual strand dimensions, thickness, areal mass, bending stiffness, cyclic damage, and normalized tensile strength—could make FilaFabric swatch comparisons more meaningful and prevent “textile-like” from being used as an unsupported performance claim. Their defect analysis also maps directly to path width, spacing, layer count, bridging, speed, moisture, and flexible-filament settings. The authors' measurements used their own prototypes/materials; values and thresholds must not be treated as MK3S/Filaflex Foamy guarantees. This paper does not substantiate FilaFabric's weave-analysis or conformal-mapping features.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5-10, Tables 3-4, Figs. 2-10 and §4.2. **Status:** direct S/M pattern and printability evidence.

Table 3 distinguishes a two-layer thermobonded mesh, single-layer waves/meanders, two-layer line-plus-hexagon and line-plus-step structures. These are fused networks without true interlacing. Experiments document irregular low-flow strands, speed-dependent rounding of steps, sagging upper strands, moisture damage and weak single-layer interfaces. The source reports actual optimized widths around 0.15 mm while acknowledging roughly 0.25 mm practical limits on less precise machinery. **Proposed translation:** add these specific continuous-wave, meander and step-over-straight-line families to a planar swatch comparison, exposing pitch, turn radius, bond frequency and backing direction. Treat bond quality and curvature fidelity as separate outcomes. Proposed textile-likeness strength/bending criteria are the authors’ framework, not an adopted standard. The master is accurate but misses this directly usable pattern vocabulary. Beware extraction errors: several micrometre quantities appear as “mm” in extracted text; do not copy those units without examining the original typesetting.

### 5. Second full-text pass — 24 October 2026

**The five tested models (Table 3, Fig. 2; outline 67 × 10 mm each).** These are directly usable as FilaFabric swatch families:

| Model | Layers | Construction |
|---|---|---|
| Mesh/Net | 2 | Free-running straight lines in two directions, thermally bonded at some intersections, with no interlacing. |
| Wave | 1 | Single-layer waves bonded to their neighbours. |
| Line/Hexagon | 2 | Straight first-layer lines; second-layer hexagon network bonded to the lines and to itself. |
| Line/Step | 2 | Straight first-layer lines; a second-layer zigzag "step" path that ties the free first-layer lines together. |
| Line/Meander | 1 | Single-layer meander bonded to its neighbours. |

**Measured results (Table 4, typeset values).** PLA mesh .1: 0.36 mm, 258 g/m², 44.5 N, 12.36 MPa. PLA .2: 0.28 mm, 187 g/m², 23.8 N, 8.50 MPa. PA6 .1: 0.35 mm, 248 g/m², 42.4 N, 12.11 MPa. PA6 .2: 0.26 mm, 174 g/m², 25.5 N, 9.66 MPa. Flexural rigidity runs from 2.87 × 10⁻⁵ to 1.58 × 10⁻³ N·m. All pass the authors' proposed 1 MPa strength bar.

**Process limits (§4.2).**
- Line width: a 0.40 mm line-width setting gives an effective width of at least 0.48 mm. First layers get hard below a 0.3 mm nozzle and are nearly impossible below 0.15 mm without very precise machines. The practical floor on mid-range printers is about 0.25 mm effective width; optimized PLA reached about 0.15 mm (Fig. 5a).
- Flow: reducing flow to narrow the line gives wave-like or droplet strands (Fig. 5b).
- Speed: in a 10–50 mm/s test, higher speeds rounded off the "step" corners laid over the lower layer (Fig. 6a–b).
- TPU hardness: Shore 95A, 82A, 70A and 60A were compared. Softer TPU strings badly at discontinuities, and retraction is avoided for features up to 1.5 mm, which leaves stringing.
- Smallest reproducible features: hexagons of 0.8 mm (small) and 1.6 mm (larger) inner diameter (Fig. 8).
- Bonding: single-layer joints are often weak; slowing down improves fusion. Two different materials bond only if their melting points are similar, or the upper layer melts higher than the lower (Fig. 10).
- Sagging of second-layer strands depends on material, attachment spacing and strand thickness.
- For comparison, SLS strands needed at least 500 μm to survive; SLA reached about 300 μm but was weak.

**Pattern implications.** Line/Step and Line/Hexagon are explicit M constructions in which **a second-layer path is chosen specifically to tie down the free first-layer lines**. That is the same role as FilaFabric's carrier/motif distinction, and a concrete pair to compare against Crosshatch and Squiggle. Use the 1 MPa, 100-cycle, 2 cm self-weight-deflection and areal-density criteria as the reporting template for FilaFabric swatches, with the caveat that they are the authors' proposal, not a standard.

---

## Paper 11: Drews-2026 — Including the Hybrids The Thread Arrangement as a Lens for Manifesting Textile Designers Agency
**File Name:** `Drews-2026_Including-the-Hybrids-The-Thread-Arrangement-as-a-Lens-for-Manifesting-Textile-Designers-Agency.pdf`

### 1. Summary & Core Focus
Drews (2026) proposes “thread arrangement” as a practice-focused lens for describing textile structures that combine or cross conventional categories such as woven, knitted, braided, and nonwoven. The argument is grounded in practice-based doctoral work developing weave/knit hybrids and in a broader discussion of how classification systems make some textile possibilities visible while excluding others. It emphasizes designers’ agency in selecting both material and structural arrangement, and treats embodied making knowledge as part of textile research. This is conceptual/theoretical work, not a fabrication or mechanical study; it supports flexible, non-exclusive naming in a structure library but does not verify FilaFabric geometry or performance claims.

### 2. Mathematical & Structural Formulations
No formulation. The structural content is a conceptual spectrum (Fig. 2, PDF p. 8): one thread can run as a straight line, interlace, form loops of different sizes or form knots, and can change between these along its route. A weave/knit hybrid is a textile whose threads switch arrangement at zone boundaries.

### 3. Relevance & Design Takeaways for FilaFabric
Useful for naming. Describe each FilaFabric route by what the strand does along its length (straight, crossing, looped, tied or bonded) and where it changes, rather than forcing a weave/knit/net label onto a card. This does not validate FilaFabric's weave analysis, crossing checks or exported toolpaths.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 7-11, §§3.1-4, Figs. 2-3. **Status:** conceptual transfer to S/M/N; conventional yarn-based manufacture.

The paper develops “thread arrangement” to describe structures crossing weave/knit/nonwoven categories. Its practice examples seamlessly transition straight/interlaced yarns into interlooped zones: a trouser closure accommodates waist variation, and a saddle cover gains local stretch. Those examples ground a conceptual classification discussion; they are not printed lattices or quantitative mechanical comparisons. **Proposed translation:** a planar specimen transitioning from straight fused grid to serpentine/loop-shaped paths, with shared boundary nodes and gradual changes in pitch/neck width, to investigate regional compliance without adding upright elements. For M, a constant backing can hold a changing decorative face together. This is a design hypothesis inspired by zoned arrangements, not demonstrated knit mechanics or a new named printable weave. The master correctly avoids performance claims but understates the concrete transition idea. Classify the resulting printed structure by its bonded connections and layers, since a knit-like outline does not make it interlooped knitting.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 6–12).** Collingwood's **weft looping** (Fig. 1) is cited as a structure that is interlaced and interlooped at once. Weft loops are pulled up or chained between warps, and removing the warp and plain weft would leave ordinary weft knitting. The author also points to **bias elasticity in weaves** (Penava et al. 2020) as evidence against the "rigid weave, stretchy knit" dichotomy, and to fulling, where fibres felt onto a woven base. The hybrid prototypes join rigid woven sections to flexible knitted sections with continuous threads: a trouser front whose knitted section closes and adapts to waist size, and a saddle cover whose knitted zone stretches over the saddle.

**Pattern implications.** (1) A *weft-loop motif* for M: a straight carrier family (warp-like) with a second route that makes small closed or chained loops between carrier lines. It is a printable, fused analogue of Collingwood's pulled-up loops, and a sibling of Bouclé/picots on a carrier. (2) The bias-elasticity point supports testing every FilaFabric grid at 45° as well as along its axes; the catalogue's swatch protocol already asks for bias tests. Both are proposals; the paper reports no printed or measured structures.

---

## Paper 12: Eutionnat-Diffo-2019 — Stress Strain and Deformation of PLA on PET Woven Fabric
**File Name:** `Eutionnat-Diffo-2019_Stress-Strain-and-Deformation-of-PLA-on-PET-Woven-Fabric.pdf`

### 1. Summary & Core Focus
Eutionnat-Diffo et al. experimentally characterize PLA deposited onto PET woven fabric as a polymer–textile composite (3D-PPOT), comparing virgin and carbon-black conductive PLA. Rectangular 50 × 200 × 0.1 mm tracks were printed onto PET fabrics with different weave patterns, weft densities, orientations, and platform temperatures (25, 60, 100 °C), using a 0.4 mm nozzle and 3600 mm/min speed. The study combines tensile testing, surface-deformation measurements, thermal analysis, factorial design/statistical modeling, and a 40 °C wash cycle. It therefore examines not just the printed track, but how substrate structure and process conditions jointly determine composite behavior.

The PLA track typically broke first at about 0.5–3.5% strain and 50–250 N; the PET fabric failed later at approximately 20–35% strain and 300–500 N. Printing reduced the fabric's permanent, elastic, and total surface deformation by roughly 88%, 85%, and 87%, respectively, making the composite stiffer and more dimensionally stable but less compliant/drapable. Fabric direction had the largest contribution to track stress; cross-direction printing bonded better and resisted stress more than machine-direction printing in this PET setup. Platform temperature, weave, and weft density also significantly affected stress; higher bed temperatures improved polymer penetration/adhesion but increased PLA crystallinity and could reduce track tensile stress. A single 40 °C wash did not materially reduce PLA-track stress/strain, but did reduce the fabric component's tensile performance. The authors provide regression models for their tested factor ranges, not general material laws.

The central result is a design trade-off: printed reinforcement can stabilize fabric but suppress its deformation, and adhesion, strand failure, and substrate failure are coupled. The conclusions apply to thin PLA tracks on the studied PET woven substrates, not free-standing FilaFabric paths or TPU/Foamy settings.

### 2. Mathematical & Structural Formulations
Stress is computed as force / (thickness × 25 mm specimen width) (Eq. 2). Crystallinity is melting enthalpy / 93 J/g × 100 (Eq. 1). Equations 3–12 are second-order regressions (R² about 0.80–0.90) of PLA-track stress against platform temperature and weft density, or against the fabric's pre-print surface deformation. They are fitted only within 14–22 picks/inch and 25–100 °C. These are data fits for one PLA/PET set-up, not material laws, and the source swaps the X/Y labels when stating the bounds.

### 3. Relevance & Design Takeaways for FilaFabric
This is **highly relevant to any FilaFabric use involving printing onto fabric or adding printed reinforcement to a textile**. It supports exposing substrate orientation, weave density/type, and bed temperature as interacting factors and measuring both adhesion and retained fabric flexibility, rather than optimizing bond strength alone. It also warns that improved stabilization may mean reduced drape, and that washing can damage the textile even when the printed track remains intact. Its PLA/PET results and printer-specific regression models cannot be transferred to FilaFabric's current TPU/Foamy free-standing textile workflow without new tests.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 2-3, 6-9 and 13-15, Tables 1-4, §§Results/Conclusions. **Status:** M hybrid-interface evidence; not free-standing mesh validation.

Thin PLA and conductive PLA tracks are printed on PET plain/twill fabrics, varying weft density, orientation and platform temperature. The PLA track breaks before its textile backing: approximately 0.5-3.5% versus 20-35% strain in the examples. Direction changes interface failure; machine-direction tracks can delaminate while cross-direction tracks bond better. One 40 °C wash leaves track stress/strain broadly unchanged but damages the textile component’s performance. **Proposed translation:** print sparse planar reinforcement/lace on fabric with untreated control regions and compare retained flexibility, delamination and substrate failure, rather than optimizing adhesion alone. Factors include substrate direction, bond coverage and temperature. The reported regression equations are fitted to particular PLA/PET data, not transferable constitutive laws; source prose also reverses the labelled X/Y bounds near those equations, so reconstruct carefully from the experimental factors. The earlier summary’s substantial summary is broadly sound; no new FilaFabric formula should be inferred.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–15).**
- **Set-up:** Wanhao Duplicator 4/4x, Z offset 0 (nozzle set at the textile surface), 20% infill, 3600 mm/min, 0.4 mm nozzle, climate 20 °C / 65% RH. Fabric: 80 × 225 mm pieces laid on the metal bed. Warp is twisted PET multifilament (Nm 40), weft is 0.2 mm PET monofilament, warp density 20 picks/inch, weft 14/18/22 picks/inch, plain or twill 2/2.
- **Direction explained:** cross-direction tracks bond and resist better because PLA adheres better to the **monofilament weft** than to the twisted multifilament warp. In the machine direction the track cracks across the width and delaminates. Direction accounts for about 66% of the track-stress variance (Table 5).
- **Means:** fabric 34.5 MPa / 34.3% strain; PLA track 8.7 MPa / 2.2%; conductive track 9.1 MPa / 2.1%.
- **Crystallinity** rises from 5.0% to 7.0% to 14.5% at 25, 60 and 100 °C platform temperature (Table 8). Higher platform heat improves penetration and adhesion but lowers track stress.
- **Fabric before printing:** twill 2/2 deforms more than plain, which the authors attribute to its floats; higher weft density reduces deformation.
- **Nozzle-pressure test:** a 1.8 mm Universal Surface Tester stylus at 60 mN simulates nozzle pressure on the fabric. The fabric's pre-print permanent, elastic and total deformation predicts track stress quadratically (Eqs. 7–12).

**Pattern implications.** For a future print-on-fabric mode, record substrate *yarn type per direction* (monofilament or twisted multifilament), not just weave and density, and align critical printed lines with the direction that bonds best. A quick substrate press test at nozzle-like load is a cheap pre-screen. The float/flexibility observation supports the catalogue's float-length cautions for woven bindings. PLA values do not transfer to TPU.

---

## Paper 13: Firicel-2025 — Influence of FDM Parameters on Printing onto Textile Substrates
**File Name:** `Firicel-2025_Influence-of-FDM-Parameters-on-Printing-onto-Textile-Substrates.pdf`

### 1. Summary & Core Focus
Firicel, Ionesi, and Loghin (2025) review printer-side FDM settings that influence adhesion when thermoplastic is deposited directly onto textile substrates. From an approximately 48-paper screening, they selected 18 studies that explicitly varied settings such as nozzle/bed temperature, nozzle-to-substrate distance (Z-distance), speed, flow, and first-layer orientation. This is a critical synthesis rather than a new experiment: the reviewed studies use different polymers, fabrics, sample geometries, and adhesion tests, so the authors deliberately avoid presenting their outcomes as one directly comparable quantitative dataset.

Across the reviewed work, the first layer and its interaction with fabric dominate. Reduced Z-distance generally increases pressure and polymer infiltration/mechanical interlocking, but excessive proximity risks nozzle clogging and depends on fabric thickness and compressibility. Higher nozzle temperature and slower printing often improve bonding by keeping polymer less viscous and in contact longer; increased bed temperature can also help, although excessive heat can deform a print. Evidence on flow is mixed or often indicates little effect in tested ranges. Orientation and substrate structure matter: porosity, roughness, weave, fiber composition, and thermal conductivity alter infiltration and heat transfer. Washing can materially reduce adhesion, and porous/rough fabrics may improve bonding but worsen abrasion resistance. The review notes that standard peel tests can tear or bend specimens; perpendicular tensile tests may better isolate interface adhesion in some cases.

The review identifies important gaps: inconsistent adhesion test protocols impede comparison; fan cooling is often unreported despite its likely effect on first-layer heat and bonding; speed effects remain underexplored; and layered soft/hard material strategies need further study. It also cautions that findings attributed to infill may actually reflect experiments that removed or changed bottom layers, thereby changing the true interface. These are cross-study trends, not a universal parameter recipe: substrate and material-specific testing remains necessary.

### 2. Mathematical & Structural Formulations
The review treats adhesion as a coupled thermal and mechanical interface problem, without proposing a single governing equation. Lower Z-distance raises contact pressure and can drive melt into fabric pores; nozzle temperature, bed temperature, speed, and cooling affect melt viscosity, contact time, and solidification. Reported effects vary by polymer/fabric pairing and test method; the authors explicitly note that no pooled quantitative model can be justified from the heterogeneous literature. They distinguish interface adhesion from bulk properties such as infill strength and note that peel, shear, and perpendicular tensile tests impose different failure modes.

### 3. Relevance & Design Takeaways for FilaFabric
This review is **highly relevant to FilaFabric's printer/material setup and any future print-on-fabric workflow**, but less directly to free-standing swatches printed only on the build plate. It supports making first-layer Z-offset, temperature, speed, and cooling explicit in substrate-specific presets and test protocols; it also warns against assuming a single flow or infill change guarantees better bonding. For current Foamy calibration, the useful action is to preserve clear separation between established direct-bed print settings and unverified textile-bonding recommendations. If FilaFabric adds fabric-backed printing, it should offer a substrate test swatch and record fabric type, weave, compressibility, orientation, temperature, Z offset, and wash/abrasion outcome rather than advertise a universally “best” setting. The source is a review, and its underlying experiments are heterogeneous; its trends must not be treated as validated MK3S/Filaflex Foamy values.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 3-5 and 8-12, §§2.1-2.5. **Status:** M substrate/process transfer; secondary review.

The review emphasizes nozzle-to-fabric gap, thermal conditions, speed and first-layer contact. Effects vary between fabric/polymer combinations; an apparent “infill” effect may actually result from removing bottom layers and exposing infill as the interface. Tests also differ—peel, shear and perpendicular pull introduce different deformations and failure modes. Fan operation is often unreported. **Proposed translation:** a lace-on-backing swatch matrix with controlled contact coverage, first-layer orientation, nozzle gap and cooling, accompanied by peel and retained-bend observations. Preserve bare-fabric controls and label failure as bond, strand or substrate failure. The review supplies no universal optimum and no original FDM calibration. Its p. 11 description of DefeXtiles as support-free should not override the primary paper’s supported flat-wall example; that upright method is outside the target. The master already captures the principal interface cautions; add explicit cooling metadata and contact-area geometry to make its advice actionable.

### 5. Second full-text pass — 24 October 2026

**Study-level findings the review reports (PDF pp. 4–12).** These are secondary summaries; check the primaries before reuse.

| Primary study | Finding |
|---|---|
| Döpke et al. 2016 (PLA on knits) | Nozzle 0.4–1 mm: larger nozzles adhered better; Z distance mattered; flow and bed temperature hardly did. |
| Spahiu et al. 2017 | Slowing from 37.5 to 22.5 mm/s helped slightly; 200 → 220 °C helped more; bed 20 → 60/100 °C helped most, but 100 °C deformed prints; a 40 °C wash left adhesion unchanged. |
| Hashemi Sanatgar et al. 2017 | Bed temperature matters only above the textile's glass transition. |
| Spahiu et al. 2018; Meyer et al. 2019 | Z distance can be raised slightly at higher temperatures (thermal expansion), and should be set from fabric **compressibility**, not thickness alone. |
| Eutionnat-Diffo et al. 2020a/b | Rougher, more porous, less conductive fabrics adhere better; platform temperature has a quadratic effect; adhesion falls about 50% after washing. Porous fabrics worsen abrasion, and print direction did not affect abrasion. |
| Mpofu et al. 2020 | Adhesion rises with extrusion temperature and falls with speed and with model height. |
| Kozior et al. 2018; Redondo et al. 2020 | First-layer orientation matters: 90° best on cotton in one study, 45° best in a peel study. Conflicting, so test locally. |
| Cakar & Ehrmann 2023 | On viscose, the softest TPU (82A) adhered best while 85A/98A resisted stabbing better. This suggests a **soft-first, harder-above** layer strategy. |
| Rivera et al. 2017 | Straight printed segments with a built-in channel and bend angle roll up when a string is pulled through them; fabric fixing on the bed is a recurring problem. |

**Pattern implications.** (1) *Drawstring channel segments* (Rivera): a row of printed tiles with an internal channel, shaped by a pulled cord. This is a post-print shaping idea for a hybrid mode, not a free-standing FilaFabric net. (2) *Soft-first stacking:* for any future two-material sheet, put the softer, better-bonding material in the first layer. (3) Record fan status and first-layer orientation with every substrate swatch, since the literature leaves both unreported or contradictory.

---

## Paper 14: Forman-2020 — DefeXtiles Quasi Woven Fabric via Under Extrusion
**File Name:** `Forman-2020_DefeXtiles-Quasi-Woven-Fabric-via-Under-Extrusion.pdf`

### 1. Summary & Core Focus
Forman et al. introduce DefeXtiles, a method for printing thin, breathable, tulle-like quasi-woven sheets on an unmodified desktop FDM printer by intentionally exploiting under-extrusion. At a suitable extrusion multiplier, periodic deposits form thicker quasi-warp pillars connected by fine stretched strands that act as quasi-weft. The authors explain that gaps reduce bending stiffness, while slender connecting strands hinge to permit in-plane stretch. The structure is not equivalent to conventional woven fabric: it lacks sewability and equivalent softness and has directional behaviour, including bias stretch. The study characterizes process parameters and materials, and demonstrates flat, curved, pleated, and 3D forms, surface patterning, conductive traces, garments, heat bonding, and other applications.

The approach's appeal is speed and accessibility: the paper reports approximately 0.286 mm textile thickness and printing up to 12,000 mm/min, including a 70 m × 10 cm roll produced in a single long print on a Prusa i3 MK3S. Examples use multiple materials, including PLA, TPU, PETG, ABS, and nylon, but settings and resultant behaviour are material-dependent. In one PLA flat-sheet example, the textile process uses an extrusion multiplier of 0.3 versus 1 for support pillars, with a slight nozzle-height adjustment to initiate gap-stretch behaviour. Print direction controls pillar lean; alternating direction produces straighter columns. Density/opacity can be varied through separate processes with different extrusion multipliers. Annealing PLA increases tensile strength but slightly reduces flexibility.

These are demonstrations and characterization experiments, not a universal recipe for every printer/material combination. Sharp corners may fail, and the authors report overhangs beyond about 45° as unprintable in their tests. Because the process relies on deliberate discontinuity and under-extrusion, consistency, bonding, and mechanical properties must be validated for the intended use. Its core contribution is to reinterpret a common FDM failure mode as a controllable textile-forming process.

### 2. Mathematical & Structural Formulations
No closed-form model. The authors explain the behaviour qualitatively: gaps lower the bending stiffness compared with a solid sheet of the same thickness, and the thin quasi-weft strands act as hinges that allow in-plane stretch, as in kirigami. The process map is extrusion multiplier × print speed (Fig. 12): for PLA at 210 °C, gap-stretch starts near a multiplier of 0.8 and fails near 0.3.

### 3. Relevance & Design Takeaways for FilaFabric
This is **calibration-method transfer only for the current brief**. DefeXtiles builds an upright wall from under-extruded glob stacks and connecting fibres, outside classes S/M/N. Its useful lesson is to measure a repeatable relationship between material, extrusion, speed and the resulting deposited feature; that lesson can inform separate bed-based trials. It does not validate Zigzag, Halftone Net, a flat pseudo-weave, or the Foamy profile. Upright wall fabrication is not a proposed library extension here.


### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 4-6 and 9-10, working principle, design space and characterization. **Status:** excluded upright wall/glob-stack printing; process-method transfer only.

DefeXtiles stacks under-extruded globs vertically into quasi-warp columns joined by thin stretched quasi-weft. Printed sheet thickness is not the layer height of a bed-flat textile. The flat-sheet example includes support pillars; print direction controls column lean. A 210 °C PLA study uses 0.2 mm layers, 0.4 mm nozzle and varying extrusion/speed to find a viable glob-stretch window; mechanical response is strongly directional. **Proposed translation:** borrow the experimental method of jointly calibrating speed, deposited width, continuity and opacity for S/M sheets, without reproducing the glob-stack geometry. Any planar sparse-flow pattern is a new experiment, not validated DefeXtiles. **Review correction:** downgrade “high-relevance process precedent” for Zigzag/Halftone/Spacer nets and state the upright build explicitly. Its long-roll, overhang and under-extrusion results cannot be presented as evidence that a planar Foamy net will behave similarly. No direct upright pattern is admissible under this review’s scope.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 4–10).**
- **Per-material settings** (Table 2; all at 1,250 mm/min, 0.4 mm nozzle except conductive PLA at 0.6 mm):

| Material | Extrusion multiplier | Nozzle / bed °C |
|---|---|---|
| PLA | 0.25 | 215 / 50 |
| PETG | 0.35 | 240 / 90 |
| TPU | 0.30 | 220 / 50 |
| ABS | 0.35 | 255 / 100 |
| PA | 0.40 | 250 / 75 |
| Conductive PLA | 0.85 | 215 / 50 |

  The parameter sweep (5 × 5 cm PLA, 210 °C, 0.2 mm layers, 0.45 mm width) says gap-stretch starts at a multiplier of 0.8 and fails near 0.3, while Table 2 recommends 0.25 for PLA at a slower speed. Treat that as a speed-dependent inconsistency, not a single window. TPU gave the best strength and flexibility but needed exact first-layer height and multiplier. PETG and ABS were brittle.
- **Speed changes the material:** 1,500 to 12,000 mm/min on a Prusa i3 MK3S. Faster printing made the connecting strands thinner and more sporadic, and markedly more elastic. A 1,500 mm/min sample broke under little tension; a 6,750 mm/min one withstood large displacement (Fig. 13).
- **Tests:** bending is recorded as the angle at the first crack (watched under a microscope); tension adds 250 g every 30 s until failure. PLA held 4.5 kg across the strands but only 900 g along the build axis.
- **Practical steps:** print the textile region before its solid pillars, lower the nozzle about 0.1 mm for the first layer, use a thin glue layer, remove with one swift scraper strike, iron-bond through a PTFE sheet, set pleats with a hair dryer, and anneal PLA in a sealed bag in 70 °C water for 30 min (stronger, slightly stiffer).
- **Lace by four patterning primitives** (Fig. 10): (A) solid flowers (multiplier 1) on mesh (0.32); (B) sparser mesh flowers (0.28) on 0.32 mesh; (C) equal density, where only the region boundary shows the motif; (D) equal density with **opposite column lean** in flowers and background, set by starting each region from opposite sides. Other primitives: multi-material traces and unsupported cut-outs. Single-print objects combine rigid stiffeners, textile flexures and an embedded tendon.

**Pattern implications for bed-flat sheets (proposals; the source is upright).** (1) *Direction-contrast motif:* fill motif and background with the same pitch and width but different path directions, so the image shows by sheen and texture rather than by density. FilaFabric could do this region by region in Drawing & Infill. (2) *Density-contrast motif:* change pitch or flow inside the motif, which is the planar analogue of lace A/B. (3) *Solid pads inside a mesh* for fasteners, labels or electrodes, as in the conductive-pad lampshade. (4) The speed result is a reminder that print speed is a structural variable, not only a time setting. Record it in every swatch.

---

## Paper 15: Gaston-2026 — Reya Reuse Yarn Product Process and Practice
**File Name:** `Gaston-2026_Reya-Reuse-Yarn-Product-Process-and-Practice.pdf`

### 1. Summary & Core Focus
Gaston (2026) presents Reya: Reuse Yarn, a material-led research-through-design project addressing low-value deadstock yarn in high-volume knitwear. Earlier experiments with optical colour mixing and stitch-level patterning developed into a practical reuse proposition. “Knit Thinking” combines tacit knitting skill, explicit manufacturing knowledge, and iterative prototyping to explore product, process, and production-practice change; the challenge is using small, mismatched yarn quantities without unacceptable variation in colour, handle, or sizing. This is methodological and practice-based work, not a controlled environmental life-cycle assessment or a 3D-printing study. It offers indirect context for material variability and circularity but does not support recycled-filament claims or printer calibration.

### 2. Mathematical & Structural Formulations
The paper discusses stitch-level colour mixing and the relationship among yarn availability, knitted structure, colour perception, and fabric handle. It does not specify FDM paths, loop-pile geometry, or printer kinematics.

### 3. Relevance & Design Takeaways for FilaFabric
This is **background on material-led textile design and reuse**, not a direct FilaFabric pattern or toolpath reference. Its lesson is to represent material/colour variation as part of design constraints and to avoid equating visual similarity with identical fabric handle. It does not validate Loop pile, Bouclé, picot spacing, or Z-lift settings.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 6-11, §§5.1-5.3, Figs. 3-7. **Status:** visual/material-method transfer to M; conventional knitted yarns.

The pilot combines three blended yarns in birds-eye float jacquard, rotating pairings A+B, C+A and B+C. Each blended yarn contains three deadstock yarns, distributing consumption across nine sources. Commercial trials investigate optical mixing and tolerance of substitutions; texture, saturation, colour area and viewing distance affect the result. Garment appearance can remain similar despite different yarn composition, but handle is a separate property and was not assessed in the exhibition survey. **Proposed translation:** repeat a three-phase pairing pattern in two or three flat coloured filament layers, varying exposed area and stagger while measuring the resulting stiffening. This would be a fused optical pattern, not a knitted deadstock-reuse demonstration. The master correctly rejects a pile connection, but its broad “background” label misses the usable pairing sequence and controlled viewing lesson. No recycling, filament compatibility or precise colour prediction follows from the yarn study.

### 5. Second full-text pass — 24 October 2026

**Optical-mixing rules reported (PDF pp. 6–12).**
- Optical mixing is stronger at a distance, with desaturated colours (Swirnoff: lower saturation means more perceptual change), and with textured or hairy yarns, which soften border contrast. Mixing further reduces saturation and lightness.
- Bundling three loose ends gives a random micro-stripe in every stitch.
- With a broad gamut, mixing colour inside each blended yarn *and* in the structure worked better. Blending similar colours in one yarn made the fabric look **striped**.
- Highly saturated individual yarns, especially reds and oranges, dominated the overall colour.
- In an uncontrolled survey, 81% of 311 visitors matched more than one physical garment to a single photograph. Focus groups (n = 26, screen viewed at about 45 cm) welcomed the minor variation, against an industry tolerance of about ΔE < 1.5.
- In the second trial, substituting a different fibre left four garments to specification but shrank one tuck-stitch structure.

**Pattern implications.** For FilaFabric's two-colour Halftone Net and any multi-filament pattern: (1) state the intended viewing distance for every tone test, because mixing depends on it. (2) Prefer muted filament pairs for smooth tonal blending, and expect a saturated red or orange line to dominate. (3) Textured or foaming filament may blend more than glossy filament, an untested but plausible advantage for Foamy. (4) Two similar colours laid in parallel read as stripes rather than a new tone. These are perceptual design rules from knitwear, to be checked on printed swatches.

---

## Paper 16: Gelosi-Devendorf-2026 — Designing with Drafts and Cross Sections Reflections on How Representations of Woven Structure Shape Design Practice
**File Name:** `Gelosi-Devendorf-2026_Designing-with-Drafts-and-Cross-Sections-Reflections-on-How-Representations-of-Woven-Structure-Shape-Design-Practice.pdf`

### 1. Summary & Core Focus
Gelosi and Devendorf reflect on AdaCAD’s interactive cross-section representation for designing woven structures, contrasting it with the conventional grid-based draft. Their collaborative account describes how cross-sections make yarn size, colour, continuous thread paths, and the sequence of interlacements perceptible, while drafts make binary over/under logic and loom operations easier to encode and manipulate. The representations are complementary: each foregrounds different material and procedural concerns, and translation between them can support complex designs and teaching. This is a first-person design reflection, not a comparative user study or performance experiment. It is relevant to FilaFabric as a UI lesson—show abstract pattern and physical path/section views where useful—but does not substantiate FilaFabric’s weave analysis or crossing-report accuracy.

### 2. Mathematical & Structural Formulations
No mechanics. A draft is a binary matrix (warp or weft visible at each crossing); a cross-section is a slice showing each weft's ordered path over and under warps assigned to layers. Table 1 (PDF p. 11) contrasts them on six axes:

| | Draft | Cross-section |
|---|---|---|
| Purpose | Machine instructions | Explains how the cloth works |
| Scope | Global repeat or whole-cloth bitmap | Local moment |
| Perspective | Top-down, all layers collapsed | Side-on, layered |
| Specificity | Material-agnostic | Suggests colour and relative size |
| Temporality | Simultaneous | Sequential (pick order) |
| Learnability | Teaches encoding | Teaches structure |

### 3. Relevance & Design Takeaways for FilaFabric
This is **indirectly relevant to design-interface and learning choices**: alternative representations can make material crossings and path continuity easier to reason about than a flat repeat alone. FilaFabric's weave or crossing features would need their own algorithmic and physical validation; this paper studies human interaction with weaving representations, not printed toolpaths.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5-10 and 11-12, §3, Figs. 2-5. **Status:** M/N representation-method transfer; not printed mechanics.

The AdaCAD operation assigns warp/weft systems, maps warp systems initially to layers and lets designers trace picks above/below warp locations. It converts those paths to a draft in real time while preserving pick order. A designer’s eleven samples and journal provide first-person reflections, not a controlled user trial. Cross-sections foreground colour placement, layer relationships and production sequence, complementing the draft. **Proposed translation:** show an M crossing as an editable section with explicit layer order, bonded contact, optional separation and the corresponding toolpath segment; distinguish fused crossings from genuinely independent yarns. For N, display the shallow height envelope and underlying support rather than only a top-view motif. This could clarify backing/face construction without promising loom-like interlacing. The master is accurate but generic: the concrete addition is synchronized layer/path/section representation. The authors’ 24-warp canvas matches their loom and is not a justified FilaFabric feature limit.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 8–12).**
- **Underspecified seeds:** the designer drew one pick per weft colour, which on its own would fall apart. She then used *slope* and *shift* operations to offset it across the width, treating the seed like a "tone" to be pitched or arpeggiated.
- **Flaps sample:** each flap was a flattened loop traced right to left. The base layer was bound on only one side, so a plain repeat would let warps peel off the back. A **returning binding pass** over the base layer, skipping the flaps, was required.
- **Z-hinge attempt:** it failed several times. One sample could not be read for where to cut; a later version lacked room on 24 ends to bind the layers; and a weft that crossed from top to bottom without returning created an unplanned second hinge. Moving to a jacquard and splitting the design into regions, each with its own cross-section, worked better.
- **Density:** assigning more layers lowers each layer's warp density, so texture must be balanced across single-layer and double-layer regions.
- **Future plans:** a reverse operation (draft → cross-section) and "playable" documentation that shows the sequence of machine movements.

**Pattern implications.** (1) The flaps lesson maps directly onto a FilaFabric motif on a carrier: a decorative loop attached only along one side, or only to one family, can peel. Check that every motif element is bound by a later or earlier pass on both sides, or deliberately anchored. (2) Where a sheet changes between one and two logical passes, keep strand density and texture balanced across the boundary. (3) A playable deposition-order preview (FilaFabric's export order, animated) is the printing analogue of the "playable" documentation the authors propose.

---

## Paper 17: Gispan-et-al-2026 — Halftoning for 3D Printed Textile Nets
**File Name:** `Gispan-et-al-2026_Halftoning-for-3D-Printed-Textile-Nets.pdf`

### 1. Summary & Core Focus
This June 2026 preprint (not peer reviewed in the version held here) presents a toolpath-based way to print grayscale images as two-colour flexible textile nets on standard FDM equipment. Rather than using a colour-mixing head, each image sample controls the thickness of two perpendicular line segments in a two-layer grid; the layers use different filament colours, and their relative visible area creates the tonal effect. The image is sampled per grid cell, with inverse brightness driving the second layer. The authors implement the workflow in Grasshopper/Rhino and a browser tool, and demonstrate orthogonal, diagonal, chevron, and curved grids, plus a patterned multi-piece corset joined by localized thermal fusion.

The engineering contribution is empirical calibration: on a Prusa XL with a 0.4 mm nozzle and 95A TPU, line thickness is controlled jointly by feed rate and extrusion amount (encoded as an E-factor). The authors measured widths across five feed rates (750–2550 mm/min) and E-factors 5–23, separately for first-layer and over-pattern deposition, then interpolated the measurements into a lookup surface. They compensate for one colour masking the other by calculating visible line areas ($A_2=P_2L_2$ and $A_1=P_1L_1-P_1P_2$). Calibrated mean-range parameter selection gave the most reliable balance of thickness fidelity and successful printing; speed-prioritized values sometimes failed under abrupt transitions, while uncalibrated linear parameter mapping performed substantially worse.

The same image could be retained across different grid topologies while mechanical response changed: diagonal and chevron grids were more extensible in the reported evaluation, while orthogonal and curvilinear grids were comparatively stable. Greater grid subdivision improves image detail but increases print time/material and reduces compliance; lower subdivision does the reverse. Limitations include printer- and filament-specific calibration, a two-colour scope, and no evidence that the parameter map transfers to other machines or materials. The results are promising but provisional because the source is a preprint.

### 2. Mathematical & Structural Formulations
Per pixel cell with perpendicular segments, the visible areas are $A_2 = P_2L_2$ (upper line fully visible) and $A_1 = P_1L_1 - P_1P_2$ (lower line minus the overlap hidden at the crossing). The extrusion value per segment is segment length / E-factor. Line width is an interpolated function of feed rate and E-factor, measured separately for the first layer and for lines laid over another layer (Tables A1–A2).

### 3. Relevance & Design Takeaways for FilaFabric
This is among the **most directly relevant papers for FilaFabric's Halftone net and Your picture workflows**. It demonstrates mapping image intensity to printable strand attributes and retaining an image across different grid geometries to trade off visual fidelity against stretch and stability. It supports machine/material-specific calibration and smooth parameter transitions when varying strand flow or speed. FilaFabric currently maps picture tone to pattern-specific geometry; calibrated tone-to-line-width/flow mappings are a possible extension, but require controlled print trials and safeguards for extrusion pressure, jams, crossing integrity, and the selected printer profile. Its two-colour Prusa XL calibration is not equivalent to an uncalibrated Foamy material profile, so its numeric settings should not be copied directly.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5-13, §§3-5, Figs. 2-9; calibration tables pp. 14-17. **Status:** M, direct two-flat-layer evidence; supplied version is a preprint.

Two coloured perpendicular path families vary line width with complementary image brightness. For orthogonal crossing segments the visible areas are A2=P2L2 and A1=P1L1-P1P2: the overlap term accounts for the upper colour masking the lower. Separate first-/second-layer calibration uses five speeds, 750-2550 mm/min, and ten E-factors, 5-23. Here extrusion amount is line length divided by E-factor; it is not an extrusion multiplier. Calibrated mean-range parameter selection is more reliable at image scale than abrupt speed-prioritized changes. **Proposed translation:** two-pass image nets with measured layer-specific width maps, crossing-area compensation and bounded transitions; test orthogonal, diagonal, chevron and curved families. Mechanics comparisons are manual, and the perpendicular-area expression needs revision for oblique/curved crossings. The earlier summary’s equations are accurate, but do not imply their mask formula works unchanged on every grid or that Prusa XL/TPU calibration applies to Foamy.

### 5. Second full-text pass — 24 October 2026

**Method details (PDF pp. 5–9).**
- **Cell geometry:** the surface is split into sub-surfaces, one per image pixel. In each, the two toolpath segments join the midpoints of opposite edges (a "+"), the first in layer 1 and the second in layer 2. Brightness is sampled at the cell centre (closest image point). Layer 1 width maps from brightness and layer 2 from 1 − brightness. One subdivision setting fixes both net pitch and image resolution.
- **Mask compensation:** the visible-area extremes are equalized. Maximum $A_1$ uses the thickest printable $P_1$ with the thinnest $P_2$. That maximum $A_1$ becomes the maximum $A_2$, which sets the largest $P_2$. The thinnest $P_2$ is the minimum that keeps the net structurally intact.
- **Nozzle height:** 0.2 mm above the plate for layer 1 and 0.4 mm for layer 2. Layer-1 strands are flattened against the plate, layer-2 strands rounder.
- **Extrusion control:** the E value is segment length / E-factor, so width responds non-linearly ("exponential steps") to the E-factor. Useful ranges were 750–2,550 mm/min and E-factor 5–23. Lower values gave back-pressure, filament buckling and jams with flexible filament.
- **Calibration rig:** black TPU lines printed straight onto **A4 paper** (layer-1 case) and onto paper pre-covered with perpendicular white lines (layer-2 case). Ten E-factors × five speeds; the first group on each sheet is discarded as start-up transient. Each line is scanned and measured by Python at three perpendicular probes, and the results are interpolated into a speed × E-factor map.

**Measured widths (Tables A1–A2; mm, 0.4 mm nozzle, Prusa XL, 95A TPU).**

| E-factor | 23 | 19 | 15 | 11 | 9 | 7 | 5 |
|---|---|---|---|---|---|---|---|
| Layer 1 (750 → 2,550 mm/min) | 0.45–0.44 | 0.52–0.50 | 0.62–0.60 | 0.78–0.76 | 0.92–0.88 | 1.10–1.05 | 1.25–1.20 |
| Layer 2 (over lines) | 0.43–0.41 | 0.53–0.51 | 0.63–0.61 | 0.72–0.69 | 0.78–0.75 | 0.87–0.82 | 1.05–0.95 |

In this dataset feed rate changes width by only about 0.01–0.10 mm across its whole range, while the E-factor spans about 0.45–1.25 mm. **Extrusion per millimetre dominates width; speed mainly affects stability and time.** Over another net, heavy extrusion spreads less than on the plate: 1.05 mm against 1.25 mm at E-factor 5.

**Strategy results (Fig. 5, Table A7).** Mean-range selection tracked targets from 0.46 to 1.22 mm closely and printed without interruption. Speed-prioritized selection (Tables A5–A6 hold 2,550 mm/min until the E-factor floor) failed three times at abrupt fast-to-slow, high-to-low-E transitions, and lost detail in high-contrast regions. Uncalibrated linear mapping produced only 0.42–0.67 mm for most targets up to about 1.0 mm, with only the last few targets reaching 0.88–1.05 mm.

**Results and garment (pp. 10–12).** On 250 × 250 mm grids the picture looked nearly identical across topologies, but line density had to be adjusted per grid because base-line orientation changes effective density. Black-and-white sources kept boundaries sharp down to a few millimetres on 100 × 100 mm swatches, even though both colours are deposited everywhere. The corset used 11 pieces (7 bodice, 4 straps), each with its **own placement image** (mirrored like pattern cutting). Bodice pieces used an orthogonal grid and straps a curvilinear grid. **Contour reinforcement along edges and local layers for boning and lacing** were merged into the same G-code, and seams were joined by local thermal fusion. The browser tool exposes brightness, contrast and per-layer line spacing, and exports single- or multi-head G-code.

**Pattern implications.** For FilaFabric's Halftone Net: keep separate width maps for layer 1 and layer 2; drive width mainly through extrusion per millimetre; limit step changes between neighbouring cells (a slew limit on speed and extrusion) rather than choosing the fastest settings; and add per-piece placement images, a reinforced contour band and local reinforcement zones for fasteners. The paper calibration rig is a cheap way to build a width map before printing nets.

---

## Paper 18: Guo-2020 — Woven Fabric Structures by Harmonic Foliation
**File Name:** `Guo-2020_Woven-Fabric-Structures-by-Harmonic-Foliation.pdf`

### 1. Summary & Core Focus
Guo et al. present a computational framework for generating warp and weft paths on arbitrary thin-shell surfaces using harmonic foliations. They solve graph-valued harmonic maps to produce two smooth, mutually orthogonal families of surface curves, minimize singularities toward a theoretical lower bound, and use the tensor-product paths to guide physical weaving. Physical specimens use construction-paper strips generated by unfolding the quad mesh, manually interlaced and glued into regional assemblies (PDF pp. 24–29, 36). This is not a demonstrated nozzle-deposited yarn net. This addresses conformal surface parameterization and topological constraints; it is not an FDM deposition or textile-net generator. It offers algorithmic context for surface-aware textile layout, but printable continuous toolpaths, nozzle clearance, and support strategy require separate methods and validation.

### 2. Mathematical & Structural Formulations
The central formulation is a pair of orthogonal harmonic foliations on a surface, computed through graph-valued harmonic maps, with singularities constrained by topology. Their leaves define warp/weft families; physical construction uses cut-paper strips and manual assembly. The paper does not model extrusion width, nozzle motion, or FDM crossings.

### 3. Relevance & Design Takeaways for FilaFabric
This is **algorithmic background for future conformal textile layouts**, not direct evidence for FilaFabric's current non-planar G-code or crossing checks. Surface foliation may inspire path distribution on curved forms, but printed deposition must additionally handle nozzle clearance, layer bonding, gravity, and machine kinematics.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 24-29 and 31-36, §§4-6, Figs. 11-18. **Status:** N surface-layout method transfer; original fabrication is woven cut-paper strips.

Orthogonal harmonic foliations define a surface quad mesh. Adjacent faces form two strip families; planarized faces enable strips to unfold isometrically into flat cut patterns. Construction-paper strips are scissor-/laser-cut, manually interwoven and regional assemblies glued. Plain and alternative crossing orders vary appearance. Higher curvature/resolution needs geometric error assessment; thickness is neglected and singularities require management. **Proposed translation:** sample two shallow curved path families from a regular surface grid, vary strip/line pitch with curvature, and compare N relief against an M flat control. Add nozzle-access and support constraints separately: harmonic orthogonality is not a deposition algorithm. **Review correction:** its description as threads reconstructed over a supporting surface misses the demonstrated cut-strip fabrication. Preserve the method as a surface/strip-layout precedent, not evidence for FDM over-under crossings. The paper’s topology and distance-error calculations should not be recast as printer-clearance equations.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 24–36).**
- **Quality metrics:** angle deviation at each crossing vertex is $\frac{1}{k}\sum_i |\theta_i - 90^\circ|$ over its $k$ incident angles. On the models, deviation reached 10–25° near singularities, 54° at most (a 36° crossing), and averaged under 10°. Distance error is the per-quad Hausdorff distance normalized by leaf length (average under 1%); area distortion is computed per quad.
- **Resolution helps:** going from a 15 × 16 to a 45 × 48 quad mesh cut the average distance error by 86% and area distortion from 6.49% to 2.71%. Narrowing strips in high-curvature regions also helps (Fig. 18).
- **Weave styles:** plain (most interlacing and reinforcement); twill 2/2 (more flexible, fewer interlacings); and a **double-layer variant** with every horizontal strip under every vertical one, giving gap-free two-layer cover.
- **Fabrication:** every paired unit cell is **glued**, like a composite matrix. The structure is bonded at every crossing, which is closer to fused FDM crossings than free weaving.
- **Colour parity:** an alternating black/white pattern across cylinder boundaries needs an even number of warps and wefts per region and alternating colours where regions meet.
- **Singularities:** $4g-4$ for quadratic-differential foliations and $2g-2$ for holomorphic one-forms on genus $g$, with no T-junctions.
- **Model sizes:** Eight (L) 65.3 × 31.6 × 9.17 cm, 99.2 g; Eight (S) 25.4 × 12.5 × 4.24 cm, 17.0 g; hand 39.8 × 11.0 × 55.7 cm, 70.9 g.

**Pattern implications.** For FilaFabric's Conformal Mesh and Flow Lines: (1) report mean and maximum crossing-angle deviation from 90° as a geometry check, because near-tangent crossings give long thin fused contacts and uneven cells; (2) allow spacing to tighten where the field bends sharply, rather than one global pitch; (3) when two families get different colours, enforce even line counts per region so the alternation stays continuous at seams, which matches FilaFabric's whole-repeat edge rule. The double-layer variant corresponds to FilaFabric's plain crossed two-pass net; true plain-weave alternation is the Weave card's job.

---

## Paper 19: Harvey-2019 — Weaving Objects
**File Name:** `Harvey-2019_Weaving-Objects.pdf`

### 1. Summary & Core Focus
Harvey et al. combine textile-design practice and computational visualization to explore volumetric 3D weaving, culminating in a woven shoe prototype. They show how stacked warp/weft systems and controlled layer connections can create cavities, channels, pockets, flaps, and hinges rather than merely draping planar cloth over a mold. A visualization tool was developed collaboratively with textile designers to support iteration and make spatial weave structure more legible. This is a design/tool-development study for industrial weaving, not FDM; it offers lessons about communicating internal structure and designing functional spatial forms, but does not validate FilaFabric's FDM paths.

### 2. Mathematical & Structural Formulations
The paper describes volumetric layering and organized multiaxis yarn interlacing, with structural sequencing used to create functional cavities and hinges. It presents a visualization workflow, not a quantitative textile mechanics equation or nozzle-path model.

### 3. Relevance & Design Takeaways for FilaFabric
This is **background for volumetric textile design and design-tool visualization**. It may inform previews of layered structures and functional forms, but the industrial loom and interlaced yarns differ from nozzle-deposited paths; it is not evidence of FilaFabric's weave or crossing accuracy.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 3-7, “A New Approach,” “Library of Tendencies” and shoe process, Figs. 5-10. **Status:** M/N design-method transfer; industrial volumetric weaving lies outside the direct printing target.

Industrial Jacquard weaving stacks warp/weft systems, controls shuttle passages and combines weave blocks to make variable-thickness fabrics, pockets and hinged regions. A “library of tendencies” relates structure, graphics and material to observed behaviour. TL013 builds weft stacks toward an apex and back down, with thinner floating face layers; CT sections help compare simulation and cloth. A shoe assigns distinct materials and architectures to sole, insole and upper. **Proposed translation:** a measured library of shallow zigzag ribs over flat backing, including layer count, relief height, bond layout and observed bend direction, then use these tested blocks regionally. This intentionally fuses layers rather than retaining woven pockets or independent yarn motion. The earlier summary’s summary is broadly accurate; replace generic visualization relevance with the sample-to-library workflow. No quantitative efficiency or mechanics model for FilaFabric is established by the reported design case.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–7).**
- **Named tendencies** (Fig. 6): *layered graphics with a hinge effect*, *semi-rigid creases*, *stuffed creases*, *directional arches* and a *crenellated pocket*. TL013 makes a directional zigzag simply by inverting the structure between rising and falling weft stacks. TL007 was adapted in PVC-coated polyester as a flexible tread.
- **Layer linking:** layers are joined directly or by angle-interlock "Z-tows" running through the thickness.
- **Workflow before Weavecraft:** Photoshop graphics, Pointcarré structure pools and an Excel hook map for the shuttle path. Pointcarré tiles a card image into every colour region, so errors between regions go unnoticed.
- **Weavecraft:** *SliceEditor* sets active warps and wefts per zone and draws each warp's path; slices replicate per zone, stack and join in a 3D viewer; the card image is exported automatically.
- **Shoe:** three zones in different yarns: sole (PVC-coated polyester), insole (5/2 cotton, cushion), upper (fine cotton, deflected-weft graphic). Thicker wefts are inserted to bulk the heel and thinner ones to free the toe bend. Changing the jacquard graphic proportionally changes the size.

**Pattern implications.** Translate the tendency vocabulary into bed-flat constructions to measure: (1) a *hinge band*, a strip with fewer or thinner passes, or wider spacing, where a panel should fold; (2) a *crease rib*, a narrow band with an added pass or denser lines that resists bending except along its edges; (3) *directional arches*, asymmetric shallow relief (N) whose rise and fall differ, tested for one-way bending. As with the shoe's heel and toe, place stiff and flexible zones by function within one sheet, and keep a per-zone construction record instead of a single global setting. These are proposals; the source is industrial 3D weaving.

---

## Paper 20: Herron-Kohler-2026 — Mechanically Recycling Metallicized Fabrics
**File Name:** `Herron-Kohler-2026_Mechanically-Recycling-Metallicized-Fabrics.pdf`

### 1. Summary & Core Focus
Herron et al. investigate an intermediate mechanical-recycling route for metallicized conductive fabrics: shredding and carding discarded material, blending recovered conductive fibres with wool, and needle-punching a nonwoven that can function as a piezoresistive sensor. The process reframes recycling as a staged material transition, retaining some conductive function in a lower-grade form before eventual material recovery. The outputs are conductive nonwovens, not FDM filament. This is sustainability context only; it does not show that printed textile waste can be recycled into reusable printer filament or support recyclability claims for FilaFabric prints.

### 2. Mathematical & Structural Formulations
The process sequence is mechanical size reduction, carding/alignment and blending of recovered conductive fibres with wool, then needle-punching into a nonwoven. Electrical response depends on retained conductive content and fibre network; the paper does not model FDM extrusion or printed textile mechanics.

### 3. Relevance & Design Takeaways for FilaFabric
This paper is **indirect sustainability background** for FilaFabric. It suggests end-of-life pathways depend on material combinations and separability, but gives no evidence that FilaFabric's printed structures are recyclable or that filament can be reclaimed by this method. Avoid environmental claims without print-specific lifecycle or recycling tests.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 6-13, §§3-4, Tables 1-3, Figs. 3-8. **Status:** outside printed geometry; indirect M backing/sensor-method transfer.

Pre-consumer metallicized woven textiles are shredded, carded and needle-punched, optionally blended with recycled wool, into conductive nonwovens. This is fibre-network consolidation, not extrusion or filament recycling. Conductivity falls sharply; compression response depends on conductive contacts and has hysteresis, roughly one-second recovery delays and material-dependent cyclic degradation. The study measures load/resistance, holding/releasing and 1000 cycles rather than inferring function from appearance. **Proposed translation:** if a shallow printed M spacer or protective net is combined with a conductive backing, evaluate compression history and recovery with the backing separately from the printed structure. Pore size, bonded coverage and shallow rib height become experimental variables, not sensor specifications derived here. The master correctly rejects a printed-filament recycling claim but should specify pre-consumer source material. No printable pattern or bulk foam should be added from this paper; its useful contribution is the disciplined functional-test sequence and material-separation record.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 6–13).**
- Shredding lost 21–37.5% of the fabric weight as over-short fibres.
- Conductivity retained after recycling: 0.5% (silver-plated polyamide), 0.07% (silver filament), 0.05% (zinc filament).
- Roughly linear sensing ranges: 0–60 N, 10–150 N, 0–30 N (with wool) and 10–120 N.
- **Cyclic test:** 1,000 cycles to 200 N at 100 N/s. Every sample varied most in the **first ~100 cycles (a conditioning stage)**, then settled into a smaller, steadier range. Plated samples were steadier; filament samples gave stronger signals but degraded faster.
- Blending in non-conductive wool reduced noise. The nonwovens shed dust and were judged unfit for skin contact without encapsulation.

**Pattern implications.** No geometry. The testing lesson transfers: when FilaFabric swatches are cycled, report the conditioning cycles separately from the stabilized response rather than averaging them together. Soft TPU sheets are also likely to soften over early cycles, which would distort a single averaged value.

---

## Paper 21: Janssen-McQuillan-2026 — Shaped Circular Knitting for Zero Waste Design A Material Driven Approach To Knitted Textile Forms
**File Name:** `Janssen-McQuillan-2026_Shaped-Circular-Knitting-for-Zero-Waste-Design-A-Material-Driven-Approach-To-Knitted-Textile-Forms.pdf`

### 1. Summary & Core Focus
Janssen and McQuillan develop Zero Waste Structure Mapping (ZWSM), a proof-of-concept method using stitch-structure differences to change knitted-region dimensions and adapt garment patterns without redrawing their geometry. A material study tested 16 recipes combining full, tuck, and float stitches on a Stoll CMS 530s 7-gauge machine; stitch ratios and distributions produced local contraction/expansion. The method was applied to an existing zero-waste design and to translating a conventional pattern, with a preliminary participant study (n=5) comparing comfort, fit, appearance, tactile impression, and perceived value. The lab used a flat-bed machine to approximate circular-knitting stitch options, which limits transfer; participant evidence is small and preliminary. For FilaFabric this is indirect inspiration for spatially varying parameters and garment-aware design, not an FDM toolpath algorithm or proof that changing lattice density yields equivalent shaping.

### 2. Mathematical & Structural Formulations
The method maps regional garment dimensions to stitch recipes and uses measured size ratios from combinations of full, tuck, and float stitches. The authors give formulas for scaling artwork regions to compensate for shrinkage/expansion; these are specific to the tested knitted structures and machine, not a general lattice or G-code model.

### 3. Relevance & Design Takeaways for FilaFabric
This is **indirectly relevant to spatial parameter mapping and garment-aware design**: it demonstrates that local structural choices can change dimensions while preserving a garment pattern layout. It does not inform FilaFabric's Loop pile/Bouclé path kinematics or Z-lift calibration, and the stitch-size formulas cannot be transferred to FDM without new material and geometry trials.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5-10 and 15-17, Table 1, §§2.1-2.2 and 3.1. **Status:** S/M regional-parameter method transfer; conventional knit manufacture.

Sixteen full/tuck/float recipes are knitted from identical 100 × 100 stitch artworks with constant yarn/machine settings; duplicates compare relaxed and felted dimensions. Float-rich structures contract, tuck-rich structures become wider/shorter, and material feel changes alongside dimensions. Zero Waste Structure Mapping uses measured recipe responses to place locally contracting/expanding regions. Actual samples use a Stoll flat-bed machine; industrial circular-knitting transfer is explicitly unvalidated. **Proposed translation:** print a common-outline S/M swatch set with different meander amplitude, pitch and bond density, measure both axes before/after release and cyclic loading, then use measured regional responses for garment-panel planning. Do not substitute knitted shrinkage formulas for printed-lattice mechanics. The master is broadly accurate; add the coupled-dimension caveat: changing one local parameter can alter width, length, thickness and stretch together, so independent sliders need calibrated evidence rather than an assumed one-parameter/one-property relationship.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 5–12).**
- **Recipe set** (Table 1): full/tuck/float percentages from 100/0/0 down to 12.5/12.5/75, each with its own repeat (1 × 2 up to 24 × 24 stitches). Feasible limits on this machine were 0–85.7% floats and 0–50% tucks. All samples used 2/32 Nm merino, stitch length 10.5, 0.4 m/s and identical take-down, and were measured to about ±5 mm.
- **Material experience:** full-stitch-heavy samples stretch both ways and are smooth. Float-heavy samples are thicker and much less elastic, and do not stretch after felting. Tuck-heavy samples are lighter, softer, spongier, more transparent and stretchier. Felting (60 °C, 2 h 24 min, 1,400 rpm) thickened and stiffened everything.
- **Eight-step workflow** (Fig. 8): (1) base pattern → (2) simplify to a rectangle → (3) overlay and map where the form must grow or shrink → (4) assign recipes per region as a colour-indexed artwork → (5) simulate with per-recipe shrinkage in CLO3D → (6) program, scaling each recipe module so **at least one whole repeat fits in its region** → (7) knit, slowing the machine where very different recipes meet, to avoid dropped stitches → (8) finish.
- Seam allowances and sewing markers were encoded in the same artwork as a visual variant of the base recipe.

**Pattern implications.** The workflow is a direct template for a future FilaFabric *regional structure map*: a garment panel coloured by construction (open hinge zone, dense support zone, transition) with measured per-region shrink and stretch values. The paper also confirms two existing FilaFabric rules from a different medium: every region should hold whole repeats, and sharp boundaries between very different constructions need slower, gentler transitions. Markers and seam allowances can live in the pattern itself as a distinct construction.

---

## Paper 22: Jayswal-2023 — PhD Dissertation_Additive Manufacturing of Engineered Polymeric Flexible Structures
**File Name:** `Jayswal-2023_PhD-Dissertation_Additive-Manufacturing-of-Engineered-Polymeric-Flexible-Structures.pdf`

### 1. Summary & Core Focus
Jayswal’s 2023 dissertation combines design and mechanical characterization of FDM textile-like structures with studies of polymer composites and viscoelastic behavior. It reports that printed 2/1 twill structures were stronger in the warp than weft direction, weft-knit structures had lower flexural strength in the course direction, and cylindrical braids sustained more than 25 mm compression displacement. The dissertation also develops thermo-mechanical-viscoelastic modeling for PLA woven-fabric unit cells and larger structures, manufactures PLA/TPU composite filaments using twin- and single-screw extrusion, and finds that blending can increase filament elongation by more than 500% while reducing tensile stress/modulus. PEG plasticizer effects are separately studied; a PLA/TPU/PEG composite is then used to print a plain-weave structure. The plain/twill weave samples are printed upright, with warp along X and weft along Z (physical pp. 92–95, 119), and are outside this brief. The flat knit experiment uses manually removed supports and approximately 4.50 mm fabric thickness (pp. 98–104), making it a method reference rather than a thin-sheet recipe. This is substantial but multi-topic doctoral work: results depend on individual geometries and material formulations, and the dissertation itself notes voids in printed specimens that affect measurements. It is useful evidence for anisotropy, mechanical testing, composite materials, and viscoelastic modeling, not a calibration source for FilaFabric's commercial Foamy filament.

### 2. Mathematical & Structural Formulations
Chapter 3 uses standard test reductions (PDF pp. 102–104): yarn tensile stress $\sigma_t = F_{max}/A$, and for a fabric with $n$ yarns $\sigma_t = F_{max}/(nA)$. Three-point bending (ASTM D790) uses $\sigma_f = 3F_{max}L/(2wt^2)$, $\varepsilon_f = 6\delta t/L^2$ and $E_f = L^3 m/(4wt^3)$, with span $L$, width $w$, thickness $t$ and initial load–deflection slope $m$. Chapter 8 fits generalized Voigt–Kelvin/Maxwell (three-term Prony) creep models to 100 N creep tests, with about 6% maximum error. These are characterization formulas, not textile design laws.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **mechanical-validation and materials reference** for FilaFabric. It supports measuring direction-dependent response and considering creep/temperature effects in flexible printed structures; it also demonstrates that custom PLA/TPU blends may behave quite differently from either constituent. The dissertation's composite formulations, shape-memory polymers, and test geometries are not FilaFabric materials or presets. Use it to design validation studies, not to infer performance from pattern names or import its material properties into the Foamy profile.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 91-104 and 119, chapter 3; pp. 162-165, chapter 5; pp. 243-258, chapter 8. **Status:** mostly excluded upright/bulk processes; limited flat-knit/testing transfer.

The dissertation explicitly prints plain/twill weaves upright: warp lies along X, weft along Z, and Y is fabric thickness. Those processes are excluded. Its weft-knit is printed flat with manually removed PLA supports, but uses 2.54 mm yarn, 27.14 mm loops and a 4.5 mm specimen thickness—substantially thicker than a fine sheet. **Proposed translation:** a deliberately bonded planar loop meander (S/M), with directional tensile/bend tests and clear disclosure that it sacrifices independent knit motion. Flat-knit methods also show why support removal matters. Chapter 5 characterizes temperature-dependent viscoelastic unit cells; chapter 8 fits creep/relaxation models to specific blends. These are calibration/test precedents, not Foamy constants. **Review correction:** state the weave build orientation and thick supported-knit geometry, so its anisotropy and “woven” results are not mistaken for demonstrated bed-flat sheet performance. Cylindrical braids remain outside scope.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 90–119, chapter 3; p. 263, summary).**
- **Crossing clearance needed to keep printed yarns separate** (upright PLA):
  - Plain weave, 3 mm yarns at 5 mm spacing: everything fused.
  - At 10 mm spacing, a 1 mm crossing gap needed supports that fused in; a 0.25 mm gap fused again; the final design used a 0.5 mm gap with spot supports at crossings.
  - 2/1 twill, 1 mm yarns: a 0.5 mm gap stuck; **0.65 mm** left the yarns barely touching and separable by hand.
- **Path-continuous strands outperform layer-stacked strands:** strands laid along the nozzle path behave like continuous filaments, while strands built by stacking layers behave like short fibres with weak interfaces and voids (optical microscopy).

  | Twill tests (PLA) | Warp (along path) | Weft (stacked) |
  |---|---|---|
  | Single yarn | 23.20 N, 29.54 MPa | 14.03 N, 17.86 MPa |
  | 15-yarn fabric | 381 N | 120 N |
  | Failure strain | 10–30% | under 5% |

  The fabric carried about 16 single-warp loads but only 8.5 single-weft loads, and flexural strength was far below tensile strength.
- **Knit (flat, supported):** tensile peak about 250 N at 12–15 mm. Flexural peak 15–22 N in the course direction against 85–95 N in the wale direction. Fracture starts at the loop heads, then spreads through neighbouring loops one by one.
- **Braids** (compression): diamond 1,235 N, Hercules 1,057 N, regular 915 N, bifurcated 659 N, triaxial 440 N. A 1/1 diamond braid collapses when one yarn breaks, whereas 2/2 and 3/3 braids fail progressively.
- **Annealing** (chapter 4: 50–125 °C, 1 h) raised crystallinity above Tg but did not significantly improve the interlaced twill, though it did improve dog-bone bars.

**Pattern implications.** (1) In a bed-flat FilaFabric sheet every strand is laid along the nozzle path, which is the strong case here; the weak "stacked" interface exists only at crossings and stacked passes. That supports reporting crossing bonds as the likely weak link. (2) Keeping crossings *separate* in this upright FDM twill needed 0.65 mm of designed clearance with 1 mm PLA yarns (0.5 mm fused). A thin sheet cannot afford that, so planar FilaFabric crossings should be treated as fused unless a dedicated lift is designed and verified. (3) Loop heads and 1/1 interlacings are single points of failure; designs with paired or redundant paths fail more gradually.

---

## Paper 23: Jayswal-Adanur-2022 — Overview of Additive Manufacturing for Flexible Structures
**File Name:** `Jayswal-Adanur-2022_Overview-of-Additive-Manufacturing-for-Flexible-Structures.pdf`

### 1. Summary & Core Focus
Jayswal and Adanur (2022) review additive-manufacturing processes, materials, and applications for flexible structures, with coverage of FDM and SLS for fabrics and direct ink writing for electronics. The review surveys polymer chemistry, manufacturing routes, properties, advantages, and limitations, then discusses flexible fabrics/electronic applications and challenges in process parameters and material combinations. It is a secondary literature review, not a new comparative experiment; scope extends beyond textile-like FDM nets to flexible electronics and other structures. Its useful contribution is a broad map of process/material choices, while individual performance claims should be traced to the cited primary studies and not treated as FilaFabric-specific evidence.

### 2. Mathematical & Structural Formulations
Mainly descriptive. It cites general relations unrelated to net geometry: melt viscosity $\eta_0 = k M_w^{\,n}$ ($n$ = 1 below the critical molecular weight, 3.4 above), the Frenkel neck-growth relation for SLS sintering, and a percolation law for conductive inks, $\sigma = \sigma_0 (V_f - V_c)^s$. None applies to FilaFabric patterns.

### 3. Relevance & Design Takeaways for FilaFabric
This is **background for material/process selection** and can help locate primary studies on flexible FDM materials and textile structures. It does not establish that FilaFabric's presets have particular mechanical properties or that any FDM setting transfers to the MK3S/Filaflex Foamy setup. Where the review reports an application or performance value, consult the cited original experiment before using it as evidence.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 23-29, Figs. 20-27, and pp. 32-33, challenges. **Status:** secondary process map; mixed excluded and transferable sheet examples.

The review describes fused h=0 weave-looking lattices, separated-yarn plain/twill specimens, printed knits and assembled garments, alongside DIW electronics and SLS structures. Its plain-weave examples use 3 mm yarns and 5/10 mm spacing, with crossing gap affecting fusion; the underlying upright process is clarified in Jayswal’s dissertation. Support removal can destroy fine knit samples, while soft PLA examples retain separated loops but show roughness/stringing. **Proposed translation:** compare a flat intentionally fused orthogonal grid with a two-layer staggered pseudo-weave, making bond positions explicit and avoiding any assertion of free yarn sliding. Use the review to locate primary evidence rather than importing its material tables or directional strengths as sheet constants. The earlier summary’s cautious secondary-source status is correct but should point readers toward the build-orientation distinction. Joining separately printed panels and balancing processability against thinness are useful engineering questions; no tested universal FDM textile recipe emerges.

### 5. Second full-text pass — 24 October 2026

**Primary works summarized (PDF pp. 26–29) that the earlier entry did not name.** All are cited, not held locally:
- **Spahiu et al. 2020** (ref. 127): a modelled fabric structure in an **arrowhead shape with negative Poisson's ratio**, 130 mm × 130 mm, printed in **FilaFlex by Recreus, Shore A82**. Several lattice pieces were joined in a set pattern with a **Dikale 07A 3D pen** to make a dress (Fig. 23). This is the closest cited precedent to FilaFabric's material family and to the Auxetic Mesh. Brad (5) cites the same paper but describes the joining as stitches and belts.
- **Kim et al. 2019:** TPU spider-web unit cells made of triangles of varied size, joined by sewing or copper wire into a dress layer.
- **Uysal & Stubbs 2019:** PLA with **LAY-FOMM 40**, whose PVA phase washes out to leave a soft micro-porous elastomer. Glove pattern pieces were partly printed as polygons and then sewn. The authors suggest ultrasound or printed connectors for joining.
- **Melnikova et al. 2014:** weft knit in soft PLA *without* supports gave separated loops, but with fine strings between loops; BendLay with supports was destroyed when the supports were removed.
- **Nervous System Kinematics** (SLS): 1,320 hinged pieces printed folded, wearable straight from the printer.

**Pattern implications.** (1) *Triangular web cells* of varied size form a connected planar lattice. They resemble Voronoi Lace or a triangulated net, and are a reminder that FilaFabric's Delaunay first pass is itself a precedent-backed construction. (2) A *3D-pen or printed seam* is a cited joining method for TPU panels; compare the corset's thermal-fusion seams in Gispan (17). (3) A wash-out porous filament is another way to soften a sheet through material rather than geometry, outside the current profiles.

---

## Paper 24: Kabir-2022 — Drapability of 3D Printed Auxetic Structure Textiles
**File Name:** `Kabir-2022_Drapability-of-3D-Printed-Auxetic-Structure-Textiles.pdf`

### 1. Summary & Core Focus
Kabir et al. conduct an exploratory comparison of drape across ten auxetic textile geometries printed in TPU by FDM. Nine geometries were adapted from prior auxetic designs and one was inspired by floral motifs; each circular sample was 200 mm in diameter and repeated three times. Drapability was evaluated from overhead photographs of samples suspended over an 81 mm circular stand. The projected area was measured by image processing and converted to a drape coefficient (DC = draped projected area / undraped area × 100); a higher DC indicates less drape.

The mean DC values ranged from 26.15% to 52.07%, with significant differences among samples (ANOVA F(9,20)=22.51, p<.0001); pairwise comparisons formed five overlapping drapability groups. The authors compare this range with cited traditional textile DC values (19–90%) and infer that geometry choice can produce a range of drape-like responses. They suggest higher-drape structures may suit lingerie, moderate-drape structures blouses/shirts, and lower-drape designs pants or outerwear. This is a single drape-test setup, not a garment wear trial; the paper does not isolate which individual geometric parameter caused the differences or establish comfort, tensile strength, recovery, or durability.

### 2. Mathematical & Structural Formulations
Drape coefficient DC = draped projected area / undraped area × 100%; higher means less drape. It was measured with the Photoshop histogram tool on one overhead photograph, without subtracting the 81 mm support area. One-way ANOVA gave F(9,20) = 22.51 (p < .0001), with Tukey grouping into five overlapping groups.

### 3. Relevance & Design Takeaways for FilaFabric
This is directly relevant to the **Auxetic mesh / proposed auxetic star-cell design space and drape-preview priorities**. It demonstrates that structural geometry affects drape, and provides a simple image-analysis measurement method that could inspire FilaFabric's physical-validation protocol (standardized circular sample, support diameter, overhead image, and DC). The sample values cannot be assigned to FilaFabric presets without matching geometry, TPU formulation, dimensions, and print conditions. Treat the garment-category suggestions as design hypotheses, not validated clothing recommendations; the authors explicitly call for more property testing and cross-material/process comparisons.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 1–3, Method, Fig. 1, Results and Discussion. **Class/status:** planar S/M geometry, direct sheet evidence; layer count unspecified.

**Paper facts.** Ten TPU FDM auxetic networks, including a floral design, were printed as 200 mm discs and photographed over an 81 mm support; three repetitions were used. Unit dimensions were standardized, but entire topologies differed. Mean projected-area drape coefficients ranged from 26.15% to 52.07%; smaller values indicate greater drape. This comparison establishes topology-dependent differences under one setup, not the effect of an isolated arm parameter. The coefficient here is projected draped area divided by undraped area, without a stated support-area subtraction.

**Proposed translation.** Add a planar floral/re-entrant comparison set with matched cell pitch, strand width, thickness, disc diameter, and boundary treatment. Record mass and test both print directions. Do not infer comfort, recovery, or garment suitability from drape alone; the clothing categories in the conclusion are suggestions, not wear trials.

### 5. Second full-text pass — 24 October 2026

**Per-geometry drape (PDF pp. 1–2, Fig. 1).** The text gives only S-numbers; the geometry descriptions below are a visual reading of Fig. 1 at high zoom, so treat them as approximate. Unit cells are rectangles with a 0.6 in diagonal or equilateral triangles with 0.6 in sides. Geometries were adapted from Bhullar 2015, Borovinšek et al. 2020, Kim et al. 2021 and Körner & Liebold-Ribeiro 2014. Projected area was measured with Photoshop's histogram tool from a single top photograph (not Kalman's rotating rig).

| Sample | Geometry (visual reading) | Mean DC % (lower = drapes more) |
|---|---|---|
| S10 | floral / petal cells with curved arms (likely the authors' floral design) | 26.15 |
| S7 | curly, chiral-looking meandering ligaments | 29.68 |
| S3 | small staggered re-entrant hexagons | 30.24 |
| S4 | four-pointed star cells | 32.23 |
| S5 | rotated zigzag / Z-shaped units | 36.24 |
| S8 | diagonal zigzag units, similar to S5 | 38.68 |
| S1 | rows of chevron (arrowhead) units | 42.61 |
| S9 | re-entrant (bow-tie) honeycomb with straight vertical struts | 43.98 |
| S6 | curved-ligament square grid (continuous wavy lines) | 44.52 |
| S2 | triangles joined by struts | 52.07 |

**Pattern implications.** An interpretation, not a tested finding: the most drapable samples (S10, S7) have long, convoluted ligaments with no straight line crossing the sample. The least drapable ones (S2, S6, S9) contain continuous straight or gently curved lines spanning many cells, which can act as stiff load paths in bending. Worth testing in FilaFabric's auxetic and curved-cell variants: interrupt long straight load paths, or lengthen ligaments, to increase drape. Matched swatches are needed, because these ten samples also differ in mass and cell type.

---

## Paper 25: Kabir-2023 — Tensile Behavior of 3D Printed Knit Textiles
**File Name:** `Kabir-2023_Tensile-Behavior-of-3D-Printed-Knit-Textiles.docx`

### 1. Summary & Core Focus
Kabir, Li, and Lee report an exploratory tensile study of five TPU FDM-printed knit structures. Because of commercial-printer/modeling limitations, each sample was assembled from distinct courses of continuous loops (30 mm loop length) and formed into a 7 × 3 inch specimen. Five repetitions per knit were tested in the wale direction using the ISO 13934-2 grab method on an Instron at 76 mm/min. The study reports maximum force of 79.50–117.63 N and maximum elongation of 228.93–338.67 mm (approximately 300–444% by the authors' calculation).

The force–elongation traces show an initial approximately linear elastic region, followed by nonlinear partially recoverable deformation, then permanent deformation and gradual yarn/strand failures after peak force. The authors note the trace resembles a conventional knitted-fabric force-extension response, but they recommend statistical validation of that comparison. These results show that printed loop networks can extend substantially in one direction; they do not establish comfort, fatigue life, or multidirectional garment performance.

### 2. Mathematical & Structural Formulations
No model. The curve is read in four regions after Penava et al. (2021): linear elastic (loops move within the structure) → partially recoverable elastoplastic → plastic yarn deformation up to peak force → stepwise drops as individual strands break. The reported percentages equal elongation ÷ 76.2 mm: 228.93/76.2 = 300.4% and 338.67/76.2 = 444.5%. That is the 3 in specimen dimension, not the standard 100 mm grab gauge length, so compare percentages only within this paper.

### 3. Relevance & Design Takeaways for FilaFabric
Highly relevant to FilaFabric's **Loop pile and other loop/knit-inspired structures** as a reminder to distinguish low-load reversible stretch from elongation at break. It suggests reporting direction-specific force–extension and recovery rather than labeling a pattern “stretchy” based on geometry alone. Transfer is limited: this study prints and assembles 30 mm loop courses, tests only wale direction, and does not evaluate FilaFabric's continuous paths, printer/material profile, cyclic loading, or course-direction behavior. It specifically identifies loop length and course-direction testing as open variables, which are good candidates for FilaFabric validation swatches.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** DOCX sections Method, Results and discussion, Conclusion; Fig. 1. **Class/status:** assembled loop textile; transferable to planar S/M motifs, not direct tall-pile evidence.

**Paper facts.** Five TPU FDM knit variants were made as separate courses containing continuous 30 mm loops, then assembled into 7 × 3 inch specimens. Five tensile repetitions per variant used the wale direction and 76 mm/min extension. Maximum forces were 79.50–117.63 N and elongations 228.93–338.67 mm. The authors interpret the curve as elastic, elastoplastic, permanent deformation, then progressive strand failure. They did not cyclically verify recovery or test the course direction.

**Proposed translation.** Develop a flat serpentine or loop-connected sheet with controls for loop length, width, neck width, and connection spacing. Fusing crossings changes its mechanics from the assembled knit, so the reported elongation cannot calibrate that translation. Compare low-load extension and residual deformation separately from break elongation. Replace the master's loop-pile association: this source supplies no upright-loop deposition recipe or Z-lift calibration.

### 5. Second full-text pass — 24 October 2026

**Per-structure results (DOCX, Results).**

| Knit | Max force (N) | Max elongation (mm) |
|---|---|---|
| 1 | 109.15 | 336.96 |
| 2 | 79.50 | 228.93 |
| 3 | 110.70 | 338.67 |
| 4 | 117.17 | 292.40 |
| 5 | 117.63 | 268.11 |

Tests used an Instron 5565 with a 5,000 N load cell at 76 mm/min. The five knit variants are shown only in Fig. 1A, not described in the text, so their geometric differences cannot be recovered from the prose. The authors name loop length (only 30 mm tested) as the next variable to study, and call for course-direction tests.

**Pattern implications.** No new geometry beyond the existing loop-course proposal. The force spread (79.5–117.6 N) across variants of a single loop length suggests the knit structure alone changes strength by about 1.5×. Planar loop motifs therefore need their own variant-by-variant tests, not one "knit" value.

---

## Paper 26: Kabir-2024 — Orientation Angle and Stretchability of 3D Printed Auxetic Textiles
**File Name:** `Kabir-2024_Orientation-Angle-and-Stretchability-of-3D-Printed-Auxetic-Textiles.pdf`

### 1. Summary & Core Focus
This ITAA 2024 exploratory experiment tests whether center-facing-arm orientation changes the low-load stretchability of FDM-printed auxetic textiles. The authors printed six TPU specimens (three re-entrant and three floral) with a 7 × 3 inch test size, identical nominal unit size, and three angles per geometry: re-entrant 25°, 30°, 35° and floral 100°, 105°, 110°. Tensile tests followed the ISO 13934-2 grab method; the elastic-region load/elongation response was analyzed under low loads intended to represent body movement, with three repetitions per design.

For both geometries, higher orientation angle reduced the force needed for a given extension in the tested range. The reported re-entrant values were approximately 0.06 N/mm for 25° and 30°, falling to 0.04 N/mm at 35°; floral values fell from 0.03 N/mm at 100° to 0.01 N/mm at 105° and 110°. This is evidence that arm orientation is a potential control for elastic compliance, not a general claim that every larger angle increases stretch. This conference paper focuses on stretchability. The later 2025 journal paper (27) reports **the same specimens**: its regression statistics are identical (for example floral F(1,1673) = 3168.18, 3898.59 and 2478.87), with the floral angles relabelled 55°/60°/65° under a corner-boundary measurement convention, a constant 45° offset. It adds a maximum-force analysis. The two papers are not independent replications. The authors limit their conclusion to two geometries and call for more structures and validation.

### 2. Mathematical & Structural Formulations
**Definitions (PDF p. 1):** the *centre-facing arms* are the concave lines pointing toward the cell centre; the *orientation angle* is the angle between a centre-facing arm and the extended side of the cell. Stretchability is a simple linear regression of load on elongation inside an assumed elastic, low-load window (6 N re-entrant, 4 N floral). The slope is reported as N per mm. R² was 0.71, 0.74 and 0.86 for re-entrant 25°, 30° and 35°, and 0.65, 0.70 and 0.60 for floral 100°, 105° and 110°. The fits explain only 60–86% of the variance.

### 3. Relevance & Design Takeaways for FilaFabric
Directly relevant to FilaFabric's **Auxetic mesh and Star lattice** concepts: orientation angle is a plausible, interpretable geometric parameter for tuning low-load extension. The numerical slopes are not a calibration target for FilaFabric because the exact geometry, dimensions, print settings, TPU, and test setup differ. It supports exposing geometric controls only when they preserve cell connectivity/printability and pairing them with a physical validation protocol; the study does not measure drape, cyclic recovery, wear comfort, or durability.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 1–3, Method, Fig. 1, Results and discussion. **Class/status:** planar S/M auxetic sheets; direct topology/control evidence, layer count unspecified.

**Paper facts.** Six TPU FDM nets compare re-entrant arm angles 25°, 30°, 35° and floral angles 100°, 105°, 110°, with three repetitions and identical nominal 0.6 inch cell diagonal. Specimens were 7 × 3 inches. Grab-method tensile measurements analyze loads up to 6 N for re-entrant and 4 N for floral designs. Reported load-per-extension slopes decline from about 0.06 to 0.04 N/mm and from 0.03 to 0.01 N/mm across the tested ranges. Nearby settings sometimes have the same rounded slope.

**Proposed translation.** Expose re-entrant angle, cell diagonal, curved-arm shape, and minimum neck width while enforcing connectivity. Test actual swatches at controlled loads; a larger angle is not universally better. This conference version and the 2025 journal paper share one dataset; only the floral angle labels differ (100/105/110° here, 55/60/65° there). Neither establishes comfort, fatigue life, or a universal constitutive equation.

### 5. Second full-text pass — 24 October 2026

**Added details.** The angle definition and R² values are now in section 2. The paper also cites a journal version of the drape study, Kabir, Li, Salahuddin & Lee, *Clothing and Textiles Research Journal* (2023, OnlineFirst), "Drapability of 3D-printed auxetic structure textiles for wearable products through the digital image processing technique". It is not held locally and may contain the geometry definitions missing from the conference abstract (24). The authors justify the low-load window by saying the pressure from body movement is equivalent to the textile's elastic zone. That is a cited claim, not a measurement.

**Pattern implications.** For a FilaFabric auxetic control, define the angle the same way (centre-facing arm against the cell's extended side) so values can be compared with Kabir's, and show the arm length it implies. No further geometry is added.

---

## Paper 27: Kabir-2025 — Orientation Angle and Elongation of 3D Printed Auxetic Textiles
**File Name:** `Kabir-2025_Orientation-Angle-and-Elongation-of-3D-Printed-Auxetic-Textiles.pdf`

### 1. Summary & Core Focus
Kabir, Li, and Lee experimentally test how the orientation angle of the center-facing arms affects elongation and maximum force in two re-entrant auxetic textile geometries: straight-arm star cells and curved-arm floral cells. Six TPU samples were designed in Rhino with a 0.4 mm thickness and 7 × 3 inch dimensions, printed by FDM with a 0.4 mm nozzle, 0.2 mm layers, 220 °C nozzle and 60 °C bed. Three replicates per geometry/angle were subjected to tensile testing based on ISO 13934-2; low-load elastic response was used to compare elongation, and maximum force to compare strength.

Within the tested angle ranges, increasing angle reduced the force needed for extension: the star variants tested at 25°, 30°, and 35° required approximately 0.06, 0.06, and 0.04 N per mm elongation, respectively; floral variants at 55°, 60°, and 65° required about 0.03, 0.01, and 0.01 N/mm. Larger angles also lengthened the center-facing arms, providing more room for cells to unfold. Maximum breaking force did not differ significantly by angle for either geometry (reported means ranged from 16.57 to 20.58 N for star and 12.08 to 16.61 N for floral; p values .12 and .08). The authors therefore suggest geometry angle can tune compliant extension without a statistically demonstrated strength penalty in these tests.

The result is bounded: only two topologies, three angles each, one TPU/FDM setup, and three replicates were tested. The authors did not test FilaFabric's exact generated geometry, print orientation, cycle life, garment comfort, or broader range of strains; higher elongation is not itself proof of better wearability. They call for broader angles/materials and tests of drape, stiffness, and dimensional stability.

### 2. Mathematical & Structural Formulations
Same definitions as Paper 26: the orientation angle is measured between a centre-facing arm and the unit boundary drawn through its four outer corners, using a chord for curved floral arms. Load is regressed on elongation inside 6 N (star) or 4 N (floral). One-way ANOVA on maximum force: F(2,6) = 3.16, p = .12 (star); 4.09, p = .08 (floral).

### 3. Relevance & Design Takeaways for FilaFabric
This is **directly relevant to FilaFabric's Auxetic mesh and proposed auxetic-cell controls**. It supports making re-entrant arm orientation a tunable design parameter and predicts a trade-off worth exposing to users: within the tested ranges, a larger angle made extension easier without a significant measured change in breaking force. FilaFabric should not equate that result with guaranteed garment comfort or strength; any similar control requires mechanical validation on the actual exported geometry, material profile, and print orientation. The reported 220/60 °C settings are for the study's TPU and printer and are not MK3S/Filaflex Foamy recommendations.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 6–11, §§3–4, Figs. 1–4. **Class/status:** M, direct two-layer flat-net evidence.

**Paper facts.** Straight-arm star and curved-arm floral cells were extruded to 0.4 mm and FDM-printed in TPU at 0.2 mm layer height. The fixed diagonal was 0.6 inches; angles were 25°/30°/35° for stars and 55°/60°/65° for floral cells. Increasing angle also increased arm length, so angle is not isolated from geometric length. Low-load slopes became smaller across the tested ranges; 5° changes were sometimes indistinguishable. With three specimens per condition, maximum-force differences were not statistically significant (p=.12 and .08).

**Proposed translation.** Add star and floral flat nets with an explicit angle diagram, arm-length readout, fixed pitch, and printable neck limits. Map compliant and reinforced regions experimentally. Absence of a significant strength difference does not establish equal strength or guaranteed preservation. The paper provides neither cyclic recovery tests nor a validated comfort predictor; its TPU settings do not transfer automatically to Foamy filament.

### 5. Second full-text pass — 24 October 2026

**Same data as the 2024 conference paper.** The F statistics, R² values and slopes are identical to Paper 26 (star 25/30/35°; floral F = 3168.18, 3898.59, 2478.87). The floral cells labelled 100/105/110° there are labelled 55/60/65° here. Treat Papers 26 and 27 as **one experiment reported twice**, not as corroboration.

**Added details (PDF pp. 4–11).**
- **Angle measurement:** draw the boundary line through the four outer corners of the repeating unit. For straight star arms, measure arm-to-boundary. For curved floral arms, measure from a straight chord drawn along the curve.
- **Arm lengths grow with angle** (Fig. 4): star 5.94 / 6.23 / 6.73 mm at 25 / 30 / 35°; floral 7.84 / 8.37 / 8.79 mm at 55 / 60 / 65°. Angle and arm length are confounded.
- **Curves separate only after an initial load:** about 1 N for floral and 2 N for star. A 5° step was often indistinguishable; a 10° step was visible.
- **Maximum force:** star 16.57 / 20.58 / 19.03 N; floral 16.61 / 14.90 / 12.08 N. Not significant with n = 3, although the floral trend falls with angle.
- **Set-up:** 0.4 mm-thick models, direct-drive FDM, 0.4 mm nozzle, 220/60 °C, 0.2 mm layers; 76.2 mm (3 in) clamp distance.
- The literature review names **three printable auxetic families**: re-entrant cells (star, floral), **nodule-and-fibril** networks (nodules pushed apart as fibrils straighten; used for flexible supportive meshes) and **rotating units** (squares, triangles or rectangles hinged at vertices).

**Pattern implications.** (1) Expose the arm-length readout next to any re-entrant angle control, since the measured effect may come from length. (2) Use 10° rather than 5° steps for comparison swatches. (3) *Nodule-and-fibril net* is a third auxetic family not yet in the catalogue: thick nodes joined by thin, angled fibrils. It suits FilaFabric's line-and-dot vocabulary, but needs geometry from its primary sources (refs. 44–45 here, not held).

---

## Paper 28: Kaiser-Elsacker-2026 — Towards Textile Templating in Mycofabrication Knitted Structures as Substrate and Scaffold
**File Name:** `Kaiser-Elsacker-2026_Towards-Textile-Templating-in-Mycofabrication-Knitted-Structures-as-Substrate-and-Scaffold.pdf`

### 1. Summary & Core Focus
Kaiser et al. investigate knitted textiles as both substrate and three-dimensional scaffold for mycofabrication with Ganoderma lucidum. Two experimental approaches—seeding-based inoculation and liquid-state fermentation—test how fibre type and knit structure influence colonization. Cellulosic fibres (notably cotton and linen) supported more integrated growth than acrylic in the reported tests; preliminary work found dipping concentrated growth on the textile more effectively than submerging. Preliminary incubation uses 15 days at 26 °C; experiment 1 ends at 12 days and experiment 2 runs 28 days. Microscopy documented hyphal growth along fibres, between loops, and across gaps. The study combines controlled lab experiments with design-led exploration, and proposes textiles as active interfaces for directing growth rather than merely reinforcement. Outcomes depend on organism, nutrient medium, fibre chemistry, absorbency, knit, and inoculation conditions; the paper does not test FDM or demonstrate a finished durable garment. It is relevant to FilaFabric only as biological-textile context and must not be conflated with the website's printed swatches.

### 2. Mathematical & Structural Formulations
This is a wet-lab mycofabrication study using knitted substrates. It does not formulate FDM loop height, yarn-radius kinematics or Z-lift motion. Relevant variables are knit/fibre type, inoculation method, incubation conditions and observed colonization; these are not thermoplastic deposition parameters.


### 3. Relevance & Design Takeaways for FilaFabric
This is **adjacent biofabrication research**, not a direct source for FilaFabric's Loop pile/Bouclé geometry or Z-lift calibration. Its transferable design idea is that textile topology, porosity, fibre composition, and moisture can guide biological growth; its organism and process need controlled wet lab conditions absent from FilaFabric. It does not substantiate printable textile performance or bioprinting capability.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5–12, §§3–5; pp. 13–15 discussion/conclusion. **Class/status:** outside printed S/M/N; biological-process context only.

**Paper facts.** Conventional knitted acrylic, wool, cotton, and linen were investigated as interfaces for Ganoderma lucidum. Seeding experiments used water-soaked, sterilized rib knits and ended after 12 days; the later tubular-scaffold experiment dipped wool/cotton columns in nutrient culture and incubated for 28 days. Cotton showed integrated growth where liquid contacted it, but not a continuous skin; wool showed no active column growth. The dried cotton column remained weak. The preliminary 15-day protocol is not the duration of every experiment.

**Proposed translation.** At most, borrow the idea of recording porosity, backing material, and local coverage as separate design variables for a lace/backing comparison. That is a conceptual analogy, not a bioprinting or filament recommendation. Delete the master's purported loop-height, yarn-radius, and Z-lift formulation: the paper supplies no FDM kinematics or printed-loop equations. Nutrient delivery, fibre chemistry, and sterile growth conditions dominate its results.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 5–13).** Samples were 1 × 1 rib knits (12 gg Shima Seiki or 8 gg Dubied): 5 × 5 cm squares and 2 × 16 cm strips. Water uptake scaled with dry mass (about 3.2–4.1 g and 7.4–9.3 g). Liquid dipping left **sharp growth boundaries at the dip line**, with fading below where the liquid drained. The authors suggest this as a designable patterning effect. The colonized cotton column stiffened enough to stand upright after drying but stayed weak; the uncolonized wool column collapsed.

**Pattern implications.** None for printed geometry. The paper remains biological context only, and adds nothing beyond the earlier note on recording porosity and coverage.

---

## Paper 29: Kalman-2021 — Automated Draping Analysis 3D Printed Flexible Isogrids
**File Name:** `Kalman-2021_Automated-Draping-Analysis-3D-Printed-Flexible-Isogrids.pdf`

### 1. Summary & Core Focus
Kalman, Fayazbakhsh, and Martin develop an automated, image-based method to quantify drape of single-layer TPU isogrid sheets. They designed circular 100 mm specimens with five raster/isogrid patterns, three infill percentages (25%, 50%, 75%), and three loading cases (no added weights, four weights, eight weights), yielding 45 tests. A compact apparatus with top and side cameras captures the specimen as it is rotated through 360 degrees; image processing measures drape coefficient (DC) and records drape mode/pleat geometry. The samples were printed in one 0.25 mm layer using 91A TPU, a 0.4 mm nozzle, and a direct-drive printer (220 °C, 50 °C bed, 900 mm/min).

The measured DC range was 21.9–91.5%, demonstrating that raster architecture and density can produce a wide spectrum of drape responses. At the lowest infill, the pattern itself significantly affected DC; mass alone did not explain drape. Added edge weights changed the number and shape of convex/concave nodes, with at most three observed for 25% infill under loading. The main contribution is a repeatable physical characterization workflow, not a predictive equation for all textile structures. Results are specific to these circular isogrid specimens and 91A TPU; they do not establish drape for FilaFabric's named patterns or Foamy filament.

### 2. Mathematical & Structural Formulations
DC = draped pixel count / undraped pixel count × 100%, with the 100 mm disc equal to 148,552 px in a 500 × 500 crop. The isogrid family is π/m with m distinct line directions. Draping mode is M = (number of convex pleats, number of concave pleats), and a region that is neither is counted as 0.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **directly useful validation reference** for FilaFabric's many pattern presets and preview claims about flexibility/drape. Its automated camera-and-image-analysis setup could be adapted to compare exported swatches under standardized dimensions, support diameter, orientation, and loading, and to report both DC and drape mode. It also suggests that pattern topology and density may matter beyond mass, so geometry comparisons should hold material and specimen mass/size controls where possible. The paper's numerical drape range is not transferable to FilaFabric designs without matching material, geometry, thickness, and test procedure.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5–8, §§2.1–2.2; pp. 10–18, image analysis/results. **Class/status:** S, direct nominal single-layer sheet evidence, with local crossing stacks.

**Paper facts.** Fifteen 100 mm discs combine five raster families and 25%, 50%, 75% infill in one 0.25 mm TPU layer. Families include orthogonal, triangular, four-, five-, and six-direction line grids. Intersections locally stack deposited extrudates; these are not independently sliding woven yarns. Testing used zero, four, or eight 1.5 g perimeter weights. The overall 21.9–91.5% drape range pools very different loads; unweighted specimens alone gave 80.7–91.5%.

**Proposed translation.** Add a multidirectional isogrid family controlled by direction count, angular phase, pitch, line width, and crossing order. Compare matched thickness/mass and report loading explicitly. Use the paper's image workflow to measure silhouette and pleat mode, not to promise drape from infill percentage. Its nominal-layer crossing behavior also needs nozzle-clearance and print-quality testing on the actual machine.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 5–18).**
- **Isogrid family** π/m (m = number of distinct line angles): π/2 = 0/90; π/3 = 0/±60; π/4 = 0/±45/90; π/5 = 0/±36/±72; π/6 = 0/±30/±60/90. The authors do not count m = 2 as an isogrid.
- **Crossings in the single 0.25 mm layer stack m extrudates.** The nozzle is pushed up as it crosses earlier strands, so a π/3 crossing holds three strands in print order 0°, 60°, −60° (Fig. 6c). The nominal one-layer sheet therefore has crossing mounds up to m strands high.
- **Mass:** rises steeply with infill. At equal infill it rises little from m = 2 to 4 but more from 4 to 6.
- **Rig:** M3 × 8 bolt plus three nuts = 1.5 g per weight, at 0°, 90° and ±45° (8 weights = 12 g; 4 weights = 6 g). A 150 mm enclosure with IR top and side cameras photographs 12 positions at 30° steps, 2 s still each, about 30 s per specimen. MATLAB `bwarea` on a 500 × 500 crop; the undraped disc is 148,552 px.
- **Drape coefficients** (lower = drapes more):

| Load case | Notable results |
|---|---|
| A (8 weights) | 25%: π/3 21.9 (lowest) to π/5 27.2. 50%: π/2 36.0 to π/6 44.0. 75%: π/2 39.9 to π/6 51.3. |
| B (4 weights at 0/90) | 25%: π/5 34.1 to π/2 38.7. Overall maximum π/6 at 75%, 60.2. |
| C (no weights) | 80.7 (π/3, 25%) to 91.5 (π/6, 75%). |

  Each extra 25% infill added more than 10 percentage points of DC.
- **Why:** at 25% infill the sheet is strongly anisotropic, so weights lying along strand directions are resisted (higher DC). At higher infill or higher m it behaves quasi-isotropically and mass dominates.
- **Draping modes** (convex, concave pleats), load case A at 25%: π/2 (3,3), π/3 (3,2), π/4 (2,2), π/5 (3,3), π/6 (2,2). At 50% mostly (2,0); at 75% all (1,0). Unloaded discs were all (1,0). Weights act like a larger specimen and bring out more pleats.

**Pattern implications.** This is the direct evidence base for the hidden Crosshatch & Isogrid card: offer the π/m direction sets explicitly, and report crossing stack height (up to m strands) and print order. At low density, align line directions with the expected load or drape axes on purpose; at high density, pattern choice matters less than mass. For FilaFabric drape tests, copy the bolt-and-nut perimeter weights and the 12-view rotation, and report DC and mode (n₁, n₂) together.

---

## Paper 30: Keefe-2022 — Textile Additive Manufacturing An Overview
**File Name:** `Keefe-2022_Textile-Additive-Manufacturing-An-Overview.pdf`

### 1. Summary & Core Focus
Keefe et al. (2022) review two broad textile-additive-manufacturing routes: printing polymer onto existing fabric and additively manufacturing textile-like structures themselves. They discuss adhesion and form-locking on porous substrates, the effect of printed regions on drape and garment construction, and testing needs including peel, tear, bending, abrasion, and washing. They emphasize that material/fabric pairing, bonding, drape retention, and deformation recovery all matter; pore-bearing nets can improve mechanical interlocking, whereas closed woven fabrics are more difficult to bond. This is a narrative overview, not a systematic review with a reproducible search protocol or new experiments. It offers a framework for evaluating hybrid print-on-fabric applications but does not provide validated FilaFabric settings or evidence for free-standing Foamy textile paths.

### 2. Mathematical & Structural Formulations
No formulation; a narrative review. For adhesion it cites 180° peel strength (BS EN 28510-1), plus tear, bending-length, abrasion and wash tests, and the contact-angle–adhesion trend from Kozior et al.

### 3. Relevance & Design Takeaways for FilaFabric
This review is **relevant background for FilaFabric's potential print-on-fabric use and validation planning**. It supports measuring adhesion together with drape, tear, abrasion, and wash durability, and distinguishing substrate printing from free-standing textile generation. It does not establish performance of FilaFabric's current free-standing paths or validate its MK3S/Filaflex Foamy profile; consult the primary studies for quantitative claims.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 3–7, §2; pp. 9–11, §2.2. **Class/status:** secondary review; useful S/M pattern leads and hybrid-textile methods.

**Paper facts.** The review distinguishes printing onto existing textiles from printing textile-like structures. It discusses form-locking through porous cloth, nozzle distance, bonding, drape retention, abrasion, washing, and deformation recovery. Its standalone section specifically describes Peleg's FilaFlex textiles, based on Bastian's planar mesostructures, and Spahiu's auxetic Filaflex dress (the review does not name the arrowhead shape; 23 and 43 do). It also covers SLS knitted links, pillar/stringing weaving, and vertically built DefeXtiles; those are different manufacturing routes, not interchangeable flat-sheet demonstrations.

**Proposed translation.** Recover the planar hexagonal/meander and auxetic-dress precedents as candidate S/M families, then consult their primary sources. For lace-on-backing variants, independently expose printed coverage, gap size, and backing choice; pair adhesion tests with drape measurements. The present master underuses this source by reducing it largely to print-on-fabric context. Do not copy the review's stronger commercial performance claims into FilaFabric, and do not reclassify its upright or independent-link examples as user-target evidence.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–12).**
- **Peleg / Bastian mesostructures** (pp. 10–12, Fig. 7 on p. 12): Peleg printed her 2015 collection in **FilaFlex**, and her planar patterned textiles were based on mesostructures designed by Andreas Bastian. The review says the patterns bend and flex into drape, allow omnidirectional movement in one plane, and form a "non-restrictive hexagonal grid". The Fig. 7 caption calls them cellular, auxetic and "repeating planar (extruded) patterns"; the images are Bastian's, via danitpeleg.com. No dimensions are given. In the photographs the units are three-armed, with parallel bars between the arms, on a hexagonal lattice. Some panels show **deep blocks of tall walls**; the bottom two rows show **thin sheets** of a similar pattern flexed by hand.
  - Sitotaw (56, Table 2) classes Bastian's mesostructure as *thin-layer plate kinematics*: thin, nearly parallel plates at 90° to the nominal surface, joined at their ends. Sitotaw does not mention Peleg or give a height.
- **Drape on fabric:** citing Spahiu et al. 2017, the review says drape depends strongly on the free spaces between printed areas and on the fabric's areal weight. The review adds that print positions should take account of intended folds and stitches, with 3D elements placed around them so they do not interrupt garment construction.
- **Adhesion leads** (cited):
  - Kozior et al. 2018: more hydrophilic fabric gives higher adhesion. Adhesion seems to saturate below a contact angle of about 60–80° and falls steadily above it, a factor of 2 between the highest and lowest angles. Roughness tends to be higher near a 90° infill angle, and the first layer is rougher than the second.
  - Meyer et al. 2019: a 5% PMMA coating helps hard PLA; high inter-fibre friction is a prerequisite.
  - Grimmelsmann et al. 2018: adhesion tracks polymer layer thickness.
  - Ironing helped in one study and did nothing in another.
- **Form by pre-stretch ("Active Fabrication";** Agkathidis et al. 2018, Berdos et al. 2020; Gabe Fields): TPU printed onto stretched Lycra pops into 3D when released. Pattern layout can set regions of positive and negative Gaussian curvature. FabriClick prints button patterns on pre-stretched Lycra and stitches them over an embroidered circuit layer.
- **Shape memory** (Leist et al. 2017): PLA printed on nylon/spandex power mesh is shaped in hot water (70 °C in one demonstration, above 60 °C in another), keeps the shape when cooled, and returns when reheated.

**Pattern implications.** (1) Bastian's mesostructure appears in Fig. 7 at more than one depth. The deep-block versions are outside the thin-sheet brief. The thin-sheet versions are a plausible S/M candidate: a three-fold arm-and-bar unit on a hexagonal lattice, printed one or two passes high. Whether the thin versions keep the plate-bending behaviour Sitotaw describes is untested. Retrieve Bastian's files (Thingiverse thing:289650, Sitotaw ref. 98) before fixing dimensions. (2) For hybrid work, pre-stretched-fabric printing is a fourth shaping route alongside S, M and N. It is a different process (planar print, shape from released fabric tension) and stays outside the bed-only brief.

---

## Paper 31: Kim-Lee-2025 — Continuous Textile Structures Utilizing 3D Printing
**File Name:** `Kim-Lee-2025_Continuous-Textile-Structures-Utilizing-3D-Printing.pdf`

### 1. Summary & Core Focus
Kim and Lee (2025) experimentally investigate continuous TPU textile structures using conventional fixed-bed material extrusion (MEX) and conveyor-based material extrusion (CMEX). They compare four TPU filaments and develop plain weave, loop-connected/knit, and spacer structures, optimizing deposition angle and inter-yarn gap for the two processes. CMEX uses an inclined nozzle and conveyor, addressing fixed-bed size limits; the study examines 15°, 25°, 35°, and 45° deposition angles alongside line thickness and spacing. It also measures tensile, bending, tear, and elongation properties and evaluates dyeing, washing, and dry-cleaning behavior.

The authors report that CMEX enabled continuous lengths unavailable on their fixed-bed printer, but nozzle angle materially affected surface morphology and structural integrity. Across tested structures, spacer fabric had the highest tensile and tear strength, while bending rankings depended on the test: the heart-loop test found knit stiffer than weave, with line-width differences confounding a pure topology comparison. The source also has a 15/25-degree discrepancy in its knit-angle summary; do not select a universal optimum from that claim. Filament selection involved thermal stability, tensile properties, and dyeability; disperse dye produced the most stable coloration, with good wash and moderate dry-cleaning fastness. These findings are specific to the Blackbelt conveyor/Cubicon printers, tested TPU filaments, geometries, and settings (including 0.2 mm layers, 230 °C nozzle and 65 °C bed); they do not validate FilaFabric's MK3S profile or establish equivalent continuous-print capability.

The paper is unusually relevant because it joins path geometry, print orientation, material selection, and textile-like physical testing. Still, it is not a direct evaluation of FilaFabric patterns, and its claim of apparel potential should be distinguished from demonstrated garment wear trials.

### 2. Mathematical & Structural Formulations
The experimental variables include deposition angle (CMEX), line thickness, inter-yarn gap, and structure type; outcome measures include surface morphology and tensile, bending, tear, and elongation behavior. The study does not derive a general constitutive or path-planning equation. Its CMEX geometry relies on an inclined nozzle and moving belt, so its angle results cannot be applied directly to flat-bed FilaFabric G-code.

### 3. Relevance & Design Takeaways for FilaFabric
This is **highly relevant to FilaFabric's continuous textile path and pattern-validation goals**. It supports testing each architecture with its own spacing, line-width, and orientation settings, then evaluating multiple mechanical outcomes rather than assuming one “best” textile structure. Its comparative textile tests can help shape a validation plan for FilaFabric swatches. However, CMEX depends on specialized conveyor hardware; the paper's angle settings, dyeing results, and mechanical values do not transfer to the MK3S/Filaflex Foamy profile, and no FilaFabric feature should claim continuous garment-scale production on that basis.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5–7, Experimental; pp. 9–16, geometry/morphology/mechanics. **Class/status:** thin weave/knit sheets transferable to M; spacer thickness and belt hardware are separate constraints.

**Paper facts.** CAD-modeled plain weave, loop-connected knit, and spacer fabrics were printed with fixed-bed MEX and conveyor CMEX. The study varies line thickness, gap, and conveyor deposition angle. Plain-knit 0.6 mm lines failed; 0.8 mm lines succeeded. Greater conveyor angle could blur lines and close small gaps. Spacer structures were stronger but thicker. Importantly, the heart-loop stiffness test found the tested knit stiffer than weave, attributed to its thicker lines; bending displacement tells a different, test-specific story. The text also inconsistently summarizes knit optimum as 15° versus 25°.

**Proposed translation.** Compare flat fused weave and loop motifs while independently varying line width, pitch, clearance, and layer count. Do not rank flexibility from topology alone or transplant belt angles to MK3S. A conventional vertical nozzle does not mean the textile sheet was printed upright.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 5–18).**
- **Filaments compared:** eSun eFlex 87A, eSun TPU 95A, NinjaTek Cheetah 95A and NinjaTek Armadillo 75D. All exceeded 200% elongation; eSun 95A broke at the highest force and was used for the textiles. Decomposition begins near 200 °C. Printing was at 230 °C, because below 220 °C the filament would not flow smoothly. Table 1 gives a 65 °C bed, but the text says 80 °C; another internal inconsistency.
- **How the weave was modelled:** each strand is a zigzag up/down sketch line with filleted corners, swept at 0.6 or 0.8 mm line thickness. Crossing height is set to line thickness plus half the radius so lines do not overlap. Gaps of 0.6–10 mm were tried. The result is a sliced solid sheet (100% line infill, 0.2 mm layers), an undulating-strand construction rather than toolpath-level weaving. The fixed-bed printer held 0.6 mm gaps; the conveyor printer blurred them at steeper angles. Best: 0.6 mm lines with 1.8 mm gaps; 0.8 mm lines for gaps of 4 mm or more.
- **Knit:** loops drawn as fit-point splines, thickened 1.5× for relief. 0.6 mm lines failed; 0.8 mm lines with 1.8 mm gaps worked.
- **Spacer:** straight and zigzag faces linked by "figure-eight" spacers 10 mm tall; best at a 1.2 mm gap and 45°.
- **Mechanics:** spacer tensile 0.069 N/mm² and about 200% elongation, roughly 6× the weave and knit. Maximum bending displacement: spacer 11.80 mm, weave 18.66 mm, knit 23.32 mm (weave and knit flexural strength was mostly too low to measure). All tear values exceeded the 13 N outer-garment guideline; spacer exceeded 40 N.
- **Two faces differ:** heart-loop tests found the **back (bed-facing) side slightly stiffer than the top** for both weave and knit.
- **Colour:** disperse dye worked (40 °C, 3% o.w.f.; absorbance fell 24%), while basic and acid dyes barely coloured TPU. Fading grades: wash 4.5, dry-clean 3.5 (dry-cleaning yellowed it). Staining onto nylon was poor (grade 1.5), so wash separately.

**Pattern implications.** (1) The filleted up/down strand with a crossing height of thickness plus half radius is a concrete N-class crossing rule; compare it with Dip Weave's ramps. (2) Report which face was on the bed, because the bed side measured stiffer. (3) Disperse dyeing is a documented post-print colour route for TPU sheets, as an alternative to two-filament halftone. (4) The tested grades (eSun eFlex 87A, eSun 95A, NinjaTek Cheetah 95A, NinjaTek Armadillo 75D) start just above NinjaFlex 85A and include Foamy's 95A, so the 95A results are the closest match to a current FilaFabric profile; nothing here is as soft as 85A.

---

## Paper 32: Klop-Carazo-2026 — WarpForm An Accessible Loom Add On for Weaving Non Rectangular Textile forms
**File Name:** `Klop-Carazo-2026_WarpForm-An-Accessible-Loom-Add-On-for-Weaving-Non-Rectangular-Textile-forms.pdf`

### 1. Summary & Core Focus
Klop et al. introduce WarpForm, an add-on for a standard hand-operated loom that enables variable consumption of individual warp threads. Using differential warp length and short-row weaving, the system supports non-rectangular and three-dimensional textile forms; the paper describes hardware, setup, process, woven samples, and a near-net-shape shoe-upper demonstrator. The prototype requires tension management, counterweights, and careful operation. This is a design/research demonstrator rather than a controlled manufacturing-performance study, and it addresses weaving rather than FDM. For FilaFabric it is indirect inspiration for how tool affordances can make shape control accessible and how textile-form workflows incorporate machine constraints; it does not substantiate non-planar printer toolpaths or zero-waste performance in the FilaFabric setting.

### 2. Mathematical & Structural Formulations
No formulation. Shape comes from differential warp consumption: partial (short-row) wefts add length locally, and periodically straightening and clamping the fell lets the extra length bulge behind the clamp. Weaving plans mark interlaced regions, bare warp and splits.

### 3. Relevance & Design Takeaways for FilaFabric
This is **background on shaping textiles through fabrication-tool control**, not direct evidence for FilaFabric's weave/crossing algorithms. The product lesson is to expose how user parameters correspond to machine actions and surface setup constraints. Varying warp consumption on a loom cannot be translated directly into FDM path or Z-lift behavior.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 7–13, §§3–4; pp. 17–19, §7. **Class/status:** conventional weaving; transferable planning concepts, no direct S/M/N FDM evidence.

**Paper facts.** WarpForm combines a fell clamp and independently weighted warp supply. Partial weft rows add material nonuniformly; periodically straightening and clamping the fell lets the completed fabric curve beyond the weaving zone. Plain 1×1 short-row samples demonstrate loops, domes, corners, and a shoe upper. Designs use weaving plans that distinguish woven regions, bare warp, and splits. Thick variations reduce clamp reliability, and pulling against counterweights requires substantial effort. User studies beyond the authors remain future work.

**Proposed translation.** Borrow the explicit fabrication map: show where a flat sheet receives extra path length, denser motifs, reinforcement, or an open split. Restrict an N exploration to shallow corrugations with verified print clearance. The loom achieves excess material through sliding yarn and tension release; adding extruded paths does not reproduce that kinematics. The source cannot justify automatic non-planar G-code or simulated shaping.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 7–17).**
- **Weaving-plan notation:** pink cells for interlaced regions, blue for bare warp, white lines for splits that need a second shuttle. A separate shuttle-path diagram shows the weft route.
- **Four form typologies:**
  - *soft forms:* gradual additions for domes and concave/convex curvature;
  - *sharp forms:* ridges and near-closed pockets without sewing;
  - *flat curves:* spirals whose warp and weft directions turn within the plane;
  - *warp sections:* split strips that give embedded loops or partial warp use.
- **Samples:** 240 cotton warps at 8 ends/cm.
- **Shoe upper:** 186 warps at about 16 ends/cm. Two soft bulges at the heel, a sharp transition over the toe box and a flat curve repeated four times across the vamp. Each form-giving step is marked in the cloth with brown thread and each fell-straightening with yellow.
- Construction files are published openly.

**Pattern implications.** The *flat curve* typology has a planar analogue FilaFabric can print: a sheet whose two path families rotate gradually across the panel, a spiral- or fan-shaped grid, so the panel's outline and strand direction change together. Sibling ideas are Conformal Mesh and Flow Lines, applied to a garment outline. The colour-coded plan, and marking each shaping step in the finished piece, are good conventions for a regional structure map (see Janssen & McQuillan, 21). The 3D typologies themselves depend on loom tension release and stay outside the bed-only brief.

---

## Paper 33: Kohler-Cebulla-2026 — The Impact of Differentiated Post Consumer Textile Waste Sorting on the Homogeneity of Recycled Yarns
**File Name:** `Kohler-Cebulla-2026_The-Impact-of-Differentiated-Post-Consumer-Textile-Waste-Sorting-on-the-Homogeneity-of-Recycled-Yarns.pdf`

### 1. Summary & Core Focus
Kohler and Cebulla study how differentiated sorting and mechanical recycling affect nep formation and yarn quality in post-consumer knitted textile waste. Their three-stage sorting separates garments by broad fibre category, label-reported blend, and stitch density; material is then cut/torn under varied conditions and evaluated for fibre/nep and yarn quality. The authors identify thermally melted cut edges in polyacrylonitrile-containing garments as a potential source of neps, and show that both input composition and processing parameters matter. This is specific to selected German waste bales, sorting technology, and tested recycling line; the authors note seasonal/regional variability and limits in composition recognition for complex blends. It is not a printed-polymer or filament-recycling experiment.

### 2. Mathematical & Structural Formulations
The study uses differentiated material sorting followed by controlled cutting/tearing and evaluates resulting neps and yarn-quality indicators. It does not propose a textile-geometry model or FDM process equation.

### 3. Relevance & Design Takeaways for FilaFabric
This is **indirect sustainability/material-stream context** for FilaFabric. It demonstrates that feedstock heterogeneity and mechanical processing influence recycled-yarn quality, but gives no evidence that printed FDM swatches can be recycled into filament or that FilaFabric's material is recyclable. Do not transfer its yarn results to polymer printing.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 4–14, §2; pp. 16–17, evaluation/conclusion. **Class/status:** outside printed S/M/N; material provenance and evaluation methods only.

**Paper facts.** Knitted garments were sorted by fibre category, label composition, and stitch density. Eighteen recycling batches varied cutting and tearing and incorporated primary wool for spinning. Polyacrylonitrile garments developed fused cut edges; manual cutting avoided those defects. Nep measurements in card sliver and yarn were not interchangeable because processing and variable yarn count affected comparability. Stitch density is calculated from course and wale densities, not an extrusion-density law.

**Proposed translation.** Store filament/substrate identity, batch, processing history, and measurement stage alongside S/M/N swatches, especially when comparing reused materials. A printed sample card could pair visually similar patterns while tracking actual material origin. This is a documentation analogy, not a new pattern family. The paper neither recycles TPU prints into filament nor quantifies printed-sheet sustainability. Preserve its uncertainty about measurement settings and mixed waste streams instead of turning sorting results into a generic recyclability claim.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 4–9).** The fine sort covered 1,615 garments from two "Acrylic Mix" bales. Most were fibre blends, and 119.55 kg (13.70%) had no readable label. The recognition system detects at most two-fibre blends. Stitch density follows DIN EN 14971 as $SD = SCD \times SWD$ (course density × wale density, stitches per dm²).

**Pattern implications.** None. This confirms the earlier conclusion: the paper is material-provenance context only.

---

## Paper 34: Konakovic-2016 — Beyond Developable Auxetic Materials
**File Name:** `Konakovic-2016_Beyond-Developable-Auxetic-Materials.pdf`

### 1. Summary & Core Focus
Konaković et al. present an interactive computational method for designing doubly curved forms from approximately inextensible flat sheets by introducing a regular slit pattern modeled as a triangular linkage. The linkage opens into variable-size hexagonal voids, allowing local expansion and auxetic-like deformation. Conformal geometry initializes a global nonlinear optimization that rationalizes the target surface into a continuous 2D layout; global optimization helps maintain seam continuity. Physical prototypes use sheet materials including metal, plastic, and leather, with a fabricated shoe demonstrating the method. This is slit-sheet fabrication, not printed lattice material, and it does not validate FilaFabric's auxetic paths. Its contribution is computational surface rationalization and the relationship between local expansion and target shape.

### 2. Mathematical & Structural Formulations
The slit pattern is idealized as rigid equilateral triangles, each hinged to three neighbours (PDF p. 3, §3). An infinite lattice has a single degree of freedom, uniform scaling. Every degree-2 boundary vertex adds one more, so edges are floppier than the interior. Fully open, the triangles and openings form the trihexagonal **kagome** pattern, with **4× the closed area** (2× in length). With a conformal scale factor $\lambda = e^{\varphi}$ bounded by $1 \le \lambda \le \sigma$, Gaussian curvature is $K = \Delta\varphi / e^{2\varphi}$. A projection-based optimization (Eq. 2) then balances closeness to the target surface, rigid triangle edge lengths and local non-penetration between neighbouring triangles.

### 3. Relevance & Design Takeaways for FilaFabric
This is **algorithmic background for auxetic surface design**, not direct FilaFabric performance evidence. Its triangular slit-linkage and conformal/global optimization could inform future surface-conforming concepts, but FilaFabric's continuous extruded strands have different kinematics and constraints. Do not transfer its expansion behavior or material results to the website's auxetic presets without geometry-specific testing.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 3–6, §§3–4; pp. 7–9, prototypes/limitations. **Class/status:** flat slit-sheet architecture transferable to S/M; post-forming evidence, not FDM validation.

**Paper facts.** Slits partition a nearly inextensible sheet into equilateral triangles joined at small hinges. Triangle rotation opens hexagonal voids, allowing locally near-isotropic expansion and doubly curved forms. Conformal initialization and nonlinear optimization handle global layout, rigid triangles, collisions, and seams. The ideal linkage can double in length, but physical hinge limits require smaller, empirically chosen bounds. Leather and other sheet prototypes demonstrate forming rather than extrusion.

**Proposed translation.** Add a rotating-triangle slit sheet: control triangle pitch, initial aperture, hinge width, and sheet thickness. Printing must retain compliant hinges and avoid welding gaps shut. This is a distinct auxetic family beyond re-entrant stars. Keep large post-formed shells outside the shallow-print target; a flat swatch is still useful. The ideal expansion limit is not a TPU stretch rating, and a connected polygon lattice is mechanically different from a line-only triangular grid.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3, 7–9).** Hinges fracture before the ideal 2× opening, so usable bounds are found experimentally for each material, sheet thickness and incision depth. The plastics tested sprang back elastically, while metals held their deformed shape plastically. The open and closed states of one linkage gave **mechanical dimming** in a lamp shade, and the authors suggest the openings could also meter liquid or granular flow. Leather and copper prototypes were joined with pins, and the pattern ran continuously across the seams.

**Pattern implications.** (1) The fully open linkage *is* the kagome lattice already listed among FilaFabric's Crosshatch & Isogrid options. A **rotating-triangle sheet printed part-open**, with outlined or solid triangles linked only at vertex necks, is the auxetic counterpart of that kagome net, and the pair is a clear comparison. (2) Because boundary vertices add freedom, finish the edge with a deliberate border band or anchor ties, or the edge cells will flop. (3) Treat the opening fraction as a user control, since it changes porosity and light transmission as well as stretch.

---

## Paper 35: Kuijpers-Nachtigall-2026 — Textile Digital Drape Definition TD3 Comparing Digital to Physical Design Considerations
**File Name:** `Kuijpers-Nachtigall-2026_Textile-Digital-Drape-Definition-TD3-Comparing-Digital-to-Physical-Design-Considerations.pdf`

### 1. Summary & Core Focus
Kuijpers, Nachtigall, and van Bommel introduce Textile Digital Drape Definition (TD3), a screen-based textile representation intended to connect measurable physical drape with fashion-design decisions. In a three-hour workshop, 24 experienced digital-fashion-design students evaluated eleven physical textiles and their TD3 representations; a twelve-entry table also includes one practice example, first digitally and then by handling 30 × 30 cm swatches. TD3 encoded drape shape/coefficient alongside weight and texture; the study compared participants’ descriptions, attribute judgements, and design considerations across both phases. The work explores where digital drape helps and where tactile interaction remains necessary. It is a workshop study, not a predictive simulation benchmark or validation of FilaFabric's preview; conclusions apply to the selected textiles and participant group.

### 2. Mathematical & Structural Formulations
TD3 represents digital textile behavior through measurable/observable attributes including drape shape, drape coefficient, weight, and texture. The workshop compares digital and physical evaluations; it does not formulate a mechanics model or compute FDM toolpaths.

### 3. Relevance & Design Takeaways for FilaFabric
This is **highly relevant to FilaFabric's preview and communication claims**, though it concerns conventional fabric simulation rather than printed nets. It supports linking visual drape representations to measurable properties and clearly communicating what previews can and cannot convey. A FilaFabric validation study could compare generated swatches using measured mass, dimensions, and standardized drape tests. This paper does not validate the website's current physical simulation or establish that a rendered preview predicts Filaflex Foamy print behavior.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5–8, methods; pp. 12, 16–19, results/discussion. **Class/status:** measurement/communication transfer across S/M/N; no printed-pattern experiment.

**Paper facts.** Twenty-four experienced fashion-design students compared digital representations with physical textile handling. The workshop evaluates eleven textiles; the twelve-entry table includes B3 as a practice example. TD3 combines measured drape coefficient, areal weight, drape views, and texture imagery. Physical specimens were 30 cm circles; digital CLO templates used an 18 cm support, while handled swatches were 30 × 30 cm. Tactile inspection refined or corrected judgments, especially stretch, flexibility, and transparency. Omitted composition metadata also affected decisions.

**Proposed translation.** Give each printable-pattern preset a real-scale flat view, thickness/crossing view, measured mass, and a photographed drape sample with conditions. Provide controls for scale and comparison orientation rather than inventing a comfort slider. Distinguish measured drape from illustrative animation. The master's “12 textiles” needs the practice/evaluated distinction; neither the workshop nor CLO measurements validate FilaFabric's simulator.

### 5. Second full-text pass — 24 October 2026

**Reference drape values for conventional fabrics** (Table 1, PDF p. 6). Face drape coefficient from an upgraded Cusick meter: 30 cm specimen on an 18 cm support, 18 measurements, face mean of 9. Lower = drapes more.

| Fabric | g/m² | DC % |
|---|---|---|
| Silk organza | 21 | 92 |
| Silk pongé | 36 | 54 |
| Cotton satin | 112 | 69 |
| Organic poplin | 120 | 68 |
| Oxford cotton (practice) | 126 | 60 |
| Knit winter sweat | 295 | 64 |
| Inlay knit | 280 | 59 |
| Thin loose knit | 257 | 14 |
| Felted wool | 279 | 75 |
| Wool blend | 198 | 51 |
| Heavy twill | 381 | 95 |
| Raw denim | 470 | 83 |

**Method details (pp. 7–13).** CLO properties came from the CLO kit, with three strips each in warp, weft and bias for bending, shear and elongation (bending measured face-up). The digital template mirrors the Cusick geometry (30 cm pattern stitched to an 18 cm disc, 5 mm particle distance). The digital view was generally rated *stiffer* than handling. Touch was needed to judge transparency, flexibility and stretch. Agreement between digital and tactile judgements rose with DC: stiff fabrics were read consistently, limp ones less so. Withholding names and composition made identification harder.

**Pattern implications.** Drape coefficients are only comparable at the same specimen-to-support ratio: 30/18 cm here, against Kalman's 10 cm discs (29) and Kabir's 200 mm on an 81 mm stand (24). To place FilaFabric swatches against the table above, test with the Cusick 30/18 cm geometry or state the ratio prominently. FilaFabric's printed nets, with their low mass and open area, may sit near the thin, loose knit (14%) or near the organza (92%) depending on topology; only measurement will tell. Any FilaFabric preview should also carry material, mass and construction metadata, as participants asked for here.

---

## Paper 36: Laput-2015 — 3D Printed Hair Soft Strands Fibers and Bristles
**File Name:** `Laput-2015_3D-Printed-Hair-Soft-Strands-Fibers-and-Bristles.pdf`

### 1. Summary & Core Focus
Laput, Chen, and Harrison exploit FDM stringing to draw hair-, fibre-, or bristle-like strands from small extrusion deposits by moving the nozzle away from the extrusion point. Their G-code workflow exposes strand length, thickness, density, distribution, and flow direction. In tests on a commodity Printrbot using PLA, too little extrusion or excessive draw speed caused early breakage; too much material clogged the origin, while slow drawing caused droop. Strand spacing was limited by the hot nozzle's risk of damaging neighboring strands (about 0.2 mm minimum on their setup); staggered extrusion points across Z layers increased density. Pulling, retraction, or scraping can terminate strands, and post-processing (cutting, heating, braiding) changes their stiffness and appearance.

The method intentionally uses uncontrolled-looking stringing as a fabrication mechanism. It is best for hair/fibres attached to a 3D object, not a uniform textile sheet: strand diameter varies along its length, density is constrained by nozzle clearance, and dense patches are slow. Curved 3D strand routes introduce collision risks. Their PLA/printer-specific process settings are not validated for flexible TPU or FilaFabric's Foamy profile.

### 2. Mathematical & Structural Formulations
No model. The method is a pair of G-code primitives: extrude E at feed F, then a fast draw move. Its parameters are extrusion amount, extrusion feed, draw distance, draw speed, root spacing and termination method (pulling or go-around, retraction, scraping).

### 3. Relevance & Design Takeaways for FilaFabric
This is a **related toolpath-generation precedent** for any future fringe, fibre, or pile feature in FilaFabric. It shows how strand parameters can be encoded directly in G-code and why extrusion amount, draw speed, endpoint handling, layer staggering, and nozzle clearance need explicit control. The method's intentional stringing and variable strand gauge differ from FilaFabric's continuous, uniform textile paths; it does not substantiate ordinary pattern printability or Foamy calibration.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 2–4, technique/design space; p. 5, limitations. **Class/status:** outside target: intentional stringing and free-ended hairs, although drawn horizontally.

**Paper facts.** A small PLA deposit is stretched by rapid XY nozzle travel into a tapered strand. The authors explicitly print hair parallel to the bed, stagger roots across layers, and terminate strands by pulling, retraction, or scraping. Amount, feed rate, draw speed, length, spacing, and root distribution affect results. Slow drawing can cause droop; fast drawing breaks strands; nearby hot-nozzle passes damage existing hairs. They did not find a collision-free general solution for directly printing complex curly hairs.

**Proposed translation.** Retain lessons about clearance, path simplification, and commanded extrusion versus actual diameter. A bounded S/M fringed motif with supported perimeter-to-perimeter filaments requires new experiments, not adoption of this recipe. Do not add hair, tall pile, bouclé, or bristle presets under the current scope. Its 0.2 mm root spacing and PLA feed values are machine-specific, not Foamy calibration.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–3).**
- **Fibre bridging vs drawn hair:** the authors separate maker-style "fibre bridging" (extruding across a gap between two supports) from their drawn hair. Bridged strands come out fairly rigid and bristle-like, with flat ends where cut. Drawn hair tapers, because the strand thins as material runs out at the nozzle.
- **G-code:** for example `G1 E5 F2000` then a fast move away. The best PLA result was a slow extrusion feed (F500) over a 50 mm draw. Too many interpolated points slow the move and cause discontinuities.
- **Termination:** strands are ended by a "go-around" path (draw, then trace a rectangle back to the start), by retraction while the strand still touches unextruded material, or by scraping the nozzle.

**Pattern implications.** The bridging observation matters for flat nets: FilaFabric's upper-pass strands spanning between crossings are bridges in this sense. Expect them to be straighter and stiffer between contacts than a strand laid on the bed. Hair-drawing itself stays out of scope.

---

## Paper 37: Lee-2023 — Digital Waves
**File Name:** `Lee-2023_Digital-Waves.pdf`

### 1. Summary & Core Focus
Lee, Li, and Yoo (2023) present “Digital Waves,” a research-through-design dress integrating flexible FDM-printed TPU auxetic panels with digitally printed traditional fabric. The team iterated auxetic structures and materials, simulated a size-8 garment in CLO 3D, transferred pattern contours to Rhino, and segmented the printed portion into 26 panels with continuous ripple motifs. They tested adhesive/sewing approaches for assembly and used a wave-inspired digital surface print on conventional fabric; accessible LEGO-like printed buttons served as closures. This is a garment-design case study, not a mechanical or wear-comfort experiment: it gives no standardized stretch, drape, durability, or wearer data, and segmentation/assembly are integral. It is a precedent for combining printed zones with conventional fabric, but does not validate FilaFabric pattern behavior or printer profiles.

### 2. Mathematical & Structural Formulations
No formulation. The structural motif is described only as a "ripple auxetic structure", multiple curved lines emanating from central points (Fig. 1). Its auxetic behaviour is asserted, not measured.

### 3. Relevance & Design Takeaways for FilaFabric
A practical precedent for a ripple-lace panel family and for joining printed panels to woven fabric: seam allowances, interfacing, colour assigned per panel and an overlay layer. It does not validate FilaFabric's geometries, printer settings or material performance.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 1–3, Aesthetics and Process, technique, and execution; Figs. 1–3. **Class/status:** planar lace panels and M-style lace/backing assembly; direct design precedent, layer count unspecified.

**Paper facts.** Digital Waves combines TPU ripple-pattern nets with sublimation-printed polyester mesh. CLO garment contours were transferred to Rhino and divided into 26 printed panels. The bottom places a longer printed lace layer over a conventional skirt. Panels were adhesively assembled, then joined to fabric by machine/hand sewing; the paper reports 40 printing hours, eight trimming/assembly hours, and seven sewing hours. Its ripple motifs use curved lines radiating from centers. Stretch and comfort claims are design interpretations, without standardized mechanical or wearer tests.

**Proposed translation.** Add connected ripple lace with center spacing, arc spacing, connector width, edge reinforcement, and optional separate backing. Distinguish a physical overlay from fused printed layers. Treat panel boundaries and joining allowances as design inputs. The master misses this concrete ripple/overlay pattern opportunity, although it correctly avoids claiming measured comfort.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 1–3).**
- Each of the 26 panels was printed in a single TPU colour (white, yellow or blue), so the multicolour effect comes from assembling differently coloured panels, not multi-material printing.
- Panels were joined with the adhesive method of Lee & Li (38).
- Seam allowances: **0.25 in where seams were strongly curved, 0.5 in where curvature was low**. Interfacing went under the printed fabric at wavy necklines, hems and armholes.
- The polyester mesh was sublimation-printed at 400 °F.
- Closures were printed LEGO-style buttons.

**Pattern implications.** For any FilaFabric panel meant to be sewn: (1) a printed seam allowance whose width follows edge curvature (narrower on tight curves); (2) colour planned per panel when only one filament is loaded. Both are workflow details, not new net geometry.

---

## Paper 38: Lee-Li-2022 — Consonance of 3D Printed Fiber Network
**File Name:** `Lee-Li-2022_Consonance-of-3D-Printed-Fiber-Network.pdf`

### 1. Summary & Core Focus
Lee and Li present a research-through-design case study of a lace-like fiber network used in a high-waisted skirt and sleeveless vest. They develop lotus- and water-lily-inspired motifs in Rhino, simulate garment patterns in CLO, and segment them into printable panels. The vest used 24 panels and the skirt 140; all 164 panels were FDM-printed in black TPU and joined with permanent liquid fabric adhesive. The skirt also used a hand-sewn silk waistband. Printing took 159.5 hours, with another 15 hours for trimming and assembly; reported mass was 55 g for the vest and 349 g for the skirt.

The paper demonstrates a design-to-wearable workflow and argues that the curved lace network and flexible TPU permit stretch and drape. It reports no standardized drape, tensile, fatigue, wash, or wearer-comfort testing. The garment was not one continuous print: segmentation, adhesive joining, trimming, and sewing were required. “Seamless” therefore describes the intended visual/assembly result, not an uninterrupted print. Comfort is design rationale rather than a measured outcome.

### 2. Mathematical & Structural Formulations
No formulation. The motifs are connected, symmetric radial petal arrangements (lotus, water lily) extruded 0.4 mm and placed inside panels segmented from CLO garment patterns.

### 3. Relevance & Design Takeaways for FilaFabric
This is a useful **product and garment-integration precedent** for FilaFabric's pattern-to-panel workflow, including motif scaling, 3D preview, and segmentation/join planning. It demonstrates the production burden of large wearable prints—panel count, print time, trimming, adhesive, and textile interfaces—that a swatch tool can help users anticipate. It does not validate any FilaFabric preset's drape, comfort, durability, or print time; those require testing with the actual machine and material.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 1–3, Aesthetic properties, Process, and Contribution; Figs. 1–3. **Class/status:** planar thin lace, transferable S/M; assembled garment layers are not a fused multilayer print.

**Paper facts.** Lotus and water-lily motifs form connected curved networks. Vest motifs were extruded 0.4 mm, and two vest layers were segmented into 24 panels; the skirt used 140 panels and two lengths of lace. All 164 TPU FDM panels were joined with permanent liquid fabric adhesive; the skirt received a sewn silk waistband. Reported production was 159.5 printing hours and 15 finishing/assembly hours. Neither low mass nor the photographed drape establishes comfort relative to a controlled textile sample.

**Proposed translation.** Add radial petal lace with petal count, curvature, repeat scale, minimum connector width, and a continuous boundary band. Explore two offset flat motifs as a deliberately fused pseudo-lace variant, recording which crossings connect. That variant is proposed, not demonstrated here. Preserve the distinction between visual seamlessness, adhesive panel seams, and continuous printer deposition.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 1–3).**
- **Print time:** 17.5 h for the 24 vest panels (about 0.7 h each) and 142 h for the 140 skirt panels (about 1.0 h each), with 15 h of trimming and assembly.
- **Design time:** 11 weeks in total, four of them spent testing the lace structures.
- **Lace motifs:** "all of the petals are connected and arranged symmetrically" (Fig. 1), so connectivity was a stated design rule. Vest motifs were 0.4 mm extrusions.
- **Closures and joins:** the vest closes with printed snap buttons; the two skirt layers of different lengths are gathered onto a natural-dyed silk waistband that also adjusts the fit.
- The authors cite their own *Bouncing with 3D printed soft cells* (ITAA 2022), not held locally, as a related structure study.

**Pattern implications.** About one hour per panel is a realistic planning figure for garment-scale lace on a desktop FDM printer. FilaFabric could estimate and report panel print time per preset before export. The explicit "every petal connected" rule supports the S1 gate in the catalogue.

---

## Paper 39: Lin-McLean-2026 — LOOMING between shaft looms and a TC2 Jacquard Loom A Serendipitous Expedition with Live Weaving
**File Name:** `Lin-McLean-2026_LOOMING-between-shaft-looms-and-a-TC2-Jacquard-Loom-A-Serendipitous-Expedition-with-Live-Weaving.pdf`

### 1. Summary & Core Focus
Lin et al. describe LOOMING, a customized control interface for a TC2 digital Jacquard loom that brings shaft-loom draft logic into live, interactive weaving. The authors listened to the loom and mapped its real-time response, then designed the interface to let two experienced weavers manipulate lift patterns while weaving. This is exploratory design research rather than a controlled usability evaluation. LOOMING addresses 1,320 binary warp controls (2^1320 possible selections), not 1,320 total combinations or FDM. For FilaFabric it is an interface precedent for making edits responsive and legible, but it does not validate printer motion, weaving algorithms, or G-code correctness.

### 2. Mathematical & Structural Formulations
The paper maps interactive interface actions to TC2 warp-lift selections and shaft-loom draft logic. Its central issue is real-time control and legibility in a loom, not a geometric or mechanical model for printed paths.

### 3. Relevance & Design Takeaways for FilaFabric
This is **indirect interface-design context** for FilaFabric. It suggests value in previewing and explaining how parameter edits alter machine actions, and supporting exploratory workflows. It is not evidence for FilaFabric's weave preview, crossing report, or exported G-code.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5–7, design rationale and §6; pp. 12–13, discoveries/discussion. **Class/status:** interface transfer for S/M pseudo-weaves; no FDM experiment.

**Paper facts.** LOOMING maps shaft-loom threading, tie-up, and treadling into live TC2 Jacquard control. The loom has 1,320 individually controlled warps, hence 2^1320 binary lift combinations, not merely 1,320 pattern possibilities. Repetition fills 1,200 central warps with 60-end selvedges each side. Two authors explored changes while weaving, finding that meaningful draft edits redirected attention to bindings and material behavior. They explicitly caution that a drawdown does not fully predict three-dimensional cloth behavior.

**Proposed translation.** Offer block, twill, repeat, phase-shift, and border controls linked to a crossing/layer diagram and the exported deposition order. For fused M pseudo-weaves, name crossings as bonded rather than implying over/under sliding yarn. The source supports legible parameter relationships and material feedback, not a correct G-code generator or mechanical simulator. Correct the master's description of the combinatorial space.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 5–12).**
- **What was rejected:** pixel-by-pixel editing (one click per pixel, too slow) and algorithmic generative patterns (non-coders must mentally "compile" them, and the result treats the cloth as a two-colour display).
- **The shaft-loom draft adopted instead:** threading (each row is a shaft), tie-up (each column is a treadle) and treadling (each row is a pick) together generate the drawdown. In standard notation, warp $w$ is up on pick $p$ if some shaft $s$ carrying $w$ is tied to a treadle pressed on $p$.
- **Interface:** warps, shafts, treadles and picks are all adjustable. The pattern repeats automatically to fill 1,200 warps, with 60-end selvedges, and is sent row by row.
- **Weaver sessions:** the weavers explored "block" designs, then *drifting blocks* by changing the threading mid-weave (practically impossible on a real shaft loom), single-point tie-up changes, and scaling a design from 8 to 24 shafts.
- **Effect:** small edits produced rhythmic, generative changes, which moved attention from imagery to bindings.

**Pattern implications.** A concrete generator for FilaFabric's Weave card. Express bindings as a small **threading × tie-up × treadling** triple instead of a raw matrix. Four shafts and four treadles already give plain, 2/2 and 3/1 twill, point (herringbone/diamond) and block drafts. Short threading sequences such as point or straight draws then produce whole families. Drifting the threading across the width gives graded or travelling motifs. This adds a parameterization, not new mechanics: the printed result is still a fused level-sorted pseudo-weave.

---

## Paper 40: Lloyd-Taylor-2026 — Developing an Industrial Microbial Colour System through Textile Printing
**File Name:** `Lloyd-Taylor-2026_Developing-an-Industrial-Microbial-Colour-System-through-Textile-Printing.pdf`

### 1. Summary & Core Focus
Lloyd et al. present the Colorifix Microbial Colour System (CMCS), an information architecture linking microbial colour selection to validated textile application and production data. Using two validated microbial colourants on a selected 100% polyester substrate, the practice-led research organizes measured CIE L*a*b* colour, perceptual references, substrate compatibility, and application instructions into design-facing and production-facing documentation. Lab-scale magnetic flatbed screen printing generated the empirical data; proprietary formulations and detailed process parameters are outside the paper’s scope. The contribution is a specification system, not new colourant chemistry or a universal colour model. Results are specific to the selected dyes, polyester, and validation conditions, and do not establish colour behavior on FilaFabric's printed polymers.

### 2. Mathematical & Structural Formulations
No physical model. Colour is specified by measured CIE L\*a\*b\* on physical reference swatches. Mixtures are defined by gravimetric paste ratios (Blue : Pink = 1:0, 9:1, 8:1, 3:1, 1:1, 1:3, 0:1) between calibrated pale, mid and dark anchor shades. There is no additive RGB rule.

### 3. Relevance & Design Takeaways for FilaFabric
The validation structure transfers to two-filament tone calibration: screening, then calibration, then inclusion only when reproducible, with each validated recipe tied to a code and a physical swatch. It does not validate FilaFabric's geometries, settings or colour behaviour in translucent printed layers.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 6–10, §§3–4.1; pp. 11–14, architecture; p. 18, limitations. **Class/status:** documentation transfer for S/M/N, no geometric extrusion method.

**Paper facts.** Colorifix's prototype links design-facing colour navigation, physical polyester reference swatches, measured CIE L*a*b* data, and production documentation through shared codes. Ninety-one experiments inform the work. Blue and Pink colourants passed the selected workflow; Yellow did not and was excluded. Substrate, formulation, pH, and fixation remain essential. A complete searchable digital system is proposed, not delivered; proprietary organism/formulation details are withheld. Mixtures use calibrated paste mass ratios, not a universal linear RGB rule.

**Proposed translation.** Give each printed-pattern swatch a persistent recipe code linking the visible S/M/N design to machine, material, layer order, measured dimensions, and pass/fail results. A halftone or two-colour flat-layer comparison can reuse that evidence structure, but its geometry and colour behavior need separate experiments. This paper cannot substantiate microbial colouring of TPU or predict colour mixing in translucent printed layers.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 6–10).** "Experiment" means a planned study, not a single swatch, which is how the 91 experiments are counted. The process: lab-scale magnetic flatbed screen printing, dry-curing at 185 °C for 8–10 min, a pH 3–11 sweep with pH 7 adopted as standard. Inclusion in the system is conditional; visually attractive but non-reproducible results are kept out.

**Pattern implications.** For Halftone Net calibration, borrow the anchor-and-interval idea: print a stepped wedge at fixed width ratios between the two filaments (for example 1:0, 9:1, 3:1, 1:1, 1:3, 0:1), measure each step's L\*a\*b\* or photograph it under recorded light, and interpolate only between measured anchors. Admit a filament pair to the palette only after the wedge reprints consistently.

---

## Paper 41: Loh-Pei-Undated — Design for Material Extrusion on Mesh Fabrics
**File Name:** `Loh-Pei-Undated_Design-for-Material-Extrusion-on-Mesh-Fabrics.pdf`

### 1. Summary & Core Focus
Loh and Pei present a pilot design-and-process study of directly printing off-the-shelf PLA onto three mesh fabrics on a Prusa i3 MK3 with a 0.4 mm nozzle. The fabrics differ in fiber, construction, thickness, pore size, and stretch: nylon net, fine polyester voile, and stretch polyester power mesh. The authors compare direct printing onto fabric with an embedded/laminated construction in which the printer lays initial polymer layers, pauses for fabric placement, and resumes so later molten layers pass through the mesh and bond to the base polymer. This second construction was substantially more stable in their trials; the direct-on-fabric samples could be peeled away with little force, while the laminated samples were taken forward to T-peel testing.

The study emphasizes careful bed setup and Z-distance rather than assuming nominal fabric thickness can simply be added to the printer offset. On their setup, small gap changes (about 0.005 mm) moved samples from dragging/poor first-layer fill toward better contact without catching the fabric or clogging the nozzle. Increasing nozzle temperature by 5–20 °C above the filament recommendation improved bonding; changing speed and flow produced no substantial adhesion difference in their tests, so they retained roughly 20–22.5 mm/s and 100% flow. Their laminated T-peel specimens reported average delamination loads of about 34.35 N for coarse nylon net, 25.58 N for fine polyester voile, and 20.49 N for stretch polyester mesh. The authors associate larger mesh openings with improved polymer penetration and mechanical interlocking, but note substrate stretch had no direct adhesion effect; lower-stretch fabric was easier to keep flat and print consistently.

This is a pilot study with three mesh types, PLA, small sample counts, and one printer/surface; it does not establish generalized optimal offsets or adhesion settings. The paper recommends further microscopy and wash-cycle evaluation. Its results are setup guidance and an example of laminate-style print sequencing, not validated garment-durability data.

### 2. Mathematical & Structural Formulations
No model. Settings are slicer offsets (Prusa Live-Z) and T-peel average delamination load (ASTM D1876, DIN 53530). The 0.005 mm Live-Z steps are relative to one calibrated machine, not absolute nozzle-to-fabric gaps.

### 3. Relevance & Design Takeaways for FilaFabric
This is **directly relevant to any future FilaFabric print-on-textile mode and its first-layer/material setup**, not to free-standing swatch generation alone. It suggests treating direct-on-fabric printing and embedding fabric between printed polymer layers as distinct workflows; the latter performed better in this pilot. It supports explicit consideration of fabric thickness, pore size, stretch, attachment/clipping, and Z-offset, plus a small calibration print before a full panel. The measured PLA results do not validate FilaFabric's current Filaflex Foamy settings or prove wash durability; the paper itself identifies durability testing as future work.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 2–6, methodology/Tables 2–8; pp. 7–10, peel results/conclusion. **Class/status:** M hybrid polymer–cloth–polymer laminate; direct sequencing precedent.

**Paper facts.** PLA was printed directly onto three meshes or deposited beneath and above an inserted mesh after a pause. Direct-on-cloth specimens peeled too readily; laminated specimens continued to T-peel testing. Five-layer specimens were nominally 0.5 mm thick. The meshes differ in composition, pore size, construction, and stretch. Average delamination loads were 34.35, 25.58, and 20.49 N, but some polymer layers fractured shortly after peeling began. Small Live-Z changes are setup-specific offsets, not absolute nozzle-to-fabric gaps.

**Proposed translation.** Explore a sparse planar backing, inserted mesh, and upper lace/reinforcement, with independently controlled base coverage, top coverage, registration, and pause point. Test bond quality and retained flexibility before a large panel. For all-printed M lace/backing, this is an analogy in layer sequencing, not matching adhesion evidence. The pilot does not prove washing durability or justify copying its numerical Live-Z values.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–6). Same machine family as FilaFabric's reference printer.**
- **Printer and profile:** original Prusa i3 MK3, smooth double-sided PEI sheet, PrusaSlicer "0.10 mm DETAIL MK3". First layer 0.2 mm, then 0.1 mm layers; extrusion width 0.42 mm (first layer) and 0.45 mm; 215 °C / 60 °C; first layer at 20 mm/s; 100% rectilinear fill at 45°.
- **Fabrics:** F1 nylon tulle (knitted, 0.25 mm), F2 polyester voile (woven, 0.13 mm), F3 polyester power mesh (knitted, 0.18 mm). Each was cut to the bed size, 25 × 23 cm, and clipped flat on all edges with the clips kept out of the nozzle path.
- **Live-Z:** only a **+0.005 mm** step was needed with fabric (−0.820/−0.825 mm against −0.815 mm for direct printing), despite fabric thicknesses of 0.13–0.25 mm. Adding the measured fabric thickness was unnecessary for thin meshes. Raising Live-Z to −0.565 or −0.608 mm gave dragging, blobs and sparse first layers.
- **Unbonded zones:** about 20 mm of blue painter's tape placed on the polymer base before laying the fabric left an unbonded tab for the T-peel grip. Tape on the polymer worked; tape on the fabric did not.
- Flow above 100% did not increase penetration, consistent with Spahiu (2017).

**Pattern implications.** (1) A FilaFabric fabric-insert mode on MK3-family machines would need only a tiny Live-Z change for thin meshes. Expose it as a small offset from the calibrated value, not a thickness-derived number. (2) A **local release mask** (tape, or a deliberately unbonded or non-overlapping region) placed between passes is a way to make pockets, flaps or grip tabs in an otherwise fused M stack. In all-printed sheets the equivalent is a planned gap or a non-bonding interlayer.

---

## Paper 42: Malomo-2018 — FlexMaps Flat Flexible Shells
**File Name:** `Malomo-2018_FlexMaps-Flat-Flexible-Shells.pdf`

### 1. Summary & Core Focus
Malomo et al. present FlexMaps, a computational pipeline that approximates smooth 3D shapes using a small set of flat flexible panels with locally tuned elastic spiral microstructures. The target surface is decomposed into quad patches and mapped to a 2D domain; a precomputed database and nonlinear finite-element simulations support optimization of spiral geometry so assembled panels settle toward the target shape. Panels are laser-cut or 3D-printed from nearly rigid material and joined with custom connectors. Physical examples demonstrate the method; failures include oversmoothed sharp/high-frequency details and optimization getting stuck in symmetric configurations. This is a panel-and-connector shell fabrication method, not a continuous FDM textile path. Its relevance is computational surface mapping and mechanically informed fabrication, not direct FilaFabric preset validation.

### 2. Mathematical & Structural Formulations
**Spiral cell** (PDF p. 6, §5). Four Archimedean arms share an origin. One arm, for arc parameter $t \in [0,1]$, is $x(t) = r(t)\cos(t\varphi)$, $y(t) = r(t)\sin(t\varphi)$ with $r(t) = 0.5\,s\,(1 - t)$; the other three are copies rotated 90°, 180° and 270°. The descriptors are scale $s$ (circumscribed diameter, set by the local quad), twist $\varphi$ (winding; $\varphi = 0$ is the base cross) and rectangular arm width $w$, with fixed height $h$. Neighbouring cells join at the midpoints of shared quad edges. A reduced rod-coupling model, fitted to FEM through a radial-basis-function map from $(s, w, \varphi)$, drives the shape optimization. Planar "no-sag" springs were tried first and rejected because they used the quad poorly and limited the deformation range.

### 3. Relevance & Design Takeaways for FilaFabric
The spiral formula is directly implementable as a FilaFabric cellular sheet (candidate S5), with twist and width as the two user controls and scale tied to pitch. The mechanics database belongs to 2 mm Vero/Delrin panels and does not transfer to TPU. The paper does not validate FilaFabric's geometries, printer settings or material performance.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 5–8, §§5–6; pp. 10–12, fabrication/validation/limitations. **Class/status:** flat connected S/M topology; original 2 mm PolyJet/laser-cut sheets, not FDM calibration.

**Paper facts.** Each quadrilateral cell contains four Archimedean spiral arms joined to neighboring cells at shared-edge midpoints. Cell scale, winding angle, and rectangular arm width vary; thickness is fixed. FEM-derived reduced models support optimization so joined flat panels settle into target curved shells. Examples use Vero-family PolyJet or laser-cut Delrin, with dovetail panel connectors. Their fabrication required cells at least about 1 cm across. High-frequency curvature, multistability, and stressed connectors limit outcomes.

**Proposed translation.** Add a four-arm spiral sheet family with cell pitch, winding, arm width, and boundary connections; test width/winding gradients in a flat swatch. This supplies a concrete pattern beyond generic surface-mapping context. An S realization needs line-width/connectivity checks; M can preserve wider rectangular arms. The source validates neither a one-bead TPU version nor automatic shallow N shaping, and its mechanics database cannot be reused for Foamy.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 6–12).**
- **The material barely strains:** on a deformed spiral, 99% of FEM elements stayed within ±0.5% volumetric strain. Large sheet deformation comes from arm bending and twisting, not material stretch. That is why a nearly rigid material works, and why the geometry may also suit a soft one.
- **Assembly:** panels 2 mm thick, joined by printed dovetail connectors with colour-coded seams and a grip tolerance. The largest object was 40 cm tall.
- **Accuracy:** a scanned architectural shell matched simulation to 0.008–4.092% of model size (RMS 0.971%). Quad distortion had small local effects.
- **Limit:** cells need to be at least about 1 cm across for robustness and tolerances.

**Pattern implications.** Implement the spiral cell exactly as in section 2, as a flat lace whose softness is set by twist $\varphi$ and arm width $w$ at constant pitch. Keep cells at least about 10 mm across at first, as the paper's size floor suggests, and check the gap between neighbouring windings against bead width. Graded twist or width across a panel gives regional stiffness without changing the pitch. Colour-coded edge connectors are a usable joining convention for multi-panel FilaFabric garments.

---

## Paper 43: Manaia-2023 — 3D and 4D Textiles Review_FashionTextiles
**File Name:** `Manaia-2023_3D-and-4D-Textiles-Review_FashionTextiles.pdf`

### 1. Summary & Core Focus
Manaia, Cerejo, and Duarte provide an integrative review of 3D- and 4D-printed textiles, organizing work across additive processes including FDM, direct ink writing, material jetting, and laser-based methods. The review covers printing onto textiles, making textile-like structures, functional filaments, footwear, and stimuli-responsive systems, and discusses customization/local production alongside limitations in material selection, adhesion, textile-like mechanical behavior, and scalability. It is a secondary review rather than a systematic review with a reproducible search protocol or a new experimental dataset. Its breadth is useful for locating themes and primary sources, but claims about measured performance should be checked against the cited experiments; it does not establish FilaFabric-specific capability or settings.

### 2. Mathematical & Structural Formulations
The article classifies 3D/4D textile approaches by manufacturing process, material, and application; it does not derive a governing equation for FDM strand width or under-extrusion.

### 3. Relevance & Design Takeaways for FilaFabric
This is **broad background and a source-finding guide** for FilaFabric's textile-generation domain. It supports distinguishing print-on-fabric from free-standing textile structures and separating 4D stimuli response from static geometry. It does not validate strand-width calibration or Filaflex Foamy extrusion settings; consult primary sources for quantitative claims.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 7–10, printing on/of textiles; pp. 14–16, 4D/hybrid systems; p. 21, conclusions. **Class/status:** secondary source; mixed S/M/N leads and excluded process families.

**Paper facts.** This broad review separates functional filaments, polymer-on-fabric composites, standalone textiles, and stimuli-responsive constructions. Its practical variables include fabric construction, printed coverage, material pair, nozzle gap, deposition conditions, and bonding. Planar arrowhead/auxetic nets and flexible mesostructures are relevant precedents. The same review includes upright DefeXtiles, pillar/stringing weaving, independent SLS links, bristles, and bulk footwear; they do not become flat-sheet evidence merely by appearing under textiles. Pre-stretch-release shaping is another distinct route.

**Proposed translation.** Use the review as an index for a flat arrowhead net, density-gradient mesh, or shallow patterned layer on backing, then follow the primary papers. Record process and scale beside every pattern example. Do not import product marketing claims or 4D actuation into static printed swatches. No general strand-width, foaming, under-extrusion, or drape prediction equation is established here.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 7–13).**
- **Polymaker + Covestro** (cited): a flexible-material printer, TPU materials and design software whose named pattern operations are *geometric patterns, **moiré patterns**, density gradients, shape changes and organic textures*. That is a useful industry checklist of pattern operations.
- **Spahiu et al. 2020:** explored soft PLA, nylon and TPU (Filaflex and NinjaFlex), and selected both the arrowhead-shaped structure and Filaflex. Jayswal-Adanur (23) gives the arrowhead's size and Shore hardness; Brad (5) cites the same dress without naming the shape.
- **Korger et al. 2020:** TPU on knits and wovens adhered better and survived abrasion and washing better than styrenic TPE, which the review attributes to TPU's polar interactions.
- **Other cited products:** Koerner's SETAE jacket maps image colour pixels to bristle patterns; GRDXKN prints polyurethane that foams up on a fabric base; Modeclix links are interchangeable, so a garment can be resized and repaired; Nervous System's Kinematics process runs scan → sketch → tessellate → generate hinges → simulate drape → compress for printing.

**Pattern implications.** *Moiré* is a missing M-class motif. Two path families with slightly different pitch or angle (for example 2.0 and 2.1 mm, or 0° and 3°) produce large-scale interference bands with no extra material. FilaFabric's two-family nets (Squiggle, Crosshatch, Halftone) can make it simply by offsetting one family's pitch or angle. Its fused crossings then vary periodically, so check that crossing density stays adequate at the band minima. Density gradients are already covered by M5. The rest are product references outside the bed-flat brief.

---

## Paper 44: Martinez-2016 — Procedural Voronoi Foams for Additive Manufacturing
**File Name:** `Martinez-2016_Procedural-Voronoi-Foams-for-Additive-Manufacturing.pdf`

### 1. Summary & Core Focus
Martínez, Dumas, and Lefebvre introduce procedurally generated open-cell Voronoi foams whose local geometry is controlled to approximate specified elastic behavior. An implicit stochastic construction enables spatially graded elasticity without explicitly storing a full high-resolution lattice or running global topology optimization for every design. The authors demonstrate graded rigid-to-flexible regions in 3D-printed objects and compare predictions to physical behavior; example beam thicknesses are approximately 0.2–0.4 mm. The method targets volumetric foam interiors and surface crusts, not thin textile sheets. Its material-response controls are simulation-based and depend on their cell model and fabrication process, so the paper does not validate FilaFabric's Voronoi or lattice presets.

### 2. Mathematical & Structural Formulations
Procedural open-cell foam $F_{
ho,	au}$: beams of radius $	au$ along the Voronoi edges of seeds with density $
ho(x)$, generated per virtual grid cell with deterministic pseudo-random seeding (Algorithm 3). The fit is $E_f/E_s = 1.2\,\omega^{1.81}$ for $0.04 < \omega < 0.5$, with Poisson's ratio near the base material's (0.27). Details in §5.

### 3. Relevance & Design Takeaways for FilaFabric
This is **computational-design background** for spatially varying lattice response, not direct FilaFabric validation. It shows a procedural route from a target elasticity field to manufacturable Voronoi microstructure, but FilaFabric's 2D textile paths and flexible filament need separate mechanical mapping and tests. Do not infer stiffness values from this volumetric foam model.

### 4. Flat-sheet source review — 23 October 2026

**Evidence:** PDF pp. 3–7, §§3–4; pp. 8–10, experiments/limitations. **Class/status:** outside target: volumetric SLA foam; procedural method transferable to S/M only.

**Paper facts.** Stochastic 3D Voronoi-edge beams are evaluated implicitly at slicing time. Seed density and beam radius control a homogenized, approximately isotropic elastic response; a fitted polynomial links those variables to Young's modulus. Physical compression samples use SLA resins, with curing variability and about 25% relative deviation reported in one comparison. Target properties require sufficient bulk volume. Poisson's ratio remains near the base-material value; it is not freely prescribed. Local stress concentrations can break beams under large deformation.

**Proposed translation.** Develop a two-dimensional Voronoi sheet controlling seed spacing, randomness, strand width, and regional density. Rebuild connectivity and boundaries in the plane rather than slicing the volumetric network and accepting disconnected fragments. Measure that sheet independently: the source's 3D polynomial is not a planar stiffness formula. Its tabulated beam thicknesses and radius discussion must not be conflated with FDM extrusion width.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–8).**
- **Deterministic seeding:** seeds come from a virtual grid. Each cell's pseudo-random generator is seeded by its grid coordinates, so any region regenerates identically from a few hundred bytes. Where the local target count $t = l^3\rho$ exceeds $2^3$, the cell subdivides recursively; otherwise $\lfloor t\rfloor$ distinct children receive one seed each, plus one more with probability equal to the fractional remainder (Algorithm 3). Density $\rho(x)$ must vary smoothly relative to cell size.
- **Parameter choice:** many $(\rho, \tau)$ pairs give the same modulus. The authors **fix the beam radius at the printable minimum** ($\tau_{min}$ 0.2–0.3 mm) and vary only seed density, staying as dense as possible. Convex Voronoi cells guarantee connectivity except at the boundary.
- **Fitted response:** $E_f/E_s = C\,\omega^n$ with $C = 1.2$, $n = 1.81$ for relative volume $0.04 < \omega < 0.5$ (Gibson–Ashby form, 3D foam). Poisson's ratio stays near 0.27, close to the base material. Closed pockets stay negligible below ω = 0.7 and reach at most 4%.

**Pattern implications.** For FilaFabric's Voronoi Lace and any picture-driven cell size: (1) generate seeds **deterministically per grid cell** from a density field, so a design regenerates identically when the swatch is resized, cropped or tiled; (2) to grade stiffness, prefer varying cell density at a fixed, reliably printable strand width over thinning strands; (3) the 3D exponent 1.81 is not a planar law, so measure the 2D sheet. Boundary cells need explicit closure (a border strand) to stay connected.

---

## Paper 45: Martinez-2017 — Orthotropic K Nearest Foams for Additive Manufacturing
**File Name:** `Martinez-2017_Orthotropic-K-Nearest-Foams-for-Additive-Manufacturing.pdf`

### 1. Summary & Core Focus
Martínez, Song, Dumas and Lefebvre develop procedural k-nearest beam networks with orientable orthotropic elasticity. In addition to bulk applications, physical PDF pp. 8–9 fabricate **flat two-dimensional networks extruded to 3.2 mm thickness in SemiFlex by FDM**, using a custom slicer. Directional tests compare these specimens with predictions. This makes the planar construction relevant to class M, while the chair/gear bulk examples remain outside the target. Their thickness, beam model and positive-Poisson design range do not establish a thin textile recipe or properties for FilaFabric Voronoi Lace.

### 2. Mathematical & Structural Formulations
**Graph construction** (PDF pp. 4–5, §4.1).
1. Place one random point per virtual grid cell (a jittered grid approximating Poisson-disc sampling). Density can vary through the subdivision scheme of Paper 44.
2. Connect each point to its $k$ nearest neighbours under a locally stretched metric: $M(p) = E^\top U E$, with $E = R(\Theta(p))$ and $U = \mathrm{diag}(H(p)^{-2})$, where $\Theta$ is the local orientation and $H = (h_u, h_v)$ with $h_u \ge h_v = 1$ is the stretch.
3. The one-sided distance is $d_{p_i}(p_i,p_j) = \sqrt{(p_i-p_j)^\top M(p_i)(p_i-p_j)}$, symmetrized as $d = (d_{p_i}(p_i,p_j) + d_{p_j}(p_j,p_i))/2$.

Longer edges then appear along the stretch direction, and the sheet is stiffer that way. Stretch ratio sets the ratio of the two Young's moduli, node density sets their magnitude, and $k$ shifts stiffness without widening the reachable property space. Poisson's ratio stays positive and rises sharply at high stretch and low density (up to 5.16 in a sample).

### 3. Relevance & Design Takeaways for FilaFabric
Retain the **planar FDM network construction and orientation controls** as relevant precedents for class M, and the procedural representation as a transferable generation method. A thinner sheet requires new connectivity, boundary, printability and mechanical tests; do not transfer bulk performance or coupon constants to FilaFabric presets.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Martinez-2017_Orthotropic-K-Nearest-Foams-for-Additive-Manufacturing.pdf`. **Class/status: M, direct planar-network experiment within a broader foam paper; S translation proposed.** The method connects jittered points to k nearest neighbours under an oriented, stretched distance metric, then thickens graph edges (p. 4, §4.1). Crucially, fabrication is not exclusively volumetric: pp. 8–9, §5.4/Fig. 11 describe 2D graphs extruded to flat 18 × 108 × 3.2 mm SemiFlex specimens, printed with a custom slicer and 0.25 mm nozzle, each beam one extrusion wide. Tensile trends track normalized predictions; compression introduces buckling and conditioning (pp. 8–9). A concrete FilaFabric experiment is a flat stochastic directional net with seed, node density, neighbour count, stretch ratio, orientation field and line width controls; check connectivity and clipped boundary strands. Reducing it to one layer is an untested translation. Bulk chair/cube examples remain excluded. The model addresses small strain and does not deliver negative Poisson ratios; fatigue and rupture remain future work (p. 11).

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 6–9).**
- **Testing:** linear properties were fitted only on the first 0.5 mm of displacement. Printed samples were stiffer than predicted, which the authors attribute to imperfect infill in the solid reference coupon.
- **Compression and burn-in:** elongated edges buckle early in compression. Repeated tests changed the non-linear response over the first few cycles and then stabilized, a burn-in effect. The linear response stayed the same.
- **Inverse design:** the user picks a target pair of Young's moduli, and parameters are interpolated from the three nearest precomputed samples. Average error was 0.84% in 2D across 13,000 tests, and requests outside the sampled space are rejected.

**Pattern implications.** The formulas in section 2 are enough to implement a **directional stochastic net** in FilaFabric: jittered nodes, k-nearest edges under a stretched metric, and an orientation field that could follow a garment's stretch direction or a picture. Use the deterministic seeding from Paper 44 so the net regenerates identically. Drop nodes left isolated after clipping, and keep strand width at one reliable bead. Cycle swatches a few times before measuring, given the burn-in effect.

---

## Paper 46: Martinez-2019 — Star Shaped Metrics for Mechanical Metamaterial Design
**File Name:** `Martinez-2019_Star-Shaped-Metrics-for-Mechanical-Metamaterial-Design.pdf`

### 1. Summary & Core Focus
Martinez et al. use star-shaped distance metrics to generate and interpolate Voronoi tilings with tunable mechanical response. Their computational pipeline spans isotropic, tetragonal, orthotropic, and auxetic behaviors, using simulation to guide cell design; tensile tests on four TPU specimens broadly support predicted trends, including negative Poisson response in the most auxetic tested sample. The results concern the paper's specific Voronoi geometries, NinjaFlex 85A, specimen dimensions, and printer, not FilaFabric's 'Star lattice' merely because the names sound related.

### 2. Mathematical & Structural Formulations
**Star-shaped distance** (PDF p. 3, §3.1): $d_S(p,q) = \lVert q-p\rVert / f(\angle(q-p))$, where $f$ is the radial span of the star-shaped set $S$, with $a \le f \le b$. The distance is non-negative, definite and positively homogeneous; it is symmetric only if $S$ is centrally symmetric, and the triangle inequality can fail. $f$ is set by $n \ge 3$ radial spans at equally spaced angles, joined either as a polygon or by monotone periodic cubic interpolation (Fritsch–Carlson). Cells are grown by a front-propagation growth model, which keeps each cell connected. Spatial variation can be discrete (per-site metrics: abrupt, interleaved red–black) or continuous ($S(\beta) = \beta S_1 + (1-\beta) S_2$).

**Symmetry rules** (Table 1):

| Lattice | Metric symmetry | Network symmetry |
|---|---|---|
| Square | 4-fold rotation | 4-fold rotation |
| Honeycomb or triangular | 6-fold or 3-fold rotation | same |
| Any of the three | n-axis reflection | same |

One-axis reflection gives orthotropic elasticity; 3-fold rotation gives isotropic elasticity.

### 3. Relevance & Design Takeaways for FilaFabric
A complete recipe for a **curved-cell lattice** family whose in-plane symmetry, and so isotropy or orthotropy, is chosen by construction. It is a natural extension to FilaFabric's Voronoi and Star Lattice options. Material constants come from 2D homogenization (E = 1 Pa, ν = 0.3) and NinjaFlex coupons. The paper does not validate FilaFabric's geometries, settings or Foamy performance.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Martinez-2019_Star-Shaped-Metrics-for-Mechanical-Metamaterial-Design.pdf`. **Class/status: M, direct flat TPU network evidence; S translation proposed.** Star-shaped here describes the distance function that generates generalized Voronoi cells, not a generic star motif. Radial distance samples, polygonal/smooth interpolation and seed-lattice symmetry shape the network (pp. 3–6). A growth procedure addresses disconnected individual cells, although complete network connectivity is not guaranteed in all heterogeneous cases (pp. 4–5, 10–11). Four 69.8 × 50 × 3 mm NinjaFlex 85A specimens were printed on an Ultimaker 3 and tension-tested at small strain; simulated stiffness ordering largely agreed, with larger discrepancy in the softest specimen (pp. 9–10, 12/Fig. 23). Proposed pattern: a flat curved-cell net with radial metric, lattice, interpolation amount, band mask and width controls. Keep actual deposited connectivity explicit. Linear metric interpolation can produce non-monotonic or abrupt mechanical changes (p. 9); no universal stiffness slider or mechanical values follow for FilaFabric.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 8–10).**
- **Database:** metrics sampled with 7 equally spaced angles × 3 radial spans (0.2, 0.6, 1.0), giving 3⁷ = 2,187 metrics per lattice. Combined with diagonal-square, triangular and honeycomb lattices and polygonal or smooth outlines, that makes ten browsable databases in the supplement.
- **Isotropic auxetics exist:** triangular lattice with 3-fold polygonal metrics gives Poisson's ratios from −0.47 to 0.99; honeycomb with 3-fold smooth metrics gives −0.62 to 0.40, all isotropic.
- **Orthotropic examples:** pairs such as ν_xy/ν_yx = −1.03/−0.92 and 0.23/4.23.
- **Numerical artefacts:** 0.8% (triangular) and 4.4% (honeycomb) of the 3-fold samples came out non-isotropic because of grid discretization; finer grids fixed this.

**Pattern implications.** For a FilaFabric **star-metric curved-cell lattice**, start with 3-fold metrics on a triangular lattice. This yields an *isotropic* sheet (same response in every in-plane direction), with auxetic and non-auxetic members in the same family, and avoids the directional bias of square grids. Expose the radial spans as a small "petal shape" editor, with lattice type and symmetry as named presets. Mix the two metrics by site assignment for hard but continuous zone boundaries, since smooth interpolation can jump.

---

## Paper 47: Montes-Maestre-2024 — FlexScale Flexible Scaled Sheets
**File Name:** `Montes-Maestre-2024_FlexScale-Flexible-Scaled-Sheets.pdf`

### 1. Summary & Core Focus
Montes Maestre et al. introduce FlexScale for flexible sheets made of hard printed scales embedded in a soft substrate. Contact-aware simulations at scale level are summarized in an efficient macro-model using directional and curvature-dependent response; the system captures anisotropy, contact stiffening, and different behavior under positive versus negative curvature. Demonstrations use scale-sheet samples and pattern exploration. This scales-plus-substrate architecture is distinct from continuous FDM textile paths; it is context for contact mechanics, not validation of FilaFabric presets.

### 2. Mathematical & Structural Formulations
Scale layouts come from 2D **isohedral tilings**: 93 families, each with up to five shape parameters, generated with the *Tactile* library (isohedral.ca). Tiles are clipped to leave a constant gap and extruded on a continuous substrate. Native-scale contact simulations are homogenized into a macro bending model that depends on direction and curvature sign. The simulation used datasheet values: TPU substrate E = 26 MPa, ν = 0.48; PETG scales E = 2.02 GPa, ν = 0.35. Three-fold rotationally symmetric patterns bend isotropically at small curvature; once scales touch, stiffness rises and develops direction-dependent lobes.

### 3. Relevance & Design Takeaways for FilaFabric
The closest machine and material match in the collection: a Prusa MK3S+ with a NinjaFlex 85A substrate. FilaFabric now has a NinjaFlex 85A profile, so a single-material or dual-material "scale" M preset is a realistic experiment. It does not validate FilaFabric's net geometries, and its contact stiffening depends on scale height.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Montes-Maestre-2024_FlexScale-Flexible-Scaled-Sheets.pdf`. **Class/status: M, direct flat substrate-plus-scales fabrication; N, proposed shallower relief translation.** FlexScale makes tessellated rigid scales on a compliant continuous backing, rather than independently interlocked mail. Physical prototypes use a Prusa MK3S+, 0.4 mm nozzle, 0.1 mm layers, a 0.4 mm NinjaFlex 85A substrate and 4 mm PETG scales with interlocking grooves at their bases (pp. 5–6, §4.1/Fig. 5). Scale contact causes directional stiffening and different opening/closing bending responses; experiments support qualitative simulation trends, with different experimental boundary conditions preventing strict quantitative equivalence (pp. 6–10). A concrete M study is a segmented polygon coating over a thin backing; controls are scale shape, pitch, gap, backing thickness, scale height and orientation. A low-height, single-material N version is proposed, not demonstrated. Reducing height changes contact onset. Existing evidence uses two materials and substantial relief; overlapping scales are explicitly future work (p. 13).

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 5–8).**
- **Print settings:** Prusa MK3S+, 0.4 mm nozzle, 0.1 mm layers, 3 perimeters, gyroid infill in the scales. The **0.4 mm gap** between scales printed straight-edged with slightly rounded corners. An **interlocking groove pattern** at each scale base improved TPU–PETG adhesion.
- **Tests:** discs of 10 cm radius on a mandrel rotating at 4.5°/s under a fixed boundary indent (8 turns, last 6 used), giving force against direction. Rectangular strips on hinges, pushed together to impose rising curvature.
- **Behaviour:** contact flipped principal stiffness directions in some patterns. An initially isotropic hexagonal pattern developed peaks at 60° or 30° under larger curvature, and some patterns changed symmetry class.

**Pattern implications.** (1) **Tactile is a JavaScript library** for all 93 isohedral tiling types, which suits FilaFabric's browser engine. It could generate tile outlines for Star Lattice, Truchet-like or "scale" presets and keep repeats exact. Check its licence before adopting it. (2) A *scale-on-carrier* M preset: tile outlines inset by a fixed gap, printed as low solid or outline islands on a continuous thin carrier. A single-material, shallower N version remains unproven. (3) The rotating-disc indentation rig is a compact way to measure direction-dependent bending in FilaFabric swatches.

---

## Paper 48: Nakajima-2020 — Tensile Properties of 3D Printed Flexible Kirigami Specimens
**File Name:** `Nakajima-2020_Tensile-Properties-of-3D-Printed-Flexible-Kirigami-Specimens.pdf`

### 1. Summary & Core Focus
Nakajima, Fayazbakhsh, and Teshima experimentally test how stacking sequence, slit dimensions, and thickness affect tensile properties of FFF-printed flexible TPU kirigami. They compare layer orientations and quantify break strength and elongation, noting that out-of-plane deformation and a transition in deformation mode contribute to large extension. The [90/0] stacking sequence achieved the highest reported break strength (2.43 MPa) and 183% elongation; [90/90] reached 184% elongation (physical p. 5, Table 5), so 183% was not the maximum elongation. Printing speed also required optimization: overly high rates jammed/under-melted TPU, while the slowest condition produced dripping/bubbles; selected lower speeds yielded acceptable specimens. Results are specific to their slit geometry, TPU, printer, and fixture; they are not direct values for FilaFabric's lattice paths.

### 2. Mathematical & Structural Formulations
**Kirigami unit cell** (PDF pp. 2–3, Table 1): slit width $W$ = 15 mm, slit height $h$ = 1 mm, slit interval $i$ = 5 mm, distance between slit ends $d$ = 10 mm, thickness $t$ = 2 mm, with the constraints $W > d$ and $i > h$. The cell is $(W+d) \times (i+h)$; five cells sit in series across a 50 mm gauge length. Break strength is load / ((W+d)·t), and break elongation is extension / 50 mm. Stacking is written $[A_1/A_2]_n$ for alternating raster angles. An elastic constant $k$ (their Eq. 1) is plotted against $h/i$.

### 3. Relevance & Design Takeaways for FilaFabric
This is **direct experimental context for flexible FDM geometry and mechanical testing**. It shows that slit pattern, layer orientation, thickness, and process stability jointly affect tensile response, supporting tests of both strength and elongation. Kirigami slits differ from FilaFabric's deposited mesh paths, so values and settings cannot be transferred; use this paper to shape test protocols rather than promise performance.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Nakajima-2020_Tensile-Properties-of-3D-Printed-Flexible-Kirigami-Specimens.pdf`. **Class/status: M, direct flat multilayer slitted TPU sheet; S adaptation untested.** Five serial kirigami cells have transverse rectangular slits, not woven or independent links (pp. 2–3, Figs. 2–6). FFF specimens use 0.25 mm layers, 0.4 mm nozzle, 100% infill and varying raster layups; studied slit heights start at 1 mm to prevent closure (p. 3). The [90/0] layup has greatest mean break strength, 2.43 MPa, but its 183% elongation is slightly below the 184% of [90/90] (p. 5, Table 5). Baseline 2 mm specimens deform in plane; the thin-specimen investigation concerns transition to out-of-plane deformation during loading, not upright printing (pp. 5–8). Proposed pattern controls: slit length/height, stagger, ligament width, raster order and sheet thickness. Track slicer gaps and slit-end damage. Slit-size trends are non-monotonic, and demonstrated laminate mechanics cannot be assigned to one-line nets.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–8).**
- **TPU speed window** (Creality CR-10S, Simplify3D, 230/70 °C, 0.25 mm layers, fan on, one shell, 100% infill): 720, 648, 504 and 432 mm/min jammed (the hot end could not melt fast enough); 216 mm/min dripped and bubbled; 360 and 288 mm/min printed well, and 288 was kept because it filled more completely. That is about 5 mm/s for this TPU, much slower than the profile defaults.
- **Why [90/0] is robust:** in [0/0] and [90/90] layups, some deformed regions end up with strands only *across* the load. Under [90/0], every region keeps strands *along* it. [90/90] also had slicer gaps across the load that started cracks (CV 22.6%), while [90/0] had a CV of only 1.7%.
- **Slit size is non-monotonic:**
  - [45/−45]: best strength and elongation near h/i ≈ 0.32.
  - [90/0]: best at h/i ≈ 0.20 and worst at ≈ 0.33.
  - Both layups: elastic constant $k$ highest at h/i ≈ 0.2.
  - **1 mm** was the smallest slit that did not close up in printing.
- **Thickness 1–2.5 mm:** break load rises linearly with thickness while strength and elongation stay roughly constant. **Specimens 1–1.5 mm thick buckled out of plane** during tension; 2–2.5 mm stayed in plane.

**Pattern implications.** (1) In multi-pass FilaFabric sheets, alternating line directions between passes keeps material aligned with any load and reduces scatter. That is a reason to keep crossed families rather than parallel duplicate passes. (2) Use about 1 mm as the minimum designed opening for slit or perforated sheets with a 0.4 mm nozzle. (3) Thin TPU sheets are expected to buckle out of plane under tension, so tension tests should record out-of-plane motion, not only crosshead travel. (4) Treat about 5 mm/s as a plausible TPU starting speed to test, not a FilaFabric setting.

---

## Paper 49: Ou-2016 — Cilllia 3D Printed Micro Pillar Structures
**File Name:** `Ou-2016_Cilllia-3D-Printed-Micro-Pillar-Structures.pdf`

### 1. Summary & Core Focus
Ou et al. introduce Cilllia, a bottom-up method and interface for designing sub-100-μm hair-like micro-pillars on flat or curved surfaces. Users control pillar height, thickness, angle, density, and distribution; a layer-based representation generates the structures and maps geometric properties across surfaces. Demonstrations include directional mechanical adhesion, compliant brushes, passive movement under vibration, and acoustic sensing of swipe direction/speed. The paper emphasizes how pillar geometry encodes surface function, but its fabrication process and micro-pillar scale differ from FilaFabric's FDM textile strands. It does not validate textile drape or FilaFabric printability.

### 2. Mathematical & Structural Formulations
The source parameterizes hair-like micro-pillars by height, thickness, angle and distribution, using a fabrication-specific layer representation. It does not present the asymptotic homogenization/effective-tensor formulation previously assigned here. Its tall micro-pillar architecture is outside the S/M/N target; only spatial parameter mapping is transferable.


### 3. Relevance & Design Takeaways for FilaFabric
This is **adjacent inspiration for functionalized surface textures**, especially mapping spatial data to geometry and coupling structure to sensing/adhesion. FilaFabric could consider separate fringe/pile or tactile-texture modes, but Cilllia's sub-100-μm pillars and fabrication process are not transferable to the MK3S/Filaflex Foamy workflow without dedicated tests. It does not substantiate flexible textile-sheet mechanics.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Ou-2016_Cilllia-3D-Printed-Micro-Pillar-Structures.pdf`. **Class/status: excluded tall-pile/resin process; N receives only a design-control analogy.** Cilllia generates individual tapered/tilted hairs as bitmap slices on an Ember DLP printer, with experiments on a laser SLA machine (pp. 3–5). Pixel deletion controls profile and pixel offsets control tilt; RGB images map two angles and hair height over a surface (pp. 3–4). Demonstrations include brushes, frictional attachment, vibration-directed motion and acoustic swipe sensing (pp. 5–9). Some illustrated hairs are 10 mm long (p. 5): a flat carrier does not make this a shallow textile-sheet process. The transferable idea is mapping image channels to independent geometry controls. A proposed FilaFabric N experiment could map an image to shallow ridge height, orientation and spacing on an anchored sheet, subject to nozzle clearance. That is a new experiment, not Cilllia replication. Do not import its hair mechanics, micron-scale resolution or adhesion claims, and remove the unrelated homogenization-tensor boilerplate from the master.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–4).**
- **Bitmap encoding:** **R** sets the tilt about X, **G** the tilt about Y, **B** the height. Hair density is set by how often the bitmap is sampled (every few pixels).
- **Hair shape:** a 3 × 3 pixel base shrinks layer by layer in a spiral to a single-pixel tip. Offsetting the pixel group sideways every few layers tilts the hair; offsetting it in a circle makes spring-shaped hairs.
- **Tilt formula:** printed on p. 3 as "tanθ = (L/2) × P" (L layers, P offset pixels, 25 µm Z versus 50 µm XY pixels). As printed it does not reduce dimensionally. Geometrically, P pixels per L layers gives tan θ = 2P/L from vertical, so do not copy the printed expression.
- **Density and geometry limits:** 20,000 strands on 30 × 60 mm. On curved meshes, hairs grow along face normals, and normals beyond the 60° overhang limit are dropped. Hairs are shortened where they would hit an inward-curving surface.

**Pattern implications.** For FilaFabric's picture input, Cilllia is a clear precedent for using **separate image channels for separate controls** (one channel per physical parameter), and for setting density by sampling interval. A two- or three-channel picture (for example R = strand angle, G = pitch, B = shallow height within an N budget) would avoid overloading one tone value. Hair printing itself stays excluded.

---

## Paper 50: Ozev-Ehrmann-2023 — Sandwiching Textiles with FDM Printing
**File Name:** `Ozev-Ehrmann-2023_Sandwiching-Textiles-with-FDM-Printing.pdf`

### 1. Summary & Core Focus
Özev and Ehrmann test a sandwich construction in which cotton or aramid fabric is placed between FDM-printed polymer layers, rather than relying only on surface adhesion. Samples use PLA or 95A TPU, with a pause after printing the bottom layer so textile can be positioned before the upper layer is printed. The study's key intervention is adding small nubs to the lower printed layer to press the fabric into place and resist movement; nub dimensions/spacing and edge geometry are adjusted for thin cotton versus thicker, less even aramid. Printing uses 0.4 mm nozzle and 0.2 mm layers; PLA is printed at 210/60 °C and TPU at 230/70 °C, with much lower TPU speed.

Flat sandwiches embedded the textile but allowed it to shift because real fabric is uneven and not held parallel between layers. Small, closely spaced nubs stabilized the cotton; the authors found nub shape less important in the tested small-size range. TPU sandwiches were more flexible than PLA and, despite TPU's harder printability, were judged more promising for wearable/protective use. Aramid was more challenging due to thickness and surface unevenness, but stepped edges and a residual connection to the first step improved structural stability. Evidence is photographic/microscopic and repeated-bending observations; the authors did not quantify pull-out force or stab resistance, and explicitly call for a standardized fabric pull-out test.

### 2. Mathematical & Structural Formulations
The construction inserts textile during a printing pause, then traps it between polymer layers. Gap height, nub geometry/spacing and stepped edges provide fixation. The paper does not establish under-extrusion, capillary-bridge or strand-width equations; attachment/protection observations remain qualitative pending suitable pull-out testing.


### 3. Relevance & Design Takeaways for FilaFabric
Highly relevant to a **future FilaFabric textile-insertion or hybrid-substrate workflow**, especially when the goal is attachment without relying solely on polymer-fiber adhesion. It suggests path features such as nubs, stepped edges, controlled pause/resume sequencing, and gap sizing based on substrate thickness; it also shows why substrate unevenness can disrupt layer-to-layer joining. The paper does not provide quantitative pull-out or protective-performance validation, and its printer settings should not be copied to the MK3S. It is distinct from FilaFabric's current free-standing textile swatch generation and current profile calibration.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Ozev-Ehrmann-2023_Sandwiching-Textiles-with-FDM-Printing.pdf`. **Class/status: M, direct hybrid sandwich; shallow internal relief also demonstrated.** PLA or 95A TPU lower layers receive cotton/aramid fabric during a programmed pause, then an upper layer joins around the textile; only corners are glued during positioning (p. 2). The 102 × 52 mm cotton sandwich uses 0.2 mm polymer layers and small nubs that squeeze the fabric against the upper skin. Nub diameter/side length and spacing are varied; aramid requires a larger gap and stepped perimeter (p. 3, Figs. 1–2). Photographs and microscopy show improved fixation with small closely spaced nubs, and repeated bending shows no observed textile movement; pull-out measurement is future work (pp. 4–5). Proposed FilaFabric controls: substrate thickness, insertion pause, lower/upper masks, nub pitch/size and perimeter steps. Maze-like friction patterns are the authors’ proposal, not tested results. This is not under-extrusion/capillary-bridge research, and protective performance was not measured.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–5).**
- **Printer and settings:** Anycubic i3 Mega S, Cura, 0.4 mm nozzle, 0.2 mm layers alternating ±45°. PLA at 210/60 °C and 50 mm/s; 95A TPU at 230/70 °C and **20 mm/s**. Temperatures were set at the top of each filament's range for better flow over uneven fabric.
- **Cotton (0.33 mm thick):** a 0.2 mm skin, a 0.2 mm gap and a 1 mm joined edge. Because the fabric is thicker than the gap, it is squeezed between nubs and the upper skin.
- **Aramid (0.61 mm thick):** a 0.6 mm gap, nubs 0.8 mm across and 0.4 mm tall (leaving 0.2 mm above them) and a stepped edge.
- **Nubs** tested: round or square, 0.8–1.5 mm across, spaced 5–17 mm. Small, closely spaced nubs worked best, and shape did not matter at this size. The upper skin visibly thinned over each nub, showing where the fabric was pinned.
- **Positioning:** fabric was glued only at its corners (glue stick) so the test showed whether nubs alone held it. Full-layer gluing is possible with a flexible glue.
- **Proposed pull-out test:** leave one edge open and measure the force to draw the fabric out.

**Pattern implications.** A future insert workflow in FilaFabric would need three geometry controls: the gap (from fabric thickness, slightly under-sized to clamp thin fabric), a nub grid (size and spacing) and the edge type (flat or stepped). The "maze" friction layer the authors propose is a natural fit for FilaFabric's meander or Truchet generators drawn as low ribs on the lower skin. That is untested.

---

## Paper 51: Panetta-2015 — Elastic Textures for Additive Fabrication
**File Name:** `Panetta-2015_Elastic-Textures-for-Additive-Fabrication.pdf`

### 1. Summary & Core Focus
Panetta et al. present a computational method for designing tileable, printable 3D microstructures (“elastic textures”) whose effective mechanical properties can be selected or spatially varied inside an object. Rather than optimize a unique dense structure for every location, they search and optimize a small family of symmetric truss-like cell topologies, then use periodic homogenization to map cell geometry to effective elasticity. Changing strut thicknesses and node offsets tunes each cell; mixing cells spatially approximates a target stiffness distribution. The paper also describes shape optimization to choose local microstructures that achieve a prescribed deformation under a scenario.

The six selected topologies span a broad range: the authors report an approximately 1,800:1 ratio between stiffest and softest effective Young's modulus and isotropic Poisson ratios from about -0.16 to 0.48. Their design process explicitly incorporates unit-cell printability and tileability (minimum feature thickness, no enclosed voids, and support constraints). They validate predictions by printing and mechanically testing samples with an SLA system; measured stiffness trends broadly track homogenized predictions, with errors attributed in part to friction and thin-feature inaccuracies. This is a volumetric microstructure method, not a flat textile or FDM net study, and its numerical ranges depend on its base polymer, cell scale, and fabrication process.

### 2. Mathematical & Structural Formulations
**Isotropy check** (PDF pp. 3–5): for a cubic-symmetric cell the compliance has Young's modulus $E$, Poisson's ratio $\nu$ and an independent shear modulus $G$. The anisotropy measure $A = 2(1+\nu)G/E$ equals 1 only for an isotropic pattern. **Topology filter:** candidate graphs on 15 tetrahedron nodes, about $10^{32}$ in principle, are kept only if the tiled graph is a single connected component, with no coinciding edges, **no dangling edges (every node valence > 1)**, at most 3 edges per tetrahedron and node valence at most 7. That leaves 1,205 topologies before geometry (node offsets, bar thickness) is optimized. SLA printability rules: no enclosed voids, every feature extent at least $d_{min}$ (0.3 mm), and every slice component supported from below. Patterns were tested up to 10 mm.

### 3. Relevance & Design Takeaways for FilaFabric
This is an important **mechanical-design and validation reference** for FilaFabric's auxetic, star, Voronoi, and other parameterized lattice families. It demonstrates a rigorous pipeline—geometry parameters → effective mechanical response → optimization/lookup → fabricated validation—and motivates associating a structure preset with measured mechanical ranges rather than visual labels alone. Its volumetric truss cells and SLA fabrication are fundamentally different from FilaFabric's thin TPU/FDM paths; its modulus and Poisson-ratio numbers cannot be assigned to FilaFabric patterns. A practical adaptation would be a simplified experimental/material library built from FilaFabric's own swatches and printer profiles, not direct reuse of the paper's homogenized tensor model without a compatible cell model.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Panetta-2015_Elastic-Textures-for-Additive-Fabrication.pdf`. **Class/status: bulk truss microstructures excluded; S/M receive a characterization-workflow translation only.** Six related three-dimensional truss topologies are selected through search, periodic homogenization and geometry optimization to cover effective elasticity space (pp. 3–8). SLA printability constraints concern supported slices, minimum feature extents and drainage, not FDM sheet-toolpath clearance (p. 3). Physical validation compresses 6 × 6 × 2 tilings of 5 mm cells on a B9Creator; friction and thin-feature thickening explain discrepancies (p. 4). The approximately 1800-fold modulus range and negative-to-positive Poisson range belong to that cell family. A useful proposed FilaFabric pattern library would associate each flat net’s pitch, line width and node geometry with measured tension and bending curves, plus compatible boundary connectors. This library is a methodological translation, not one of the demonstrated elastic textures. Linear elastic models omit buckling and damage (p. 10), so they cannot predict textile drape or repeated extension without additional modelling and tests.

### 5. Second full-text pass — 24 October 2026

**Added details.** Section 2 now holds the isotropy measure and the topology filter. The authors note that isotropy plus printability limits how negative Poisson's ratio can go: −0.16 here, whereas cubic-symmetric but non-isotropic patterns reach more extreme values. Four of the six final topologies turn into each other by simple vertex splits or by adding cross supports.

**Pattern implications.** (1) The 2D analogue of $A$ is a quick check on FilaFabric nets. A square 0/90 grid is typically far from isotropic in shear (it shears easily on the bias), while 3- or 6-fold nets such as isogrid π/3 or kagome are isotropic in-plane. That matches Kalman's quasi-isotropy at higher m (29) and the symmetry rules in Martínez 2019 (46). (2) The topology filter is a ready-made validity rule for generated nets: one connected component, no dangling segments, a bounded number of strands per node. It suits the construction report the audit proposes. The paper's numbers belong to 3D SLA trusses.

---

## Paper 52: Sapkota-2024 — Review of FDM Methods Materials and Flexible Fabric Structures
**File Name:** `Sapkota-2024_Review-of-FDM-Methods-Materials-and-Flexible-Fabric-Structures.pdf`

### 1. Summary & Core Focus
Sapkota, Ghimire, and Adanur review FDM processes, materials, mechanical characterization, and applications for flexible fabric structures, including free-standing printed fabrics and polymers deposited on conventional textiles. They identify strength, flexibility, surface quality, and processability as recurring challenges, and summarize how temperature, layer height, speed, build orientation, reinforcement, and polymer blending influence outcomes. This secondary review aggregates heterogeneous studies rather than presenting a new experiment; reported values must be traced to primary sources and are not FilaFabric calibration settings.

### 2. Mathematical & Structural Formulations
No new formulation. It reproduces other authors' models, for example Jayswal's Prony-series viscoelastic master curve (tan δ peaking near PLA's glass transition, about 60 °C). Its fabric section (PDF pp. 32–36, Table 10) is a qualitative comparison table.

### 3. Relevance & Design Takeaways for FilaFabric
The most useful lead is the cited **sliding-crossing** method of Li et al., an arched upper strand that bridges a flat lower strand without touching it (see §5). It is the only bed-flat route in the collection to crossings that are genuinely not fused. The review does not validate it, or FilaFabric's geometries and settings.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Sapkota-2024_Review-of-FDM-Methods-Materials-and-Flexible-Fabric-Structures.pdf`. **Class/status: secondary context for S/M; no new printable-sheet validation.** The review combines general FDM parameter/material studies with several very different textile architectures. Its fabric section distinguishes upright PLA pillar weaving, under-extruded upright DefeXtiles, sliding-crossing structures, multi-material flat stacks and printing onto cloth (pp. 32–36). These must not become a single interchangeable family. In particular, the flat elevated crossing described on p. 33 is attributed to Li et al.; the review itself does not establish a clearance recipe. The directly useful proposed M experiment is a fused crossing net with an ornamental upper layer, controlling layer order, crossing density, width and local reinforcement. A sliding-crossing version needs its own primary-source review and clearance tests. Conclusions identify coupled process parameters, insufficient strength/flexibility, wear comfort, fatigue and creep as open work (pp. 36–37). Thus parameter tables from unrelated solid specimens supply study variables, not universal optimal textile or Foamy settings.

### 5. Second full-text pass — 24 October 2026

**Primary works summarized (PDF pp. 32–36), none held locally.**
- **Li et al. (ref. 196), sliding connections:** a standard planar grid in which one strand is printed flat and the crossing strand is laid with a slight print-head lift, forming an **arch-shaped channel over the lower strand with no contact**, so the strands can slide. Orthogonal, curved, interlacing and looped layouts are reported. **All-sliding** grids were highly flexible and deployed easily from flat to parabolic; **all-fused** grids were stiffer and quasi-isotropic. Mixing the two connection types tunes the response.
- **Fajardo et al.:** linked-element "fabrics" (cylindrical, prismatic, annular links) in FDM and SLA; prismatic links were strongest. Flexibility came from gaps between links, at the cost of stress concentrations.
- **Spahiu et al.:** a 33-part dress, 75 h of printing, joined with a 3D pen, in PLA, nylon, TPU and FilaFlex. FilaFlex was the wearable choice; viscosity sometimes caused failures. A separate Spahiu study found that the layout of printed squares, triangles and circles on fabric changed skirt drape (coefficient, node count); some patterns were too stiff and were placed only near edges.
- **Uysal & Stubbs:** an 11-layer stack with PLA in the first four odd layers and LAY-FOMM 40 elsewhere. Smaller, more intricate patterns took longer and were stiffer and stronger.
- **Melnikova et al.:** lace in LAY-Tekkks, a porous filament softened by soaking in water for about 3 h; soft PLA needed no supports.

**Pattern implications.** Add a **sliding-crossing option** to N1, with the primary paper to be retrieved first: a local lift over each crossing, sized from bead height plus clearance, so the upper strand bridges the lower one without fusing. It could be mixed with fused crossings in a chosen proportion (all-fused, alternating, or sliding only in a hinge zone) to tune flexibility. This is the only cited bed-flat route to non-fused crossings. Each lift adds sag, stringing and snag risk, and it is unverified for Foamy TPU.

**Primary checked, 26 October 2026 (Paper 67).** The Li et al. description above is incomplete. The crossing strand is laid raised with little adhesion, and a **separate printed channel**, fused to the lower strand, then encloses it, so the strands slide without separating. A lift alone is not the method. The flat-to-parabolic deployment uses one sliding actuation strand in an otherwise fused structure. Sapkota's Spahiu summary is checked in Paper 68.

---

## Paper 53: Schumacher-2015 — Microstructures to Control Elasticity in 3D Printing
**File Name:** `Schumacher-2015_Microstructures-to-Control-Elasticity-in-3D-Printing.pdf`

### 1. Summary & Core Focus
Schumacher et al. design families of tileable microstructures whose geometry controls effective elasticity in single-material 3D-printed objects. They optimize related cell families, interpolate among them to span elastic properties, then select compatible neighboring cells for spatially varying behavior. Numerical homogenization predicts effective properties; printed 2D and 3D samples are tested against predictions. This demonstrates a pipeline from target properties to printable structure, but uses volumetric microstructures and process constraints unlike thin FDM textile paths. Its numerical properties cannot be assigned to FilaFabric presets.

### 2. Mathematical & Structural Formulations
The paper uses periodic homogenization to map unit-cell geometry to effective elasticity tensors and searches related cell families that interpolate across property space. Neighbor compatibility is part of the global tiling problem; the authors compare predicted properties with mechanical tests on printed samples.

### 3. Relevance & Design Takeaways for FilaFabric
This is a useful **methodological precedent for property-aware pattern design**: define geometric parameters, characterize their effective response, enforce printable/tileable constraints, and validate the resulting specimens. FilaFabric could adopt the workflow for its own swatches, but the paper's volumetric cells, SLS fabrication using elastic TPU 92A-1, and base material differ; its modulus and Poisson-ratio values are not applicable to FDM Foamy nets.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Schumacher-2015_Microstructures-to-Control-Elasticity-in-3D-Printing.pdf`. **Class/status: flat connected 2D microstructure geometry is transferable to S/M; fabrication evidence is SLS, alongside excluded bulk examples.** The method optimizes voxel material distributions, builds families spanning elasticity parameters, interpolates them and chooses neighbouring structures to reduce boundary mismatch (pp. 4–9). It does not guarantee global connectivity; repairs change properties (p. 9). Importantly, physical specimens were selectively laser sintered in elastic TPU 92A-1, not SLA. Flat 7 × 15-cell tensile specimens and separate 7 × 7 × 6-cell compression blocks test distinct cases (pp. 9–10). Proposed sheet pattern: connected perforated cells with a gradual transition between compliant and reinforced zones, with cell family, pitch, ligament width and shared-edge controls. The two-dimensional networks are not independent chain links, so their topology remains useful even though the process differs. FDM rounding, bead width and fused nodes require regeneration and testing; interpolated material parameters alone do not ensure printable interfaces or large-strain accuracy.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 5–9).**
- **Three regularizers make results printable:**
  - a binary penalty $R_{int} = \sum(\alpha_i - \alpha_{min})(1-\alpha_i)$, raised gradually so material is either present or absent;
  - a smoothness term (discrete Laplacian of the material field);
  - an **anti-checkerboard** term against elements touching only at a corner.
- **Blending between structures:** distance fields are interpolated in log space, $f(x) = \mathrm{sgn}(x)\log(|x| + \delta)$ with $\delta = 10^{-3}$, using compactly supported Wendland weights (radius 0.1 in normalized parameter space). This reduces holes appearing and disappearing mid-blend.
- **Growing a family:** start from one structure, add dilated and eroded copies, then repeatedly evolve and optimize new members.
- **Graded synthesis is a labelling problem:** each cell picks among candidate structures from overlapping families, trading off a match to its target (cost $e^{d}$) against boundary agreement with its neighbours (cost $e^{g}$). $g$ is either the fraction of the shared edge where material presence disagrees, or the force mismatch across the edge under unit strain. It is solved approximately by ADMM message passing, then smoothed on the combined field.
- 2D families were optimized at 40 × 40 voxels, and cubic families covered even isotropic targets better than isotropic ones.

**Pattern implications.** (1) *No point-only contacts:* in a FilaFabric net, two cells or strands meeting at a single touching point form a weak, unreliable bond. Require a minimum overlap or neck width at every intended join; this is the FDM version of the anti-checkerboard rule. (2) For picture-graded cells, blend geometry continuously rather than switching designs per cell, and when choosing variants, prefer neighbours whose edges coincide. This agrees with the neighbour-averaging rule in Chen (6).

---

## Paper 54: Schumacher-2018 — Mechanical Characterization of Structured Sheet Materials
**File Name:** `Schumacher-2018_Mechanical-Characterization-of-Structured-Sheet-Materials.pdf`

### 1. Summary & Core Focus
Schumacher et al. propose numerical homogenization for planar rod-network sheets, using 3D Kirchhoff-rod simulation to characterize nonlinear in-plane and bending response. They compute directional Young's modulus, Poisson's ratio, bending stiffness, and nonlinearity for isohedral tilings, organize results in a material browser, and provide inverse design toward a target response. The macro-model approximates meso-scale behavior; selected structures are experimentally checked. Physical PDF p. 8 explicitly reports FDM NinjaFlex networks printed with an Ultimaker 2 and Flex3Drive: 100 × 100 × 1.2 mm sheets. These are direct planar class-M fabrication precedents, not merely abstract rod models or single-layer swatches. This is relevant to structure exploration and communication, but its models and specimens do not characterize FilaFabric paths or Filaflex Foamy.

### 2. Mathematical & Structural Formulations
A 3D Kirchhoff-rod model captures mesoscopic bending and stretching of planar networks; numerical homogenization fits an equivalent thin-plate response. Reported descriptors include directional Young modulus, Poisson ratio, bending stiffness, and a nonlinearity measure. This is a reduced-order approximation, not a universal model for all printed sheets.

### 3. Relevance & Design Takeaways for FilaFabric
This is one of the closest **mechanical-characterization and interface-design precedents** for FilaFabric's free-standing sheet-like structures. Its material-browser concept suggests showing measured, directional behavior alongside pattern previews. FilaFabric would need its own mechanical database, as the paper's rod-network specimens and input material differ from Foamy extrusion paths.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Schumacher-2018_Mechanical-Characterization-of-Structured-Sheet-Materials.pdf`. **Class/status: M, strong direct flat FDM network precedent; S thinning proposed.** Isohedral tilings become connected rod-network sheets. Three-dimensional Kirchhoff-rod simulation allows local out-of-plane buckling even though the rest-state network is planar; membrane and bending responses are characterized independently (pp. 3–6). Physical 100 × 100 × 1.2 mm NinjaFlex patches were printed on an Ultimaker 2 with Flex3Drive, then tested in tension and gravity-assisted bending (p. 8, §5.1). Bending measurements agree less closely than tensile results, partly because capture and print-height errors matter. Approximately 5500 sampled tilings populate a browser with directional Young modulus, Poisson response and bending stiffness (pp. 8–10). Proposed controls are tiling family, edge-shape parameters, scale, orientation and line width, with separate tension/drape descriptors. Making the networks one layer is a new validation task. A visual resemblance or scalar density cannot establish softness: similar patterns differ because their rods bend or stretch along different load directions.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–10).**
- **How networks deform** (§3.1): rods stretch, bend or twist. Rods put in compression buckle out of plane rather than shorten. A network that deforms mainly by bending is much softer than one that must stretch its rods, and which regime applies depends on load direction. At large strain every rod ends up stretched, and the sheet stiffens sharply. Membrane stiffness and bending stiffness are only weakly correlated, so the two must be measured separately.
- **Symmetry → material class** (Fig. 6):

| Tiling symmetry | Material class |
|---|---|
| 2-fold rotation only | anisotropic |
| one- or two-axis reflection | orthotropic |
| 4-fold rotation or four-axis reflection | tetragonal (equal along 0° and 90°, different on the bias) |
| 3- or 6-fold rotation, or three- or six-axis reflection | **isotropic** |

  The mapping works one way only: an isotropic material need not have these geometric symmetries.
- **Tiling space:** 93 isohedral families, IH01–IH93, with base tiles from triangle to hexagon, 0–6 shape parameters and up to 12 tiles per translational unit. Units were normalized to equal area. About 5,500 valid sheets were sampled with parameters in [−1, 2], 1.5 mm rods and segments up to 2.5 mm; directional Young's modulus spans about five orders of magnitude.
- **Material data:** NinjaFlex base modulus **15.5 MPa** from a dog-bone test, ν = 0.48. Bending was measured by the gravity-assisted Clapp method (camera plus polynomial fit). Properties were reported at 0.1% and 10% strain, and at curvatures of 0.1 and 5 m⁻¹.

**Pattern implications.**
1. Use the symmetry table as a FilaFabric design rule: a 0/90 crosshatch is tetragonal (stiff on the axes, soft on the bias); isogrid π/3, kagome, hexagonal and 3-fold star-metric nets are in-plane isotropic; one-mirror motifs (chevrons, many zigzags) are orthotropic. Show the class with each preset.
2. Expect strain stiffening in every open net once its strands straighten. Report low-strain and high-strain stiffness separately.
3. The 15.5 MPa NinjaFlex value suits rough simulation with FilaFabric's NinjaFlex profile, but not with Foamy.

---

## Paper 55: Shajoo-2021 — Auxetic Structures from 3D Printed Hybrid Textiles
**File Name:** `Shajoo-2021_Auxetic-Structures-from-3D-Printed-Hybrid-Textiles.pdf`

### 1. Summary & Core Focus
Shajoo, Schmelzeisen, and Pastore combine FDM-printed polymer geometries with a pre-stretched elastic jersey substrate to create auxetic hybrids. The polyester/Spandex knit is stretched 50% in both in-plane directions and pinned during printing. Rotating-square and triangular frames use a soft PLA base/hinge and stiffer ABS structural members; the fabric is selectively slit so it acts as a hinge rather than resisting transverse expansion. A 7 × 7 rotating-square specimen showed an estimated Poisson ratio of -0.9 and formed synclastic surfaces; a triangular specimen reached -1.05 under extension. These values describe particular demonstrations, not general pattern performance.

Repeated loading caused ABS-to-knit delamination, especially at high-stress square corners. The authors also demonstrate a 4D response: PLA hinges soften above roughly 60–65 °C, allowing stored strain in the pre-stretched textile to drive shape change; cooling holds the deformed state, and reheating in approximately 60 °C water returns it toward the original form. This mechanism depends on a hybrid substrate, material pairing, slits, and thermal transition—not merely an auxetic CAD shape. It is proof-of-concept, without standardized cycle-life or application-safety data.

### 2. Mathematical & Structural Formulations
The hybrid unit cells use rotating-square or triangular frames with compliant PLA hinges and stiffer ABS members bonded to pre-stretched, selectively slit polyester/Spandex knit. Estimated Poisson ratios are obtained from specimen deformation; the paper also documents thermal actuation as PLA hinges soften above their transition range. Delamination under repeated loading is a key observed failure mode.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **direct structural precedent for auxetic textile hybrids**, especially how hinge placement, substrate pre-strain, slits, and bonding determine whether negative-Poisson motion is realized. It also makes joint durability a central design constraint. The numerical Poisson ratios and thermal response belong to these multi-material fabric-backed specimens; they do not describe FilaFabric's single-material free-standing nets.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Shajoo-2021_Auxetic-Structures-from-3D-Printed-Hybrid-Textiles.pdf`. **Class/status: M, direct planar-build hybrid; thermal forming is subsequent deformation, not N printing.** The substrate is polyester/Spandex jersey stretched 50% in both directions and pinned flat before printing (pp. 5–6). Rotating square/triangle systems use printed structural members; selectively slitting the knit permits transverse expansion, while unslit fabric resists it. Repeated loading causes corner delamination in the initial ABS-on-knit system (pp. 7–8). PLA base/hinge regions and selective ABS upper members produce a two-layer structure; heated PLA hinges allow stored textile strain to drive recovery (pp. 7, 9–10). Demonstrated Poisson estimates, including −0.9 and −1.05, belong to these specific hybrids. A proposed free-standing M translation uses polygon frames linked by thin compliant printed necks, with frame size, hinge length/width and gap controls; it substitutes fused hinges for the slit textile and therefore needs testing. Substrate prestrain, slitting and heat actuation should remain separate optional hybrid workflows, not claims about TPU geometry alone.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 4–10).**
- **Background routes to auxetic textiles:**
  - Helical auxetic yarn (fully extended diameter $D_e \approx 2d_c + d_w$): woven into fabric it is barely auxetic, because neighbouring yarns resist the expansion, but porosity changes markedly.
  - Warp-knit auxetics: often auxetic on first loading only.
  - Needle-punched nonwovens: auxetic only through the thickness.
  - **Origami folding:** in-plane auxetic behaviour from creases set by pressing.
- **Hybrid build:** printed on a Mass Portal Pharaoh XD (0.4 mm nozzle, two feeds) onto knit stretched 50% each way and pinned to a plate. The whole first layer is PLA, which flows into the knit and later acts as the hinge. ABS goes on top only over the square or triangle members. The fabric must have low shear modulus and high extensibility because shear strain concentrates at the hinges.
- **Results:** 3 × 3 squares (strong auxetic, delaminating at corners), 7 × 7 squares (ν ≈ −0.9, synclastic), triangles (ν ≈ −1.05). Heated above PLA's Tg (about 60–65 °C) and cooled, the hybrid holds a deformed shape. Re-immersed in 60 °C water, it returned to its printed shape within about a minute.

**Pattern implications.** For a single-material FilaFabric version, *rotating squares* and *rotating triangles* become solid or outlined polygons joined only at corners by short, narrow TPU necks. The neck replaces the slit fabric hinge, so neck width and length are the key controls, and corners need fillets because that is where the hybrid failed. Pleat- or origami-style folding is a further auxetic route through post-forming, outside bed-flat printing.

---

## Paper 56: Sitotaw-2020 — Additive Manufacturing and Textiles State of the Art
**File Name:** `Sitotaw-2020_Additive-Manufacturing-and-Textiles-State-of-the-Art.pdf`

### 1. Summary & Core Focus
Sitotaw et al. review additive manufacturing in textiles across three relationships: printing on textiles, printing flexible structures, and printing with flexible materials. They survey design tools, processes, materials, applications, and reported advantages and disadvantages, emphasizing customization and functional/geometric opportunities alongside adhesion, material limitations, and integration challenges. This is a broad state-of-the-art review, not a new experiment or meta-analysis; its evidence spans processes beyond desktop FDM. It orients the literature map but does not validate a FilaFabric pattern or profile.

### 2. Mathematical & Structural Formulations
No formulation; taxonomy only. The review separates printing on textiles, flexibility through structure, and flexible materials. Its Table 2 classes are thin-plate kinematics (Bastian), mesh-like thin sheets and linked elements.

### 3. Relevance & Design Takeaways for FilaFabric
Useful mainly for its taxonomy and for pointing to Pattinson et al. (2019): bond modulation, regionally patterned auxetic cells and conformal meshes printed onto a template (§5). It does not validate FilaFabric's geometries or settings.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Sitotaw-2020_Additive-Manufacturing-and-Textiles-State-of-the-Art.pdf`. **Class/status: secondary context spanning S/M and several excluded fabrication routes.** The review separates printing on conventional fabric, making flexibility through structure, and depositing inherently flexible material. For hybrid sheets it identifies filament, nozzle/fabric distance, print settings and substrate morphology as interacting adhesion variables (p. 8). Its structure taxonomy explicitly separates perforated thin sheets, connected plate mechanisms and independently linked elements (pp. 10–11); the latter are not evidence for fused FDM pseudo-weaves. Multi-layer lace appears as a documented example rather than a new experiment (p. 13/Fig. 15). A proposed M sample is open supporting mesh plus floral traces, with a backing mask, motif scale, junction overlap and layer-order controls. A proposed S version must maintain one connected planar graph. The review offers a useful architecture taxonomy and routes to primary references, not comparative validation of these proposals. Productivity, permeability and physiological comfort remain unresolved (pp. 15–16); garment images do not settle those questions.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 8–15).**
- **Flexible-structure taxonomy** (Table 2):
  - (1) *Thin-layer plate kinematics*, example "Mesostructure of A. Bastian": thin, nearly parallel plates oriented 90° to the nominal surface and connected at the ends. The table says their low thickness makes bending moments negligible, and that they can bend in- and out-of-plane and can be auxetic if well designed. No plate height is given. The structure column cites ref. 88 (Laperre, a Centexbel newsletter) while the example column cites ref. 98 (Bastian's Thingiverse prototypes). Sitotaw does not mention Peleg; the Peleg–Bastian link comes from Keefe (30).
  - (2) *Mesh-like thin sheet*: a thin plate with openings that add bending flexibility and formability; example, the Kinematics dress.
  - (3) *Linked elements* (rings, triangles, squares, closed curved shapes): normally printed with support material in the gaps; each element can move and rotate locally, which gives very good drape.
- **Pattinson et al. 2019** (*Adv. Funct. Mater.* 29:1901815, ref. 106, not held), cited for:
  - **(A) modulating fibre–fibre bonding:** the toolpath lets a strand cool before it touches the earlier strand in chosen areas, so those strands are not connected and can slide, giving noticeably more drape (Fig. 19a);
  - **(B) a mesh with locally patterned negative-Poisson's-ratio cells**, anisotropic and able to conform to a knee (Fig. 19b);
  - **(C) conformal meshes printed onto a template** (Fig. 19c); one is sewn onto a glove that exerts a restoring force on the fingers when the fist is clenched, for stroke rehabilitation;
  - body-conforming meshes for conditions from ankle and other joint sprains to hernia and tremors.
- **Ankle brace and embedded-mesh glove:** the review describes an ankle brace with a controlled non-linear tensile response, letting the ankle move freely unless it inverts too far, and a glove with an embedded mesh that conforms to the hand. It cites both to **ref. 17, Uysal & Stubbs 2019**, not to Pattinson. Its Figure 18, also ref. 17, shows Uysal & Stubbs's sewn two-material glove. Confirm from the primaries which paper the ankle brace comes from. One lead: Kabir 2025 (27, ref. 45) cites an MIT News item, Chu 2019, "Engineers 3-D Print Flexible Mesh for Ankle and Knee Braces".
- **Other examples:** multi-layer lace inspired by Plauen lace (Melnikova, ref. 55, Fig. 15); PLA strips with warp-knitted fishing net and sunscreen net as inlays (Fig. 7); decorative forms printed on cotton, wool, viscose and polyester net (Fig. 8); printed connectors and buttons.

**Pattern implications.** Pattinson et al. is the most important primary source to retrieve next. As summarized here, it is printed flexible-mesh work that (1) switches crossing bonds off locally through toolpath timing and cooling, a second route alongside Li et al.'s arched sliding crossings (52), and (2) patterns auxetic cells regionally in a mesh. Both map onto FilaFabric's net constructions as bond-mask zones and regional cell swaps. The ankle brace's controlled non-linear response would map onto a strain-limit control, but its source is uncertain (see above). Treat all of these as leads until the primaries are read.

**Primary checked, 26 October 2026 (Paper 66).** Pattinson et al. confirms (1) and (2) and settles the ankle brace: it is Pattinson's §2.2, so the attribution to ref. 17 above is Sitotaw's citation error. Bonding is controlled two ways, by a nozzle lift at crossings and by a lateral gap between parallel strands, and only the second is quantified. The non-linear response comes from waves that straighten.

---

## Paper 57: Steinmetz-Ehrmann-2021 — Elastic 3D Printed Polymers on Textile Fabrics
**File Name:** `Steinmetz-Ehrmann-2021_Elastic-3D-Printed-Polymers-on-Textile-Fabrics.pdf`

### 1. Summary & Core Focus
Steinmetz and Ehrmann print TPU patterns onto woven and knitted fabrics and evaluate abrasion resistance, adhesion, and (for stretch fabrics) cyclic tensile behavior. Their results indicate that sufficiently close nozzle-to-fabric distance can improve mechanical interlocking and that printed patterns can improve surface wear resistance in tested combinations; effects depend on textile construction and pattern. This is an experimental print-on-fabric study, not free-standing printed textile research. It informs hybrid attachment and test selection, but does not establish FilaFabric's Foamy profile or free-standing path performance.

### 2. Mathematical & Structural Formulations
The authors compare TPU patterns printed on different woven and knitted fabrics. No single constitutive equation is proposed; the main variables are substrate construction, print pattern, nozzle-to-fabric distance, adhesion, abrasion exposure, and (for stretch fabrics) cyclic extension.

### 3. Relevance & Design Takeaways for FilaFabric
This is **direct experimental evidence for hybrid print-on-fabric validation**. It shows Z gap must be tuned for fabric thickness, surface morphology, and compliance; the same nominal polymer/pattern can yield very different abrasion retention. A FilaFabric fabric-backed workflow should record fabric type, Z distance, adhesion, abrasion, and retained stretch separately from free-standing path settings. This study does not calibrate MK3S/Filaflex Foamy and does not validate free-standing textile paths.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Steinmetz-Ehrmann-2021_Elastic-3D-Printed-Polymers-on-Textile-Fabrics.pdf`. **Class/status: M, direct textile-backed FDM patterns; N-like raised rails, not non-planar deposition.** Filaflex 82A Fibonacci spirals and parallel/opposed waves were printed onto four fabrics, using 0.1 mm layers and 1.5 mm line height/width (pp. 2–3). Curved lines extend geometrically before the polymer itself stretches. The nozzle-to-fabric gap is calibrated per substrate; changes around 0.1 mm strongly alter abrasion retention (pp. 3–5). Canvas loses printed lines, whereas tuned corduroy retains them through 10,000 Martindale cycles; elastic jersey cannot be assessed reliably with that abrasion setup (pp. 4–5). Cyclic tests show jersey with waves needs much greater force, while slightly elastic soft-shell changes little (pp. 6–7). A proposed sheet pattern uses serpentine reinforcement over a thin printed backing, controlling amplitude, wavelength, phase and density. That free-standing backing substitution is untested. Retained stretch, attachment and abrasion require separate assessment; wave geometry alone does not guarantee protection or comfort.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–5).**
- **Set-up:** Creality CR-10 V2, 0.4 mm nozzle, **Filaflex 82A** at 230 °C. The bed was left at room temperature so fabrics of different thickness would not see different surface temperatures. Layers were 0.1 mm, with each line 1.5 mm high and 1.5 mm wide.
- **Design rule, stated explicitly:** "all patterns were constructed **without linear parts** so that they could be extended on the elastic fabrics even without stretching of the polymer". The patterns were a Fibonacci spiral, parallel waves and opposite waves.
- **Z-distance procedure:** lower the nozzle until flow stops, then raise it to the lowest height that extrudes without interruption. Soft fabrics often allow printing slightly "below the surface"; dense fabrics need more gap.
- **Mounting:** fabric taped with parcel tape to bed-sized cardboard, then clipped to the bed, with elastic fabrics slightly pre-stretched.
- **Abrasion:** the parts of lines that survived longest were at the pattern edges, anchored outside the abrasion zone. Printed lines can also *increase* damage when the abrader catches them.

**Pattern implications.** The "no straight segments" rule is a concise design principle for any FilaFabric strand meant to stretch: make every path wavy or curved, so the sheet extends by straightening geometry before the material itself stretches. Squiggle, Coil and the wave modes already do this; straight crosshatch does not. The z-procedure and cardboard mounting are practical steps for a future print-on-fabric mode.

---

## Paper 58: Sterman-2026 — Opportunities and Challenges of Toolpath Based 3D Printed Textiles Insights from Digital Design and Craft Course
**File Name:** `Sterman-2026_Opportunities-and-Challenges-of-Toolpath-Based-3D-Printed-Textiles-Insights-from-Digital-Design-and-Craft-Course.pdf`

### 1. Summary & Core Focus
Sterman's 2026 paper analyzes five iterations of the Technion Digital Design and Craft graduate course, including 101 wearable/product projects made through code-driven toolpath manipulation. It documents a design-and-learning model in which students learn basic scripting/G-code, then use Rhino/Grasshopper components to turn curves into executable paths, preview travel, and control print settings. Project analysis covers product types, structures, materials, joining, and shaping. The examples range from orthogonal and curvilinear nets, lace, chainmail-like overlaps, variable-density zones, fringes, and auxetic protectors to wearable bags, hats, braces, footwear, and garments.

The paper supplies practice-based evidence about what designers actually do with programmable textile paths. TPU was used in 85% of projects and PLA in 22% (some projects used both); the authors note TPU's flexibility/drape but also its tendency to jam under high nozzle pressure, while PLA is easier to print but more rigid. Since desktop build areas constrain garment scale, students used mechanical connectors, interlocking flaps/notches, ironing or other thermal fusion, sewing, glue, overprinting, and printer/nozzle welding. Flat TPU panels were often folded or formed; PLA typically required heat shaping. Projects also exploited unintended outcomes such as a partial cross-layer print becoming fringes. More than 75% of products were not intended for direct skin contact, reflecting a gap between visual/material promise and tactile comfort.

The authors identify recurring limits: printed paths do not fully match the softness/tactility of conventional cloth, large products require segmentation and assembly, and flat sheets need secondary forming that introduces variability. This is a descriptive analysis of course projects, not a controlled mechanical study; it does not establish optimal settings or quantify strength/drape across designs. Its value is the breadth of design cases and concrete workflow/assembly lessons, alongside the warning that attractive textile-like appearance alone does not establish wear comfort or production readiness.

### 2. Mathematical & Structural Formulations
No formulation. The core construction is longitudinal lines in one layer and crossing lines in a later layer, fused where they meet. Variants deform the grid (sine), overlap circles, zone the density or leave the second layer partial.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **strong product/workflow reference for FilaFabric**, particularly its structure library, parameter controls, previews, export, and user learning materials. It supports treating print order, toolpath continuity, bed adhesion, layer bonding, assembly, and post-forming as part of a textile design workflow—not just shape generation. Its examples suggest useful guidance around TPU pressure/jamming, segmentation and joining, and differentiating skin-contact versus accessory applications. The paper's course outputs do not validate any particular FilaFabric preset or printer setting; they are precedent and user-practice evidence, not a performance benchmark.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Sterman-2026_Opportunities-and-Challenges-of-Toolpath-Based-3D-Printed-Textiles-Insights-from-Digital-Design-and-Craft-Course.pdf`. **Class/status: M, high-priority direct workflow/design precedent; S/N require case-specific translation.** Five course iterations produced 101 projects, using curves-to-G-code components with travel preview and print controls (pp. 3–4). The core flat network prints longitudinal paths and crossing paths in subsequent layers, fusing intersections. Documented variations include sine-deformed grids, overlapping circular nets, lace, graded bralette zones and partial cross-layers leaving flat-origin fringe strands (pp. 5–7/Figs. 2–7). The overlapping-circle vest is fused/pen-joined, not freely articulated SLS chain mail. Proposed FilaFabric M families are curvilinear grid, continuous ornamental lace over a sparse backing, and controlled partial-crossing fringe; expose wavelength, phase, spacing, fusion intersections, masks and panel connectors. Mechanical flaps, thermal welding and overprinted zigzag seams address bed-size constraints (pp. 6–8). This is descriptive project evidence, not controlled mechanics. Skin tactility, assembly labour and forming variability remain limits (p. 9). Upright examples in the appendix remain outside scope.

### 5. Second full-text pass — 24 October 2026

**Assembly methods counted** (Table 2, PDF p. 8):

| Method | Variants (number of projects) |
|---|---|
| Mechanical | flaps and notches 11, metal rings 5, pins 2 |
| Heat fusion | iron with backing paper 1, soldering iron 3, heated metal 1, printer nozzle 1 |
| Sewing | thread or wire winding 11, machine 6, hand 4 |
| Overlay deposition | printer 4, 3D pen 4, onto paper 1, onto fabric 3 |
| Glue | hot-melt 3, superglue 2 |

**Pattern ideas in the 101-project appendix** (pp. 10–19). These are one-line descriptions, unmeasured, but several are not yet in the catalogue:
- a **moiré** image (a hamster) made from overlapping grids on an apron;
- a hexagonal grid with **"shutter-like" graded hole sizes**;
- panels mixing overlapping circles with a **shear-based "expanding" pattern**;
- a **diamond grid** in straps "for even distribution of expansion force";
- a sock sleeve with holes following a **magnetic (field-line) grid**;
- a **twisted circular grid**;
- a **topographic-contour pattern** on a grid net;
- a grid inspired by **tatting lace**, with connector buttons pushed through its holes;
- a belt that closes by **interlocking arrays of printed loops**;
- a **kirigami bag**: a printed mesh with slits that opens into a bag when lifted;
- **circles that interlock with squares** as a mechanical connector;
- two-colour lace printed onto tulle;
- motifs from Arab embroidery;
- **mesh gloves** (project 72): a custom-fit glove of two layers welded together in one run. The print pauses after the bottom layer, a **separator** is placed, the top layer is printed, and the separator is removed. The source does not say where the layers stay apart; presumably wherever the separator lay, leaving room for the hand.

Other examples: the curvilinear collar is six identical sine-deformed grid pieces joined with an iron; the straw-weave hat is 11 PLA pieces superglued; the bralette's zones differ in density and are joined by **overprinted zigzag stitch lines**; the tote bag is built from four-flap flowers slotted into notched circles. TPU pieces were shaped with origami-style creases; PLA needed heat (hot-air gun, hot water or a hair iron).

**Pattern implications.** Candidates for the catalogue: (1) a moiré image on a grid net, as in the student apron (project 83) that shows a hamster in a moiré pattern (Manaia, 43, also mentions design software for moiré patterns); (2) graded aperture size across a hex net; (3) field-line and contour layouts, which match FilaFabric's Flow Lines and Conformal options; (4) flap-and-notch and loop-interlock edges as print-in mechanical seams; (5) a separator or release-layer pause to leave chosen regions unbonded (compare Loh & Pei's tape, 41); (6) zigzag overprint seams; (7) a slit (kirigami) mesh that opens into 3D when lifted.

---

## Paper 59: Sun-2017 — Daring to Sprint 3D Printing Textiles
**File Name:** `Sun-2017_Daring-to-Sprint-3D-Printing-Textiles.pdf`

### 1. Summary & Core Focus
Sun (2017) documents a design-research garment combining FDM-printed specialty nylon textile insets with compression knit. The nylon structures were modeled in Rhino as bias-oriented fabric-like panels to increase stretch/flexibility, then integrated into a sports-bra and compression-pant ensemble using conventional patternmaking and sewing; the printed material was dip-dyed for an ombre effect. This short proceedings paper presents a prototype and process reflection, not quantified stretch, recovery, comfort, durability, or wash testing. It is a garment-construction precedent, not evidence for FilaFabric mechanics or Filaflex Foamy calibration.

### 2. Mathematical & Structural Formulations
The garment uses bias-oriented, repeated printed nylon textile panels integrated as insets into compression-knit garments. The paper discusses design and construction choices but does not provide a formal constitutive model, standardized mechanical measurements, or a numerical stretch/recovery dataset.

### 3. Relevance & Design Takeaways for FilaFabric
This is **garment-integration context**, not a mechanical-performance benchmark. It shows how printed textile panels can be patterned, sewn, and combined with conventional stretch fabric; use it to discuss assembly and material zoning, not to claim FilaFabric's structures are wearable, comfortable, or mechanically equivalent.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Sun-2017_Daring-to-Sprint-3D-Printing-Textiles.pdf`. **Class/status: flat S/M-compatible garment-panel geometry; exact deposited layer count unreported.** This research-through-design prototype combines FDM specialty-nylon insets with compression knit in a sports-bra/pants ensemble (pp. 1–2). Rhino models use thin filaments arranged in a bias fabric structure; the text says layer-by-layer printing on a base platform, not upright pillar weaving (p. 2). Panels are dip-dyed and assembled through traditional draping, flat patternmaking and sewing. A concrete FilaFabric translation is a bias diamond net clipped to a panel silhouette, with bias angle, pitch, line width, reinforced sewing boundary and matched inset controls. This is a proposed reconstruction, since precise topology, path order, extrusion values and layer count are not documented. The garment establishes an integration/design precedent; it does not quantitatively establish stretch, elastic recovery, wash durability or comfort. Claims of supporting stressed/compression zones are qualitative observations, and the author calls for further physical testing (p. 2).

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 1–2).** Samples were judged on three criteria: flexibility over body contours, resilience and durability. The chosen bias structure was used as three insets on each side of the bra front, plus the back and the front and back of the pants. It was printed semi-translucent, then Rit-dyed grey and pink in an ombré. The author notes a learning curve in how printed nylon behaves under the sewing machine.

**Pattern implications.** Nothing beyond the existing proposal (a bias diamond net clipped to a panel with a sewing border). The three judging criteria make a simple first screen for FilaFabric panels before formal tests.

---

## Paper 60: Sun-2018 — Instilled 3D Printing Elastic Lace
**File Name:** `Sun-2018_Instilled-3D-Printing-Elastic-Lace.pdf`

### 1. Summary & Core Focus
Sun's research-through-design study develops a garment prototype integrating FDM-printed nylon lace with silk fabrics. Repeating organic motifs were modeled in Rhino, scaled and grouped to explore different elastic behavior, then shaped to garment pattern pieces. The printed lace forms a fitted waist/upper-hip and shoulder area, while silk charmeuse/habotai supplies the draped torso and skirt; the printed section was dyed with commercial Rit dye to coordinate the ombré palette. The author describes the lace as providing form fit and enabling omission of a conventional closure.

The paper is a design case study with reflexive documentation, not a quantitative mechanical or wear-comfort experiment. It provides no standardized stretch, recovery, wash, or durability measurements, and the author explicitly notes unresolved comfort and resilience challenges and calls for further study with other geometries/materials. The mention of “nylon” should not be read as evidence that the printed structure uses FilaFabric's flexible TPU settings.

### 2. Mathematical & Structural Formulations
Organic repeat units are modelled, scaled and grouped into a garment panel, with flat-pattern placement and post-print dyeing. The short design case study does not derive an effective elasticity tensor, asymptotic homogenization or directional Young modulus. Its elastic-performance language is design intent/observation rather than standardized mechanical data.


### 3. Relevance & Design Takeaways for FilaFabric
This is a **wearable design precedent** for integrating patterned printed lace with conventional fabrics and scaling repeated geometry to garment panels. It can inform FilaFabric examples or guidance on mixed-material garments, dyeing/post-processing, and how a printed zone might provide localized fit. It does not substantiate claims of comfort, elastic performance, closure replacement, or durability for FilaFabric patterns; the evidence is a single exploratory prototype without mechanical tests.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Sun-2018_Instilled-3D-Printing-Elastic-Lace.pdf`. **Class/status: high-priority flat patterned-lace design precedent, S/M compatible; single-layer count unverified.** The prototype combines FDM nylon lace with silk charmeuse/habotai. Repeated organic units are directly modelled in Rhino, grouped and scaled for different elastic behaviour, then clipped/customized to flat garment-pattern shapes (pp. 1–2). The printed portion fits waist, upper hip and shoulder; the photographic sheet on physical p. 3 shows the garment and lace zones. It is not upright stringing, independent mail or a homogenized mechanical experiment. Proposed FilaFabric S/M family: connected serpentine/organic lace with motif amplitude, repeat scale, connection neck, boundary silhouette and local-density controls; adding a separately printed sparse backing is a further M proposal, not the paper’s stated construction. The author reports omission of a closure in this prototype but also comfort/durability challenges (p. 2). No force–extension dataset, nozzle settings or tensor model is supplied. The introductory 200–300% statement concerns Peleg’s referenced work, not measurements of Sun’s garment.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 1–2).** There were four phases: engineered-print sampling, draping to flat patterns, Rhino modelling of repeat units, and Rit dyeing. Repeat units were **grouped in different arrangements and sampled for elastic performance** before the panel was scaled to the pattern piece. Silk is draped over the elastic lace at the back, and the torso is lined in silk habotai. Sun says Peleg's latest collections use an "open source pattern" (citing Peleg 2017, *The Birth of Venus*), modified in scale and repetition, and that a single unit can expand 200–300% when stretched slightly. Sun does not name the pattern's designer. Keefe (30) separately says Peleg's FilaFlex textiles were based on Andreas Bastian's mesostructures.

**Pattern implications.** The workflow suggests a FilaFabric "grouping sampler": print one motif in several arrangements (spacing, rotation, overlap) on a single test sheet before choosing one for a panel.

---

## Paper 61: Takahashi-Kim-2019 — 3D Printed Fabric Programmable Textiles
**File Name:** `Takahashi-Kim-2019_3D-Printed-Fabric-Programmable-Textiles.pdf`

### 1. Summary & Core Focus
Takahashi and Kim present a direct-G-code technique for making woven textile sheets on a consumer FDM printer. The print alternates vertical pillars (warp-like supports) with thin, nozzle-drawn strands (weft-like fibers); the strands brace the pillars so the structure can be built upright. A removable base anchors the textile during fabrication, and reinforced outer pillars secure each strand's ends. The authors built a Rhino/Grasshopper system that converts parameters and imported geometry into printer paths, including pillar/strand heights, nozzle detours, retraction, and Z movement to avoid collisions. They demonstrate curved sheets, binary-image patterns, two-colour prints, and conductive elements integrated into interactive objects.

The study provides unusually concrete process observations. With a 0.4 mm nozzle, the authors found about 0.8 mm pillar diameters could reach over 300 mm when stabilized by woven strands, with approximately 2.4 mm pillar spacing to allow nozzle passage. Fiber thickness depended on extrusion amount and speed; they report adding roughly 0.01–0.02 mm of filament per 1 mm fiber length and printing around 500 mm/min. Fibers were placed every two or three layers (0.4 or 0.6 mm vertical interval at 0.2 mm layers). Too little material or excessive speed caused breakage; excess material caused sagging. The samples were directionally compliant: flexible in the weft direction but liable to break under warp-direction bending; a hanging-load demonstration held about 3 kg and began to fail above 4 kg. The authors characterize the evaluation as preliminary, not standardized tensile testing.

Important limits are integral to the method: it depends on a stringing effect, so materials such as TPU and conductive filament were difficult to draw as fibers, though they could be used for pillars in multi-material builds. It also requires careful calibration and long print times (one approximately 260 mm-wide, 50 mm-high sample took about 9 hours). This is a distinct architecture from FilaFabric's continuous planar/non-planar FDM nets: its raised pillars and alternating weaving sequence cannot be treated as an interchangeable pattern preset without new path planning, clearance handling, anchoring, and material calibration.

### 2. Mathematical & Structural Formulations
No mechanics model. Geometry rules: pillar spacing about 2.4 mm for nozzle clearance; fibre zigzag amplitude 1.2 mm; one fibre every 2–3 layers (0.4–0.6 mm vertical pitch); extra extrusion of about 0.01–0.02 mm of filament per mm of fibre. Base and pillar material is computed from a standard extrusion-volume equation.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **highly relevant precedent for custom G-code, textile path planning, and collision-aware sequencing** in FilaFabric, especially potential pillar-weave or raised-fiber modes. It provides concrete examples of how strand spacing, vertical interval, extrusion, and path order jointly determine structure, and why supports/anchors and travel detours must be part of the textile design rather than post-processing. It also illustrates directional mechanical behaviour and material constraints that FilaFabric's printability checks should communicate. The method is not directly transferable to the current MK3S/Filaflex Foamy workflow: the paper uses PLA stringing, a different printer, much slower process conditions, and upright pillars. It should inform architectural options and test design, not be treated as validation of FilaFabric's current preset parameters.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Takahashi-Kim-2019_3D-Printed-Fabric-Programmable-Textiles.pdf`. **Class/status: excluded upright pillar/stringing architecture; methods transfer only to S/M/N software.** A removable base supports Z-axis pillars while nozzle-drawn XY fibres alternately pass around them; thicker end pillars anchor fibres. Printing order, different pillar heights, detours and Z hops make the upright weave possible (pp. 3–5). Reported pillar spacing, fibre feed and load demonstrations therefore do not describe a flat net, and flexible/conductive filaments are difficult to draw into fibres (pp. 4, 7). The transferable software sequence is parameterized geometry → sampled paths → collision-aware ordering → extrusion/travel preview and G-code. A proposed M pseudo-weave could use alternating curved traces with fused crossings and image-controlled density, but would deliberately have different topology and mechanics. Controls should describe planar pitch, width, layer order and local crossing masks, not transplant pillar heights or draw ratios. Pillar-weave and raised-fibre modes are outside the flat/shallow-sheet scope.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 3–5).**
- **Process numbers:**
  - Base: a rounded rectangle, two layers at 100%, printed at 1,000 mm/min.
  - Outermost anchor pillars: 3.0 × 6.0 mm rectangles.
  - Fibre zigzag: 1.2 mm amplitude from pillar centre, with the path divided every 1 mm.
  - Retraction 6.0 mm at 1,200 mm/min; PolyMax PLA printed at 185–195 °C instead of the recommended 190–230 °C, to reduce oozing. If fibres sag loose, lower the temperature.
  - Largest textile: about 280 × 300 mm.
- **Bonding is controllable:** print speed and wave amplitude (fibre-to-pillar distance) decide whether a fibre clings to the pillar or hangs free. Large amplitude lets the strand drape in mid-air, and the loose fibre still keeps its woven shape.
- **Patterns from the path alone:**
  - fine-tuning pillar spacing gives **moiré stripes**;
  - weaving past two pillars at a time gives shifted stripes;
  - passing in front of or behind pillars per row displays **binary images**;
  - swapping colour every few layers on a dual extruder gives stripes.
- **Collision avoidance:** detours, Z-hops, and holding the nozzle at the next object's height before moving.

**Pattern implications for bed-flat sheets.** (1) *Bond control by local speed or amplitude* is the same idea as Pattinson's cool-before-contact crossings (56). Bonding can be a mapped variable, not only a fixed outcome. (2) *Which-strand-on-top as an image* corresponds to driving FilaFabric's Weave draft cell by cell from a binary picture, a jacquard-style woven image. (3) This is the third source in the collection to name moiré (with Manaia, 43, and Sterman, 58), which supports adding it to the catalogue.

---

## Paper 62: Tian-2023 — Dual Faced Structured Fabric for Shape Adaptive Protection
**File Name:** `Tian-2023_Dual-Faced-Structured-Fabric-for-Shape-Adaptive-Protection.pdf`

### 1. Summary & Core Focus
Tian et al. design a dual-faced, chain-mail-like structured fabric for shape-adaptive protection by topologically interlocking 3D re-entrant unit cells. Unlike conventional cloth, its architecture combines energy-absorbing lattice cells with mobile contacts between neighboring cells; the top and bottom faces use different cell arrangements. The samples were made from PA12 by Multi Jet Fusion (MJF), not FDM. The authors report folding, draping, furling, and compression for storage, then evaluate compression, cyclic compression, and three-point bending, including tests under vacuum-confining pressure.

The key result is a tunable balance between load-bearing capacity and recovery. Without vacuum jamming, reported specific strength and specific energy absorption are 3790 N·m/kg and 866 J/kg; with 90 kPa confinement they rise to 5900 N·m/kg and 1530 J/kg. After 70% compression strain, recovery remains about 80% across tested pressures. Confinement and loading orientation also strongly affect bending response: the reported specific bending modulus increases by over 67-fold (about 0.27 to 18.1 MPa) when combining the top-face loading condition with 90 kPa confinement. Mechanistically, adjacent horizontal struts first interact, then intruding vertical struts contribute at higher compression; sliding and distortion of cells help avoid catastrophic failure and improve recovery. These quantitative outcomes depend on this PA12/MJF geometry, specimen, and vacuum fixture, not generic textile or filament properties.

The paper is a useful example of architecture-driven, anisotropic and tunable mechanics, but it targets protective structures rather than drapable apparel or low-force garment stretch. Its interlocking contacts, re-entrant units, and dual-face asymmetry are distinct from the continuous single-nozzle paths produced by FilaFabric. Applying its design would require a different fabrication strategy and likely a support/interlocking or assembly model; the reported vacuum-jamming mechanism is not a capability of the current website.

### 2. Mathematical & Structural Formulations
Each re-entrant cell is set by strut diameter $d$, edge length $a$ and re-entrant distance $m$. Strength and energy absorption are reported per unit mass, and the specific bending modulus comes from three-point bending. Vacuum confinement (0–90 kPa) is the controlled variable.

### 3. Relevance & Design Takeaways for FilaFabric
For FilaFabric, this is a **mechanical-design reference**, not a directly reusable weave or G-code recipe. It shows how changing unit-cell geometry, interlocking topology, face orientation, and confinement can tune bending stiffness, energy absorption, and recovery—useful context when describing the design space of structures such as Ring mail or auxetic/impact-resistant patterns. However, FilaFabric's current paths do not reproduce the MJF PA12 chain-mail contact topology, and it has no vacuum-jamming mechanism. Do not attribute the paper's numerical strength, energy absorption, or recovery values to FilaFabric patterns without fabrication and mechanical testing of the corresponding geometry and material.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Tian-2023_Dual-Faced-Structured-Fabric-for-Shape-Adaptive-Protection.pdf`. **Class/status: excluded independent interlocking 3D cells and confinement-dependent protection.** Re-entrant lattice cages interlock in a staggered arrangement with different upper/lower faces (p. 2). PA12 parts are made by HP Multi Jet Fusion, sandblasted, then placed in a 0.1 mm TPU envelope and vacuum-confined (p. 10). Compression, recovery and face-dependent three-point bending examine cage distortion, contacts and jamming; these are not fused filament-sheet mechanisms (pp. 2–7, 10–11). The transferable design question is whether a sheet’s two faces or a shallow relief pattern produce different bending responses. A proposed N experiment could compare asymmetric low ridges on a continuous backing, controlling ridge angle, height and pitch and testing both bend directions. That is a new architecture: it cannot inherit the paper’s strength, energy absorption or vacuum-stiffening results. Treat envelope pressure, independent-cell articulation and medical/protective application demonstrations as out of scope, not future FilaFabric presets.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 2–3).** Each re-entrant cell is set by strut diameter $d$, edge length $a$ and re-entrant distance $m$. Values too large make cell walls overlap; too small and the cells lose their re-entrant behaviour. Unconfined, the fabric folds, drapes and furls, and the furled roll compresses by a further 30%. Confined at 90 kPa it carries more than 25 times its own mass. The compression curve runs linear elastic → stiffening → yield → densification.

**Pattern implications.** None beyond the existing proposal: a shallow asymmetric relief tested in both bending directions. The overlap and collapse limits on $(d, a, m)$ are a reminder that any FilaFabric re-entrant control needs bounds at both ends.

---

## Paper 63: Wang-2021 — Structured Fabrics with Tunable Mechanical Properties
**File Name:** `Wang-2021_Structured-Fabrics-with-Tunable-Mechanical-Properties.pdf`

### 1. Summary & Core Focus
Wang et al. create two-layer structured fabrics from 3D particles arranged as chain mail, allowing sheets to bend and drape when unconfined and stiffen when boundary confinement causes particles to interlock and jam. In an airtight flexible envelope, applying about 93 kPa gauge pressure increased apparent bending modulus by more than 25-fold. Three-point bending experiments and discrete-element simulations connect particle contact mechanics with macroscale response; the structure is anisotropic and nonlinear. This pressure-jammed granular mechanism requires an envelope and pressure source, unlike continuous FDM strands. It is not evidence for FilaFabric's Ring mail preset or printed-net stiffness.

### 2. Mathematical & Structural Formulations
The study relates pressure-driven boundary confinement to particle contact/jamming and apparent bending modulus. Three-point bending gives an initial stiffness K used to calculate an apparent modulus, E* = K L^3/(4 b h^3), where L, b, and h are specimen dimensions. Discrete-element simulations interpret how contact networks and particle geometry produce the transition; the response is anisotropic and nonlinear.

### 3. Relevance & Design Takeaways for FilaFabric
This is a **mechanical analogy for geometry- and contact-dependent stiffness**, not direct support for FilaFabric's Ring mail or other printed patterns. Its >25-fold stiffening requires a two-layer granular structure inside an airtight envelope and applied pressure. FilaFabric can borrow the idea of communicating state-dependent behavior, but must not imply pressure-jamming capability or transfer the measured modulus.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Wang-2021_Structured-Fabrics-with-Tunable-Mechanical-Properties.pdf`. **Class/status: excluded SLS independent-link/jammed-particle fabric; analogy only.** Hollow 3D particles interlock within each chain-mail layer; two layers stack without being topologically linked through thickness, preserving sliding (p. 2). PA2200 nylon specimens are selectively laser sintered, enclosed in a flexible envelope and vacuum-confined (p. 7). Apparent bending modulus rises with pressure because contact networks jam, not because flat printed crossings change fusion (pp. 2–5). A limited proposed FilaFabric experiment is a fused loop-pattern sheet, controlling loop size, line width, contact clearance and layer placement; it must be labelled decorative/fused, with its own mechanics. The paper does not validate such a sheet. Its p. 2 Eq. (1), checked visually, is **E* = K L³/(4 b h³)**, with K the initial bending slope. The earlier notes placed four in the numerator, a factor-of-sixteen error; the formula above has been corrected. Avoid using this confinement-specific characterization as a universal textile formula.

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 1–3).** The particles are hollow truss **octahedra**. Their 90° rotational symmetry lets neighbours, each rotated 90°, interlock on a square lattice without any solid connection, and their sharp corners add contacts between layers. Two chain-mail layers are stacked but deliberately **not linked through the thickness**, so they slide and the fabric stays flexible. Simulated assemblies of the same octahedra without interlocking stiffened much less under the same confinement, so topological interlocking matters as well as particle shape.

**Pattern implications.** None for printed nets. The one transferable idea is that two **stacked layers left unlinked** can slide over each other, which Wang reports gives higher flexibility. Wang's comparison is with layers interlocked through the thickness, not with fused layers. That supports the separator, release-layer and bond-mask proposals noted under Loh & Pei (41), Sterman (58) and Pattinson via Sitotaw (56).

---

## Paper 64: Wu-2020 — PhD Dissertation_Computational Tools for 3D Printing and Woven Textile Design
**File Name:** `Wu-2020_PhD-Dissertation_Computational-Tools-for-3D-Printing-and-Woven-Textile-Design.pdf`

### 1. Summary & Core Focus
Wu’s dissertation combines distinct computational projects. Chapter 3 concerns collision-aware scheduling for a specialized **5DOF spatial wireframe printer**. Chapter 4, Weavecraft, represents actual multilayer yarn weaving. Chapter 5, WeavePrint, converts height fields into warp/weft instructions and Jacquard card images; the physical specimens use woven polyester yarn. These are valuable computational design sources, but do not demonstrate FDM-printed programmable textile sheets. Cite the relevant chapter/process rather than presenting the dissertation as one FDM fabric method.


### 2. Mathematical & Structural Formulations
Chapter 3 uses collision dependencies and ordered connected edge strips for spatial wireframe printing. Chapters 4–5 encode ordered warp/weft/empty stacks and height-field-to-weaving instructions. These are different representations and fabrication processes, not a single flat-FDM constitutive model or toolpath algorithm.


### 3. Relevance & Design Takeaways for FilaFabric
Transfer **layer-stack representations, path dependencies and fabrication-aware previews** to proposed S/M/N software. Physical weaving and 5DOF spatial extrusion are outside the requested fabrication scope. Any bed-based fused-sheet adaptation needs its own geometry, collision handling and validation; the woven relief and shoe examples cannot be presumed printable by a three-axis FDM machine.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Wu-2020_PhD-Dissertation_Computational-Tools-for-3D-Printing-and-Woven-Textile-Design.pdf`. **Class/status: computational methods only; no demonstrated S/M/N FDM textile process.** Chapter 3 develops **5DOF spatial wireframe** scheduling: collision constraints form a directed graph, redundant constraints are removed, and connected edge strips are ordered for smooth printing (physical pp. 35–38, 48, 52–56). This is specialized spatial extrusion, not flat programmable fabric. Chapter 4’s Weavecraft represents actual multilayer yarn weaving with ordered warp/weft/empty stacks and card images (pp. 65–66). Chapter 5’s WeavePrint converts height fields into warp/weft paths and Jacquard card images; specimens are woven polyester yarn, with warp-slope/trimming limits and relaxation errors (pp. 101–102, 115, 119–120). Proposed FilaFabric translation: a layer-stack viewer distinguishing fused crossings from visual over/under symbols, plus path dependencies and clearance checks for shallow sheets. These are software ideas requiring new adaptation. The dissertation is not evidence that its woven reliefs or shoe designs can be printed on a three-axis FDM machine.

### 5. Second full-text pass — 24 October 2026

**Added details.**
- **Chapter 3, collision ordering** (PDF pp. 38–41). A *collision graph* has one node per path segment and an arc A→B when printing A after B would hit B in some orientation. The scheduler keeps a subset of those constraints that is **acyclic** but still leaves every segment at least one safe orientation ("open" orientations, Eq. 3.1), built by "peeling" layers of safely printable segments. Unavoidable cycles are broken by splitting segments. Any order consistent with the result is collision-free, and the remaining freedom is used to chain segments into long smooth strips (305 sampled directions on a 5-axis machine).
- **Chapter 4, weave blocks** (pp. 65–72). A block is $\{r, c, h, t, p, A\}$: $A[i][j]$ is a *stack*, an ordered list of yarn symbols from top to bottom (`P` warp, `T` weft, `E` empty) at each crossing. The card image follows directly: a 1 where weft is above warp. Operations:
  - *tile*;
  - *attach*, which needs matching row or column counts;
  - **stencil**, where an index image picks, pixel by pixel, which block's stack to use. Blocks must have commensurate yarn counts: $\mathrm{repeat}(t_i, r_j) = \mathrm{repeat}(t_j, r_i)$;
  - **flip** one weft/warp pair (one pixel), with a validity check.
- **Weft wraparound:** a continuous weft turning mid-fabric, used for I-beams and closing shoe sides.

**Pattern implications.**
1. **Stack notation as a construction report.** For every crossing in a FilaFabric net, record the ordered stack (which family is on top, and fused or separated). That gives an exact, checkable description of an M/N construction, separate from the top-view picture, which the audit's construction-report proposal needs.
2. **Stenciling for regional constructions.** An index image could select the construction per region (for example plain-weave cells here, twill cells there, open net elsewhere). Blocks are compatible only when their repeats are commensurate, so FilaFabric would have to snap region pitches to common multiples, consistent with its whole-repeat rule.
3. **Ordering for N lifts.** For 3-axis bed printing the same graph idea applies with one orientation: a lower path must be printed **before** a nearby raised path that would otherwise block the nozzle body when the lower one is printed (Wu draws an arc A→B when printing A after B would hit B). *Corrected 26 October 2026: the earlier wording had the order reversed.* Cycles mean splitting a path.

---

## Paper 65: Yu-Rognoli-2026 — Bacterial Cellulose as Biofabricated Textile Material Biotinkering and Trajectories of Textile Materialisation
**File Name:** `Yu-Rognoli-2026_Bacterial-Cellulose-as-Biofabricated-Textile-Material-Biotinkering-and-Trajectories-of-Textile-Materialisation.pdf`

### 1. Summary & Core Focus
Yu and Rognoli analyze 16 bacterial-cellulose design cases through a Material-Driven Design lens, identifying six textile-materialization trajectories: sheet, fibre, filament, yarn, biocomposite textile, and coating. Fourteen external cases provide comparative context, while two hands-on research-through-design experiments examine BC as a binder for textile waste and a BC-alginate extrusion system for filaments. The authors argue that BC's textile potential depends on cultivation, processing, assembly, and surface treatment, rather than a single leather-like sheet form. These exploratory studies do not establish production-scale consistency, garment durability, or equivalence to thermoplastic FDM filament. This is adjacent biofabrication context, not evidence for FilaFabric's extrusion workflow or material claims.

### 2. Mathematical & Structural Formulations
No formulation. The structure is a qualitative typology of six materialization trajectories (sheet, fibre, filament, yarn, biocomposite textile, coating). Each case is assigned to the one trajectory that best describes how bacterial cellulose becomes a textile.

### 3. Relevance & Design Takeaways for FilaFabric
Indirect: the paper argues that state changes during processing (here wet to dry) are design information that should be documented. For FilaFabric, the parallel is recording how a printed sheet changes after release, conditioning and washing. It does not validate FilaFabric's geometries, settings or materials.

### 4. Flat-sheet source review — 23 October 2026

**File:** `Yu-Rognoli-2026_Bacterial-Cellulose-as-Biofabricated-Textile-Material-Biotinkering-and-Trajectories-of-Textile-Materialisation.pdf`. **Class/status: adjacent material/process research; no demonstrated thermoplastic S/M/N printing pattern.** Sixteen selected cases comprise fourteen documented external cases and two author experiments, analysed as sheet, fibre, filament, yarn, biocomposite and coating routes (pp. 5–10). In E1, wet bacterial cellulose binds wool waste but drying produces stiffening, curling, cracking and delamination. E2 syringe-extrudes BC/alginate/denim into calcium-chloride solution; wet strands form, yet drying introduces breakage (pp. 6–7). “Filament” therefore does not mean a stable feedstock for FDM. The useful translation is a swatch protocol recording state changes and attachment through production. A proposed M experiment could compare the same open printed mesh with and without a backing/coating, controlling opening size and support density; that is a new experiment, not BC printability evidence. Material state, dimensional stability and durability require explicit assessment, and the classification is qualitative rather than an industrial performance validation (p. 14).

### 5. Second full-text pass — 24 October 2026

**Added details (PDF pp. 6–10).** Of 53 cases first identified, 14 external cases were analysed alongside the two author experiments. E2 extruded a bacterial cellulose/alginate blend into a 10% w/v calcium chloride bath. Both experiments showed that drying, not forming, decides whether continuity survives: stiffening, curling, cracking, delamination and shrinkage appeared only on drying.

**Pattern implications.** None. A reminder that FilaFabric swatch records should include post-release changes such as shrinkage, curl and stiffening after conditioning, not just the as-printed state.

---

## Paper 66: Pattinson-2019 — Biomechanically Tailored Meshes for Compliant Wearable and Implantable Devices
**File Name:** `Pattinson-2019_Biomechanically-Tailored-Meshes-for-Compliant-Wearable-and-Implantable-Devices.pdf`

Retrieved 26 October 2026: the authors' accepted manuscript with its Supporting Information text (36 pages), from the University of Cambridge repository (handle 1810/292316). Published version: *Adv. Funct. Mater.* 2019, 29(32), 1901815, DOI 10.1002/adfm.201901815. Page locators refer to this manuscript, not the journal pagination. The repository's two supporting videos were downloaded but are kept outside this folder.

The published version is also held, as `Pattinson-2019_Biomechanically-Tailored-Meshes-for-Compliant-Wearable-and-Implantable-Devices_Published.pdf` (10 pages, without the Supporting Information; obtained by the user through institutional access). Every number used below matches it. Journal page equivalents ("n of 10"):

| Content | Manuscript | Published |
|---|---|---|
| raster order | p. 5 | p. 3 |
| bonding of parallel elements | p. 7 | p. 4 |
| cycling | pp. 7–8 | p. 4 |
| muscle match | p. 8 | p. 5 |
| ankle brace | pp. 8–10 | pp. 5–6 |
| steel reinforcement | pp. 10–12 | pp. 5–7 |
| lifted crossings | p. 13 | p. 7 |
| Experimental Section | pp. 14–15 | p. 9 |
| Fig. 2 | p. 22 | p. 3 |
| Fig. 4 | p. 24 | p. 6 |
| Fig. 6 | p. 27 | p. 8 |

### 1. Summary & Core Focus
Pattinson et al. (MIT) print flexible meshes by extruding thermoplastic polyurethane (NinjaFlex) along explicitly programmed, continuous toolpaths, one or a few layers thick, to make wearable and implantable supports whose tensile response mimics soft tissue. A mesh is an array of cells built from orthogonal elements. Each element carries waves that straighten under load, so it starts soft and stiffens sharply once taut. Low-strain stiffness is tuned by printing neighbouring parallel elements touching (welded) or with a small gap. A printed unit cell matched rat-muscle tensile data in two directions, and a mesh strip in an ankle brace raised inversion stiffness by 78.69% on average in four subjects while barely changing other directions. Stainless-steel thread sandwiched between two elastomer layers adds a stiff high-strain regime. A closing section demonstrates, with one cantilever comparison as its only measurement, crossings left unbonded by lifting the nozzle, a region of negative-Poisson cells, and a mesh printed over a taped 3D template and sewn into a glove.

### 2. Mathematical & Structural Formulations
**Single wavy element** (pp. 5–7, Eqs. 1–4; SI pp. 29–31, Eqs. S1–S8; checked against the typeset pages). An element of projected length $l_e$ contains two waves of height $h_w$ and width $l_w$. Its extension is the sum of fibre stretching and wave straightening:
- stretching, Mooney–Rivlin: $F_e/(A_e C_1) = \left(1 + \frac{\mu_2}{\mu_1}\frac{1}{\lambda_{e,s}}\right)\left(\lambda_{e,s} - \lambda_{e,s}^{-2}\right)$, with $\delta_{e,s} = l_e(\lambda_{e,s}-1)$;
- straightening: $\delta_{e,b} = 4\sqrt{h_w^2 + (l_w/2)^2}\,\left[\cos\theta - \cos\left(\operatorname{atan}(2h_w/l_w)\right)\right]$, where $dF_e\sqrt{h_w^2+(l_w/2)^2}\,\sin\theta \cong -K'\,d\theta$ for a constant wave bending stiffness $K'$.

The typeset Eq. 1 writes the prefactor as $C_1$, while the text and Table S1 name the constants $\mu_1$ and $\mu_2$. Table S1 model inputs (p. 31): μ1 = 0.1 MPa, μ2 = 0.54 MPa, K′ = 0.1 N·mm, $l_e$ = 24 mm, $A_e$ = 0.79 mm² (a 1.0 mm round fibre), $l_w$ = 2.5 mm. These are inputs to the single-element model, not the printed mesh dimensions. Mesh-level responses are measured, not derived. Bending gives way to stretching at a stiffness peak, whose strain moves with wave height (Fig. 2B–F, p. 22).

### 3. Relevance & Design Takeaways for FilaFabric
The most directly relevant primary in the collection for **M9 bond masks** and for **strain-limiting nets**: flat, bed-printed TPU meshes on continuous toolpaths, wave-controlled stiffening, and two demonstrated bond controls (a lateral gap between parallel strands, and a nozzle lift at crossings). It does not report the lift height, speed, layer height or nozzle size used, and its printer (Printrbot Simple Metal) and NinjaFlex grade differ from FilaFabric's MK3S profiles. All values describe the authors' specimens.

### 4. Flat-sheet source review — 26 October 2026

**Evidence:** pp. 2–16 (text and Experimental Section), Figs. 1–6 (pp. 21–27), SI pp. 29–35. **Status:** S/M, direct flat FDM TPU meshes. The crossing lift is a local N move. The glove mesh printed over a 3D support is outside the shallow-sheet brief.

**Toolpaths.** Custom Python turns an array of unit cells plus rate and temperature into G-code, sent through Repetier-Host (p. 15). Uniform-thickness meshes are printed as a raster, all horizontal lines and then all vertical lines (p. 5). Locally thicker fibres use the Dreifus et al. graph-based planner, which passes the extruder over a section a programmed number of times with few discontinuities. The authors keep toolpaths continuous because interruptions create defects (p. 5).

| Result (authors' specimens) | Value | Locator |
|---|---|---|
| Wavy element, transition strain | tuned by wave height to above 40% | p. 7, Fig. 2E–F |
| 5 parallel wavy elements, all gapped | 20 N/m up to 10% strain, maximum 207 N/m at 40% | p. 7, Fig. 2G–H |
| 3 central elements bonded | 53 N/m at 10%, rising to 150 N/m at 40% | p. 7 |
| all 5 bonded | about 110 N/m, roughly constant | p. 7 |
| Cyclic loading | no perceptible change over 1800 cycles to 32% (Fig. S1 caption: 1835) | pp. 7, 32 |
| Muscle-matched cell | across: 685 kPa constant; along: 111 kPa to 10%, 453 kPa beyond 20%; 0.05%/min | p. 8, Fig. 3A–B |
| Unit-cell stiffness range | 0.5 N/m to 20 kN/m, steel-reinforced cells included | p. 8, Fig. 3C |
| Ankle brace, 4 subjects | inversion +78.69%, eversion +14.27%, dorsiflexion −1.59%, plantarflexion −1.40%; similar torque to about 1.5°, about 50% higher at 15° | p. 10, Fig. 4, Fig. S4 |
| Steel-reinforced cell | 180 N/m at small strain, 7.3 kN/m once the thread is taut | p. 12, Fig. 5E |
| All-elastomer unit cell | broke at 2.4 N | p. 10, Fig. S2a |
| Lifted (unbonded) crossings | about 230% more cantilever deflection than the bonded twin; drapes over a golf ball, the bonded one does not | p. 13, Fig. 6a |

Testing used an Instron 1125 with a 100 N load cell at 5 mm/min; flexure was measured by hanging a mass and recording deflection (p. 15). **Proposed translation:** a wave-segment option for straight nets (S2), an in-plane bond mask by strand spacing (M9), and lifted crossings (M9/N1). Each needs FilaFabric's own calibration because the paper does not give the process values.

### 5. Full-text pass — 26 October 2026

**What the primary changes in the second-hand leads.**
- **Bond modulation (via Sitotaw, 56):** confirmed, but there are **two** controls. At crossings (p. 13, Fig. 6a) the nozzle is lifted "as it passes over filament in the mesh", so the new filament cools before it touches the earlier, orthogonal one. The authors treat this slip as undesirable where in-plane stress must be controlled, and useful locally for conformability. Between parallel elements (p. 7, Fig. 2G–H), printing in contact welds them into one thicker element, and a small lateral gap keeps them apart. Only the parallel-element control is quantified.
- The Fig. 6a swatches look like closely spaced parallel lines (a dense sheet) rather than an open mesh, and the cantilever result is one pair of specimens. No lift height, speed or temperature is given for it.
- **Ankle brace:** the brace with a controlled non-linear response **is this paper's** (§2.2, pp. 8–10). Sitotaw's citation of it to ref. 17 (Uysal & Stubbs) is therefore a citation error, unless that paper has a brace of its own. The MIT News item cited by Kabir 2025 (27) reports this paper.
- **Strain limiting:** produced by waves that straighten, inspired by collagen. The paper calls the response non-linear and does not use the word "strain-limiting".
- **Auxetic region** (Fig. 6b, p. 27): a mesh with a patch of negative-Poisson cells, shown on a knee and bulging out of plane when stretched by hand (video). No cell geometry or measurement is reported.
- **Layer-level release:** the brace's wavy component is layered without bonding, so it buckles in compression and does not stiffen eversion (p. 9).
- **Template release:** the glove's knuckle templates were covered with tape so the mesh would not stick (p. 13).

**Process facts given:** Printrbot Simple Metal; NinjaFlex; thermoplastic extrusion at about 210 °C (stated in the steel-thread paragraph, p. 11). For reinforcement, 0.4 mm three-ply 316L stainless-steel thread runs through a second, unheated tapered Nordson nozzle. Double-sided tape on the bed holds it, and it is sandwiched between an elastomer layer printed with gaps and an identical second layer (pp. 11, 14–15). **Not given:** nozzle diameter, layer height, speeds, cooling, the printed meshes' wave dimensions, or the crossing lift height.

**Pattern implications.** Proposals, untested on Foamy or NinjaFlex 85A:
1. **Wave segments for strain limiting (S2):** replace each straight segment between crossings with one or two trapezoidal waves. Wave height sets the strain at which the strand goes taut. Report low- and high-strain stiffness separately.
2. **Lateral bond mask (M9, no Z move):** the cheapest bond control. Space neighbouring parallel strands at contact where they should weld and with a gap elsewhere. Pattinson's gapped five-strand unit was about five times softer at low strain than the bonded one.
3. **Lifted crossing (M9/N1):** a per-crossing nozzle lift so the upper strand lands after cooling. FilaFabric must find the height and speed; soft TPU may still stick, so verify that the crossings actually move.
4. **Unbonded layer for one-sided stiffening:** a layer left unbonded from the one below buckles instead of resisting compression.

---

## Paper 67: Li-2022 — Programmable Digital Weaves
**File Name:** `Li-2022_Programmable-Digital-Weaves.pdf`

Retrieved 26 October 2026: the authors' accepted version (6 pages) from the ETH Zurich Computational Robotics Lab website. Published version: Li, Montes, Thomaszewski and Coros, *IEEE Robotics and Automation Letters* 7(2):2891–2896, 2022, DOI 10.1109/LRA.2022.3145948 (Sapkota's ref. 196). The folder `Li-2022_Programmable-Digital-Weaves_GCode/` holds four G-code files from the authors' MIT-licensed repository (github.com/liyuesolo/ProgrammableDigitalWeaves, last updated November 2023): FusedGrid, SlidingGrid, CircleFused and CircleSliding. They are git-ignored like other G-code.

The published IEEE version is also held, as `Li-2022_Programmable-Digital-Weaves_Published.pdf` (pp. 2891–2896; obtained by the user through institutional access). Its print settings and results match the preprint. The layout shifts slightly: the print settings fall on p. 3 (2893), and Figs. 6–8 and the actuation section on p. 5 (2895). Locators below follow the preprint.

### 1. Summary & Core Focus
Li et al. (ETH Zurich) print planar PLA grids in which chosen crossings **slide** instead of fusing. A sliding connection is made in three steps: print one strand flat, print the crossing strand with the head lifted so the two barely adhere, then print a small arc-shaped **channel** fused to the lower strand that encloses the crossing strand without bonding to it. The channel lets that strand slide along its own length while stopping the two from separating. All prototypes were printed in PLA on a Prusa i3 MK3S, the printer model FilaFabric targets. Assigning fused or sliding connections in small unit cells gives responses from quasi-isotropic to highly anisotropic and strongly non-linear, and one sliding strand embedded in a fused structure deploys it from flat to parabolic. A rod simulation with sliding nodes predicts the behaviour. Physical prototypes are compared with simulations only qualitatively; no measured stiffness values are reported.

### 2. Mathematical & Structural Formulations
**Simulation** (p. 3, §III-B): discrete elastic rods (stretch, bend, twist). Each crossing is one node $x_i$ with an Eulerian degree of freedom $u_i^j$ for every strand $j$ that slides through it; fused crossings carry extra rigid rotational degrees of freedom $\omega_k$. Energy $E_{rods} = E_{stretch} + E_{bend} + E_{twist} + E_{rigid} + E_{contact} + E_{reg}$, where $E_{reg}$ is a small $l^2$ penalty that stands in for friction. Equilibrium solves $\min_q E_{rod}(q)$ subject to $Dq = q^*$ (Eq. 1) by Newton's method. Curved rest shapes are $C^2$ interpolating splines.

**Homogenization** (p. 4, Eq. 2): directional modulus $E = d^\top\sigma_{macro}d \,/\, d^\top\epsilon_{macro}d$ and Poisson's ratio $\nu = n^\top\epsilon_{macro}n \,/\, d^\top\epsilon_{macro}d$, sampled over 200 directions from 0 to 180° on periodic unit cells. As typeset, ν has no leading minus sign. Checked against the typeset page.

### 3. Relevance & Design Takeaways for FilaFabric
The only primary in the collection that demonstrates **mobile crossings in a bed-printed planar grid**. It is printed on FilaFabric's target printer model, but in PLA at a deliberately low 180 °C with the part fan off. It corrects the second-hand lead (see §5): the sliding crossing needs a captive channel as well as a lifted strand. Its directional, non-linear responses come from simulation and qualitative tests, and nothing here validates TPU.

### 4. Flat-sheet source review — 26 October 2026

**Evidence:** p. 2 §III-A and Fig. 1; p. 3 Fig. 2; pp. 4–6 §IV and Figs. 3–9; repository G-code. **Status:** M with an N crossing treatment; direct bed-flat fabrication in PLA; untested in TPU.

**Manufacturing as stated in the text** (p. 2): Prusa i3 MK3S, PLA, nozzle 180 °C, bed 60 °C, 0.4 mm nozzle, 1.75 mm filament (printed as "filament radius"), strand width 0.5 mm. Speed 600 mm/min by default and 300 mm/min for channels. A channel is a triangle path whose base is centred on the crossing node; its second half is 20% longer than the first, so sag does not touch the sliding strand. Channel height is twice the strand width, 1.0 mm. A 20 × 20-strand, 8 × 8 cm patch takes about 40 minutes, with all channels oriented the same way so the other direction is free to slide (Fig. 1).

**Results.**
- **Regular grid** (Fig. 3, p. 4): under diagonal shear the all-fused grid buckles out of plane, while the all-sliding grid shears in-plane by rotation and sliding. Along the strand directions, stiffness is the same whether crossings are fused or sliding.
- **2 × 2 regular cell** (Fig. 4, p. 4): simulated diagonal stiffness falls 20.17 → 7.29 → 5.37 → 2.79 → 0 as more crossings slide (units printed as N²/m²).
- **Interlacing squares** (Figs. 5–7, pp. 4–5): Type 1, all fused, is quasi-isotropic and relatively stiff. Type 2, all channels sliding horizontally, has zero horizontal stiffness until the squares reach their sliding limit, then finite stiffness (compared at 10% and 30% strain). Type 3 alternates channel directions and is orthotropic. Type 4 is Type 3 with two crossings fused, and is highly anisotropic.
- **Interlacing circles** (Fig. 8, p. 5): each circle overlaps its four neighbours "by 10% of its radius (0.8 cm)", which leaves unclear whether 0.8 cm is the radius or the overlap; eight crossings per circle. All-fused is orthotropic, all-sliding highly anisotropic, and the sliding circles distort into ellipses.
- **Actuation** (Fig. 9, p. 6): one actuation strand fused at its tip to the outer circle and sliding at every other crossing, with all other connections fused, gives a planar-to-parabolic deployment. The text says the force is compressive; the caption says pulling.
- **Limitations** (p. 6): crossings of more than two strands are not handled, friction is not modelled accurately, and the extra channel material biases stiffness upward. Bending stiffness with sliding connections was not studied systematically. The authors note that sliding connections let a flat patch deploy to non-zero Gaussian curvature with little resistance, while all-fused ones oppose it, and leave this to future work.

### 5. Full-text pass and G-code — 26 October 2026

**Corrections to Sapkota (52).**
- The arc-shaped channel is a **third printed element**, fused to the lower strand and enclosing the crossing strand. The crossing strand itself is laid with the head raised so that it barely adheres. Sapkota merges these into one arched strand, which would leave the crossing free to separate.
- Sliding is **one-directional**: the captive strand slides along its own length, in the direction set by the channel's orientation.
- "All-sliding grids deployed easily from flat to parabolic": the parabolic deployment (Fig. 9) is a mostly fused structure with one sliding actuation strand. Easy deployment to doubly curved shapes appears in the conclusion as an observation for future study.
- "All-fused grids were quasi-isotropic": true of the interlacing-squares Type 1. The all-fused circles were orthotropic.

**Repository G-code.** It may not match the printed prototypes exactly. Both grids print 20 strands per family at 4 mm pitch, 128 mm long (24 mm ends, 80 mm field):

| | FusedGrid | SlidingGrid |
|---|---|---|
| First family (along X) | nozzle Z 0.5 mm; ends at 600 mm/min, centre at 1200 mm/min | same |
| Second family (along Y) | as first, also at Z 0.5: the nozzle crosses the first family at the same height | 12 mm bed anchor at Z 0.2 (200 mm/min), 12 mm ramp up to Z 1.5 (400), **one 80 mm span at Z 1.5 over the whole field** (600), mirrored ramp down |
| Crossing treatment | none | one channel per crossing (400): plunge to Z 0.5 on the lower strand 1.20 mm before the crossing, rise to Z 2.5 directly above it (100 mm/min), descend to Z 0.5 1.68 mm after it (200 mm/min) |
| Final frame | 80 × 80 mm rectangle at Z 0.5, 1500 mm/min | same rectangle at Z 0.75 |
| Temperature, fan | 180 / 60 °C; fan never switched on | same |

Extrusion per millimetre of path is 0.0775 mm of filament for the lower strands (about 0.19 mm², a roughly 0.5 mm round bead), about 0.042 mm for the raised span (55%) and about 0.036 mm for the channels (47%). **Differences from the paper text:** the channel's second leg is 40% longer (1.68 versus 1.20 mm), not 20%; channel speeds are 100/200 mm/min, not 300; and the field strands run at 1200 mm/min, not 600. The channel apex at nozzle Z 2.5 is 1.0 mm above the sliding span's nozzle Z 1.5, which matches the stated 1.0 mm channel height if that is measured from the sliding strand. The paper does not mention the final frame, and its role is not stated. The circle files begin with solid grip tabs of lines 0.5 mm apart.

**Pattern implications.** Proposals; PLA results do not transfer to TPU without tests.
1. **A sliding crossing has two parts:** a raised second family, here one span about 1.0 mm above the lower family's nozzle height with bed anchors at both ends, and a **captive channel** at each crossing. A lift alone, without the channel, leaves the families joined only at their ends and the frame.
2. **A three-state crossing mask:** each crossing is fused, channel-X or channel-Y. The channel direction chooses which strand slides, which is how Types 1–4 program anisotropy and non-linearity. This maps onto an M9 mask image with three values.
3. **Matched control:** FusedGrid, with both families at the same nozzle height, is the fused twin. Compare the two in shear and drape, not only along the strands, where the paper found no difference.
4. **TPU risks:** the low 180 °C and absent fan cooling reduce PLA adhesion, but TPU bonds and strings far more readily. The channel apex at nozzle Z 2.5 mm also makes the relief roughly 2–2.5 mm tall, more than a shallow N texture. Start with a few large crossings at the paper's 4 mm pitch before shrinking anything.

---

## Paper 68: Spahiu-2020 — 3D Printing for Clothing Production
**File Name:** `Spahiu-2020_3D-Printing-for-Clothing-Production.pdf`

Retrieved 26 October 2026: the publisher's open-access PDF (CC BY 4.0, 8 pages). Spahiu, Canaj and Shehi, *Journal of Engineered Fibers and Fabrics* 15, 2020, DOI 10.1177/1558925020948216. Cited in Brad (5, ref. 4), Jayswal-Adanur (23, ref. 127), Manaia (43) and Sapkota (52, ref. 197).

### 1. Summary & Core Focus
Spahiu, Canaj and Shehi design several open geometries in Tinkercad, print them on an Orcabot XXL FDM printer in rigid to flexible filaments, and choose a re-entrant **arrowhead** auxetic panel in FilaFlex (Shore A82) for a dress. The dress, size 36 and patterned in CLO 3D, needed 33 panels of 130 × 130 mm and about 75 h of printing. The panels were joined with a 3D pen, and belts were added at both sides for dressing. An online survey of 100 respondents, mostly aged 18–35, found that 79 would wear a 3D-printed garment. The panel's auxetic behaviour is shown only by hand stretching in clamps. There is no tensile, drape or Poisson measurement.

### 2. Mathematical & Structural Formulations
None. The geometry is a single arrowhead (negative Poisson's ratio, citing Larsen et al. 1997) duplicated in rows and columns in Tinkercad (pp. 3–4). The CAD screenshot shows **4 columns × 8 rows** of hollow arrowheads filling the 130 × 130 mm panel (Fig. 4, p. 4, counted from the figure). The text gives no cell, strut or hinge dimensions. Table 1 (p. 2, checked on the typeset page) lists the process parameters below.

### 3. Relevance & Design Takeaways for FilaFabric
Same material family as FilaFabric's Foamy profile (Recreus FilaFlex, but the 82A grade, not the foaming one) and a precedent for the Auxetic Mesh at garment scale. It is a design case study with no mechanical data. Its panel is a 1.8 mm-thick, nine-layer solid-wall lattice, far thicker than FilaFabric's thin nets, and its settings were for an Orcabot XXL, not an MK3S.

### 4. Flat-sheet source review — 26 October 2026

**Evidence:** pp. 2–6, Table 1, Figs. 3–9. **Status:** S4-related flat lattice, printed lying on the bed; a design and assembly precedent, not a mechanical one.

**Table 1, "parameters used for main geometry production"** (p. 2): nozzle 0.4 mm, nozzle 245 °C, bed 65 °C, speed 50 mm/s, layer 0.2 mm, 9 layers, geometry height 1.8 mm, 2 h 16 min per 130 × 130 mm structure, filament 1.75 mm. The table does not name the material. The text says parameters were chosen per material and that FilaFlex was used for most prints (p. 3). Slicing was in Repetier-Host V1.0.6.

**Materials compared** (p. 3): PLA (Filament World), soft PLA (German RepRap), nylon (Taulman), FilaFlex (Recreus) and NinjaFlex (NinjaTek). The arrowhead in FilaFlex was chosen after weighing appearance, flexibility, and failures caused by material viscosity during printing (p. 3). The nude colour was chosen visually from four (Fig. 5, p. 4). Fig. 3 (p. 4) shows the other trial geometries, including triangulated grids, interlocking curved cells, circles and ring chains.

**Assembly** (pp. 4–6): joining was hard "due to the small contacting areas between the single structures" (p. 4). A Dikale 07A 3D pen joined the panels (Fig. 7, p. 5). Fig. 9 (p. 6) shows (a) the parts needle-stitched onto a mannequin, (b) the whole dress joined by 3D pen, and (c) the finished dress with belts at both sides for dressing and undressing.

**Survey** (pp. 3, 5–6): 100 respondents, seven closed questions, 30 August to 5 September 2019. 89 had heard of 3D printing, 63 knew of its use in fashion, 79 would wear a 3D-printed garment and 88 thought it would benefit garment production. The 21 who would not cited materials less flexible and comfortable than conventional textiles.

**Proposed translation:** an arrowhead panel preset with whole-cell edges and joining tabs, compared with the existing Auxetic Mesh at FilaFabric's thinner strand heights. The paper offers no settings or mechanics to transfer.

### 5. Full-text pass — 26 October 2026

**Settling the secondary descriptions.**
- **Joining:** Brad (5) captions stitches and belts, while Jayswal-Adanur (23) and Sapkota (52) say 3D pen. Both are partly right. The dress was joined by 3D pen, the needle-stitched version is a mannequin trial assembly, and the belts are dressing aids.
- **Materials:** five filaments were tried (above). Sapkota's "PLA, nylon, TPU and FilaFlex" folds soft PLA and NinjaFlex into general labels.
- **Shape and grade:** arrowhead, FilaFlex Shore A82 and 130 × 130 mm are confirmed (23, 43).
- **Process:** Table 1's 245 °C and 50 mm/s are hotter and faster than the TPU settings collected elsewhere in this review. Because the table does not name the material, treat them as the authors' main-geometry settings, not a confirmed FilaFlex recipe.

**Pattern implications.** (1) Small contact areas between panel edges made joining difficult. Panel presets meant for assembly need wider edge rails or overlap tabs (compare Ariel & Sterman, 1). (2) The panel stays a fixed 130 × 130 mm tile, and the garment is tiled from 33 of them. A tile-and-join workflow suits FilaFabric's bed-sized swatches, but panel seams then fall wherever the tile grid does, not where the pattern pieces want them.

---

## Paper 69: Lu-2022 — Modeling and Characterization of 3D Printed Flexible Mesh Structure for Wearable Interface
**File Name:** `Lu-2022_Modeling-and-Characterization-of-3D-Printed-Flexible-Mesh-Structure-for-Wearable-Interface.pdf`

Retrieved 26 October 2026 by the user through institutional IEEE Xplore access (publisher version, 8 pages). Lu, Fu, Hosseini and Park, *2022 9th IEEE RAS/EMBS International Conference for Biomedical Robotics and Biomechatronics (BioRob)*, DOI 10.1109/BioRob52689.2022.9925405. Cited in Brad (5, ref. 10).

### 1. Summary & Core Focus
Lu et al. (University of Connecticut and University of Central Florida) print NinjaFlex TPU meshes as stacks of parallel-strand layers, each rotated by a fixed angle from the one below, and tensile-test them. Four parameters are varied: strand thickness T (0.4–0.6 mm), the gap between neighbouring strands D (0.2–1.2 mm), the layer-to-layer rotation θ (30–90°) and the layer height H (0.1–0.3 mm). The outputs are strength, elongation at break and Young's modulus. Thirty configurations, five specimens each, were printed as 1.8 mm-thick ASTM D412 dog-bones and pulled to break at 500 mm/min. Wider strands and smaller gaps made the mesh stronger, stiffer and more extensible. Thicker layers (fewer of them at the same total thickness) stretched furthest, and rotation angle changed strength by only about 11%. Linear regressions on H, T and D are fitted for the 90° meshes. A wearable mesh in the most extensible configuration is shown bending and twisting, qualitatively.

### 2. Mathematical & Structural Formulations
**Linear regression** (p. 6, typeset equations and Table V), fitted to the 90° meshes only, with H, T and D in mm. Rotation angle is not a term.
- Tensile strength (MPa) = 4.38 H + 7.56 T − 3.58 D + 1.147
- Elongation at break (%) = 743.20 H + 592.38 T − 73.20 D + 35.74
- Young's modulus (MPa) = 1.85 H + 4.52 T − 3.59 D + 2.68

Table VI reports R² of 82.11, 59.26 and 60.30 (%), RMSE of 0.464 MPa, 49.874 (labelled "mm"; elongation is in %) and 0.766 MPa, and relative errors of 11.99, 11.01 and 29.72.

**Internal inconsistencies, checked on the typeset pages:**
- Table V gives the layer-height coefficient for modulus as **−1.854** (p = 0.120, not significant). The printed equation has +1.85 H, and the text says H correlates positively with all three properties.
- The text says all p-values are below 0.001; Table V shows 0.120 (modulus, H) and 0.319 (elongation constant).
- One paragraph says both linear and polynomial regressions gave a marginal fit, 0.2 < R² < 0.5; the next column reports R² of 0.82, 0.59 and 0.60.
- The text gives the 45° elongation minimum for 0.5 mm strands as 351%; Table III has 353.00%.

Rely on the tabulated measurements. Use the regressions only as trends inside the tested ranges.

### 3. Relevance & Design Takeaways for FilaFabric
The only systematic parameter sweep on a NinjaFlex mesh in the collection, and the closest data to FilaFabric's Crosshatch & Isogrid nets: measured directions of effect for strand width, gap, layer height and layer rotation. Its specimens are 1.8 mm thick (6–18 layers), several times thicker than FilaFabric's nets. The strands were modelled in SolidWorks and sliced in ideaMaker rather than written as G-code, and no nozzle, temperature or speed is reported. Its values are trends, not settings.

### 4. Flat-sheet source review — 26 October 2026

**Evidence:** pp. 2–7, Tables I–VI, Figs. 2–9. **Status:** M, a multi-layer flat net printed on the bed, much thicker than the target sheets.

**Geometry and testing** (pp. 2–3, Table I, Figs. 2–4):
- Each layer is a set of parallel strands, and each layer is rotated by θ from the one below; at 60°, every third layer is back in the starting direction.
- T is the strand thickness and D the gap between adjacent strands in a layer (Fig. 2a), so the pitch is T + D. D was set to 0.5, 1, 1.5 and 2 × T.
- Total thickness was held at 1.8 mm: 18, 12 or 6 layers at H = 0.1, 0.15 or 0.3 mm.
- Strands were laid symmetric about the specimen axis. In the 90° specimens the openings appear as diamonds, so the strands ran at about ±45° to the pull (read from Figs. 3d and 4b).
- Printed on a Raise3D Pro 2. The NinjaFlex datasheet values quoted are 26 MPa ultimate strength, 12 MPa modulus and 660% elongation (p. 2).
- Tested on an MTS Insight 5 with a 5 kN load cell at 500 mm/min to break, five specimens per condition, mean ± SD (p. 3). Stresses are reported in MPa, but the cross-section used is not stated.

**Measured results** (strength MPa / elongation % / modulus MPa):

| Table II, p. 4: 0.15 mm layers, 90° | D = 0.5 T | D = T | D = 1.5 T | D = 2 T |
|---|---|---|---|---|
| T 0.4 mm | 4.64 / 403.69 / 3.99 | 3.15 / 358.88 / 2.41 | 2.56 / 369.91 / 1.61 | 2.13 / 364.90 / 1.28 |
| T 0.5 mm | 4.45 / 438.16 / 3.68 | 3.27 / 412.03 / 2.25 | 2.65 / 409.55 / 1.56 | 2.15 / 386.57 / 1.35 |
| T 0.6 mm | 5.21 / 461.73 / 4.22 | 3.95 / 438.64 / 2.51 | 3.24 / 433.57 / 1.84 | 2.61 / 429.21 / 1.54 |

| Table III, p. 5: 0.15 mm layers, D = T | 30° | 45° | 60° | 90° |
|---|---|---|---|---|
| T 0.4 mm | 3.56 / 361.02 / 2.46 | 3.52 / 364.04 / 2.55 | 3.47 / 340.36 / 2.94 | 3.15 / 358.88 / 2.41 |
| T 0.5 mm | 3.57 / 368.05 / 2.80 | 3.56 / 353.00 / 2.82 | 3.52 / 361.63 / 3.04 | 3.27 / 412.03 / 2.25 |
| T 0.6 mm | 4.58 / 390.69 / 3.14 | 4.32 / 375.81 / 3.34 | 4.26 / 379.96 / 3.60 | 3.95 / 438.64 / 2.51 |

| Table IV, p. 5: T 0.4 mm, 90° | D 0.2 | D 0.4 | D 0.6 | D 0.8 |
|---|---|---|---|---|
| H 0.1 mm (18 layers) | 4.67 / 332.78 / 4.91 | 2.76 / 264.07 / 2.68 | 1.98 / 247.59 / 1.69 | 1.88 / 295.99 / 1.34 |
| H 0.15 mm (12 layers) | 4.64 / 403.69 / 3.99 | 3.15 / 358.88 / 2.41 | 2.56 / 369.91 / 1.61 | 2.13 / 364.90 / 1.28 |
| H 0.3 mm (6 layers) | 5.29 / 507.65 / 3.25 | 3.95 / 477.11 / 2.15 | 3.02 / 433.86 / 1.79 | 2.47 / 383.85 / 1.54 |

**Authors' findings** (pp. 4–7):
- Strength and modulus fall about linearly as the gap widens (strength R² > 0.9, modulus R² 0.893). Elongation follows the gap only weakly (R² 0.4–0.8).
- From 30° to 90° rotation, strength falls by at most 0.41 MPa (11%). For the 0.5 and 0.6 mm strands, 90° gave the lowest modulus and the highest elongation. The authors suggest the elongation dip at 45° comes from less interlayer contact area.
- Thicker layers raised strength and elongation. 0.1 mm layers gave the least elongation (248–333%).
- The conclusion recommends thicker strands and thicker layers and reports no significant difference between rotation angles, although the results section favours 90° for wearables.
- The wearable demonstration (p. 7, Fig. 9) uses T 0.4, D 0.2, 90°, H 0.3, the most extensible configuration in Table IV.

**Proposed translation:** use Lu's tables as the starting matrix for FilaFabric swatches (strand width, gap as a multiple of width, layer height and per-layer rotation), but at FilaFabric's thickness of one to three layers, in Foamy or NinjaFlex 85A on the MK3S. Pull on the strand axes as well as on the bias: a 0/90 net is tetragonal (54), and Lu pulled only on the bias.

### 5. Full-text pass — 26 October 2026

**What the primary adds to Brad's summary (5).** Brad's one-line description is accurate. The primary adds that:
- the regression covers only the 90° meshes, with H, T and D as terms and no θ;
- the fit is moderate for strength (R² 0.82) and weak for elongation and modulus (about 0.6);
- the paper's text and tables disagree on the sign and significance of the layer-height term for modulus;
- the "rotation angle" is a cumulative layer-to-layer rotation, not the strands' angle to the load.

**Not given:** nozzle diameter, temperatures, speeds, cooling, slicer overlap or extrusion settings, specimen die or width, and the cross-section used for stress.

**Pattern implications.** Proposals, untested in FilaFabric:
1. **Gap as a multiple of strand width is the main stiffness control.** Widening the gap from 1× to 2× the strand width cut modulus by 39–47% and strength by 32–34% across all three widths (Table II).
2. **Fewer, thicker layers stretched further** at the same total thickness: 384–508% with 0.3 mm layers against 248–333% with 0.1 mm layers (T 0.4 mm, 90°). For a given sheet thickness, test the thickest reliable layer first.
3. **Rotated stacks** (30°, 45°, 60° per layer) are a further net family, a "rotate each layer" option for Crosshatch. Lu found strength nearly unchanged and modulus highest around 60°.
4. **Compare Lu's chosen wearable mesh** (T 0.4, D 0.2, H 0.3, 90°: 5.29 MPa, 508%, 3.25 MPa) against a thin FilaFabric equivalent, to see how much of its stretch survives at one to three layers.

---

