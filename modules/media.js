// ============================================================
// MEDIA MODULE v2
// Фільми / Серіали / Книги
// — Картки grid 2 колонки з постером
// — Статуси з сортуванням по групах
// — Рейтинг Діма / Лєна (1-10)
// — Коментарі Діма / Лєна
// — Статистика зверху (кількість, середній рейтинг)
// ============================================================

const Media = (() => {

  // ---------- Конфіг статусів ----------
  const STATUS_CONFIG = {
    movie: {
      watching: { label: 'Дивимось',  order: 0 },
      want:     { label: 'Плануємо', order: 1 },
      done:     { label: 'Бачили',    order: 2 },
      dropped:  { label: 'Кинули',    order: 3 },
    },
    series: {
      watching: { label: 'Дивимось',  order: 0 },
      want:     { label: 'Плануємо', order: 1 },
      done:     { label: 'Бачили',    order: 2 },
      dropped:  { label: 'Кинули',    order: 3 },
    },
    book: {
      watching: { label: 'Читаємо',    order: 0 },
      want:     { label: 'Плануємо',  order: 1 },
      done:     { label: 'Прочитали', order: 2 },
      dropped:  { label: 'Кинули',    order: 3 },
    },
  };

  const STATUS_ORDER = ['watching', 'want', 'done', 'dropped'];

  const TYPE_LABELS = { movie: 'Фільм', series: 'Серіал', book: 'Книга' };
  const TYPE_PLACEHOLDERS = {
    movie: 'Назва фільму',
    series: 'Назва серіалу',
    book: 'Назва книги',
  };

  let activeType = 'movie';
  let allItems = []; // кеш поточного типу

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

    if (error) {
      console.error('Помилка завантаження медіа:', error);
      return [];
    }
    return data || [];
  }

  // ---------- Статистика ----------
  function renderStats(items) {
    const wrap = document.getElementById('media-stats');
    if (!wrap) return;

    const done = items.filter(i => i.status === 'done');
    const total = items.length;

    const ratings = [
      ...items.map(i => i.rating_dima).filter(Boolean),
      ...items.map(i => i.rating_lena).filter(Boolean),
    ];
    const avgRating = ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

    const typeLabel = activeType === 'book' ? 'прочитано' : 'переглянуто';

    wrap.innerHTML = `
      <div class="media-stat">
        <span class="media-stat-num">${done.length}</span>
        <span class="media-stat-label">${typeLabel}</span>
      </div>
      <div class="media-stat">
        <span class="media-stat-num">${total}</span>
        <span class="media-stat-label">всього</span>
      </div>
      ${avgRating ? `
      <div class="media-stat">
        <span class="media-stat-num">${avgRating}</span>
        <span class="media-stat-label">сер. рейтинг</span>
      </div>` : ''}
    `;
  }

  // ---------- Рендер ----------
  function renderTabs() {
    document.querySelectorAll('.media-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mediaType === activeType);
    });
  }

  function renderStarRating(value, field, itemId) {
    const stars = [];
    for (let i = 1; i <= 10; i++) {
      stars.push(`<button class="star-btn ${i <= (value || 0) ? 'filled' : ''}"
        data-star="${i}" data-field="${field}" data-id="${itemId}">${i <= (value || 0) ? '★' : '☆'}</button>`);
    }
    return `<div class="stars-row">${stars.join('')}</div>`;
  }

  function renderGrouped(items) {
    const wrap = document.getElementById('media-list');
    const conf = STATUS_CONFIG[activeType];

    if (!items.length) {
      wrap.innerHTML = '<p class="empty-state">Список порожній. Додай щось!</p>';
      return;
    }

    // Групуємо по статусу
    const groups = {};
    STATUS_ORDER.forEach(s => { groups[s] = []; });
    items.forEach(item => {
      const s = item.status || 'want';
      if (!groups[s]) groups[s] = [];
      groups[s].push(item);
    });

    wrap.innerHTML = '';

    STATUS_ORDER.forEach(status => {
      const group = groups[status];
      if (!group.length) return;

      const groupLabel = conf[status]?.label || status;

      const section = document.createElement('div');
      section.className = 'media-group';
      section.innerHTML = `<p class="media-group-label">${groupLabel}</p>`;

      const grid = document.createElement('div');
      grid.className = 'media-grid';

      group.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const poster = item.poster_url
          ? `<img class="media-poster" src="${escapeHtml(item.poster_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="media-poster-placeholder">🎬</div>`;

        const ratingDima = item.rating_dima
          ? `<span class="media-rating-val">${item.rating_dima}/10</span>`
          : `<span class="media-rating-empty">—</span>`;
        const ratingLena = item.rating_lena
          ? `<span class="media-rating-val">${item.rating_lena}/10</span>`
          : `<span class="media-rating-empty">—</span>`;

        card.innerHTML = `
          <button class="delete-btn media-card-delete" data-delete-id="${item.id}">×</button>
          ${poster}
          <div class="media-card-body">
            <p class="media-card-title">${escapeHtml(item.title)}</p>
            <select class="media-status-select" data-status-id="${item.id}">
              ${Object.entries(conf).map(([val, cfg]) =>
                `<option value="${val}" ${item.status === val ? 'selected' : ''}>${cfg.label}</option>`
              ).join('')}
            </select>
            <div class="media-ratings">
              <div class="media-rating-row">
                <span class="media-rating-name">Діма</span>
                ${ratingDima}
                <button class="media-rate-btn" data-rate-id="${item.id}" data-rate-who="dima">✏️</button>
              </div>
              <div class="media-rating-row">
                <span class="media-rating-name">Лєна</span>
                ${ratingLena}
                <button class="media-rate-btn" data-rate-id="${item.id}" data-rate-who="lena">✏️</button>
              </div>
            </div>
            ${item.comment_dima ? `<p class="media-comment"><b>Діма:</b> ${escapeHtml(item.comment_dima)}</p>` : ''}
            ${item.comment_lena ? `<p class="media-comment"><b>Лєна:</b> ${escapeHtml(item.comment_lena)}</p>` : ''}
          </div>
        `;

        grid.appendChild(card);
      });

      section.appendChild(grid);
      wrap.appendChild(section);
    });

    // Обробники
    wrap.querySelectorAll('[data-status-id]').forEach(sel => {
      sel.addEventListener('change', () => updateStatus(sel.dataset.statusId, sel.value));
    });
    wrap.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(btn.dataset.deleteId));
    });
    wrap.querySelectorAll('[data-rate-id]').forEach(btn => {
      btn.addEventListener('click', () => openRatingModal(btn.dataset.rateId, btn.dataset.rateWho));
    });
  }

  // ---------- Оновлення статусу ----------
  async function updateStatus(id, status) {
    const { error } = await supabase
      .from('media_items')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Помилка оновлення статусу:', error);
      return;
    }
    refresh();
  }

  // ---------- Видалення ----------
  async function deleteItem(id) {
    if (!confirm('Видалити цей елемент зі списку?')) return;
    const { error } = await supabase.from('media_items').delete().eq('id', id);
    if (error) {
      console.error('Помилка видалення:', error);
      return;
    }
    refresh();
  }

  // ---------- Модалка оцінки + коментаря ----------
  function openRatingModal(id, who) {
    const item = allItems.find(i => String(i.id) === String(id));
    if (!item) return;

    const whoLabel = who === 'dima' ? 'Діма' : 'Лєна';
    const ratingField = who === 'dima' ? 'rating_dima' : 'rating_lena';
    const commentField = who === 'dima' ? 'comment_dima' : 'comment_lena';
    const currentRating = item[ratingField] || '';
    const currentComment = item[commentField] || '';

    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="rate-modal-overlay">
        <div class="modal-card">
          <h3>${escapeHtml(whoLabel)} — ${escapeHtml(item.title)}</h3>
          <div class="form-field">
            <label for="rate-score">Оцінка (1–10)</label>
            <div class="rate-number-row">
              ${[1,2,3,4,5,6,7,8,9,10].map(n => `
                <button class="rate-num-btn ${currentRating == n ? 'active' : ''}" data-score="${n}">${n}</button>
              `).join('')}
            </div>
          </div>
          <div class="form-field">
            <label for="rate-comment">Коментар</label>
            <textarea id="rate-comment" rows="3" placeholder="Що сподобалось / не сподобалось...">${escapeHtml(currentComment)}</textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="rate-cancel">Скасувати</button>
            <button class="btn-primary" id="rate-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    let selectedScore = currentRating || null;

    root.querySelectorAll('.rate-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedScore = parseInt(btn.dataset.score);
        root.querySelectorAll('.rate-num-btn').forEach(b => b.classList.toggle('active', b.dataset.score == selectedScore));
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
      if (comment !== currentComment) update[commentField] = comment || null;

      if (!Object.keys(update).length) { closeModal(); return; }

      const { error } = await supabase.from('media_items').update(update).eq('id', id);
      if (error) { alert('Помилка збереження'); return; }
      closeModal();
      refresh();
    });
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
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
            <input type="text" id="media-title" placeholder="${TYPE_PLACEHOLDERS[activeType]}">
          </div>
          <div class="form-field">
            <label for="media-poster">Посилання на постер (необов'язково)</label>
            <input type="text" id="media-poster" placeholder="https://...">
          </div>
          <div class="form-field">
            <label for="media-status-new">Статус</label>
            <select id="media-status-new">
              ${Object.entries(conf).map(([val, cfg]) =>
                `<option value="${val}">${cfg.label}</option>`
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
    const poster_url = document.getElementById('media-poster').value.trim();
    const status = document.getElementById('media-status-new').value;

    if (!title) { alert('Вкажи назву'); return; }

    const user = Auth.getCurrentUser();
    const { error } = await supabase.from('media_items').insert({
      type: activeType,
      title,
      status,
      poster_url: poster_url || null,
      created_by: user ? user.id : null,
    });

    if (error) { alert('Не вдалось зберегти'); return; }
    closeModal();
    refresh();
  }

  // ---------- Refresh ----------
  async function refresh() {
    allItems = await loadItems(activeType);
    renderTabs();
    renderStats(allItems);
    renderGrouped(allItems);
  }

  function init() {
    document.getElementById('add-media-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.media-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeType = btn.dataset.mediaType;
        refresh();
      });
    });
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'media') refresh();
    });
  }

  return { init, refresh };
})();
