// ============================================================
// APP BOOTSTRAP
// Ініціалізація всіх модулів
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
  Router.init();
  Counter.init();
  Greeting.init();
  Photos.init();
  CalendarModule.init();
  Wishlist.init();
  Budget.init();
  Capsule.init();
  DailyQuestion.init();
  Media.init();
  RandomModule.init();
});
