// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ReviewCommentsPanel from './review-comments-panel'
import {
  createDraftDeletionDialogHandle,
  DraftDeletionDialog,
} from './draft-review-annotation'
import { TooltipProvider } from './ui/tooltip'
import type {
  DraftReviewComment,
  GitHubReviewComment,
  ReviewCommentThread,
} from '../lib/review-comments'

vi.mock('@pierre/icons', () => ({
  IconArrowUpRight: () => null,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const draft: DraftReviewComment = {
  kind: 'draft',
  localId: 'draft-1',
  itemId: 'src/app.ts',
  path: 'src/app.ts',
  body: 'Draft note',
  range: {
    start: 42,
    side: 'additions',
    end: 42,
    endSide: 'additions',
  },
  headSha: 'a'.repeat(40),
}

function githubComment({
  id,
  path,
  body,
  outdated = false,
}: {
  id: number
  path: string
  body: string
  outdated?: boolean
}): GitHubReviewComment {
  return {
    kind: 'github',
    id,
    pullRequestReviewId: 20,
    inReplyToId: null,
    path,
    body,
    author: {
      login: 'octocat',
      avatarUrl: '',
      htmlUrl: 'https://github.com/octocat',
    },
    createdAt: '2026-07-30T12:00:00Z',
    htmlUrl: `https://github.com/hsyntax/diffdump/pull/16#discussion_r${id}`,
    range: outdated
      ? null
      : {
          start: 42,
          side: 'additions',
          end: 42,
          endSide: 'additions',
        },
    outdated,
  }
}

const currentThread: ReviewCommentThread = {
  root: githubComment({
    id: 1,
    path: 'src/app.ts',
    body: 'Current review note',
  }),
  replies: [],
}

const outdatedThread: ReviewCommentThread = {
  root: githubComment({
    id: 2,
    path: 'src/old.ts',
    body: 'Outdated review note',
    outdated: true,
  }),
  replies: [],
}

function renderPanel() {
  const onSelectDraft = vi.fn<(selected: DraftReviewComment) => void>()
  const onEditDraft = vi.fn<(selected: DraftReviewComment) => void>()
  const onSelectThread = vi.fn<(selected: ReviewCommentThread) => void>()
  const deleteDialogHandle = createDraftDeletionDialogHandle()

  render(
    <TooltipProvider delay={0}>
      <ReviewCommentsPanel
        drafts={[draft]}
        threads={[currentThread, outdatedThread]}
        commentsState={{ status: 'loaded', comments: [] }}
        classifyAnchor={() => 'addition'}
        onSelectDraft={onSelectDraft}
        onEditDraft={onEditDraft}
        deleteDialogHandle={deleteDialogHandle}
        onSelectThread={onSelectThread}
        onReloadComments={() => {}}
      />
      <DraftDeletionDialog handle={deleteDialogHandle} onDelete={() => {}} />
    </TooltipProvider>,
  )

  return { onSelectDraft, onSelectThread }
}

describe('ReviewCommentsPanel', () => {
  it('uses shared buttons and preserves keyboard row activation', async () => {
    const user = userEvent.setup()
    const { onSelectDraft, onSelectThread } = renderPanel()

    const draftRow = screen.getByText('Draft note').closest('button')
    const currentRow = screen.getByText('Current review note').closest('button')

    expect(draftRow).not.toBeNull()
    expect(currentRow).not.toBeNull()
    expect(draftRow?.getAttribute('data-slot')).toBe('button')
    expect(currentRow?.getAttribute('data-slot')).toBe('button')
    expect(draftRow?.getAttribute('title')).toBeNull()

    draftRow?.focus()
    await user.keyboard('{Enter}')
    expect(onSelectDraft).toHaveBeenCalledWith(draft)

    currentRow?.focus()
    await user.keyboard(' ')
    expect(onSelectThread).toHaveBeenCalledWith(currentThread)
  })

  it('does not navigate when a pointer click finishes selecting row text', () => {
    const { onSelectDraft } = renderPanel()
    const draftBody = screen.getByText('Draft note')
    const draftRow = draftBody.closest('button')

    expect(draftRow).not.toBeNull()
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      anchorNode: draftBody.firstChild,
      focusNode: draftBody.firstChild,
    } as Selection)

    fireEvent.click(draftRow as HTMLButtonElement, { detail: 1 })
    expect(onSelectDraft).not.toHaveBeenCalled()

    fireEvent.click(draftRow as HTMLButtonElement, { detail: 0 })
    expect(onSelectDraft).toHaveBeenCalledWith(draft)
  })

  it('keeps outdated comments external and prevents selection clicks', () => {
    renderPanel()
    const outdatedBody = screen.getByText('Outdated review note')
    const outdatedLink = outdatedBody.closest('a')

    expect(outdatedLink).not.toBeNull()
    expect(outdatedLink?.getAttribute('href')).toBe(outdatedThread.root.htmlUrl)
    expect(outdatedLink?.getAttribute('target')).toBe('_blank')

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      anchorNode: outdatedBody.firstChild,
      focusNode: outdatedBody.firstChild,
    } as Selection)

    expect(
      fireEvent.click(outdatedLink as HTMLAnchorElement, { detail: 1 }),
    ).toBe(false)
  })

  it('uses shared tooltips instead of native location titles', async () => {
    const user = userEvent.setup()
    renderPanel()

    const draftRow = screen.getByText('Draft note').closest('button')
    const location = draftRow?.querySelector<HTMLElement>(
      '[data-slot="tooltip-trigger"]',
    )

    expect(location).not.toBeNull()
    expect(location?.getAttribute('title')).toBeNull()
    expect(draftRow?.querySelector('[title]')).toBeNull()

    await user.hover(location as HTMLElement)
    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="tooltip-content"]')?.textContent,
      ).toBe('src/app.ts:+42 · added line 42')
    })

    await user.unhover(location as HTMLElement)
    await waitFor(() => {
      expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull()
    })

    const filePath = screen.getByText('src/app.ts', { selector: 'p' })
    expect(filePath.getAttribute('data-slot')).toBe('tooltip-trigger')
    expect(filePath.getAttribute('title')).toBeNull()

    await user.hover(filePath)
    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="tooltip-content"]')?.textContent,
      ).toBe('src/app.ts')
    })
  })
})
