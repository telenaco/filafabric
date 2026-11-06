# T0.0 Output snapshots of every card — local review

**Ticket:** [T0.0](../03_Tickets/Phase0_Foundations.md#t00-output-snapshots-of-every-card)
**Branch:** `t0-0-output-snapshots`, based on local `filafabric-library` (`8bec06d1`).
**Worktree:** `C:\Users\Luis\.codex\worktrees\t0-0-output-snapshots\Websites`
**Review comparison:** `git diff filafabric-library...t0-0-output-snapshots`
**Cloudflare preview / PR:** none; Luis requested local commits and local review, with no push.

## What this does

Records the current printable output of all 31 ready cards, including hidden cards, at 40 × 30 mm with the default Prusa MK3S and Filaflex 95 Foamy profiles. Each card's file contains its default followed by every preset in registry order: 133 cases in total.

The updater and test share generation and summary helpers. The test independently checks the registry's complete card and preset inventory, and reports the card/preset when an output changes. The two legacy cards use their existing app generation paths, including the pile's custom-size controls and Squiggle's uniform sampler.

## Done

- [x] Add `dev/tools/update-design-snapshots.mjs` and `npm run snapshots`.
- [x] Add one JSON array per ready card in `dev/tests/snapshots/designs/`.
- [x] Record the C13 identifiers, settings/G-code hashes, strands, moves, extrusion length, Z range, families and ties.
- [x] Hash sorted settings; remove only the generator-version banner and normalise G-code line endings. Preserve motion estimates and parameters.
- [x] Add the regression test and a small arithmetic/hash test for the summariser.
- [x] Confirm repeatable hashes and check the review checklist.
- [x] Obtain a separate read-only code review: no actionable defects found.

## Validation

- Test-first run failed because the updater module did not yet exist.
- `npm run snapshots`: 31 files, 133 cases. All snapshot files are new baselines; no existing design output was changed.
- Two consecutive snapshot-test runs: 33 passed, zero failed; 9.70 s and 9.52 s.
- Final focused run after review edits: 33 passed, zero failed; 9.39 s.
- Full `npm test`: **1,045 tests, 1,033 passed, 1 failed, 11 skipped**, in 128.42 s. The snapshot portion took 32.00 s while the full suite ran concurrently.
- Baseline before T0.0: 1,012 tests, 1,000 passed, 1 failed, 11 skipped. The failing test in both runs is `shipped source offer matches the current tracked/staged application`.

### Source archive exception

The known Windows checkout failure remains: the source tool does not normalise nested `LICENSE` files such as `site/vendor/three/LICENSE`. The archive also includes `package.json` and tracked/staged `dev/` files, so this ticket's additions require a future archive refresh after that separate repair. Luis explicitly instructed this ticket to leave the failure noted and not rebuild the archive. Neither the archive nor its manifest has changed.

### Clarification before T0.2

C13 includes `families`, currently `[]` because the existing strands lack provenance tags. T0.2 adds those tags while requiring all snapshots to remain unchanged. The reviewer should settle that conflict before T0.2, for example by allowing a `families`-only snapshot update while every G-code hash and printing metric stays unchanged. T0.0 records the actual current metadata as C13 specifies.

## Scope and checklist

No app source, profiles, dependencies, printing behaviour, links or UI changed. Browser screenshots and physical prints are not applicable to this tooling ticket. No paper PDFs were needed or committed. The ticket remains subject to Luis's local review and merge; dependent tickets have not started.
