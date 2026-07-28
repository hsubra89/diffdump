import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  worker: { format: 'es' },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),

    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
