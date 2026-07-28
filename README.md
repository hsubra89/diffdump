# diffdump

A minimal, anonymous git diff sharing app built entirely on Cloudflare and
managed with [Alchemy](https://alchemy.run/).

- TanStack Start runs on Cloudflare Workers.
- Unified diffs are stored as private objects in Cloudflare R2.
- `alchemy.run.ts` manages the Worker, R2 bucket, lifecycle rule, binding, and
  custom domain as one stack.
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

Requirements: Node.js 22 or newer and a Cloudflare account.

```bash
npm install
npx alchemy login
npm run dev
```

Alchemy creates an isolated development stage with its own Worker and R2
bucket. The first Alchemy command also offers to bootstrap its Cloudflare-backed
state store. Application code still runs through Vite with HMR on port 3000.

## Validation

```bash
npm test
npm run build
```

## Deploy

Preview the production infrastructure changes, then deploy:

```bash
npm run plan
npm run deploy
```

The `prod` stage creates the `diffdump` Worker, the private `diffdump-diffs`
bucket, its one-day `diffs/` lifecycle rule, and the `diffdump.com` Worker
custom domain. The bucket is only available through the Worker's `DIFFS`
binding. The application enforces the 24-hour expiry when a link is read; the
lifecycle rule removes expired objects from R2.
