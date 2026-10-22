# Arachne WebAssembly engine

This unmodified single-threaded kernel is from [Three_Slicer](https://github.com/kimgh06/Three_Slicer), commit `8ee934d183a9f60ab09bab9e05cd7bb747c6a51a`, `packages/engine/src/slicer_core.js` (SHA-256 recorded in `provenance.json`).

It includes the real OrcaSlicer/Cura-derived Arachne variable-width wall engine. Copyrights and credits in the upstream sources are retained. This is not a bit-identical port of PrusaSlicer's current generator. FilaFabric uses only the resulting flat geometry and widths; the vendor's G-code is discarded.

Licence: **GNU AGPL version 3 or later**. See [LICENSE.txt](./LICENSE.txt).

The matching source, third-party headers, modifications, build scripts and upstream provenance are available without charge in [corresponding-source.tar.gz](./corresponding-source.tar.gz). Extract it and consult `packages/wasm-core/build.sh` and `packages/PROVENANCE.md`. Before invoking the build, create its output directory from the extracted root with `mkdir -p packages/engine/src`. The archive corresponds exactly to the pinned build; it does not depend on a moving branch. The build script documents its Emscripten/Boost/Eigen/CGAL toolchain and macOS paths; install that toolchain or adjust those paths for the build host.

FilaFabric's integration source is served directly as ES modules: `src/engine/adaptive-solids.js`, `src/engine/svg-solids.js`, `src/engine/design-export.js`, and the UI worker modules. No additional compilation step is required for those JavaScript modules. See the app's source offer for a complete local source snapshot.
