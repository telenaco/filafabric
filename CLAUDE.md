# Working in this repository

- **Publishing:** Cloudflare Pages builds this repository. `main` is the production branch: every push to `main`
  publishes the live site (https://filafabric.pages.dev). Any other branch only gets a preview link, so the owner
  never sees it on the live site.
- **So commit and push straight to `main`.** The owner has asked for all work to land on that one branch so the
  latest version is always live. Don't start feature branches or pull requests unless asked.
- Before every push: `npm test` must pass, and check UI changes in a browser (`npm run serve`, port 5173).
- The site is static (no build step): `index.html`, `src/`, `profiles/` and `vendor/` are served as they are.
