# Working in this repository

- **Layout:** `site/` is the website and the only folder Cloudflare serves. `dev/` holds the tests and tools,
  `docs/` the project documents, `research/` the reports, the implementation pack and the (git-ignored) papers.
  `local/` and `_to-delete/` are git-ignored. Keep new website files inside `site/`.
- **Publishing:** Cloudflare Pages builds this repository. `main` is the production branch: every push to `main`
  publishes the live site (https://filafabric.pages.dev). Any other branch only gets a preview link.
- **Nothing goes live until the whole pattern-library plan is implemented** (owner's instruction, 26 October 2026).
  All work collects on the integration branch `library`, which has its own Cloudflare preview link. `library` is
  merged into `main` once, when the plan is finished, and only by the owner.
- **Work on a branch and open a pull request into `library`.** Use one branch per ticket, named
  `t<ticket>-<short-name>` (for example `t0-1-card-metadata`), and one ticket per pull request. The branch's preview
  link is what gets reviewed in the browser.
- **Never push to `main` or `library` directly.** Claude, working in the owner's sessions, reviews each pull request
  against `research/implementation-pack/04_Review/Review_Checklist.md`; the owner merges approved pull requests
  into `library` (squash merge).
- Before asking for review: `npm test` must pass, UI changes are checked in a browser (`npm run serve`, port 5173) and on
  the branch's preview link, and the pull request uses the pack's template, with every output-snapshot change explained.
- The site is static (no build step): everything in `site/` is served as it is.
