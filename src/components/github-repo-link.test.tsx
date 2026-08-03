// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DIFFDUMP_REPO_URL, GitHubRepoLink } from './github-repo-link'
import { TooltipProvider } from './ui/tooltip'

vi.mock('@pierre/icons', () => ({
  IconBrandGithub: () => null,
  IconColorAuto: () => null,
  IconMoon: () => null,
  IconSun: () => null,
}))

afterEach(cleanup)

describe('GitHubRepoLink', () => {
  it('uses the shared tooltip without a native title', async () => {
    const user = userEvent.setup()

    render(
      <TooltipProvider delay={0}>
        <GitHubRepoLink />
      </TooltipProvider>,
    )

    const link = screen.getByRole('link', { name: 'Diffdump on GitHub' })
    expect(link.getAttribute('href')).toBe(DIFFDUMP_REPO_URL)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('title')).toBeNull()
    expect(link.getAttribute('data-slot')).toBe('tooltip-trigger')

    await user.tab()
    await waitFor(() => {
      expect(screen.getByText('Diffdump on GitHub')).not.toBeNull()
    })
  })
})
