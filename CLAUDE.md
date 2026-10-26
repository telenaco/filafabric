# Working in this repository

- **Publishing:** Cloudflare Pages builds this repository. `main` is the production branch: every push to `main`
  publishes the live site (https://filafabric.pages.dev). Any other branch only gets a preview link.
- **Work on a branch and open a pull request into `main`.** Use one branch per ticket, named `t<ticket>-<short-name>`
  (for example `t0-1-card-metadata`), and one ticket per pull request. Cloudflare's preview link for the branch is what
  gets reviewed in the browser.
- **Never push to `main` directly.** Claude, working in the owner's sessions, reviews each pull request against the
  implementation pack's review checklist; the owner merges approved pull requests into `main` (squash merge). This
  replaces the earlier rule of pushing straight to `main` (changed 26 October 2026).
- Before asking for review: `npm test` must pass, UI changes are checked in a browser (`npm run serve`, port 5173) and on
  the branch's preview link, and the pull request uses the pack's template, with every output-snapshot change explained.
- The site is static (no build step): `index.html`, `src/`, `profiles/` and `vendor/` are served as they are.
