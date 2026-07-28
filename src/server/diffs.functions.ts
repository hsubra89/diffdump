import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'

import { validateShareSlug } from '../lib/diffs'
import { loadDiff } from '../lib/diffs.server'

export const getDiff = createServerFn({ method: 'GET' })
  .validator(validateShareSlug)
  .handler(async ({ data: slug }) => loadDiff(env.DIFFS, slug))
