// ============================================================
// ERROR BOUNDARY — глобальний перехоплювач помилок
// • Ловить JS-помилки і unhandled promise rejections
// • Мережеві помилки — показує тост знизу
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
// ============================================================

import { Retry } from './retry.js';

// ── ТОСТ (маленьке повідомлення знизу) ───────────────────
/**
 * @param {string} msg
 * @param {'success' | 'warn' | 'error'} [type]
 * @returns {void}
 */
function showToast(msg, type = 'error') {
  const prev = document.getElementById('eb-toast');
  if (prev) prev.remove();

  const toast = document.createElement('div');
  toast.id = 'eb-toast';
  toast.className = 'eb-toast eb-toast--' + type;
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('eb-toast--show'));
  });

  setTimeout(() => {
    toast.classList.remove('eb-toast--show');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ── ІНІЦІАЛІЗАЦІЯ ────────────────────────────────────────
/** @returns {void} */
function init() {
  // Мережеві помилки → тост
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e.reason?.message || e.reason || '');
    if (!msg) return;

    e.preventDefault(); // не логуємо в консоль браузера

    if (Retry.isRetryable(e.reason)) {
      showToast("Немає з'єднання. Дані можуть бути застарілими.");
      return;
    }

    // Supabase auth errors — ігноруємо (обробляються в Auth)
    if (msg.toLowerCase().includes('jwt') ||
        msg.toLowerCase().includes('auth') ||
        msg.toLowerCase().includes('session')) return;

    console.error('[ErrorBoundary] unhandled:', e.reason);
    // Серйозні помилки — просто тост, не ламаємо сайт
    showToast('Сталася помилка. Якщо щось не працює — оновіть сторінку.');
  });

  // JS-помилки → лише консоль (не показуємо екран, бо може бути у third-party)
  window.addEventListener('error', (e) => {
    if (e.error && !String(e.message).includes('Script error')) {
      console.error('[ErrorBoundary] JS error:', e.error);
    }
  });
}

export const ErrorBoundary = { init, showToast };
