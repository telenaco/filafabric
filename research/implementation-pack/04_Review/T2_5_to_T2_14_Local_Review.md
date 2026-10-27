# T2.5–T2.14 — Rotating triangles to Kirigami: local review

**Tickets:** [T2.5 to T2.14](../03_Tickets/Phase2_New_Flat_and_Layered_Cards.md#t25-f-07-rotating-triangles-rotating-triangles) except T2.11, which is blocked at its licence gate.
**Branch:** `t1-8-support-carriers` (the whole stack since T1.7 is still uncommitted). No push.
**Reviewed by:** Claude (technical lead), 26–27 October 2026, after the Codex session that wrote the cards reached its limit. The cards, engines and their first tests are theirs; the defects and fixes below are the review.

## How it was checked

- Each engine was read against its ticket, and each card's own tests were run.
- A property sweep of the 14 new cards at 100 × 100 mm: the default, every preset, and every slider at its minimum and at its maximum (169 cases). It looks for thrown errors, lost families, pieces that need automatic ties, strands outside the swatch, non-deterministic G-code, wrong shelf, and slow generation.
- The **export gate**: whether the export button would accept the output (`assertConstructionExportable`) for every ready card and preset at the snapshot size (207 cases).
- Generation time of every ready card at its default size.
- **A browser pass** (the local server, desktop and 375 px wide): each of the 14 new cards opened in turn, with script errors, the Export button and horizontal overflow recorded; the Star-metric petal editor was drawn and moved with the keyboard.

## Defects found and fixed

| Card | What was wrong | Fix |
|---|---|---|
| **The whole studio** (T2.10, found in the browser) | **The studio did not start at all** ("The studio could not start: Failed to execute 'append' on 'Element': The new child element contains the parent"). `PetalSection`, the Star-metric petal editor, replaced its own section element with the control it returned, so the constructor appended the section to itself. No node test builds a panel in a real DOM, so the full suite was green (1,189 tests) while every visitor would have seen a dead page. | `buildBody` now returns the control without reassigning `this.node`. The test fake's `append` now refuses to append a node to itself or to something inside it, as a browser does, and a test builds a `PetalSection`. |
| **Star-metric petal editor** (T2.10, found in the browser) | Once the studio started, the editor was still invisible (zero height). The `el()` helper makes `<svg>`, `<polygon>` and `<circle>` as plain HTML elements, which a browser never draws. | New `svgEl` helper in `dom.js` (SVG needs `createElementNS`), used for the editor's svg, polygon and handles. The test checks the namespace. In the browser the editor draws, a handle moves with the arrow keys (1 → 0.95), and the preview regenerates. |
| **Connected lace** (T2.12) | **Export was refused at the card's own default size** ("border was lost when the pattern was cut to the shape"). The border was drawn exactly on the swatch outline, and the shape cut removes a line lying on the edge. The card's tests passed because none of them ran the export gate. Once the border existed, it floated: the lattice stops 3–10 mm short of the right and top edges, leaving 223 mm of border attached to nothing. | The border is drawn a little inside the outline, as the other bordered cards do, and a short neck runs from each outer motif that stops short of it out to the border (ten at the default size). The ring and scallop presets, which used to need automatic ties, now hold together through the border. A test fails if any stretch of border longer than 3.5 pitches has nothing joined to it. |
| **Meander with ties** (T2.13) | The default measured *raised* (up to 1.08 mm) although declared flat. It placed a tie at every rounded-corner segment: 3,466 ties and 9,265 crossings, piled on one another. | Ties start at stations every `tieInterval` mm of curve length, run across to the nearest fold alongside, and are dropped if they would cross the curve or another tie or sit too close to one. Each tie declares a joint at both ends, so meeting the curve end-on is a join, not a tie laid over it. Default: 107 ties, 0 crossings, Z 0.2 mm everywhere, one component without automatic ties, flat by measurement. The ticket text now says so (the old "overlaps both runs by half a bead" is what stacked the ends). |
| **Rotating squares and triangles** (T2.4, T2.5) | Neck ends are offset sideways from the contact point. With a neck 1.2 mm or wider, or a sharp corner (rounding 0), the ends fell clear of the outline and the squares came apart (up to 221 pieces held by 440 automatic ties). The shipped *Maximum inclination* triangle preset needed 112 automatic ties. Squares were placed using the sharp corner, so a large rounding or a 35° opening left the border band touching nothing. The *Broad* and *Closed* square presets lifted their necks to 0.4 mm where two passes met a joint out of reach. | Neck ends that miss the outline are pulled onto it; every offset end gets a joint of its own; joints are named by position so necks leaving the same corner share one; squares are placed by the rounded outline's real reach. All 25 variants in the sweep are one piece without ties, and all eight presets are flat at 0.2 mm. **Visible change:** the default 100 mm swatch now fits 10 × 10 squares, not 9 × 9, because the outer ring used to be left out. |
| **Kirigami sheet** (T2.14) | 17 s to generate at 100 × 100 mm (the next slowest card takes 3.4 s; the median is 0.6 s). | The engine is fast (0.25 s); the time was in `findCrossings`, which searched every joint of both strands for each of the tens of thousands of places where its two fill passes meet. It now looks joints up by position (`crossings.js`). 100 mm is now 7.7 s. No other card's output changed (every other snapshot is byte-identical), so the change is behaviour-preserving. The remaining time is the 125,000 moves of a solid sheet. |
| **Printability ranks** | `printability-data.js` was stale for nine cards: Meander with ties (192.8, now 5.3), Stochastic net (103.5, now 5.7), Voronoi cells (84.7, now 6.3), Arrowhead band (84.5, now 6.8), Star-metric, Rotating triangles, Connected lace, Spiral cells and Rotating squares. The gallery ranks cards by these scores. | Regenerated with `node dev/tools/audit-printability.mjs`. Scores are geometry estimates, not physical results. |
| **No test of the export gate** | That is how the lace bug got through. | The snapshot generator (`generateDesignSummaries`) now refuses output the export button would refuse, so `npm test` and `npm run snapshots` both fail on it for every card and preset. |

## Tests added

- `meander-ties.test.js`: tie spacing follows the interval; every tie is straight, ends on the curve and crosses nothing; the default is flat, crossing-free and held in one piece without automatic ties; every long run has a tie.
- `lace.test.js`: connected lace keeps its border and passes the export gate on the default and every preset; the border is attached all the way round.
- `panel.test.js`: a `PetalSection` builds inside its own section and its drawing is made of SVG elements.
- `rotating-units.test.js`: both cards stay one piece without ties at the extremes of neck, rounding and angle; the outer squares reach the border at any rounding.
- The snapshot generator's export gate (above).

## Snapshots

Four snapshot files changed, and only those: `connected-lace` (border now present; ring and scallop presets lose their ties), `meander-ties` (26 strands and Z 0.2 instead of 654 and up to 1.13), `rotating-squares` (more squares, border reaches them) and `rotating-triangles` (the *Maximum* preset no longer needs ties). Every other card's G-code hash is unchanged.

## Checked, no change needed

Arrowhead band (T2.6), Spiral cells (T2.7), Stochastic net (T2.8), Voronoi cells (T2.9) and Star-metric cells (T2.10) generate at their defaults, presets and slider extremes without errors, lost families, strands outside the swatch or non-deterministic output, and each is flat by measurement. Their free line ends are listed below.

## T3.1 built alongside T2.12

The **Lace + backing** card (`lace-backing`, T3.1) was built together with Connected lace and shares `lace.js`. Its tests (`lace.test.js`) cover the ticket's checks: every motif island crosses the motif-first default carrier at least twice, the carrier prints above the motif, and the report counts one carrier. It passed the property sweep, the export gate and the browser pass (desktop and 375 px). The side view was not looked at separately.

## Still open

- **T2.11 Isohedral tiles** is not started. It waits for Luis (open decision 13 on the board).
- **Free line ends** (open decision 15). Spiral cells has 32, all 2 mm inside the swatch edge, with no border option. Voronoi cells (12) and Stochastic net (9) have interior dead-end stubs; so does the Star-metric *Hex petal* preset (11). The report counts them; nothing blocks them.
- **Slow at the limit of a slider:** Rotated stack with 8 layers (about 10 s) and Rings · flat at its smallest ring size (about 7 s) at 100 mm; Kirigami about 8 s at 100 mm.
- **Connected lace** presets *Ring* and *Scallop* still lift a single motif by 0.2 mm over about 1 mm where two outlines nearly touch.
- **"Long free strands" heads-up.** The studio warns when a strand runs more than 60 mm without crossing anything. It counts crossings, not contacts or joints, so a perimeter band that touches the shapes beside it is reported as free. At default size six cards raise it: Rotating squares (398 mm), Honeycomb · flat (136), Your drawing (128), Arrowhead band (123), Connected lace (120) and Lace + backing (61). It is only a heads-up, and the pieces are connected (one component each), but the wording ("can sag or pull away") is misleading for them. Counting contact points as well would fix it; that is a small ticket of its own.
- **Code style.** The T2.x engines and their tests are written in a compact one-statement-per-line style that differs from the rest of the code base. Reformatting would be cosmetic, and I did not do it, to keep the output byte-identical.
- **No physical print** has been made for any of these cards; every figure here is a geometry estimate.
