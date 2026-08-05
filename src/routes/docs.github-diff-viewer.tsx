import { createFileRoute } from '@tanstack/react-router'

import {
  GuideCode,
  GuideLinkCards,
  GuidePage,
  GuideSection,
} from '../components/guide-page'
import { createPageHead, createTechArticleStructuredData } from '../lib/seo'

const title = 'GitHub Diff Viewer for Pull Requests | Diffdump'
const description =
  'Open any GitHub pull request, commit, or comparison in a fast, focused diff viewer with file navigation, split and unified layouts, and inline reviews.'
const path = '/docs/github-diff-viewer' as const
const datePublished = '2026-07-29'
const dateModified = '2026-08-05'

export const Route = createFileRoute('/docs/github-diff-viewer')({
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
  component: GitHubDiffViewerGuide,
})

function GitHubDiffViewerGuide() {
  return (
    <GuidePage
      eyebrow="GitHub diff viewer"
      title="Review a GitHub diff without the clutter."
      summary="Diffdump opens public and private GitHub pull requests, commits, and comparisons in a focused browser viewer. Paste a GitHub URL or replace github.com with diffdump.com; public diffs are fetched directly from GitHub and are not uploaded to Diffdump."
      actionLabel="Open a GitHub diff"
      dateModified={dateModified}
    >
      <GuideSection title="How to open a GitHub diff">
        <ol className="list-decimal space-y-3 pl-5 marker:text-muted">
          <li>
            Copy the URL for a GitHub pull request, commit, or comparison.
          </li>
          <li>
            Paste it into Diffdump, or replace the URL’s{' '}
            <code className="font-mono text-foreground">github.com</code>{' '}
            hostname with{' '}
            <code className="font-mono text-foreground">diffdump.com</code>.
          </li>
          <li>
            Browse the changed files, choose a unified or split layout, and
            review the patch.
          </li>
        </ol>
        <GuideCode>{`https://github.com/org/repo/pull/123
https://diffdump.com/org/repo/pull/123`}</GuideCode>
      </GuideSection>

      <GuideSection title="Supported GitHub URLs">
        <p>
          Diffdump accepts pull request, commit, and comparison URLs. Common
          pull-request suffixes such as{' '}
          <code className="font-mono text-foreground">/files</code> and{' '}
          <code className="font-mono text-foreground">/changes</code> are
          normalized automatically.
        </p>
        <GuideCode>{`https://github.com/org/repo/pull/123
https://github.com/org/repo/commit/0123abcd
https://github.com/org/repo/compare/main...feature`}</GuideCode>
      </GuideSection>

      <GuideSection title="What the viewer includes">
        <ul className="list-disc space-y-2 pl-5 marker:text-muted">
          <li>Syntax-highlighted, multi-file patch rendering.</li>
          <li>Unified and side-by-side layouts with optional line wrapping.</li>
          <li>
            A searchable file tree with source, test, docs, and other groups.
          </li>
          <li>
            A stack navigator for moving between the focused layers of a stacked
            pull request.
          </li>
          <li>Viewed-file progress saved locally in the browser.</li>
          <li>
            Inline pull-request comments and Comment, Approve, or Request
            changes review submission.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Does Diffdump upload GitHub diffs?">
        <p>
          No. GitHub diffs are requested by your browser directly from GitHub’s
          API and rendered locally. Diffdump does not receive or store the
          fetched diff or your review drafts.
        </p>
        <p>
          Private repositories and review submission require a GitHub personal
          access token. The token is stored in browser local storage and sent
          only to GitHub’s API.
        </p>
      </GuideSection>

      <GuideLinkCards current="github" />
    </GuidePage>
  )
}
