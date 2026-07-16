// ============================================================
// APP BOOTSTRAP — точка входу ESM
// ============================================================
// Єдиний <script type="module"> у index.html. Модулі-залежності
// імпортуються статично нижче: сам факт import виконує кожен модуль
// (реєструє його portal:view / portal:auth-слухачі) ДО виклику .init().
//
// ПОРЯДОК КРИТИЧНИЙ (не змінювати):
//   Auth.init() запускає async tryAutoLogin(), яка після завершення
//   стріляє 'portal:auth'. Слухач важкого init реєструється ДО Router.init(),
//   щоб модулі мали portal:view-слухачі до того, як Router диспатчить
//   portal:view. Інакше — порожній екран при F5 не на головній.
//
//   <script type="module"> виконується як defer (після парсингу DOM,
//   але ПЕРЕД подією DOMContentLoaded), тому обгортка на DOMContentLoaded
//   прибрана: DOM уже готовий, а слухач на вже-можливо-минулу подію не
//   спрацював би. Bootstrap іде синхронно.
// ============================================================

import { supabase } from '../lib/supabase.js';
import { ErrorBoundary } from '../lib/error-boundary.js';
import { Realtime } from '../lib/realtime.js';
import { PWABanner } from '../lib/pwa.js';
import { Auth } from './auth.js';
import { Router } from './router.js';
import { Counter } from './counter.js';
import { WeekWidget } from './week-widget.js';
import { HomeWidgets } from './home-widgets.js';
import { WhereTo } from './whereto.js';
import { Greeting } from './greeting.js';
import { Photos } from './photos.js';
import { Settings } from './settings.js';
import { CalendarModule } from './calendar.js';
import { Wishlist } from './wishlist.js';
import { Budget } from './budget.js';
import { Capsule } from './capsule.js';
import { DailyQuestion } from './question.js';
import { Media } from './media.js';
import { RandomModule } from './random.js';
import { Swipe } from './swipe.js';
import { MapModule } from './map.js';
import { Shopping } from './shopping.js';
import { PhotoCalendar } from './photo-calendar.js';
import { Schedule } from './schedule.js';
import { Game } from './game.js';

// ── Легкий haptic-відгук на ключові натискання (Android Chrome) ──
document.addEventListener('click', (e) => {
  if (!navigator.vibrate) return;
  if (/** @type {HTMLElement} */ (e.target).closest('.nav-btn, .more-menu-item, .btn-primary')) {
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
  Game.init();
});

// ── SIDEBAR TOGGLE (desktop only) ──
(function() {
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;

  const app = /** @type {HTMLElement} */ (document.getElementById('app'));
  const STORAGE_KEY = 'amore:sidebar-collapsed';
  /** @returns {string | null} */
  const safeGet = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
  /** @param {string} v @returns {void} */
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
  const syncVisibility = () => {
    btn.style.display = window.innerWidth >= 960 ? '' : 'none';
  };
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
