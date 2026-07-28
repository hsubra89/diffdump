import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { Button } from '../components/ui/button'
import { ThemeToggle } from '../components/ui/theme-toggle'
import { Wordmark } from '../components/wordmark'
import { cn } from '../lib/cn'
import { MAX_DIFF_BYTES } from '../lib/diffs'
import { createDiff } from '../server/diffs.functions'

type CommandCopyState = 'idle' | 'armed' | 'full'

const EXAMPLE_DIFF = `diff --git a/src/greeting.ts b/src/greeting.ts
index ce01362..cc628cc 100644
--- a/src/greeting.ts
+++ b/src/greeting.ts
@@ -1,3 +1,5 @@
 export function greeting(name: string) {
-  return \`Hello, \${name}.\`
+  const hour = new Date().getHours()
+  const salutation = hour < 12 ? 'Good morning' : 'Hello'
+  return \`\${salutation}, \${name}.\`
 }
`

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {
        title: 'Diffdump — Share a git diff',
      },
    ],
  }),
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const createDiffFn = useServerFn(createDiff)
  const [diff, setDiff] = useState('')
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
      const { slug } = await createDiffFn({ data: { diff } })
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
      <nav
        className="flex items-center justify-between"
        aria-label="Primary navigation"
      >
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.04em] text-muted md:inline">
            Tiny links for big changes
          </span>
          <ThemeToggle />
        </div>
      </nav>

      <section className="pt-16 pb-10 md:pt-24 md:pb-12">
        <h1 className="max-w-[900px] text-[clamp(42px,13vw,64px)] font-semibold leading-[0.98] tracking-[-0.04em] md:text-[clamp(52px,7vw,88px)]">
          Share a diff.
          <br />
          <span className="text-muted">Skip the ceremony.</span>
        </h1>
        <p className="mt-6 max-w-[610px] text-base leading-relaxed text-muted-bright md:mt-8 md:text-lg">
          Paste a unified git diff and get a focused, unlisted review link in
          seconds. No account. No repository access.
        </p>
      </section>

      <form
        className="overflow-hidden rounded-panel border border-line bg-panel shadow-[0_16px_40px_light-dark(rgb(0_0_0/5%),rgb(0_0_0/35%))]"
        onSubmit={handleSubmit}
      >
        <div className="flex min-h-12 items-center justify-between border-b border-line bg-canvas px-4 font-mono text-xs text-muted">
          <div className="flex items-center gap-4">
            <span className="flex gap-1.5" aria-hidden="true">
              <i className="size-[7px] rounded-full bg-[#f17873]" />
              <i className="size-[7px] rounded-full bg-[#e5b95f]" />
              <i className="size-[7px] rounded-full bg-[#70c285]" />
            </span>
            <label htmlFor="diff-input">diff.patch</label>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="font-mono"
            onClick={() => {
              setDiff(EXAMPLE_DIFF)
              setError(null)
            }}
          >
            Load example
          </Button>
        </div>

        <textarea
          className="block min-h-[300px] w-full resize-y border-0 bg-panel px-5 py-5 font-mono text-xs leading-[1.7] text-foreground caret-accent-text outline-none placeholder:text-muted/70 md:min-h-80 md:px-6 md:py-6 md:text-[13px]"
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
          aria-describedby="diff-help diff-security diff-error"
        />

        <div className="flex min-h-[72px] flex-col items-stretch justify-between gap-5 border-t border-line bg-canvas px-4 py-3.5 md:flex-row md:items-center md:pl-5">
          <div>
            <p id="diff-help" className="text-xs text-muted">
              Unlisted · Expires after 24 hours · 2 MiB max
            </p>
            <p
              id="diff-security"
              className="mt-1 max-w-[590px] text-xs leading-snug text-muted"
            >
              Anyone with the link can view this diff — remove secrets before
              sharing.
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
                'min-w-[55px] text-right font-mono text-[11px] text-muted',
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
              {!isSubmitting && <span aria-hidden="true">↗</span>}
            </Button>
          </div>
        </div>
      </form>

      <section
        className="mt-4 grid grid-cols-1 items-center gap-3 rounded-panel border border-line bg-panel/60 p-4 md:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] md:gap-6"
        aria-labelledby="terminal-upload-title"
      >
        <div>
          <p
            id="terminal-upload-title"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-bright"
          >
            From your terminal
          </p>
          <p className="mt-1 text-xs text-muted">
            Pipe working-tree changes straight to a share link.
          </p>
        </div>
        <div className="flex min-w-0 items-stretch gap-2">
          <div className="flex h-8 min-w-0 flex-1 items-center gap-2.5 overflow-x-auto whitespace-nowrap rounded-control border border-line bg-canvas px-3 [scrollbar-width:thin]">
            <span className="select-none text-muted" aria-hidden="true">
              $
            </span>
            <code className="font-mono text-xs text-foreground">
              {uploadCommand}
              <span className="text-muted"> | xargs open</span>
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
              {commandCopyState === 'idle' ? '⧉' : '✓'}
            </span>
            {commandCopyState === 'armed'
              ? 'Copy + open'
              : commandCopyState === 'full'
                ? 'Copied + open'
                : 'Copy'}
          </Button>
        </div>
      </section>

      <footer className="flex items-center justify-center px-1 pt-5 text-[11px] text-muted md:justify-between">
        <span>
          Powered by <FooterLink href="https://diffs.com">diffs.com</FooterLink>{' '}
          +{' '}
          <FooterLink href="https://trees.software">trees.software</FooterLink>{' '}
          · Deployed on{' '}
          <FooterLink href="https://workers.cloudflare.com">
            Cloudflare Workers
          </FooterLink>{' '}
          +{' '}
          <FooterLink href="https://developers.cloudflare.com/r2/">
            R2
          </FooterLink>
        </span>
        <span className="hidden items-center gap-1 md:flex">
          <kbd className="min-w-[22px] rounded border border-line border-b-line-bright bg-surface px-1.5 py-0.5 text-center text-[10px] text-muted">
            ⌘
          </kbd>
          <kbd className="min-w-[22px] rounded border border-line border-b-line-bright bg-surface px-1.5 py-0.5 text-center text-[10px] text-muted">
            Enter
          </kbd>
          to share
        </span>
      </footer>
    </main>
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KiB`
}
