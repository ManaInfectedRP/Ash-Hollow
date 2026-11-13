import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Release channel. CI builds the `dev` branch with CHANNEL=dev and publishes it under /dev/ next to the
 * real game: it gets a DEV label in the menu and installs as its own app, so testers never mix the two up.
 */
const DEV_CHANNEL = process.env.CHANNEL === 'dev';

export default defineConfig({
  define: {
    __CHANNEL__: JSON.stringify(DEV_CHANNEL ? 'dev' : 'release'),
  },
  plugins: [
    react(),
    // Installable + offline: precaches the game, sprites and atlas assets (production build only).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: DEV_CHANNEL ? 'Ash & Hollow (Dev)' : 'Ash & Hollow',
        short_name: DEV_CHANNEL ? 'A&H Dev' : 'Ash & Hollow',
        // the dev build is a separate installable app
        id: DEV_CHANNEL ? 'ash-and-hollow-dev' : 'ash-and-hollow',
        description: 'A 2D souls-like platformer.',
        start_url: '.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#07060a',
        theme_color: '#07060a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,json,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // the release site's worker must never answer for the dev build living under /dev/
        navigateFallbackDenylist: [/\/dev(\/|$)/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  // relative base so the same build works on a web server, as a PWA and inside Capacitor
  base: './',
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
