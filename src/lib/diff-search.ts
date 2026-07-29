import type { ClassifiedDiffFile } from './diff-files'

export type DiffSearchSide = 'additions' | 'deletions'

export type DiffSearchEntry = {
  side: DiffSearchSide
  lineNumber: number
  /** Pre-lowercased line text; searches are case-insensitive. */
  text: string
}

export type DiffSearchFileCorpus = {
  fileId: string
  entries: DiffSearchEntry[]
}

export type DiffSearchMatch = {
  fileId: string
  side: DiffSearchSide
  lineNumber: number
}

export type DiffSearchResult = {
  matches: DiffSearchMatch[]
  /** True when the scan stopped at the match limit; more matches may exist. */
  limited: boolean
}

export const DIFF_SEARCH_MATCH_LIMIT = 10_000

/**
 * Flattens each file's hunks into searchable line entries in document order.
 * Context text exists in both `additionLines` and `deletionLines`; it is
 * emitted from the addition side only so a context match is counted once.
 */
export function buildSearchCorpus(
  files: readonly ClassifiedDiffFile[],
): DiffSearchFileCorpus[] {
  return files.map(({ id, file }) => {
    const entries: DiffSearchEntry[] = []

    for (const hunk of file.hunks) {
      let additionLineNumber = hunk.additionStart
      let deletionLineNumber = hunk.deletionStart

      for (const block of hunk.hunkContent) {
        if (block.type === 'context') {
          pushEntries(
            entries,
            'additions',
            file.additionLines,
            block.additionLineIndex,
            block.lines,
            additionLineNumber,
          )
          additionLineNumber += block.lines
          deletionLineNumber += block.lines
        } else {
          pushEntries(
            entries,
            'deletions',
            file.deletionLines,
            block.deletionLineIndex,
            block.deletions,
            deletionLineNumber,
          )
          deletionLineNumber += block.deletions
          pushEntries(
            entries,
            'additions',
            file.additionLines,
            block.additionLineIndex,
            block.additions,
            additionLineNumber,
          )
          additionLineNumber += block.additions
        }
      }
    }

    return { fileId: id, entries }
  })
}

export function searchDiffCorpus(
  corpus: readonly DiffSearchFileCorpus[],
  query: string,
  limit = DIFF_SEARCH_MATCH_LIMIT,
): DiffSearchResult {
  const matches: DiffSearchMatch[] = []
  const needle = query.toLowerCase()

  if (needle === '') {
    return { matches, limited: false }
  }

  for (const { fileId, entries } of corpus) {
    for (const entry of entries) {
      if (!entry.text.includes(needle)) {
        continue
      }

      matches.push({ fileId, side: entry.side, lineNumber: entry.lineNumber })

      if (matches.length >= limit) {
        return { matches, limited: true }
      }
    }
  }

  return { matches, limited: false }
}

function pushEntries(
  entries: DiffSearchEntry[],
  side: DiffSearchSide,
  lines: readonly string[],
  lineIndex: number,
  count: number,
  firstLineNumber: number,
) {
  for (let offset = 0; offset < count; offset += 1) {
    let text = lines[lineIndex + offset]

    if (text === undefined) {
      continue
    }

    /* Parsed lines keep their trailing newline (except at EOF). */
    if (text.endsWith('\n')) {
      text = text.slice(0, -1)
    }
    if (text.endsWith('\r')) {
      text = text.slice(0, -1)
    }

    entries.push({
      side,
      lineNumber: firstLineNumber + offset,
      text: text.toLowerCase(),
    })
  }
}
