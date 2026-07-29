import {
  GITHUB_API_ROOT,
  fetchGitHubApi,
  readPullHeadSha,
  type GitHubFetch,
  type GitHubPullReviewTarget,
} from './github-diffs'
import {
  serializeDraftComment,
  type GitHubCommentSide,
  type GitHubDraftCommentPayload,
  type GitHubReviewCommentAuthor,
  type GitHubReviewEvent,
  type PullReviewCommentData,
  type ReviewSubmission,
} from './review-comments'

const REVIEW_COMMENTS_PAGE_SIZE = 100

const GHOST_AUTHOR: GitHubReviewCommentAuthor = {
  login: 'ghost',
  avatarUrl: '',
  htmlUrl: 'https://github.com/ghost',
}

export type GitHubReviewRequestOptions = {
  fetch?: GitHubFetch
  signal?: AbortSignal
  token?: string
}

export class GitHubReviewApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitHubReviewApiError'
    this.status = status
  }
}

export class PullHeadChangedError extends Error {
  readonly expectedHeadSha: string
  readonly currentHeadSha: string

  constructor(expectedHeadSha: string, currentHeadSha: string) {
    super(
      'This pull request changed since the diff was loaded. Reload the diff to remap your drafts before submitting.',
    )
    this.name = 'PullHeadChangedError'
    this.expectedHeadSha = expectedHeadSha
    this.currentHeadSha = currentHeadSha
  }
}

export async function listPullReviewComments(
  target: GitHubPullReviewTarget,
  options: GitHubReviewRequestOptions = {},
): Promise<PullReviewCommentData[]> {
  const comments: PullReviewCommentData[] = []
  let url: string | null = createPullApiUrl(
    target,
    `/comments?per_page=${REVIEW_COMMENTS_PAGE_SIZE}`,
  )

  while (url !== null) {
    const response = await fetchGitHubApi(url, options)
    if (!response.ok) {
      throw await createReviewApiError(response)
    }

    const data: unknown = await response.json()
    if (!Array.isArray(data)) {
      throw new Error('GitHub returned an unexpected review comment listing.')
    }

    for (const item of data) {
      const comment = parsePullReviewComment(item)
      if (comment) {
        comments.push(comment)
      }
    }

    url = readNextPageUrl(response.headers.get('Link'))
  }

  return comments
}

export async function fetchPullHeadSha(
  target: GitHubPullReviewTarget,
  options: GitHubReviewRequestOptions = {},
): Promise<string> {
  const response = await fetchGitHubApi(createPullApiUrl(target), options)
  if (!response.ok) {
    throw await createReviewApiError(response)
  }

  const headSha = await readPullHeadSha(response)
  if (!headSha) {
    throw new Error(
      'GitHub did not return pull request metadata for this pull request.',
    )
  }

  return headSha
}

export async function assertPullHeadUnchanged(
  target: GitHubPullReviewTarget,
  options: GitHubReviewRequestOptions = {},
): Promise<void> {
  const currentHeadSha = await fetchPullHeadSha(target, options)
  if (currentHeadSha !== target.headSha) {
    throw new PullHeadChangedError(target.headSha, currentHeadSha)
  }
}

/** Creates a PENDING review holding the drafts; publishing is a separate
 * submit call, mirroring GitHub's own review flow. */
export async function createPendingReview(
  target: GitHubPullReviewTarget,
  comments: readonly GitHubDraftCommentPayload[],
  options: GitHubReviewRequestOptions = {},
): Promise<number> {
  const response = await fetchGitHubApi(createPullApiUrl(target, '/reviews'), {
    ...options,
    method: 'POST',
    body: JSON.stringify({ commit_id: target.headSha, comments }),
  })

  if (!response.ok) {
    throw await createReviewApiError(response)
  }

  const data: unknown = await response.json()
  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    typeof data.id !== 'number'
  ) {
    throw new Error('GitHub did not return the created review.')
  }

  return data.id
}

export async function submitPendingReview(
  target: GitHubPullReviewTarget,
  reviewId: number,
  event: GitHubReviewEvent,
  body: string,
  options: GitHubReviewRequestOptions = {},
): Promise<void> {
  const response = await fetchGitHubApi(
    createPullApiUrl(target, `/reviews/${encodeURIComponent(reviewId)}/events`),
    {
      ...options,
      method: 'POST',
      body: JSON.stringify(body === '' ? { event } : { event, body }),
    },
  )

  if (!response.ok) {
    throw await createReviewApiError(response)
  }
}

export type PublishReviewOptions = GitHubReviewRequestOptions & {
  /** Resume a review whose PENDING creation already succeeded instead of
   * creating a duplicate. */
  pendingReviewId?: number | null
  onPendingReviewCreated?: (reviewId: number) => void
}

/**
 * Publishes all drafts as one GitHub review: verifies the pull's head SHA
 * still matches the rendered diff, creates a PENDING review with every
 * comment, then submits it with the chosen event. Returns the review id.
 * All failures leave the caller's drafts untouched; if submission fails after
 * the PENDING review exists, `onPendingReviewCreated` has already delivered
 * the id to retry with.
 */
export async function publishReview(
  submission: ReviewSubmission,
  options: PublishReviewOptions = {},
): Promise<number> {
  const { target } = submission
  const payloads: GitHubDraftCommentPayload[] = []

  for (const draft of submission.comments) {
    if (draft.headSha !== target.headSha) {
      throw new Error(
        'A draft comment was written against a different revision of this pull request. Reload the diff and remap your drafts.',
      )
    }

    const result = serializeDraftComment(draft)
    if (!result.ok) {
      throw new Error(result.error)
    }
    payloads.push(result.payload)
  }

  let reviewId = options.pendingReviewId ?? null
  if (reviewId === null) {
    await assertPullHeadUnchanged(target, options)
    reviewId = await createPendingReview(target, payloads, options)
    options.onPendingReviewCreated?.(reviewId)
  }

  await submitPendingReview(
    target,
    reviewId,
    submission.event,
    submission.body,
    options,
  )
  return reviewId
}

function createPullApiUrl(target: GitHubPullReviewTarget, suffix = ''): string {
  const repoPath = `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`

  return `${GITHUB_API_ROOT}${repoPath}/pulls/${encodeURIComponent(target.pullNumber)}${suffix}`
}

function readNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null
  }

  for (const part of linkHeader.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part)
    if (!match) {
      continue
    }

    /* Only ever follow pagination back to the GitHub API origin so a
       misbehaving response cannot redirect the token elsewhere. */
    try {
      const nextUrl = new URL(match[1])
      return nextUrl.origin === GITHUB_API_ROOT ? nextUrl.href : null
    } catch {
      return null
    }
  }

  return null
}

function parsePullReviewComment(item: unknown): PullReviewCommentData | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Partial<Record<string, unknown>>
  const { id, path, html_url, created_at } = record

  if (
    typeof id !== 'number' ||
    typeof path !== 'string' ||
    typeof html_url !== 'string' ||
    typeof created_at !== 'string'
  ) {
    return null
  }

  return {
    id,
    path,
    htmlUrl: html_url,
    createdAt: created_at,
    body: typeof record.body === 'string' ? record.body : '',
    author: parseAuthor(record.user),
    pullRequestReviewId: asNullableNumber(record.pull_request_review_id),
    inReplyToId: asNullableNumber(record.in_reply_to_id),
    line: asNullableNumber(record.line),
    side: asNullableSide(record.side),
    startLine: asNullableNumber(record.start_line),
    startSide: asNullableSide(record.start_side),
  }
}

function parseAuthor(value: unknown): GitHubReviewCommentAuthor {
  if (
    typeof value === 'object' &&
    value !== null &&
    'login' in value &&
    typeof value.login === 'string'
  ) {
    return {
      login: value.login,
      avatarUrl:
        'avatar_url' in value && typeof value.avatar_url === 'string'
          ? value.avatar_url
          : '',
      htmlUrl:
        'html_url' in value && typeof value.html_url === 'string'
          ? value.html_url
          : '',
    }
  }

  return GHOST_AUTHOR
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function asNullableSide(value: unknown): GitHubCommentSide | null {
  return value === 'LEFT' || value === 'RIGHT' ? value : null
}

async function createReviewApiError(
  response: Response,
): Promise<GitHubReviewApiError> {
  const detail = await readReviewErrorDetail(response)

  switch (response.status) {
    case 401:
      return new GitHubReviewApiError(
        'GitHub rejected the saved token. Check that it is valid and has not expired.',
        401,
      )
    case 403:
      return new GitHubReviewApiError(
        'GitHub denied this review request. Check the token’s “Pull requests” write permission, organization SSO authorization, and rate limit.',
        403,
      )
    case 404:
      return new GitHubReviewApiError(
        'GitHub could not find this pull request, or the saved token cannot access its repository.',
        404,
      )
    case 422:
      return new GitHubReviewApiError(
        detail
          ? `GitHub rejected the review: ${detail}`
          : 'GitHub rejected the review. A comment may point at a line that is not part of the diff, or a pending review may already exist.',
        422,
      )
    default:
      return new GitHubReviewApiError(
        detail
          ? `GitHub review request failed (${response.status}): ${detail}`
          : `GitHub review request failed (${response.status}).`,
        response.status,
      )
  }
}

async function readReviewErrorDetail(response: Response): Promise<string> {
  let data: unknown

  try {
    data = await response.json()
  } catch {
    return ''
  }

  if (typeof data !== 'object' || data === null) {
    return ''
  }

  const parts: string[] = []
  if ('message' in data && typeof data.message === 'string') {
    parts.push(data.message)
  }

  /* Validation problems (422) carry the useful specifics — for example which
     line anchor GitHub refused, or an existing pending review — in `errors`. */
  if ('errors' in data && Array.isArray(data.errors)) {
    for (const error of data.errors) {
      if (typeof error === 'string') {
        parts.push(error)
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ) {
        parts.push(error.message)
      }
    }
  }

  return parts.join(' — ')
}
