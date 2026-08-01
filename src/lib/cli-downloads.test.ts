import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  createShellScriptResponse,
  dddScript,
  installerScript,
} from './cli-downloads'

describe('CLI downloads', () => {
  it('serves the repository scripts without creating a second source of truth', async () => {
    await expect(readFile(resolve('scripts/ddd'), 'utf8')).resolves.toBe(
      dddScript,
    )
    await expect(readFile(resolve('scripts/install'), 'utf8')).resolves.toBe(
      installerScript,
    )
  })

  it('keeps the installer checksum synchronized with ddd', () => {
    const expectedChecksum = installerScript.match(
      /readonly DDD_SHA256='([a-f0-9]{64})'/,
    )?.[1]
    const actualChecksum = createHash('sha256').update(dddScript).digest('hex')

    expect(expectedChecksum).toBe(actualChecksum)
  })

  it('keeps the installer and command versions synchronized', () => {
    const versionPattern = /readonly DDD_VERSION='([^']+)'/

    expect(installerScript.match(versionPattern)?.[1]).toBe(
      dddScript.match(versionPattern)?.[1],
    )
  })

  it('serves scripts as uncached plain text', async () => {
    const response = createShellScriptResponse(dddScript, 'ddd')

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Disposition')).toBe(
      'inline; filename="ddd"',
    )
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    )
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    await expect(response.text()).resolves.toBe(dddScript)
  })
})
