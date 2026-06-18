// ============================================================
// SETTINGS MODULE
// Глобальні налаштування порталу: модалка з тумблером
// "Надсилати зміни в Telegram" (читає/пише в таблицю settings,
// ключ telegram_notifications_enabled)
// ============================================================

const Settings = (() => {

  const el = id => document.getElementById(id);
  const SETTING_KEY = 'telegram_notifications_enabled';

  async function loadEnabled() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .single();

    if (error || !data) return true; // якщо рядка ще нема — за замовчуванням увімкнено
    return data.value === 'true' || data.value === true;
  }

  async function saveEnabled(enabled) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: SETTING_KEY, value: String(enabled) }, { onConflict: 'key' });
    if (error) {
      console.error('Settings: помилка збереження', error);
      alert('Не вдалось зберегти налаштування');
      return false;
    }
    return true;
  }

  function closeModal() {
    const root = el('modal-root');
    if (root) root.innerHTML = '';
  }

  async function openSettingsModal() {
    const enabled = await loadEnabled();
    const root = el('modal-root');
    if (!root) return;

    root.innerHTML = `
      <div class="modal-overlay" id="settings-overlay">
        <div class="modal-card">
          <h3>Налаштування</h3>
          <div class="settings-row">
            <div class="settings-row-text">
              <span class="settings-row-title">Надсилати зміни в Telegram</span>
              <span class="settings-row-desc">Сповіщення про фінанси та список покупок</span>
            </div>
            <button class="tg-toggle${enabled ? ' on' : ''}" id="tg-toggle" role="switch" aria-checked="${enabled}">
              <span class="tg-toggle-knob"></span>
            </button>
          </div>
          <div class="modal-actions">
            <button class="btn-primary" id="settings-close">Готово</button>
          </div>
        </div>
      </div>`;

    const toggle = el('tg-toggle');
    toggle.addEventListener('click', async () => {
      const newState = !toggle.classList.contains('on');
      toggle.classList.toggle('on', newState);
      toggle.setAttribute('aria-checked', String(newState));
      const ok = await saveEnabled(newState);
      if (!ok) {
        // повертаємо назад, якщо не вдалось зберегти
        toggle.classList.toggle('on', !newState);
        toggle.setAttribute('aria-checked', String(!newState));
      }
    });

    el('settings-close').addEventListener('click', closeModal);
    el('settings-overlay').addEventListener('click', e => {
      if (e.target.id === 'settings-overlay') closeModal();
    });
  }

  function init() {
    const btn = el('more-menu-settings');
    if (btn) {
      btn.addEventListener('click', () => {
        const moreMenu = el('more-menu-overlay');
        if (moreMenu) moreMenu.classList.add('hidden');
        openSettingsModal();
      });
    }
  }

  return { init };
})();
