import dddScript from '../../scripts/ddd?raw'
import installerScript from '../../scripts/install?raw'

export { dddScript, installerScript }

export function createShellScriptResponse(script: string, filename: string) {
  return new Response(script, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
