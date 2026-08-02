import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { IconArrowUpRight, IconCheck, IconCopy } from '@pierre/icons'

import { GitHubOpenPanel } from '../components/github-open-panel'
import { SiteFooter, SiteHeader } from '../components/site-chrome'
import { Button } from '../components/ui/button'
import { eyebrowClassName } from '../components/ui/surfaces'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { cn } from '../lib/cn'
import { createSharedDiff } from '../lib/create-shared-diff'
import { MAX_DIFF_BYTES } from '../lib/diffs'
import { EXAMPLE_DIFF, EXAMPLE_GITHUB_URL } from '../lib/example-diff'
import { createPageHead, createWebApplicationStructuredData } from '../lib/seo'

type CommandCopyState = 'idle' | 'armed' | 'full'
type PanelTab = 'paste' | 'github'

const title = 'Diffdump — Review and Share Code Changes'
const description =
  'Review any GitHub pull request, commit, or comparison in a fast, focused diff viewer, or create an unlisted 24-hour link for a raw Git diff.'

export const Route = createFileRoute('/')({
  head: () => ({
    ...createPageHead({
      title,
      description,
      path: '/',
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(
          createWebApplicationStructuredData(description),
        ),
      },
    ],
  }),
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<PanelTab>('github')
  const [diff, setDiff] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [siteOrigin, setSiteOrigin] = useState('')
  const [commandCopyState, setCommandCopyState] =
    useState<CommandCopyState>('idle')
  const commandCopyTimer = useRef<number | null>(null)
  const copyWindowEndsAt = useRef(0)
  const copyInFlight = useRef(false)
  const byteLength = new TextEncoder().encode(diff).byteLength
  const uploadUrl = siteOrigin ? `${siteOrigin}/d` : '/d'
  const uploadCommand = `git diff | curl -T- ${uploadUrl}`
  const uploadAndOpenCommand = `${uploadCommand} | xargs open`

  useEffect(() => {
    setSiteOrigin(window.location.origin)

    return () => {
      if (commandCopyTimer.current !== null) {
        window.clearTimeout(commandCopyTimer.current)
      }
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const { slug } = await createSharedDiff(diff)
      await navigate({
        to: '/view/$slug',
        params: { slug },
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Something went wrong while creating the share link.',
      )
      setIsSubmitting(false)
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  async function copyTerminalCommand() {
    if (copyInFlight.current) {
      return
    }

    copyInFlight.current = true
    const includeOpen = Date.now() < copyWindowEndsAt.current

    try {
      await navigator.clipboard.writeText(
        includeOpen ? uploadAndOpenCommand : uploadCommand,
      )

      if (commandCopyTimer.current !== null) {
        window.clearTimeout(commandCopyTimer.current)
      }

      if (includeOpen) {
        copyWindowEndsAt.current = 0
        setCommandCopyState('full')
        commandCopyTimer.current = window.setTimeout(() => {
          setCommandCopyState('idle')
          commandCopyTimer.current = null
        }, 1800)
      } else {
        copyWindowEndsAt.current = Date.now() + 5000
        setCommandCopyState('armed')
        commandCopyTimer.current = window.setTimeout(() => {
          copyWindowEndsAt.current = 0
          setCommandCopyState('idle')
          commandCopyTimer.current = null
        }, 5000)
      }
    } catch {
      if (commandCopyTimer.current !== null) {
        window.clearTimeout(commandCopyTimer.current)
        commandCopyTimer.current = null
      }
      copyWindowEndsAt.current = 0
      setCommandCopyState('idle')
    } finally {
      copyInFlight.current = false
    }
  }

  return (
    <main className="mx-auto min-h-screen w-[min(1120px,calc(100%-32px))] pt-5 pb-6 text-foreground md:pt-7">
      <SiteHeader />

      <section className="pt-16 pb-10 md:pt-24 md:pb-12">
        <h1 className="max-w-[900px] text-[clamp(42px,13vw,64px)] font-[560] leading-[0.98] tracking-[-0.04em] md:text-[clamp(52px,7vw,88px)]">
          Any pull request.
          <br />
          <span className="text-muted-foreground">One clean review.</span>
        </h1>
        <p className="mt-6 max-w-[610px] text-base leading-relaxed text-muted-bright md:mt-8 md:text-lg">
          Open any GitHub pull request, commit, or comparison in a fast, focused
          review view — no account, nothing uploaded. Raw diff instead? Paste it
          for a clean, unlisted share link.
        </p>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === 'github' || value === 'paste') setActiveTab(value)
        }}
        render={<section aria-labelledby="panel-section-title" />}
      >
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <h2
            id="panel-section-title"
            className={cn(eyebrowClassName, 'text-accent-text')}
          >
            {activeTab === 'github'
              ? 'Review a GitHub diff'
              : 'Create a shared diff'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {activeTab === 'github'
              ? 'Public repos work instantly — private ones ask for a token when needed.'
              : 'Paste or pipe a patch to create an expiring, unlisted link.'}
          </p>
        </div>

        <div className="overflow-hidden rounded-panel border border-line bg-panel shadow-soft">
          <div className="flex min-h-12 items-stretch justify-between border-b border-line bg-canvas pr-3 font-mono text-xs text-muted-foreground">
            <div className="flex min-w-0 items-stretch">
              <span
                className="hidden items-center gap-1.5 px-4 sm:flex"
                aria-hidden="true"
              >
                <i className="size-[7px] rounded-full bg-line-bright" />
                <i className="size-[7px] rounded-full bg-muted-foreground" />
                <i className="size-[7px] rounded-full bg-muted-bright" />
              </span>
              <TabsList
                aria-label="Diff source"
                className="flex items-stretch"
                activateOnFocus
              >
                <TabsTrigger
                  className="-mb-px border-b-2 border-transparent px-3.5 transition-colors hover:text-foreground data-active:border-primary data-active:text-foreground"
                  value="github"
                >
                  github.com/…
                </TabsTrigger>
                <TabsTrigger
                  className="-mb-px border-b-2 border-transparent px-3.5 transition-colors hover:text-foreground data-active:border-primary data-active:text-foreground"
                  value="paste"
                >
                  diff.patch
                </TabsTrigger>
              </TabsList>
            </div>
            <Button
              variant="ghost"
              size="xs"
              className="self-center font-mono"
              onClick={() => {
                if (activeTab === 'github') {
                  setGithubUrl(EXAMPLE_GITHUB_URL)
                } else {
                  setDiff(EXAMPLE_DIFF)
                  setError(null)
                }
              }}
            >
              <span className="sm:hidden">Example</span>
              <span className="hidden sm:inline">Load example</span>
            </Button>
          </div>

          <TabsContent value="github">
            <GitHubOpenPanel url={githubUrl} onUrlChange={setGithubUrl} />
          </TabsContent>

          <TabsContent value="paste">
            <form onSubmit={handleSubmit}>
              <textarea
                className="block min-h-[300px] w-full resize-y border-0 bg-panel px-5 py-5 font-mono text-xs leading-[1.7] text-foreground caret-accent-text outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent-text md:min-h-80 md:px-6 md:py-6 md:text-[13px]"
                id="diff-input"
                name="diff"
                value={diff}
                onChange={(event) => {
                  setDiff(event.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={handleEditorKeyDown}
                placeholder={`diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@\n ...paste your diff here`}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Unified diff"
                aria-describedby="diff-help diff-security diff-error"
              />

              <div className="flex min-h-[72px] flex-col items-stretch justify-between gap-5 border-t border-line bg-canvas px-4 py-3.5 md:flex-row md:items-center md:pl-5">
                <div>
                  <p id="diff-help" className="text-xs text-muted-foreground">
                    Unlisted · Expires after 24 hours · 2 MiB max
                  </p>
                  <p
                    id="diff-security"
                    className="mt-1 max-w-[590px] text-xs leading-snug text-muted-foreground"
                  >
                    Anyone with the link can view this diff — remove secrets
                    before sharing.
                  </p>
                  <p
                    id="diff-error"
                    className="mt-1.5 max-w-[560px] text-xs text-danger empty:hidden"
                    role="alert"
                    aria-live="polite"
                  >
                    {error}
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 md:justify-start">
                  <span
                    className={cn(
                      'min-w-[55px] text-right font-mono text-[11px] text-muted-foreground',
                      byteLength > MAX_DIFF_BYTES && 'text-danger',
                    )}
                  >
                    {formatBytes(byteLength)}
                  </span>
                  <Button
                    className="min-w-[150px]"
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating link…' : 'Create share link'}
                    {!isSubmitting && <IconArrowUpRight aria-hidden="true" />}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>
        </div>

        {activeTab === 'github' ? (
          <section
            className="mt-4 grid grid-cols-1 items-center gap-3 rounded-panel border border-line bg-panel/60 p-4 md:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] md:gap-6"
            aria-labelledby="address-bar-title"
          >
            <div>
              <p
                id="address-bar-title"
                className={cn(eyebrowClassName, 'text-muted-bright')}
              >
                From the address bar
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Swap <code className="font-mono">github.com</code> for{' '}
                <code className="font-mono">diffdump.com</code> on any pull
                request, commit, or comparison URL.
              </p>
            </div>
            <div className="min-w-0 rounded-control border border-line bg-canvas px-3 py-1.5">
              <code className="font-mono text-xs leading-[1.7] [overflow-wrap:anywhere]">
                <span className="text-muted-foreground line-through">
                  github.com
                </span>
                <span className="text-muted-foreground" aria-hidden="true">
                  {' → '}
                </span>
                <span className="text-accent-text">diffdump.com</span>
                <span className="text-foreground">/org/repo/pull/123</span>
              </code>
            </div>
          </section>
        ) : (
          <section
            className="mt-4 grid grid-cols-1 items-center gap-3 rounded-panel border border-line bg-panel/60 p-4 md:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] md:gap-6"
            aria-labelledby="terminal-upload-title"
          >
            <div>
              <p
                id="terminal-upload-title"
                className={cn(eyebrowClassName, 'text-muted-bright')}
              >
                From your terminal
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pipe working-tree changes straight to a share link.
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 py-1.5">
                <code className="font-mono text-xs leading-[1.7] text-foreground [overflow-wrap:anywhere]">
                  <span
                    className="select-none text-muted-foreground"
                    aria-hidden="true"
                  >
                    ${' '}
                  </span>
                  {uploadCommand}
                  <span className="text-muted-foreground"> | xargs open</span>
                </code>
              </div>
              <Button
                className="min-w-[100px] md:min-w-28"
                variant="secondary"
                size="sm"
                onClick={copyTerminalCommand}
                disabled={!siteOrigin}
                aria-live="polite"
                aria-label={
                  commandCopyState === 'armed'
                    ? 'Copy command including the pipe to open its returned URL'
                    : commandCopyState === 'full'
                      ? 'Command including the pipe to open its returned URL copied'
                      : 'Copy terminal command'
                }
                title={
                  commandCopyState === 'armed'
                    ? 'Click again within five seconds to include “| xargs open”'
                    : undefined
                }
              >
                <span className="text-accent-text" aria-hidden="true">
                  {commandCopyState === 'idle' ? <IconCopy /> : <IconCheck />}
                </span>
                {commandCopyState === 'armed'
                  ? 'Copy + open'
                  : commandCopyState === 'full'
                    ? 'Copied + open'
                    : 'Copy'}
              </Button>
            </div>
          </section>
        )}
      </Tabs>

      <div className="pt-10">
        <SiteFooter />
      </div>
    </main>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KiB`
}
