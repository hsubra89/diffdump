import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'

import {
  validateCreateDiffInput,
  validateShareSlug,
} from '../lib/diffs'
import { loadDiff, saveDiff } from '../lib/diffs.server'

export const createDiff = createServerFn({ method: 'POST' })
  .validator(validateCreateDiffInput)
  .handler(async ({ data }) => saveDiff(env.DIFFS, data.diff))

export const getDiff = createServerFn({ method: 'GET' })
  .validator(validateShareSlug)
  .handler(async ({ data: slug }) => loadDiff(env.DIFFS, slug))
