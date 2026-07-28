import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
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

import DiffFilePicker from './diff-file-picker'
import type { StoredDiff } from '../lib/diffs'
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

const highlighterOptions: WorkerInitializationRenderOptions = {
  theme: 'pierre-dark',
  lineDiffType: 'word-alt',
}

export default function DiffViewer({ slug, storedDiff }: DiffViewerProps) {
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('unified')
  const [wrapLines, setWrapLines] = useState(false)
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
        lineHeight: 19,
      },
      layout: {
        paddingTop: 20,
        paddingBottom: 48,
        gap: 18,
      },
      overflow: wrapLines ? ('wrap' as const) : ('scroll' as const),
      theme: 'pierre-dark',
      themeType: 'dark' as const,
      stickyHeaders: true,
    }),
    [diffStyle, wrapLines],
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
    <main className="view-page">
      <header className="view-header">
        <Link className="wordmark" to="/">
          <span aria-hidden="true">/</span>
          diffdump
        </Link>

        <div className="view-header-actions">
          <Link className="button button--quiet" to="/">
            New diff
          </Link>
          <button
            className="button button--primary copy-button"
            type="button"
            onClick={copyShareLink}
          >
            <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </header>

      <section className="diff-toolbar" aria-label="Diff controls">
        <div className="diff-summary">
          <span className="file-count">
            {summary.files} {summary.files === 1 ? 'file' : 'files'}
          </span>
          <span className="addition-count">+{summary.additions}</span>
          <span className="deletion-count">−{summary.deletions}</span>
          <ExpiryCountdown expiresAt={storedDiff.expiresAt} />
        </div>

        <div className="view-controls">
          <button
            className="file-picker-toggle"
            type="button"
            aria-label={
              filePickerOpen ? 'Close file picker' : 'Open file picker'
            }
            aria-controls="diff-file-picker"
            aria-expanded={filePickerOpen}
            onClick={() => setFilePickerOpen((current) => !current)}
          >
            <span aria-hidden="true">☷</span>
            <span className="file-picker-toggle-label">Files</span>
          </button>
          <div className="segmented-control" aria-label="Diff layout">
            <button
              type="button"
              aria-pressed={diffStyle === 'unified'}
              onClick={() => setDiffStyle('unified')}
            >
              Unified
            </button>
            <button
              type="button"
              aria-pressed={diffStyle === 'split'}
              onClick={() => setDiffStyle('split')}
            >
              Split
            </button>
          </div>
          <button
            className="wrap-toggle"
            type="button"
            aria-pressed={wrapLines}
            onClick={() => setWrapLines((current) => !current)}
          >
            Wrap lines
            <span aria-hidden="true" className="toggle-track">
              <i />
            </span>
          </button>
        </div>
      </section>

      {parsed.error ? (
        <section className="render-error">
          <p className="eyebrow">Render error</p>
          <h1>This patch needs a second look.</h1>
          <p>{parsed.error}</p>
          <Link className="button button--primary" to="/">
            Try another diff
          </Link>
        </section>
      ) : (
        <div className="diff-workspace">
          {filePickerOpen ? (
            <button
              className="file-picker-backdrop"
              type="button"
              aria-label="Close file picker"
              onClick={() => setFilePickerOpen(false)}
            />
          ) : null}
          <aside
            className={`file-picker${filePickerOpen ? ' file-picker--open' : ''}`}
            id="diff-file-picker"
            aria-label="Changed files"
          >
            <div className="file-picker-header">
              <span>Files</span>
              <span className="file-picker-count">
                {filePickerEntries.length}
              </span>
              <button
                className="file-picker-close"
                type="button"
                aria-label="Close file picker"
                onClick={() => setFilePickerOpen(false)}
              >
                ×
              </button>
            </div>
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
              className="diff-scroll"
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
      className="created-at expiry-countdown"
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
