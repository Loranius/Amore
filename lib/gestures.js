// ============================================================
// GESTURES — мобільні жести
// • Pull-to-refresh: потягнути вниз на 80px → оновити поточну вкладку
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

  function init() {
    const content = document.querySelector('.content');
    if (!content) return;
    initPullToRefresh(content);
  }

  return { init };
})();

window.Gestures = Gestures;
