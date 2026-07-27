import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  worker: { format: 'es' },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),

    tanstackStart(),
    viteReact(),
  ],
})

export default config
