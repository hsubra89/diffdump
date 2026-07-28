# diffdump

A minimal, anonymous git diff sharing app built entirely on Cloudflare.

- TanStack Start runs on Cloudflare Workers.
- Unified diffs are stored as private objects in Cloudflare R2.
- Share links expire after 24 hours.
- Share URLs use 96-bit, base64url-encoded random slugs.
- [`@pierre/diffs`](https://diffs.com/) renders multi-file patches.

## How it works

1. A user pastes a unified git diff on `/`.
2. A TanStack server function validates the patch and its 2 MiB size limit.
3. The Worker generates a 16-character cryptographic slug and conditionally
   writes `diffs/<slug>` to R2 so an existing share is never overwritten.
4. The app navigates to `/view/<slug>`, loads the private object through the
   Worker, and renders it in the browser until its 24-hour expiry.

## Local development

Requirements: Node.js 22 or newer and a Cloudflare account for deployment.

```bash
pnpm install
pnpm run cf-typegen
pnpm run dev
```

The Cloudflare Vite plugin provides a locally persisted R2 binding during
development.

## Validation

```bash
pnpm test
pnpm run build
```

## Deploy

Authenticate Wrangler, create the production bucket once, then deploy:

```bash
pnpm exec wrangler login
pnpm exec wrangler r2 bucket create diffdump-diffs
pnpm exec wrangler r2 bucket lifecycle add diffdump-diffs expire-diffs-after-one-day diffs/ --expire-days 1
pnpm run deploy
```

The R2 bucket is private and is only available to the Worker through the
`DIFFS` binding in `wrangler.jsonc`. The application enforces the 24-hour
expiry when a link is read; the lifecycle rule removes expired objects from R2.
