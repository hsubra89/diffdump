import { looksLikeUnifiedDiff } from './diffs'

export const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_DIFF_MEDIA_TYPE = 'application/vnd.github.diff'
const GITHUB_JSON_MEDIA_TYPE = 'application/vnd.github+json'

export const GITHUB_TOKEN_STORAGE_KEY = 'diffdump.github.token'
export const CREATE_CLASSIC_GITHUB_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Diffdump%20Private%20Repo%20Read%20Access&scopes=repo&default_expires_at=90'

export class GitHubDiffLoadError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitHubDiffLoadError'
    this.status = status
  }
}

export function isTokenFixableGitHubError(error: unknown): boolean {
  return (
    error instanceof GitHubDiffLoadError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  )
}

export type GitHubDiffSource =
  | {
      kind: 'pull'
      owner: string
      repo: string
      number: string
    }
  | {
      kind: 'commit'
      owner: string
      repo: string
      sha: string
    }
  | {
      kind: 'compare'
      owner: string
      repo: string
      range: string
    }

export type GitHubPullReviewTarget = {
  owner: string
  repo: string
  pullNumber: string
  headSha: string
}

export type LoadedGitHubDiff = {
  diff: string
  source: GitHubDiffSource
  reviewTarget: GitHubPullReviewTarget | null
}

export type GitHubFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type GitHubRequestOptions = {
  accept?: string
  body?: string
  fetch?: GitHubFetch
  method?: string
  signal?: AbortSignal
  token?: string
}

type LoadGitHubDiffOptions = Omit<
  GitHubRequestOptions,
  'accept' | 'body' | 'method'
>

export function parseGitHubDiffUrl(input: string): GitHubDiffSource | null {
  let url: URL

  try {
    url = new URL(input.trim())
  } catch {
    return null
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return null
  }

  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\.(?:diff|patch)$/i, '')
    .replace(/\/pull\/(\d+)\/(?:files|commits|changes)$/i, '/pull/$1')

  const pullMatch = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)$/i.exec(path)
  if (pullMatch) {
    return {
      kind: 'pull',
      owner: decodePathPart(pullMatch[1]),
      repo: decodePathPart(pullMatch[2]),
      number: pullMatch[3],
    }
  }

  const commitMatch = /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{4,40})$/i.exec(
    path,
  )
  if (commitMatch) {
    return {
      kind: 'commit',
      owner: decodePathPart(commitMatch[1]),
      repo: decodePathPart(commitMatch[2]),
      sha: commitMatch[3],
    }
  }

  const compareMatch = /^\/([^/]+)\/([^/]+)\/compare\/(.+)$/i.exec(path)
  if (compareMatch) {
    return {
      kind: 'compare',
      owner: decodePathPart(compareMatch[1]),
      repo: decodePathPart(compareMatch[2]),
      range: decodePathPart(compareMatch[3]),
    }
  }

  return null
}

export function createGitHubDiffPath(source: GitHubDiffSource): string {
  const repoPath = `${source.owner}/${source.repo}`

  switch (source.kind) {
    case 'pull':
      return `${repoPath}/pull/${source.number}`
    case 'commit':
      return `${repoPath}/commit/${source.sha}`
    case 'compare':
      return `${repoPath}/compare/${source.range}`
  }
}

export function createGitHubUrlFromPath(path: string): string | null {
  const normalizedPath = path.replace(/^\/+/, '')
  const githubUrl = new URL(`/${normalizedPath}`, 'https://github.com').href
  const source = parseGitHubDiffUrl(githubUrl)

  return source
    ? new URL(`/${createGitHubDiffPath(source)}`, 'https://github.com').href
    : null
}

export async function loadGitHubDiff(
  input: string,
  options: LoadGitHubDiffOptions = {},
): Promise<LoadedGitHubDiff> {
  const source = parseGitHubDiffUrl(input)
  if (!source) {
    throw new Error('Enter a GitHub pull request, commit, or comparison URL.')
  }

  const apiUrl = createGitHubApiUrl(source)
  const [diff, reviewTarget] = await Promise.all([
    loadDiffText(apiUrl, options),
    source.kind === 'pull'
      ? loadPullReviewTarget(apiUrl, source, options)
      : null,
  ])

  return { diff, source, reviewTarget }
}

export async function fetchGitHubApi(
  url: string,
  options: GitHubRequestOptions = {},
): Promise<Response> {
  const fetcher = options.fetch ?? fetch
  const token = options.token?.trim()
  const headers: Record<string, string> = {
    Accept: options.accept ?? GITHUB_JSON_MEDIA_TYPE,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  return fetcher(url, {
    body: options.body,
    cache: 'no-store',
    headers,
    method: options.method,
    signal: options.signal,
  })
}

async function loadDiffText(
  apiUrl: string,
  options: LoadGitHubDiffOptions,
): Promise<string> {
  const response = await fetchGitHubApi(apiUrl, {
    ...options,
    accept: GITHUB_DIFF_MEDIA_TYPE,
  })

  if (!response.ok) {
    throw new GitHubDiffLoadError(
      await githubErrorMessage(response, Boolean(options.token?.trim())),
      response.status,
    )
  }

  const diff = await response.text()
  if (!looksLikeUnifiedDiff(diff)) {
    throw new Error('GitHub did not return a renderable diff for this URL.')
  }

  return diff
}

async function loadPullReviewTarget(
  apiUrl: string,
  source: Extract<GitHubDiffSource, { kind: 'pull' }>,
  options: LoadGitHubDiffOptions,
): Promise<GitHubPullReviewTarget> {
  const response = await fetchGitHubApi(apiUrl, options)

  if (!response.ok) {
    throw new GitHubDiffLoadError(
      await githubErrorMessage(response, Boolean(options.token?.trim())),
      response.status,
    )
  }

  const headSha = await readPullHeadSha(response)
  if (!headSha) {
    throw new Error('GitHub did not return pull request metadata for this URL.')
  }

  return {
    owner: source.owner,
    repo: source.repo,
    pullNumber: source.number,
    headSha,
  }
}

export async function readPullHeadSha(response: Response): Promise<string> {
  let data: unknown

  try {
    data = await response.json()
  } catch {
    return ''
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'head' in data &&
    typeof data.head === 'object' &&
    data.head !== null &&
    'sha' in data.head &&
    typeof data.head.sha === 'string'
  ) {
    return data.head.sha
  }

  return ''
}

export function readStoredGitHubToken(): string {
  try {
    return globalThis.localStorage?.getItem(GITHUB_TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeStoredGitHubToken(token: string): void {
  try {
    if (token === '') {
      globalThis.localStorage?.removeItem(GITHUB_TOKEN_STORAGE_KEY)
    } else {
      globalThis.localStorage?.setItem(GITHUB_TOKEN_STORAGE_KEY, token)
    }
  } catch {
    // The in-memory token still works when browser storage is unavailable.
  }
}

function createGitHubApiUrl(source: GitHubDiffSource): string {
  const repoPath = `/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`

  switch (source.kind) {
    case 'pull':
      return `${GITHUB_API_ROOT}${repoPath}/pulls/${encodeURIComponent(source.number)}`
    case 'commit':
      return `${GITHUB_API_ROOT}${repoPath}/commits/${encodeURIComponent(source.sha)}`
    case 'compare':
      return `${GITHUB_API_ROOT}${repoPath}/compare/${encodeURIComponent(source.range)}`
  }
}

async function githubErrorMessage(
  response: Response,
  hasToken: boolean,
): Promise<string> {
  switch (response.status) {
    case 401:
      return 'GitHub rejected the saved token. Check that it is valid and has not expired.'
    case 403:
      return hasToken
        ? 'GitHub denied access. Check the token’s repo scope, organization SSO authorization, and rate limit.'
        : 'GitHub denied access or the public API rate limit was exceeded. Save a token and try again.'
    case 404:
      return hasToken
        ? 'GitHub could not find this diff, or the saved token cannot access its repository.'
        : 'GitHub could not find this public diff. Save a token if the repository is private.'
  }

  const detail = await readGitHubErrorDetail(response)
  return detail
    ? `GitHub could not load this diff (${response.status}): ${detail}`
    : `GitHub could not load this diff (${response.status}).`
}

async function readGitHubErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as unknown
    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
    ) {
      return data.message
    }
  } catch {
    // GitHub normally returns JSON errors, but the status still explains enough.
  }

  return ''
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
