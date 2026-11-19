# Deploy CashGap to Cloudflare Pages

The application is a static Next.js export. It needs no server runtime, environment secrets, Functions, D1 database, or API bindings.

**Production:** [cashgap.pages.dev](https://cashgap.pages.dev). **Source:** [shawalkabirchy/cashgap](https://github.com/shawalkabirchy/cashgap), branch `main`. The Pages project is `cashgap`, connected through the owner's GitHub integration. The first deployment and public verification completed October 26, 2026. The current release (commit `edf47d6`, deployment `33d66c1f`) was built from a push and publicly verified November 20, 2026. See [release metadata](qa/cloudflare-release.json) and [public smoke results](qa/deployed-smoke-results.json).

## Prepare the release

Use the Node version in `.nvmrc` and run:

```sh
npm ci
npm run lint
npm run build
npm run typecheck
npm test
npm run test:e2e
```

The deployable directory is **out**. Keep `public/_headers` in the source; Next copies it into the export. Those headers are applied by Cloudflare Pages, not the local preview server. Do not upload `.next`, source files, customer data, or `node_modules` as the website.

## Production configuration

The existing project has a GitHub source and builds successfully from `main`. The initial release was triggered through the authenticated Cloudflare Pages API; later releases build from pushes to `main`. The build runs in Cloudflare's Linux build image version 3. No repository deployment secrets or local Wrangler login were needed.

**Automatic push builds are active.** Pushing `84b173b` to `main` on November 20, 2026 created a Cloudflare Pages check run on the commit and production deployment `b2257e8c` with no manual trigger, so [the Cloudflare GitHub app installation](https://github.com/settings/installations/167602600) now covers this repository. Preview builds for other branches are enabled in Pages settings but have not been exercised.

If push builds stop, for example because the repository is dropped from the app's selected repositories, a manual Git-backed deployment still works: send an authenticated `POST /accounts/{account_id}/pages/projects/cashgap/deployments` request with `multipart/form-data` containing `branch=main`. Cloudflare fetches and builds that branch. The initial release used this method.

The configured build settings are:

| Setting                        | Value                                 |
| ------------------------------ | ------------------------------------- |
| Build command                  | `npm run build`                       |
| Build output directory         | `out`                                 |
| Production branch              | `main`                                |
| Node version                   | `24.14.0` (also recorded in `.nvmrc`) |
| Required application variables | None                                  |
| Functions/database resources   | None                                  |

`NODE_VERSION=24.14.0` is configured in both production and preview environments. The initial provider build detected Node 24.14.0 and npm 11.14.1, installed the lockfile, and successfully exported all four routes. Web analytics is disabled. The release remains static; do not select a server-side Next.js adapter.

When recreating the project, choose Git integration to retain automatic deployment. Cloudflare does not support converting a Direct Upload project to Git integration later.

References: [Cloudflare static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/).

## Verify the actual deployed origin

Open `/`, `/invoices/`, `/expenses/`, and `/settings/` directly and refresh them. Confirm the sample initializes once; save an invoice and reload; preview/cancel/apply the 14-day scenario; download and restore a synthetic backup; inspect print layout; and check requests/console for missing assets or financial-data transmission. Confirm the configured response headers on that origin and recheck current free-plan terms before distribution.

The public Chromium smoke check (latest run November 20, 2026) passed direct navigation to all four routes, provider response headers, scenario preview/cancel/apply and reload, JSON download/restoration, local CSV import, print/PDF rendering, and 1440 px / 360 px layouts. It recorded no console/HTTP errors, off-origin requests, or imported sentinel data in requests. See [results](qa/deployed-smoke-results.json) and the [desktop](qa/deployed-desktop.png) / [phone](qa/deployed-mobile.png) screenshots. Actual Safari/device checks and custom-domain behavior remain **Not run**.

With Playwright Chromium installed, rerun the public check with:

```sh
node scripts/verify-deployment.mjs
```

It uses an isolated synthetic browser workspace and writes verification evidence to `docs/qa`. It does not change other visitors' workspaces. Run build and type-check commands sequentially because Next regenerates its type files during a build.

## Updating and recovering

Before upgrading the data schema, create a JSON backup and rehearse restoration locally. This release uses database schema 1 and backup format 1; future changes must migrate rather than clear the workspace. Reverting static files does not reverse a database migration. Keep the existing production deployment available for a code rollback.

Browser storage belongs to the origin. A different subdomain/custom domain will not automatically receive an existing workspace. Transfer it with export/restore. Deploying new static assets never uploads a visitor's local workspace to Cloudflare.
