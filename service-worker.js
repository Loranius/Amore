// ============================================================
// Service Worker — Amore
// Стратегія підібрана під часті деплої (GitHub Pages):
//  • HTML-навігація → network-first (свіжий деплій видно одразу, офлайн — з кешу)
//  • Своя статика (css/js/img) → stale-while-revalidate (миттєво з кешу, оновлення у фоні)
//  • Supabase / Mapbox / шрифти / CDN → напряму в мережу (не кешуємо)
// Щоб скинути кеш — підніми версію в CACHE нижче.
// ============================================================
const CACHE = 'amore-v2';
const SHELL = [
  './',
  './index.html',
  './styles/main.css',
  './styles/components.css?v=3',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Чужі домени (Supabase API, Mapbox, Google Fonts, CDN) — не чіпаємо
  if (url.origin !== self.location.origin) return;

  // HTML-навігація: спершу мережа, офлайн — з кешу
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Своя статика: stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
