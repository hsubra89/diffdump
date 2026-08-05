import { Link } from '@tanstack/react-router'

import { GitHubRepoLink } from './github-repo-link'
import { ThemeToggle } from './ui/theme-toggle'
import { Wordmark } from './wordmark'

const guideLinks = [
  { to: '/docs/github-diff-viewer', label: 'GitHub viewer' },
  { to: '/docs/share-git-diff', label: 'Share a diff' },
  { to: '/docs/cli', label: 'CLI' },
] as const

export function SiteHeader() {
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3"
      aria-label="Primary navigation"
    >
      <Wordmark />

      <div className="flex items-center gap-1.5">
        <div className="hidden items-center sm:flex">
          {guideLinks.map((link) => (
            <Link
              key={link.to}
              className="rounded-control px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
              activeProps={{
                className:
                  'rounded-control bg-surface-raised px-2.5 py-1.5 text-xs text-foreground',
              }}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <GitHubRepoLink />
        <ThemeToggle />
      </div>

      <div className="order-3 flex w-full items-center gap-1 sm:hidden">
        {guideLinks.map((link) => (
          <Link
            key={link.to}
            className="rounded-control px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            activeProps={{
              className:
                'rounded-control bg-surface-raised px-2.5 py-1.5 text-xs text-foreground',
            }}
            to={link.to}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-4 border-t border-line px-1 pt-6 text-[11px] text-muted md:flex-row md:items-center md:justify-between">
      <nav
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
        aria-label="Documentation"
      >
        {guideLinks.map((link) => (
          <Link
            key={link.to}
            className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
            to={link.to}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <span>
        Powered by <FooterLink href="https://diffs.com">diffs.com</FooterLink> +{' '}
        <FooterLink href="https://trees.software">trees.software</FooterLink> ·
        Deployed on{' '}
        <FooterLink href="https://workers.cloudflare.com">
          Cloudflare Workers
        </FooterLink>{' '}
        +{' '}
        <FooterLink href="https://developers.cloudflare.com/r2/">R2</FooterLink>
      </span>
    </footer>
  )
}

function FooterLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  )
}
