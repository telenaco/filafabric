# Review checklist

The reviewer goes through this for every pull request. **Implementers: run through it yourselves before asking for review;** most comments come from these items. Each finding is labelled **Blocking**, **Should** or **Nit** ([handbook §2.4](../01_Team_Handbook.md#24-how-a-review-works)).

## 1. Scope
- [ ] The PR implements exactly one ticket, and all of it. Anything not done is listed in the PR with a reason.
- [ ] No unrelated changes (formatting sweeps, renames, refactors the ticket didn't ask for).
- [ ] Decisions taken during the work are written in the PR (and on the board), including any **[call]** defaults used.

## 2. Architecture and contracts
- [ ] Engine code is pure: no DOM, `window`, globals or `Math.random`; it runs under `node --test`.
- [ ] Registry code is data plus pure functions; UI components follow the `Control` pattern in `panels.js`.
- [ ] Contracts C1–C13 ([architecture](../02_Architecture_and_Contracts.md)) are respected. A contract change was agreed before the PR.
- [ ] The owner module was extended, not duplicated: crossings in `crossings.js`, carriers in `backing.js`, patterns in `picture.js` and `pattern-effects.js`, SVG meaning in `drawing.js`.
- [ ] Every new strand carries `family`, `role` and `source` (C3), and no path through the pipeline drops them.

## 3. Determinism and compatibility
- [ ] The same settings give byte-identical G-code; randomness only comes from `createRng`, seeded by grid cell where the ticket says.
- [ ] No setting key renamed or reused; every new key has a default; old links and saved files open (migration tests where IDs or keys changed).
- [ ] Snapshot changes are listed in the PR, each with an explanation. Unexplained snapshot changes are **Blocking**.
- [ ] Inputs from links and files are sanitised: ranges, enums, array lengths, sizes.

## 4. Printing correctness and safety
- [ ] Preflight (`bedFitErrors`), `MAX_MOVES` and `ConfigError` paths are not bypassed.
- [ ] Every strand stays inside the boundary (within the boundary's tolerance); nothing prints in holes.
- [ ] The construction report shows no lost family and, unless the ticket allows it, one component without ties.
- [ ] Z envelope as the card says; ramps within the stated slope; no nozzle-body conflicts (`clearanceOrder` where required).
- [ ] Speeds, temperatures and fan come from the profile or the documented per-result overrides; no new firmware commands except `M600` through `pauseBefore`.
- [ ] Move classes are existing ones (`base`, `supported`, `rising`, `falling`, `unsupported`, `travel`).

## 5. Tests
- [ ] The tests the ticket lists exist and assert behaviour (not just "runs without throwing").
- [ ] The card checklist ([Phase 2 scaffolding §4](../03_Tickets/Phase2_New_Flat_and_Layered_Cards.md#shared-scaffolding-for-every-new-card)) is complete for new cards.
- [ ] Each test name reads as a sentence about behaviour.
- [ ] `npm test` passes on the branch; the reviewer re-runs it.

## 6. Performance
- [ ] A 100 × 100 mm default swatch generates in about a second or less; slower generators have a measurement and a reason in the PR.
- [ ] Thumbnails and option pictures stay lazy; heavy work stays in the workers.

## 7. UI, copy and accessibility
- [ ] Panel sections follow Contract C2 (`panelOrderErrors` is empty).
- [ ] Labels say what the control does to the fabric; help is one plain sentence; British spelling.
- [ ] Every interactive element is reachable by keyboard and has an accessible name; badges carry text.
- [ ] Screenshots at desktop and phone width; no overlapping, cut-off or unreadable text; no console errors.
- [ ] Every claim from a paper is phrased as the paper's result ("in Lu's NinjaFlex meshes …"), never as a FilaFabric property.

## 8. Docs and licensing
- [ ] New modules have a header comment; exported functions have JSDoc.
- [ ] The plan's card row and the ticket board are still accurate (updated in the same PR if needed).
- [ ] No third-party code without a licence check and Luis's approval; vendored code under `site/vendor/` with its licence.
- [ ] No copied text from papers beyond short quotes; no paper PDFs in the repository.
