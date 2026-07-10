// ============================================================
// APP BOOTSTRAP — lazy init
// ============================================================
// ПОРЯДОК КРИТИЧНИЙ:
//   Auth.init() запускає async tryAutoLogin(), яка після завершення
//   стріляє 'portal:auth'. Обидва слухачі portal:auth (важкий init
//   і Router) реєструються синхронно ДО того як portal:auth вистрілить,
//   але спрацьовують у порядку реєстрації.
//
//   Проблема (стара): Router реєструвався першим → при portal:auth він
//   одразу диспатчив portal:view, але модулі ще не мали своїх
//   portal:view-слухачів (вони init-яться в lazy-блоку, який іде другим).
//   Результат: порожній екран при F5 не на головній.
//
//   Рішення: lazy-init слухач реєструємо ДО Router.init().
//   Тоді при portal:auth:
//     1) Спочатку важкий init → модулі реєструють portal:view-слухачі.
//     2) Потім Router → диспатчить portal:view → модулі вже готові. ✓
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ── Легкий haptic-відгук на ключові натискання (Android Chrome) ──
  document.addEventListener('click', (e) => {
    if (!navigator.vibrate) return;
    if (e.target.closest('.nav-btn, .more-menu-item, .btn-primary')) {
      navigator.vibrate(8);
    }
  }, { passive: true });

  Auth.init();
  ErrorBoundary.init(); // якомога раніше — щоб ловити помилки з перших секунд

  // ── LAZY: реєструємо ПЕРШИМ — до Router.init() ──────────────────
  // Router у своєму portal:auth-хендлері диспатчить portal:view,
  // тому до того моменту модулі вже мають зареєструвати свої слухачі.
  let heavyInitDone = false;
  window.addEventListener('portal:auth', () => {
    if (heavyInitDone) return;
    heavyInitDone = true;

    CalendarModule.init();
    Wishlist.init();
    Budget.init();
    Capsule.init();
    DailyQuestion.init();
    Media.init();
    RandomModule.init();
    Swipe.init();
    MapModule.init();
    Shopping.init();
    PhotoCalendar.init();
    Schedule.init();
  });

  // ── SIDEBAR TOGGLE (desktop only) ──
  (function() {
    const btn = document.getElementById('sidebar-toggle');
    if (!btn) return;

    const app = document.getElementById('app');
    const STORAGE_KEY = 'amore:sidebar-collapsed';
    const safeGet = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
    const safeSet = (v) => { try { localStorage.setItem(STORAGE_KEY, v); } catch {} };

    // Відновлюємо стан
    if (safeGet() === '1') {
      app.classList.add('sidebar-collapsed');
      btn.textContent = '☰';
      btn.title = 'Показати меню';
    } else {
      btn.textContent = '✕';
      btn.title = 'Приховати меню';
    }

    btn.addEventListener('click', () => {
      const collapsed = app.classList.toggle('sidebar-collapsed');
      btn.textContent = collapsed ? '☰' : '✕';
      btn.title = collapsed ? 'Показати меню' : 'Приховати меню';
      safeSet(collapsed ? '1' : '0');
    });

    // Ховаємо кнопку на мобільному (CSS display:none, але на всяк випадок)
    function syncVisibility() {
      btn.style.display = window.innerWidth >= 960 ? '' : 'none';
    }
    syncVisibility();
    window.addEventListener('resize', syncVisibility);
  })();

  Router.init();
  Counter.init();
  WeekWidget.init();
  HomeWidgets.init();
  WhereTo.init();
  Greeting.init();
  Photos.init();
  Settings.init();
  Realtime.init();
  PWABanner.init();
});
