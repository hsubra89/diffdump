import { looksLikeUnifiedDiff } from './diffs'

const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_DIFF_MEDIA_TYPE = 'application/vnd.github.diff'

export const GITHUB_TOKEN_STORAGE_KEY = 'diffdump.github.token'
export const CREATE_CLASSIC_GITHUB_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Diffdump%20Private%20Repo%20Read%20Access&scopes=repo&default_expires_at=90'

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

type GitHubFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

type LoadGitHubDiffOptions = {
  fetch?: GitHubFetch
  signal?: AbortSignal
  token?: string
}

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
    .replace(/\/pull\/(\d+)\/(?:files|commits)$/i, '/pull/$1')

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

  return parseGitHubDiffUrl(githubUrl) ? githubUrl : null
}

export async function loadGitHubDiff(
  input: string,
  options: LoadGitHubDiffOptions = {},
): Promise<string> {
  const source = parseGitHubDiffUrl(input)
  if (!source) {
    throw new Error('Enter a GitHub pull request, commit, or comparison URL.')
  }

  const fetcher = options.fetch ?? fetch
  const token = options.token?.trim()
  const headers: Record<string, string> = {
    Accept: GITHUB_DIFF_MEDIA_TYPE,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetcher(createGitHubApiUrl(source), {
    cache: 'no-store',
    headers,
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(await githubErrorMessage(response, Boolean(token)))
  }

  const diff = await response.text()
  if (!looksLikeUnifiedDiff(diff)) {
    throw new Error('GitHub did not return a renderable diff for this URL.')
  }

  return diff
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
