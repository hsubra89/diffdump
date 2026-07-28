import { describe, expect, it } from 'vitest'

import { createDiffFilePickerEntries } from './file-picker'

describe('diff file picker entries', () => {
  it('normalizes paths and maps diff changes to tree statuses', () => {
    expect(
      createDiffFilePickerEntries([
        {
          itemId: 'one',
          name: '/src//index.ts',
          type: 'change',
          category: 'source',
          additions: 2,
          deletions: 1,
          viewed: true,
        },
        {
          itemId: 'two',
          name: 'src/new.ts',
          type: 'new',
          category: 'source',
          additions: 3,
          deletions: 0,
          viewed: false,
        },
        {
          itemId: 'three',
          name: 'src/old.ts',
          type: 'deleted',
          category: 'source',
          additions: 0,
          deletions: 4,
          viewed: false,
        },
        {
          itemId: 'four',
          name: 'src/moved.ts',
          type: 'rename-changed',
          category: 'source',
          additions: 1,
          deletions: 1,
          viewed: false,
        },
      ]),
    ).toEqual([
      {
        itemId: 'one',
        path: 'src/index.ts',
        status: 'modified',
        category: 'source',
        additions: 2,
        deletions: 1,
        viewed: true,
      },
      {
        itemId: 'two',
        path: 'src/new.ts',
        status: 'added',
        category: 'source',
        additions: 3,
        deletions: 0,
        viewed: false,
      },
      {
        itemId: 'three',
        path: 'src/old.ts',
        status: 'deleted',
        category: 'source',
        additions: 0,
        deletions: 4,
        viewed: false,
      },
      {
        itemId: 'four',
        path: 'src/moved.ts',
        status: 'renamed',
        category: 'source',
        additions: 1,
        deletions: 1,
        viewed: false,
      },
    ])
  })

  it('keeps repeated file paths separately selectable', () => {
    expect(
      createDiffFilePickerEntries([
        {
          itemId: 'one',
          name: 'src/index.ts',
          type: 'change',
          category: 'source',
          additions: 1,
          deletions: 0,
          viewed: false,
        },
        {
          itemId: 'two',
          name: 'src/index.ts',
          type: 'change',
          category: 'tests',
          additions: 2,
          deletions: 1,
          viewed: true,
        },
      ]),
    ).toEqual([
      {
        itemId: 'one',
        path: 'src/index.ts',
        status: 'modified',
        category: 'source',
        additions: 1,
        deletions: 0,
        viewed: false,
      },
      {
        itemId: 'two',
        path: 'src/index (2).ts',
        status: 'modified',
        category: 'tests',
        additions: 2,
        deletions: 1,
        viewed: true,
      },
    ])
  })
})
