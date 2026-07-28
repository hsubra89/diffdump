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
    <main className="mx-auto min-h-screen w-[min(1120px,calc(100%-24px))] py-[18px] text-foreground min-[721px]:w-[min(1120px,calc(100%-40px))] min-[721px]:py-[28px_22px]">
      <nav
        className="flex items-center justify-between"
        aria-label="Primary navigation"
      >
        <Wordmark />
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.04em] text-muted min-[721px]:inline">
          Tiny links for big changes
        </span>
      </nav>

      <section className="py-[64px_36px] min-[721px]:py-[clamp(72px,10vw,120px)_48px]">
        <h1 className="max-w-[900px] text-[clamp(48px,16vw,74px)] font-semibold leading-[0.9] tracking-[-0.072em] min-[721px]:text-[clamp(52px,8.3vw,104px)]">
          Share a diff.
          <br />
          <span className="text-[#777e87]">Skip the ceremony.</span>
        </h1>
        <p className="mt-6 max-w-[610px] text-base leading-relaxed text-muted-bright min-[721px]:mt-8 min-[721px]:text-[clamp(16px,2vw,19px)]">
          Paste a unified git diff and get a focused, unlisted review link in
          seconds. No account. No repository access.
        </p>
      </section>

      <form
        className="overflow-hidden rounded-[15px] border border-line-bright bg-surface/90 shadow-[0_30px_80px_rgb(0_0_0/26%),inset_0_1px_0_rgb(255_255_255/3%)]"
        onSubmit={handleSubmit}
      >
        <div className="flex min-h-[48px] items-center justify-between border-b border-line bg-[#181b20] px-4 font-mono text-xs text-muted">
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
          className="block min-h-[300px] w-full resize-y border-0 bg-[linear-gradient(90deg,rgb(255_255_255/1.5%)_1px,transparent_1px)] bg-[length:44px_100%] bg-panel px-[18px] py-5 font-mono text-xs leading-[1.72] text-[#e8eaed] caret-accent outline-none placeholder:text-[#4e555f] min-[721px]:min-h-80 min-[721px]:px-[26px] min-[721px]:py-6 min-[721px]:text-[13px]"
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

        <div className="flex min-h-[76px] flex-col items-stretch justify-between gap-5 border-t border-line bg-[#181b20] px-4 py-3.5 min-[721px]:flex-row min-[721px]:items-center min-[721px]:pl-5">
          <div>
            <p id="diff-help" className="text-xs text-muted">
              Unlisted · Expires after 24 hours · 2 MiB max
            </p>
            <p
              id="diff-security"
              className="mt-1.5 flex max-w-[590px] items-baseline gap-2 text-[11px] leading-snug text-muted-bright"
            >
              <span
                className="inline-grid size-[15px] shrink-0 place-items-center rounded-full bg-[#e5b95f] text-[10px] font-extrabold leading-none text-accent-ink"
                aria-hidden="true"
              >
                !
              </span>
              Anyone with the link can view this diff. Remove secrets and
              credentials before sharing.
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

          <div className="flex shrink-0 items-center justify-between gap-4 min-[721px]:justify-start">
            <span
              className={cn(
                'min-w-[55px] text-right font-mono text-[11px] text-muted',
                byteLength > MAX_DIFF_BYTES && 'text-danger',
              )}
            >
              {formatBytes(byteLength)}
            </span>
            <Button
              className="min-w-[165px]"
              variant="primary"
              size="md"
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
        className="mt-3.5 grid grid-cols-1 items-center gap-3 rounded-panel border border-line bg-surface/60 p-[15px] min-[721px]:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] min-[721px]:gap-6 min-[721px]:px-[18px] min-[721px]:py-4"
        aria-labelledby="terminal-upload-title"
      >
        <div>
          <p
            id="terminal-upload-title"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted-bright"
          >
            From your terminal
          </p>
          <p className="mt-1 text-xs text-muted">
            Pipe working-tree changes straight to a share link.
          </p>
        </div>
        <div className="-mx-0.5 flex min-w-0 items-stretch gap-2 min-[721px]:mx-0">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2.5 overflow-x-auto whitespace-nowrap rounded-control border border-[#252a31] bg-[#0f1114] px-3 [scrollbar-width:thin]">
            <span className="select-none text-[#5d6570]" aria-hidden="true">
              $
            </span>
            <code className="font-mono text-xs text-[#dfe3e8]">
              {uploadCommand}
              <span className="text-[#626a75]"> | xargs open</span>
            </code>
          </div>
          <Button
            className="min-w-[100px] min-[721px]:min-w-28"
            variant="secondary"
            size="md"
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
            <span className="text-accent" aria-hidden="true">
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

      <footer className="flex items-center justify-center px-1 pt-[18px] text-[11px] text-[#666d76] min-[721px]:justify-between">
        <span>Powered by Cloudflare Workers + R2</span>
        <span className="hidden items-center gap-1 min-[721px]:flex">
          <kbd className="min-w-[22px] rounded border border-line border-b-[#3b414a] bg-[#171a1e] px-1.5 py-0.5 text-center text-[10px] text-muted">
            ⌘
          </kbd>
          <kbd className="min-w-[22px] rounded border border-line border-b-[#3b414a] bg-[#171a1e] px-1.5 py-0.5 text-center text-[10px] text-muted">
            Enter
          </kbd>
          to share
        </span>
      </footer>
    </main>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KiB`
}
