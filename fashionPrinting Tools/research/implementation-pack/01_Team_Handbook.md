# Team handbook

How the FilaFabric library team works: who decides what, how a ticket travels from *Ready* to *Merged*, the code standards every change must meet, and what "done" means. If this handbook and a ticket disagree, ask the reviewer before going on.

---

## 1. Roles

| Role | Who | Responsibilities |
|---|---|---|
| **Product owner** | Luis | Decides scope and behaviour, confirms the plan's **[call]** items, merges approved pull requests into `library`, decides when `library` goes live (merging it into `main`), and prints and judges the swatches. |
| **Technical lead and reviewer** | Claude (in Luis's Claude Code session) | Writes and maintains this pack and the tickets, reviews every pull request against [04_Review/Review_Checklist.md](04_Review/Review_Checklist.md), keeps the architecture coherent, answers questions, and updates the [ticket board](04_Review/Ticket_Board.md). |
| **Implementers** | The development team | Pick a *Ready* ticket, implement it with tests, check it in a browser, open a pull request using the template, and address review comments. |

---

## 2. Workflow

### 2.1 Branches and merging

FilaFabric is published by Cloudflare Pages: **every push to `main` goes live** at <https://filafabric.pages.dev>, while any other branch gets its own preview link. **Nothing goes live until the whole plan is implemented**, so all work collects on an integration branch. Luis confirmed this workflow on 26 October 2026, and the repository's `CLAUDE.md` says the same.

- **`library`** is the integration branch. Every ticket branch starts from it, and every pull request goes into it. Its Cloudflare preview link shows the library as it grows.
- Work on **one branch per ticket**, named `t<ticket>-<short-name>`, for example `t0-1-card-metadata` or `t2-4-rings-flat`.
- Push the branch and open a **pull request into `library`**. Cloudflare's preview link for the branch is what the reviewer and Luis look at in the browser.
- **Never push to `library` or `main` yourself.** Luis merges approved pull requests into `library`, with a squash merge.
- **`library` → `main`:** only Luis merges it, once, when the whole plan is finished. That is the go-live.
- Before starting a ticket, update your branch from `library`, so you build on everything already merged.

### 2.2 Ticket lifecycle

| State | Meaning | Who moves it |
|---|---|---|
| Ready | Dependencies merged; can start. | Reviewer |
| In progress | Someone owns it. Put your name on the board. | Implementer |
| In review | Pull request open, template filled, CI-equivalent checks (`npm test`) passing. | Implementer |
| Changes requested | The review left blocking comments. | Reviewer |
| Approved | Ready to merge. | Reviewer |
| Merged | In `library` (it goes live only when `library` is merged into `main` at the end). | Luis |
| Printed | (cards only) A swatch exists and is recorded (Phase 8). | Luis |

Rules:
- **One ticket per pull request.** Keep each PR under roughly 600 changed lines, excluding generated snapshots; if a ticket grows larger, ask to split it.
- **Do not start a ticket whose dependencies are not merged.** The board lists them.
- **Do not change behaviour a ticket does not ask for.** If you find a bug elsewhere, note it in the PR and on the board as a new item; don't fix it in passing.

### 2.3 Questions

- Ask early. Open a draft pull request, or an issue titled `Q: T1.2 …`, describing what you would do and why.
- **Product questions** (what the user sees, names, defaults) go to Luis. **Technical questions** go to the reviewer.
- Never guess on anything that changes what gets printed.

### 2.4 How a review works

1. Open the PR with the [template](04_Review/Pull_Request_Template.md) fully filled in: ticket ID, summary, test evidence, snapshot changes explained, screenshots, preview link.
2. The reviewer reads the ticket, then the diff, runs `npm test` on the branch, opens the preview link, and checks the [checklist](04_Review/Review_Checklist.md).
3. Every comment is labelled:
   - **Blocking** must be fixed before approval.
   - **Should** is expected to be fixed, or answered with a reason.
   - **Nit** is optional.
4. Push fixes as new commits; don't force-push during review. Re-request review when done.
5. On approval, Luis merges into `library` with a squash merge whose message is the ticket ID and title.

### 2.5 Commit messages

Write them in the imperative, saying what the change does and why, with the ticket ID first. For example: `T1.3 Merge the zigzag tiles into Zigzag net and drop the preset alias`. Small commits are welcome on a branch; the squash merge combines them.

---

## 3. Engineering standards

### 3.1 Architecture rules

These follow how the code is already built. [02_Architecture_and_Contracts.md](02_Architecture_and_Contracts.md) gives the details.

1. **The engine is pure.** `site/src/engine/` takes settings and geometry in and returns geometry, moves and G-code out.
   - No DOM, no `window`, no globals, no `Math.random`.
   - It runs in Node tests and in web workers, so it must stay environment-free.
2. **The registry is data.** `site/src/ui/designs.js` and the files it gathers (`more-designs.js`, `line-designs.js`, `pub-designs.js`, `basic-designs.js`, `svg-design.js`) are plain data plus pure functions, and are tested in Node. No DOM there either.
3. **UI components are small classes.**
   - Panels and sections extend `Control` in `site/src/ui/panels.js` (for example `SectionFold`, `BackingCard`, `DesignPanel`). New UI pieces follow the same pattern: one class per visible component, constructed with a host and a spec, with `update()` and `redraw()`.
   - Do not build deep class hierarchies: one level of `extends Control` is the norm.
   - Prefer passing plain objects over inheritance.
4. **New designs follow the existing card pattern.**
   - An engine generator `xxxLayers(boundary, options) → { layers, …extra }` (see `site/src/engine/crosshatch.js`).
   - A registry entry made with `layered({ … })` and `defineControls({ ranges, defaults, enums, bools, presets, describe })` (see `site/src/ui/more-designs.js`).
   - Designs with their own Z (raised) return strands with `z` themselves, as `relief.js`, `fringe.js` and `pillars.js` do.
5. **Option tables are frozen objects** of `{ label, hint, … }`, keyed by stable IDs, as `DIRECTIONS` in `crosshatch.js` and `FIELDS` in `fields.js` are.
6. **One owner per concern.** Crossing heights belong to `crossings.js`, carriers to `backing.js`, pattern fields to `picture.js` and `fields.js`, and SVG meaning to `drawing.js`. Extend the owner; do not re-implement it inside a generator.

### 3.2 Determinism and compatibility

- **The same settings always give the same G-code, byte for byte.**
  - Random layouts use the seeded generator in `site/src/engine/rng.js`.
  - Seed by grid-cell coordinates where a layout must regenerate identically when resized or cropped.
- **Setting keys are permanent.**
  - Rename labels freely; never rename or reuse a key.
  - A new key needs a default, so older links still open.
  - Remove a key only through the migration in T0.6.
- **Every share link, saved file and swatch code must keep opening.** Old design IDs are resolved by the migration map (T0.6). Breaking one is a blocking review finding.
- **Sanitise everything that comes from a link or file:** ranges, enums and sizes. Never trust input.

### 3.3 Units, coordinates and limits

- Lengths are in **millimetres**. UI angles are in **degrees**; convert at the engine boundary if a function needs radians, and say so in its JSDoc.
- A swatch spans `x ∈ [0, width]`, `y ∈ [0, height]`, as created by `boundaryFor(width, height, outline)` in `site/src/engine/layers.js`. SVG input is converted into this frame by `site/src/engine/svg-parse.js`; do not re-flip it.
- Respect `MAX_MOVES` and the existing preflight (`bedFitErrors`, `PreflightError`, `ConfigError`); never bypass them.
- **Printing settings come from the profiles, not from cards.** That covers temperatures, speeds, fan, retraction and layer height. A card may only *scale* within limits the profile allows; new per-segment fan behaviour uses move classes (`fanFor(cls)` in `site/src/engine/gcode.js`).
- The only firmware command a feature may add is `M600` for colour changes, through `pauseBefore` on a strand (`site/src/engine/emit.js`). Anything else needs the reviewer's approval.

### 3.4 Code style

- Match the surrounding code: ES modules, 2-space indent, single quotes, semicolons, arrow functions for small helpers, `const` by default.
- **Comments explain why, in plain sentences,** the way the existing files do (see the header of `site/src/engine/drawing.js`). Every new module starts with a short header comment saying what it is for. Every exported function gets a JSDoc block with its parameters and return shape.
- UI copy is in **British English** (*colour*, *centre*), in plain language, and the label says what the control does to the fabric (Plan §4.4).
- **No new dependencies** without Luis's approval. Third-party code goes under `site/vendor/` with its licence, and only after the reviewer has checked the licence. This applies, for example, to the Tactile isohedral library in T2.12.
- No commented-out code, no `console.log`, no feature flags left behind.

### 3.5 Performance

- Generating a 100 × 100 mm swatch at default settings should feel instant, roughly under a second in Node on a laptop. If a generator is slower, say so in the PR with a measurement.
- Thumbnails and option pictures are drawn lazily (`picture` in `layered()`); keep it that way.
- Heavy work runs in the existing workers (`site/src/ui/panel-worker.js`, `site/src/ui/swatch-worker.js`); the main thread only renders.

### 3.6 Accessibility and UI quality

- Every interactive element is keyboard reachable and has an accessible name.
- Badges and states carry text, not only colour.
- Check the layout at desktop width and at phone width (the app already has a phone layout).
- Visible text is never cut off, overlapping or unreadable.

---

## 4. Testing

| Check | Command or place | When |
|---|---|---|
| Unit and geometry tests | `npm test` (Node's built-in runner, `node --test`) | Every PR. Must pass. |
| Output snapshots (added in T0.0) | `npm run snapshots` updates `dev/tests/snapshots/`; the test compares | Every PR that touches generation. Never update without explaining each changed snapshot in the PR. |
| Loop-pile golden file | `npm run golden` | Only when a ticket intentionally changes loop-pile output. |
| Browser check | `npm run serve` (port 5173), plus the branch's Cloudflare preview link | Every PR that changes anything visible. Attach screenshots. |
| Print check | Phase 8 swatch protocol | Every new or changed card, before its *Untested* badge is removed. |

**How to write tests:**
- Put them in `dev/tests/<module>.test.js`, using `import test from 'node:test'` and `import assert from 'node:assert/strict'`.
- Get printer and material profiles from `defaultProfiles()` in `dev/tests/helpers.js`; look at `dev/tests/crosshatch.test.js` for the style.
- Name each test as a sentence stating the behaviour, for example *"every pair of layers crosses, so the layers hold together"*.
- **For every new generator, test at least:**
  - output stays inside the boundary;
  - every intended path family survives clipping;
  - the result is one connected component (or exactly what the card says);
  - the same settings give the same output;
  - the extremes of every slider range still produce a valid result;
  - an option that changes geometry actually changes it.

---

## 5. Definition of Done (every ticket)

- [ ] Everything the ticket asks for is implemented, and nothing else.
- [ ] Tests added or updated as the ticket lists; `npm test` passes on the branch.
- [ ] Snapshot changes, if any, are listed and explained in the PR.
- [ ] Checked in a browser, at desktop and phone width, with screenshots in the PR; no console errors.
- [ ] Old share links and saved files still open (where the ticket touches settings or IDs).
- [ ] UI copy follows the plan's wording rules.
- [ ] JSDoc and header comments added for new modules and exports.
- [ ] The [ticket board](04_Review/Ticket_Board.md) is updated, and any decision taken is noted in the PR.
- [ ] Reviewer approval, and Luis's merge.

---

## 6. Glossary

| Term | Meaning in this project |
|---|---|
| **Card** | One entry in the library: a style with its picture, panel and generator. Registered in `site/src/ui/designs.js` and the files it gathers. |
| **Shelf** | Flat (2D), Layered (2.5D) or Raised (non-planar): how a card's fabric is built. |
| **Family (style family)** | Cards that are the same drawing built different ways, for example Rings. They are *variants* of each other and share one settings object (`settingsKey`). |
| **Path family** | One set of related paths inside a design, for example the first or second direction of a grid. Recorded on each strand as `family` (T0.2). |
| **Strand** | One continuous printed path: `{ id, layer, kind, name, pts: [{ x, y, z, flow? }] … }`. |
| **Bead width** | How wide one extruded line is (the profile's `extrusion_width`). |
| **Pass spacing** | Distance between neighbouring passes of one wide line; usually 0.8 × bead width, so they overlap and bond. |
| **Crossing** | Where two strands meet. It can be fused, separated, lifted or channelled. |
| **Tie** | A short connector the engine adds to join separate pieces (`connectStrands`, named "Structural tie"). |
| **Carrier / backing** | A supporting mesh that holds a motif together (`site/src/engine/backing.js`). |
| **Seam** | A printed line along the border between two colour regions (T7.6). |
| **Construction report** | What actually prints, derived from the final strands (T0.3). |
| **Z envelope** | Lowest and highest deposition height in a result. |
| **Side view** | A section through the generated strands showing their heights (T0.4). |
| **Region** | An area of an imported SVG drawn in one colour, which can get its own card and settings (Phase 7). |
