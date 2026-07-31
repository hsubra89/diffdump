import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'

import { saveDiff } from '../lib/diffs.server'
import { handleDiffUpload } from '../server/diff-upload'

export const Route = createFileRoute('/d')({
  server: {
    handlers: {
      PUT: ({ request }) =>
        handleDiffUpload(request, {
          rateLimiter: env.DIFF_CREATION_RATE_LIMITER,
          saveUploadedDiff: ({ diff, source }) =>
            saveDiff(env.DIFFS, diff, { source }),
        }),
    },
  },
})
