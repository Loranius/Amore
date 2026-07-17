import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// vite-plugin-pwa замінює ручний service-worker.js + бамп CACHE зі старого
// репо: workbox сам версіонує прекеш і чистить старе при activate. Правило
// «після зміни js/css бампни версію» більше не потрібне — білд робить це сам.

// base для GitHub Pages: під проєктним репо сайт живе за /<repo>/, тож шлях
// підставляє CI через BASE_PATH (див. .github/workflows/deploy.yml). Локально
// й на кореневому домені лишається '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'game.html'],
      manifest: {
        name: 'Amore',
        short_name: 'Amore',
        description: 'Портал для двох',
        theme_color: '#171717',
        background_color: '#171717',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // game.html — окремий документ в iframe; хай кешується як навігація.
        navigateFallbackDenylist: [/^\/game\.html$/],
        runtimeCaching: [
          {
            // Публічні фото зі Storage — cache-first, вони незмінні за URL.
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  base,
});
