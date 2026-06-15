// ============================================================
// MEDIA MODULE v3
// — Фільтр-кнопки по статусу (не групи)
// — Завантаження постера з телефону в Supabase Storage
// — Редагування після створення
// — Рейтинг + коментарі від кожного
// ============================================================

const Media = (() => {

  const STORAGE_BUCKET = 'media-posters';
  const SUPA_URL = 'https://yicalgoqegluzuagxssk.supabase.co';

  // ---------- Статуси ----------
  const STATUS_CONFIG = {
    movie:  {
      want:     'В планах',
      watching: 'Дивимось',
      done:     'Бачили',
      dropped:  'Кинули',
    },
    series: {
      want:     'В планах',
      watching: 'Дивимось',
      done:     'Бачили',
      dropped:  'Кинули',
    },
    book: {
      want:     'Планую',
      watching: 'Читаю',
      done:     'Прочитала/в',
      dropped:  'Кинула/в',
    },
  };

  const STATUS_ORDER = ['watching', 'want', 'done', 'dropped'];

  const TYPE_LABELS = { movie: 'Фільм', series: 'Серіал', book: 'Книга' };

  let activeType = 'movie';
  let activeFilter = 'all'; // 'all' | status key
  let allItems = [];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---------- Завантаження ----------
  async function loadItems(type) {
    const { data, error } = await supabase
      .from('media_items')
      .select('id, type, title, status, poster_url, rating_dima, rating_lena, comment_dima, comment_lena, created_by')
      .eq('type', type);
    if (error) { console.error('loadItems error:', error); return []; }
    return data || [];
  }

  // ---------- Завантаження постера ----------
  async function uploadPoster(file, itemId) {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${activeType}-${itemId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) { console.error('uploadPoster error:', error); return null; }

    return `${SUPA_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
  }

  // ---------- Фільтр-кнопки ----------
  function renderFilters() {
    const wrap = document.getElementById('media-filters');
    if (!wrap) return;

    const conf = STATUS_CONFIG[activeType];
    const allCount = allItems.length;

    let html = `<button class="media-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Всі (${allCount})</button>`;

    STATUS_ORDER.forEach(status => {
      const count = allItems.filter(i => i.status === status).length;
      if (!count) return;
      html += `<button class="media-filter-btn ${activeFilter === status ? 'active' : ''}" data-filter="${status}">${conf[status]} (${count})</button>`;
    });

    wrap.innerHTML = html;

    wrap.querySelectorAll('.media-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        renderFilters();
        renderGrid();
      });
    });
  }

  // ---------- Статистика ----------
  function renderStats() {
    const wrap = document.getElementById('media-stats');
    if (!wrap) return;

    const ratings = [
      ...allItems.map(i => i.rating_dima).filter(Boolean),
      ...allItems.map(i => i.rating_lena).filter(Boolean),
    ];
    const avgRating = ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

    wrap.innerHTML = avgRating
      ? `<div class="media-stat"><span class="media-stat-num">★ ${avgRating}</span><span class="media-stat-label">сер. рейтинг</span></div>`
      : '';
  }

  // ---------- Grid ----------
  function renderGrid() {
    const wrap = document.getElementById('media-list');
    const conf = STATUS_CONFIG[activeType];

    const items = activeFilter === 'all'
      ? [...allItems].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
      : allItems.filter(i => i.status === activeFilter);

    if (!items.length) {
      wrap.innerHTML = '<p class="empty-state">Тут порожньо. Додай щось!</p>';
      return;
    }

    wrap.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'media-grid';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';

      const statusLabel = conf[item.status] || item.status;
      const poster = item.poster_url
        ? `<img class="media-poster" src="${escapeHtml(item.poster_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="media-poster-placeholder">🎬</div>`;

      const rDima = item.rating_dima ? `${item.rating_dima}/10` : '—';
      const rLena = item.rating_lena ? `${item.rating_lena}/10` : '—';

      card.innerHTML = `
        <button class="delete-btn media-card-delete" data-delete-id="${item.id}">×</button>
        <button class="media-edit-icon" data-edit-id="${item.id}">✏️</button>
        ${poster}
        <div class="media-card-body">
          <p class="media-card-title">${escapeHtml(item.title)}</p>
          <span class="media-status-badge">${statusLabel}</span>
          <div class="media-ratings">
            <div class="media-rating-row">
              <span class="media-rating-name">Діма</span>
              <span class="${item.rating_dima ? 'media-rating-val' : 'media-rating-empty'}">${rDima}</span>
              <button class="media-rate-btn" data-rate-id="${item.id}" data-rate-who="dima">✏️</button>
            </div>
            <div class="media-rating-row">
              <span class="media-rating-name">Лєна</span>
              <span class="${item.rating_lena ? 'media-rating-val' : 'media-rating-empty'}">${rLena}</span>
              <button class="media-rate-btn" data-rate-id="${item.id}" data-rate-who="lena">✏️</button>
            </div>
          </div>
          ${item.comment_dima ? `<p class="media-comment"><b>Діма:</b> ${escapeHtml(item.comment_dima)}</p>` : ''}
          ${item.comment_lena ? `<p class="media-comment"><b>Лєна:</b> ${escapeHtml(item.comment_lena)}</p>` : ''}
        </div>
      `;
      grid.appendChild(card);
    });

    wrap.appendChild(grid);

    wrap.querySelectorAll('[data-delete-id]').forEach(btn =>
      btn.addEventListener('click', () => deleteItem(btn.dataset.deleteId))
    );
    wrap.querySelectorAll('[data-rate-id]').forEach(btn =>
      btn.addEventListener('click', () => openRatingModal(btn.dataset.rateId, btn.dataset.rateWho))
    );
    wrap.querySelectorAll('[data-edit-id]').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.editId))
    );
  }

  // ---------- Видалення ----------
  async function deleteItem(id) {
    if (!confirm('Видалити цей елемент?')) return;
    const { error } = await supabase.from('media_items').delete().eq('id', id);
    if (error) { alert('Помилка видалення'); return; }
    refresh();
  }

  // ---------- Модалка додавання ----------
  function openAddModal() {
    const conf = STATUS_CONFIG[activeType];
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="media-modal-overlay">
        <div class="modal-card">
          <h3>Додати ${TYPE_LABELS[activeType]}</h3>
          <div class="form-field">
            <label for="media-title">Назва</label>
            <input type="text" id="media-title" placeholder="Введи назву">
          </div>
          <div class="form-field">
            <label for="media-poster-file">Постер (фото з телефону)</label>
            <input type="file" id="media-poster-file" accept="image/*">
          </div>
          <div class="form-field">
            <label for="media-status-new">Статус</label>
            <select id="media-status-new">
              ${Object.entries(conf).map(([val, label]) =>
                `<option value="${val}">${label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="media-cancel">Скасувати</button>
            <button class="btn-primary" id="media-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('media-cancel').addEventListener('click', closeModal);
    document.getElementById('media-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'media-modal-overlay') closeModal();
    });
    document.getElementById('media-save').addEventListener('click', saveItem);
  }

  async function saveItem() {
    const title = document.getElementById('media-title').value.trim();
    const status = document.getElementById('media-status-new').value;
    const fileInput = document.getElementById('media-poster-file');

    if (!title) { alert('Вкажи назву'); return; }

    const saveBtn = document.getElementById('media-save');
    saveBtn.textContent = 'Зберігаємо…';
    saveBtn.disabled = true;

    const user = Auth.getCurrentUser();

    // Спочатку створюємо запис без постера
    const { data, error } = await supabase.from('media_items').insert({
      type: activeType,
      title,
      status,
      created_by: user ? user.id : null,
    }).select('id').single();

    if (error) { alert('Не вдалось зберегти'); saveBtn.textContent = 'Зберегти'; saveBtn.disabled = false; return; }

    // Якщо є фото — завантажуємо і оновлюємо poster_url
    if (fileInput.files && fileInput.files[0]) {
      const url = await uploadPoster(fileInput.files[0], data.id);
      if (url) {
        await supabase.from('media_items').update({ poster_url: url }).eq('id', data.id);
      }
    }

    closeModal();
    refresh();
  }

  // ---------- Модалка редагування ----------
  function openEditModal(id) {
    const item = allItems.find(i => String(i.id) === String(id));
    if (!item) return;

    const conf = STATUS_CONFIG[activeType];
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="media-edit-overlay">
        <div class="modal-card">
          <h3>Редагувати</h3>
          <div class="form-field">
            <label for="edit-title">Назва</label>
            <input type="text" id="edit-title" value="${escapeHtml(item.title)}">
          </div>
          <div class="form-field">
            <label>Поточний постер</label>
            ${item.poster_url
              ? `<img src="${escapeHtml(item.poster_url)}" style="width:80px;border-radius:8px;display:block;margin-bottom:8px;">`
              : '<p style="font-size:13px;color:var(--text-muted)">Немає постера</p>'}
            <label for="edit-poster-file">Замінити постер</label>
            <input type="file" id="edit-poster-file" accept="image/*">
          </div>
          <div class="form-field">
            <label for="edit-status">Статус</label>
            <select id="edit-status">
              ${Object.entries(conf).map(([val, label]) =>
                `<option value="${val}" ${item.status === val ? 'selected' : ''}>${label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="edit-cancel">Скасувати</button>
            <button class="btn-primary" id="edit-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('edit-cancel').addEventListener('click', closeModal);
    document.getElementById('media-edit-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'media-edit-overlay') closeModal();
    });
    document.getElementById('edit-save').addEventListener('click', () => saveEdit(id, item));
  }

  async function saveEdit(id, item) {
    const title = document.getElementById('edit-title').value.trim();
    const status = document.getElementById('edit-status').value;
    const fileInput = document.getElementById('edit-poster-file');

    if (!title) { alert('Вкажи назву'); return; }

    const saveBtn = document.getElementById('edit-save');
    saveBtn.textContent = 'Зберігаємо…';
    saveBtn.disabled = true;

    const update = { title, status };

    if (fileInput.files && fileInput.files[0]) {
      const url = await uploadPoster(fileInput.files[0], id);
      if (url) update.poster_url = url;
    }

    const { error } = await supabase.from('media_items').update(update).eq('id', id);
    if (error) { alert('Помилка збереження'); saveBtn.textContent = 'Зберегти'; saveBtn.disabled = false; return; }

    closeModal();
    refresh();
  }

  // ---------- Модалка оцінки ----------
  function openRatingModal(id, who) {
    const item = allItems.find(i => String(i.id) === String(id));
    if (!item) return;

    const whoLabel = who === 'dima' ? 'Діма' : 'Лєна';
    const ratingField = `rating_${who}`;
    const commentField = `comment_${who}`;
    const currentRating = item[ratingField] || null;
    const currentComment = item[commentField] || '';

    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="rate-modal-overlay">
        <div class="modal-card">
          <h3>${escapeHtml(whoLabel)} — ${escapeHtml(item.title)}</h3>
          <div class="form-field">
            <label>Оцінка (1–10)</label>
            <div class="rate-number-row">
              ${[1,2,3,4,5,6,7,8,9,10].map(n => `
                <button class="rate-num-btn ${currentRating == n ? 'active' : ''}" data-score="${n}">${n}</button>
              `).join('')}
            </div>
          </div>
          <div class="form-field">
            <label for="rate-comment">Коментар</label>
            <textarea id="rate-comment" rows="3" placeholder="Враження...">${escapeHtml(currentComment)}</textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="rate-cancel">Скасувати</button>
            <button class="btn-primary" id="rate-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    let selectedScore = currentRating;

    root.querySelectorAll('.rate-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedScore = parseInt(btn.dataset.score);
        root.querySelectorAll('.rate-num-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.score == selectedScore)
        );
      });
    });

    document.getElementById('rate-cancel').addEventListener('click', closeModal);
    document.getElementById('rate-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'rate-modal-overlay') closeModal();
    });
    document.getElementById('rate-save').addEventListener('click', async () => {
      const comment = document.getElementById('rate-comment').value.trim();
      const update = {};
      if (selectedScore) update[ratingField] = selectedScore;
      update[commentField] = comment || null;

      const { error } = await supabase.from('media_items').update(update).eq('id', id);
      if (error) { alert('Помилка збереження'); return; }
      closeModal();
      refresh();
    });
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  // ---------- Refresh ----------
  async function refresh() {
    allItems = await loadItems(activeType);
    renderStats();
    renderFilters();
    renderGrid();
  }

  function renderTabs() {
    document.querySelectorAll('.media-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mediaType === activeType);
    });
  }

  function init() {
    document.getElementById('add-media-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.media-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeType = btn.dataset.mediaType;
        activeFilter = 'all';
        renderTabs();
        refresh();
      });
    });
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'media') refresh();
    });
  }

  return { init, refresh };
})();
