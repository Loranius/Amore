// ============================================================
// ROUTER MODULE
// Перемикання між view (counter / calendar / wishlist)
// ============================================================

import { Photos } from './photos.js';

let currentView = 'home';

// Сабв'ю → хаб-секція, в якій вони живуть.
// Модулі (calendar.js, schedule.js, ...) далі слухають portal:view
// за своїми старими іменами — для них нічого не змінилось.
/** @type {Record<string, string>} */
const SUBVIEWS = {
  'calendar':       'calendar-hub',
  'schedule':       'calendar-hub',
  'photo-calendar': 'calendar-hub',
  'question':       'us-hub',
  'capsule':        'us-hub'
};

/** @param {string} v @returns {string} */
const sectionOf = v => SUBVIEWS[v] || v;

// Порядок СЕКЦІЙ для визначення напрямку slide
const VIEW_ORDER = ['home', 'wishlist', 'budget', 'calendar-hub', 'us-hub', 'media', 'whereto', 'map', 'shopping', 'random', 'game'];

// Розділи, що живуть під кнопкою «Ще» (мають підсвічувати «Ще»)
const MORE_VIEWS = ['calendar', 'schedule', 'photo-calendar', 'question', 'capsule', 'media', 'whereto', 'map', 'random', 'game'];

/** @param {string} viewName @returns {void} */
function updateActiveStates(viewName) {
  const section = sectionOf(viewName);
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    const view = /** @type {string} */ (/** @type {HTMLElement} */ (btn).dataset.view);
    btn.classList.toggle('active', sectionOf(view) === section);
  });
  const moreBtn = document.getElementById('more-nav-btn');
  if (moreBtn) {
    moreBtn.classList.toggle('active', MORE_VIEWS.includes(viewName));
  }
}

// Перемикання сабтабів та панелей всередині хабу
/** @param {string} viewName @returns {void} */
function updateHubTabs(viewName) {
  const section = sectionOf(viewName);
  if (section === viewName) return; // звичайний view, не хаб
  const hub = document.querySelector(`.view[data-view="${section}"]`);
  if (!hub) return;
  hub.querySelectorAll('.hub-tab').forEach(t =>
    /** @type {HTMLElement} */ (t).classList.toggle('active', /** @type {HTMLElement} */ (t).dataset.view === viewName));
  hub.querySelectorAll('.hub-panel').forEach(p =>
    /** @type {HTMLElement} */ (p).classList.toggle('hidden', /** @type {HTMLElement} */ (p).dataset.panel !== viewName));
}

/** @param {string} viewName @returns {void} */
function showView(viewName) {
  const prevSection = sectionOf(currentView);
  const nextSection = sectionOf(viewName);

  // Slide-анімація — тільки коли реально змінюється секція.
  // Перемикання сабтабу всередині хабу відбувається без слайду.
  if (prevSection !== nextSection) {
    const direction = VIEW_ORDER.indexOf(nextSection) >= VIEW_ORDER.indexOf(prevSection)
      ? 'slide-in-right' : 'slide-in-left';

    document.querySelectorAll('.view').forEach(el => {
      const elH = /** @type {HTMLElement} */ (el);
      elH.classList.remove('slide-in-right', 'slide-in-left');
      const isTarget = elH.dataset.view === nextSection;
      elH.classList.toggle('hidden', !isTarget);
      if (isTarget) {
        // force reflow щоб анімація рестартувала
        void elH.offsetWidth;
        elH.classList.add(direction);
      }
    });
  }

  updateHubTabs(viewName);
  updateActiveStates(viewName);
  currentView = viewName;
  sessionStorage.setItem('portal:lastView', viewName);
  window.dispatchEvent(new CustomEvent('portal:view', { detail: { view: viewName } }));
}

function openMoreMenu() {
  const ov = /** @type {HTMLElement} */ (document.getElementById('more-menu-overlay'));
  ov.classList.remove('hidden');
  // rAF потрібен щоб браузер встиг застосувати display:flex перед transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => ov.classList.add('more-menu--open'));
  });
}

function closeMoreMenu() {
  const ov = /** @type {HTMLElement} */ (document.getElementById('more-menu-overlay'));
  ov.classList.remove('more-menu--open');
  // Ховаємо після завершення анімації (довша transition — 340мс шторка)
  setTimeout(() => ov.classList.add('hidden'), 350);
}

function init() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = /** @type {string} */ (/** @type {HTMLElement} */ (btn).dataset.view);
      showView(view);
      // Оновлення фото при кожному поверненні на головну
      if (view === 'home' && typeof Photos !== 'undefined') {
        Photos.render();
      }
    });
  });

  // Кнопка "Ще" — відкриває меню підрозділів
  const moreBtn = document.getElementById('more-nav-btn');
  if (moreBtn) {
    moreBtn.addEventListener('click', openMoreMenu);
  }

  // Пункти меню "Ще"
  document.querySelectorAll('.more-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = /** @type {HTMLElement} */ (item).dataset.view;
      if (!view) return; // напр. кнопка "Налаштування" — обробляється окремим модулем
      showView(view);
      closeMoreMenu();
      // Swipe/Map самі реагують: MapModule слухає portal:view,
      // а свайп-стек вантажиться лише при відкритті панелі (економія TMDB-запитів)
    });
  });

  // Сабтаби всередині хабів (Календар: Події/Графік/Фото, Ми: Питання/Капсула)
  document.querySelectorAll('.hub-tab[data-view]').forEach(btn => {
    btn.addEventListener('click', () => showView(/** @type {string} */ (/** @type {HTMLElement} */ (btn).dataset.view)));
  });

  // Закриття меню
  /** @type {HTMLElement} */ (document.getElementById('more-menu-close')).addEventListener('click', closeMoreMenu);
  /** @type {HTMLElement} */ (document.getElementById('more-menu-overlay')).addEventListener('click', (e) => {
    if (/** @type {HTMLElement} */ (e.target).id === 'more-menu-overlay') closeMoreMenu();
  });

  // ініціалізувати дані для стартового view після логіну
  window.addEventListener('portal:auth', () => {
    const saved = sessionStorage.getItem('portal:lastView');
    if (saved && (VIEW_ORDER.includes(saved) || SUBVIEWS[saved]) && saved !== 'home') {
      showView(saved);
    } else {
      window.dispatchEvent(new CustomEvent('portal:view', { detail: { view: currentView } }));
    }
  });
}

/** @returns {string} */
function getCurrentView() {
  return currentView;
}

export const Router = { init, showView, getCurrentView };
