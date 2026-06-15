// ============================================================
// APP BOOTSTRAP
// Ініціалізація всіх модулів
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
  Router.init();
  Counter.init();
  CalendarModule.init();
  Wishlist.init();
  Budget.init();
  Capsule.init();
  DailyQuestion.init();
});
