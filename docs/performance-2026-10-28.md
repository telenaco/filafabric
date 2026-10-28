# Slicing and preview performance — 28 October 2026

## Measured bottlenecks

Local Node CPU samples on 100 × 100 mm defaults, MK3S/Foamy, full export pipeline. These are indicative single-run timings, not hardware-independent promises. Profiling scripts live in the session's temporary directory; no runtime instrumentation is shipped.

| Card | Generation | Main cost |
|---|---:|---|
| Wave net | 1.75 s | Six complete G-code writes, about 0.70 s combined |
| Voronoi cells | 8.23 s | Delaunay triangulation about 5.78 s; sites/relaxation about 0.70 s |
| Rotating squares | 6.71 s | Greedy path ordering about 3.93 s; six G-code writes about 1.02 s |

The sampled exports each wrote G-code six times and built construction reports twice. `orderStrands` scans all remaining strands (and closed-loop vertices) for each selection. Voronoi dart throwing, nearest-site relaxation and Bowyer–Watson triangulation use broad scans. These are better first targets than adding threads around the existing loops.

Browser measurements: preview geometry/buffer construction took about 8–17 ms for the sampled Wave/pearl paths. Cold worker round trips included substantial module/thumbnail initialization. The UI already uses a Web Worker for ordinary full-size builds, recreates it for each request and aborts obsolete jobs; the 3D sample branch still generates synchronously. The renderer is WebGL; more CPU workers will not by themselves improve GPU drawing.

## Pre-generated defaults

Implemented at the owner's request after the profiling tasks. `npm run precompute` produces complete geometry-checked reference toolpaths and preview data for all visible default cards at 100 × 100 mm. The fixed reference setup is Prusa MK3S / Filaflex 95A Foamy, 0.2 mm layers and default perimeter settings. **Browsing ignores the selected printer and filament**, so choosing another setup does not discard these samples. Reference geometry, time and filament are labelled as such.

- Only the selected card's gzip asset is downloaded. The entire library is not fetched at startup.
- A 12 MB compressed-byte LRU avoids repeat downloads while allowing result objects to be independently reconstructed.
- The reference lookup matches design settings, dimensions and print options, ignoring the selected printer/material. Edits to the design, artwork, dimensions or non-default print settings use normal slicing.
- Actual machine-output lookup includes the complete printer and filament/calibration. Reference results are marked and excluded from all ready-G-code/export shortcuts. Pressing Export after browsing always builds for the selected machine/material; it can then reuse that actual result on repeated export.
- Source fingerprint, payload checksum and input-key checks reject mismatches. Missing/corrupt assets fall back to the existing worker; cancellation is retained.
- Cached G-code is the actual generated output, not thumbnail geometry. Typed playback arrays are restored for the ordinary 3D/2D playback and export pipeline.
- Both the 3D view and 2D print-order view can use the reference data. The sample is not placed in the selected-printer estimate cache or ready-export cache. Explicit generation/export uses the selected setup instead.
- `default-cache.test.js` checks source freshness, coverage, checksums, profile/settings misses and exact fresh/cached G-code. Regenerate after changing engine/UI code. This cache does not accelerate edited designs.
- The entire compressed library is about 82 MB on disk, with per-card downloads rather than a startup bundle. The smallest default assets are about 10–40 KB and the densest roughly 5 MB. First-view performance depends on download speed; local revisits reuse compressed bytes.
- Gzip models are generated output and excluded from the software source archive to keep that file within static-host limits. Their generator, loader and index remain available in the archive.

## Remaining to-do, in priority order (not started)

- [ ] Finalize G-code/time estimation once after all colour, perimeter and SVG operations; retain required geometry checks at dependency boundaries.
- [x] Replace quadratic nearest-strand/seam searches with deterministic spatial nearest-neighbour searches, preserving ties and precedence. Done for `orderStrands` (a bucket grid of start points; the 94 unchanged card snapshots confirm the same picks).
- [x] Optimize Voronoi sites and triangulation with spatial indexing and an efficient triangulator. Verify topology and seeded output explicitly. Done: sites and Lloyd use a bucket grid (the same seeded sites as before), and each cell is the box cut by the bisectors of its near sites (the same walls as Bowyer–Watson; the Delaunay layer now leaves out the pairs whose shared wall lies outside the piece). Voronoi cells: 100 mm 8.2 s → 1.9 s, 200 mm 6 s, 400 mm 23 s; the cell limit is 400,000 (a 1 × 1 m garment).
- [ ] Keep a warm worker or worker pool and build thumbnails lazily. Preserve prompt cancellation and isolate jobs so stale results cannot replace newer settings.
- [ ] Cache intermediate geometry by dependency (for example, temperatures need not regenerate a Voronoi tessellation).
- [ ] Use a small adaptive worker pool for independent SVG regions or separate comparison swatches. Crossings and nozzle-clearance dependencies must be merged globally; arbitrary layer/strand parallelism is incorrect for raised patterns.
- [ ] Transfer packed typed preview buffers instead of cloning moves/strands and constructing hidden render layers eagerly.
- [ ] Add an explicitly labelled interactive draft preview while full validation finishes. Never export draft or unchecked geometry as final G-code.

The 140 ms slider debounce and existing large-piece 2D overview already help. More workers can increase memory/transfer costs; full CPU utilization is not the same as reduced latency for one job.
