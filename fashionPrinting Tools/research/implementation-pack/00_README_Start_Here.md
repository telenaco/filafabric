# FilaFabric pattern library: implementation pack

*Prepared 26 October 2026 for the developers implementing the new FilaFabric pattern library. Product owner: Luis (Bubaki Design). Technical lead and reviewer: Claude, working in Luis's Claude Code session.*

This pack has everything needed to build the library, one ticket at a time, and to get each ticket reviewed. It lives in the repository at `research/implementation-pack/`, next to the research reports in `research/reports/`. Read it in this order.

| Read | File | What it gives you |
|---|---|---|
| 1 | [01_Team_Handbook.md](01_Team_Handbook.md) | How we work: branches, tickets, reviews, code standards, testing, Definition of Done. **Read before writing any code.** |
| 2 | [research/reports/FilaFabric_Pattern_Library_Plan_of_Action.md](../reports/FilaFabric_Pattern_Library_Plan_of_Action.md) | What we are building and why: the three shelves, the 60 cards, the six-section panel, the phases. |
| 3 | [02_Architecture_and_Contracts.md](02_Architecture_and_Contracts.md) | The target architecture: which module owns what, the data shapes every module must respect, the state schema and the pipelines. |
| 4 | [03_Tickets/](03_Tickets/) | One file per phase. Every ticket has its files, step-by-step implementation, tests, acceptance and review focus. |
| 5 | [04_Review/](04_Review/) | The review checklist, the pull-request template and the ticket board. |
| as needed | [research/reports/](../reports/) | Research behind every card: the [pattern catalogue](../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md), the [paper-by-paper reference](../reports/FilaFabric_Research_Reference_and_Design_Notes.md) and the [audit of the current designs](../reports/FilaFabric_Existing_Pattern_Audit_and_Grouping.md). |

**What you need besides this pack**
- Access to the code: <https://github.com/telenaco/filafabric>, working from the `library` branch. Every code path in this pack, such as `site/src/engine/layers.js`, is relative to the repository root. The website lives in `site/`; tests and tools in `dev/`.
- Node 22 (the code is tested on 22.23). There is no build step and no `npm install` is needed for development: `three` is vendored under `site/vendor/`.
- The source papers' PDFs are **not** in the repository (`research/papers/` is git-ignored); they stay with Luis for copyright reasons. The reports quote the settings and page numbers you need. If a ticket's details are not enough, ask the reviewer rather than guessing.

**The ticket files**

| Phase | File | Tickets |
|---|---|---|
| 0 | [Phase0_Foundations.md](03_Tickets/Phase0_Foundations.md) | T0.0–T0.7: output snapshots, card metadata, strand provenance, construction report, side view, shelves, state v4 and migration, variant groups |
| 1 | [Phase1_Move_Existing_Designs.md](03_Tickets/Phase1_Move_Existing_Designs.md) | T1.1–T1.11: panel template, splitting Squiggle, merging Zigzag, Coil, cells, Pattern, Colour, Support, copy, remaining cards, QA |
| 2 | [Phase2_New_Flat_and_Layered_Cards.md](03_Tickets/Phase2_New_Flat_and_Layered_Cards.md) | T2.1–T2.14: fourteen new cards from the papers |
| 3 | [Phase3_Motif_on_Carrier_and_Weave.md](03_Tickets/Phase3_Motif_on_Carrier_and_Weave.md) | T3.1–T3.5: lace on backing, step/ripple lace, paired loops, scales, woven-draft generator |
| 4 | [Phase4_Raised_Engine.md](03_Tickets/Phase4_Raised_Engine.md) | T4.1–T4.7: print order, bond control, lifted crossings, bridged crossings, sliding channels, climbing overlaps, raised reporting |
| 5 | [Phase5_Raised_Cards_and_Comparisons.md](03_Tickets/Phase5_Raised_Cards_and_Comparisons.md) | T5.1–T5.7: six raised cards and the "print all variants" export |
| 6 | [Phase6_Repairs.md](03_Tickets/Phase6_Repairs.md) | T6.1–T6.3: Parquet, Truchet, Meander and Turing |
| 7 | [Phase7_Drawing_Tools.md](03_Tickets/Phase7_Drawing_Tools.md) | T7.1–T7.7: line alignment, SVG colours, colour regions, colour bar, Apply/Export, seams, sharing |
| 8 | [Phase8_Physical_Validation.md](03_Tickets/Phase8_Physical_Validation.md) | T8.1–T8.3: swatch records, comparison sets, calibration |

**Order of work:** Phase 0 → Phase 1 → T7.1 → Phase 2 → Phase 4 → Phase 5 → Phase 3 → T7.2–T7.7 → Phase 6, with Phase 8 alongside. The [ticket board](04_Review/Ticket_Board.md) shows each ticket's dependencies and what can run in parallel.

**Workflow (confirmed by Luis, 26 October 2026):**
- One branch per ticket, a pull request into the integration branch **`library`**, review by Claude, merge by Luis.
- **Nothing goes live until the whole plan is implemented:** `library` is merged into `main` (the live site) only once, at the end, by Luis.
- Never push to `main` or `library` directly.

The repository's `CLAUDE.md` says the same.

**Decisions still open with Luis:** the plan marks seven of its own calls with **[call]**, and the [ticket board](04_Review/Ticket_Board.md#open-decisions-for-luis) lists the rest. Until Luis confirms them, implement the plan's default and leave a note in the PR.
