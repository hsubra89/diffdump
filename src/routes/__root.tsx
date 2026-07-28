import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import { buttonVariants } from '../components/ui/button'
import { Wordmark } from '../components/wordmark'
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
  notFoundComponent: NotFoundPage,
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

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-[min(580px,calc(100%-40px))] flex-col items-start justify-center text-foreground">
      <Wordmark className="mb-9" />
      <p className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-bright">
        404
      </p>
      <h1 className="mb-3.5 text-[clamp(38px,7vw,62px)] leading-[0.98] tracking-[-0.055em]">
        This diff is off the map.
      </h1>
      <p className="mb-7 leading-relaxed text-muted-bright">
        The link may be mistyped, expired, or never existed.
      </p>
      <Link
        className={buttonVariants({ variant: 'primary', size: 'md' })}
        to="/"
      >
        Share a new diff
      </Link>
    </main>
  )
}
