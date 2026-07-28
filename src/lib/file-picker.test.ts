import { describe, expect, it } from 'vitest'

import { createDiffFilePickerEntries } from './file-picker'

describe('diff file picker entries', () => {
  it('normalizes paths and maps diff changes to tree statuses', () => {
    expect(
      createDiffFilePickerEntries([
        { itemId: 'one', name: '/src//index.ts', type: 'change' },
        { itemId: 'two', name: 'src/new.ts', type: 'new' },
        { itemId: 'three', name: 'src/old.ts', type: 'deleted' },
        { itemId: 'four', name: 'src/moved.ts', type: 'rename-changed' },
      ]),
    ).toEqual([
      { itemId: 'one', path: 'src/index.ts', status: 'modified' },
      { itemId: 'two', path: 'src/new.ts', status: 'added' },
      { itemId: 'three', path: 'src/old.ts', status: 'deleted' },
      { itemId: 'four', path: 'src/moved.ts', status: 'renamed' },
    ])
  })

  it('keeps repeated file paths separately selectable', () => {
    expect(
      createDiffFilePickerEntries([
        { itemId: 'one', name: 'src/index.ts', type: 'change' },
        { itemId: 'two', name: 'src/index.ts', type: 'change' },
      ]),
    ).toEqual([
      { itemId: 'one', path: 'src/index.ts', status: 'modified' },
      { itemId: 'two', path: 'src/index (2).ts', status: 'modified' },
    ])
  })
})
