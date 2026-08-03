import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'
import type { CodeViewLineSelection } from '@pierre/diffs'
import type { CodeViewHandle } from '@pierre/diffs/react'
import { IconArrow, IconX } from '@pierre/icons'

import { IconButton } from './ui/button'
import { Input } from './ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import type { ClassifiedDiffFile } from '../lib/diff-files'
import {
  buildSearchCorpus,
  searchDiffCorpus,
  type DiffSearchMatch,
} from '../lib/diff-search'
import type { ReviewCommentMetadata } from '../lib/review-comments'

type DiffFindBarProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: RefObject<HTMLElement | null>
  visibleFiles: readonly ClassifiedDiffFile[]
  codeViewRef: RefObject<CodeViewHandle<ReviewCommentMetadata> | null>
  /* The viewer controls line selection, so match highlights flow through its
     state instead of the imperative handle. */
  onSelectLines: (selection: CodeViewLineSelection | null) => void
  onRevealFile: (storageId: string) => void
}

type ExecutedSearch = {
  query: string
  matches: DiffSearchMatch[]
  limited: boolean
  index: number
}

export default function DiffFindBar({
  open,
  onOpenChange,
  returnFocusRef,
  visibleFiles,
  codeViewRef,
  onSelectLines,
  onRevealFile,
}: DiffFindBarProps) {
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState<ExecutedSearch | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const corpus = useMemo(
    () => (open ? buildSearchCorpus(visibleFiles) : null),
    [open, visibleFiles],
  )
  const storageIdsByFileId = useMemo(
    () => new Map(visibleFiles.map((file) => [file.id, file.storageId])),
    [visibleFiles],
  )

  /* Executed matches reference files by id and line; a filter or order
     change invalidates them. */
  useEffect(() => {
    setSearch(null)
  }, [visibleFiles])

  /* The bar can be closed from outside (toolbar toggle) as well as from the
     Esc/× handlers here, so tie the cleanup to the open flag itself. */
  useEffect(() => {
    if (!open) {
      setSearch(null)
      onSelectLines(null)
    }
  }, [onSelectLines, open])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const returnFocusElement = returnFocusRef.current

    return () => {
      returnFocusElement?.focus({ preventScroll: true })
    }
  }, [open, returnFocusRef])

  useEffect(() => {
    if (!open) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onOpenChange, open])

  const navigateToMatch = useCallback(
    (match: DiffSearchMatch) => {
      const storageId = storageIdsByFileId.get(match.fileId)

      if (storageId) {
        onRevealFile(storageId)
      }

      /* Revealing a viewed (collapsed) file flows through React state into
         the CodeView's items, and scroll targets resolve against the layout
         at call time — wait a frame so the expanded layout is in place. */
      requestAnimationFrame(() => {
        codeViewRef.current?.scrollTo({
          type: 'line',
          id: match.fileId,
          lineNumber: match.lineNumber,
          side: match.side,
          align: 'center',
          behavior: 'smooth-auto',
        })
        onSelectLines({
          id: match.fileId,
          range: {
            start: match.lineNumber,
            end: match.lineNumber,
            side: match.side,
          },
        })
      })
    },
    [codeViewRef, onRevealFile, onSelectLines, storageIdsByFileId],
  )

  const submit = useCallback(
    (direction: 1 | -1) => {
      if (search && search.query === inputValue) {
        if (search.matches.length === 0) {
          return
        }

        const index =
          (search.index + direction + search.matches.length) %
          search.matches.length
        setSearch({ ...search, index })
        navigateToMatch(search.matches[index])
        return
      }

      if (!corpus) {
        return
      }

      if (inputValue === '') {
        setSearch(null)
        onSelectLines(null)
        return
      }

      const { matches, limited } = searchDiffCorpus(corpus, inputValue)
      setSearch({ query: inputValue, matches, limited, index: 0 })

      if (matches.length > 0) {
        navigateToMatch(matches[0])
      } else {
        onSelectLines(null)
      }
    },
    [corpus, inputValue, navigateToMatch, onSelectLines, search],
  )

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit(event.shiftKey ? -1 : 1)
    }
  }

  if (!open) {
    return null
  }

  return (
    <search
      id="diff-find-bar"
      aria-label="Find in diff"
      className="absolute left-3 right-3 top-3 z-30 flex items-center gap-1 rounded-control border border-line-bright bg-panel p-1 shadow-float focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-solid focus-within:outline-accent-text sm:left-auto md:right-4"
    >
      <Input
        ref={inputRef}
        className="h-8 flex-1 border-0 bg-transparent px-2 font-mono focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-7 sm:w-52 sm:flex-none"
        type="text"
        value={inputValue}
        placeholder="Find in diff"
        aria-label="Find in diff"
        title="Searches the visible files. Enter for next match, Shift+Enter for previous."
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => setInputValue(event.currentTarget.value)}
        onKeyDown={handleInputKeyDown}
      />
      <span
        className="min-w-14 px-1 text-right font-mono text-[11px] text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {search ? formatMatchCounter(search) : ''}
      </span>
      <Tooltip disabled={inputValue === ''}>
        <TooltipTrigger
          render={
            <IconButton
              className="max-sm:size-8"
              label="Previous match"
              variant="ghost"
              size="xs"
              disabled={inputValue === ''}
              onClick={() => submit(-1)}
            />
          }
        >
          <IconArrow className="rotate-90" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Previous match</TooltipContent>
      </Tooltip>
      <Tooltip disabled={inputValue === ''}>
        <TooltipTrigger
          render={
            <IconButton
              className="max-sm:size-8"
              label="Next match"
              variant="ghost"
              size="xs"
              disabled={inputValue === ''}
              onClick={() => submit(1)}
            />
          }
        >
          <IconArrow className="-rotate-90" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Next match</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <IconButton
              className="max-sm:size-8"
              label="Close find bar"
              variant="ghost"
              size="xs"
              onClick={() => onOpenChange(false)}
            />
          }
        >
          <IconX aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Close find bar</TooltipContent>
      </Tooltip>
    </search>
  )
}

function formatMatchCounter({ matches, limited, index }: ExecutedSearch) {
  if (matches.length === 0) {
    return 'No results'
  }

  const total = matches.length.toLocaleString('en-US')

  return `${(index + 1).toLocaleString('en-US')} / ${total}${limited ? '+' : ''}`
}
