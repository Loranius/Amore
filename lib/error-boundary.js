// ============================================================
// ERROR BOUNDARY — глобальний перехоплювач помилок
// • Ловить JS-помилки і unhandled promise rejections
// • Показує красивий екран помилки замість білого екрану
// • Мережеві помилки — тільки тост, не повний екран
// • wrapView(name, fn) — безпечна обгортка для refresh-функцій модулів
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
// ============================================================

import { Retry } from './retry.js';

let errorScreenShown = false;

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

// ── ПОВНИЙ ЕКРАН ПОМИЛКИ ──────────────────────────────────
/**
 * @param {string} [title]
 * @param {string} [detail]
 * @returns {void}
 */
function showErrorScreen(title, detail) {
  if (errorScreenShown) return;
  errorScreenShown = true;

  // Ховаємо контент
  const app = /** @type {HTMLElement | null} */ (document.querySelector('.app'));
  if (app) app.style.display = 'none';

  const screen = document.createElement('div');
  screen.id = 'eb-screen';
  screen.className = 'eb-screen';
  screen.innerHTML = `
    <div class="eb-card">
      <div class="eb-icon">🌸</div>
      <h2 class="eb-title">${title || 'Щось пішло не так'}</h2>
      <p class="eb-desc">${detail || 'Сталася непередбачена помилка. Спробуй оновити сторінку.'}</p>
      <button class="btn-primary eb-reload-btn" onclick="location.reload()">
        Оновити сторінку
      </button>
      <button class="btn-secondary eb-continue-btn">
        Спробувати далі
      </button>
    </div>`;

  document.body.appendChild(screen);

  screen.querySelector('.eb-continue-btn')?.addEventListener('click', () => {
    screen.remove();
    if (app) app.style.display = '';
    errorScreenShown = false;
  });
}

// ── БЕЗПЕЧНА ОБГОРТКА ДЛЯ МОДУЛІВ ───────────────────────
// Використовується в refresh-функціях:
//   async function refresh() {
//     ErrorBoundary.wrapView('Calendar', async () => { ... });
//   }
/**
 * @param {string} moduleName
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<void>}
 */
async function wrapView(moduleName, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`[${moduleName}]`, err);
    const isNetwork = Retry.isRetryable(err);
    const e = /** @type {{ message?: unknown }} */ (typeof err === 'object' && err !== null ? err : {});
    if (isNetwork) {
      showToast(`Немає з'єднання — ${moduleName} не оновився`);
    } else {
      showToast(`Помилка у ${moduleName}: ${e.message ? String(e.message) : 'невідома помилка'}`);
    }
  }
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

export const ErrorBoundary = { init, showToast, showErrorScreen, wrapView };

// window.X = X — стандартний спосіб публікувати глобаль у цьому проєкті
// (немає модулів). Той самий "немає білду" виняток, що й для DataCache/Retry.
