import { createFileRoute, redirect } from '@tanstack/react-router'

const destination = '/docs/github-diff-viewer'

export const Route = createFileRoute('/github-diff-viewer')({
  beforeLoad: () => {
    throw redirect({ href: destination, statusCode: 301 })
  },
})
