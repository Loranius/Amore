// ============================================================
// ROUTER MODULE
// Перемикання між view (counter / calendar / wishlist)
// ============================================================

const Router = (() => {
  let currentView = 'home';

  // Порядок вкладок для визначення напрямку slide
  const VIEW_ORDER = ['home', 'wishlist', 'budget', 'random', 'calendar', 'capsule', 'question', 'media', 'map', 'shopping', 'photo-calendar', 'schedule'];

  // Розділи, що живуть під кнопкою «Ще» (мають підсвічувати «Ще»)
  const MORE_VIEWS = ['calendar', 'capsule', 'question', 'media', 'map', 'random', 'photo-calendar', 'schedule'];

  function updateActiveStates(viewName) {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    const moreBtn = document.getElementById('more-nav-btn');
    if (moreBtn) {
      moreBtn.classList.toggle('active', MORE_VIEWS.includes(viewName));
    }
  }

  function showView(viewName) {
    const prevIndex = VIEW_ORDER.indexOf(currentView);
    const nextIndex = VIEW_ORDER.indexOf(viewName);
    const direction = nextIndex >= prevIndex ? 'slide-in-right' : 'slide-in-left';

    document.querySelectorAll('.view').forEach(el => {
      el.classList.remove('slide-in-right', 'slide-in-left');
      const isTarget = el.dataset.view === viewName;
      el.classList.toggle('hidden', !isTarget);
      if (isTarget && currentView !== viewName) {
        // force reflow щоб анімація рестартувала
        void el.offsetWidth;
        el.classList.add(direction);
      }
    });

    updateActiveStates(viewName);
    currentView = viewName;
    sessionStorage.setItem('portal:lastView', viewName);
    window.dispatchEvent(new CustomEvent('portal:view', { detail: { view: viewName } }));
  }

  function openMoreMenu() {
    const ov = document.getElementById('more-menu-overlay');
    ov.classList.remove('hidden');
    // rAF потрібен щоб браузер встиг застосувати display:flex перед transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ov.classList.add('more-menu--open'));
    });
  }

  function closeMoreMenu() {
    const ov = document.getElementById('more-menu-overlay');
    ov.classList.remove('more-menu--open');
    // Ховаємо після завершення анімації (довша transition — 340мс шторка)
    setTimeout(() => ov.classList.add('hidden'), 350);
  }

  function init() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        showView(btn.dataset.view);
        // Оновлення фото при кожному поверненні на головну
        if (btn.dataset.view === 'home' && typeof Photos !== 'undefined') {
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
        const view = item.dataset.view;
        if (!view) return; // напр. кнопка "Налаштування" — обробляється окремим модулем
        showView(view);
        closeMoreMenu();
        // Swipe/Map самі реагують: MapModule слухає portal:view,
        // а свайп-стек вантажиться лише при відкритті панелі (економія TMDB-запитів)
      });
    });

    // Закриття меню
    document.getElementById('more-menu-close').addEventListener('click', closeMoreMenu);
    document.getElementById('more-menu-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'more-menu-overlay') closeMoreMenu();
    });

    // ініціалізувати дані для стартового view після логіну
    window.addEventListener('portal:auth', () => {
      const saved = sessionStorage.getItem('portal:lastView');
      if (saved && VIEW_ORDER.includes(saved) && saved !== 'home') {
        showView(saved);
      } else {
        window.dispatchEvent(new CustomEvent('portal:view', { detail: { view: currentView } }));
      }
    });
  }

  function getCurrentView() {
    return currentView;
  }

  return { init, showView, getCurrentView };
})();
