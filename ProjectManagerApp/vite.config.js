import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // All data lives in the browser per origin (http://localhost:5173). If Vite
  // silently moved to another port the app would open empty, so a busy port
  // is an error instead.
  server: { port: 5173, strictPort: true },
})
