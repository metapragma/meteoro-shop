import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        // Use 127.0.0.1 by default to avoid environments where `localhost` resolves to IPv6 (::1)
        // while the mock server is bound to IPv4 only.
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
