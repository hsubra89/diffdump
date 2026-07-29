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
        title: 'Diffdump — Review any GitHub diff',
      },
      {
        name: 'description',
        content:
          'Open any GitHub pull request, commit, or comparison in a clean, focused review view — or paste a git diff for an unlisted share link.',
      },
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: light)',
        content: '#f6f8fa',
      },
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: dark)',
        content: '#010409',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:title',
        content: 'Diffdump — Review any GitHub diff',
      },
      {
        property: 'og:description',
        content: 'Any pull request. One clean review.',
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
        content: 'Diffdump — Review any GitHub diff',
      },
      {
        name: 'twitter:description',
        content: 'Any pull request. One clean review.',
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
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180',
      },
    ],
  }),
  notFoundComponent: MissingDiffPage,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Applies the stored theme before first paint to avoid a flash
          // of the wrong color scheme.
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.classList.add(t)}catch(e){}`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}

        <Scripts />
      </body>
    </html>
  )
}
