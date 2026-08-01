import { createFileRoute } from '@tanstack/react-router'

import {
  createShellScriptResponse,
  installerScript,
} from '../lib/cli-downloads'

export const Route = createFileRoute('/install')({
  server: {
    handlers: {
      GET: () => createShellScriptResponse(installerScript, 'install'),
    },
  },
})
