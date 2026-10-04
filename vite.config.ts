import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
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
        maximumFileSizeToCacheInBytes: 5000000,
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        globPatterns: [
          '**/*.{webmanifest,ico,png,svg}',
          'assets/index-*.js',
          'assets/index-*.css',
        ],
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
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell-pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/assets\/[^/]+\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-lazy-chunks',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/(?:models\/(?:school_of_fish_reef|coral_reef_set_cc0)\.glb|models\/glow_whale_native\/part-\d+\.txt|textures\/reef\/[^/]+\.webp|assets\/reef\/volcano\/[^/]+\.webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'reef-visual-assets',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          /*
           * МІНІАТЮРИ СХОВИЩА (ADR-0212). Галерея, листя, мітки на мапі
           * показують не оригінали, а `render/image` (`lib/imageCdn.ts`), і
           * правило нижче їх не ловило: кожен візит тягнув мініатюри з
           * мережі, а офлайн галерея стояла порожня. Кешуються лише
           * відповіді 200 — 400 на завеликий оригінал сюди не потрапить.
           */
          {
            urlPattern: /\/storage\/v1\/render\/image\/public\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-thumbnails',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          /*
           * ШРИФТ (ADR-0212). Nunito приходить із Google, і без кешу PWA
           * офлайн падала на системний шрифт. Таблиця стилів — свіжа, коли
           * є мережа; самі файли шрифту незмінні за адресою — з кешу.
           */
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
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
  /*
   * Воркери збираються як ES-модулі, а не як IIFE.
   *
   * Воркер MapLibre створюється через `new Worker(url, { type: 'module' })`.
   * За типовим `format: 'iife'` збирач віддав би класичний скрипт, браузер
   * не зміг би розібрати його як модуль — і карта лишилась би без тайлів
   * рівно так само, як без явної адреси воркера взагалі.
   */
  worker: { format: 'es' },
  /*
   * Дві сторінки: портал і гра «Життя Лєни» (ADR-0239). Гра — окремий
   * вхід, бо живе в iframe на `/game` і не тягне портал за собою.
   */
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        game: fileURLToPath(new URL('./game.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  base,
});
