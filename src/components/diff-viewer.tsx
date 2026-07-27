import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  FileDiff,
  Virtualizer,
  type FileDiffMetadata,
} from '@pierre/diffs/react'
import { parsePatchFiles } from '@pierre/diffs'

import type { StoredDiff } from '../lib/diffs'

type DiffStyle = 'unified' | 'split'

type DiffViewerProps = {
  slug: string
  storedDiff: StoredDiff
}

export default function DiffViewer({ slug, storedDiff }: DiffViewerProps) {
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('unified')
  const [wrapLines, setWrapLines] = useState(false)
  const [copied, setCopied] = useState(false)

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
  const options = useMemo(
    () => ({
      diffStyle,
      diffIndicators: 'bars' as const,
      hunkSeparators: 'line-info' as const,
      lineDiffType: 'word-alt' as const,
      overflow: wrapLines ? ('wrap' as const) : ('scroll' as const),
      theme: 'pierre-dark',
      themeType: 'dark' as const,
      stickyHeader: true,
    }),
    [diffStyle, wrapLines],
  )

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
          <span className="created-at">
            Shared {formatCreatedAt(storedDiff.createdAt)}
          </span>
        </div>

        <div className="view-controls">
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
        <Virtualizer
          className="diff-scroll"
          contentClassName="diff-content"
          config={{ overscrollSize: 640 }}
        >
          {parsed.files.map((file, index) => (
            <FileDiff
              key={`${file.cacheKey ?? file.name}-${index}`}
              className="diff-file"
              fileDiff={file}
              options={options}
              disableWorkerPool
            />
          ))}
        </Virtualizer>
      )}
    </main>
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

function formatCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(createdAt))
}
