import { createFileRoute } from '@tanstack/react-router'

import { env } from '../env'
import { saveDiff } from '../lib/diffs.server'
import { handleDiffUpload } from '../server/diff-upload'

export const Route = createFileRoute('/d')({
  server: {
    handlers: {
      PUT: ({ request }) =>
        handleDiffUpload(request, (diff) => saveDiff(env.DIFFS, diff)),
    },
  },
})
