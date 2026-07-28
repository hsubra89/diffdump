import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { MissingDiffPage } from '../components/missing-diff-page'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Diffdump — Share a git diff',
      },
      {
        name: 'description',
        content:
          'Paste a git diff, create a private share link, and read it in a focused code review view.',
      },
      {
        name: 'theme-color',
        content: '#0d0f12',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:title',
        content: 'Diffdump — Share a git diff',
      },
      {
        property: 'og:description',
        content: 'Share a diff. Skip the ceremony.',
      },
      {
        property: 'og:image',
        content: '/og.png',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Diffdump — Share a git diff',
      },
      {
        name: 'twitter:description',
        content: 'Share a diff. Skip the ceremony.',
      },
      {
        name: 'twitter:image',
        content: '/og.png',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: MissingDiffPage,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}

        <Scripts />
      </body>
    </html>
  )
}
