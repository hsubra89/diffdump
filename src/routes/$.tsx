import { createFileRoute, notFound } from '@tanstack/react-router'

import { GitHubDiffPage } from '../components/github-diff-page'
import { createGitHubUrlFromPath } from '../lib/github-diffs'
import { createNoIndexPageHead } from '../lib/seo'

export const Route = createFileRoute('/$')({
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
  head: () =>
    createNoIndexPageHead({
      title: 'GitHub diff — Diffdump',
      description:
        'Review this GitHub code change in Diffdump’s focused, syntax-highlighted diff viewer.',
    }),
  component: DirectGitHubDiffPage,
})

function DirectGitHubDiffPage() {
  const { githubUrl } = Route.useRouteContext()

  return <GitHubDiffPage url={githubUrl} />
}
