import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Code shared with the Worker (types + guest-name matching), so the
      // client and the API can never drift apart.
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    // `shared/` sits outside web/, so the dev server needs permission to read
    // one level up.
    fs: {
      allow: ['..'],
    },
    proxy: {
      // Forward API calls to the local Worker (`wrangler dev`) on :8787
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
