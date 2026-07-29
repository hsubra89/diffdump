import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GITHUB_TOKEN_STORAGE_KEY,
  createGitHubDiffPath,
  createGitHubUrlFromPath,
  loadGitHubDiff,
  parseGitHubDiffUrl,
  readStoredGitHubToken,
  writeStoredGitHubToken,
} from './github-diffs'

type GitHubFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const VALID_DIFF = `diff --git a/hello.ts b/hello.ts
--- a/hello.ts
+++ b/hello.ts
@@ -1 +1 @@
-hello
+hello world
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GitHub token storage', () => {
  it('stores, reads, and clears the token only under the Diffdump key', () => {
    const values = new Map<string, string>()
    const localStorage = {
      getItem: vi.fn<(key: string) => string | null>(
        (key) => values.get(key) ?? null,
      ),
      removeItem: vi.fn<(key: string) => void>((key) => values.delete(key)),
      setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
        values.set(key, value)
      }),
    }
    vi.stubGlobal('localStorage', localStorage)

    writeStoredGitHubToken('ghp_secret')

    expect(localStorage.setItem).toHaveBeenCalledWith(
      GITHUB_TOKEN_STORAGE_KEY,
      'ghp_secret',
    )
    expect(readStoredGitHubToken()).toBe('ghp_secret')

    writeStoredGitHubToken('')

    expect(localStorage.removeItem).toHaveBeenCalledWith(
      GITHUB_TOKEN_STORAGE_KEY,
    )
    expect(readStoredGitHubToken()).toBe('')
  })
})

describe('GitHub diff URL parsing', () => {
  it('parses pull request URLs and normalizes diff and tab suffixes', () => {
    expect(
      parseGitHubDiffUrl('https://github.com/acme/widgets/pull/42/files'),
    ).toEqual({
      kind: 'pull',
      owner: 'acme',
      repo: 'widgets',
      number: '42',
    })
    expect(
      parseGitHubDiffUrl('https://github.com/acme/widgets/pull/42/changes'),
    ).toEqual({
      kind: 'pull',
      owner: 'acme',
      repo: 'widgets',
      number: '42',
    })
    expect(
      parseGitHubDiffUrl('https://github.com/acme/widgets/pull/42.diff'),
    ).toEqual({
      kind: 'pull',
      owner: 'acme',
      repo: 'widgets',
      number: '42',
    })
  })

  it('parses commit and comparison URLs', () => {
    expect(
      parseGitHubDiffUrl('https://github.com/acme/widgets/commit/a1b2c3d'),
    ).toEqual({
      kind: 'commit',
      owner: 'acme',
      repo: 'widgets',
      sha: 'a1b2c3d',
    })
    expect(
      parseGitHubDiffUrl(
        'https://github.com/acme/widgets/compare/main...feature%2Fprivate',
      ),
    ).toEqual({
      kind: 'compare',
      owner: 'acme',
      repo: 'widgets',
      range: 'main...feature/private',
    })
  })

  it('rejects non-GitHub and unsupported URLs', () => {
    expect(
      parseGitHubDiffUrl('https://example.com/acme/widgets/pull/42'),
    ).toBeNull()
    expect(
      parseGitHubDiffUrl('https://github.com/acme/widgets/issues/42'),
    ).toBeNull()
    expect(parseGitHubDiffUrl('not a url')).toBeNull()
  })

  it('maps supported sources to host-replacement paths', () => {
    const source = parseGitHubDiffUrl(
      'https://github.com/freckle-io/next/pull/744/files',
    )

    expect(source && createGitHubDiffPath(source)).toBe(
      'freckle-io/next/pull/744',
    )
    expect(createGitHubUrlFromPath('freckle-io/next/pull/744')).toBe(
      'https://github.com/freckle-io/next/pull/744',
    )
    expect(createGitHubUrlFromPath('freckle-io/next/pull/744/changes')).toBe(
      'https://github.com/freckle-io/next/pull/744',
    )
  })

  it('rejects direct paths that are not supported GitHub diffs', () => {
    expect(createGitHubUrlFromPath('freckle-io/next/issues/744')).toBeNull()
    expect(
      createGitHubUrlFromPath('freckle-io/next/pull/744/unsupported'),
    ).toBeNull()
    expect(createGitHubUrlFromPath('not-a-github-path')).toBeNull()
  })
})

describe('GitHub diff loading', () => {
  const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567'

  function createPullFetcher({
    diffResponse = () =>
      new Response(VALID_DIFF, {
        headers: { 'Content-Type': 'application/vnd.github.v3.diff' },
      }),
    metadataResponse = () =>
      new Response(JSON.stringify({ head: { sha: HEAD_SHA } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
  } = {}) {
    return vi.fn<GitHubFetch>(async (_input, init) => {
      const accept = new Headers(init?.headers).get('Accept')
      return accept === 'application/vnd.github.diff'
        ? diffResponse()
        : metadataResponse()
    })
  }

  it('loads pull request diffs with a review target using the saved token', async () => {
    const fetcher = createPullFetcher()

    await expect(
      loadGitHubDiff('https://github.com/acme/widgets/pull/42', {
        fetch: fetcher,
        token: '  ghp_secret  ',
      }),
    ).resolves.toEqual({
      diff: VALID_DIFF,
      source: { kind: 'pull', owner: 'acme', repo: 'widgets', number: '42' },
      reviewTarget: {
        owner: 'acme',
        repo: 'widgets',
        pullNumber: '42',
        headSha: HEAD_SHA,
      },
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/widgets/pulls/42',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github.diff',
          Authorization: 'Bearer ghp_secret',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
    )
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/widgets/pulls/42',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ghp_secret',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
    )
  })

  it('loads commit diffs in one request without a review target', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () => new Response(VALID_DIFF))

    await expect(
      loadGitHubDiff('https://github.com/acme/widgets/commit/a1b2c3d', {
        fetch: fetcher,
      }),
    ).resolves.toEqual({
      diff: VALID_DIFF,
      source: {
        kind: 'commit',
        owner: 'acme',
        repo: 'widgets',
        sha: 'a1b2c3d',
      },
      reviewTarget: null,
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/widgets/commits/a1b2c3d',
      expect.objectContaining({
        headers: {
          Accept: 'application/vnd.github.diff',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
    )
  })

  it('explains when a private diff needs a token', async () => {
    const fetcher = vi.fn<GitHubFetch>(
      async () =>
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await expect(
      loadGitHubDiff('https://github.com/acme/widgets/pull/42', {
        fetch: fetcher,
      }),
    ).rejects.toThrow('Save a token if the repository is private')
  })

  it('rejects successful responses that are not unified diffs', async () => {
    const fetcher = vi.fn<GitHubFetch>(
      async () => new Response('{"message":"no diff"}'),
    )

    await expect(
      loadGitHubDiff('https://github.com/acme/widgets/commit/a1b2c3d', {
        fetch: fetcher,
      }),
    ).rejects.toThrow('did not return a renderable diff')
  })

  it('rejects pull diffs whose metadata lacks a head sha', async () => {
    const fetcher = createPullFetcher({
      metadataResponse: () => new Response(JSON.stringify({ head: {} })),
    })

    await expect(
      loadGitHubDiff('https://github.com/acme/widgets/pull/42', {
        fetch: fetcher,
      }),
    ).rejects.toThrow('did not return pull request metadata')
  })

  it('surfaces pull metadata request failures', async () => {
    const fetcher = createPullFetcher({
      metadataResponse: () =>
        new Response(JSON.stringify({ message: 'Server Error' }), {
          status: 500,
        }),
    })

    await expect(
      loadGitHubDiff('https://github.com/acme/widgets/pull/42', {
        fetch: fetcher,
      }),
    ).rejects.toThrow('could not load this diff (500)')
  })
})
