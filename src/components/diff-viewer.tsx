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
  type ComposerBodyStore,
  type DraftReviewComposerHandle,
} from './draft-review-annotation'
import { ErrorHero } from './error-hero'
import { GitHubRepoLink } from './github-repo-link'
import { GitHubReviewAnnotation } from './github-review-annotation'
import {
  GitHubStackSelector,
  type GitHubPullStackLoadState,
} from './github-stack-selector'
import ReviewCommentsPanel from './review-comments-panel'
import SubmitReviewPanel from './submit-review-panel'
import { Wordmark } from './wordmark'
import { Button, IconButton, buttonVariants } from './ui/button'
import { eyebrowClassName, PanelHeader, Toolbar } from './ui/surfaces'
import { ThemeToggle } from './ui/theme-toggle'
import { Toggle } from './ui/toggle'
import { cn } from '../lib/cn'
import { diffThemes } from '../lib/diff-themes'
import {
  parseGitHubDiffUrl,
  readStoredGitHubToken,
  type GitHubPullReviewTarget,
  type GitHubPullStackSummary,
} from '../lib/github-diffs'
import {
  createGitHubBaseFileContentsLoader,
  createGitHubFileContentsLoader,
} from '../lib/github-file-contents'
import { publishReview } from '../lib/github-reviews'
import {
  classifyDiffLine,
  createContextLineMap,
  createDraftStorageKey,
  isPatchAnchoredRange,
  readStoredDrafts,
  readStoredPendingReview,
  remapContextSelection,
  resolveCommentPath,
  writeStoredDrafts,
  writeStoredPendingReview,
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
  toSubmitErrorState,
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

/** Hydration progress for one file, keyed by item id: present while the
 * full contents download after an expander click, kept as an error note
 * when the download fails, and removed once the context renders. */
type FileExpansionState =
  { phase: 'loading' } | { phase: 'error'; message: string }

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
      stackSummary: GitHubPullStackSummary | null
      stackState: GitHubPullStackLoadState
      reviewComments: ReviewCommentsState
      onReloadComments: () => void
      onReloadDiff: () => void
      onReloadStack: () => void
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
  const sharedSource = isGitHubDiff ? null : props.storedDiff.source
  const reviewTarget = isGitHubDiff ? props.reviewTarget : null
  const reviewComments = isGitHubDiff
    ? props.reviewComments
    : IDLE_REVIEW_COMMENTS
  const onReloadComments = isGitHubDiff ? props.onReloadComments : undefined
  const onReloadDiff = isGitHubDiff ? props.onReloadDiff : undefined
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
  const composerRef = useRef<DraftReviewComposerHandle>(null)
  /* The composer unmounts (taking its React state with it) whenever its
     diff item leaves the virtualization window; the text it has typed so
     far lives here so scrolling away and back does not lose it. Cleared on
     every composer open/close/switch. */
  const composerBodyRef = useRef<ComposerBodyStore | null>(null)
  const [selectedLines, setSelectedLines] =
    useState<CodeViewLineSelection | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'files' | 'comments'>('files')
  const [submitPanelOpen, setSubmitPanelOpen] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitReviewState>({
    phase: 'idle',
  })
  const [expansionStates, setExpansionStates] = useState<
    ReadonlyMap<string, FileExpansionState>
  >(EMPTY_EXPANSION_STATES)

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

      const expansion = expansionStates.get(item.id)
      const viewed = viewedFileIds.has(file.storageId)
      return (
        <span className="inline-flex items-center gap-3">
          {expansion && <FileExpansionStatus state={expansion} />}
          <ViewedFileControl
            viewed={viewed}
            onChange={(nextViewed) => setFileViewed(file.storageId, nextViewed)}
          />
        </span>
      )
    },
    [expansionStates, filesById, setFileViewed, viewedFileIds],
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

      /* Revealing a viewed (collapsed) file flows through React state into
         the CodeView's items, and scroll targets resolve against the layout
         at call time — wait a frame so the expanded layout is in place. */
      requestAnimationFrame(() => {
        codeViewRef.current?.scrollTo({
          type: 'range',
          id: itemId,
          range,
          align: 'center',
          behavior: 'smooth-auto',
        })
      })
      setFilePickerOpen(false)
    },
    [filesById, revealFileForSearch],
  )
  /* An open composer with unsaved text refuses to be replaced: it switches
     to its discard prompt and is scrolled into view so the blocked click is
     never silent. When the composer is unmounted (its item is outside the
     virtualization window) the same decision reads composerBodyRef, and a
     dirty composer is scrolled back into view instead of prompting. */
  const guardOpenComposer = useCallback(() => {
    const handle = composerRef.current
    if (handle) {
      if (handle.requestClose()) {
        return true
      }

      revealReviewRange(handle.draft.itemId, handle.draft.range)
      return false
    }

    if (composer !== null) {
      const stored = composerBodyRef.current
      const body =
        stored?.localId === composer.localId ? stored.body : composer.body
      if (body.trim() !== composer.body.trim()) {
        revealReviewRange(composer.itemId, composer.range)
        return false
      }
    }

    return true
  }, [composer, revealReviewRange])
  const openComposer = useCallback(
    (range: SelectedLineRange, itemId: string, fileDiff: FileDiffMetadata) => {
      /* Expanded hunks render full-file context GitHub cannot anchor review
         comments to; ranges touching those lines never open a composer. The
         check runs before guardOpenComposer so an ineligible click leaves an
         already-open composer untouched. */
      if (
        !reviewTarget ||
        !isPatchAnchoredRange(fileDiff, range) ||
        !guardOpenComposer()
      ) {
        return
      }

      composerBodyRef.current = null
      setComposer(
        createComposerDraft({
          itemId,
          path: resolveCommentPath(fileDiff),
          /* Split view reports left-pane context selections as deletions with
             old-file numbers; GitHub needs them as RIGHT with new-file
             numbers. */
          range: remapContextSelection(range, createContextLineMap(fileDiff)),
          headSha: reviewTarget.headSha,
        }),
      )
    },
    [guardOpenComposer, reviewTarget],
  )
  const closeComposer = useCallback(() => {
    composerBodyRef.current = null
    setComposer(null)
    setSelectedLines(null)
  }, [])
  const saveComposer = useCallback(
    (body: string) => {
      if (!composer) {
        return
      }

      updateDrafts((current) => upsertDraft(current, { ...composer, body }))
      composerBodyRef.current = null
      setComposer(null)
      setSelectedLines(null)
    },
    [composer, updateDrafts],
  )
  const editDraft = useCallback(
    (draft: DraftReviewComment): boolean => {
      if (composer?.localId === draft.localId) {
        return true
      }
      if (!guardOpenComposer()) {
        return false
      }

      composerBodyRef.current = null
      setComposer(draft)
      return true
    },
    [composer, guardOpenComposer],
  )
  const editDraftFromPanel = useCallback(
    (draft: DraftReviewComment) => {
      if (editDraft(draft)) {
        revealReviewRange(draft.itemId, draft.range)
      }
    },
    [editDraft, revealReviewRange],
  )
  const deleteDraft = useCallback(
    (localId: string) => {
      updateDrafts((current) => removeDraft(current, localId))
      if (composerBodyRef.current?.localId === localId) {
        composerBodyRef.current = null
      }
      setComposer((current) => (current?.localId === localId ? null : current))
    },
    [updateDrafts],
  )
  const selectDraftInPanel = useCallback(
    (draft: DraftReviewComment) => revealReviewRange(draft.itemId, draft.range),
    [revealReviewRange],
  )
  /* Labels a sidebar anchor as an added, deleted, or unchanged line. */
  const classifyAnchor = useCallback(
    (path: string, range: SelectedLineRange) => {
      const itemId = itemIdByPath.get(path)
      const file = itemId === undefined ? undefined : filesById.get(itemId)
      if (!file) {
        return null
      }

      return classifyDiffLine(
        file.file,
        range.endSide ?? range.side ?? 'additions',
        range.end,
      )
    },
    [filesById, itemIdByPath],
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
        const publishedReviewId = await publishReview(
          { event, body, comments: [...drafts], target: reviewTarget },
          {
            token: readStoredGitHubToken(),
            /* The pending review is persisted next to the drafts, so a
               submission interrupted by an error — or a closed tab — resumes
               it instead of hitting GitHub's one-pending-review limit. */
            pendingReview: readStoredPendingReview(reviewTarget),
            onPendingReviewCreated: (pending) =>
              writeStoredPendingReview(reviewTarget, pending),
          },
        )

        writeStoredPendingReview(reviewTarget, null)
        updateDrafts(() => [])
        composerBodyRef.current = null
        setComposer(null)
        setSelectedLines(null)
        setSubmitState({ phase: 'success', reviewId: publishedReviewId })
        onReloadComments?.()
      } catch (error) {
        setSubmitState(toSubmitErrorState(error))
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

      /* The library keys annotation slots by array index, so per-comment
         keys are what pin each card — and the composer's textarea state —
         to its comment when the annotation set shifts. */
      if (metadata.kind === 'github') {
        const thread = threadByRootId.get(metadata.id)
        return thread ? (
          <GitHubReviewAnnotation key={metadata.id} thread={thread} />
        ) : null
      }

      if (composer !== null && metadata.localId === composer.localId) {
        return (
          <DraftReviewComposer
            key={metadata.localId}
            ref={composerRef}
            draft={composer}
            bodyStore={composerBodyRef}
            onSave={saveComposer}
            onCancel={closeComposer}
          />
        )
      }

      return (
        <DraftReviewAnnotation
          key={metadata.localId}
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
  /* GitHub-native diffs load both revisions from GitHub. A shared local diff
     with source metadata loads its base revision and reconstructs the local
     side from the patch. Raw shares without a source keep plain separators. */
  const loadDiffFiles = useMemo(() => {
    if (isGitHubDiff) {
      const source = parseGitHubDiffUrl(viewerId)
      return source
        ? createGitHubFileContentsLoader(source, {
            pinnedHeadSha: reviewTarget?.headSha ?? null,
          })
        : undefined
    }

    return sharedSource
      ? createGitHubBaseFileContentsLoader(sharedSource, diff)
      : undefined
  }, [diff, isGitHubDiff, reviewTarget, sharedSource, viewerId])
  /* Wraps the loader so each file's sticky header can report hydration
     progress: an entry is set when the expander click starts the download,
     turns into an error note if it fails, and disappears once the expanded
     context renders. */
  const trackedLoadDiffFiles = useMemo(() => {
    if (!loadDiffFiles) {
      return undefined
    }

    return async (fileDiff: FileDiffMetadata) => {
      const itemId = itemIdByPath.get(resolveCommentPath(fileDiff))
      if (itemId === undefined) {
        return loadDiffFiles(fileDiff)
      }

      setExpansionStates((current) =>
        new Map(current).set(itemId, { phase: 'loading' }),
      )
      try {
        const files = await loadDiffFiles(fileDiff)
        setExpansionStates((current) => {
          const next = new Map(current)
          next.delete(itemId)
          return next
        })
        return files
      } catch (error) {
        setExpansionStates((current) =>
          new Map(current).set(itemId, {
            phase: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The file contents could not be loaded.',
          }),
        )
        throw error
      }
    }
  }, [itemIdByPath, loadDiffFiles])

  useEffect(() => {
    setExpansionStates(EMPTY_EXPANSION_STATES)
  }, [trackedLoadDiffFiles])

  const options = useMemo<CodeViewOptions<ReviewCommentMetadata>>(
    () => ({
      diffStyle,
      diffIndicators: 'bars' as const,
      hunkSeparators: 'line-info' as const,
      loadDiffFiles: trackedLoadDiffFiles,
      expansionLineCount: 20,
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
    [
      diffStyle,
      openComposer,
      resolvedTheme,
      reviewEnabled,
      trackedLoadDiffFiles,
      wrapLines,
    ],
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
    composerBodyRef.current = null
    setComposer(null)
    setSelectedLines(null)
    setSubmitState({ phase: 'idle' })
    setSubmitPanelOpen(false)
    setSidebarTab('files')
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
          {expiresAt && (
            <span className="hidden font-mono text-[11px] sm:block">
              <ExpiryCountdown expiresAt={expiresAt} />
            </span>
          )}
          <GitHubRepoLink />
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
              {reviewTarget ? 'Open PR' : 'Open on GitHub'}
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <Button variant="primary" size="sm" onClick={copyShareLink}>
              <svg
                className="size-3.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {copied ? (
                  <path d="m3.5 8.5 3 3 6-6.5" />
                ) : (
                  <>
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                    <path d="M10.5 3.5h-5a2 2 0 0 0-2 2v5" />
                  </>
                )}
              </svg>
              {/* Both labels occupy the same grid cell so the button keeps
                  the wider label's width when the text swaps on copy. */}
              <span className="grid justify-items-center">
                <span
                  className={cn(
                    'col-start-1 row-start-1',
                    copied && 'invisible',
                  )}
                >
                  Copy link
                </span>
                <span
                  className={cn(
                    'col-start-1 row-start-1',
                    !copied && 'invisible',
                  )}
                >
                  Copied
                </span>
              </span>
            </Button>
          )}
        </div>
      </header>

      <Toolbar
        className="min-w-0 max-w-full flex-col items-stretch gap-0 p-0 [grid-area:toolbar]"
        aria-label="Diff controls"
      >
        {isGitHubDiff && props.stackSummary && reviewTarget && (
          <GitHubStackSelector
            owner={reviewTarget.owner}
            repo={reviewTarget.repo}
            pullNumber={reviewTarget.pullNumber}
            summary={props.stackSummary}
            state={props.stackState}
            onRetry={props.onReloadStack}
          />
        )}

        <div className="flex min-w-0 flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
          <CategoryFilters
            activeFilter={categoryFilter}
            summary={summary}
            onChange={setCategoryFilter}
          />

          <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 sm:justify-end sm:pl-0 md:flex-nowrap md:gap-3 md:pr-4">
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
            <ViewOptionsControl
              order={fileOrder}
              onOrderChange={setFileOrder}
              diffStyle={diffStyle}
              onDiffStyleChange={setDiffStyle}
              wrapLines={wrapLines}
              onWrapLinesChange={setWrapLines}
            />
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
                pullRequestUrl={
                  reviewTarget
                    ? `https://github.com/${reviewTarget.owner}/${reviewTarget.repo}/pull/${reviewTarget.pullNumber}`
                    : null
                }
                onSubmit={submitReview}
                onReloadDiff={onReloadDiff ?? NOOP}
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
              'invisible absolute inset-y-0 left-0 z-20 flex w-[min(280px,calc(100%-44px))] -translate-x-full flex-col border-r border-line bg-canvas shadow-float transition-[transform,visibility] duration-150 [grid-area:tree]',
              'md:visible md:static md:z-auto md:w-auto md:translate-x-0 md:shadow-none',
              filePickerOpen && 'visible translate-x-0',
            )}
            id="diff-file-picker"
            aria-label="Changed files"
          >
            <PanelHeader>
              {reviewEnabled ? (
                <div
                  className="flex items-center gap-4"
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
              <output
                className="ml-auto whitespace-nowrap text-muted"
                title={`${viewedFileCount} of ${summary.files} files viewed`}
                aria-label={`${viewedFileCount} of ${summary.files} files viewed`}
              >
                {viewedFileCount}/{summary.files}
              </output>
              <IconButton
                className="md:hidden"
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
                classifyAnchor={classifyAnchor}
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

const EMPTY_EXPANSION_STATES: ReadonlyMap<string, FileExpansionState> =
  new Map()
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
        'relative inline-flex h-8 shrink-0 items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted transition-colors hover:text-muted-bright',
        active &&
          'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground',
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

function FileExpansionStatus({ state }: { state: FileExpansionState }) {
  if (state.phase === 'error') {
    return (
      <output
        className="cursor-help font-mono text-[11px] font-medium text-deletion"
        title={state.message}
      >
        Expand failed
      </output>
    )
  }

  return (
    <output className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-muted">
      <span
        className="size-1.5 animate-pulse rounded-full bg-accent-text"
        aria-hidden="true"
      />
      Expanding…
    </output>
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
      className="category-filter-scroll flex min-w-0 items-center gap-4 overflow-x-auto px-3 md:px-4"
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
              'relative inline-flex h-8 shrink-0 items-center gap-2 font-mono text-[11px] text-muted transition-colors',
              'hover:text-muted-bright',
              'disabled:pointer-events-none disabled:opacity-55',
              active &&
                'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground',
            )}
            type="button"
            aria-pressed={active}
            disabled={filterSummary.files === 0}
            title={
              filterSummary.files > 0
                ? `+${filterSummary.additions} −${filterSummary.deletions}`
                : undefined
            }
            data-testid={`category-filter-${filter}`}
            onClick={() => onChange(filter)}
          >
            <span className="font-medium">{details.label}</span>
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
      className="tabular-nums text-muted"
      aria-label={`${summary.files} ${summary.files === 1 ? 'file' : 'files'}, ${summary.additions} additions, ${summary.deletions} deletions`}
    >
      {summary.files}
    </span>
  )
}

function ViewOptionsControl({
  order,
  onOrderChange,
  diffStyle,
  onDiffStyleChange,
  wrapLines,
  onWrapLinesChange,
}: {
  order: DiffFileOrder
  onOrderChange: (order: DiffFileOrder) => void
  diffStyle: DiffStyle
  onDiffStyleChange: (style: DiffStyle) => void
  wrapLines: boolean
  onWrapLinesChange: (wrap: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls="view-options-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          className="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M2.5 5h4.75M11.75 5h1.75M2.5 11h1.75M8.5 11h5" />
          <circle cx="9.5" cy="5" r="1.75" />
          <circle cx="6.25" cy="11" r="1.75" />
        </svg>
        View
      </Button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-44 flex-col gap-3 rounded-control border border-line bg-canvas p-3 shadow-float"
          id="view-options-panel"
        >
          <ViewOptionGroup
            label="File order"
            value={order}
            options={[
              {
                value: 'patch',
                label: 'Patch',
                title: 'Order files as they appear in the patch',
              },
              {
                value: 'category',
                label: 'Category',
                title: 'Group files by category: source, tests, docs, other',
              },
            ]}
            onChange={onOrderChange}
          />
          <ViewOptionGroup
            label="Layout"
            value={diffStyle}
            options={[
              { value: 'unified', label: 'Unified' },
              { value: 'split', label: 'Split' },
            ]}
            onChange={onDiffStyleChange}
          />
          <Toggle
            className="h-auto justify-between px-2 py-1.5 font-mono text-[11px]"
            pressed={wrapLines}
            onClick={() => onWrapLinesChange(!wrapLines)}
          >
            Wrap lines
          </Toggle>
        </div>
      )}
    </div>
  )
}

function ViewOptionGroup<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: readonly { value: Value; label: string; title?: string }[]
  onChange: (value: Value) => void
}) {
  return (
    <fieldset aria-label={label} className="flex flex-col">
      <span className={cn(eyebrowClassName, 'mb-1 px-2 text-muted-bright')}>
        {label}
      </span>
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            className={cn(
              'flex items-center gap-2 rounded-control px-2 py-1.5 text-left font-mono text-[11px] transition-colors',
              'hover:bg-surface-raised hover:text-foreground',
              active ? 'text-foreground' : 'text-muted',
            )}
            type="button"
            aria-pressed={active}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                active ? 'bg-foreground' : 'bg-line-bright',
              )}
            />
            {option.label}
          </button>
        )
      })}
    </fieldset>
  )
}

function DiffCategoryBadge({ category }: { category: DiffCategory }) {
  return (
    <span
      className="flex items-center rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none uppercase tracking-[0.08em] text-muted-bright"
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
      className="cursor-help text-muted underline decoration-line-bright decoration-dotted underline-offset-[3px]"
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
