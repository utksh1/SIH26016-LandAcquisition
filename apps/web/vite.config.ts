import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = {
  target: 'http://127.0.0.1:3000',
  bypass: (req: any) => {
    // If browser is requesting an HTML document (SPA page navigation), serve index.html!
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return '/index.html'
    }
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/mock-ehrms': apiProxy,
      '/health': apiProxy,
      '/ready': apiProxy,
      '/readiness': apiProxy,
      '/dashboard/kpis': apiProxy,
      '/dashboard': apiProxy,
      '/projects': apiProxy,
      '/workflow': apiProxy,
      '/departments': apiProxy,
      '/objections': apiProxy,
      '/rehabilitation': apiProxy,
      '/documents': apiProxy,
      '/alerts': apiProxy,
      '/parcels': apiProxy,
      '/deposits': apiProxy,
      '/audit': apiProxy,
      '/auth': apiProxy,
      '/dilrmp': apiProxy,
      '/pfms': apiProxy,
      '/analytics': apiProxy,
      '/integrations': apiProxy,
      '/ai': apiProxy,
      '/me': apiProxy,
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})
