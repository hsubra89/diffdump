import { createFileRoute, redirect } from '@tanstack/react-router'

const destination = '/docs/share-git-diff'

export const Route = createFileRoute('/share-git-diff')({
  beforeLoad: () => {
    throw redirect({ href: destination, statusCode: 301 })
  },
})
