import * as cloudflare from 'cloudflare:workers'

import type { WebsiteEnv } from '../alchemy.run'

export const env = new Proxy({} as WebsiteEnv, {
  get: (_, property) =>
    (cloudflare.env as WebsiteEnv)[property as keyof WebsiteEnv],
})
