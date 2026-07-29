import { buttonVariants } from './ui/button'
import { ThemeToggle } from './ui/theme-toggle'
import { cn } from '../lib/cn'

export const DIFFDUMP_REPO_URL = 'https://github.com/hsubra89/diffdump'

/** Icon link to the Diffdump source repository, styled as header chrome so it
 * reads as part of the app rather than a content action. */
export function GitHubRepoLink({ className }: { className?: string }) {
  return (
    <a
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'iconSm' }),
        className,
      )}
      href={DIFFDUMP_REPO_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Diffdump on GitHub"
      title="Diffdump on GitHub"
    >
      <svg
        className="size-4"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    </a>
  )
}

/** Repo link and theme toggle pinned to the top-right of hero pages that have
 * no header bar. The containing element must be positioned. */
export function HeroPageActions() {
  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 md:top-6 md:right-6">
      <GitHubRepoLink />
      <ThemeToggle />
    </div>
  )
}
