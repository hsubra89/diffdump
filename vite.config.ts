import { defineConfig, perEnvironmentPlugin, type PluginOption } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  /* Pre-bundle deep Base UI imports that otherwise appear after the initial
     development scan and trigger a mid-render optimization reload. */
  optimizeDeps: {
    include: [
      '@base-ui/react/alert-dialog',
      '@base-ui/react/select',
      '@base-ui/react/tooltip',
    ],
  },
  server: { allowedHosts: ['warptech'] },
  worker: { format: 'es' },
  build: {
    /* The core renderer and on-demand Shiki grammars are intentionally
       substantial. Gzip budgets enforce the viewer boundaries below. */
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),

    tailwindcss(),
    tanstackStart(),
    viteReact(),
    mode === 'analyze' &&
      perEnvironmentPlugin('client-bundle-analysis', (environment) => {
        if (environment.name !== 'client') {
          return false
        }

        return [
          visualizer({
            emitFile: true,
            filename: 'bundle-report.html',
            gzipSize: true,
            template: 'treemap',
            title: 'Diffdump client bundle',
          }) as PluginOption,
          visualizer({
            emitFile: true,
            filename: 'bundle-report.json',
            gzipSize: true,
            template: 'raw-data',
          }) as PluginOption,
        ]
      }),
  ],
}))

export default config
