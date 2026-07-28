import type { FileDiffMetadata } from '@pierre/diffs'

export const DIFF_CATEGORIES = ['source', 'tests', 'docs', 'other'] as const

export type DiffCategory = (typeof DIFF_CATEGORIES)[number]
export type DiffCategoryFilter = 'all' | DiffCategory
export type DiffFileOrder = 'patch' | 'category'

export type DiffLineSummary = {
  files: number
  additions: number
  deletions: number
}

export type DiffSummary = DiffLineSummary & {
  categories: Record<DiffCategory, DiffLineSummary>
}

export type ClassifiedDiffFile = {
  id: string
  file: FileDiffMetadata
  originalIndex: number
  category: DiffCategory
  additions: number
  deletions: number
}

export const DIFF_CATEGORY_DETAILS: Record<
  DiffCategory,
  { label: string; shortLabel: string }
> = {
  source: { label: 'Source', shortLabel: 'src' },
  tests: { label: 'Tests', shortLabel: 'test' },
  docs: { label: 'Docs', shortLabel: 'docs' },
  other: { label: 'Other', shortLabel: 'other' },
}

const TEST_DIRECTORY_PATTERN =
  /(^|\/)(?:__snapshots__|__tests__|cypress|e2e|integration-tests?|playwright|specs?|tests?)(?:\/|$)/
const TEST_FILE_PATTERN =
  /(?:^|[._-])(?:e2e|specs?|tests?)(?:[._-]|$)|(?:^test_|_(?:spec|test)s?$)|(?:spec|test)\.(?:[cm]?[jt]sx?|go|java|kt|kts|php|py|rb|rs|swift)$/

const DOCS_DIRECTORY_PATTERN =
  /(^|\/)(?:doc|docs|documentation|guides?|man|manuals?)(?:\/|$)/
const DOCS_FILE_PATTERN =
  /^(?:authors|changelog|code[-_]?of[-_]?conduct|contributing|contributors|license|notice|readme|security)(?:\.[^.]+)?$/
const DOCS_EXTENSION_PATTERN = /\.(?:adoc|asciidoc|md|mdx|rdoc|rst)$/

const OTHER_DIRECTORY_PATTERN =
  /(^|\/)(?:\.github|\.storybook|assets?|build|coverage|dist|fixtures?|generated|node_modules|public|third[-_]?party|vendor)(?:\/|$)/
const OTHER_FILE_PATTERN =
  /^(?:cargo\.lock|composer\.lock|dockerfile|gemfile\.lock|go\.(?:mod|sum)|makefile|package-lock\.json|package\.json|pipfile\.lock|pnpm-lock\.yaml|poetry\.lock|tsconfig(?:\.[^.]+)?\.json|turbo\.json|uv\.lock|yarn\.lock)$/
const CONFIG_FILE_PATTERN =
  /(?:^|\.)(?:babelrc|browserslistrc|config|editorconfig|eslintignore|eslintrc|gitignore|npmrc|nvmrc|prettierignore|prettierrc|stylelintrc)(?:\.|$)/
const GENERATED_FILE_PATTERN = /(?:^|[._-])(?:gen|generated|min)(?:[._-]|$)/
const ASSET_EXTENSION_PATTERN =
  /\.(?:avif|bmp|eot|gif|ico|jpe?g|lock|map|mp3|mp4|ogg|otf|pdf|png|svg|ttf|webm|webp|woff2?)$/

export function classifyDiffFile(path: string): DiffCategory {
  const normalizedPath = normalizePath(path)
  const fileName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1)

  if (
    TEST_DIRECTORY_PATTERN.test(normalizedPath) ||
    TEST_FILE_PATTERN.test(fileName)
  ) {
    return 'tests'
  }

  if (
    DOCS_DIRECTORY_PATTERN.test(normalizedPath) ||
    DOCS_FILE_PATTERN.test(fileName) ||
    DOCS_EXTENSION_PATTERN.test(fileName)
  ) {
    return 'docs'
  }

  if (
    OTHER_DIRECTORY_PATTERN.test(normalizedPath) ||
    OTHER_FILE_PATTERN.test(fileName) ||
    CONFIG_FILE_PATTERN.test(fileName) ||
    GENERATED_FILE_PATTERN.test(fileName) ||
    ASSET_EXTENSION_PATTERN.test(fileName)
  ) {
    return 'other'
  }

  return 'source'
}

export function createClassifiedDiffFiles(
  files: readonly FileDiffMetadata[],
): ClassifiedDiffFile[] {
  return files.map((file, originalIndex) => {
    const { additions, deletions } = getFileLineSummary(file)

    return {
      id: `${file.cacheKey ?? file.name}-${originalIndex}`,
      file,
      originalIndex,
      category: classifyDiffFile(file.name),
      additions,
      deletions,
    }
  })
}

export function filterAndOrderDiffFiles(
  files: readonly ClassifiedDiffFile[],
  filter: DiffCategoryFilter,
  order: DiffFileOrder,
): ClassifiedDiffFile[] {
  const filtered =
    filter === 'all'
      ? [...files]
      : files.filter((file) => file.category === filter)

  if (order === 'category') {
    const categoryIndexes = new Map(
      DIFF_CATEGORIES.map((category, index) => [category, index]),
    )

    filtered.sort(
      (left, right) =>
        (categoryIndexes.get(left.category) ?? 0) -
          (categoryIndexes.get(right.category) ?? 0) ||
        left.originalIndex - right.originalIndex,
    )
  }

  return filtered
}

export function summarizeDiffFiles(
  files: readonly ClassifiedDiffFile[],
): DiffSummary {
  const summary: DiffSummary = {
    ...emptyLineSummary(),
    categories: {
      source: emptyLineSummary(),
      tests: emptyLineSummary(),
      docs: emptyLineSummary(),
      other: emptyLineSummary(),
    },
  }

  for (const file of files) {
    addFileToSummary(summary, file)
    addFileToSummary(summary.categories[file.category], file)
  }

  return summary
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+/, '').toLowerCase()
}

function getFileLineSummary(file: FileDiffMetadata) {
  let additions = 0
  let deletions = 0

  for (const hunk of file.hunks) {
    additions += hunk.additionLines
    deletions += hunk.deletionLines
  }

  return { additions, deletions }
}

function emptyLineSummary(): DiffLineSummary {
  return { files: 0, additions: 0, deletions: 0 }
}

function addFileToSummary(summary: DiffLineSummary, file: ClassifiedDiffFile) {
  summary.files += 1
  summary.additions += file.additions
  summary.deletions += file.deletions
}
