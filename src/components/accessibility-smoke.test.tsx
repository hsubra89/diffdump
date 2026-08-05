// @vitest-environment happy-dom

import { type ComponentProps, type ReactNode } from 'react'
import axe from 'axe-core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GitHubOpenPanel } from './github-open-panel'
import SubmitReviewPanel from './submit-review-panel'

type MockLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  children?: ReactNode
  params: { _splat: string }
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, ...props }: MockLinkProps) => (
    <a href={`/${params._splat}`} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn<() => void>(),
}))

vi.mock('@pierre/icons', () => ({
  IconArrowUpRight: () => null,
  IconCheck: () => null,
}))

afterEach(cleanup)

async function getAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      /* happy-dom does not calculate layout or rendered colors. */
      'color-contrast': { enabled: false },
    },
  })

  return results.violations.map(({ id, nodes }) => ({
    id,
    targets: nodes.map((node) => node.target),
  }))
}

describe('primary control accessibility smoke', () => {
  it('has no detectable semantic violations in the GitHub open form', async () => {
    const { container } = render(
      <GitHubOpenPanel url="" onUrlChange={() => undefined} />,
    )

    expect(await getAxeViolations(container)).toEqual([])
  })

  it('has no detectable semantic violations in the review form', async () => {
    const { container } = render(
      <SubmitReviewPanel
        draftCount={1}
        submitState={{ phase: 'idle' }}
        reviewUrl={null}
        pullRequestUrl={null}
        onSubmit={() => undefined}
        onReloadDiff={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(await getAxeViolations(container)).toEqual([])
  })
})
