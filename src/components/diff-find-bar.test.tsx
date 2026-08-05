// @vitest-environment happy-dom

import { useRef, useState } from 'react'
import type { CodeViewLineSelection } from '@pierre/diffs'
import type { CodeViewHandle } from '@pierre/diffs/react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import DiffFindBar from './diff-find-bar'
import type { ReviewCommentMetadata } from '../lib/review-comments'

vi.mock('@pierre/icons', () => ({
  IconArrow: () => null,
  IconX: () => null,
}))

afterEach(cleanup)

describe('DiffFindBar', () => {
  it('has a concise accessible name and restores trigger focus on Escape', async () => {
    const user = userEvent.setup()
    const onSelectLines =
      vi.fn<(selection: CodeViewLineSelection | null) => void>()
    const onRevealFile = vi.fn<(storageId: string) => void>()

    function FindHarness() {
      const [open, setOpen] = useState(false)
      const triggerRef = useRef<HTMLButtonElement>(null)
      const codeViewRef = useRef<CodeViewHandle<ReviewCommentMetadata> | null>(
        null,
      )

      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Find in diff
          </button>
          {open && (
            <DiffFindBar
              open
              onOpenChange={setOpen}
              returnFocusRef={triggerRef}
              visibleFiles={[]}
              codeViewRef={codeViewRef}
              onSelectLines={onSelectLines}
              onRevealFile={onRevealFile}
            />
          )}
        </>
      )
    }

    render(<FindHarness />)

    const trigger = screen.getByRole('button', { name: 'Find in diff' })
    await user.click(trigger)

    const input = screen.getByRole('textbox', { name: 'Find in diff' })
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('title')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBe(
      'diff-find-instructions',
    )
    expect(document.getElementById('diff-find-instructions')?.textContent).toBe(
      'Searches the visible files. Enter for next match, Shift+Enter for previous.',
    )

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Find in diff' })).toBeNull()
    })
    expect(document.activeElement).toBe(trigger)
  })
})
