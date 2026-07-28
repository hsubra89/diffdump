import { useMemo } from 'react'
import { prepareFileTreeInput } from '@pierre/trees'
import { FileTree, useFileTree } from '@pierre/trees/react'

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
  const preparedInput = useMemo(() => prepareFileTreeInput(paths), [paths])
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
