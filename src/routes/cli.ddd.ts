import { createFileRoute } from '@tanstack/react-router'

import { createShellScriptResponse, dddScript } from '../lib/cli-downloads'

export const Route = createFileRoute('/cli/ddd')({
  server: {
    handlers: {
      GET: () => createShellScriptResponse(dddScript, 'ddd'),
    },
  },
})
