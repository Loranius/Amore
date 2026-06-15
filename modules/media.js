// ============================================================
// MEDIA MODULE
// Спільний список фільмів/серіалів/книг зі статусом
// (хочу / дивлюся-читаю / готово)
// ============================================================

const Media = (() => {

  const STATUS_LABELS = {
    want: 'Хочу',
    watching: 'В процесі',
    done: 'Готово'
  };

  const TYPE_LABELS = {
    movie: 'фільм',
    series: 'серіал',
    book: 'книга'
  };

  let activeType = 'movie';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadItems(type) {
    const { data, error } = await supabase
      .from('media_items')
      .select('id, type, title, status, created_by')
      .eq('type', type)
      .order('id', { ascending: false });

    if (error) {
      console.error('Помилка завантаження медіа:', error);
      return [];
    }
    return data || [];
  }

  function renderTabs() {
    document.querySelectorAll('.media-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mediaType === activeType);
    });
  }

  function renderList(items) {
    const wrap = document.getElementById('media-list');

    if (!items.length) {
      wrap.innerHTML = '<p class="empty-state">Список порожній. Додай щось!</p>';
      return;
    }

    wrap.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'media-item';
      row.innerHTML = `
        <div class="media-info">
          <p class="media-title">${escapeHtml(item.title)}</p>
          <select class="media-status" data-status-id="${item.id}">
            ${Object.entries(STATUS_LABELS).map(([val, label]) =>
              `<option value="${val}" ${item.status === val ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </div>
        <button class="delete-btn" data-delete-id="${item.id}" title="Видалити">×</button>
      `;
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('[data-status-id]').forEach(sel => {
      sel.addEventListener('change', () => updateStatus(sel.dataset.statusId, sel.value));
    });

    wrap.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(btn.dataset.deleteId));
    });
  }

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from('media_items')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Помилка оновлення статусу:', error);
      alert('Не вдалось оновити статус');
    }
  }

  async function deleteItem(id) {
    if (!confirm('Видалити цей елемент зі списку?')) return;

    const { error } = await supabase.from('media_items').delete().eq('id', id);
    if (error) {
      console.error('Помилка видалення:', error);
      alert('Не вдалось видалити');
      return;
    }
    refresh();
  }

  async function refresh() {
    renderTabs();
    const items = await loadItems(activeType);
    renderList(items);
  }

  // ---------- Модалка додавання ----------
  function openAddModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="media-modal-overlay">
        <div class="modal-card">
          <h3>Додати ${TYPE_LABELS[activeType]}</h3>
          <div class="form-field">
            <label for="media-title">Назва</label>
            <input type="text" id="media-title" placeholder="Введи назву">
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

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async function saveItem() {
    const title = document.getElementById('media-title').value.trim();
    if (!title) {
      alert('Вкажи назву');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('media_items').insert({
      type: activeType,
      title,
      status: 'want',
      created_by: user ? user.id : null
    });

    if (error) {
      console.error('Помилка збереження:', error);
      alert('Не вдалось зберегти');
      return;
    }

    closeModal();
    refresh();
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
