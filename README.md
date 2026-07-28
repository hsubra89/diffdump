# diffdump

Any pull request. One clean review.

diffdump opens GitHub pull requests, commits, and comparisons in a fast,
focused review view — no account, no repository access granted to Diffdump.
Raw unified git diffs can also be shared as unlisted, expiring review links.
It is hosted at [diffdump.com](https://diffdump.com).

## Capabilities

### Review a GitHub diff

- For any supported GitHub URL, replace `github.com` with `diffdump.com`:

  ```text
  https://github.com/freckle-io/next/pull/744
  https://diffdump.com/freckle-io/next/pull/744
  ```

- Or paste a public GitHub pull request, commit, or comparison URL into the
  form on the home page.
- GitHub reviews are client-only: the diff is fetched straight from GitHub
  and rendered in the browser without creating a share or storing anything
  on Diffdump.
- Private repositories are supported with an optional classic personal
  access token carrying the `repo` scope. The token is saved only in browser
  `localStorage` and sent only to `api.github.com`; it is never submitted to
  Diffdump.

### Create a share link

- Paste a unified git diff on the home page and get a link immediately, or
  pipe one straight from your terminal:

  ```bash
  git diff | curl -T- https://diffdump.com/d
  ```

  The response body is the share URL — append `| xargs open` to jump straight
  into the review view.

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
- GitHub reviews are client-only: the browser fetches the diff directly from
  GitHub, and neither the token nor the fetched diff is stored by Diffdump.
- Shared unified diffs are stored as private objects in Cloudflare R2.
- Share links expire after 24 hours.
- Share URLs use 96-bit, base64url-encoded random slugs.

## How it works

The direct GitHub routes read the optional token after client hydration and
request GitHub's diff media type directly from `api.github.com`. They render
the response without creating a Diffdump share.

Shared diffs take the server path:

1. A user pastes a unified git diff on `/` or uploads one with `curl -T-`; both
   clients send the raw patch with `PUT /d`.
2. The Worker rate-limits anonymous creation and validates the patch and its
   2 MiB size limit.
3. The Worker generates a 16-character cryptographic slug and conditionally
   writes `diffs/<slug>` to R2 so an existing share is never overwritten.
4. The app navigates to `/view/<slug>`, loads the private object through the
   Worker, and renders it in the browser until its 24-hour expiry.

## Anonymous creation rate limit

Diff creation is limited to 10 requests per 60 seconds for each
`CF-Connecting-IP` in a Cloudflare location. The limit and period are configured
under `ratelimits` in `wrangler.jsonc`. If the period changes, keep the
`Retry-After` value in `src/server/diff-upload.ts` aligned with it.

Requests over the limit receive `429 Too Many Requests` with a plain-text
message and a `Retry-After` header, so both browsers and shell clients can
recover without authentication. Rate-limiter failures fail closed with `503`
and do not write to R2.

Cloudflare's rate-limit counters are local to each Cloudflare location,
permissive, and eventually consistent; this is abuse protection rather than an
exact usage quota. Rejections emit a `diff_creation_rate_limited` event to
Workers Logs with the Cloudflare location only. Diff contents, share slugs, and
client IPs are not included in the custom log entry.

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
