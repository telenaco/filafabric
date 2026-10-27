# T0.2 Strand provenance report

Implemented on `t0-2-strand-provenance`, based on `1074b136`.

## Changes

- Both `layersToStrands` branches assign native family/role/source, accept named families, and honor carrier metadata carried on backing layer arrays or individual polylines.
- `layeredResult` accepts source and families, including `extra.families`; the UI layered factory forwards build families and its card ID.
- Structural ties receive `family: ties`, `role: tie`, and their originating strand source. Internal tie recognition uses role in fabric-result, travel, network, and stack.
- `backingStack` preserves its array return shape and every original point/order while attaching carrier metadata. Backing meshes and reinforcement grids have carrier roles and carrier-1/carrier-2 families.
- `finishFabric` normalizes missing family/role for older and raised generators. Existing provenance always wins. Source remains optional where unavailable.
- Travel merging, network reconstruction and row-fragment chaining respect family/role/source identity. Existing spreads already preserve provenance during clipping, simplification, ordering and both crossing resolution modes; no redundant crossing changes were needed.
- Stacked copies retain provenance; rotated extra passes use the original family plus `-r`.

## Validation

Focused command:

`node --test dev/tests/provenance.test.js dev/tests/travel.test.js dev/tests/network.test.js dev/tests/backing-mesh.test.js dev/tests/stack.test.js dev/tests/design-snapshots.test.js`

Initial focused run: **82 tests passed, zero failures**. Subsequent strengthened provenance run: **6 tests passed**, including direct family/role inspection of every final strand for every ready card and preset. Final focused rerun: **82 tests passed, zero failures** (16.95 seconds).

New tests cover default/named families in both conversion branches, source propagation, tie metadata, meander backing, two carrier layers, backing mesh, clip/simplify/order/crossing preservation, endpoint and intersection joins across each differing provenance field, repeated/rotated passes, and all 31 ready cards/all presets.

### Snapshot exception and print invariance

The coordinator authorized changing **only `families`** in C13 snapshots because this ticket introduces that metadata. Before writing any updates, generated all cases into memory and strictly compared each object excluding only families:

`assert.deepEqual(actual.map(({ families, ...v }) => v), old.map(({ families, ...v }) => v))`

Only after every card passed were the pending family metadata updates written. Repeated the same strict comparison against `git show HEAD:<snapshot path>` after writing: **31 files / 133 cases: only families differ from HEAD**. This includes exact G-code SHA-256, settings hash, strand/move/tie counts, extrusion distance, and Z range. No printable field changed. Snapshot regression tests additionally compare generated summaries including the intended new families.

`git diff --check` passed. Full suite is reserved for the coordinator's final batch. No source archive regeneration, pushes or merges were performed.

## Limitations / follow-up context

Final native card outputs all carry family and role. Optional source is available for the layered factory and explicit layeredResult callers; older generators may omit source. Post-generation brim contours and brim connections (`brim.js` lines 203, 267, 287) still create untagged strands; coordinator explicitly scoped this ticket to vanilla card outputs and will consider final export/preview postprocessors in T0.3. No scope expansion or print metric change was made for those paths. Source archive baseline failure is accepted by the coordinator and was not regenerated.

