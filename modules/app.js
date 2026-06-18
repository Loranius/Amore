// ============================================================
// APP BOOTSTRAP — lazy init
// Core модулі запускаються одразу, важкі — після авторизації
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ── CORE: потрібні одразу ──
  Auth.init();
  Router.init();
  Counter.init();
  Greeting.init();
  Photos.init();
  Settings.init();

  // ── LAZY: ініціалізуємо після успішного входу ──
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
  });
});
