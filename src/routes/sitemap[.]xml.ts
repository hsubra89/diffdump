import { createFileRoute } from '@tanstack/react-router'

import { createSitemapXml } from '../lib/sitemap'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(createSitemapXml(), {
          headers: {
            'Cache-Control': 'public, max-age=3600',
            'Content-Type': 'application/xml; charset=utf-8',
          },
        }),
    },
  },
})
