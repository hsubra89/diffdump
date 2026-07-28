# diffdump

Share a diff. Skip the ceremony.

diffdump turns a unified git diff into a focused, unlisted review link in
seconds — no account, no repository access. It is hosted at
[diffdump.com](https://diffdump.com).

## Capabilities

### Create a share link

- Paste a diff on the home page and get a link immediately, or pipe one
  straight from your terminal:

  ```bash
  git diff | curl -T- https://diffdump.com/d
  ```

  The response body is the share URL — append `| xargs open` to jump straight
  into the review view.

- Open a public GitHub pull request, commit, or comparison directly in the
  review view without creating a share. Private repositories are supported
  with an optional classic personal access token carrying the `repo` scope.
  The token is stored only in browser `localStorage` and sent directly to
  `api.github.com`; it is never submitted to Diffdump.
- Links are unlisted by design: 96-bit, base64url-encoded random slugs served
  with `noindex, nofollow`. There is no public listing.
- Shares accept diffs up to 2 MiB and expire after 24 hours.

### Review view

- Multi-file, syntax-highlighted patch rendering via
  [`@pierre/diffs`](https://diffs.com/), with unified and split layouts and
  optional line wrapping.
- A searchable file tree ([`@pierre/trees`](https://trees.software)) with
  per-file git status for jumping between changed files.
- Files are automatically categorized as Source, Tests, Docs, or Other — the
  view can be filtered by category and ordered by patch order or by category,
  with file and addition/deletion counts per group.
- Light and dark themes, one-click share-link copy, and a live countdown to
  link expiry.

## Architecture

- TanStack Start runs on Cloudflare Workers.
- Unified diffs are stored as private objects in Cloudflare R2.
- Share links expire after 24 hours.
- Share URLs use 96-bit, base64url-encoded random slugs.
- GitHub reviews are client-only: the browser fetches the diff directly from
  GitHub, and neither the token nor the fetched diff is stored by Diffdump.

## How it works

1. A user pastes a unified git diff on `/` or uploads one with `curl -T-` to
   `/d`.
2. A TanStack server function validates the patch and its 2 MiB size limit.
3. The Worker generates a 16-character cryptographic slug and conditionally
   writes `diffs/<slug>` to R2 so an existing share is never overwritten.
4. The app navigates to `/view/<slug>`, loads the private object through the
   Worker, and renders it in the browser until its 24-hour expiry.

The separate `/github` flow reads the optional token after client hydration and
requests GitHub's diff media type directly from `api.github.com`. It renders the
response without creating a Diffdump share.

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
