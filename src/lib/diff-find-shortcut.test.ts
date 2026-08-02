import { describe, expect, it } from 'vitest'

import { isDiffFindShortcut } from './diff-find-shortcut'

function keyboardEvent(
  overrides: Partial<Parameters<typeof isDiffFindShortcut>[0]> = {},
): Parameters<typeof isDiffFindShortcut>[0] {
  return {
    altKey: false,
    ctrlKey: false,
    key: 'f',
    metaKey: false,
    shiftKey: false,
    ...overrides,
  }
}

describe('isDiffFindShortcut', () => {
  it('accepts the platform find shortcuts', () => {
    expect(isDiffFindShortcut(keyboardEvent({ ctrlKey: true }))).toBe(true)
    expect(isDiffFindShortcut(keyboardEvent({ key: 'F', metaKey: true }))).toBe(
      true,
    )
  })

  it('leaves modified and unrelated shortcuts to the browser', () => {
    expect(
      isDiffFindShortcut(keyboardEvent({ altKey: true, ctrlKey: true })),
    ).toBe(false)
    expect(
      isDiffFindShortcut(keyboardEvent({ ctrlKey: true, shiftKey: true })),
    ).toBe(false)
    expect(isDiffFindShortcut(keyboardEvent({ ctrlKey: true, key: 'g' }))).toBe(
      false,
    )
  })
})
