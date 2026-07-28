import { useMemo } from 'react'
import { preparePresortedFileTreeInput } from '@pierre/trees'
import { FileTree, useFileTree } from '@pierre/trees/react'

import { DIFF_CATEGORY_DETAILS } from '../lib/diff-files'
import type { DiffFilePickerEntry } from '../lib/file-picker'

type DiffFilePickerProps = {
  entries: readonly DiffFilePickerEntry[]
  onSelect: (itemId: string) => void
}

export default function DiffFilePicker({
  entries,
  onSelect,
}: DiffFilePickerProps) {
  const paths = useMemo(() => entries.map((entry) => entry.path), [entries])
  const preparedInput = useMemo(
    () => preparePresortedFileTreeInput(paths),
    [paths],
  )
  const entriesByPath = useMemo(
    () => new Map(entries.map((entry) => [entry.path, entry])),
    [entries],
  )
  const gitStatus = useMemo(
    () =>
      entries.map((entry) => ({
        path: entry.path,
        status: entry.status,
      })),
    [entries],
  )
  const { model } = useFileTree({
    preparedInput,
    flattenEmptyDirectories: true,
    initialExpansion: 'open',
    initialSelectedPaths: paths.length > 0 ? [paths[0]] : [],
    density: 'compact',
    gitStatus,
    icons: 'standard',
    search: true,
    stickyFolders: true,
    renderRowDecoration({ item }) {
      const entry = entriesByPath.get(item.path)

      if (!entry) {
        return null
      }

      const category = DIFF_CATEGORY_DETAILS[entry.category]
      const viewedText = entry.viewed ? '✓ ' : ''
      const text = `${viewedText}${category.shortLabel} +${entry.additions} −${entry.deletions}`

      return {
        text,
        title: `${entry.viewed ? 'Viewed · ' : ''}${category.label}: +${entry.additions} −${entry.deletions}`,
        parts: [
          ...(entry.viewed
            ? [
                {
                  text: '✓ ',
                  color: 'var(--accent-text)',
                },
              ]
            : []),
          {
            text: `${category.shortLabel} `,
            color: 'var(--trees-fg-muted-override)',
          },
          { text: `+${entry.additions} `, color: 'var(--addition)' },
          { text: `−${entry.deletions}`, color: 'var(--deletion)' },
        ],
      }
    },
    onSelectionChange(selectedPaths) {
      for (let index = selectedPaths.length - 1; index >= 0; index -= 1) {
        const entry = entriesByPath.get(selectedPaths[index])

        if (entry) {
          onSelect(entry.itemId)
          return
        }
      }
    },
  })

  return (
    <FileTree
      className="diff-file-tree block min-h-0 w-full flex-1"
      model={model}
      aria-label="Changed files"
    />
  )
}
