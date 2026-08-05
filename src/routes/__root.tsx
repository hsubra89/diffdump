import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { MissingDiffPage } from '../components/missing-diff-page'
import { TooltipProvider } from '../components/ui/tooltip'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        title: 'Diffdump',
      },
      {
        name: 'description',
        content:
          'Review GitHub pull requests and raw code changes with automatic file categories and stacked PR navigation.',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: light)',
        content: '#f7f7f8',
      },
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: dark)',
        content: '#09090b',
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
        <TooltipProvider>{children}</TooltipProvider>

        <Scripts />
      </body>
    </html>
  )
}
