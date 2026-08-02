// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SubmitReviewPanel from './submit-review-panel'
import type { GitHubReviewEvent } from '../lib/review-comments'

vi.mock('@pierre/icons', () => ({
  IconArrowUpRight: () => null,
  IconCheck: () => null,
}))

afterEach(cleanup)

const defaultProps = {
  draftCount: 1,
  submitState: { phase: 'idle' } as const,
  reviewUrl: null,
  pullRequestUrl: null,
  onSubmit: vi.fn<(event: GitHubReviewEvent, body: string) => void>(),
  onReloadDiff: vi.fn<() => void>(),
  onClose: vi.fn<() => void>(),
}

describe('SubmitReviewPanel', () => {
  it('changes the checked review type with arrow keys and submits it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(event: GitHubReviewEvent, body: string) => void>()

    render(<SubmitReviewPanel {...defaultProps} onSubmit={onSubmit} />)

    const comment = screen.getByRole('radio', { name: 'Comment' })
    const approve = screen.getByRole('radio', { name: 'Approve' })

    expect(comment.getAttribute('aria-checked')).toBe('true')
    expect(approve.getAttribute('aria-checked')).toBe('false')

    comment.focus()
    await user.keyboard('{ArrowDown}')

    expect(comment.getAttribute('aria-checked')).toBe('false')
    expect(approve.getAttribute('aria-checked')).toBe('true')

    await user.type(
      screen.getByRole('textbox', { name: 'Review summary' }),
      'Ready to merge',
    )
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(onSubmit).toHaveBeenCalledWith('APPROVE', 'Ready to merge')
  })

  it('disables review controls while submission is in progress', () => {
    render(
      <SubmitReviewPanel
        {...defaultProps}
        submitState={{ phase: 'submitting' }}
      />,
    )

    const summary = screen.getByRole('textbox', { name: 'Review summary' })
    const comment = screen.getByRole('radio', { name: 'Comment' })
    const submit = screen.getByRole('button', { name: 'Publishing…' })

    expect((summary as HTMLTextAreaElement).disabled).toBe(true)
    expect(comment.getAttribute('aria-disabled')).toBe('true')
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })
})
