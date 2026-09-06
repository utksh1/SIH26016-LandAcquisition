import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/mock-ehrms': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
      '/ready': 'http://127.0.0.1:3000',
      '/readiness': 'http://127.0.0.1:3000',
      '/dashboard': 'http://127.0.0.1:3000',
      '/projects': 'http://127.0.0.1:3000',
      '/workflow': 'http://127.0.0.1:3000',
      '/departments': 'http://127.0.0.1:3000',
      '/objections': 'http://127.0.0.1:3000',
      '/rehabilitation': 'http://127.0.0.1:3000',
      '/documents': 'http://127.0.0.1:3000',
      '/alerts': 'http://127.0.0.1:3000',
      '/parcels': 'http://127.0.0.1:3000',
      '/deposits': 'http://127.0.0.1:3000',
      '/audit': 'http://127.0.0.1:3000',
      '/auth': 'http://127.0.0.1:3000',
      '/dilrmp': 'http://127.0.0.1:3000',
      '/pfms': 'http://127.0.0.1:3000',
      '/analytics': 'http://127.0.0.1:3000',
      '/integrations': 'http://127.0.0.1:3000',
      '/ai': 'http://127.0.0.1:3000',
      '/me': 'http://127.0.0.1:3000',
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})

// The API client uses mock data whenever VITE_API_URL is unset or blank.
// Keep API routing explicit: VITE_API_URL should be an origin or base path,
// without a trailing slash (for example, http://127.0.0.1:8080/api). 

