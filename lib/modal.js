// ============================================================
// MODAL — глобальна анімована закривалка модалок (ESM)
// ------------------------------------------------------------
// Раніше жила як inline-функція в index.html і вживалась усіма
// модулями через глобаль. Після переходу на ES-модулі винесена сюди
// й імпортується явно:  import { closeModalAnimated } from '../lib/modal.js';
// ============================================================

/**
 * Плавно закриває верхню модалку в контейнері (за замовч. #modal-root).
 * Прибирає САМ overlay, а не root.innerHTML — щоб нова модалка, відкрита
 * одразу після закриття старої, не зникала разом зі старою.
 * @param {string} [rootId]
 * @returns {void}
 */
export function closeModalAnimated(rootId) {
  const root = document.getElementById(rootId || 'modal-root');
  if (!root) return;
  const overlay = root.querySelector('.modal-overlay:not(.is-closing)');
  if (!overlay) return;
  overlay.classList.add('is-closing');
  // Fallback: якщо animationend не стріляє (напр. reduced-motion) — прибираємо через 250ms
  const fallback = setTimeout(function () { overlay.remove(); }, 250);
  overlay.addEventListener('animationend', function () {
    clearTimeout(fallback);
    overlay.remove();
  }, { once: true });
}
