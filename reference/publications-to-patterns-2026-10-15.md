# What the publications give the studio

The 21 PDFs in `reference/publications/` (most 3D-printing, a few about weaving, knitting and digital textile craft)
read for anything that can be turned into a pattern for a Prusa MK3S printing TPU foam as a fabric. Most of the
Textile Intersections 2026 papers are about bio-materials, colour, waste and looms; they are context, not patterns.
Four describe processes close to this tool; two more give structures that are directly usable.

## Used

| Paper | What it describes | What it became |
| --- | --- | --- |
| Gispan, Ariel & Sterman, *Halftoning for 3D Printed Textile Nets* (preprint, 2026) | A net whose topology never changes; a picture is carried by how thick each line is (flow, with print speed following), in two layers, on orthogonal, diagonal, chevron and curvilinear grids | **Halftone net** card; per-move `flow` in the G-code writer, statistics and preview; the second layer can be the complement of the first so two colours trade thickness |
| Takahashi & Kim, *3D Printed Fabric: Techniques for Design and 3D Weaving Programmable Textiles* (UIST '19) | Pillar-fibre weaving: short pillars on a grid and a fibre that passes each pillar on one side, then on the other on the next layer | **Pillar weave** card: pillars as stacked rings, fibre side alternating by layer and row, printed layer by layer |
| Kim & Lee, *Modeling and development of continuous textile structures utilizing 3D printing* (Fashion and Textiles, 2025) | Plain weave, plain knit and spacer fabric as continuous TPU structures | **Spacer net** card: bottom net, a pillar on each node (or every second or third), a top net held by the pillars |
| Sterman, *Opportunities and challenges of toolpath-based 3D printed textiles: insights from the Digital Design and Craft course* | A vocabulary of toolpath textiles: orthogonal and sine-wave grids, straw weave, chainmail circles, lace, zigzag-stitched joins, fringes from a partial second layer, chevron grids | Already in the library (Crosshatch, Dip weave, Ring mail, Voronoi lace, Fringe, Zigzag mesh); the curvilinear and chevron grids are now also the line shapes of the halftone net |
| Gelosi & Devendorf, *Designing with Drafts and Cross-Sections*; Devendorf et al., the AdaCAD paper on open-source weaving | Weave drafts and cross-sections as the language of woven structure, and a draft as something a program can compute | Three new bindings for the **Weave** card: herringbone, diamond twill and crepe (eight in all) |

## Used as context

- Ariel & Sterman, *Compostable Garments via Digital Fabrication: a Nursing Bra Case Study* (CHI EA '26): a garment
  from biodegradable filament whose elastic band is a printed auxetic structure. The auxetic cell is already the
  **Auxetic mesh** card; nothing new to add, but it is the garment use that card is for.
- Klop et al., *WarpForm* (non-rectangular woven forms), and Janssen & McQuillan, *Shaped Circular Knitting for Zero Waste
  Design*: shapes that follow the body rather than a rectangle. The studio already takes any SVG outline; nothing new to add.
- Kuijpers et al., *Textile Digital Drape Definition (TD3)*: comparing digital to physical drape. A candidate for a
  future swatch-testing note, not a pattern.

## Not applicable

Bacterial cellulose, microbial colour, evolutive colours, mycofabrication, mechanical recycling of metallicised fabrics,
waste sorting, reuse yarn: material and colour research with no toolpath to take.

## The SVG design card and the infill library

Not from the papers but from the way they work: every one of them turns a drawing or a field into lines, and a slicer's
infill is the most familiar library of such lines. `src/engine/infill.js` lays any of the 17 PrusaSlicer infill
patterns inside any outline, as one layer of a textile, and the **SVG design** card uses them: a drawing becomes lines,
filled shapes or both, and one or two backing layers go on top, each with its own pattern.

## What is not verified

Nothing here has been printed. The halftone card in particular rests on how this material behaves at 0.5× to 2× flow,
and the spacer and pillar structures on whether the foam holds a net across the pillars' tops. They are geometry
studies with honest geometry checks, to be qualified on small swatches first (see `docs/fabric-structures.md`).
