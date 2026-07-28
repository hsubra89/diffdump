import { createFileRoute } from '@tanstack/react-router'

import { GitHubDiffPage } from '../components/github-diff-page'

export const Route = createFileRoute('/github')({
  ssr: false,
  validateSearch: (search): { url: string } => ({
    url: typeof search.url === 'string' ? search.url : '',
  }),
  head: () => ({
    meta: [
      {
        title: 'Private GitHub diff — Diffdump',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
  component: GitHubSearchPage,
})

function GitHubSearchPage() {
  const { url } = Route.useSearch()

  return <GitHubDiffPage url={url} />
}
