import type {
  FileContents,
  FileDiffContentsLoader,
  FileDiffLoadedFiles,
  FileDiffMetadata,
} from '@pierre/diffs'
import { applyPatch, parsePatch, type StructuredPatch } from 'diff'

import {
  GITHUB_API_ROOT,
  fetchGitHubApi,
  readStoredGitHubToken,
  type GitHubDiffSource,
  type GitHubFetch,
} from './github-diffs'
import type { GitHubBaseDiffSource } from './diffs'

const GITHUB_RAW_MEDIA_TYPE = 'application/vnd.github.raw+json'

/** Owner, repository, and the exact commit a file revision is read from. */
type GitHubRepoRef = {
  owner: string
  repo: string
  ref: string
}

type GitHubRepoName = Pick<GitHubRepoRef, 'owner' | 'repo'>

/** The two commits a loaded diff compares. `oldRef` is null for root
 * commits, which have no old side. */
type GitHubDiffRefs = {
  oldRef: GitHubRepoRef | null
  newRef: GitHubRepoRef
}

type GitHubJsonFetch = (url: string) => Promise<unknown>

export type GitHubFileContentsLoaderOptions = {
  fetch?: GitHubFetch
  /** Read per request, so a token saved after the diff loaded still applies.
   * Defaults to the token in browser storage. */
  getToken?: () => string
  /** Pull mode: the head SHA the rendered diff was loaded from. Hydrated
   * context must match that revision, so it overrides the head the pulls
   * API returns, which may have moved since the diff was fetched. */
  pinnedHeadSha?: string | null
}

export type GitHubBaseFileContentsLoaderOptions = Omit<
  GitHubFileContentsLoaderOptions,
  'pinnedHeadSha'
>

/**
 * Creates the `loadDiffFiles` loader that backs hunk expansion for
 * GitHub-loaded diffs. The first click on a collapsed-context expander makes
 * `@pierre/diffs` call the loader once per file, and the returned contents
 * are merged around the patch's existing hunks — so both sides must be read
 * at the exact revisions the diff compares:
 *
 * - pull:    merge base of base and head → the pinned head (pull diffs are
 *            three-dot, so the old side is the merge base, not the base
 *            branch tip)
 * - commit:  first parent → the commit itself
 * - compare: merge base → the range's head commit
 *
 * Refs resolve lazily on the first expansion and are cached, as is every
 * loaded file, so repeated expansions never refetch. A failed promise is
 * evicted so the next expander click retries.
 */
export function createGitHubFileContentsLoader(
  source: GitHubDiffSource,
  options: GitHubFileContentsLoaderOptions = {},
): FileDiffContentsLoader {
  const getToken = options.getToken ?? readStoredGitHubToken
  const pinnedHeadSha = options.pinnedHeadSha ?? null
  const fileCache = new Map<string, Promise<FileDiffLoadedFiles>>()
  let refsPromise: Promise<GitHubDiffRefs> | null = null

  async function fetchJson(url: string): Promise<unknown> {
    const token = getToken()
    const response = await fetchGitHubApi(url, {
      fetch: options.fetch,
      token,
    })
    await assertGitHubResponseOk(response, url, token.trim() !== '')
    return response.json()
  }

  function resolveRefs(): Promise<GitHubDiffRefs> {
    refsPromise ??= resolveDiffRefs(source, pinnedHeadSha, fetchJson).catch(
      (error: unknown) => {
        refsPromise = null
        throw error
      },
    )
    return refsPromise
  }

  async function loadFiles(
    file: FileDiffMetadata,
  ): Promise<FileDiffLoadedFiles> {
    const refs = await resolveRefs()

    if (file.type === 'rename-pure') {
      return {
        oldFile: null,
        newFile: await loadGitHubFileContents(
          refs.newRef,
          file.name,
          options.fetch,
          getToken,
        ),
      }
    }

    if (refs.oldRef === null) {
      throw new Error(
        `GitHub has no old revision of ${file.name} to expand context from.`,
      )
    }

    const [oldFile, newFile] = await Promise.all([
      loadGitHubFileContents(
        refs.oldRef,
        file.prevName ?? file.name,
        options.fetch,
        getToken,
      ),
      loadGitHubFileContents(refs.newRef, file.name, options.fetch, getToken),
    ])
    return { oldFile, newFile }
  }

  return (file) => {
    if (file.type === 'new' || file.type === 'deleted') {
      return Promise.reject(
        new Error(`A ${file.type} file already shows all of its lines.`),
      )
    }

    /* Keyed by revision (object IDs) as well as path, so a reloaded diff
       parsed into fresh metadata never reuses contents from an older
       revision of the file. */
    const cacheKey = [
      file.type,
      file.prevName ?? '',
      file.name,
      file.prevObjectId ?? '',
      file.newObjectId ?? '',
    ].join('\0')
    const cached = fileCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const promise = loadFiles(file).catch((error: unknown) => {
      if (fileCache.get(cacheKey) === promise) {
        fileCache.delete(cacheKey)
      }
      throw error
    })
    fileCache.set(cacheKey, promise)
    return promise
  }
}

/**
 * Hydrates a locally produced patch from one GitHub base commit. GitHub owns
 * only the old side; the new side is reconstructed in the browser by applying
 * the uploaded per-file patch to the fetched base contents.
 */
export function createGitHubBaseFileContentsLoader(
  source: GitHubBaseDiffSource,
  diff: string,
  options: GitHubBaseFileContentsLoaderOptions = {},
): FileDiffContentsLoader {
  const getToken = options.getToken ?? readStoredGitHubToken
  const repoRef: GitHubRepoRef = {
    owner: source.owner,
    repo: source.repo,
    ref: source.baseSha,
  }
  const fileCache = new Map<string, Promise<FileDiffLoadedFiles>>()
  let patches: StructuredPatch[] | null = null

  function loadPatches(): StructuredPatch[] {
    patches ??= parsePatch(diff)
    return patches
  }

  async function loadFiles(
    file: FileDiffMetadata,
  ): Promise<FileDiffLoadedFiles> {
    const oldPath = file.prevName ?? file.name
    const oldFile = await loadGitHubFileContents(
      repoRef,
      oldPath,
      options.fetch,
      getToken,
    )

    if (file.type === 'rename-pure') {
      return {
        oldFile: null,
        newFile: {
          name: file.name,
          contents: oldFile.contents,
          cacheKey: localFileCacheKey(oldFile, file),
        },
      }
    }

    const patch = findFilePatch(loadPatches(), file)
    if (!patch) {
      throw new Error(
        `The uploaded patch for ${file.name} could not be matched to the shared diff.`,
      )
    }

    const contents = applyPatch(oldFile.contents, patch, { fuzzFactor: 0 })
    if (contents === false) {
      throw new Error(
        `The uploaded patch for ${file.name} does not apply to ${source.owner}/${source.repo}@${source.baseSha}. Check that the shared base commit is correct.`,
      )
    }

    return {
      oldFile,
      newFile: {
        name: file.name,
        contents,
        cacheKey: localFileCacheKey(oldFile, file),
      },
    }
  }

  return (file) => {
    if (file.type === 'new' || file.type === 'deleted') {
      return Promise.reject(
        new Error(`A ${file.type} file already shows all of its lines.`),
      )
    }

    const cacheKey = [
      file.type,
      file.prevName ?? '',
      file.name,
      file.prevObjectId ?? '',
      file.newObjectId ?? '',
    ].join('\0')
    const cached = fileCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const promise = loadFiles(file).catch((error: unknown) => {
      if (fileCache.get(cacheKey) === promise) {
        fileCache.delete(cacheKey)
      }
      throw error
    })
    fileCache.set(cacheKey, promise)
    return promise
  }
}

async function loadGitHubFileContents(
  repoRef: GitHubRepoRef,
  path: string,
  fetcher: GitHubFetch | undefined,
  getToken: () => string,
): Promise<FileContents> {
  const url = `${GITHUB_API_ROOT}${repoApiPath(repoRef)}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(repoRef.ref)}`
  const token = getToken()
  const response = await fetchGitHubApi(url, {
    accept: GITHUB_RAW_MEDIA_TYPE,
    fetch: fetcher,
    token,
  })
  await assertGitHubResponseOk(
    response,
    `${repoRef.owner}/${repoRef.repo}/${path}@${repoRef.ref}`,
    token.trim() !== '',
  )

  return {
    name: path,
    contents: await response.text(),
    cacheKey: `github:${repoRef.owner}/${repoRef.repo}:${repoRef.ref}:${path}`,
  }
}

function findFilePatch(
  patches: readonly StructuredPatch[],
  file: FileDiffMetadata,
): StructuredPatch | null {
  const oldPath = file.prevName ?? file.name

  return (
    patches.find(
      (patch) =>
        normalizePatchPath(patch.oldFileName) === oldPath &&
        normalizePatchPath(patch.newFileName) === file.name &&
        patch.hunks.length > 0,
    ) ?? null
  )
}

function normalizePatchPath(path: string | undefined): string | null {
  if (!path || path === '/dev/null') {
    return null
  }

  return path.replace(/^[ab]\//, '')
}

function localFileCacheKey(
  oldFile: FileContents,
  file: FileDiffMetadata,
): string {
  const version = file.newObjectId ?? file.cacheKey ?? file.name
  return `${oldFile.cacheKey ?? 'github-local'}:patched:${version}:${file.name}`
}

function resolveDiffRefs(
  source: GitHubDiffSource,
  pinnedHeadSha: string | null,
  fetchJson: GitHubJsonFetch,
): Promise<GitHubDiffRefs> {
  switch (source.kind) {
    case 'pull':
      return resolvePullRefs(source, pinnedHeadSha, fetchJson)
    case 'commit':
      return resolveCommitRefs(source, fetchJson)
    case 'compare':
      return resolveCompareRefs(source, fetchJson)
  }
}

async function resolvePullRefs(
  source: Extract<GitHubDiffSource, { kind: 'pull' }>,
  pinnedHeadSha: string | null,
  fetchJson: GitHubJsonFetch,
): Promise<GitHubDiffRefs> {
  const data = await fetchJson(
    `${GITHUB_API_ROOT}${repoApiPath(source)}/pulls/${encodeURIComponent(source.number)}`,
  )
  const baseSha = readString(data, ['base', 'sha'])
  const headSha = pinnedHeadSha ?? readString(data, ['head', 'sha'])
  /* Fork pull requests read the two sides from different repositories. */
  const baseRepo =
    readRepoFullName(data, ['base', 'repo', 'full_name']) ?? source
  const headRepo =
    readRepoFullName(data, ['head', 'repo', 'full_name']) ?? source

  if (baseSha === null || headSha === null) {
    throw new Error(
      `GitHub did not return the compared commits for pull request #${source.number}.`,
    )
  }

  const compareRange = isSameRepo(baseRepo, headRepo)
    ? `${baseSha}...${headSha}`
    : `${baseRepo.owner}:${baseSha}...${headRepo.owner}:${headSha}`
  const compare = await fetchJson(
    `${GITHUB_API_ROOT}${repoApiPath(baseRepo)}/compare/${encodeURIComponent(compareRange)}`,
  )
  const mergeBaseSha = readString(compare, ['merge_base_commit', 'sha'])
  if (mergeBaseSha === null) {
    throw new Error(
      `GitHub did not return a merge base for pull request #${source.number}.`,
    )
  }

  return {
    oldRef: { ...baseRepo, ref: mergeBaseSha },
    newRef: { ...headRepo, ref: headSha },
  }
}

async function resolveCommitRefs(
  source: Extract<GitHubDiffSource, { kind: 'commit' }>,
  fetchJson: GitHubJsonFetch,
): Promise<GitHubDiffRefs> {
  const data = await fetchJson(
    `${GITHUB_API_ROOT}${repoApiPath(source)}/commits/${encodeURIComponent(source.sha)}`,
  )
  const sha = readString(data, ['sha'])
  if (sha === null) {
    throw new Error(`GitHub did not return commit ${source.sha}.`)
  }

  /* A commit's diff compares against its first parent; root commits have
     none and every file in them is new. */
  const parents = readArray(data, ['parents'])
  const parentSha =
    parents !== null && parents.length > 0
      ? readString(parents[0], ['sha'])
      : null

  return {
    oldRef:
      parentSha === null
        ? null
        : { owner: source.owner, repo: source.repo, ref: parentSha },
    newRef: { owner: source.owner, repo: source.repo, ref: sha },
  }
}

async function resolveCompareRefs(
  source: Extract<GitHubDiffSource, { kind: 'compare' }>,
  fetchJson: GitHubJsonFetch,
): Promise<GitHubDiffRefs> {
  const url = `${GITHUB_API_ROOT}${repoApiPath(source)}/compare/${encodeURIComponent(source.range)}`
  const data = await fetchJson(url)
  /* Comparison diffs are three-dot, so the old side is the merge base. */
  const baseSha =
    readString(data, ['merge_base_commit', 'sha']) ??
    readString(data, ['base_commit', 'sha'])
  const headSha = await resolveCompareHeadSha(url, data, fetchJson)

  if (baseSha === null || headSha === null) {
    throw new Error(
      `GitHub did not return the compared commits for ${source.range}.`,
    )
  }

  return {
    oldRef: { owner: source.owner, repo: source.repo, ref: baseSha },
    newRef: { owner: source.owner, repo: source.repo, ref: headSha },
  }
}

/**
 * The compare response lists at most 250 commits, newest last; the head
 * commit is the final one. Truncated lists are re-requested as a
 * one-commit page positioned at the end of the range.
 */
async function resolveCompareHeadSha(
  url: string,
  data: unknown,
  fetchJson: GitHubJsonFetch,
): Promise<string | null> {
  const commits = readArray(data, ['commits'])
  if (commits === null || commits.length === 0) {
    return null
  }

  const totalCommits = readNumber(data, ['total_commits'])
  if (totalCommits === null || commits.length >= totalCommits) {
    return readString(commits[commits.length - 1], ['sha'])
  }

  const lastPage = await fetchJson(`${url}?page=${totalCommits}&per_page=1`)
  const lastPageCommits = readArray(lastPage, ['commits'])
  return lastPageCommits === null || lastPageCommits.length === 0
    ? null
    : readString(lastPageCommits[0], ['sha'])
}

async function assertGitHubResponseOk(
  response: Response,
  label: string,
  hasToken: boolean,
): Promise<void> {
  if (response.ok) {
    return
  }

  const detail = readErrorDetail(await response.text())
  if (
    response.status === 403 &&
    (response.headers.get('x-ratelimit-remaining') === '0' ||
      /rate limit/i.test(detail))
  ) {
    throw new Error(
      'GitHub rate limit exceeded while expanding context. Save a token to raise the limit.',
    )
  }

  if (response.status === 401) {
    throw new Error(
      'GitHub rejected the saved token while expanding context. Check that it is valid and has not expired.',
    )
  }

  if (response.status === 403) {
    throw new Error(
      hasToken
        ? 'GitHub denied access while expanding context. Check the token’s repository permissions and organization SSO authorization.'
        : 'GitHub denied anonymous access while expanding context. Save a token and try again.',
    )
  }

  if (response.status === 404) {
    throw new Error(
      hasToken
        ? `GitHub could not access ${label}. The saved token may lack repository access, or the commit or path may be unavailable.`
        : `GitHub could not access ${label}. Save a token if the repository is private, or check that the commit and path are available.`,
    )
  }

  throw new Error(
    detail === ''
      ? `GitHub request for ${label} failed (${response.status}).`
      : `GitHub request for ${label} failed (${response.status}): ${detail}`,
  )
}

function readErrorDetail(body: string): string {
  try {
    const message = readString(JSON.parse(body), ['message'])
    if (message !== null) {
      return message
    }
  } catch {
    // Plain-text bodies are used as-is.
  }
  return body.trim()
}

function repoApiPath({ owner, repo }: GitHubRepoName): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

/** Encodes a repository file path segment by segment, keeping the slashes
 * that route the contents API. Dot segments are rejected because URL
 * normalization would resolve them before the request is sent, letting an
 * uploaded patch retarget the fetch outside `/repos/<owner>/<repo>/contents`. */
function encodeGitHubPath(path: string): string {
  const segments = path.replace(/^\/+/, '').split('/')
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(`The path ${path} is not a valid repository file path.`)
  }
  return segments.map(encodeURIComponent).join('/')
}

function isSameRepo(a: GitHubRepoName, b: GitHubRepoName): boolean {
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() &&
    a.repo.toLowerCase() === b.repo.toLowerCase()
  )
}

/** Splits an `owner/name` repository string from the API into its parts. */
function readRepoFullName(
  data: unknown,
  path: readonly string[],
): GitHubRepoName | null {
  const fullName = readString(data, path)
  const separator = fullName === null ? -1 : fullName.indexOf('/')
  if (
    fullName === null ||
    separator <= 0 ||
    separator === fullName.length - 1
  ) {
    return null
  }

  return {
    owner: fullName.slice(0, separator),
    repo: fullName.slice(separator + 1),
  }
}

function readString(data: unknown, path: readonly string[]): string | null {
  const value = readPath(data, path)
  return typeof value === 'string' && value !== '' ? value : null
}

function readNumber(data: unknown, path: readonly string[]): number | null {
  const value = readPath(data, path)
  return typeof value === 'number' ? value : null
}

function readArray(data: unknown, path: readonly string[]): unknown[] | null {
  const value = readPath(data, path)
  return Array.isArray(value) ? value : null
}

function readPath(data: unknown, path: readonly string[]): unknown {
  let current: unknown = data
  for (const key of path) {
    if (typeof current !== 'object' || current === null) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
