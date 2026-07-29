import { describe, expect, it, vi } from 'vitest'

import type { GitHubPullReviewTarget } from './github-diffs'
import {
  GitHubReviewApiError,
  PendingReviewExistsError,
  PullHeadChangedError,
  assertPullHeadUnchanged,
  createPendingReview,
  deletePendingReview,
  fetchPullHeadSha,
  findPendingReviewId,
  listPullReviewComments,
  publishReview,
  submitPendingReview,
} from './github-reviews'
import {
  fingerprintDraftPayloads,
  serializeDraftComment,
  type DraftReviewComment,
  type ReviewSubmission,
  type StoredPendingReview,
} from './review-comments'

type GitHubFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567'
const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98'

const TARGET: GitHubPullReviewTarget = {
  owner: 'acme',
  repo: 'widgets',
  pullNumber: '42',
  headSha: HEAD_SHA,
}

const PULL_URL = 'https://api.github.com/repos/acme/widgets/pulls/42'
const COMMENTS_URL = `${PULL_URL}/comments?per_page=100`
const REVIEWS_URL = `${PULL_URL}/reviews`

const REMOTE_COMMENT = {
  id: 1,
  path: 'src/app.ts',
  html_url: 'https://github.com/acme/widgets/pull/42#discussion_r1',
  created_at: '2026-07-01T00:00:00Z',
  body: 'Existing comment.',
  user: {
    login: 'octocat',
    avatar_url: 'https://avatars.example/octocat',
    html_url: 'https://github.com/octocat',
  },
  pull_request_review_id: 7,
  line: 13,
  side: 'RIGHT',
  start_line: null,
  start_side: null,
}

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), init)
}

function createDraft(
  overrides: Partial<DraftReviewComment> = {},
): DraftReviewComment {
  return {
    kind: 'draft',
    localId: 'local-1',
    itemId: 'item-1',
    path: 'src/app.ts',
    body: 'Consider renaming this.',
    range: { start: 12, end: 12, side: 'additions' },
    headSha: HEAD_SHA,
    ...overrides,
  }
}

function createSubmission(
  overrides: Partial<ReviewSubmission> = {},
): ReviewSubmission {
  return {
    event: 'APPROVE',
    body: 'Nice work.',
    comments: [createDraft()],
    target: TARGET,
    ...overrides,
  }
}

describe('listing pull review comments', () => {
  it('normalizes comments from the paginated GitHub listing', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse([REMOTE_COMMENT, { invalid: 'missing required fields' }]),
    )

    await expect(
      listPullReviewComments(TARGET, { fetch: fetcher, token: 'ghp_secret' }),
    ).resolves.toEqual([
      {
        id: 1,
        pullRequestReviewId: 7,
        inReplyToId: null,
        path: 'src/app.ts',
        body: 'Existing comment.',
        author: {
          login: 'octocat',
          avatarUrl: 'https://avatars.example/octocat',
          htmlUrl: 'https://github.com/octocat',
        },
        createdAt: '2026-07-01T00:00:00Z',
        htmlUrl: 'https://github.com/acme/widgets/pull/42#discussion_r1',
        line: 13,
        side: 'RIGHT',
        startLine: null,
        startSide: null,
      },
    ])

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      COMMENTS_URL,
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

  it('attributes comments from deleted accounts to ghost', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse([{ ...REMOTE_COMMENT, user: null }]),
    )

    const [comment] = await listPullReviewComments(TARGET, { fetch: fetcher })

    expect(comment.author).toEqual({
      login: 'ghost',
      avatarUrl: '',
      htmlUrl: 'https://github.com/ghost',
    })
  })

  it('follows GitHub pagination links until exhausted', async () => {
    const page2Url = `${PULL_URL}/comments?per_page=100&page=2`
    const fetcher = vi.fn<GitHubFetch>(async (input) =>
      input === COMMENTS_URL
        ? jsonResponse([REMOTE_COMMENT], {
            headers: {
              Link: `<${page2Url}>; rel="next", <${page2Url}>; rel="last"`,
            },
          })
        : jsonResponse([{ ...REMOTE_COMMENT, id: 2, in_reply_to_id: 1 }]),
    )

    const comments = await listPullReviewComments(TARGET, { fetch: fetcher })

    expect(comments.map((comment) => comment.id)).toEqual([1, 2])
    expect(comments[1].inReplyToId).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenLastCalledWith(page2Url, expect.anything())
  })

  it('refuses pagination links that leave api.github.com', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse([REMOTE_COMMENT], {
        headers: { Link: '<https://evil.example/comments>; rel="next"' },
      }),
    )

    const comments = await listPullReviewComments(TARGET, { fetch: fetcher })

    expect(comments).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each<[number, string]>([
    [401, 'GitHub rejected the saved token'],
    [403, '“Pull requests” write permission'],
    [404, 'could not find this pull request'],
  ])('maps %i responses to actionable errors', async (status, message) => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse({ message: 'nope' }, { status }),
    )

    const error = await listPullReviewComments(TARGET, {
      fetch: fetcher,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(GitHubReviewApiError)
    expect(error).toMatchObject({
      status,
      message: expect.stringContaining(message),
    })
  })
})

describe('head SHA validation', () => {
  it('reads the current head SHA from pull metadata', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse({ head: { sha: HEAD_SHA } }),
    )

    await expect(fetchPullHeadSha(TARGET, { fetch: fetcher })).resolves.toBe(
      HEAD_SHA,
    )
    await expect(
      assertPullHeadUnchanged(TARGET, { fetch: fetcher }),
    ).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith(PULL_URL, expect.anything())
  })

  it('reports a changed head SHA without publishing anything', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse({ head: { sha: OTHER_SHA } }),
    )

    const error = await assertPullHeadUnchanged(TARGET, {
      fetch: fetcher,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(PullHeadChangedError)
    expect(error).toMatchObject({
      expectedHeadSha: HEAD_SHA,
      currentHeadSha: OTHER_SHA,
    })
  })
})

describe('review creation and submission', () => {
  it('creates a PENDING review holding every draft comment', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse({ id: 555, state: 'PENDING' }),
    )

    await expect(
      createPendingReview(
        TARGET,
        [{ path: 'src/app.ts', body: 'Draft.', line: 12, side: 'RIGHT' }],
        { fetch: fetcher, token: 'ghp_secret' },
      ),
    ).resolves.toBe(555)

    expect(fetcher).toHaveBeenCalledWith(
      REVIEWS_URL,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          commit_id: HEAD_SHA,
          comments: [
            { path: 'src/app.ts', body: 'Draft.', line: 12, side: 'RIGHT' },
          ],
        }),
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_secret',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('surfaces GitHub validation details on 422 responses', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse(
        {
          message: 'Validation Failed',
          errors: [
            {
              message:
                'Pull request review thread line must be part of the diff',
            },
          ],
        },
        { status: 422 },
      ),
    )

    await expect(
      createPendingReview(TARGET, [], { fetch: fetcher }),
    ).rejects.toThrow('line must be part of the diff')
  })

  it('submits the pending review event, omitting an empty summary', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () => jsonResponse({ id: 555 }))

    await submitPendingReview(TARGET, 555, 'APPROVE', '', { fetch: fetcher })
    await submitPendingReview(TARGET, 555, 'REQUEST_CHANGES', 'Please fix.', {
      fetch: fetcher,
    })

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `${REVIEWS_URL}/555/events`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ event: 'APPROVE' }),
      }),
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `${REVIEWS_URL}/555/events`,
      expect.objectContaining({
        body: JSON.stringify({ event: 'REQUEST_CHANGES', body: 'Please fix.' }),
      }),
    )
  })
})

describe('pending review lookup and deletion', () => {
  const REVIEWS_LIST_URL = `${REVIEWS_URL}?per_page=100`

  it('finds the PENDING review among submitted ones', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse([
        { id: 1, state: 'APPROVED' },
        { id: 2, state: 'PENDING' },
      ]),
    )

    await expect(findPendingReviewId(TARGET, { fetch: fetcher })).resolves.toBe(
      2,
    )
    expect(fetcher).toHaveBeenCalledWith(REVIEWS_LIST_URL, expect.anything())
  })

  it('reports no pending review when every review is submitted', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse([{ id: 1, state: 'COMMENTED' }]),
    )

    await expect(
      findPendingReviewId(TARGET, { fetch: fetcher }),
    ).resolves.toBeNull()
  })

  it('deletes a pending review and tolerates one already gone', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () => jsonResponse({}))
    const goneFetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse({ message: 'Not Found' }, { status: 404 }),
    )

    await expect(
      deletePendingReview(TARGET, 555, { fetch: fetcher }),
    ).resolves.toBeUndefined()
    await expect(
      deletePendingReview(TARGET, 555, { fetch: goneFetcher }),
    ).resolves.toBeUndefined()

    expect(fetcher).toHaveBeenCalledWith(
      `${REVIEWS_URL}/555`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('surfaces failures other than 404 when deleting', async () => {
    const fetcher = vi.fn<GitHubFetch>(async () =>
      jsonResponse({ message: 'boom' }, { status: 500 }),
    )

    await expect(
      deletePendingReview(TARGET, 555, { fetch: fetcher }),
    ).rejects.toBeInstanceOf(GitHubReviewApiError)
  })
})

describe('publishing a review', () => {
  const REVIEWS_LIST_URL = `${REVIEWS_URL}?per_page=100`

  function fingerprintOf(drafts: readonly DraftReviewComment[]): string {
    return fingerprintDraftPayloads(
      drafts.map((draft) => {
        const result = serializeDraftComment(draft)
        if (!result.ok) {
          throw new Error(result.error)
        }
        return result.payload
      }),
    )
  }

  function createPublishFetcher({
    currentHeadSha = HEAD_SHA,
    createStatus = 200,
    submitStatus = 200,
    existingReviews = [] as unknown[],
  } = {}) {
    return vi.fn<GitHubFetch>(async (input, init) => {
      if (input === PULL_URL) {
        return jsonResponse({ head: { sha: currentHeadSha } })
      }
      if (input === REVIEWS_URL && init?.method === 'POST') {
        return createStatus === 200
          ? jsonResponse({ id: 555, state: 'PENDING' })
          : jsonResponse(
              { message: 'Validation Failed' },
              { status: createStatus },
            )
      }
      if (input === REVIEWS_LIST_URL) {
        return jsonResponse(existingReviews)
      }
      if (input === `${REVIEWS_URL}/444` && init?.method === 'DELETE') {
        return jsonResponse({})
      }
      if (input === `${REVIEWS_URL}/555/events`) {
        return jsonResponse(
          { message: submitStatus === 200 ? 'ok' : 'boom' },
          { status: submitStatus },
        )
      }
      throw new Error(`Unexpected request: ${String(input)}`)
    })
  }

  it('verifies the head SHA, creates the pending review, then submits it', async () => {
    const fetcher = createPublishFetcher()
    const onPendingReviewCreated =
      vi.fn<(pending: StoredPendingReview) => void>()

    await expect(
      publishReview(createSubmission(), {
        fetch: fetcher,
        onPendingReviewCreated,
      }),
    ).resolves.toBe(555)

    expect(onPendingReviewCreated).toHaveBeenCalledWith({
      reviewId: 555,
      fingerprint: fingerprintOf([createDraft()]),
    })
    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      PULL_URL,
      REVIEWS_URL,
      `${REVIEWS_URL}/555/events`,
    ])
  })

  it('blocks submission when the pull head moved, before any write', async () => {
    const fetcher = createPublishFetcher({ currentHeadSha: OTHER_SHA })

    await expect(
      publishReview(createSubmission(), { fetch: fetcher }),
    ).rejects.toBeInstanceOf(PullHeadChangedError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('resumes a retained pending review while the drafts still match', async () => {
    const fetcher = createPublishFetcher()

    await expect(
      publishReview(createSubmission(), {
        fetch: fetcher,
        pendingReview: {
          reviewId: 555,
          fingerprint: fingerprintOf([createDraft()]),
        },
      }),
    ).resolves.toBe(555)

    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      `${REVIEWS_URL}/555/events`,
    ])
  })

  it('discards a retained pending review once the drafts changed', async () => {
    const fetcher = createPublishFetcher()
    const onPendingReviewCreated =
      vi.fn<(pending: StoredPendingReview) => void>()

    await expect(
      publishReview(createSubmission(), {
        fetch: fetcher,
        pendingReview: { reviewId: 444, fingerprint: 'outdated' },
        onPendingReviewCreated,
      }),
    ).resolves.toBe(555)

    expect(onPendingReviewCreated).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: 555 }),
    )
    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      PULL_URL,
      `${REVIEWS_URL}/444`,
      REVIEWS_URL,
      `${REVIEWS_URL}/555/events`,
    ])
  })

  it('rejects invalid drafts before any request is made', async () => {
    const fetcher = createPublishFetcher()
    const crossSide = createSubmission({
      comments: [
        createDraft({
          range: {
            start: 11,
            side: 'deletions',
            end: 12,
            endSide: 'additions',
          },
        }),
      ],
    })
    const staleDraft = createSubmission({
      comments: [createDraft({ headSha: OTHER_SHA })],
    })

    await expect(publishReview(crossSide, { fetch: fetcher })).rejects.toThrow(
      'one comment per side',
    )
    await expect(publishReview(staleDraft, { fetch: fetcher })).rejects.toThrow(
      'different revision',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps the pending review when submission fails, for retry', async () => {
    const fetcher = createPublishFetcher({ submitStatus: 500 })
    const onPendingReviewCreated =
      vi.fn<(pending: StoredPendingReview) => void>()

    await expect(
      publishReview(createSubmission(), {
        fetch: fetcher,
        onPendingReviewCreated,
      }),
    ).rejects.toThrow('GitHub review request failed (500)')
    expect(onPendingReviewCreated).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: 555 }),
    )
  })

  it('reports an existing pending review hidden behind a 422 creation failure', async () => {
    const fetcher = createPublishFetcher({
      createStatus: 422,
      existingReviews: [{ id: 999, state: 'PENDING' }],
    })

    await expect(
      publishReview(createSubmission(), { fetch: fetcher }),
    ).rejects.toBeInstanceOf(PendingReviewExistsError)
  })

  it('passes a 422 through unchanged when no pending review exists', async () => {
    const fetcher = createPublishFetcher({
      createStatus: 422,
      existingReviews: [{ id: 1, state: 'APPROVED' }],
    })

    const error = await publishReview(createSubmission(), {
      fetch: fetcher,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(GitHubReviewApiError)
    expect(error).toMatchObject({ status: 422 })
  })
})
