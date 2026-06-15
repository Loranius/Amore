// ============================================================
// ROUTER MODULE
// Перемикання між view (counter / calendar / wishlist)
// ============================================================

const Router = (() => {
  let currentView = 'home';

  // Розділи, що живуть під кнопкою "Ще"
  const MORE_VIEWS = ['calendar', 'capsule', 'question', 'media'];

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
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('hidden', el.dataset.view !== viewName);
    });
    updateActiveStates(viewName);
    currentView = viewName;
    window.dispatchEvent(new CustomEvent('portal:view', { detail: { view: viewName } }));
  }

  function openMoreMenu() {
    document.getElementById('more-menu-overlay').classList.remove('hidden');
  }

  function closeMoreMenu() {
    document.getElementById('more-menu-overlay').classList.add('hidden');
  }

  function init() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });

    // Кнопка "Ще" — відкриває меню підрозділів
    const moreBtn = document.getElementById('more-nav-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', openMoreMenu);
    }

    // Пункти меню "Ще"
    document.querySelectorAll('.more-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        showView(item.dataset.view);
        closeMoreMenu();
      });
    });

    // Закриття меню
    document.getElementById('more-menu-close').addEventListener('click', closeMoreMenu);
    document.getElementById('more-menu-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'more-menu-overlay') closeMoreMenu();
    });

    // Полароїд-картки на головній — навігація до відповідних view
    document.querySelectorAll('[data-view-link]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showView(link.dataset.viewLink);
      });
    });

    // ініціалізувати дані для стартового view після логіну
    window.addEventListener('portal:auth', () => {
      window.dispatchEvent(new CustomEvent('portal:view', { detail: { view: currentView } }));
    });
  }

  function getCurrentView() {
    return currentView;
  }

  return { init, showView, getCurrentView };
})();
