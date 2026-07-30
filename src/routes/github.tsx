import { createFileRoute } from '@tanstack/react-router'

import { GitHubDiffPage } from '../components/github-diff-page'
import { createNoIndexPageHead } from '../lib/seo'

export const Route = createFileRoute('/github')({
  ssr: false,
  validateSearch: (search): { url: string } => ({
    url: typeof search.url === 'string' ? search.url : '',
  }),
  head: () =>
    createNoIndexPageHead({
      title: 'Private GitHub diff — Diffdump',
      description:
        'Review a private GitHub code change in Diffdump’s focused, syntax-highlighted diff viewer.',
    }),
  component: GitHubSearchPage,
})

function GitHubSearchPage() {
  const { url } = Route.useSearch()

  return <GitHubDiffPage url={url} />
}
