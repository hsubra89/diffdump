import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { IconArrowUpRight } from '@pierre/icons'

import { SiteFooter, SiteHeader } from './site-chrome'
import { buttonVariants } from './ui/button'
import { eyebrowClassName } from './ui/surfaces'
import { cn } from '../lib/cn'

type GuidePageProps = {
  actionLabel: string
  children: ReactNode
  dateModified: string
  eyebrow: string
  summary: string
  title: string
}

export function GuidePage({
  actionLabel,
  children,
  dateModified,
  eyebrow,
  summary,
  title,
}: GuidePageProps) {
  return (
    <main className="mx-auto min-h-screen w-[min(1120px,calc(100%-32px))] pt-5 pb-8 text-foreground md:pt-7">
      <SiteHeader />

      <article className="mx-auto max-w-[820px] pt-14 md:pt-20">
        <header className="border-b border-line pb-10 md:pb-12">
          <p className={cn(eyebrowClassName, 'mb-5 text-accent-text')}>
            {eyebrow}
          </p>
          <h1 className="max-w-[780px] text-[clamp(40px,8vw,72px)] font-[560] leading-[0.98] tracking-[-0.04em]">
            {title}
          </h1>
          <p className="mt-6 max-w-[720px] text-base leading-relaxed text-muted-bright md:text-lg">
            {summary}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Updated{' '}
            <time dateTime={dateModified}>{formatGuideDate(dateModified)}</time>
          </p>
          <Link
            className={cn(
              buttonVariants({ variant: 'primary', size: 'sm' }),
              'mt-7',
            )}
            to="/"
          >
            {actionLabel}
            <IconArrowUpRight aria-hidden="true" />
          </Link>
        </header>

        <div className="space-y-12 py-10 md:space-y-16 md:py-14">
          {children}
        </div>
      </article>

      <SiteFooter />
    </main>
  )
}

function formatGuideDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function GuideSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section>
      <h2 className="text-2xl font-[560] tracking-[-0.025em] md:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-muted-bright">
        {children}
      </div>
    </section>
  )
}

export function GuideCode({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-panel border border-line bg-panel px-4 py-3.5 text-sm leading-6 text-foreground">
      <code>{children}</code>
    </pre>
  )
}

export function GuideLinkCards({
  current,
}: {
  current?: 'cli' | 'github' | 'share'
}) {
  const links = [
    {
      id: 'github',
      to: '/docs/github-diff-viewer',
      title: 'Review a GitHub diff',
      description: 'Open pull requests, commits, and comparisons.',
    },
    {
      id: 'share',
      to: '/docs/share-git-diff',
      title: 'Share a raw diff',
      description: 'Create an unlisted link that expires after 24 hours.',
    },
    {
      id: 'cli',
      to: '/docs/cli',
      title: 'Use the CLI workflow',
      description: 'Install ddd or pipe a patch from any Git repository.',
    },
  ] as const

  return (
    <nav
      className="grid gap-3 md:grid-cols-2"
      aria-label={
        current ? 'Related Diffdump documentation' : 'Diffdump documentation'
      }
    >
      {links
        .filter((link) => link.id !== current)
        .map((link) => (
          <Link
            key={link.id}
            className="rounded-panel border border-line bg-panel p-4 transition-colors hover:border-line-bright hover:bg-surface-raised"
            to={link.to}
          >
            <span className="font-medium text-foreground">{link.title}</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              {link.description}
            </span>
          </Link>
        ))}
    </nav>
  )
}
