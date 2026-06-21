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
    let blob = file, ext = (file.name.split('.').pop() || 'jpg').toLowerCase(), contentType = file.type;
    try {
      const out = await Img.compress(file, 1280, 0.78); // ~1280px, WebP/JPEG
      blob = out.blob; ext = out.ext; contentType = out.contentType;
    } catch (e) { console.warn('uploadPhoto: стиснення не вдалося, заливаю оригінал', e); }

    const safeName = `photo_${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(safeName, blob, { upsert: false, contentType });
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

          <!-- Темна тема toggle -->
          <div class="settings-row" id="theme-row">
            <div class="settings-row-text">
              <span class="settings-row-title">Темна тема 🌙</span>
              <span class="settings-row-desc">Нічний режим для зручності</span>
            </div>
            <button class="tg-toggle" id="theme-toggle" role="switch" aria-checked="false">
              <span class="tg-toggle-knob"></span>
            </button>
          </div>

          <div class="settings-divider"></div>

          <!-- Розміри -->
          <div class="settings-section-title">Розміри 📏</div>
          <div id="settings-sizes-wrap"></div>

          <div class="settings-divider"></div>

          <!-- Фото полароїда -->
          <div class="settings-section-title">Фото полароїда 🖼</div>
          <p class="settings-section-desc">Фото з'являються на головному екрані. Рекомендований формат — квадрат.</p>

          <!-- Upload зона -->
          <label class="photo-upload-zone" id="photo-upload-zone">
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

    // --- Темна тема toggle ---
    const isDark = document.documentElement.dataset.theme === 'dark';
    const themeToggle = el('theme-toggle');
    if (themeToggle) {
      themeToggle.classList.toggle('on', isDark);
      themeToggle.setAttribute('aria-checked', String(isDark));
      themeToggle.addEventListener('click', () => {
        const nowDark = document.documentElement.dataset.theme === 'dark';
        const next    = nowDark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('amore:theme', next);
        themeToggle.classList.toggle('on', next === 'dark');
        themeToggle.setAttribute('aria-checked', String(next === 'dark'));
      });
    }

    // --- Закрити ---
    el('settings-close').addEventListener('click', closeModal);
    el('settings-overlay').addEventListener('click', e => {
      if (e.target.id === 'settings-overlay') closeModal();
    });

    // --- Розміри ---
    renderSizesInSettings();

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
  // РОЗМІРИ В НАЛАШТУВАННЯХ
  // ============================================================

  async function renderSizesInSettings() {
    const wrap = el('settings-sizes-wrap');
    if (!wrap) return;

    // Отримуємо юзерів
    const { data: users } = await supabase.from('users').select('id,name').order('id', { ascending: true });
    if (!users || !users.length) return;

    const currentUser = Auth.getCurrentUser();
    let activeSizesUserId = currentUser?.id || users[0].id;

    async function loadAndRender() {
      const { data: sizes } = await supabase.from('user_sizes').select('*').eq('user_id', activeSizesUserId).single();
      const sz = sizes || {};
      const activeUser = users.find(u => u.id === activeSizesUserId);
      const isFemale = activeUser?.name === 'Лєна';

      wrap.innerHTML = `
        <div class="sz-user-switcher" style="margin-bottom:12px">
          ${users.map(u => `<button class="sz-user-btn${u.id===activeSizesUserId?' active':''}" data-uid="${u.id}">${u.name==='Діма'?'🧔':'👩'} ${u.name}</button>`).join('')}
        </div>
        <div class="sizes-grid">
          <div class="sizes-group">
            <div class="sizes-group-title">📏 Базові габарити</div>
            <div class="sizes-row"><span>Зріст</span><b>${sz.height||'—'} см</b></div>
            <div class="sizes-row"><span>Груди</span><b>${sz.chest||'—'} см</b></div>
            <div class="sizes-row"><span>Талія</span><b>${sz.waist||'—'} см</b></div>
            <div class="sizes-row"><span>Стегна</span><b>${sz.hips||'—'} см</b></div>
          </div>
          <div class="sizes-group">
            <div class="sizes-group-title">👗 Одяг</div>
            <div class="sizes-row"><span>Міжнар.</span><b>${sz.intl_size||'—'}</b></div>
            <div class="sizes-row"><span>EU</span><b>${sz.eu_size||'—'}</b></div>
            <div class="sizes-row"><span>UA</span><b>${sz.ua_size||'—'}</b></div>
          </div>
          <div class="sizes-group">
            <div class="sizes-group-title">👟 Взуття</div>
            <div class="sizes-row"><span>Устілка</span><b>${sz.insole_cm||'—'} см</b></div>
            <div class="sizes-row"><span>EU</span><b>${sz.shoe_eu||'—'}</b></div>
            <div class="sizes-row"><span>US</span><b>${sz.shoe_us||'—'}</b></div>
          </div>
          ${isFemale?`<div class="sizes-group">
            <div class="sizes-group-title">🩱 Нижня білизна</div>
            <div class="sizes-row"><span>Бюстгальтер</span><b>${sz.bra||'—'}</b></div>
            <div class="sizes-row"><span>Труси</span><b>${sz.underwear||'—'}</b></div>
          </div>`:''}
          <div class="sizes-group">
            <div class="sizes-group-title">💍 Аксесуари</div>
            <div class="sizes-row"><span>Каблучка (безім.)</span><b>${sz.ring_ring||'—'}</b></div>
            <div class="sizes-row"><span>Каблучка (вказ.)</span><b>${sz.ring_index||'—'}</b></div>
          </div>
        </div>
        <button class="btn-secondary" id="settings-sizes-edit" style="width:100%;margin-top:8px">✏️ Редагувати розміри</button>`;

      wrap.querySelectorAll('.sz-user-btn').forEach(btn => {
        btn.addEventListener('click', () => { activeSizesUserId = +btn.dataset.uid; loadAndRender(); });
      });

      wrap.querySelector('#settings-sizes-edit')?.addEventListener('click', () => {
        openSizesEditModal(sz, activeSizesUserId, isFemale, () => loadAndRender());
      });
    }

    loadAndRender();
  }

  function openSizesEditModal(sizes, userId, isFemale, onSave) {
    const root = el('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="max-height:85vh;overflow-y:auto">
        <h3>Розміри</h3>
        <div class="sizes-form-group"><div class="sizes-group-title">📏 Базові</div>
          <div class="form-field"><label>Зріст (см)</label><input class="fin-inp" id="sz-height" type="number" value="${sizes.height||''}"></div>
          <div class="form-field"><label>Груди (см)</label><input class="fin-inp" id="sz-chest" type="number" value="${sizes.chest||''}"></div>
          <div class="form-field"><label>Талія (см)</label><input class="fin-inp" id="sz-waist" type="number" value="${sizes.waist||''}"></div>
          <div class="form-field"><label>Стегна (см)</label><input class="fin-inp" id="sz-hips" type="number" value="${sizes.hips||''}"></div>
        </div>
        <div class="sizes-form-group"><div class="sizes-group-title">👗 Одяг</div>
          <div class="form-field"><label>Міжнар.</label><input class="fin-inp" id="sz-intl" type="text" value="${sizes.intl_size||''}"></div>
          <div class="form-field"><label>EU</label><input class="fin-inp" id="sz-eu" type="text" value="${sizes.eu_size||''}"></div>
          <div class="form-field"><label>UA</label><input class="fin-inp" id="sz-ua" type="text" value="${sizes.ua_size||''}"></div>
        </div>
        <div class="sizes-form-group"><div class="sizes-group-title">👟 Взуття</div>
          <div class="form-field"><label>Устілка (см)</label><input class="fin-inp" id="sz-insole" type="number" step="0.5" value="${sizes.insole_cm||''}"></div>
          <div class="form-field"><label>EU</label><input class="fin-inp" id="sz-shoe-eu" type="text" value="${sizes.shoe_eu||''}"></div>
          <div class="form-field"><label>US</label><input class="fin-inp" id="sz-shoe-us" type="text" value="${sizes.shoe_us||''}"></div>
        </div>
        ${isFemale?`<div class="sizes-form-group"><div class="sizes-group-title">🩱 Нижня білизна</div>
          <div class="form-field"><label>Бюстгальтер</label><input class="fin-inp" id="sz-bra" type="text" value="${sizes.bra||''}"></div>
          <div class="form-field"><label>Труси</label><input class="fin-inp" id="sz-underwear" type="text" value="${sizes.underwear||''}"></div>
        </div>`:''}
        <div class="sizes-form-group"><div class="sizes-group-title">💍 Каблучки</div>
          <div class="form-field"><label>Безіменний</label><input class="fin-inp" id="sz-ring" type="text" value="${sizes.ring_ring||''}"></div>
          <div class="form-field"><label>Вказівний</label><input class="fin-inp" id="sz-ring-idx" type="text" value="${sizes.ring_index||''}"></div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="sz-cancel">Скасувати</button>
          <button class="btn-primary" id="sz-save">Зберегти</button>
        </div>
      </div>`;
    root.innerHTML = ''; root.appendChild(overlay);
    overlay.querySelector('#sz-cancel').addEventListener('click', () => root.innerHTML = '');
    overlay.addEventListener('click', e => { if (e.target === overlay) root.innerHTML = ''; });
    overlay.querySelector('#sz-save').addEventListener('click', async () => {
      const g = id => overlay.querySelector('#' + id);
      const { error } = await supabase.from('user_sizes').upsert({
        user_id: userId,
        height: parseFloat(g('sz-height')?.value)||null, chest: parseFloat(g('sz-chest')?.value)||null,
        waist: parseFloat(g('sz-waist')?.value)||null, hips: parseFloat(g('sz-hips')?.value)||null,
        intl_size: g('sz-intl')?.value.trim()||null, eu_size: g('sz-eu')?.value.trim()||null,
        ua_size: g('sz-ua')?.value.trim()||null, insole_cm: parseFloat(g('sz-insole')?.value)||null,
        shoe_eu: g('sz-shoe-eu')?.value.trim()||null, shoe_us: g('sz-shoe-us')?.value.trim()||null,
        bra: g('sz-bra')?.value.trim()||null, underwear: g('sz-underwear')?.value.trim()||null,
        ring_ring: g('sz-ring')?.value.trim()||null, ring_index: g('sz-ring-idx')?.value.trim()||null,
      }, { onConflict: 'user_id' });
      if (error) { alert('Помилка: ' + error.message); return; }
      if (window.DataCache) DataCache.invalidate('sizes:' + userId);
      root.innerHTML = '';
      if (onSave) onSave();
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
