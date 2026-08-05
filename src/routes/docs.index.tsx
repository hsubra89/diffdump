import { createFileRoute } from '@tanstack/react-router'

import {
  GuideLinkCards,
  GuidePage,
  GuideSection,
} from '../components/guide-page'
import { createPageHead } from '../lib/seo'

const title = 'Diffdump Documentation | Review and Share Git Diffs'
const description =
  'Learn how to review GitHub pull requests, share expiring Git diff links, and open local repository changes with the Diffdump CLI.'
const path = '/docs' as const
const dateModified = '2026-08-05'

export const Route = createFileRoute('/docs/')({
  head: () => createPageHead({ title, description, path }),
  component: DocsIndex,
})

function DocsIndex() {
  return (
    <GuidePage
      eyebrow="Documentation"
      title="Review code changes with less friction."
      summary="Choose a workflow for opening GitHub changes, sharing a raw patch, or sending local Git changes to Diffdump from your terminal."
      actionLabel="Open Diffdump"
      dateModified={dateModified}
    >
      <GuideSection title="Choose a workflow">
        <p>
          Each guide covers a complete path from a code change to a focused,
          shareable review in Diffdump.
        </p>
        <GuideLinkCards />
      </GuideSection>
    </GuidePage>
  )
}
