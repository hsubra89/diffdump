import { createFileRoute, notFound } from '@tanstack/react-router'

import { GitHubDiffPage } from '../components/github-diff-page'
import { createGitHubUrlFromPath } from '../lib/github-diffs'

export const Route = createFileRoute('/$')({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (!params._splat) {
      throw notFound()
    }

    const githubUrl = createGitHubUrlFromPath(params._splat)

    if (!githubUrl) {
      throw notFound()
    }

    return { githubUrl }
  },
  head: () => ({
    meta: [
      {
        title: 'GitHub diff — Diffdump',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
  component: DirectGitHubDiffPage,
})

function DirectGitHubDiffPage() {
  const { githubUrl } = Route.useRouteContext()

  return <GitHubDiffPage url={githubUrl} />
}
