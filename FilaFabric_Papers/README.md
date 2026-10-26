# FilaFabric pattern research

Updated 24 October 2026. This folder contains 64 locally held PDF papers, one Word paper, and the authored research reports. On 26 October 2026 four primary papers were added (Pattinson 2019, Li 2022, Spahiu 2020 and Lu 2022, reviewed as Papers 66–69). The published versions of Pattinson and Li (`*_Published.pdf`) and the Li authors' G-code in `Li-2022_Programmable-Digital-Weaves_GCode/` were added too, all git-ignored. The current brief is **bed-based single-layer sheets, multiple flat layers, and shallow non-planar textures**. Upright printing is outside scope.

On 24 October 2026 every source was re-read in full and the reports were extended. This second pass added a section 5 to each paper entry, new candidate patterns, edge and joining details, distilled design rules, a process-settings table and a literature-to-audit link table. It also corrected three errors from the first pass. On 26 October 2026 an attribution check re-verified the second pass's cross-paper statements and numbers against the source text and fixed several misattributions, including the Bastian/Peleg mesostructure. Both lists are at the top of the reference.

## Read the reports

- [Pattern Library Plan of Action](FilaFabric_Pattern_Library_Plan_of_Action.md) (26 October 2026): the agreed three-shelf library (Flat, Layered, Raised), 60 cards with their code files and paper sources, the shared six-section panel, colour regions and line alignment, in numbered phases. A plan only; nothing implemented yet.
- [Existing Pattern Audit and Proposed Grouping](FilaFabric_Existing_Pattern_Audit_and_Grouping.md): all 31 design IDs plus the preset alias, actual support/layer roles, duplicate families, reproduced Parquet problems, a staged simplification brief, and a table linking audit findings to the literature. Start here for reorganising the existing library. The code has not changed since the audit; the registry is still 29 visible ready designs, 2 hidden and 1 preset.
- [Printable Textile Pattern Catalogue](FilaFabric_Printable_Textile_Pattern_Catalogue.md): the three classes, candidate patterns S1–S7, M1–M9 and N1–N3, existing-card mappings, implementation order, swatch criteria, edge and joining details, design rules, reported process settings and the Nozzle Boss research lead.
- [Research Reference and Design Notes](FilaFabric_Research_Reference_and_Design_Notes.md): all 69 sources. Each entry has a summary, formulations, relevance, the dated flat-sheet review (section 4) and the full-text second pass (section 5).

## Evidence conventions

Source IDs follow the numbered Paper entries in the reference. PDF locators count physical pages, including covers; Word locators use section headings. Review relevant methods, fabrication orientation, materials, geometry and results before suggesting an implementation. For long dissertations, cite the specific chapter and physical pages.

When extracted text garbles an equation or table (fractions, superscripts, footnote marks), check the typeset PDF page before quoting it. The second pass found two such errors this way.

When one paper reports another's work, attribute each statement to the paper that actually makes it, with its reference number. Do not merge two papers' descriptions into one claim, and do not add a property (height, material grade, mechanism) that neither states. Where secondary sources disagree, record both and name the primary that would settle it.

Distinguish a demonstrated bed-based fabrication, a transferable method from a different process, and a proposed FilaFabric adaptation. A draft or rendered over/under symbol does not demonstrate mobile interlacing. Record how crossings fuse and how all paths stay connected. Keep nominal layer count separate from actual thickness at intersections. Preserve material/process qualifications and conflicting source data.

The Nozzle Boss upstream README/wiki were checked on 23 October 2026. The exact meditat fork, Geometry Nodes files and version behind Luis's supplied workflow remain to be retrieved before adopting its numerical settings. No software from that workflow was installed or executed.

## Keep source papers local

The project `.gitignore` excludes PDFs (case-insensitive extension), DOCX source papers and `.review-cache/` anywhere under this folder. Authored Markdown and the retired-script notices remain trackable. The review cache contains extracted full text and inspection images for local review only; do not commit it. Files stay on this computer.

The ignore rule prevents ordinary future additions; it does not erase earlier Git history. At this review, no files in this paper folder were already tracked in the local parent repository. No remote history was rewritten or claimed to have been audited.

## Maintain the reports

Edit the Markdown directly. `generate_docs.py` and `generate_master_notes.py` are retired and exit without writing. Their previous keyword-based summaries could overwrite the curated review, use stale absolute paths and attribute unsupported equations to sources. Do not regenerate the report from abstracts or keyword templates.

Before a future commit, check `git check-ignore` for the local sources, confirm no source papers are in `git ls-files`, and review the Markdown changes. Updating these reports does not implement or validate a new FilaFabric preset.
