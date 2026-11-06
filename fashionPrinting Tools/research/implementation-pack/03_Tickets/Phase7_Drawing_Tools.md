# Phase 7: Drawing tools (line alignment and colour regions)

**Goal:**
- **Line alignment:** wide lines in an imported SVG can sit inside, outside or centred on the drawn path (decision D11).
- **Colour regions:** every colour in the drawing can get its own card and settings, as in LightBurn, with **Apply** building the whole piece and **Export** writing one file (decision D10).

**Depends on:** T7.1 needs only Phase 0. T7.2–T7.7 need Phases 0–1 (cards, Support, Colour) and T4.1 (print order).

| Ticket | Title | Depends on | Size |
|---|---|---|---|
| T7.1 | Line alignment and pass spacing | Phase 0 | M |
| T7.2 | Keep each path's colour on import | Phase 0 | S |
| T7.3 | Region model and default roles | T7.2 | M |
| T7.4 | The colour bar | T7.3 | M |
| T7.5 | Apply and Export | T7.4 | M |
| T7.6 | Building a piece from regions, with seams | T7.3, T4.1, T1.8 | L |
| T7.7 | Regions in share links, files and swatch codes | T7.6 | S |

---

## T7.1 Line alignment and pass spacing

**Today** (`site/src/engine/drawing.js`):
- `passesFor(width, bead)` (line 214) gives `round(width / bead)`, capped at `MAX_PASSES = 8`.
- `linePasses(line, bead)` spaces the passes at `pitch = min(width / n, bead × 0.8)` and offsets pass *k* by `(k − (n − 1)/2) × pitch`, **centred on the drawn path**.
- `offsetPolyline(pts, d)` (line 220) moves a polyline sideways by `d`, **positive to the left of its direction**, with mitred corners.

**Background:** Illustrator and Affinity can align strokes inside or outside a closed shape, but SVG has no portable way to store this. Inkscape has no such option. So FilaFabric owns the alignment, and any SVG editor works.

**Contract C10:**

```js
// settings on the imported drawing (state.vector / state.outline), and per region from T7.3
lineAlign: 'centre' | 'inside' | 'outside' | 'left' | 'right'   // default 'centre' (today)
passSpacing: number                                              // fraction of bead width, default 0.8 (today)

export function linePasses(line, bead = 0.45, { align = 'centre', spacing = 0.8 } = {}) {}
```

**Formulas.** Bead width *b* is the profile's extrusion width; pass spacing *p* = `spacing × b`; stroke width is *W*.

1. **Number of passes:** `n = max(1, min(MAX_PASSES, round((W − b) / p) + 1))`. The printed band is `(n − 1)·p + b` wide.
   - **Compatibility:** today's count is `round(W / b)`. With *p* = 0.8 *b* the two can differ by one pass for some widths. **Centre alignment keeps today's count and today's pitch exactly** (`pitch = min(W / n, 0.8 b)`), so old drawings print the same. The new formula applies only to the one-sided alignments.
2. **Offsets of pass *k*** (k = 0 … n − 1), in `offsetPolyline`'s convention (positive = left):
   - `centre`: `d_k = (k − (n − 1)/2) × pitch` (today's behaviour, unchanged);
   - `left`: `d_k = +(b/2 + k·p)`;
   - `right`: `d_k = −(b/2 + k·p)`.
   - **The first one-sided pass is inset by half a bead** so that the printed band's edge lies **on** the drawn line. (A note Luis forwarded suggested placing the first pass on the path itself; then half of it would print outside the shape and "inside" would not stay inside.)
3. **Inside and outside** apply to closed paths only:
   - compute the ring's signed area in the drawing's coordinate frame (the frame after `svg-parse.js`'s conversion);
   - for a ring with positive signed area (anticlockwise with y pointing up), the interior is on the **left**, so `inside = left` and `outside = right`; negative area swaps them;
   - **test both windings.**
4. **Open paths** offer `left / centre / right`; closed paths offer `inside / centre / outside`. The UI picks the set automatically.
5. **Collapse:**
   - drop passes whose offset exceeds the shape's inner radius, i.e. when the offset polyline self-intersects or its signed area changes sign;
   - **never let an inside offset cross to the far side;**
   - report the dropped passes as a note: *"N passes did not fit inside small shapes."*
6. **Corners:** keep `offsetPolyline`'s mitre limits; for inside offsets of sharp corners, check that no pass leaves the shape (sample its points and test containment).

**UI:**
- In *Size and shape → How a drawing prints*, add *Lines sit: Centre / Inside / Outside*, with a hint showing the left/right variants for open paths. Once T7.3 lands, the choice is per region.
- In Advanced, *Pass spacing* (0.6–1.0 × bead, default 0.8).
- The preview shows the result at once.

**Reference:** the open-source Hector Vector editor (<https://github.com/asuramaya/hector-vector>, MIT licence) reportedly implements centre/inside/outside strokes. Use it as a geometric reference only; **do not copy its code without the reviewer's licence check.**

**Tests** (`dev/tests/line-align.test.js`)
- A 100 × 100 mm square, W = 1 mm, drawn clockwise and again anticlockwise:
  - *inside*: every pass point is inside the square and at least `b/2 − 0.01` from the edge, and the outermost pass is at `b/2` from the edge (± 0.01);
  - *outside*: the mirror image of that.
- An open line, W = 1 mm: *left* passes are all on the left; *right* on the right.
- A 3 mm circle with W = 2 mm and *inside*: the passes that cannot fit are dropped and the note is produced.
- *centre* output is unchanged (`dev/tests/drawing-union.test.js`, `dev/tests/outline.test.js` and the drawing snapshots).

---

## T7.2 Keep each path's colour on import

**Today:** `paintClass(value, current)` in `site/src/engine/svg-parse.js` (line 148) reduces any paint to one of `red`, `blue`, `green`, `yellow` or `other`, and the parser stores `styles.push({ color, width })` (around line 89). The actual colour is lost.

**Implementation**
1. Add `hexOf(value, current)`: normalise any CSS colour the parser already understands (`rgbOf`) to `#rrggbb`, or `null` for `none`.
2. Store `styles.push({ color, hex, width })`.
3. In `sanitizeSvgLines` (`site/src/engine/drawing.js`), accept `hex` (validate it with `/^#[0-9a-f]{6}$/`).
4. Old saved drawings without `hex` still load. Their regions (T7.3) are built from the five classes.

**Tests:** an SVG with five different reds gives five distinct `hex` values, all classed `red`; `rgb()`, named colours and `currentColor` normalise correctly; old drawings sanitise unchanged.

---

## T7.3 Region model and default roles (`site/src/engine/regions.js`)

**Contract C11.**

```js
/**
 * The regions of a drawing: one per distinct colour of its closed shapes (open paths are lines and belong to their
 * colour's region with role 'line'). Default roles reproduce today's meaning, so a drawing prints the same until the
 * person changes a region.
 */
export function regionsFromDrawing(vector, { currentCard, currentSettings }) {}
```

1. Group the paths by `hex`, falling back to `color` class names for old drawings.
2. **Default role per region:**

   | colour class | role | card |
   |---|---|---|
   | `red` | `pattern` | the current card with the current settings (today's single pattern) |
   | `blue` | `hole` | — |
   | `green`, `yellow` | `solid` | — |
   | `other` closed shapes | `line` (printed as drawn, as today) | — |

3. A region has `enabled: true` by default.
4. **Pure function, deterministic order:** regions sorted by first appearance in the file.
5. `regionPolygons(vector, regions)` returns, for each pattern region, its fill polygon. Use the existing nesting rules in `drawing.js` (innermost wins; blue cuts holes), treating each pattern region separately: a red-B shape inside a red-A shape is region B's area and is cut out of region A.

**Tests:**
- A drawing with one red, one blue and one green produces the three default roles.
- **Today's output is reproduced exactly when all regions keep their defaults:** compare against the drawing snapshots.
- Nested regions of two reds give disjoint polygons.

---

## T7.4 The colour bar

**Where:** next to *3D / 2D / 3D sample* in the preview toolbar (`site/index.html` line 107; `renderPreviewMode()` in `site/src/ui/main.js` around line 803).

**What it shows:**
- One chip per region, showing its colour.
- A **tick box** (enabled or not).
- The **role** as a small icon: pattern, hole, solid or line.
- For pattern regions, the card's name on hover or focus.

**Behaviour**
1. **Unticking** a region removes it from the preview and the export; it is drawn as a faint outline.
2. **Clicking a chip** selects that region. The right panel then shows a **region header** (colour, role picker), then, for pattern regions, a card picker (the library gallery in a compact list) and **that region's card panel**, editing `region.settings`. Lines get the T7.1 alignment choice.
3. With **no drawing loaded,** the bar is hidden and the app works as today.
4. **Accessibility:**
   - the chips are a toolbar (`role="toolbar"`), navigated with the arrow keys;
   - each chip's label reads, for example, *"Red #e53935, pattern: Wave net, included"*;
   - the tick box is a real checkbox.
5. **Phone layout:** the bar scrolls horizontally, and selecting a region opens the panel as on desktop.

**Tests** (logic in a pure helper `colourBarModel(regions, selection)`, tested in Node): chip order, labels and enabled state. The UI itself is checked in the browser, with screenshots in the PR.

---

## T7.5 Apply and Export

**Why:** with several regions, building the whole piece is slower than one card, so building and exporting become two steps (decision D10).

**Implementation**
1. The current **Export** button (`site/index.html` line 284; wired in `site/src/ui/main.js` at lines 1221 and 2325) becomes **Apply**. It builds every enabled region and the seams into one result (T7.6), in the worker (`site/src/ui/panel-worker.js`), with a progress indication.
2. **Export** moves to the header next to **Share** (`site/index.html` line 70). It is enabled only when the applied result matches the current state (keep a hash of the state at Apply time). Any change marks the result **stale**: Export disables, and Apply highlights.
3. **No drawing, or a drawing with a single pattern region:** Apply and Export behave as today's Export did (generate if needed, then export), so the single-card workflow stays one click. Decide with the reviewer whether Apply is hidden in this case. The default is to show both, with Apply already done.
4. Keyboard shortcuts, if the app has any for Export, move with the button.

**Tests:** the stale-state logic (state hash compare) in a pure helper; checked in the browser.

---

## T7.6 Building a piece from regions, with seams

**Implementation:** `buildRegions(machine, material, vector, regions, { seam, generate })` in `site/src/engine/regions.js`.

1. **Per pattern region:**
   - `outline` = the region polygon minus its holes (`regionPolygons`, T7.3);
   - call the region's card `generate(machine, material, region.settings, { outline, … })`;
   - tag every strand with `source: '<card>@<hex>'` (C3).
2. **Seams [call 1]:**
   - for every border shared by two enabled pattern regions, a **seam line** along the border: `role: 'seam'`, family `seam-<hexA>-<hexB>`, one bead wide by default, or two passes when *Seam width* is above 1.5 × bead;
   - **both regions' patterns are clipped one bead back from the seam**, then tied to it: each strand end that lies within 2 × bead of the seam is extended to meet it with an overlap of half a bead;
   - this is the catalogue's reinforced contour band ([catalogue edge details](../../reports/FilaFabric_Printable_Textile_Pattern_Catalogue.md#edge-joining-and-handling-details); Gispan, [Paper 17](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-17-gispan-et-al-2026--halftoning-for-3d-printed-textile-nets)).
3. **Lines and solids:** `line` regions print as drawn, with their alignment (T7.1); `solid` regions as today (`svg-solids.js`); `hole` regions are cut from everything.
4. **Merge and order:**
   - group all strands by layer index;
   - print every region's layer 1, then every region's layer 2, and so on;
   - within a layer, print seams first, then regions in bar order;
   - then run `clearanceOrder` (T4.1) over the whole set, so a taller region never blocks the nozzle over a lower one.
5. **Colour plan:** each region's own colour mode applies to its strands. If regions ask for different pause points, merge the pauses into one sequence and warn when they conflict (*"Regions ask for different filament changes; using the first region's plan"*). **Bring this rule to review before implementing; it is a product decision.**
6. **One result:** one `cfg`, one G-code, one construction report with **per-region sections** (`report.regions[hex]`) plus seam contacts (crossings and joints between `seam` and each region's strands).

**Settings:** *Seam width* (1–3 × bead, default 1), *Seam* (on/off, default on; off shows a warning: *"Regions will not be joined"*).

**Tests** (`dev/tests/regions.test.js`)
- Two adjacent squares in different reds, with different cards:
  - both patterns are present;
  - one seam lies along the shared edge;
  - every pattern strand that ends near the seam meets it;
  - **the whole piece is one component without ties.**
- A disabled region is absent.
- With a hole inside region A, no strand of A, B or the seam enters the hole.
- **Layer order:** no layer-2 strand of any region is printed before a layer-1 strand of any region.
- A single-region drawing reproduces today's output exactly.

---

## T7.7 Regions in share links, files and swatch codes

**Implementation**
1. **State v4 (C12)** gains `regions: Region[] | null`. Extend the sanitiser in `site/src/ui/share.js`: at most 16 regions; each region's settings are sanitised with **its card's** `sanitize`; unknown cards are dropped (with a note).
2. **Share links:** if the encoded state with regions would exceed the URL limits the app already handles, say so the way the app does today for large drawings. **Do not truncate silently.**
3. **Swatch code and file name** (`site/src/ui/file-name.js`): for multi-region pieces, use `regions-<hash>`. The G-code header lists every region: colour, card and settings hash.
4. **Migration:** v4 states without `regions` work unchanged.

**Tests:**
- Round-trip: state → link → state keeps every region and its settings.
- Garbage regions are dropped without throwing.
- File names are stable for the same state.
