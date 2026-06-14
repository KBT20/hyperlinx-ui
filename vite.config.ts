import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://64.34.93.5:8000',
        changeOrigin: true,
      },
      '/iof': {
        target: 'http://64.34.93.5:4000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/iof/, ''),
      },
    },
  },
})