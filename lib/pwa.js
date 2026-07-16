// ============================================================
// PWA INSTALL BANNER
// Показує кастомний банер «Додати на головний екран»
// після того, як браузер дозволить встановлення.
// Банер з'являється один раз (запам'ятовується в localStorage).
// ============================================================
const LS_KEY   = 'amore:pwa-banner-dismissed';
const DELAY_MS = 30_000; // показати через 30 с після входу

/** @type {BeforeInstallPromptEvent | null} */
let deferredPrompt = null;

/** @returns {HTMLDivElement} */
function build() {
  const banner = document.createElement('div');
  banner.className = 'pwa-banner';
  banner.id = 'pwa-banner';
  banner.innerHTML = `
    <div class="pwa-banner-icon">💕</div>
    <div class="pwa-banner-text">
      <p class="pwa-banner-title">Додати на головний екран</p>
      <p class="pwa-banner-sub">Відкривай Портал бубосів як додаток</p>
    </div>
    <button class="pwa-banner-install" id="pwa-install-btn">Додати</button>
    <button class="pwa-banner-close"  id="pwa-close-btn">✕</button>`;
  document.body.appendChild(banner);
  return banner;
}

/** @param {HTMLDivElement} banner @returns {void} */
function show(banner) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add('pwa-banner--show'));
  });
}

/** @param {HTMLDivElement} banner @returns {void} */
function dismiss(banner) {
  banner.classList.remove('pwa-banner--show');
  localStorage.setItem(LS_KEY, '1');
  setTimeout(() => banner.remove(), 350);
}

function init() {
  if (localStorage.getItem(LS_KEY)) return; // вже показували

  // Перехоплюємо браузерну подію
  window.addEventListener('beforeinstallprompt', (/** @type {any} */ e) => {
    e.preventDefault();
    deferredPrompt = e;

    setTimeout(() => {
      const banner = build();
      show(banner);

      document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
        dismiss(banner);
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.info('[PWA] outcome:', outcome);
        deferredPrompt = null;
      });

      document.getElementById('pwa-close-btn')?.addEventListener('click', () => {
        dismiss(banner);
      });
    }, DELAY_MS);
  });
}

export const PWABanner = { init };

