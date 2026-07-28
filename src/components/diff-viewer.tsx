import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CodeView,
  WorkerPoolContextProvider,
  type CodeViewHandle,
  type CodeViewDiffItem,
  type CodeViewItem,
  type FileDiffMetadata,
  type WorkerInitializationRenderOptions,
  type WorkerPoolOptions,
} from '@pierre/diffs/react'
import { parsePatchFiles } from '@pierre/diffs'
import DiffWorkerUrl from '@pierre/diffs/worker/worker.js?worker&url'
import { Link } from '@tanstack/react-router'

import DiffFilePicker from './diff-file-picker'
import { ErrorHero } from './error-hero'
import { Wordmark } from './wordmark'
import { Button, IconButton, buttonVariants } from './ui/button'
import { SegmentedControl, SegmentedControlItem } from './ui/segmented-control'
import { PanelHeader, Toolbar, eyebrowClassName } from './ui/surfaces'
import { ThemeToggle } from './ui/theme-toggle'
import { Toggle } from './ui/toggle'
import { cn } from '../lib/cn'
import {
  DIFF_CATEGORIES,
  DIFF_CATEGORY_DETAILS,
  createClassifiedDiffFiles,
  filterAndOrderDiffFiles,
  summarizeDiffFiles,
  type DiffCategory,
  type DiffCategoryFilter,
  type DiffFileOrder,
  type DiffLineSummary,
  type DiffSummary,
} from '../lib/diff-files'
import type { StoredDiff } from '../lib/diffs'
import { useResolvedTheme } from '../lib/theme'
import {
  formatAbsoluteExpiry,
  formatExpiryCountdown,
  getExpiryCountdownUpdateDelay,
} from '../lib/expiry'
import { createDiffFilePickerEntries } from '../lib/file-picker'

type DiffStyle = 'unified' | 'split'

type DiffViewerProps =
  | {
      mode?: 'shared'
      slug: string
      storedDiff: StoredDiff
    }
  | {
      mode: 'github'
      githubUrl: string
      diff: string
    }

const workerPoolOptions: WorkerPoolOptions = {
  poolSize: Math.min(
    Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1),
    3,
  ),
  totalASTLRUCacheSize: 100,
  workerFactory: () => new Worker(DiffWorkerUrl, { type: 'module' }),
}

const diffThemes = {
  dark: 'pierre-dark',
  light: 'pierre-light',
} as const

const highlighterOptions: WorkerInitializationRenderOptions = {
  theme: diffThemes,
  lineDiffType: 'word-alt',
}

export default function DiffViewer(props: DiffViewerProps) {
  const isGitHubDiff = props.mode === 'github'
  const viewerId = isGitHubDiff ? props.githubUrl : props.slug
  const diff = isGitHubDiff ? props.diff : props.storedDiff.diff
  const expiresAt = isGitHubDiff ? null : props.storedDiff.expiresAt
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('unified')
  const [wrapLines, setWrapLines] = useState(false)
  const [categoryFilter, setCategoryFilter] =
    useState<DiffCategoryFilter>('all')
  const [fileOrder, setFileOrder] = useState<DiffFileOrder>('patch')
  const resolvedTheme = useResolvedTheme()
  const [copied, setCopied] = useState(false)
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const codeViewRef = useRef<CodeViewHandle<undefined>>(null)

  const parsed = useMemo(() => {
    try {
      const files = parsePatchFiles(diff, viewerId, true).flatMap(
        (patch) => patch.files,
      )

      if (files.length === 0) {
        throw new Error('No files were found in this diff.')
      }

      return { files, error: null }
    } catch (error) {
      return {
        files: [] as FileDiffMetadata[],
        error:
          error instanceof Error
            ? error.message
            : 'The diff could not be rendered.',
      }
    }
  }, [diff, viewerId])

  const classifiedFiles = useMemo(
    () => createClassifiedDiffFiles(parsed.files),
    [parsed.files],
  )
  const summary = useMemo(
    () => summarizeDiffFiles(classifiedFiles),
    [classifiedFiles],
  )
  const visibleFiles = useMemo(
    () => filterAndOrderDiffFiles(classifiedFiles, categoryFilter, fileOrder),
    [categoryFilter, classifiedFiles, fileOrder],
  )
  const filesById = useMemo(
    () => new Map(classifiedFiles.map((file) => [file.id, file])),
    [classifiedFiles],
  )
  const items = useMemo<CodeViewDiffItem[]>(
    () =>
      visibleFiles.map(({ id, file }) => ({
        id,
        type: 'diff',
        fileDiff: file,
      })),
    [visibleFiles],
  )
  const filePickerEntries = useMemo(
    () =>
      createDiffFilePickerEntries(
        visibleFiles.map((file) => ({
          itemId: file.id,
          name: file.file.name,
          type: file.file.type,
          category: file.category,
          additions: file.additions,
          deletions: file.deletions,
        })),
      ),
    [visibleFiles],
  )
  const renderHeaderPrefix = useCallback(
    (item: CodeViewItem) => {
      const file = filesById.get(item.id)

      return file ? <DiffCategoryBadge category={file.category} /> : null
    },
    [filesById],
  )
  const options = useMemo(
    () => ({
      diffStyle,
      diffIndicators: 'bars' as const,
      hunkSeparators: 'line-info' as const,
      itemMetrics: {
        lineHeight: 20,
      },
      layout: {
        paddingTop: 20,
        paddingBottom: 48,
        gap: 18,
      },
      overflow: wrapLines ? ('wrap' as const) : ('scroll' as const),
      theme: diffThemes,
      themeType: resolvedTheme,
      stickyHeaders: true,
    }),
    [diffStyle, wrapLines, resolvedTheme],
  )

  const scrollToFile = useCallback((itemId: string) => {
    codeViewRef.current?.scrollTo({
      type: 'item',
      id: itemId,
      align: 'start',
      behavior: 'smooth-auto',
    })
    setFilePickerOpen(false)
  }, [])

  useEffect(() => {
    if (!filePickerOpen) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFilePickerOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [filePickerOpen])

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="grid h-svh w-full min-w-0 grid-rows-[56px_auto_minmax(0,1fr)] overflow-hidden bg-canvas text-foreground [grid-template-areas:'header''toolbar''workspace']">
      <header className="flex items-center justify-between border-b border-line bg-canvas/95 px-3 [grid-area:header] sm:px-5">
        <Wordmark />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'hidden sm:inline-flex',
            )}
            to="/"
          >
            Home
          </Link>
          {isGitHubDiff ? (
            <a
              className={buttonVariants({ variant: 'primary', size: 'sm' })}
              href={props.githubUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              View on GitHub
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <Button
              className="min-w-24"
              variant="primary"
              size="sm"
              onClick={copyShareLink}
            >
              <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          )}
        </div>
      </header>

      <Toolbar
        className="min-w-0 max-w-full items-stretch gap-0 overflow-hidden p-0 [grid-area:toolbar] md:grid md:grid-cols-[240px_minmax(0,1fr)]"
        aria-label="Diff controls"
      >
        <div className="hidden items-center gap-2 border-r border-line px-3 md:flex">
          <span className={cn(eyebrowClassName, 'text-muted')}>Order</span>
          <FileOrderControl
            className="min-w-0 flex-1 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-1.5"
            order={fileOrder}
            onChange={setFileOrder}
          />
        </div>
        <div className="flex min-w-0 w-full flex-col">
          <CategoryFilters
            activeFilter={categoryFilter}
            summary={summary}
            onChange={setCategoryFilter}
          />

          <div className="flex min-w-0 flex-col gap-2 border-t border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between md:px-4">
            <div className="flex shrink-0 items-center gap-3 font-mono text-[11px]">
              <span className="text-muted">
                {categoryFilter === 'all'
                  ? `${summary.files} ${summary.files === 1 ? 'file' : 'files'}`
                  : `Showing ${visibleFiles.length} of ${summary.files}`}
              </span>
              {expiresAt ? (
                <ExpiryCountdown expiresAt={expiresAt} />
              ) : (
                <span className="text-accent-text">
                  Private GitHub view · not shared
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end md:flex-nowrap md:gap-3">
              <Button
                className="md:hidden"
                variant="secondary"
                size="sm"
                aria-label={
                  filePickerOpen ? 'Close file picker' : 'Open file picker'
                }
                aria-controls="diff-file-picker"
                aria-expanded={filePickerOpen}
                onClick={() => setFilePickerOpen((current) => !current)}
              >
                <span aria-hidden="true">☷</span>
                <span className="max-[390px]:sr-only">Files</span>
              </Button>
              <FileOrderControl
                className="md:hidden"
                order={fileOrder}
                onChange={setFileOrder}
              />
              <SegmentedControl aria-label="Diff layout">
                <SegmentedControlItem
                  active={diffStyle === 'unified'}
                  onClick={() => setDiffStyle('unified')}
                >
                  Unified
                </SegmentedControlItem>
                <SegmentedControlItem
                  active={diffStyle === 'split'}
                  onClick={() => setDiffStyle('split')}
                >
                  Split
                </SegmentedControlItem>
              </SegmentedControl>
              <Toggle
                pressed={wrapLines}
                onClick={() => setWrapLines((current) => !current)}
              >
                Wrap lines
              </Toggle>
            </div>
          </div>
        </div>
      </Toolbar>

      {parsed.error ? (
        <ErrorHero
          className="justify-self-center [grid-area:workspace]"
          eyebrow="Render error"
          title="This patch needs a second look."
          description={parsed.error}
          actionLabel="Try another diff"
        />
      ) : (
        <div className="relative grid min-h-0 grid-cols-1 [grid-area:workspace] [grid-template-areas:'viewer'] md:grid-cols-[240px_minmax(0,1fr)] md:[grid-template-areas:'tree_viewer']">
          {filePickerOpen ? (
            <button
              className="absolute inset-0 z-10 block cursor-default bg-black/50 md:hidden"
              type="button"
              aria-label="Close file picker"
              onClick={() => setFilePickerOpen(false)}
            />
          ) : null}
          <aside
            className={cn(
              'invisible absolute inset-y-0 left-0 z-20 flex w-[min(280px,calc(100%-44px))] -translate-x-full flex-col border-r border-line bg-canvas shadow-[18px_0_45px_light-dark(rgb(0_0_0/14%),rgb(0_0_0/42%))] transition-[transform,visibility] duration-150 [grid-area:tree]',
              'md:visible md:static md:z-auto md:w-auto md:translate-x-0 md:shadow-none',
              filePickerOpen && 'visible translate-x-0',
            )}
            id="diff-file-picker"
            aria-label="Changed files"
          >
            <PanelHeader>
              <span>Files</span>
              <span className="text-muted tabular-nums">
                {filePickerEntries.length}
              </span>
              <IconButton
                className="ml-auto md:hidden"
                label="Close file picker"
                variant="ghost"
                size="xs"
                onClick={() => setFilePickerOpen(false)}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  ×
                </span>
              </IconButton>
            </PanelHeader>
            <DiffFilePicker
              key={`${viewerId}:${categoryFilter}:${fileOrder}`}
              entries={filePickerEntries}
              onSelect={scrollToFile}
            />
          </aside>
          <WorkerPoolContextProvider
            poolOptions={workerPoolOptions}
            highlighterOptions={highlighterOptions}
          >
            <CodeView
              ref={codeViewRef}
              className="diff-scroll min-h-0 min-w-0 overflow-auto [grid-area:viewer]"
              items={items}
              options={options}
              renderHeaderPrefix={renderHeaderPrefix}
            />
          </WorkerPoolContextProvider>
        </div>
      )}
    </main>
  )
}

function CategoryFilters({
  activeFilter,
  summary,
  onChange,
}: {
  activeFilter: DiffCategoryFilter
  summary: DiffSummary
  onChange: (filter: DiffCategoryFilter) => void
}) {
  const filters: readonly DiffCategoryFilter[] = ['all', ...DIFF_CATEGORIES]

  return (
    <fieldset
      className="category-filter-scroll flex w-full min-w-0 max-w-full items-center gap-1 overflow-x-auto px-3 py-2 md:px-4"
      aria-label="Filter files by category"
    >
      {filters.map((filter) => {
        const details =
          filter === 'all' ? { label: 'All' } : DIFF_CATEGORY_DETAILS[filter]
        const filterSummary =
          filter === 'all' ? summary : summary.categories[filter]
        const active = activeFilter === filter

        return (
          <button
            key={filter}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-2 rounded-control border border-transparent px-2.5 font-mono text-[10px] text-muted transition-colors',
              'hover:border-line hover:bg-surface hover:text-muted-bright',
              'disabled:pointer-events-none disabled:opacity-55',
              active &&
                'border-line-bright bg-surface-raised text-foreground shadow-sm',
            )}
            type="button"
            aria-pressed={active}
            disabled={filterSummary.files === 0}
            data-testid={`category-filter-${filter}`}
            onClick={() => onChange(filter)}
          >
            <span className="font-semibold">{details.label}</span>
            <CategorySummary summary={filterSummary} />
          </button>
        )
      })}
    </fieldset>
  )
}

function CategorySummary({ summary }: { summary: DiffLineSummary }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 tabular-nums"
      aria-label={`${summary.files} ${summary.files === 1 ? 'file' : 'files'}, ${summary.additions} additions, ${summary.deletions} deletions`}
    >
      <span>{summary.files}</span>
      {summary.files > 0 && (
        <>
          <span className="text-addition">+{summary.additions}</span>
          <span className="text-deletion">−{summary.deletions}</span>
        </>
      )}
    </span>
  )
}

function FileOrderControl({
  className,
  order,
  onChange,
}: {
  className?: string
  order: DiffFileOrder
  onChange: (order: DiffFileOrder) => void
}) {
  return (
    <SegmentedControl className={className} aria-label="File order">
      <SegmentedControlItem
        active={order === 'patch'}
        onClick={() => onChange('patch')}
      >
        Patch
      </SegmentedControlItem>
      <SegmentedControlItem
        active={order === 'category'}
        onClick={() => onChange('category')}
      >
        Category
      </SegmentedControlItem>
    </SegmentedControl>
  )
}

function DiffCategoryBadge({ category }: { category: DiffCategory }) {
  return (
    <span
      className="inline-flex items-center rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-bright"
      data-diff-category={category}
    >
      {DIFF_CATEGORY_DETAILS[category].label}
    </span>
  )
}

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [absoluteExpiry, setAbsoluteExpiry] = useState<string>()
  const countdown = formatExpiryCountdown(expiresAt, nowMs)

  useEffect(() => {
    setAbsoluteExpiry(formatAbsoluteExpiry(expiresAt))
  }, [expiresAt])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined

    function scheduleNextUpdate() {
      const currentTime = Date.now()
      setNowMs(currentTime)

      const delay = getExpiryCountdownUpdateDelay(expiresAt, currentTime)
      if (delay !== null) {
        timeout = setTimeout(scheduleNextUpdate, delay)
      }
    }

    const delay = getExpiryCountdownUpdateDelay(expiresAt)
    if (delay !== null) {
      timeout = setTimeout(scheduleNextUpdate, delay)
    }

    return () => {
      if (timeout !== undefined) {
        clearTimeout(timeout)
      }
    }
  }, [expiresAt])

  return (
    <time
      className="cursor-help border-l border-line pl-3 text-muted underline decoration-line-bright decoration-dotted underline-offset-[3px]"
      dateTime={expiresAt}
      title={absoluteExpiry}
      aria-label={
        absoluteExpiry
          ? `${countdown}. Exact expiration: ${absoluteExpiry}`
          : countdown
      }
      suppressHydrationWarning
    >
      {countdown}
    </time>
  )
}
