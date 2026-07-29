import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'
import type { CodeViewHandle } from '@pierre/diffs/react'

import { IconButton } from './ui/button'
import type { ClassifiedDiffFile } from '../lib/diff-files'
import {
  buildSearchCorpus,
  searchDiffCorpus,
  type DiffSearchMatch,
} from '../lib/diff-search'

type DiffFindBarProps = {
  visibleFiles: readonly ClassifiedDiffFile[]
  codeViewRef: RefObject<CodeViewHandle<undefined> | null>
  onRevealFile: (storageId: string) => void
}

type ExecutedSearch = {
  query: string
  matches: DiffSearchMatch[]
  limited: boolean
  index: number
}

export default function DiffFindBar({
  visibleFiles,
  codeViewRef,
  onRevealFile,
}: DiffFindBarProps) {
  const [open, setOpen] = useState(false)
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

  const close = useCallback(() => {
    setOpen(false)
    setSearch(null)
    codeViewRef.current?.clearSelectedLines()
  }, [codeViewRef])

  useEffect(() => {
    function handleFindShortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        /* Native find silently misses everything the virtualized CodeView
           has not rendered, so take the shortcut over. */
        event.preventDefault()
        setOpen(true)
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }

    window.addEventListener('keydown', handleFindShortcut)
    return () => window.removeEventListener('keydown', handleFindShortcut)
  }, [])

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

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [close, open])

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
        codeViewRef.current?.setSelectedLines({
          id: match.fileId,
          range: {
            start: match.lineNumber,
            end: match.lineNumber,
            side: match.side,
          },
        })
      })
    },
    [codeViewRef, onRevealFile, storageIdsByFileId],
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
        codeViewRef.current?.clearSelectedLines()
        return
      }

      const { matches, limited } = searchDiffCorpus(corpus, inputValue)
      setSearch({ query: inputValue, matches, limited, index: 0 })

      if (matches.length > 0) {
        navigateToMatch(matches[0])
      } else {
        codeViewRef.current?.clearSelectedLines()
      }
    },
    [codeViewRef, corpus, inputValue, navigateToMatch, search],
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
      aria-label="Find in diff"
      className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-control border border-line-bright bg-panel p-1 shadow-[0_2px_8px_light-dark(rgb(0_0_0/12%),rgb(0_0_0/45%)),0_12px_36px_light-dark(rgb(0_0_0/22%),rgb(0_0_0/65%))] focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-solid focus-within:outline-accent-text md:right-4"
    >
      <input
        ref={inputRef}
        className="h-7 w-40 min-w-0 bg-transparent px-2 font-mono text-xs text-foreground outline-none placeholder:text-muted/70 sm:w-52"
        type="text"
        value={inputValue}
        placeholder="Find in diff"
        title="Searches the visible files. Enter for next match, Shift+Enter for previous."
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => setInputValue(event.currentTarget.value)}
        onKeyDown={handleInputKeyDown}
      />
      <span
        className="min-w-14 px-1 text-right font-mono text-[10px] text-muted tabular-nums"
        aria-live="polite"
      >
        {search ? formatMatchCounter(search) : ''}
      </span>
      <IconButton
        label="Previous match"
        variant="ghost"
        size="xs"
        disabled={inputValue === ''}
        onClick={() => submit(-1)}
      >
        <span aria-hidden="true">↑</span>
      </IconButton>
      <IconButton
        label="Next match"
        variant="ghost"
        size="xs"
        disabled={inputValue === ''}
        onClick={() => submit(1)}
      >
        <span aria-hidden="true">↓</span>
      </IconButton>
      <IconButton
        label="Close find bar"
        variant="ghost"
        size="xs"
        onClick={close}
      >
        <span className="text-lg leading-none" aria-hidden="true">
          ×
        </span>
      </IconButton>
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
