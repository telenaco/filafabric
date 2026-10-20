# Anonymous export and build-failure statistics

The application records small JSON records for exports and build failures in a Cloudflare D1 database, using Pages Functions. It does not rewrite a shared JSON file: simultaneous events insert separate rows, so they cannot overwrite one another. A fresh random ID belongs to an event, never to a visitor, and makes a repeated request idempotent.

Collection follows the owner's chosen approach: count exports and build failures after a clear notice. The notice appears above the export buttons only when the server reports that collection is configured. Nothing is sent before that notice is visible. The full data-flow explanation is in `study.html`.

## One-time Cloudflare setup

1. In the Cloudflare account hosting `filafabric.pages.dev`, create a D1 database named `filafabric-study`.
2. Open that database's SQL console and execute `migrations/0001_study_exports.sql`.
3. In the Filafabric Pages project's Settings → Bindings, add a D1 binding named **STUDY_DB**, pointing to this database.
4. Add the production environment variable **STUDY_ENABLED** with value **true**.
5. Redeploy the Pages project so its Functions receive those bindings. Keep preview deployments unbound unless deliberately testing with a separate database.
6. Open `/api/study/status`: it should return `{"enabled":true}`. The research notice should now appear above Export. Export one small swatch, then check that `export_events` has one row.

No credentials belong in this repository or frontend. Without the binding and enable flag, collection stays off and exports keep working. Set `STUDY_ENABLED=false` and redeploy to stop collection.

Cloudflare documents [D1 bindings for Pages](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases), [Functions deployment](https://developers.cloudflare.com/pages/functions/get-started/), and [routing](https://developers.cloudflare.com/pages/functions/routing/). `_routes.json` limits Functions to `/api/study/*`; static pages do not invoke the collector.

## Reading the results

Use Cloudflare's authenticated D1 SQL console. `reference/study-statistics.sql` contains queries for most-exported designs, daily exports, shape/pattern combinations, dimensions, layer thickness and build failures by design and error code. Download queries filter event types explicitly so failures never count as downloads. There is deliberately no public endpoint that reads study records. D1 can also be exported through Cloudflare's tools for offline analysis.

Each row stores the UTC day, design, event type, dimensions and allowlisted properties. Build failures use event type `build-error` and keep only a fixed error code (`crossing-limit`, `move-limit`, `bed-fit`, `invalid-settings`, `empty-geometry` or `unknown-build-error`) and optional numeric `limit` and `observed` values. For example, a crossing-limit failure can record a limit of 120000 and the observed crossing count, alongside anonymous design settings. SVG complexity can include numeric `svgPaths`, `svgPoints` and `svgGuides` counts. No SVG geometry is collected.

The server validates and filters every record again before a prepared SQL insert. It never reads request IPs, user-agent headers or cookies into the database. Raw error messages, stack traces, filenames, SVG paths/content, image pixels, profile names, document titles and share URLs are excluded. Build failures fit the existing `properties_json` field; no additional migration is required.

Requests must be same-origin JSON. The collector retains at most 8 KiB of record bytes before parsing and stops reading on overflow, including requests with missing or incorrect length headers. Event IDs are normalized UUIDs, so resending the same ID does not create another row; a new event gets a new ID.

## Local verification

Run `node --test tests/study.test.js` with Node 22.13 or newer. The tests use Node's built-in SQLite to execute the migration, real prepared insert statements and analysis queries, and cover filtering, error categories, anonymous SVG counts, download/failure separation, duplicates, disabled collection, request limits, malformed requests and network/storage failures. Node 22 can display an experimental SQLite warning; no extra package or Cloudflare account is required for these tests.

`npm run serve` serves static files and does not run Pages Functions or bind D1. Live collection still requires the one-time Cloudflare setup above. The status endpoint checks the binding and enable flag; the test export and SQL row check confirm that the migration and writes work in the deployed environment.

## Interpreting the data

Export counts describe export actions, not unique participants, successful printing or verified file saves. Repeated exports count separately; blocked/offline requests are absent. Browser-reported events can be spoofed, so use these data as usage observations rather than authenticated participant records. Settings JSON exports are marked separately from G-code. Events generated before collection is enabled are not uploaded later.

Build failures describe settings that could not generate a build in that attempt. They do not prove that a shape is always unbuildable or that printing failed physically. Consecutive identical failures are suppressed locally by the application rather than linked to a participant in storage; server UUID deduplication separately protects against replaying the same event. Treat failure counts as observations of problem combinations, not as a complete error rate across all build attempts.

The application does not control Cloudflare's infrastructure logs. Describe the hosting provider's network processing separately in the study's participant information; do not claim that serving a website requires no IP processing anywhere.
