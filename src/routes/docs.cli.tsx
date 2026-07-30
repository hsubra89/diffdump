import { createFileRoute } from '@tanstack/react-router'

import {
  GuideCode,
  GuideLinkCards,
  GuidePage,
  GuideSection,
} from '../components/guide-page'
import { createPageHead, createTechArticleStructuredData } from '../lib/seo'

const title = 'Turn git diff into a Shareable URL from the Terminal | Diffdump'
const description =
  'Pipe working-tree, staged, or committed Git changes to Diffdump and receive an unlisted 24-hour review URL as plain text.'
const path = '/docs/cli' as const
const datePublished = '2026-07-29'
const dateModified = '2026-07-29'

export const Route = createFileRoute('/docs/cli')({
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
  component: CliGuide,
})

function CliGuide() {
  return (
    <GuidePage
      eyebrow="CLI workflow"
      title="Pipe a Git diff straight to a review URL."
      summary="Send a unified diff to Diffdump with an HTTP PUT request. A successful upload returns a clean, unlisted review URL as text, so the workflow composes naturally with Git, curl, shells, scripts, and coding agents."
      actionLabel="Open Diffdump"
      dateModified={dateModified}
    >
      <GuideSection title="Working-tree changes">
        <p>
          Upload changes that are not staged. The response body is the share
          URL.
        </p>
        <GuideCode>{`git diff | curl -T- https://diffdump.com/d`}</GuideCode>
      </GuideSection>

      <GuideSection title="Staged changes">
        <p>
          Add Git’s <code className="font-mono text-foreground">--cached</code>{' '}
          flag to review what the next commit will contain.
        </p>
        <GuideCode>{`git diff --cached | curl -T- https://diffdump.com/d`}</GuideCode>
      </GuideSection>

      <GuideSection title="A committed change">
        <p>
          Render the latest commit as a patch without the commit message, then
          upload it.
        </p>
        <GuideCode>{`git show --format= --patch HEAD | curl -T- https://diffdump.com/d`}</GuideCode>
      </GuideSection>

      <GuideSection title="Open the returned link">
        <p>
          Because the response is plain text, it can be passed directly to
          another command. On macOS:
        </p>
        <GuideCode>{`git diff | curl -T- https://diffdump.com/d | xargs open`}</GuideCode>
      </GuideSection>

      <GuideSection title="HTTP responses">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-panel text-foreground">
              <tr>
                <th className="border-b border-line px-4 py-3 font-medium">
                  Status
                </th>
                <th className="border-b border-line px-4 py-3 font-medium">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody>
              <ResponseRow
                status="201"
                meaning="Created; the body contains the share URL."
              />
              <ResponseRow
                status="400"
                meaning="The body was empty or not a unified diff."
              />
              <ResponseRow
                status="413"
                meaning="The patch exceeded the 2 MiB limit."
              />
              <ResponseRow
                status="429"
                meaning="The anonymous creation rate limit was reached."
              />
              <ResponseRow
                status="500"
                meaning="The diff could not be stored."
              />
            </tbody>
          </table>
        </div>
      </GuideSection>

      <GuideSection title="Security and expiry">
        <p>
          Uploads create unlisted URLs, not authenticated shares. Anyone with
          the link can view its contents until it expires after 24 hours. Remove
          secrets before uploading a patch.
        </p>
      </GuideSection>

      <GuideLinkCards current="cli" />
    </GuidePage>
  )
}

function ResponseRow({ status, meaning }: { status: string; meaning: string }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3 font-mono text-foreground">{status}</td>
      <td className="px-4 py-3 text-muted-bright">{meaning}</td>
    </tr>
  )
}
