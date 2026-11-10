# Deploying the site

The live site is https://filafabric.pages.dev. Cloudflare Pages builds it from the `main` branch of
`github.com/telenaco/filafabric`: every push to `main` publishes.

## Cloudflare settings (Workers & Pages → filafabric → Settings → Build configuration)

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `site` |
| Build command | *(empty)* |
| Build output directory | *(empty)* |

The site is static: whatever is in `site/` is served as it is. The study API lives in `site/functions/`.

## Layout this relies on

The repository root **is** this project: `site/`, `dev/` (tests and tools), `docs/`, `research/`.
There must be no extra copy of the app in a subfolder (for example `fashionPrinting Tools/`): the root
directory above is `site`, so Cloudflare looks for `site/` at the top of the repository.

## Pushing from another machine

1. Work in a clone whose root is this project (`git clone https://github.com/telenaco/filafabric.git`), not in a
   parent repository that holds this project in a subfolder. A subfolder push puts the app in the wrong place
   and the build fails with "Output directory ... not found".
2. `git pull` first, then `npm test` (it must pass), then `git push origin main`.
3. If the build fails, open the deployment in Cloudflare and read the log. The first lines say whether the
   root directory was found.

## When a change touches `site/src` or the printer profiles

Run these before committing, or two tests fail on stale files:

```
npm run precompute        # regenerates site/precomputed after an engine or UI change
git add -A site
npm run source:snapshot   # refreshes the source archive the site offers
```
