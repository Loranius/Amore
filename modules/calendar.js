// ============================================================
// CALENDAR MODULE
// Список подій + модалка створення
// ============================================================

const CalendarModule = (() => {

  const MONTHS_FULL = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
                        'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

  async function loadEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, date, created_by')
      .order('date', { ascending: true });

    if (error) {
      console.error('Помилка завантаження подій:', error);
      return [];
    }
    return data || [];
  }

  function renderEvents(events) {
    const wrap = document.getElementById('calendar-list');

    if (!events.length) {
      wrap.innerHTML = '<p class="empty-state">Подій ще немає. Додай першу!</p>';
      return;
    }

    wrap.innerHTML = '';
    events.forEach(ev => {
      const d = new Date(ev.date);
      const item = document.createElement('div');
      item.className = 'event-item';
      item.innerHTML = `
        <div class="event-info">
          <p class="event-title">${escapeHtml(ev.title)}</p>
          ${ev.description ? `<p class="event-desc">${escapeHtml(ev.description)}</p>` : ''}
          <p class="event-meta">${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}</p>
        </div>
        <button class="delete-btn" data-delete-id="${ev.id}" title="Видалити">×</button>
      `;
      wrap.appendChild(item);
    });

    wrap.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteEvent(btn.dataset.deleteId));
    });
  }

  async function deleteEvent(id) {
    if (!confirm('Видалити цю подію?')) return;

    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) {
      console.error('Помилка видалення події:', error);
      alert('Не вдалось видалити подію');
      return;
    }
    refresh();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function refresh() {
    const events = await loadEvents();
    renderEvents(events);
  }

  // ---------- Модалка додавання події ----------
  function openAddModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="event-modal-overlay">
        <div class="modal-card">
          <h3>Нова подія</h3>
          <div class="form-field">
            <label for="event-title">Назва</label>
            <input type="text" id="event-title" placeholder="Наприклад, річниця знайомства">
          </div>
          <div class="form-field">
            <label for="event-date">Дата</label>
            <input type="date" id="event-date">
          </div>
          <div class="form-field">
            <label for="event-desc">Опис (необов'язково)</label>
            <textarea id="event-desc" rows="2" placeholder="Деталі..."></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="event-cancel">Скасувати</button>
            <button class="btn-primary" id="event-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('event-cancel').addEventListener('click', closeModal);
    document.getElementById('event-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'event-modal-overlay') closeModal();
    });
    document.getElementById('event-save').addEventListener('click', saveEvent);
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async function saveEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const description = document.getElementById('event-desc').value.trim();

    if (!title || !date) {
      alert('Заповни назву та дату');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('events').insert({
      title,
      date,
      description: description || null,
      created_by: user ? user.id : null
    });

    if (error) {
      console.error('Помилка збереження події:', error);
      alert('Не вдалось зберегти подію');
      return;
    }

    closeModal();
    refresh();
  }

  function init() {
    document.getElementById('add-event-btn').addEventListener('click', openAddModal);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'calendar') refresh();
    });
  }

  return { init, refresh };
})();
