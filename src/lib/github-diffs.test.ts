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
  })

  it('rejects direct paths that are not supported GitHub diffs', () => {
    expect(createGitHubUrlFromPath('freckle-io/next/issues/744')).toBeNull()
    expect(createGitHubUrlFromPath('not-a-github-path')).toBeNull()
  })
})

describe('GitHub diff loading', () => {
  it('requests the GitHub diff media type with the saved token', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () => {
      return new Response(VALID_DIFF, {
        headers: { 'Content-Type': 'application/vnd.github.v3.diff' },
      })
    })

    await expect(
      loadGitHubDiff('https://github.com/acme/widgets/pull/42', {
        fetch: fetcher,
        token: '  ghp_secret  ',
      }),
    ).resolves.toBe(VALID_DIFF)

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
  })

  it('loads public diffs without an authorization header', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () => new Response(VALID_DIFF))

    await loadGitHubDiff('https://github.com/acme/widgets/commit/a1b2c3d', {
      fetch: fetcher,
    })

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
      loadGitHubDiff('https://github.com/acme/widgets/pull/42', {
        fetch: fetcher,
      }),
    ).rejects.toThrow('did not return a renderable diff')
  })
})
