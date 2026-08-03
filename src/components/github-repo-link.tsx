import { IconBrandGithub } from '@pierre/icons'

import { buttonVariants } from './ui/button'
import { ThemeToggle } from './ui/theme-toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '../lib/cn'

export const DIFFDUMP_REPO_URL = 'https://github.com/hsyntax/diffdump'

/** Icon link to the Diffdump source repository, styled as header chrome so it
 * reads as part of the app rather than a content action. */
export function GitHubRepoLink({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'iconSm' }),
              className,
            )}
            href={DIFFDUMP_REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Diffdump on GitHub"
          />
        }
      >
        <IconBrandGithub aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Diffdump on GitHub</TooltipContent>
    </Tooltip>
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
