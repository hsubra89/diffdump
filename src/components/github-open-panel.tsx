import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'

import {
  createGitHubDiffPath,
  parseGitHubDiffUrl,
  readStoredGitHubToken,
  writeStoredGitHubToken,
} from '../lib/github-diffs'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function GitHubOpenPanel({
  url,
  onUrlChange,
}: {
  url: string
  onUrlChange: (url: string) => void
}) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    setHasToken(readStoredGitHubToken() !== '')
  }, [])

  useEffect(() => {
    setError(null)
  }, [url])

  async function handleOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isOpening) {
      return
    }

    const source = parseGitHubDiffUrl(url.trim())
    if (!source) {
      setError('Enter a GitHub pull request, commit, or comparison URL.')
      return
    }

    setError(null)
    setIsOpening(true)

    try {
      await navigate({
        to: '/$',
        params: { _splat: createGitHubDiffPath(source) },
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

  return (
    <form onSubmit={handleOpen}>
      <div className="flex min-h-[300px] flex-col justify-center px-5 py-6 md:min-h-80 md:px-6">
        <label
          className="max-w-[560px] text-sm leading-relaxed text-muted-bright"
          htmlFor="github-url-input"
        >
          Open a pull request, commit, or comparison straight from GitHub — no
          share link created, nothing uploaded.
        </label>
        <div className="mt-4 flex max-w-[640px] flex-col items-stretch gap-2 sm:flex-row">
          <Input
            className="h-10 flex-1 px-3.5 font-mono"
            id="github-url-input"
            type="url"
            value={url}
            onChange={(event) => onUrlChange(event.currentTarget.value)}
            placeholder="https://github.com/org/repo/pull/123"
            aria-describedby="github-open-error"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            className="h-10 min-w-[110px]"
            variant="primary"
            size="sm"
            type="submit"
            disabled={isOpening || url.trim() === ''}
          >
            {isOpening ? 'Opening…' : 'Open diff'}
          </Button>
        </div>
        <p
          id="github-open-error"
          className="mt-3 max-w-[560px] text-xs text-danger empty:hidden"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
        <p className="mt-4 max-w-[560px] text-xs leading-snug text-muted-foreground">
          Reviews are client-only: the diff is fetched straight from GitHub and
          rendered in your browser.
        </p>
      </div>

      <div className="flex min-h-[72px] flex-col items-stretch justify-between gap-3 border-t border-line bg-canvas px-4 py-3.5 md:flex-row md:items-center md:pl-5">
        <p className="max-w-[590px] text-xs leading-snug text-muted-foreground">
          {hasToken
            ? 'GitHub token active — saved only in this browser, sent only to GitHub.'
            : 'Public repositories work without setup. Private diffs ask for a GitHub token when needed.'}
        </p>
        {hasToken && (
          <Button
            className="self-start md:self-auto"
            variant="outline"
            size="xs"
            onClick={() => {
              writeStoredGitHubToken('')
              setHasToken(false)
            }}
          >
            Clear saved token
          </Button>
        )}
      </div>
    </form>
  )
}
