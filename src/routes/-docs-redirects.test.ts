import { describe, expect, it } from 'vitest'

import { Route as GitHubDiffViewerRoute } from './github-diff-viewer'
import { Route as ShareGitDiffRoute } from './share-git-diff'

describe('legacy documentation routes', () => {
  it.each([
    {
      route: GitHubDiffViewerRoute,
      destination: '/docs/github-diff-viewer',
    },
    { route: ShareGitDiffRoute, destination: '/docs/share-git-diff' },
  ])('permanently redirects to $destination', ({ route, destination }) => {
    const response = captureRedirect(() =>
      route.options.beforeLoad?.({} as never),
    )

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe(destination)
  })
})

function captureRedirect(loadRoute: () => unknown): Response {
  try {
    loadRoute()
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    throw error
  }

  throw new Error('Expected the route to throw a redirect response')
}
