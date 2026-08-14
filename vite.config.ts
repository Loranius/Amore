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
        maximumFileSizeToCacheInBytes: 5000000,
        // Рифова GLB не має завантажуватись користувачам кристала або дерева
        // під час встановлення service worker. Вона кешується після першого
        // справжнього відкриття рифу.
        globIgnores: [
          '**/models/school_of_fish_reef.glb',
          '**/models/coral_reef_set_cc0.glb',
          '**/textures/reef/*.webp',
        ],
        navigateFallbackDenylist: [
          /game\.html/,
          /\.mp4$/,
        ],
        runtimeCaching: [
          {
            urlPattern: /\/(?:models\/(?:school_of_fish_reef|coral_reef_set_cc0)\.glb|textures\/reef\/[^/]+\.webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'reef-visual-assets',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
  // ── Локальний проксі до Supabase ────────────────────────────
  // Порожня змінна — і тут нічого немає: у CI та в продакшені сторінка йде до
  // Supabase напряму, як і йшла.
  //
  // Змінна потрібна там, де сторінка до мережі не дістає, а сам Node — дістає
  // (пісочниця агента). Без неї весь браузерний набір падав локально на
  // «waiting for button Діма»: логін просто не міг завантажити користувачів, і
  // жодну справжню ваду з набору побачити було неможливо — лише в логах CI,
  // по п'ятнадцять хвилин на спробу.
  //
  //   LOCAL_SUPABASE_PROXY=https://…supabase.co \
  //   VITE_SUPABASE_URL=http://127.0.0.1:4173/__supabase npm run build
  //
  // Збірку з таким VITE_SUPABASE_URL не можна публікувати — адреса в ній
  // локальна. Вона й не публікується: деплой збирається окремим кроком у CI зі
  // справжніми змінними.
  ...(process.env.LOCAL_SUPABASE_PROXY?.trim()
    ? {
        preview: {
          proxy: {
            '/__supabase': {
              target: process.env.LOCAL_SUPABASE_PROXY.trim(),
              changeOrigin: true,
              ws: true,
              rewrite: (path: string) => path.replace(/^\/__supabase/, ''),
            },
          },
        },
      }
    : {}),

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  base,
});
