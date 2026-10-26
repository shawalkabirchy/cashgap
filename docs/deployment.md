# Deploy CashGap to Cloudflare Pages

The application is a static Next.js export. It needs no server runtime, environment secrets, Functions, D1 database, or API bindings.

## Prepare the release

Use the Node version in `.nvmrc` and run:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The deployable directory is **out**. Keep `public/_headers` in the source; Next copies it into the export. Those headers are applied by Cloudflare Pages, not the local preview server. Do not upload `.next`, source files, customer data, or `node_modules` as the website.

## Owner deployment

Sign in to the owner's Cloudflare account, create a **Pages** project using **Direct Upload**, and upload the complete `out` folder using the dashboard's supported folder/ZIP workflow. Use the provider's `pages.dev` subdomain. The project name is the owner's available choice; no domain purchase is required.

Alternatively, after the owner creates/connects their own repository, configure Pages Git builds with:

| Setting                        | Value                                 |
| ------------------------------ | ------------------------------------- |
| Build command                  | `npm run build`                       |
| Build output directory         | `out`                                 |
| Node version                   | `24.14.0` (also recorded in `.nvmrc`) |
| Required application variables | None                                  |
| Functions/database resources   | None                                  |

The release remains static in both cases. Do not select a server-side Next.js adapter.

References: [Cloudflare static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/).

## Verify the actual deployed origin

Open `/`, `/invoices/`, `/expenses/`, and `/settings/` directly and refresh them. Confirm the sample initializes once; save an invoice and reload; preview/cancel/apply the 14-day scenario; download and restore a synthetic backup; inspect print layout; and check requests/console for missing assets or financial-data transmission. Confirm the configured response headers on that origin and recheck current free-plan terms before distribution.

Automated local tests do not prove Cloudflare account configuration or deployed behavior. Deployment, provider headers, and custom-domain behavior are **Not run** until verified against the real public URL.

## Updating and recovering

Before upgrading the data schema, create a JSON backup and rehearse restoration locally. This release uses database schema 1 and backup format 1; future changes must migrate rather than clear the workspace. Reverting static files does not reverse a database migration. Keep the existing production deployment available for a code rollback.

Browser storage belongs to the origin. A different subdomain/custom domain will not automatically receive an existing workspace. Transfer it with export/restore. Deploying new static assets never uploads a visitor's local workspace to Cloudflare.
