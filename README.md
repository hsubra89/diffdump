# diffdump

Review your diffs.

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
- With the `ddd` CLI installed (see below), `ddd pr` opens the current
  branch's pull request straight from the terminal.
- GitHub reviews are client-only: the diff is fetched straight from GitHub
  and rendered in the browser without creating a share or storing anything
  on Diffdump.
- Collapsed context expands like on GitHub: the arrows on each hunk
  separator reveal the unchanged lines around a change, fetched on demand
  from `api.github.com` at the exact revisions the diff compares.
- Stacked pull requests show their ultimate base and every PR layer in a
  toolbar navigator, with merged, open, draft, and closed status. Switch
  between layers without leaving Diffdump.
- Pull requests can be reviewed inline: select diff lines to draft comments,
  browse existing GitHub comment threads, and publish all drafts together as
  one GitHub review — Comment, Approve, or Request changes. Reviews are
  published by the browser directly to `api.github.com`; unsent drafts
  persist in browser `localStorage`, keyed to the pull request's head commit.
- Private repositories and review publishing use an optional personal access
  token: preferably a fine-grained PAT with Pull requests read/write and
  Contents read permissions, or a classic PAT carrying the `repo` scope.
  Either token can publish the reviews you submit. The token is saved only in
  browser `localStorage` and sent only to `api.github.com`; it is never
  submitted to Diffdump.

### Create a share link

- Install the `ddd` shell command and share straight from any repository:

  ```bash
  curl -fsSL https://diffdump.com/install | bash
  ```

  `ddd` shares staged, unstaged, and untracked changes. `ddd commit` (`ddc`)
  shares the latest commit, `ddd branch` (`ddb`) the current branch against
  the default branch, and `ddd from <ref>` the working tree since any Git
  ref. `ddd pr` (`ddp`) opens the current pull request without uploading a
  patch. `ddd` opens the URL automatically on macOS and prints it everywhere
  else; run `ddd help` for the full reference.

- The installer verifies a SHA-256 checksum, places `ddd` in `~/.local/bin`,
  adds that directory to `PATH` in the profile detected from your login shell
  when needed, and creates the shortcut symlinks. Running it again updates the
  command. It requires Bash 3.2 or newer, Git, and curl; `ddd pr` and
  default-branch detection additionally require the GitHub CLI (`gh`). The served
  [installer](https://diffdump.com/install) and
  [command](https://diffdump.com/cli/ddd) can be inspected before running.

- Paste a unified git diff on the home page and get a link immediately, or
  pipe one straight from your terminal:

  ```bash
  git diff | curl -T- https://diffdump.com/d
  ```

  The response body is the share URL — append `| xargs open` to jump straight
  into the review view. This is the endpoint `ddd` wraps, and it composes
  naturally with scripts and coding agents.

- Links are unlisted by design: 96-bit, base64url-encoded random slugs served
  with `noindex, nofollow`. There is no public listing.
- Shares accept diffs up to 2 MiB and expire after 24 hours.
- Terminal uploads can attach a GitHub repository and full base commit SHA.
  Those shares expand collapsed context on demand by fetching the base file
  directly from GitHub in the viewer and applying the uploaded patch locally.
  Public repositories work anonymously; private repositories use the optional
  token already stored in that viewer's browser.

### Review view

- Multi-file, syntax-highlighted patch rendering via
  [`@pierre/diffs`](https://diffs.com/), with unified and split layouts and
  optional line wrapping.
- A searchable file tree ([`@pierre/trees`](https://trees.software)) with
  per-file git status for jumping between changed files.
- Files are automatically categorized as Source, Tests, Docs, or Other — the
  view can be filtered by category and ordered by patch order or by category,
  with file and addition/deletion counts per group.
- Files can be marked as Viewed and collapsed, with progress saved locally for
  each GitHub diff or shared-view link.
- On pull-request routes, inline review comments in unified and split
  layouts: draft on selected lines, inspect drafts and published GitHub
  threads in a Comments sidebar (including outdated comments, linked back to
  GitHub), and submit everything as one review.
- Light and dark themes, one-click share-link copy, and a live countdown to
  link expiry.

## Architecture

- TanStack Start runs on Cloudflare Workers.
- GitHub reviews are client-only: the browser fetches the diff and existing
  review comments directly from GitHub and publishes pull-request reviews
  straight to `api.github.com`. Neither the token, the diff, nor any review
  content passes through Diffdump.
- Unsent review drafts (and an interrupted submission's pending review id)
  live only in browser `localStorage`, scoped to the pull request and its
  head commit.
- The `ddd` command and its checksum-verifying installer are served by the
  Worker from same-origin endpoints (`/cli/ddd` and `/install`).
- Shared unified diffs are stored as private objects in Cloudflare R2.
- A GitHub-backed shared diff stores its repository and base SHA as object
  metadata. Full base-file contents are fetched by the browser from GitHub and
  are not stored by Diffdump.
- Share links expire after 24 hours.
- Share URLs use 96-bit, base64url-encoded random slugs.

## How it works

The direct GitHub routes read the optional token after client hydration and
request GitHub's diff media type directly from `api.github.com`. On pull
requests they also list existing review comments and publish new reviews with
the same direct browser calls. Every response renders without creating a
Diffdump share, and review drafts stay in the browser until they are
published to GitHub.

Shared diffs take the server path:

1. A user pastes a unified git diff on `/` or uploads one with `curl -T-`; both
   clients send the raw patch with `PUT /d`. Terminal clients may also send
   `X-Diffdump-GitHub-Repo` and `X-Diffdump-Base-Sha` headers.
2. The Worker rate-limits anonymous creation and validates the patch and its
   2 MiB size limit.
3. The Worker generates a 16-character cryptographic slug and conditionally
   writes `diffs/<slug>` to R2 so an existing share is never overwritten.
4. The app navigates to `/view/<slug>`, loads the private object through the
   Worker, and renders it in the browser until its 24-hour expiry.
5. When GitHub base metadata is present, a context-expansion click fetches the
   requested base file from `api.github.com` and reconstructs the local side
   from the stored patch in the browser.

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

The production build enforces gzip budgets for the core viewer and its
deferred file-picker chunk. Run `pnpm analyze` to generate an interactive
treemap and raw module data in `dist/client/` when investigating a regression.

## Deploy

Authenticate Wrangler, create the production bucket once, then deploy:

```bash
pnpm exec wrangler login
pnpm exec wrangler r2 bucket create diffdump-diffs
pnpm exec wrangler r2 bucket lifecycle add diffdump-diffs expire-diffs-after-one-day diffs/ --expire-days 1
pnpm run deploy
```

The R2 bucket is private and is only available to the Worker through the
`DIFFS` binding in `wrangler.jsonc`. Each request checks the stored expiration
time, so links stop working after 24 hours; the lifecycle rule deletes the
expired objects afterward.
