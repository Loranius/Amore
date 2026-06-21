// ============================================================
// GESTURES — мобільні жести
// • Pull-to-refresh: потягнути вниз на 80px → оновити поточну вкладку
// • Swipe-навігація: свайп вліво/вправо → наступна/попередня вкладка
// ============================================================
const Gestures = (() => {

  // ── PULL-TO-REFRESH ───────────────────────────────────────
  const PTR_THRESHOLD = 80; // px вниз щоб спрацювало
  let ptrStartY   = 0;
  let ptrDelta    = 0;
  let ptrActive   = false;
  let ptrIndicator = null;

  function buildIndicator() {
    const el = document.createElement('div');
    el.className = 'ptr-indicator';
    el.id = 'ptr-indicator';
    el.textContent = '↓';
    document.body.appendChild(el);
    return el;
  }

  function initPullToRefresh(content) {
    ptrIndicator = buildIndicator();

    content.addEventListener('touchstart', (e) => {
      // Спрацьовує лише якщо скрол вгорі
      if (content.scrollTop > 4) return;
      ptrStartY = e.touches[0].clientY;
      ptrActive = true;
      ptrDelta  = 0;
    }, { passive: true });

    content.addEventListener('touchmove', (e) => {
      if (!ptrActive) return;
      ptrDelta = e.touches[0].clientY - ptrStartY;
      if (ptrDelta <= 0) { ptrActive = false; return; }

      // Гальмуємо рух (rubber-band)
      const pull = Math.min(ptrDelta * 0.45, PTR_THRESHOLD);
      if (pull > 20) {
        ptrIndicator.classList.add('ptr-visible');
        ptrIndicator.textContent = pull > PTR_THRESHOLD * 0.8 ? '↺' : '↓';
      }
    }, { passive: true });

    content.addEventListener('touchend', async () => {
      if (!ptrActive) return;
      ptrActive = false;

      const pull = Math.min(ptrDelta * 0.45, PTR_THRESHOLD);
      if (pull < PTR_THRESHOLD * 0.8) {
        ptrIndicator.classList.remove('ptr-visible');
        return;
      }

      // Спрацювало — показуємо спінер і оновлюємо
      ptrIndicator.textContent = '↺';
      ptrIndicator.classList.add('ptr-loading');

      try {
        const view = Router.getCurrentView();
        // Інвалідуємо кеш поточної вкладки і оновлюємо
        if (window.DataCache) DataCache.invalidatePrefix(view + ':');
        window.dispatchEvent(new CustomEvent('portal:view', { detail: { view } }));
        await new Promise(r => setTimeout(r, 600));
      } finally {
        ptrIndicator.classList.remove('ptr-loading', 'ptr-visible');
        ptrIndicator.textContent = '↓';
        ptrDelta = 0;
      }
    });
  }

  // ── SWIPE НАВІГАЦІЯ МІЖ ВКЛАДКАМИ ─────────────────────────
  // Горизонтальний свайп по content-зоні → наступна/попередня вкладка
  // Не заважає вертикальному скролу і внутрішнім горизонтальним елементам

  const SWIPE_MIN_X  = 55;  // мін. горизонтальне зміщення (px)
  const SWIPE_MAX_Y  = 40;  // макс. вертикальне (щоб не конфліктувати зі скролом)
  const NAV_VIEWS    = ['home', 'wishlist', 'budget', 'shopping', 'photo-calendar'];

  let swStartX = 0, swStartY = 0, swTracking = false;

  function initSwipeNav(content) {
    content.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      swStartX   = t.clientX;
      swStartY   = t.clientY;
      swTracking = true;
    }, { passive: true });

    content.addEventListener('touchmove', (e) => {
      if (!swTracking) return;
      const dx = e.touches[0].clientX - swStartX;
      const dy = Math.abs(e.touches[0].clientY - swStartY);
      // Якщо рух більше вертикальний — скасовуємо трекінг
      if (dy > SWIPE_MAX_Y) swTracking = false;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      if (!swTracking) return;
      swTracking = false;

      const dx = e.changedTouches[0].clientX - swStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - swStartY);

      if (Math.abs(dx) < SWIPE_MIN_X || dy > SWIPE_MAX_Y) return;

      const cur = Router.getCurrentView();
      const idx = NAV_VIEWS.indexOf(cur);
      if (idx === -1) return; // ця вкладка не в списку swipe-nav

      const next = dx < 0
        ? NAV_VIEWS[Math.min(idx + 1, NAV_VIEWS.length - 1)]
        : NAV_VIEWS[Math.max(idx - 1, 0)];

      if (next !== cur) Router.showView(next);
    });
  }

  function init() {
    const content = document.querySelector('.content');
    if (!content) return;
    initPullToRefresh(content);
    initSwipeNav(content);
  }

  return { init };
})();

window.Gestures = Gestures;
