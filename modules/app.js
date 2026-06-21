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
  });

  // ── CORE: Router ПІСЛЯ lazy-init, щоб portal:view знайшов готові модулі ──
  Router.init();
  Counter.init();
  Greeting.init();
  Photos.init();
  Settings.init();
  Realtime.init();
});
