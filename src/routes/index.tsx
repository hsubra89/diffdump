import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

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
    <main className="home-page">
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="wordmark" href="/">
          <span aria-hidden="true">/</span>
          diffdump
        </a>
        <span className="nav-note">Tiny links for big changes</span>
      </nav>

      <section className="hero">
        <h1>
          Share a diff.
          <br />
          <span>Skip the ceremony.</span>
        </h1>
        <p className="hero-copy">
          Paste a unified git diff and get a focused, unlisted review link in
          seconds. No account. No repository access.
        </p>
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-bar">
          <div className="composer-title">
            <span className="terminal-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <label htmlFor="diff-input">diff.patch</label>
          </div>
          <button
            className="example-button"
            type="button"
            onClick={() => {
              setDiff(EXAMPLE_DIFF)
              setError(null)
            }}
          >
            Load example
          </button>
        </div>

        <textarea
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

        <div className="composer-footer">
          <div>
            <p id="diff-help" className="privacy-note">
              Unlisted · Expires after 24 hours · 2 MiB max
            </p>
            <p id="diff-security" className="security-note">
              <span aria-hidden="true">!</span>
              Anyone with the link can view this diff. Remove secrets and
              credentials before sharing.
            </p>
            <p
              id="diff-error"
              className="form-error"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          </div>

          <div className="composer-actions">
            <span
              className={
                byteLength > MAX_DIFF_BYTES
                  ? 'byte-count byte-count--over'
                  : 'byte-count'
              }
            >
              {formatBytes(byteLength)}
            </span>
            <button
              className="button button--primary share-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating link…' : 'Create share link'}
              {!isSubmitting && <span aria-hidden="true">↗</span>}
            </button>
          </div>
        </div>
      </form>

      <section
        className="terminal-upload"
        aria-labelledby="terminal-upload-title"
      >
        <div className="terminal-upload-copy">
          <p id="terminal-upload-title" className="terminal-upload-label">
            From your terminal
          </p>
          <p>Pipe working-tree changes straight to a share link.</p>
        </div>
        <div className="terminal-command-row">
          <div className="terminal-command">
            <span aria-hidden="true">$</span>
            <code>
              {uploadCommand}
              <span className="terminal-open-pipe"> | xargs open</span>
            </code>
          </div>
          <button
            className="terminal-copy-button"
            type="button"
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
            <span aria-hidden="true">
              {commandCopyState === 'idle' ? '⧉' : '✓'}
            </span>
            {commandCopyState === 'armed'
              ? 'Copy + open'
              : commandCopyState === 'full'
                ? 'Copied + open'
                : 'Copy'}
          </button>
        </div>
      </section>

      <footer className="home-footer">
        <span>Powered by Cloudflare Workers + R2</span>
        <span className="keyboard-hint">
          <kbd>⌘</kbd>
          <kbd>Enter</kbd>
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
