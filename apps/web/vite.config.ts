import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
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

