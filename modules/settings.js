// ============================================================
// SETTINGS MODULE
// — Telegram toggle
// — Менеджер фото полароїда: завантаження, перегляд, видалення
// ============================================================

const Settings = (() => {

  const el = id => document.getElementById(id);
  const SETTING_KEY = 'telegram_notifications_enabled';
  const STORAGE_BASE = 'https://yicalgoqegluzuagxssk.supabase.co/storage/v1/object/public/family_photos';
  const BUCKET = 'family_photos';

  // ============================================================
  // TELEGRAM TOGGLE
  // ============================================================

  async function loadEnabled() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .single();
    if (error || !data) return true;
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

  // ============================================================
  // ФОТО-МЕНЕДЖЕР
  // ============================================================

  // Повертає список файлів із бакету
  async function listPhotos() {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) { console.error('listPhotos error:', error); return []; }
    // Фільтруємо лише зображення
    return (data || []).filter(f => f.name && /\.(jpe?g|png|webp|gif)$/i.test(f.name));
  }

  // Завантажує один файл; повертає { name, url } або null
  async function uploadPhoto(file) {
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const safeName = `photo_${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(safeName, file, { upsert: false, contentType: file.type });
    if (error) { console.error('uploadPhoto error:', error); return null; }
    return { name: safeName, url: `${STORAGE_BASE}/${safeName}` };
  }

  // Видаляє файл
  async function deletePhoto(name) {
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) { console.error('deletePhoto error:', error); return false; }
    return true;
  }

  // ============================================================
  // РЕНДЕР МОДАЛКИ
  // ============================================================

  function closeModal() {
    const root = el('modal-root');
    if (root) root.innerHTML = '';
  }

  async function openSettingsModal() {
    const root = el('modal-root');
    if (!root) return;

    // Показуємо скелет одразу
    root.innerHTML = `
      <div class="modal-overlay" id="settings-overlay">
        <div class="modal-card settings-modal-card">
          <h3>Налаштування</h3>

          <!-- Telegram toggle -->
          <div class="settings-row" id="tg-row">
            <div class="settings-row-text">
              <span class="settings-row-title">Надсилати зміни в Telegram</span>
              <span class="settings-row-desc">Сповіщення про фінанси та список покупок</span>
            </div>
            <button class="tg-toggle" id="tg-toggle" role="switch" aria-checked="false">
              <span class="tg-toggle-knob"></span>
            </button>
          </div>

          <div class="settings-divider"></div>

          <!-- Фото полароїда -->
          <div class="settings-section-title">Фото полароїда 🖼</div>
          <p class="settings-section-desc">Фото з'являються на головному екрані. Рекомендований формат — квадрат.</p>

          <!-- Upload зона -->
          <label class="photo-upload-zone" id="photo-upload-zone" for="photo-file-input">
            <span class="photo-upload-icon">＋</span>
            <span class="photo-upload-label">Додати фото</span>
            <input type="file" id="photo-file-input" accept="image/*" multiple style="display:none">
          </label>

          <!-- Прогрес -->
          <div class="photo-upload-progress hidden" id="photo-upload-progress">
            <div class="photo-upload-bar" id="photo-upload-bar"></div>
            <span class="photo-upload-status" id="photo-upload-status">Завантаження…</span>
          </div>

          <!-- Сітка фото -->
          <div class="photo-manager-grid" id="photo-manager-grid">
            <div class="photo-manager-loading">Завантаження…</div>
          </div>

          <div class="modal-actions">
            <button class="btn-primary" id="settings-close">Готово</button>
          </div>
        </div>
      </div>`;

    // --- Telegram toggle ---
    const enabled = await loadEnabled();
    const toggle = el('tg-toggle');
    toggle.classList.toggle('on', enabled);
    toggle.setAttribute('aria-checked', String(enabled));
    toggle.addEventListener('click', async () => {
      const newState = !toggle.classList.contains('on');
      toggle.classList.toggle('on', newState);
      toggle.setAttribute('aria-checked', String(newState));
      const ok = await saveEnabled(newState);
      if (!ok) {
        toggle.classList.toggle('on', !newState);
        toggle.setAttribute('aria-checked', String(!newState));
      }
    });

    // --- Закрити ---
    el('settings-close').addEventListener('click', closeModal);
    el('settings-overlay').addEventListener('click', e => {
      if (e.target.id === 'settings-overlay') closeModal();
    });

    // --- Завантаження фото ---
    renderPhotoGrid();
    setupUpload();
  }

  // ---- Сітка завантажених фото ----
  async function renderPhotoGrid() {
    const grid = el('photo-manager-grid');
    if (!grid) return;

    const photos = await listPhotos();

    if (!photos.length) {
      grid.innerHTML = '<p class="photo-manager-empty">Фото ще немає. Додай перше!</p>';
      return;
    }

    grid.innerHTML = '';
    photos.forEach(photo => {
      const url = `${STORAGE_BASE}/${photo.name}`;
      const thumb = document.createElement('div');
      thumb.className = 'photo-manager-thumb';
      thumb.innerHTML = `
        <img src="${url}" alt="" loading="lazy">
        <button class="photo-manager-del" data-name="${photo.name}" title="Видалити">✕</button>`;
      thumb.querySelector('.photo-manager-del').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Видалити це фото з полароїда?')) return;
        thumb.classList.add('deleting');
        const ok = await deletePhoto(photo.name);
        if (ok) {
          thumb.remove();
          // Оновлюємо пул і перерисовуємо полароїд
          Photos.reloadPool();
          // Показуємо empty якщо нічого не лишилось
          const g = el('photo-manager-grid');
          if (g && !g.querySelector('.photo-manager-thumb')) {
            g.innerHTML = '<p class="photo-manager-empty">Фото ще немає. Додай перше!</p>';
          }
        } else {
          alert('Не вдалось видалити фото');
          thumb.classList.remove('deleting');
        }
      });
      grid.appendChild(thumb);
    });
  }

  // ---- Upload ----
  function setupUpload() {
    const zone = el('photo-upload-zone');
    const input = el('photo-file-input');
    const progress = el('photo-upload-progress');
    const bar = el('photo-upload-bar');
    const status = el('photo-upload-status');
    if (!zone || !input) return;

    // Клік по зоні
    zone.addEventListener('click', () => input.click());

    // Drag & drop
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      handleFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
    });

    input.addEventListener('change', () => {
      handleFiles([...input.files]);
      input.value = '';
    });

    async function handleFiles(files) {
      if (!files.length) return;

      zone.classList.add('uploading');
      progress.classList.remove('hidden');
      bar.style.width = '0%';

      let done = 0;
      const total = files.length;
      const newUrls = [];

      for (const file of files) {
        status.textContent = `Завантажується ${done + 1} з ${total}…`;
        const result = await uploadPhoto(file);
        done++;
        bar.style.width = `${Math.round((done / total) * 100)}%`;

        if (result) {
          newUrls.push(result.url);
          // Додаємо прев'ю одразу
          addThumbToGrid(result.name, result.url);
          // Видаляємо empty-state якщо є
          const emptyEl = el('photo-manager-grid')?.querySelector('.photo-manager-empty');
          if (emptyEl) emptyEl.remove();
        }
      }

      status.textContent = `Готово! Завантажено ${done} з ${total}`;
      setTimeout(() => {
        progress.classList.add('hidden');
        zone.classList.remove('uploading');
      }, 1500);

      // Перезавантажуємо пул і оновлюємо полароїд
      if (newUrls.length) {
        Photos.reloadPool();
      }
    }
  }

  function addThumbToGrid(name, url) {
    const grid = el('photo-manager-grid');
    if (!grid) return;

    const thumb = document.createElement('div');
    thumb.className = 'photo-manager-thumb new-thumb';
    thumb.innerHTML = `
      <img src="${url}" alt="" loading="lazy">
      <button class="photo-manager-del" data-name="${name}" title="Видалити">✕</button>`;

    // Вставляємо першим
    grid.insertBefore(thumb, grid.firstChild);

    // Анімація появи
    requestAnimationFrame(() => thumb.classList.remove('new-thumb'));

    thumb.querySelector('.photo-manager-del').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Видалити це фото з полароїда?')) return;
      thumb.classList.add('deleting');
      const ok = await deletePhoto(name);
      if (ok) {
        thumb.remove();
        Photos.reloadPool();
        const g = el('photo-manager-grid');
        if (g && !g.querySelector('.photo-manager-thumb')) {
          g.innerHTML = '<p class="photo-manager-empty">Фото ще немає. Додай перше!</p>';
        }
      } else {
        alert('Не вдалось видалити фото');
        thumb.classList.remove('deleting');
      }
    });
  }

  // ============================================================
  // INIT
  // ============================================================

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
