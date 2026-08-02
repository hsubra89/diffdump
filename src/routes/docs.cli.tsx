import { createFileRoute } from '@tanstack/react-router'

import {
  GuideCode,
  GuideLinkCards,
  GuidePage,
  GuideSection,
} from '../components/guide-page'
import { createPageHead, createTechArticleStructuredData } from '../lib/seo'

const title = 'Install the Diffdump CLI and Review Git Changes | Diffdump'
const description =
  'Install ddd to open working-tree changes, commits, branches, and pull requests in Diffdump, or upload a patch directly with curl.'
const path = '/docs/cli' as const
const datePublished = '2026-07-29'
const dateModified = '2026-08-01'

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
      title="Open any Git change from your terminal."
      summary="Install the ddd shell command to open working-tree changes, commits, branches, and pull requests in Diffdump. Scripts and coding agents can still upload directly with curl."
      actionLabel="Open Diffdump"
      dateModified={dateModified}
    >
      <GuideSection title="Install or update ddd">
        <p>
          The installer places{' '}
          <code className="font-mono text-foreground">ddd</code> in{' '}
          <code className="font-mono text-foreground">~/.local/bin</code>, adds
          the directory to your Zsh path when necessary, and installs the{' '}
          <code className="font-mono text-foreground">ddc</code>,{' '}
          <code className="font-mono text-foreground">ddu</code>,{' '}
          <code className="font-mono text-foreground">ddp</code>, and{' '}
          <code className="font-mono text-foreground">ddb</code> shortcuts.
          Running it again updates the command.
        </p>
        <GuideCode>{`curl -fsSL https://diffdump.com/install | zsh`}</GuideCode>
        <p>
          The installer verifies the downloaded command with SHA-256 before
          replacing an existing installation. You can inspect the served{' '}
          <a
            className="text-accent-text underline underline-offset-2 hover:no-underline"
            href="/install"
          >
            installer
          </a>{' '}
          and{' '}
          <a
            className="text-accent-text underline underline-offset-2 hover:no-underline"
            href="/cli/ddd"
          >
            ddd command
          </a>{' '}
          before running them. The command requires Zsh, Git, and curl.{' '}
          <code className="font-mono text-foreground">ddd pr</code> and
          default-branch detection additionally require the GitHub CLI (
          <code className="font-mono text-foreground">gh</code>).
        </p>
      </GuideSection>

      <GuideSection title="Commands and shortcuts">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-panel text-foreground">
              <tr>
                <th className="border-b border-line px-4 py-3 font-medium">
                  Command
                </th>
                <th className="border-b border-line px-4 py-3 font-medium">
                  Shortcut
                </th>
                <th className="border-b border-line px-4 py-3 font-medium">
                  Opens
                </th>
              </tr>
            </thead>
            <tbody>
              <CommandRow
                command="ddd"
                shortcut="ddu"
                meaning="Staged, unstaged, and untracked changes."
              />
              <CommandRow
                command="ddd commit"
                shortcut="ddc"
                meaning="The latest commit only."
              />
              <CommandRow
                command="ddd pr"
                shortcut="ddp"
                meaning="The current GitHub pull request, without uploading a patch."
              />
              <CommandRow
                command="ddd branch"
                shortcut="ddb"
                meaning="The current branch against the default branch."
              />
              <CommandRow
                command="ddd from <ref>"
                shortcut="—"
                meaning="Working-tree changes since an arbitrary Git ref."
              />
            </tbody>
          </table>
        </div>
        <p>
          <code className="font-mono text-foreground">ddd</code> opens the URL
          automatically on macOS and prints it everywhere else. Run{' '}
          <code className="font-mono text-foreground">ddd help</code> for the
          command’s built-in reference.
        </p>
      </GuideSection>

      <GuideSection title="Use curl directly">
        <p>
          The CLI is a convenience wrapper around Diffdump’s HTTP endpoint. Send
          any unified diff with an HTTP PUT request; a successful upload returns
          the unlisted review URL as plain text.
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

      <GuideSection title="Expand context from GitHub">
        <p>
          Include the canonical GitHub repository and the full base commit SHA
          to enable on-demand expansion of unchanged lines. Diffdump keeps the
          patch as the request body.
        </p>
        <GuideCode>{`BASE_SHA=$(git rev-parse HEAD)
git -c core.quotepath=off diff --full-index --binary "$BASE_SHA" |
  curl -T- \\
    -H "X-Diffdump-GitHub-Repo: org/repository" \\
    -H "X-Diffdump-Base-Sha: $BASE_SHA" \\
    https://diffdump.com/d`}</GuideCode>
        <p>
          The viewer fetches a requested base file directly from GitHub only
          after an expansion click, then applies the patch in the browser.
          Public repositories work anonymously. Private repositories use a
          GitHub token saved in that viewer’s browser.{' '}
          <code className="font-mono text-foreground">core.quotepath=off</code>{' '}
          keeps non-ASCII file paths literal in the patch so their context stays
          expandable.
        </p>
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
                meaning="The body or optional GitHub base metadata was invalid."
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

function CommandRow({
  command,
  meaning,
  shortcut,
}: {
  command: string
  meaning: string
  shortcut: string
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3 font-mono text-foreground">{command}</td>
      <td className="px-4 py-3 font-mono text-foreground">{shortcut}</td>
      <td className="px-4 py-3 text-muted-bright">{meaning}</td>
    </tr>
  )
}
