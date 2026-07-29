import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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
import {
  parsePatchFiles,
  type CodeViewLineSelection,
  type CodeViewOptions,
  type DiffLineAnnotation,
  type LineAnnotation,
  type SelectedLineRange,
} from '@pierre/diffs'
import DiffWorkerUrl from '@pierre/diffs/worker/worker.js?worker&url'
import { Link } from '@tanstack/react-router'

import DiffFilePicker from './diff-file-picker'
import DiffFindBar from './diff-find-bar'
import {
  DraftReviewAnnotation,
  DraftReviewComposer,
} from './draft-review-annotation'
import { ErrorHero } from './error-hero'
import { GitHubReviewAnnotation } from './github-review-annotation'
import ReviewCommentsPanel from './review-comments-panel'
import SubmitReviewPanel from './submit-review-panel'
import { Wordmark } from './wordmark'
import { Button, IconButton, buttonVariants } from './ui/button'
import { SegmentedControl, SegmentedControlItem } from './ui/segmented-control'
import { PanelHeader, Toolbar } from './ui/surfaces'
import { ThemeToggle } from './ui/theme-toggle'
import { Toggle } from './ui/toggle'
import { cn } from '../lib/cn'
import { diffThemes } from '../lib/diff-themes'
import {
  readStoredGitHubToken,
  type GitHubPullReviewTarget,
} from '../lib/github-diffs'
import { publishReview } from '../lib/github-reviews'
import {
  createDraftStorageKey,
  readStoredDrafts,
  resolveCommentPath,
  writeStoredDrafts,
  type DraftReviewComment,
  type GitHubReviewEvent,
  type ReviewCommentMetadata,
  type ReviewCommentThread,
} from '../lib/review-comments'
import {
  anchorReviewThreads,
  buildReviewAnnotations,
  createComposerDraft,
  removeDraft,
  upsertDraft,
  type ReviewCommentsState,
  type SubmitReviewState,
} from '../lib/review-state'
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
import {
  readStoredViewedFileIds,
  writeStoredViewedFileIds,
} from '../lib/viewed-files'

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
      reviewTarget: GitHubPullReviewTarget | null
      reviewComments: ReviewCommentsState
      onReloadComments: () => void
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
  theme: diffThemes,
  lineDiffType: 'word-alt',
}

/* With classic (non-overlay) scrollbars, Chrome reserves the native scrollbar
   width at the inline-end of the diff's [data-code] element because of its
   `scrollbar-gutter: stable`, even though the element clips overflow-y and
   hides its vertical scrollbar — leaving the hunk separator bar (100cqi wide)
   stopping short of the card edge with the separator row's background peeking
   through. The rule lives in the library's shadow DOM, but every
   diffs-container shares one adopted stylesheet, so patching it once fixes
   all current and future cards. */
const patchedDiffSheets = new WeakSet<CSSStyleSheet>()

function patchDiffScrollbarGutter(root: HTMLElement): boolean {
  const container = root.querySelector('diffs-container')
  const sheet = container?.shadowRoot?.adoptedStyleSheets[0]

  if (!sheet) {
    return false
  }

  if (!patchedDiffSheets.has(sheet)) {
    sheet.insertRule(
      '[data-code] { scrollbar-gutter: auto; }',
      sheet.cssRules.length,
    )
    patchedDiffSheets.add(sheet)
  }

  return true
}

export default function DiffViewer(props: DiffViewerProps) {
  const isGitHubDiff = props.mode === 'github'
  const viewerId = isGitHubDiff ? props.githubUrl : props.slug
  const reviewId = `${isGitHubDiff ? 'github' : 'shared'}:${viewerId}`
  const diff = isGitHubDiff ? props.diff : props.storedDiff.diff
  const expiresAt = isGitHubDiff ? null : props.storedDiff.expiresAt
  const reviewTarget = isGitHubDiff ? props.reviewTarget : null
  const reviewComments = isGitHubDiff
    ? props.reviewComments
    : IDLE_REVIEW_COMMENTS
  const onReloadComments = isGitHubDiff ? props.onReloadComments : undefined
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('unified')
  const [wrapLines, setWrapLines] = useState(false)
  const [categoryFilter, setCategoryFilter] =
    useState<DiffCategoryFilter>('all')
  const [fileOrder, setFileOrder] = useState<DiffFileOrder>('patch')
  const resolvedTheme = useResolvedTheme()
  const [copied, setCopied] = useState(false)
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [findBarOpen, setFindBarOpen] = useState(false)
  const codeViewRef = useRef<CodeViewHandle<ReviewCommentMetadata>>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [viewedState, setViewedState] = useState(() => ({
    reviewId,
    fileIds: new Set(readStoredViewedFileIds(reviewId)),
  }))
  const viewedFileIds =
    viewedState.reviewId === reviewId ? viewedState.fileIds : EMPTY_FILE_ID_SET
  /* Viewed files render collapsed; search navigation expands a match's file
     without unticking its Viewed checkbox. */
  const [expandedOverrides, setExpandedOverrides] =
    useState<ReadonlySet<string>>(EMPTY_FILE_ID_SET)
  /* Unsent drafts are keyed by owner/repo/pull/headSha so they never restore
     onto a different revision of the pull request. */
  const reviewKey = reviewTarget ? createDraftStorageKey(reviewTarget) : null
  const [draftsState, setDraftsState] = useState(() => ({
    reviewKey,
    drafts: reviewTarget ? readStoredDrafts(reviewTarget) : EMPTY_DRAFTS,
  }))
  const drafts =
    draftsState.reviewKey === reviewKey ? draftsState.drafts : EMPTY_DRAFTS
  const [composer, setComposer] = useState<DraftReviewComment | null>(null)
  const [selectedLines, setSelectedLines] =
    useState<CodeViewLineSelection | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'files' | 'comments'>('files')
  const [submitPanelOpen, setSubmitPanelOpen] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitReviewState>({
    phase: 'idle',
  })
  /* A pending review GitHub created before a failed submit; retried
     submissions resume it instead of creating duplicates. */
  const pendingReviewIdRef = useRef<number | null>(null)

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
  const viewedFileCount = useMemo(
    () =>
      classifiedFiles.reduce(
        (count, file) => count + (viewedFileIds.has(file.storageId) ? 1 : 0),
        0,
      ),
    [classifiedFiles, viewedFileIds],
  )
  const reviewEnabled = reviewTarget !== null && parsed.error === null
  const itemIdByPath = useMemo(
    () =>
      new Map(
        classifiedFiles.map(({ id, file }) => [resolveCommentPath(file), id]),
      ),
    [classifiedFiles],
  )
  const reviewThreads = useMemo(
    () =>
      reviewComments.status === 'loaded'
        ? anchorReviewThreads(reviewComments.comments, parsed.files)
        : EMPTY_THREADS,
    [reviewComments, parsed.files],
  )
  const threadByRootId = useMemo(
    () => new Map(reviewThreads.map((thread) => [thread.root.id, thread])),
    [reviewThreads],
  )
  const currentThreads = useMemo(
    () => reviewThreads.filter((thread) => !thread.root.outdated),
    [reviewThreads],
  )
  const reviewAnnotations = useMemo(
    () =>
      reviewEnabled
        ? buildReviewAnnotations({
            drafts,
            composer,
            threads: currentThreads,
            itemIdByPath,
          })
        : EMPTY_ANNOTATION_MAP,
    [composer, currentThreads, drafts, itemIdByPath, reviewEnabled],
  )
  /* Controlled CodeView items only re-render when `version` changes, so each
     item's version carries an annotation epoch next to the collapsed bit. The
     epoch advances whenever the item's annotation set — anchors or metadata
     identities — changes; the ref cache is only mutated on such changes, so
     repeated renders with the same inputs stay idempotent. */
  const annotationVersionsRef = useRef({
    metadataIds: new WeakMap<ReviewCommentMetadata, number>(),
    nextMetadataId: 1,
    epochs: new Map<string, { signature: string; epoch: number }>(),
  })
  const items = useMemo<CodeViewDiffItem<ReviewCommentMetadata>[]>(
    () =>
      visibleFiles.map(({ id, storageId, file }) => {
        const collapsed =
          viewedFileIds.has(storageId) && !expandedOverrides.has(storageId)
        const annotations = reviewAnnotations.get(id)
        const tracker = annotationVersionsRef.current
        const signature = (annotations ?? EMPTY_ANNOTATION_LIST)
          .map((annotation) => {
            let metadataId = tracker.metadataIds.get(annotation.metadata)
            if (metadataId === undefined) {
              metadataId = tracker.nextMetadataId++
              tracker.metadataIds.set(annotation.metadata, metadataId)
            }
            return `${annotation.side}:${annotation.lineNumber}:${metadataId}`
          })
          .join('|')
        let versions = tracker.epochs.get(id)
        if (versions === undefined || versions.signature !== signature) {
          versions = { signature, epoch: (versions?.epoch ?? -1) + 1 }
          tracker.epochs.set(id, versions)
        }

        return {
          id,
          type: 'diff',
          fileDiff: file,
          collapsed,
          annotations,
          version: versions.epoch * 2 + (collapsed ? 1 : 0),
        }
      }),
    [expandedOverrides, reviewAnnotations, viewedFileIds, visibleFiles],
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
          viewed: viewedFileIds.has(file.storageId),
        })),
      ),
    [viewedFileIds, visibleFiles],
  )
  const renderHeaderPrefix = useCallback(
    (item: CodeViewItem<ReviewCommentMetadata>) => {
      const file = filesById.get(item.id)

      return file ? <DiffCategoryBadge category={file.category} /> : null
    },
    [filesById],
  )
  const setFileViewed = useCallback(
    (storageId: string, viewed: boolean) => {
      setViewedState((current) => {
        const nextFileIds = new Set(
          current.reviewId === reviewId
            ? current.fileIds
            : readStoredViewedFileIds(reviewId),
        )

        if (viewed) {
          nextFileIds.add(storageId)
        } else {
          nextFileIds.delete(storageId)
        }

        return { reviewId, fileIds: nextFileIds }
      })
      /* Manually toggling Viewed retires any search expansion so the
         checkbox collapses and expands the card again. */
      setExpandedOverrides((current) => {
        if (!current.has(storageId)) {
          return current
        }

        const next = new Set(current)
        next.delete(storageId)
        return next
      })
    },
    [reviewId],
  )
  const revealFileForSearch = useCallback(
    (storageId: string) => {
      if (!viewedFileIds.has(storageId)) {
        return
      }

      setExpandedOverrides((current) => {
        if (current.has(storageId)) {
          return current
        }

        const next = new Set(current)
        next.add(storageId)
        return next
      })
    },
    [viewedFileIds],
  )
  const renderHeaderMetadata = useCallback(
    (item: CodeViewItem<ReviewCommentMetadata>) => {
      const file = filesById.get(item.id)

      if (!file) {
        return null
      }

      const viewed = viewedFileIds.has(file.storageId)
      return (
        <ViewedFileControl
          viewed={viewed}
          onChange={(nextViewed) => setFileViewed(file.storageId, nextViewed)}
        />
      )
    },
    [filesById, setFileViewed, viewedFileIds],
  )
  const updateDrafts = useCallback(
    (
      update: (drafts: readonly DraftReviewComment[]) => DraftReviewComment[],
    ) => {
      setDraftsState((current) => ({
        reviewKey,
        drafts: update(
          current.reviewKey === reviewKey
            ? current.drafts
            : reviewTarget
              ? readStoredDrafts(reviewTarget)
              : EMPTY_DRAFTS,
        ),
      }))
    },
    [reviewKey, reviewTarget],
  )
  /* Expands a viewed (collapsed) file if needed, then scrolls the annotated
     range into view. */
  const revealReviewRange = useCallback(
    (itemId: string, range: SelectedLineRange) => {
      const file = filesById.get(itemId)
      if (file) {
        revealFileForSearch(file.storageId)
      }

      codeViewRef.current?.scrollTo({
        type: 'range',
        id: itemId,
        range,
        align: 'center',
        behavior: 'smooth-auto',
      })
      setFilePickerOpen(false)
    },
    [filesById, revealFileForSearch],
  )
  const openComposer = useCallback(
    (range: SelectedLineRange, itemId: string, fileDiff: FileDiffMetadata) => {
      if (!reviewTarget) {
        return
      }

      setComposer(
        createComposerDraft({
          itemId,
          path: resolveCommentPath(fileDiff),
          range,
          headSha: reviewTarget.headSha,
        }),
      )
    },
    [reviewTarget],
  )
  const closeComposer = useCallback(() => {
    setComposer(null)
    setSelectedLines(null)
  }, [])
  const saveComposer = useCallback(
    (body: string) => {
      if (!composer) {
        return
      }

      updateDrafts((current) => upsertDraft(current, { ...composer, body }))
      setComposer(null)
      setSelectedLines(null)
    },
    [composer, updateDrafts],
  )
  const editDraft = useCallback((draft: DraftReviewComment) => {
    setComposer(draft)
  }, [])
  const editDraftFromPanel = useCallback(
    (draft: DraftReviewComment) => {
      setComposer(draft)
      revealReviewRange(draft.itemId, draft.range)
    },
    [revealReviewRange],
  )
  const deleteDraft = useCallback(
    (localId: string) => {
      updateDrafts((current) => removeDraft(current, localId))
      setComposer((current) => (current?.localId === localId ? null : current))
    },
    [updateDrafts],
  )
  const selectDraftInPanel = useCallback(
    (draft: DraftReviewComment) => revealReviewRange(draft.itemId, draft.range),
    [revealReviewRange],
  )
  const selectThreadInPanel = useCallback(
    (thread: ReviewCommentThread) => {
      const itemId = itemIdByPath.get(thread.root.path)
      if (itemId !== undefined && thread.root.range !== null) {
        revealReviewRange(itemId, thread.root.range)
      }
    },
    [itemIdByPath, revealReviewRange],
  )
  const submitReview = useCallback(
    async (event: GitHubReviewEvent, body: string) => {
      if (!reviewTarget) {
        return
      }

      setSubmitState({ phase: 'submitting' })
      try {
        const reviewId = await publishReview(
          { event, body, comments: [...drafts], target: reviewTarget },
          {
            token: readStoredGitHubToken(),
            pendingReviewId: pendingReviewIdRef.current,
            onPendingReviewCreated: (id) => {
              pendingReviewIdRef.current = id
            },
          },
        )

        pendingReviewIdRef.current = null
        updateDrafts(() => [])
        setComposer(null)
        setSelectedLines(null)
        setSubmitState({ phase: 'success', reviewId })
        onReloadComments?.()
      } catch (error) {
        setSubmitState({
          phase: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The review could not be published.',
        })
      }
    },
    [drafts, onReloadComments, reviewTarget, updateDrafts],
  )
  const renderReviewAnnotation = useCallback(
    (
      annotation:
        | LineAnnotation<ReviewCommentMetadata>
        | DiffLineAnnotation<ReviewCommentMetadata>,
    ) => {
      const metadata = annotation.metadata

      if (metadata.kind === 'github') {
        const thread = threadByRootId.get(metadata.id)
        return thread ? <GitHubReviewAnnotation thread={thread} /> : null
      }

      if (composer !== null && metadata.localId === composer.localId) {
        return (
          <DraftReviewComposer
            draft={composer}
            onSave={saveComposer}
            onCancel={closeComposer}
          />
        )
      }

      return (
        <DraftReviewAnnotation
          draft={metadata}
          onEdit={editDraft}
          onDelete={deleteDraft}
        />
      )
    },
    [
      closeComposer,
      composer,
      deleteDraft,
      editDraft,
      saveComposer,
      threadByRootId,
    ],
  )
  const options = useMemo<CodeViewOptions<ReviewCommentMetadata>>(
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
      enableLineSelection: reviewEnabled,
      enableGutterUtility: reviewEnabled,
      onGutterUtilityClick: reviewEnabled
        ? (range: SelectedLineRange, context) => {
            if (context.item.type === 'diff') {
              openComposer(range, context.item.id, context.item.fileDiff)
            }
          }
        : undefined,
    }),
    [diffStyle, openComposer, resolvedTheme, reviewEnabled, wrapLines],
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
    setViewedState({
      reviewId,
      fileIds: new Set(readStoredViewedFileIds(reviewId)),
    })
    setExpandedOverrides(EMPTY_FILE_ID_SET)
  }, [reviewId])

  useEffect(() => {
    if (viewedState.reviewId === reviewId) {
      writeStoredViewedFileIds(reviewId, viewedState.fileIds)
    }
  }, [reviewId, viewedState])

  useEffect(() => {
    setDraftsState({
      reviewKey,
      drafts: reviewTarget ? readStoredDrafts(reviewTarget) : EMPTY_DRAFTS,
    })
    setComposer(null)
    setSelectedLines(null)
    setSubmitState({ phase: 'idle' })
    setSubmitPanelOpen(false)
    setSidebarTab('files')
    pendingReviewIdRef.current = null
  }, [reviewKey, reviewTarget])

  useEffect(() => {
    if (reviewTarget && draftsState.reviewKey === reviewKey) {
      writeStoredDrafts(reviewTarget, draftsState.drafts)
    }
  }, [draftsState, reviewKey, reviewTarget])

  useEffect(() => {
    if (parsed.error) {
      return
    }

    /* Publish the scroll area's scrollbar width so the card rail can absorb
       it: the cards' right margin shrinks by the measured width (see
       .diff-scroll > div in styles.css), keeping the card edge on the same
       fixed inset as the header and toolbar above. Overlay scrollbars
       measure 0 and change nothing. */
    const main = mainRef.current
    const scroller = main?.querySelector('.diff-scroll')

    if (!main || !(scroller instanceof HTMLElement)) {
      return
    }

    const updateScrollbarWidth = () => {
      main.style.setProperty(
        '--diff-scrollbar-width',
        `${scroller.offsetWidth - scroller.clientWidth}px`,
      )
    }

    updateScrollbarWidth()
    const observer = new ResizeObserver(updateScrollbarWidth)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [parsed.error])

  useEffect(() => {
    const main = mainRef.current

    if (parsed.error || !main || patchDiffScrollbarGutter(main)) {
      return
    }

    const interval = window.setInterval(() => {
      if (patchDiffScrollbarGutter(main)) {
        window.clearInterval(interval)
      }
    }, 150)
    return () => window.clearInterval(interval)
  }, [parsed.error])

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
    <main
      ref={mainRef}
      className="grid h-svh w-full min-w-0 grid-rows-[56px_auto_minmax(0,1fr)] overflow-hidden bg-canvas text-foreground [grid-template-areas:'header''toolbar''workspace']"
    >
      <header className="flex items-center justify-between border-b border-line bg-canvas/95 px-3 [grid-area:header] md:px-4">
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
        className="min-w-0 max-w-full flex-col items-stretch gap-0 overflow-hidden p-0 [grid-area:toolbar]"
        aria-label="Diff controls"
      >
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
            <span
              className="border-l border-line pl-3 text-muted"
              aria-label={`${viewedFileCount} of ${summary.files} files viewed`}
            >
              {viewedFileCount} viewed
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
            <IconButton
              label="Find in diff"
              title={`Find in diff (${FIND_SHORTCUT_HINT})`}
              variant="secondary"
              aria-controls="diff-find-bar"
              aria-expanded={findBarOpen}
              disabled={parsed.error !== null}
              onClick={() => setFindBarOpen((current) => !current)}
            >
              <svg
                className="size-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.4 10.4 3.4 3.4" />
              </svg>
            </IconButton>
            {reviewEnabled && (
              <Button
                variant="primary"
                size="sm"
                aria-expanded={submitPanelOpen}
                aria-controls="submit-review-panel"
                onClick={() => {
                  if (submitPanelOpen && submitState.phase === 'success') {
                    setSubmitState({ phase: 'idle' })
                  }
                  setSubmitPanelOpen(!submitPanelOpen)
                }}
              >
                Review
                {drafts.length > 0 && (
                  <span className="tabular-nums">({drafts.length})</span>
                )}
              </Button>
            )}
            <FileOrderControl order={fileOrder} onChange={setFileOrder} />
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
          {reviewEnabled && submitPanelOpen && (
            <div
              className="absolute right-3 top-2 z-30 md:right-4"
              id="submit-review-panel"
            >
              <SubmitReviewPanel
                draftCount={drafts.length}
                submitState={submitState}
                reviewUrl={
                  submitState.phase === 'success' && reviewTarget
                    ? `https://github.com/${reviewTarget.owner}/${reviewTarget.repo}/pull/${reviewTarget.pullNumber}#pullrequestreview-${submitState.reviewId}`
                    : null
                }
                onSubmit={submitReview}
                onClose={() => {
                  setSubmitPanelOpen(false)
                  if (submitState.phase === 'success') {
                    setSubmitState({ phase: 'idle' })
                  }
                }}
              />
            </div>
          )}
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
              {reviewEnabled ? (
                <div
                  className="flex items-center gap-1"
                  role="tablist"
                  aria-label="Sidebar sections"
                >
                  <SidebarTab
                    active={sidebarTab === 'files'}
                    onClick={() => setSidebarTab('files')}
                  >
                    Files
                  </SidebarTab>
                  <SidebarTab
                    active={sidebarTab === 'comments'}
                    onClick={() => setSidebarTab('comments')}
                  >
                    Comments
                    <span className="text-muted tabular-nums">
                      {reviewThreads.length + drafts.length}
                    </span>
                  </SidebarTab>
                </div>
              ) : (
                <span>Files</span>
              )}
              {(!reviewEnabled || sidebarTab === 'files') && (
                <span
                  className="text-muted tabular-nums"
                  aria-label={`${viewedFileCount} of ${summary.files} files viewed`}
                >
                  {viewedFileCount}/{summary.files} viewed
                </span>
              )}
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
            {reviewEnabled && sidebarTab === 'comments' ? (
              <ReviewCommentsPanel
                drafts={drafts}
                threads={reviewThreads}
                commentsState={reviewComments}
                onSelectDraft={selectDraftInPanel}
                onEditDraft={editDraftFromPanel}
                onDeleteDraft={deleteDraft}
                onSelectThread={selectThreadInPanel}
                onReloadComments={onReloadComments ?? NOOP}
              />
            ) : (
              <DiffFilePicker
                key={`${viewerId}:${categoryFilter}:${fileOrder}:${viewedFileCount}`}
                entries={filePickerEntries}
                onSelect={scrollToFile}
              />
            )}
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
              selectedLines={selectedLines}
              onSelectedLinesChange={setSelectedLines}
              renderHeaderPrefix={renderHeaderPrefix}
              renderHeaderMetadata={renderHeaderMetadata}
              renderAnnotation={
                reviewEnabled ? renderReviewAnnotation : undefined
              }
            />
          </WorkerPoolContextProvider>
          <DiffFindBar
            open={findBarOpen}
            onOpenChange={setFindBarOpen}
            visibleFiles={visibleFiles}
            codeViewRef={codeViewRef}
            onSelectLines={setSelectedLines}
            onRevealFile={revealFileForSearch}
          />
        </div>
      )}
    </main>
  )
}

const EMPTY_FILE_ID_SET: ReadonlySet<string> = new Set()
const EMPTY_DRAFTS: DraftReviewComment[] = []
const EMPTY_THREADS: ReviewCommentThread[] = []
const EMPTY_ANNOTATION_LIST: DiffLineAnnotation<ReviewCommentMetadata>[] = []
const EMPTY_ANNOTATION_MAP: ReadonlyMap<
  string,
  DiffLineAnnotation<ReviewCommentMetadata>[]
> = new Map()
const IDLE_REVIEW_COMMENTS: ReviewCommentsState = { status: 'idle' }
const NOOP = () => {}

const FIND_SHORTCUT_HINT = /Mac|iP/.test(globalThis.navigator?.platform ?? '')
  ? '⌘F'
  : 'Ctrl+F'

function SidebarTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-control border border-transparent px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:text-foreground',
        active && 'border-line bg-surface-raised text-foreground',
      )}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ViewedFileControl({
  viewed,
  onChange,
}: {
  viewed: boolean
  onChange: (viewed: boolean) => void
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-medium text-muted hover:text-foreground">
      <input
        className="size-3.5 cursor-pointer rounded-sm"
        type="checkbox"
        checked={viewed}
        style={{ accentColor: 'var(--accent-text)' }}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>Viewed</span>
    </label>
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
  order,
  onChange,
}: {
  order: DiffFileOrder
  onChange: (order: DiffFileOrder) => void
}) {
  return (
    <SegmentedControl aria-label="File order" title="File order">
      <SegmentedControlItem
        active={order === 'patch'}
        title="Order files as they appear in the patch"
        onClick={() => onChange('patch')}
      >
        Patch
      </SegmentedControlItem>
      <SegmentedControlItem
        active={order === 'category'}
        title="Group files by category: source, tests, docs, other"
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
