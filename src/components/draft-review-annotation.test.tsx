// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DraftDeleteButton,
  DraftDeletionDialog,
  DraftInvalidBadge,
  createDraftDeletionDialogHandle,
} from './draft-review-annotation'
import { TooltipProvider } from './ui/tooltip'
import type { DraftReviewComment } from '../lib/review-comments'

const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567'

function createDraft(
  overrides: Partial<DraftReviewComment> = {},
): DraftReviewComment {
  return {
    kind: 'draft',
    localId: 'local-1',
    itemId: 'item-1',
    path: 'src/app.ts',
    body: 'Consider renaming this.',
    range: { start: 12, end: 12, side: 'additions' },
    headSha: HEAD_SHA,
    ...overrides,
  }
}

afterEach(cleanup)

describe('draft deletion confirmation', () => {
  it('uses one payload-aware dialog and restores the active trigger', async () => {
    const user = userEvent.setup()
    const handle = createDraftDeletionDialogHandle()
    const onDelete = vi.fn<(localId: string) => void>()
    const firstDraft = createDraft()
    const secondDraft = createDraft({
      localId: 'local-2',
      path: 'src/other.ts',
      range: { start: 28, end: 30, side: 'additions' },
    })

    render(
      <>
        <DraftDeleteButton draft={firstDraft} dialogHandle={handle} />
        <DraftDeleteButton draft={secondDraft} dialogHandle={handle} />
        <DraftDeletionDialog handle={handle} onDelete={onDelete} />
      </>,
    )

    const [firstTrigger, secondTrigger] = screen.getAllByRole('button', {
      name: 'Delete',
    })

    await user.click(secondTrigger)

    expect(
      screen.getByRole('alertdialog', { name: 'Delete draft comment?' }),
    ).not.toBeNull()
    expect(
      screen.getByText(
        'This removes your saved draft for src/other.ts:30. This action can’t be undone.',
      ),
    ).not.toBeNull()
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Cancel' }),
      )
    })

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
    expect(document.activeElement).toBe(secondTrigger)
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(firstTrigger)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
    expect(document.activeElement).toBe(firstTrigger)
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(firstTrigger)
    const deleteAction = screen.getByRole('button', { name: 'Delete draft' })
    expect(deleteAction.className).toContain('bg-destructive')
    await user.click(deleteAction)

    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith('local-1')
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
    expect(document.activeElement).toBe(firstTrigger)
  })
})

describe('DraftInvalidBadge', () => {
  it('makes the full error available without a native title', async () => {
    const user = userEvent.setup()
    const error = 'The selected lines are no longer in this patch.'

    render(
      <TooltipProvider delay={0}>
        <DraftInvalidBadge error={error} />
      </TooltipProvider>,
    )

    const badge = screen.getByLabelText(`Can’t submit: ${error}`)
    expect(badge.getAttribute('title')).toBeNull()
    expect(badge.getAttribute('data-slot')).toBe('tooltip-trigger')

    await user.hover(badge)
    await waitFor(() => {
      expect(screen.getByText(error)).not.toBeNull()
    })
  })
})
