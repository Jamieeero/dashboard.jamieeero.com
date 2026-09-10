import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // during local dev, forward /api calls to `wrangler pages dev`
      '/api': 'http://127.0.0.1:8788'
    }
  }
})
