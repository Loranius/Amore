// ============================================================
// ROUTER MODULE
// Перемикання між view (counter / calendar / wishlist)
// ============================================================

const Router = (() => {
  let currentView = 'calendar';

  function showView(viewName) {
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('hidden', el.dataset.view !== viewName);
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    currentView = viewName;
    window.dispatchEvent(new CustomEvent('portal:view', { detail: { view: viewName } }));
  }

  function init() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
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
