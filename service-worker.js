// ============================================================
// Service Worker — Amore
// Стратегія підібрана під часті деплої (GitHub Pages) БЕЗ ручного бампу:
//  • HTML-навігація  → network-first (свіжий деплій видно одразу, офлайн — кеш)
//  • Своя статика JS/CSS/img → network-first з таймаутом 2с (свіже при онлайні,
//    кеш якщо мережа тупить). Модулі підхоплюють новий код самі — бампати
//    CACHE при кожному деплої більше НЕ треба.
//  • Supabase / Mapbox / шрифти / CDN → напряму в мережу (не кешуємо)
//
// CACHE-версію піднімай лише зрідка — коли треба примусово викинути ВЕСЬ
// старий кеш у всіх (напр. зламаний закешований файл). Для звичайних
// деплоїв модулів/стилів цього робити не потрібно.
// ============================================================
const CACHE = 'amore-v100';
const SHELL = [
  './',
  './index.html',
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

  // Своя статика (JS/CSS/img): network-first з таймаутом.
  // • Мережа встигла за NET_TIMEOUT → віддаємо свіже (і кешуємо).
  // • Мережа тупить/офлайн → віддаємо кеш, а мережевий запит НЕ скасовуємо:
  //   коли він дійде, тихо оновить кеш на наступний раз.
  // Так модулі підхоплюють свіжий код при онлайні без ручного бампу CACHE,
  // а на поганому з'єднанні застосунок лишається швидким (кеш).
  const NET_TIMEOUT = 2000;

  e.respondWith((async () => {
    const cachedPromise = caches.match(req);

    // Мережевий запит: завжди оновлює кеш при успіху (навіть якщо ми вже
    // віддали кеш через таймаут — оновлення осяде на майбутнє).
    const networkPromise = fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => undefined);

    // Гонка: мережа проти таймера. Таймер «перемагає» значенням undefined —
    // це сигнал «час вийшов, спробуй кеш», а не помилка.
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(undefined), NET_TIMEOUT));

    const winner = await Promise.race([networkPromise, timeoutPromise]);
    if (winner) return winner; // мережа встигла

    // Таймаут або мережева помилка → пробуємо кеш
    const cached = await cachedPromise;
    if (cached) return cached;

    // Кешу нема (перший візит на повільному з'єднанні) — вибору нема,
    // дочікуємось мережу попри таймаут.
    const late = await networkPromise;
    if (late) return late;

    // Зовсім нічого — коректна відмова замість undefined-респонсу.
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});
