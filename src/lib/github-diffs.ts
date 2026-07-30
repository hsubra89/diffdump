import { looksLikeUnifiedDiff } from './diffs'

export const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_DIFF_MEDIA_TYPE = 'application/vnd.github.diff'
const GITHUB_JSON_MEDIA_TYPE = 'application/vnd.github+json'

export const GITHUB_TOKEN_STORAGE_KEY = 'diffdump.github.token'
/* Preferred: scoped to selected repositories with Pull requests read/write
   (loading PRs and publishing reviews) plus Contents read (commit and
   comparison diffs). The permissions are picked on GitHub's form. */
export const CREATE_FINE_GRAINED_GITHUB_TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new'
/* The classic `repo` scope grants read and write, including publishing
   reviews — the description must not suggest read-only access. */
export const CREATE_CLASSIC_GITHUB_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Diffdump%20GitHub%20Access&scopes=repo&default_expires_at=90'

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

export type GitHubPullStackSummary = {
  number: number
  position: number
  size: number
  baseRef: string
}

export type GitHubPullStackItem = {
  number: string
  title: string
  state: 'open' | 'closed'
  draft: boolean
  mergedAt: string | null
  headRef: string
  headSha: string
}

export type GitHubPullStack = {
  number: number
  baseRef: string
  pullRequests: GitHubPullStackItem[]
}

export type LoadedGitHubDiff = {
  diff: string
  source: GitHubDiffSource
  reviewTarget: GitHubPullReviewTarget | null
  stackSummary: GitHubPullStackSummary | null
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
  if (source.kind !== 'pull') {
    return {
      diff: await loadDiffText(apiUrl, options),
      source,
      reviewTarget: null,
      stackSummary: null,
    }
  }

  /* Read the head before the diff so a racing push can only leave an older
     review target, which the submit-time head check safely rejects. Reading
     metadata after the diff could pair newer target metadata with stale
     anchors and allow that check to pass incorrectly. */
  const metadata = await loadPullMetadata(apiUrl, source, options)
  const diff = await loadDiffText(apiUrl, options)

  return {
    diff,
    source,
    reviewTarget: metadata.reviewTarget,
    stackSummary: metadata.stackSummary,
  }
}

export async function loadGitHubPullStack(
  source: Extract<GitHubDiffSource, { kind: 'pull' }>,
  stackNumber: number,
  options: LoadGitHubDiffOptions = {},
): Promise<GitHubPullStack | null> {
  const repoPath = `/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`
  const response = await fetchGitHubApi(
    `${GITHUB_API_ROOT}${repoPath}/stacks/${encodeURIComponent(stackNumber)}`,
    options,
  )

  /* A pull request can be unstacked while its diff is loading, and the public
     preview is rolling out repository by repository. Either case should fall
     back to the normal standalone PR experience. */
  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new GitHubDiffLoadError(
      await githubStackErrorMessage(
        response,
        stackNumber,
        Boolean(options.token?.trim()),
      ),
      response.status,
    )
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(
      `GitHub returned an invalid response for stack #${stackNumber}.`,
    )
  }

  const stack = parsePullStack(data)
  if (!stack || stack.number !== stackNumber) {
    throw new Error(
      `GitHub returned invalid metadata for stack #${stackNumber}.`,
    )
  }

  return stack
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

async function loadPullMetadata(
  apiUrl: string,
  source: Extract<GitHubDiffSource, { kind: 'pull' }>,
  options: LoadGitHubDiffOptions,
): Promise<{
  reviewTarget: GitHubPullReviewTarget
  stackSummary: GitHubPullStackSummary | null
}> {
  const response = await fetchGitHubApi(apiUrl, options)

  if (!response.ok) {
    throw new GitHubDiffLoadError(
      await githubErrorMessage(response, Boolean(options.token?.trim())),
      response.status,
    )
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    data = null
  }

  const headSha = readPullHeadShaFromData(data)
  if (!headSha) {
    throw new Error('GitHub did not return pull request metadata for this URL.')
  }

  return {
    reviewTarget: {
      owner: source.owner,
      repo: source.repo,
      pullNumber: source.number,
      headSha,
    },
    stackSummary: parsePullStackSummary(data),
  }
}

export async function readPullHeadSha(response: Response): Promise<string> {
  let data: unknown

  try {
    data = await response.json()
  } catch {
    return ''
  }

  return readPullHeadShaFromData(data)
}

function readPullHeadShaFromData(data: unknown): string {
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

function parsePullStackSummary(data: unknown): GitHubPullStackSummary | null {
  const stack = readObjectProperty(data, 'stack')
  if (!stack) {
    return null
  }

  const number = readIntegerProperty(stack, 'number')
  const position = readIntegerProperty(stack, 'position')
  const size = readIntegerProperty(stack, 'size')
  const baseRef = readNestedStringProperty(stack, 'base', 'ref')

  if (
    number === null ||
    number < 1 ||
    position === null ||
    position < 1 ||
    size === null ||
    size < 2 ||
    position > size ||
    baseRef === null ||
    baseRef === ''
  ) {
    return null
  }

  return { number, position, size, baseRef }
}

function parsePullStack(data: unknown): GitHubPullStack | null {
  const number = readIntegerProperty(data, 'number')
  const baseRef = readNestedStringProperty(data, 'base', 'ref')
  const rawPullRequests = readArrayProperty(data, 'pull_requests')

  if (
    number === null ||
    number < 1 ||
    baseRef === null ||
    baseRef === '' ||
    rawPullRequests === null ||
    rawPullRequests.length < 2
  ) {
    return null
  }

  const pullRequests: GitHubPullStackItem[] = []
  for (const rawPull of rawPullRequests) {
    const pullNumber = readIntegerProperty(rawPull, 'number')
    const title = readStringProperty(rawPull, 'title')
    const state = readStringProperty(rawPull, 'state')
    const draft = readBooleanProperty(rawPull, 'draft')
    const mergedAt = readNullableStringProperty(rawPull, 'merged_at')
    const headRef = readNestedStringProperty(rawPull, 'head', 'ref')
    const headSha = readNestedStringProperty(rawPull, 'head', 'sha')

    if (
      pullNumber === null ||
      pullNumber < 1 ||
      (state !== 'open' && state !== 'closed') ||
      draft === null ||
      mergedAt === undefined ||
      headRef === null ||
      headRef === '' ||
      headSha === null ||
      headSha === ''
    ) {
      return null
    }

    pullRequests.push({
      number: String(pullNumber),
      title: title?.trim() || `Pull request #${pullNumber}`,
      state,
      draft,
      mergedAt,
      headRef,
      headSha,
    })
  }

  return { number, baseRef, pullRequests }
}

function readObjectProperty(
  data: unknown,
  property: string,
): Record<string, unknown> | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !(property in data) ||
    typeof data[property as keyof typeof data] !== 'object' ||
    data[property as keyof typeof data] === null ||
    Array.isArray(data[property as keyof typeof data])
  ) {
    return null
  }

  return data[property as keyof typeof data] as Record<string, unknown>
}

function readArrayProperty(data: unknown, property: string): unknown[] | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !(property in data) ||
    !Array.isArray(data[property as keyof typeof data])
  ) {
    return null
  }

  return data[property as keyof typeof data] as unknown[]
}

function readStringProperty(data: unknown, property: string): string | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !(property in data) ||
    typeof data[property as keyof typeof data] !== 'string'
  ) {
    return null
  }

  return data[property as keyof typeof data] as string
}

function readBooleanProperty(data: unknown, property: string): boolean | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !(property in data) ||
    typeof data[property as keyof typeof data] !== 'boolean'
  ) {
    return null
  }

  return data[property as keyof typeof data] as boolean
}

function readIntegerProperty(data: unknown, property: string): number | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !(property in data) ||
    typeof data[property as keyof typeof data] !== 'number'
  ) {
    return null
  }

  const value = data[property as keyof typeof data] as number
  return Number.isSafeInteger(value) ? value : null
}

function readNullableStringProperty(
  data: unknown,
  property: string,
): string | null | undefined {
  if (typeof data !== 'object' || data === null || !(property in data)) {
    return undefined
  }

  const value = data[property as keyof typeof data]
  return value === null || typeof value === 'string' ? value : undefined
}

function readNestedStringProperty(
  data: unknown,
  objectProperty: string,
  stringProperty: string,
): string | null {
  return readStringProperty(
    readObjectProperty(data, objectProperty),
    stringProperty,
  )
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

async function githubStackErrorMessage(
  response: Response,
  stackNumber: number,
  hasToken: boolean,
): Promise<string> {
  switch (response.status) {
    case 401:
      return `GitHub rejected the saved token while loading stack #${stackNumber}.`
    case 403:
      return hasToken
        ? `GitHub denied access to stack #${stackNumber}. Check the token’s permissions, organization SSO authorization, and rate limit.`
        : `GitHub denied access to stack #${stackNumber}, or the public API rate limit was exceeded.`
  }

  const detail = await readGitHubErrorDetail(response)
  return detail
    ? `GitHub could not load stack #${stackNumber} (${response.status}): ${detail}`
    : `GitHub could not load stack #${stackNumber} (${response.status}).`
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
