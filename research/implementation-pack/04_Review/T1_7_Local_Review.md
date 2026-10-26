# T1.7 — local colour plan

One Colour section on every card (also the legacy pile panel), with one colour, face colour and per-layer swatches. Thickness-capable cards additionally offer two-colour halftone, which selects thickness and complements the second native family. Saved colours are allowlisted hex values, capped at 256 layers, and survive links. Printer changes use M600, not automatic multi-tool commands.

`applyColourPlan` is pure and does not reorder geometry. Layered and extra-pass builders apply it after ordering, before emission. **Incremental implementation adjustment:** already clearance-planned raised/SVG results retain their existing moves; `colourResult` annotates preview colours and retains matching legacy pause indices. Newly needed pauses insert only vertical clearance moves, without regenerating or rerouting raised geometry. The final export applies the plan after all composition and records it in the header. The old boolean remains an input compatibility alias; explicit `colourMode` wins.

Default snapshots: all 154 settings hashes change because colour state is now explicit. Extrusion lengths, strand counts, move counts, heights, families and ties are unchanged. Only two G-code hashes change (Halftone colour-swap and Spiral normals), due to the colour-plan header comment. Face mode on the original Squiggle cases preserves the exact pause move index; A/A/B pauses once before the third layer. Extra passes no longer create unwanted extra face-colour pauses. Streamed garment sections remain single-filament.

126 focused checks passed, including the output snapshots, saved states, panel interactions and clearance-preserving colour changes. Browser colour selection exercised at 375, 768 and 1440 px, with zero page errors and no horizontal overflow. Also fixed a live thickness-control readout crash that the browser test exposed.

No push, merge, source archive regeneration or physical print. Physical validation remains pending. Source-archive currentness remains intentionally outstanding.
