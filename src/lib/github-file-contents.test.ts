import { describe, expect, it, vi } from 'vitest'
import { parsePatchFiles, type FileDiffMetadata } from '@pierre/diffs'

import {
  createGitHubBaseFileContentsLoader,
  createGitHubFileContentsLoader,
} from './github-file-contents'
import type { GitHubDiffSource, GitHubFetch } from './github-diffs'
import type { GitHubBaseDiffSource } from './diffs'

const BASE_SHA = 'b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1'
const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567'
const MOVED_HEAD_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const MERGE_BASE_SHA = 'c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2'
const PARENT_SHA = 'd3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3'

const PULL_SOURCE: GitHubDiffSource = {
  kind: 'pull',
  owner: 'acme',
  repo: 'widgets',
  number: '42',
}

const RAW_MEDIA_TYPE = 'application/vnd.github.raw+json'

const LOCAL_SOURCE: GitHubBaseDiffSource = {
  kind: 'github-base',
  owner: 'acme',
  repo: 'widgets',
  baseSha: BASE_SHA,
}

const LOCAL_DIFF = `diff --git a/src/app.ts b/src/app.ts
index 1111111111111111111111111111111111111111..2222222222222222222222222222222222222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -2,3 +2,3 @@
 one
-old
+new
 three
`

type RouteHandler = (init?: RequestInit) => Response

function createFetcher(routes: Record<string, RouteHandler>) {
  return vi.fn<GitHubFetch>((input, init) => {
    const url = String(input)
    const route = routes[url]
    if (!route) {
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }
    return Promise.resolve(route(init))
  })
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function createFileDiff(
  overrides: Partial<FileDiffMetadata> &
    Pick<FileDiffMetadata, 'name' | 'type'>,
): FileDiffMetadata {
  return {
    hunks: [],
    splitLineCount: 0,
    unifiedLineCount: 0,
    isPartial: true,
    deletionLines: [],
    additionLines: [],
    ...overrides,
  }
}

function createPullRoutes({
  headRepo = 'acme/widgets',
  compareRange = `${BASE_SHA}...${HEAD_SHA}`,
}: { headRepo?: string; compareRange?: string } = {}) {
  return {
    'https://api.github.com/repos/acme/widgets/pulls/42': () =>
      json({
        base: { sha: BASE_SHA, repo: { full_name: 'acme/widgets' } },
        head: { sha: MOVED_HEAD_SHA, repo: { full_name: headRepo } },
      }),
    [`https://api.github.com/repos/acme/widgets/compare/${encodeURIComponent(compareRange)}`]:
      () => json({ merge_base_commit: { sha: MERGE_BASE_SHA } }),
  }
}

function createLocalFileDiff(): FileDiffMetadata {
  const file = parsePatchFiles(LOCAL_DIFF, 'local-share', true)[0]?.files[0]
  if (!file) {
    throw new Error('Local diff fixture did not parse.')
  }
  return file
}

describe('shared local diff file contents', () => {
  const contentsUrl = `https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${BASE_SHA}`

  it('fetches a public base anonymously and reconstructs the local side', async () => {
    const fetcher = createFetcher({
      [contentsUrl]: () => new Response('zero\none\nold\nthree\nfour\n'),
    })
    const loader = createGitHubBaseFileContentsLoader(
      LOCAL_SOURCE,
      LOCAL_DIFF,
      {
        fetch: fetcher,
        getToken: () => '',
      },
    )

    await expect(loader(createLocalFileDiff())).resolves.toEqual({
      oldFile: {
        name: 'src/app.ts',
        contents: 'zero\none\nold\nthree\nfour\n',
        cacheKey: `github:acme/widgets:${BASE_SHA}:src/app.ts`,
      },
      newFile: {
        name: 'src/app.ts',
        contents: 'zero\none\nnew\nthree\nfour\n',
        cacheKey: expect.stringContaining(':patched:'),
      },
    })
    expect(fetcher).toHaveBeenCalledWith(
      contentsUrl,
      expect.objectContaining({
        headers: {
          Accept: RAW_MEDIA_TYPE,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
    )
  })

  it('uses a stored token when one is available', async () => {
    const fetcher = createFetcher({
      [contentsUrl]: () => new Response('zero\none\nold\nthree\nfour\n'),
    })
    const loader = createGitHubBaseFileContentsLoader(
      LOCAL_SOURCE,
      LOCAL_DIFF,
      {
        fetch: fetcher,
        getToken: () => 'ghp_secret',
      },
    )

    await loader(createLocalFileDiff())

    expect(fetcher).toHaveBeenCalledWith(
      contentsUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_secret',
        }),
      }),
    )
  })

  it('reports an inaccessible repository, commit, or path on demand', async () => {
    const fetcher = createFetcher({
      [contentsUrl]: () =>
        new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }),
    })
    const loader = createGitHubBaseFileContentsLoader(
      LOCAL_SOURCE,
      LOCAL_DIFF,
      {
        fetch: fetcher,
        getToken: () => '',
      },
    )

    await expect(loader(createLocalFileDiff())).rejects.toThrow(
      /could not access.*Save a token.*commit and path are available/,
    )
  })

  it('fails closed when the patch does not match the supplied base', async () => {
    let requests = 0
    const fetcher = createFetcher({
      [contentsUrl]: () => {
        requests += 1
        return new Response(
          requests === 1
            ? 'zero\none\ndifferent\nthree\nfour\n'
            : 'zero\none\nold\nthree\nfour\n',
        )
      },
    })
    const loader = createGitHubBaseFileContentsLoader(
      LOCAL_SOURCE,
      LOCAL_DIFF,
      {
        fetch: fetcher,
        getToken: () => '',
      },
    )
    const file = createLocalFileDiff()

    await expect(loader(file)).rejects.toThrow(
      /does not apply.*base commit is correct/,
    )
    await expect(loader(file)).resolves.toMatchObject({
      newFile: { contents: 'zero\none\nnew\nthree\nfour\n' },
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('hydrates a pure rename from its base path', async () => {
    const renameDiff = `diff --git a/src/old.ts b/src/new.ts
similarity index 100%
rename from src/old.ts
rename to src/new.ts
`
    const fetcher = createFetcher({
      [`https://api.github.com/repos/acme/widgets/contents/src/old.ts?ref=${BASE_SHA}`]:
        () => new Response('moved contents\n'),
    })
    const loader = createGitHubBaseFileContentsLoader(
      LOCAL_SOURCE,
      renameDiff,
      {
        fetch: fetcher,
        getToken: () => '',
      },
    )

    await expect(
      loader(
        createFileDiff({
          name: 'src/new.ts',
          prevName: 'src/old.ts',
          type: 'rename-pure',
        }),
      ),
    ).resolves.toEqual({
      oldFile: null,
      newFile: {
        name: 'src/new.ts',
        contents: 'moved contents\n',
        cacheKey: expect.stringContaining(':patched:'),
      },
    })
  })

  it('does not fetch complete new and deleted files', async () => {
    const fetcher = createFetcher({})
    const loader = createGitHubBaseFileContentsLoader(
      LOCAL_SOURCE,
      LOCAL_DIFF,
      {
        fetch: fetcher,
        getToken: () => '',
      },
    )

    await expect(
      loader(createFileDiff({ name: 'src/new.ts', type: 'new' })),
    ).rejects.toThrow('already shows all of its lines')
    await expect(
      loader(createFileDiff({ name: 'src/old.ts', type: 'deleted' })),
    ).rejects.toThrow('already shows all of its lines')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects patch paths with dot segments before fetching', async () => {
    const fetcher = createFetcher({})
    const loader = createGitHubBaseFileContentsLoader(
      LOCAL_SOURCE,
      LOCAL_DIFF,
      {
        fetch: fetcher,
        getToken: () => 'ghp_secret',
      },
    )

    await expect(
      loader(createFileDiff({ name: '../../../user', type: 'change' })),
    ).rejects.toThrow('not a valid repository file path')
    await expect(
      loader(createFileDiff({ name: 'src/./app.ts', type: 'change' })),
    ).rejects.toThrow('not a valid repository file path')
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('pull request file contents', () => {
  it('reads the old side at the merge base and the new side at the pinned head', async () => {
    const fetcher = createFetcher({
      ...createPullRoutes(),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${HEAD_SHA}`]:
        () => new Response('new contents'),
    })
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => 'ghp_secret',
      /* The pulls API reports a head that moved since the diff loaded; the
         pinned head must win so hydrated context matches the diff. */
      pinnedHeadSha: HEAD_SHA,
    })

    await expect(
      loader(createFileDiff({ name: 'src/app.ts', type: 'change' })),
    ).resolves.toEqual({
      oldFile: {
        name: 'src/app.ts',
        contents: 'old contents',
        cacheKey: `github:acme/widgets:${MERGE_BASE_SHA}:src/app.ts`,
      },
      newFile: {
        name: 'src/app.ts',
        contents: 'new contents',
        cacheKey: `github:acme/widgets:${HEAD_SHA}:src/app.ts`,
      },
    })

    expect(fetcher).toHaveBeenCalledWith(
      `https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${HEAD_SHA}`,
      expect.objectContaining({
        headers: {
          Accept: RAW_MEDIA_TYPE,
          Authorization: 'Bearer ghp_secret',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
    )
  })

  it('reads fork pull request sides from their own repositories', async () => {
    const fetcher = createFetcher({
      ...createPullRoutes({
        headRepo: 'fork-owner/widgets',
        compareRange: `acme:${BASE_SHA}...fork-owner:${HEAD_SHA}`,
      }),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/fork-owner/widgets/contents/src/app.ts?ref=${HEAD_SHA}`]:
        () => new Response('new contents'),
    })
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
      pinnedHeadSha: HEAD_SHA,
    })

    const files = await loader(
      createFileDiff({ name: 'src/app.ts', type: 'change' }),
    )

    expect(files.oldFile?.contents).toBe('old contents')
    expect(files.newFile.contents).toBe('new contents')
  })

  it('fetches the renamed file from its previous path on the old side', async () => {
    const fetcher = createFetcher({
      ...createPullRoutes(),
      [`https://api.github.com/repos/acme/widgets/contents/src/legacy%20name.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/%5Bid%5D/app.ts?ref=${HEAD_SHA}`]:
        () => new Response('new contents'),
    })
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
      pinnedHeadSha: HEAD_SHA,
    })

    const files = await loader(
      createFileDiff({
        name: 'src/[id]/app.ts',
        prevName: 'src/legacy name.ts',
        type: 'rename-changed',
      }),
    )

    expect(files.oldFile?.name).toBe('src/legacy name.ts')
    expect(files.newFile.name).toBe('src/[id]/app.ts')
  })

  it('loads only the new side of a pure rename', async () => {
    const fetcher = createFetcher({
      ...createPullRoutes(),
      [`https://api.github.com/repos/acme/widgets/contents/src/moved.ts?ref=${HEAD_SHA}`]:
        () => new Response('moved contents'),
    })
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
      pinnedHeadSha: HEAD_SHA,
    })

    await expect(
      loader(
        createFileDiff({
          name: 'src/moved.ts',
          prevName: 'src/original.ts',
          type: 'rename-pure',
        }),
      ),
    ).resolves.toEqual({
      oldFile: null,
      newFile: {
        name: 'src/moved.ts',
        contents: 'moved contents',
        cacheKey: `github:acme/widgets:${HEAD_SHA}:src/moved.ts`,
      },
    })
  })

  it('caches loaded files and resolved refs across calls', async () => {
    const fetcher = createFetcher({
      ...createPullRoutes(),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${HEAD_SHA}`]:
        () => new Response('new contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/other.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old other'),
      [`https://api.github.com/repos/acme/widgets/contents/src/other.ts?ref=${HEAD_SHA}`]:
        () => new Response('new other'),
    })
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
      pinnedHeadSha: HEAD_SHA,
    })
    const file = createFileDiff({ name: 'src/app.ts', type: 'change' })

    await loader(file)
    await loader(file)

    /* One pulls read, one compare read, two contents reads. */
    expect(fetcher).toHaveBeenCalledTimes(4)

    /* A second file adds its two contents reads but no ref resolution. */
    await loader(createFileDiff({ name: 'src/other.ts', type: 'change' }))

    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  it('evicts failed loads so the next expansion retries', async () => {
    let contentRequests = 0
    const fetcher = createFetcher({
      ...createPullRoutes(),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${HEAD_SHA}`]:
        () => {
          contentRequests += 1
          return contentRequests === 1
            ? new Response('server error', { status: 500 })
            : new Response('new contents')
        },
    })
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
      pinnedHeadSha: HEAD_SHA,
    })
    const file = createFileDiff({ name: 'src/app.ts', type: 'change' })

    await expect(loader(file)).rejects.toThrow('failed (500)')
    await expect(loader(file)).resolves.toMatchObject({
      newFile: { contents: 'new contents' },
    })
  })

  it('surfaces rate limiting with a token hint', async () => {
    const fetcher = createFetcher({
      'https://api.github.com/repos/acme/widgets/pulls/42': () =>
        new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
    })
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
      pinnedHeadSha: HEAD_SHA,
    })

    await expect(
      loader(createFileDiff({ name: 'src/app.ts', type: 'change' })),
    ).rejects.toThrow(/rate limit.*Save a token/i)
  })

  it('rejects added and deleted files without fetching', async () => {
    const fetcher = createFetcher({})
    const loader = createGitHubFileContentsLoader(PULL_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
      pinnedHeadSha: HEAD_SHA,
    })

    await expect(
      loader(createFileDiff({ name: 'src/new.ts', type: 'new' })),
    ).rejects.toThrow('already shows all of its lines')
    await expect(
      loader(createFileDiff({ name: 'src/old.ts', type: 'deleted' })),
    ).rejects.toThrow('already shows all of its lines')
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('commit file contents', () => {
  const COMMIT_SOURCE: GitHubDiffSource = {
    kind: 'commit',
    owner: 'acme',
    repo: 'widgets',
    sha: 'abc1234',
  }

  it('reads the old side from the first parent', async () => {
    const fetcher = createFetcher({
      'https://api.github.com/repos/acme/widgets/commits/abc1234': () =>
        json({ sha: HEAD_SHA, parents: [{ sha: PARENT_SHA }] }),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${PARENT_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${HEAD_SHA}`]:
        () => new Response('new contents'),
    })
    const loader = createGitHubFileContentsLoader(COMMIT_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
    })

    const files = await loader(
      createFileDiff({ name: 'src/app.ts', type: 'change' }),
    )

    expect(files.oldFile?.contents).toBe('old contents')
    expect(files.newFile.contents).toBe('new contents')
  })

  it('cannot expand changed files of a root commit', async () => {
    const fetcher = createFetcher({
      'https://api.github.com/repos/acme/widgets/commits/abc1234': () =>
        json({ sha: HEAD_SHA, parents: [] }),
    })
    const loader = createGitHubFileContentsLoader(COMMIT_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
    })

    await expect(
      loader(createFileDiff({ name: 'src/app.ts', type: 'change' })),
    ).rejects.toThrow('no old revision')
  })
})

describe('comparison file contents', () => {
  const COMPARE_SOURCE: GitHubDiffSource = {
    kind: 'compare',
    owner: 'acme',
    repo: 'widgets',
    range: 'main...feature/x',
  }
  const COMPARE_URL = `https://api.github.com/repos/acme/widgets/compare/${encodeURIComponent('main...feature/x')}`

  it('reads the old side from the merge base and the new side from the last commit', async () => {
    const fetcher = createFetcher({
      [COMPARE_URL]: () =>
        json({
          base_commit: { sha: BASE_SHA },
          merge_base_commit: { sha: MERGE_BASE_SHA },
          total_commits: 2,
          commits: [{ sha: PARENT_SHA }, { sha: HEAD_SHA }],
        }),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${HEAD_SHA}`]:
        () => new Response('new contents'),
    })
    const loader = createGitHubFileContentsLoader(COMPARE_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
    })

    const files = await loader(
      createFileDiff({ name: 'src/app.ts', type: 'change' }),
    )

    expect(files.oldFile?.contents).toBe('old contents')
    expect(files.newFile.contents).toBe('new contents')
  })

  it('pages to the head commit when the compare list is truncated', async () => {
    const fetcher = createFetcher({
      [COMPARE_URL]: () =>
        json({
          merge_base_commit: { sha: MERGE_BASE_SHA },
          total_commits: 400,
          commits: [{ sha: PARENT_SHA }],
        }),
      [`${COMPARE_URL}?page=400&per_page=1`]: () =>
        json({ commits: [{ sha: HEAD_SHA }] }),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${MERGE_BASE_SHA}`]:
        () => new Response('old contents'),
      [`https://api.github.com/repos/acme/widgets/contents/src/app.ts?ref=${HEAD_SHA}`]:
        () => new Response('new contents'),
    })
    const loader = createGitHubFileContentsLoader(COMPARE_SOURCE, {
      fetch: fetcher,
      getToken: () => '',
    })

    const files = await loader(
      createFileDiff({ name: 'src/app.ts', type: 'change' }),
    )

    expect(files.newFile.contents).toBe('new contents')
  })
})
