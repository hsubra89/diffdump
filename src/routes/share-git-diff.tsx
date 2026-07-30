import { createFileRoute } from '@tanstack/react-router'

import {
  GuideCode,
  GuideLinkCards,
  GuidePage,
  GuideSection,
} from '../components/guide-page'
import { createPageHead, createTechArticleStructuredData } from '../lib/seo'

const title = 'Share a Git Diff Online with an Expiring Link | Diffdump'
const description =
  'Paste or pipe a unified Git diff to create a clean, unlisted review link that expires automatically after 24 hours.'
const path = '/share-git-diff' as const
const datePublished = '2026-07-29'
const dateModified = '2026-07-29'

export const Route = createFileRoute('/share-git-diff')({
  head: () => ({
    ...createPageHead({ title, description, path, ogType: 'article' }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(
          createTechArticleStructuredData({
            title,
            description,
            path,
            datePublished,
            dateModified,
          }),
        ),
      },
    ],
  }),
  component: ShareGitDiffGuide,
})

function ShareGitDiffGuide() {
  return (
    <GuidePage
      eyebrow="Share a Git diff"
      title="Turn a raw patch into a clean review link."
      summary="Diffdump turns a unified Git diff into an unlisted browser view with syntax highlighting, file navigation, and split or unified layouts. Share links use random URLs, accept patches up to 2 MiB, and expire after 24 hours."
      actionLabel="Create a share link"
      dateModified={dateModified}
    >
      <GuideSection title="Share a diff from the browser">
        <ol className="list-decimal space-y-3 pl-5 marker:text-muted">
          <li>
            Open Diffdump and select the{' '}
            <code className="font-mono text-foreground">diff.patch</code> tab.
          </li>
          <li>Paste a UTF-8 unified diff into the editor.</li>
          <li>
            Create the link, review the rendered patch, and send the URL to your
            reviewer.
          </li>
        </ol>
      </GuideSection>

      <GuideSection title="Share a diff from the terminal">
        <p>
          Send the working-tree patch with one command. Diffdump returns the new
          share URL as plain text.
        </p>
        <GuideCode>{`git diff | curl -T- https://diffdump.com/d`}</GuideCode>
        <p>
          On macOS, append{' '}
          <code className="font-mono text-foreground">| xargs open</code> to
          open the returned URL immediately.
        </p>
        <GuideCode>{`git diff | curl -T- https://diffdump.com/d | xargs open`}</GuideCode>
      </GuideSection>

      <GuideSection title="What is stored?">
        <p>
          Raw shared diffs are stored in a private Cloudflare R2 bucket under a
          random 96-bit URL slug. Diffdump enforces the 24-hour expiry when the
          link is read, and the storage lifecycle removes expired objects.
        </p>
        <p>
          Links are unlisted rather than access-controlled: anyone who has the
          URL can open the diff. Remove credentials, private keys, and other
          secrets before sharing.
        </p>
      </GuideSection>

      <GuideSection title="What can be shared?">
        <ul className="list-disc space-y-2 pl-5 marker:text-muted">
          <li>Working-tree or staged changes from a Git repository.</li>
          <li>A commit exported as a unified patch.</li>
          <li>
            Multi-file <code className="font-mono text-foreground">.diff</code>{' '}
            and <code className="font-mono text-foreground">.patch</code>{' '}
            content up to 2 MiB.
          </li>
          <li>Agent-generated code changes that need human review.</li>
        </ul>
      </GuideSection>

      <GuideLinkCards current="share" />
    </GuidePage>
  )
}
