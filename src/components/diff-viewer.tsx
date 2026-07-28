import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CodeView,
  WorkerPoolContextProvider,
  type CodeViewHandle,
  type CodeViewDiffItem,
  type FileDiffMetadata,
  type WorkerInitializationRenderOptions,
  type WorkerPoolOptions,
} from '@pierre/diffs/react'
import { parsePatchFiles } from '@pierre/diffs'
import DiffWorkerUrl from '@pierre/diffs/worker/worker.js?worker&url'
import { Link } from '@tanstack/react-router'

import DiffFilePicker from './diff-file-picker'
import { Wordmark } from './wordmark'
import { Button, IconButton, buttonVariants } from './ui/button'
import { SegmentedControl, SegmentedControlItem } from './ui/segmented-control'
import { PanelHeader, Toolbar } from './ui/surfaces'
import { ThemeToggle } from './ui/theme-toggle'
import { Toggle } from './ui/toggle'
import { cn } from '../lib/cn'
import type { StoredDiff } from '../lib/diffs'
import { useResolvedTheme } from '../lib/theme'
import {
  formatAbsoluteExpiry,
  formatExpiryCountdown,
  getExpiryCountdownUpdateDelay,
} from '../lib/expiry'
import { createDiffFilePickerEntries } from '../lib/file-picker'

type DiffStyle = 'unified' | 'split'

type DiffViewerProps = {
  slug: string
  storedDiff: StoredDiff
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

export default function DiffViewer({ slug, storedDiff }: DiffViewerProps) {
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('unified')
  const [wrapLines, setWrapLines] = useState(false)
  const resolvedTheme = useResolvedTheme()
  const [copied, setCopied] = useState(false)
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const codeViewRef = useRef<CodeViewHandle<undefined>>(null)

  const parsed = useMemo(() => {
    try {
      const files = parsePatchFiles(storedDiff.diff, slug, true).flatMap(
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
  }, [slug, storedDiff.diff])

  const summary = useMemo(() => summarizeDiff(parsed.files), [parsed.files])
  const items = useMemo<CodeViewDiffItem[]>(
    () =>
      parsed.files.map((file, index) => ({
        id: getDiffItemId(file, index),
        type: 'diff',
        fileDiff: file,
      })),
    [parsed.files],
  )
  const filePickerEntries = useMemo(
    () =>
      createDiffFilePickerEntries(
        parsed.files.map((file, index) => ({
          itemId: getDiffItemId(file, index),
          name: file.name,
          type: file.type,
        })),
      ),
    [parsed.files],
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
    <main className="grid h-svh grid-rows-[56px_auto_minmax(0,1fr)] overflow-hidden bg-canvas text-foreground [grid-template-areas:'header''toolbar''workspace']">
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
            New diff
          </Link>
          <Button
            className="min-w-24"
            variant="primary"
            size="sm"
            onClick={copyShareLink}
          >
            <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </header>

      <Toolbar
        className="items-stretch gap-0 p-0 [grid-area:toolbar] md:grid md:min-h-12 md:grid-cols-[240px_minmax(0,1fr)]"
        aria-label="Diff controls"
      >
        <div
          className="hidden border-r border-line md:block"
          aria-hidden="true"
        />
        <div className="flex w-full flex-col items-stretch gap-2 px-3 py-2 md:flex-row md:items-center md:justify-between md:overflow-y-auto md:px-4 md:py-0 md:[scrollbar-gutter:stable]">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-muted">
              {summary.files} {summary.files === 1 ? 'file' : 'files'}
            </span>
            <span className="text-addition">+{summary.additions}</span>
            <span className="text-deletion">−{summary.deletions}</span>
            <ExpiryCountdown expiresAt={storedDiff.expiresAt} />
          </div>

          <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end md:gap-3">
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
      </Toolbar>

      {parsed.error ? (
        <section className="flex w-[min(580px,calc(100%-40px))] flex-col items-start justify-center justify-self-center [grid-area:workspace]">
          <p className="mb-5 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-bright">
            Render error
          </p>
          <h1 className="mb-3.5 text-[clamp(38px,7vw,62px)] leading-[1.02] tracking-[-0.035em]">
            This patch needs a second look.
          </h1>
          <p className="mb-7 leading-relaxed text-muted-bright">
            {parsed.error}
          </p>
          <Link
            className={buttonVariants({ variant: 'primary', size: 'sm' })}
            to="/"
          >
            Try another diff
          </Link>
        </section>
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
              key={slug}
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
            />
          </WorkerPoolContextProvider>
        </div>
      )}
    </main>
  )
}

function getDiffItemId(file: FileDiffMetadata, index: number): string {
  return `${file.cacheKey ?? file.name}-${index}`
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

function summarizeDiff(files: FileDiffMetadata[]) {
  return files.reduce(
    (summary, file) => {
      summary.files += 1

      for (const hunk of file.hunks) {
        summary.additions += hunk.additionLines
        summary.deletions += hunk.deletionLines
      }

      return summary
    },
    {
      files: 0,
      additions: 0,
      deletions: 0,
    },
  )
}
