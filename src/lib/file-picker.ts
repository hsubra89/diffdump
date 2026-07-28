import type { ChangeTypes } from '@pierre/diffs'
import type { GitStatus } from '@pierre/trees'

import type { DiffCategory } from './diff-files'

export type DiffFilePickerSource = {
  itemId: string
  name: string
  type: ChangeTypes
  category: DiffCategory
  additions: number
  deletions: number
  viewed: boolean
}

export type DiffFilePickerEntry = {
  itemId: string
  path: string
  status: GitStatus
  category: DiffCategory
  additions: number
  deletions: number
  viewed: boolean
}

export function createDiffFilePickerEntries(
  files: readonly DiffFilePickerSource[],
): DiffFilePickerEntry[] {
  const usedPaths = new Set<string>()
  const duplicateCounts = new Map<string, number>()

  return files.map((file) => {
    const basePath = normalizeTreePath(file.name)
    let duplicateNumber = (duplicateCounts.get(basePath) ?? 0) + 1
    let path =
      duplicateNumber === 1
        ? basePath
        : addDuplicateSuffix(basePath, duplicateNumber)

    while (usedPaths.has(path)) {
      duplicateNumber += 1
      path = addDuplicateSuffix(basePath, duplicateNumber)
    }

    duplicateCounts.set(basePath, duplicateNumber)
    usedPaths.add(path)

    return {
      itemId: file.itemId,
      path,
      status: toGitStatus(file.type),
      category: file.category,
      additions: file.additions,
      deletions: file.deletions,
      viewed: file.viewed,
    }
  })
}

function normalizeTreePath(path: string): string {
  return path.split('/').filter(Boolean).join('/') || 'unknown-file'
}

function addDuplicateSuffix(path: string, duplicateNumber: number): string {
  const lastSlash = path.lastIndexOf('/')
  const lastDot = path.lastIndexOf('.')
  const suffix = ` (${duplicateNumber})`

  if (lastDot > lastSlash + 1) {
    return `${path.slice(0, lastDot)}${suffix}${path.slice(lastDot)}`
  }

  return `${path}${suffix}`
}

function toGitStatus(type: ChangeTypes): GitStatus {
  switch (type) {
    case 'new':
      return 'added'
    case 'deleted':
      return 'deleted'
    case 'rename-pure':
    case 'rename-changed':
      return 'renamed'
    default:
      return 'modified'
  }
}
