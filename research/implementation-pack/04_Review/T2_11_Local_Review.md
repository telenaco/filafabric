# T2.11 — Isohedral tiles: local review

- **Decision:** Luis approved using TactileJS on 27 October 2026.
- **Licence:** upstream repository metadata and its included `LICENSE` declare BSD 3-Clause. The exact upstream licence is vendored; no demo dependencies are included.
- **Pin:** `isohedral/tactile-js` commit `fd58ec372a4398e3dfc22663d120da186790834e`; provenance and source hash are recorded under `site/vendor/tactile/`.
- **Implementation:** `site/src/engine/isohedral.js` builds and deduplicates Tactile prototile edges, clips to the boundary, adds an inset edge closure and marks native shared nodes. The card exposes 12 curated Tactile family IDs and six bounded shape controls; only parameters supported by the selected family are passed through. Symmetry hints are explicitly predictions, not measured material results.
- **Checks:** the five named starter families and all 12 curated choices produce one flat component without automatic ties at defaults. Shared edges are deduplicated before trail walking. Shape changes affect output.
- **Status:** local, not pushed or merged. Physical behaviour is not validated.
