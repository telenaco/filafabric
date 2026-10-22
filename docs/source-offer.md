# Local source offer and publication decision

The pinned Arachne kernel retains its upstream AGPL licence, notices and matching
engine build sources in `vendor/arachne/`. FilaFabric's application-wide publication
licence is an **owner decision still pending**. The source download and this tooling
do not select a licence for the application. Resolve that decision before publishing
the Arachne-enabled application; retain the upstream licence, notices and source offer.

## Rebuild and verify

1. Review intended new source files and stage them explicitly in Git. The tooling
   never stages files and never scans untracked files. A commit is not required.
2. Run `npm run source:snapshot` after all intended source edits are finished.
3. Run `npm run source:verify` before publishing. It fails if current source, the
   archive inventory/content, its reproducible metadata, the manifest, or the pinned
   engine/source pair differ. `npm test` includes isolated source-offer fixture tests and a read-only currentness
   check against the shipped offer. Rebuild after source edits before running the full suite.

The archive includes the **current working-tree content** of tracked/staged paths
selected by the explicit public-source directory/root-file allowlist in
`tools/source-bundle.mjs`. Private untracked files are excluded even inside `src/`.
Review source before staging it: a deliberately staged file within an allowed
directory is considered intended public source. Removed-but-still-tracked files,
symlinks and engine provenance mismatches fail rather than silently dropping source.
The allowlist intentionally excludes unrelated root files and secret configuration.

`vendor/arachne/filafabric-source.manifest.json` records every included path, size
and SHA-256 plus the archive checksum. Both the generated integration archive and
its manifest are excluded from the archive to avoid circular self-hashes. The
matching upstream `corresponding-source.tar.gz` **is included** and is checked against
`provenance.json`, as are the exact pinned kernel bytes.

Text source CRLF endings are normalized to LF by documented extension; the pinned
kernel and binary assets remain byte-exact. Archive paths use sorted byte order,
regular-file mode 0644, zero uid/gid and timestamps, blank owner names and zero gzip
mtime. Identical canonical source produces identical output on the same Node/zlib
toolchain. The verifier rejects missing, extra, duplicate, changed or reordered
archive entries; it also regenerates the archive bytes to check metadata. Use the
same Node/zlib toolchain for rebuilding and verification.
