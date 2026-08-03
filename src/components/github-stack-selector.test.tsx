// @vitest-environment happy-dom

import { type ComponentProps, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import GitHubStackSelector, {
  type GitHubPullStackLoadState,
} from './github-stack-selector'
import { TooltipProvider } from './ui/tooltip'
import type {
  GitHubPullStack,
  GitHubPullStackSummary,
} from '../lib/github-diffs'

const router = vi.hoisted(() => ({
  navigate:
    vi.fn<(options: { to: string; params: { _splat: string } }) => void>(),
}))

type MockLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  children?: ReactNode
  params: { _splat: string }
  to: string
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to: _to, ...props }: MockLinkProps) => (
    <a href={`/${params._splat}`} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => router.navigate,
}))

vi.mock('@pierre/icons', () => ({
  IconArrow: () => null,
  IconArrowRight: () => null,
  IconArrowRightShort: () => null,
  IconCheck: () => null,
  IconChevronSm: () => null,
  IconCircle: () => null,
  IconDraft: () => null,
  IconMerged: () => null,
  IconX: () => null,
}))

afterEach(() => {
  cleanup()
  router.navigate.mockReset()
})

const summary: GitHubPullStackSummary = {
  number: 12,
  position: 2,
  size: 3,
  baseRef: 'main',
}

const stack: GitHubPullStack = {
  number: 12,
  baseRef: 'main',
  pullRequests: [
    {
      number: '101',
      title: 'Add parser',
      state: 'closed',
      draft: false,
      mergedAt: '2026-07-30T12:00:00Z',
      headRef: 'stack/parser',
      headSha: 'a'.repeat(40),
    },
    {
      number: '102',
      title: 'Wire viewer',
      state: 'open',
      draft: false,
      mergedAt: null,
      headRef: 'stack/viewer',
      headSha: 'b'.repeat(40),
    },
    {
      number: '103',
      title: 'Polish controls',
      state: 'open',
      draft: true,
      mergedAt: null,
      headRef: 'stack/controls',
      headSha: 'c'.repeat(40),
    },
  ],
}

function renderSelector(
  state: GitHubPullStackLoadState,
  onRetry = vi.fn<() => void>(),
) {
  return {
    onRetry,
    ...render(
      <TooltipProvider delay={0}>
        <GitHubStackSelector
          owner="hsyntax"
          repo="diffdump"
          pullNumber="102"
          summary={summary}
          state={state}
          onRetry={onRetry}
        />
      </TooltipProvider>,
    ),
  }
}

describe('GitHubStackSelector', () => {
  it('uses shared button styles and tooltips for navigation links', async () => {
    const user = userEvent.setup()
    renderSelector({ status: 'loaded', stack })

    const current = screen.getByTestId('github-stack-pull-102')
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.getAttribute('data-slot')).toBe('tooltip-trigger')
    expect(current.getAttribute('title')).toBeNull()
    expect(current.className).toContain('focus-visible:ring-2')

    current.focus()
    await waitFor(() => {
      expect(
        screen.getByText('Wire viewer · stack/viewer · Open'),
      ).not.toBeNull()
    })

    await user.keyboard('{Escape}')

    const baseRef = screen.getByLabelText('Stack base: main')
    expect(baseRef.getAttribute('title')).toBeNull()
    expect(baseRef.getAttribute('data-slot')).toBe('tooltip-trigger')

    await user.hover(baseRef)
    await waitFor(() => {
      expect(screen.getByText('Stack base: main')).not.toBeNull()
    })

    await user.unhover(baseRef)

    const previous = screen.getByRole('link', {
      name: 'Previous layer: pull request #101, Add parser',
    })
    expect(previous.getAttribute('href')).toBe('/hsyntax/diffdump/pull/101')
    expect(previous.getAttribute('title')).toBeNull()
    expect(previous.getAttribute('data-slot')).toBe('tooltip-trigger')

    previous.focus()
    await waitFor(() => {
      expect(screen.getByText('Previous layer: #101')).not.toBeNull()
    })
  })

  it('navigates to a keyboard-selected pull request', async () => {
    const user = userEvent.setup()
    renderSelector({ status: 'loaded', stack })

    const trigger = screen.getByRole('combobox', {
      name: 'Select a pull request in stack #12',
    })
    await user.click(trigger)
    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
    expect(router.navigate).toHaveBeenCalledWith({
      to: '/$',
      params: { _splat: 'hsyntax/diffdump/pull/103' },
    })
    expect(document.activeElement).toBe(trigger)
  })

  it('announces loading and renders unavailable step controls as inert', () => {
    renderSelector({ status: 'loading' })

    const selector = screen.getByTestId('github-stack-selector')
    expect(selector.getAttribute('aria-busy')).toBe('true')
    expect(
      screen.getByText('Loading navigation for pull request stack #12.'),
    ).not.toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('exposes the load error and retries through the shared button', async () => {
    const user = userEvent.setup()
    const { onRetry } = renderSelector({
      status: 'error',
      message: 'GitHub rate limit reached.',
    })

    expect(
      screen.getByText(
        'GitHub rate limit reached. Stack navigation is unavailable.',
      ),
    ).not.toBeNull()

    const retryButtons = screen.getAllByRole('button', { name: 'Retry' })
    expect(retryButtons).toHaveLength(2)
    expect(retryButtons[0].getAttribute('data-slot')).toBe('button')
    expect(retryButtons[0].getAttribute('aria-describedby')).toBe(
      'github-stack-status-12',
    )

    const mobileError = screen.getByLabelText(
      'Layer 2 of 3 · Stack unavailable: GitHub rate limit reached.',
    )
    const desktopError = screen.getByLabelText('GitHub rate limit reached.')
    expect(mobileError.getAttribute('title')).toBeNull()
    expect(desktopError.getAttribute('title')).toBeNull()
    expect(mobileError.getAttribute('data-slot')).toBe('tooltip-trigger')
    expect(desktopError.getAttribute('data-slot')).toBe('tooltip-trigger')

    await user.click(retryButtons[0])
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
