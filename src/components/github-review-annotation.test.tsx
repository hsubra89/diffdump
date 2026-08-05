// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GitHubCommentBody } from './github-review-annotation'
import { TooltipProvider } from './ui/tooltip'
import type { GitHubReviewComment } from '../lib/review-comments'

afterEach(cleanup)

describe('GitHubCommentBody', () => {
  it('shows the full timestamp and GitHub action in a shared tooltip', async () => {
    const createdAt = '2026-07-30T12:00:00Z'
    const fullTimestamp = new Date(createdAt).toLocaleString()
    const comment: GitHubReviewComment = {
      kind: 'github',
      id: 1,
      pullRequestReviewId: 10,
      inReplyToId: null,
      path: 'src/app.ts',
      body: 'Please rename this.',
      author: {
        login: 'octocat',
        avatarUrl: '',
        htmlUrl: 'https://github.com/octocat',
      },
      createdAt,
      htmlUrl: 'https://github.com/hsyntax/diffdump/pull/16#discussion_r1',
      range: {
        start: 42,
        side: 'additions',
        end: 42,
        endSide: 'additions',
      },
      outdated: false,
    }

    render(
      <TooltipProvider delay={0}>
        <GitHubCommentBody comment={comment} />
      </TooltipProvider>,
    )

    const dateLink = screen.getByRole('link', {
      name: `Open comment from ${fullTimestamp} on GitHub`,
    })
    const time = dateLink.querySelector('time')

    expect(dateLink.getAttribute('href')).toBe(comment.htmlUrl)
    expect(dateLink.getAttribute('data-slot')).toBe('tooltip-trigger')
    expect(dateLink.getAttribute('title')).toBeNull()
    expect(time?.getAttribute('dateTime')).toBe(createdAt)
    expect(time?.getAttribute('title')).toBeNull()

    dateLink.focus()
    await waitFor(() => {
      expect(
        screen.getByText(`${fullTimestamp} · Open on GitHub`),
      ).not.toBeNull()
    })
  })
})
