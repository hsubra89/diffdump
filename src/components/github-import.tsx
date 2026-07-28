import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'

import {
  CREATE_CLASSIC_GITHUB_TOKEN_URL,
  parseGitHubDiffUrl,
  readStoredGitHubToken,
  writeStoredGitHubToken,
} from '../lib/github-diffs'
import { cn } from '../lib/cn'
import { Button } from './ui/button'
import { eyebrowClassName } from './ui/surfaces'

export function GitHubImport() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [token, setTokenState] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const hasToken = token !== ''

  useEffect(() => {
    setTokenState(readStoredGitHubToken())
  }, [])

  const setToken = useCallback((nextToken: string) => {
    const normalizedToken = nextToken.trim()
    setTokenState(normalizedToken)
    writeStoredGitHubToken(normalizedToken)
  }, [])

  async function handleOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isOpening) {
      return
    }

    const normalizedUrl = url.trim()
    if (!parseGitHubDiffUrl(normalizedUrl)) {
      setError('Enter a GitHub pull request, commit, or comparison URL.')
      return
    }

    setError(null)
    setIsOpening(true)

    try {
      await navigate({
        to: '/github',
        search: { url: normalizedUrl },
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The GitHub diff could not be opened.',
      )
      setIsOpening(false)
    }
  }

  function handleTokenSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedToken = tokenDraft.trim()
    if (!normalizedToken) {
      return
    }

    setToken(normalizedToken)
    setTokenDraft('')
    setError(null)
  }

  return (
    <section
      id="private-github"
      className="mt-12 scroll-mt-6"
      aria-labelledby="github-import-title"
    >
      <div className="max-w-[680px]">
        <p className={cn(eyebrowClassName, 'text-accent-text')}>
          Private GitHub diffs
        </p>
        <h2
          id="github-import-title"
          className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-4xl"
        >
          Review without creating a share.
        </h2>
        <p className="mt-3 leading-relaxed text-muted-bright">
          Store a GitHub token in this browser, then open a private pull
          request, commit, or comparison directly in Diffdump.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-panel border border-line bg-panel/60">
        <div className="px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(eyebrowClassName, 'text-muted-bright')}>
                  1. GitHub access
                </p>
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-0.5 font-mono text-[9px] leading-none uppercase tracking-wide',
                    hasToken
                      ? 'border-addition/40 text-addition'
                      : 'border-line-bright text-muted',
                  )}
                >
                  {hasToken ? 'Active' : 'Optional'}
                </span>
              </div>
              <p className="mt-1 max-w-[650px] text-xs leading-snug text-muted">
                {hasToken ? (
                  <>Saved only in localStorage. Sent only to GitHub.</>
                ) : (
                  <>
                    <a
                      className="text-accent-text underline underline-offset-2 hover:no-underline"
                      href={CREATE_CLASSIC_GITHUB_TOKEN_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Create a classic PAT
                    </a>{' '}
                    with <code className="font-mono">repo</code> scope. It is
                    saved only in this browser and sent only to GitHub.
                  </>
                )}
              </p>
            </div>

            {hasToken ? (
              <Button
                className="self-start md:self-auto"
                variant="outline"
                size="xs"
                onClick={() => {
                  setToken('')
                  setTokenDraft('')
                  setError(null)
                }}
              >
                Clear saved token
              </Button>
            ) : (
              <form
                className="flex min-w-0 items-stretch gap-2 md:w-[340px]"
                onSubmit={handleTokenSave}
              >
                <input
                  className="h-8 min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 font-mono text-xs text-foreground outline-none placeholder:text-muted/70"
                  type="password"
                  value={tokenDraft}
                  onChange={(event) => setTokenDraft(event.currentTarget.value)}
                  placeholder="Paste GitHub token"
                  aria-label="GitHub personal access token"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  spellCheck={false}
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  disabled={tokenDraft.trim() === ''}
                >
                  Save
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-3 border-t border-line p-4 md:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] md:gap-6">
          <div className="min-w-0">
            <p className={cn(eyebrowClassName, 'text-muted-bright')}>
              2. Open a diff
            </p>
            <p className="mt-1 text-xs text-muted">
              Public URLs also work without a token.
            </p>
          </div>

          <form
            className="flex min-w-0 items-stretch gap-2"
            onSubmit={handleOpen}
          >
            <input
              className="h-8 min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 font-mono text-xs text-foreground outline-none placeholder:text-muted/70"
              type="url"
              value={url}
              onChange={(event) => {
                setUrl(event.currentTarget.value)
                if (error) setError(null)
              }}
              placeholder="https://github.com/org/repo/pull/123"
              aria-label="GitHub diff URL"
              aria-describedby="github-import-error"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button
              className="min-w-[92px]"
              variant="secondary"
              size="sm"
              type="submit"
              disabled={isOpening || url.trim() === ''}
            >
              {isOpening ? 'Opening…' : 'Open diff'}
            </Button>
          </form>
        </div>

        <p
          id="github-import-error"
          className="border-t border-line px-4 py-3 text-xs text-danger empty:hidden"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      </div>
    </section>
  )
}
