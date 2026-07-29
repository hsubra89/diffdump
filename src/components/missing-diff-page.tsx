import { ErrorHero } from './error-hero'
import { HeroPageActions } from './github-repo-link'
import { Wordmark } from './wordmark'

export function MissingDiffPage() {
  return (
    <main className="relative grid min-h-screen text-foreground">
      <HeroPageActions />
      <ErrorHero
        className="justify-self-center"
        eyebrow="404"
        title="This diff is off the map."
        description="The link may be mistyped, expired, or never existed."
        actionLabel="Share a new diff"
      >
        <Wordmark className="mb-9" />
      </ErrorHero>
    </main>
  )
}
