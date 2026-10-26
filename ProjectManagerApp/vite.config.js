import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /ProjectManagPro/ (the deploy workflow
  // sets VITE_BASE); everywhere else it lives at the root.
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    // Installable, offline-capable app. The service worker only exists in
    // builds; app/UpdatePrompt.jsx registers it and asks before switching to
    // a new version (an auto-reload could lose a half-filled order).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      manifest: {
        name: 'مدير المشروع',
        short_name: 'مدير المشروع',
        description: 'Construction project management: plan, record site work, track cost and progress — works offline.',
        lang: 'ar',
        dir: 'rtl',
        display: 'standalone',
        theme_color: '#553285',
        background_color: '#FFFFFF',
        start_url: '.',
        scope: '.',
        // Generated from public/app-icon.svg by `npm run icons`.
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The spreadsheet (jspreadsheet) chunk is the largest file.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  // All data lives in the browser per origin (http://localhost:5173). If Vite
  // silently moved to another port the app would open empty, so a busy port
  // is an error instead.
  server: { port: 5173, strictPort: true },
})
