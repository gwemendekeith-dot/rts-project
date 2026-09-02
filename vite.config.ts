import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Generate the service worker via workbox
      workbox: {
        cleanupOutdatedCaches: true,
        // Cache the app shell (HTML + JS + CSS) with a StaleWhileRevalidate strategy
        // so the app loads instantly offline and refreshes silently when online.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        runtimeCaching: [
          // Supabase REST/Auth responses are intentionally not cached. Caching
          // authenticated API data can show stale records or an old session.
          {
            // Google Fonts — CacheFirst, fonts don't change
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Skip waiting so new SW activates immediately without requiring a tab close
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Rafiki Operations Desk',
        short_name: 'Rafiki Ops',
          description: 'Operational source of truth for Rafiki Thermal Solutions',
        theme_color: '#0f172a',
          background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New Sale',
            short_name: 'New Sale',
            description: 'Start a new customer sale',
            url: '/new-sale',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Installations',
            short_name: 'Field Jobs',
            description: 'View and complete field installations',
            url: '/installations',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      // Make the PWA dev tools available during development
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
});
