// ============================================================
// TIME CAPSULE MODULE
// Листи з датою відкриття: до дати показуємо лише
// повідомлення "лист є", контент закритий
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
// ============================================================

const Capsule = (() => {

  /** @type {Record<number, string>} id -> name */
  let usersMap = {};

  /** @returns {Promise<Record<number, string>>} */
  async function loadUsers() {
    if (Object.keys(usersMap).length) return usersMap;
    /** @type {SupaResult<AppUser[]>} */
    const { data, error } = await supabase
      .from('users')
      .select('id, name');

    if (error) {
      console.error('Помилка завантаження користувачів:', error);
      return {};
    }
    (data || []).forEach(u => { usersMap[u.id] = u.name; });
    return usersMap;
  }

  /** @returns {Promise<TimeCapsule[]>} */
  async function loadCapsules() {
    /** @type {SupaResult<TimeCapsule[]>} */
    const { data, error } = await supabase
      .from('time_capsules')
      .select('id, title, content, open_date, created_by')
      .order('open_date', { ascending: true });

    if (error) {
      console.error('Помилка завантаження капсул:', error);
      return [];
    }
    return data || [];
  }

  /** @param {string | null | undefined} str @returns {string} */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** @param {string} dateStr @returns {string} */
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** @param {string} openDate @returns {boolean} */
  function isUnlocked(openDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = new Date(openDate);
    open.setHours(0, 0, 0, 0);
    return today >= open;
  }

  /**
   * @param {TimeCapsule[]} capsules
   * @returns {void}
   */
  function render(capsules) {
    const grid = document.getElementById('capsule-grid');
    if (!grid) return;
    const currentUser = Auth.getCurrentUser();

    if (!capsules.length) {
      grid.innerHTML = '<p class="empty-state">Листів ще немає. Напиши перший!</p>';
      return;
    }

    grid.innerHTML = '';
    capsules.forEach(c => {
      const unlocked = isUnlocked(c.open_date);
      const isOwner = !!currentUser && c.created_by === currentUser.id;
      const authorName = (c.created_by !== null ? usersMap[c.created_by] : null) || 'Хтось';

      const card = document.createElement('div');
      card.className = 'capsule-card' + (unlocked ? '' : ' locked');

      const deleteBtn = `<button class="delete-btn" data-delete-id="${c.id}" title="Видалити">×</button>`;

      if (isOwner) {
        // Автор завжди бачить і може редагувати свій лист
        const editBtn = `<button class="capsule-edit-btn" data-edit-id="${c.id}" title="Редагувати">✏️</button>`;
        card.innerHTML = `
          ${deleteBtn}
          ${editBtn}
          <span class="capsule-icon">${unlocked ? '✉️' : '🔒'}</span>
          <p class="capsule-title">${escapeHtml(c.title)}</p>
          <span class="capsule-date">${unlocked ? 'Відкрито' : 'Відкриється'} ${formatDate(c.open_date)}</span>
          <p class="capsule-content">${escapeHtml(c.content)}</p>
        `;
      } else if (unlocked) {
        // Партнер бачить відкритий лист
        card.innerHTML = `
          ${deleteBtn}
          <span class="capsule-icon">✉️</span>
          <p class="capsule-title">${escapeHtml(c.title)}</p>
          <span class="capsule-date">Відкрито ${formatDate(c.open_date)}</span>
          <p class="capsule-content">${escapeHtml(c.content)}</p>
        `;
      } else {
        // Партнер бачить лише факт існування листа
        card.innerHTML = `
          <span class="capsule-icon">🔒</span>
          <p class="capsule-title">Є лист від ${escapeHtml(authorName)}</p>
          <span class="capsule-date">Відкриється ${formatDate(c.open_date)}</span>
          <p class="capsule-locked-note">Зміст прихований до дати відкриття.</p>
        `;
      }

      grid.appendChild(card);
    });

    grid.querySelectorAll('[data-delete-id]').forEach(btn => {
      const id = /** @type {HTMLElement} */ (btn).dataset.deleteId;
      if (id) btn.addEventListener('click', () => deleteCapsule(id));
    });

    grid.querySelectorAll('[data-edit-id]').forEach(btn => {
      const id = /** @type {HTMLElement} */ (btn).dataset.editId;
      if (id) btn.addEventListener('click', () => openEditModal(id, capsules));
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteCapsule(id) {
    if (!confirm('Видалити цей лист?')) return;

    const { error } = await supabase.from('time_capsules').delete().eq('id', id);
    if (error) {
      console.error('Помилка видалення капсули:', error);
      alert('Не вдалось видалити лист');
      return;
    }
    DataCache.invalidate('time_capsules');
    refresh();
  }

  /** @returns {Promise<void>} */
  async function refresh() {
    const users = await Auth.getUsers();
    usersMap = {};
    users.forEach(u => { usersMap[u.id] = u.name; });
    // capsules || [] — без цього render(null) після невдалого першого
    // фетчу (без кешу) впав би на capsules.length.
    DataCache.swr('time_capsules', loadCapsules, (capsules) => render(capsules || []));
  }

  // ---------- Модалка редагування листа ----------
  /**
   * @param {string} id
   * @param {TimeCapsule[]} capsules
   * @returns {void}
   */
  function openEditModal(id, capsules) {
    const capsule = capsules.find(c => String(c.id) === String(id));
    if (!capsule) return;

    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-overlay" id="capsule-edit-modal-overlay">
        <div class="modal-card">
          <h3>Редагувати лист</h3>
          <div class="form-field">
            <label for="capsule-edit-title">Назва</label>
            <input type="text" id="capsule-edit-title" value="${escapeHtml(capsule.title)}">
          </div>
          <div class="form-field">
            <label for="capsule-edit-date">Дата відкриття</label>
            <input type="date" id="capsule-edit-date" value="${capsule.open_date}">
          </div>
          <div class="form-field">
            <label for="capsule-edit-content">Текст листа</label>
            <textarea id="capsule-edit-content" rows="5">${escapeHtml(capsule.content)}</textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="capsule-edit-cancel">Скасувати</button>
            <button class="btn-primary" id="capsule-edit-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('capsule-edit-cancel')?.addEventListener('click', closeModal);
    document.getElementById('capsule-edit-modal-overlay')?.addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).id === 'capsule-edit-modal-overlay') closeModal();
    });
    document.getElementById('capsule-edit-save')?.addEventListener('click', () => saveEdit(id));
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function saveEdit(id) {
    const titleInp   = /** @type {HTMLInputElement} */ (document.getElementById('capsule-edit-title'));
    const dateInp    = /** @type {HTMLInputElement} */ (document.getElementById('capsule-edit-date'));
    const contentInp = /** @type {HTMLTextAreaElement} */ (document.getElementById('capsule-edit-content'));
    const title = titleInp.value.trim();
    const openDate = dateInp.value;
    const content = contentInp.value.trim();

    if (!title || !openDate || !content) {
      alert('Заповни назву, дату та текст листа');
      return;
    }

    const { error } = await supabase
      .from('time_capsules')
      .update({ title, content, open_date: openDate })
      .eq('id', id);

    if (error) {
      console.error('Помилка редагування капсули:', error);
      alert('Не вдалось зберегти зміни');
      return;
    }

    closeModal();
    DataCache.invalidate('time_capsules');
    refresh();
  }

  // ---------- Модалка додавання листа ----------
  /** @returns {void} */
  function openAddModal() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-overlay" id="capsule-modal-overlay">
        <div class="modal-card">
          <h3>Новий лист у капсулу часу</h3>
          <div class="form-field">
            <label for="capsule-title">Назва</label>
            <input type="text" id="capsule-title" placeholder="Наприклад, До нашої п'ятої річниці">
          </div>
          <div class="form-field">
            <label for="capsule-date">Дата відкриття</label>
            <input type="date" id="capsule-date">
          </div>
          <div class="form-field">
            <label for="capsule-content">Текст листа</label>
            <textarea id="capsule-content" rows="5" placeholder="Напиши, що хочеш сказати в майбутньому..."></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="capsule-cancel">Скасувати</button>
            <button class="btn-primary" id="capsule-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('capsule-cancel')?.addEventListener('click', closeModal);
    document.getElementById('capsule-modal-overlay')?.addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).id === 'capsule-modal-overlay') closeModal();
    });
    document.getElementById('capsule-save')?.addEventListener('click', saveCapsule);
  }

  /** @returns {void} */
  function closeModal() {
    closeModalAnimated();
  }

  /** @returns {Promise<void>} */
  async function saveCapsule() {
    const titleInp   = /** @type {HTMLInputElement} */ (document.getElementById('capsule-title'));
    const dateInp    = /** @type {HTMLInputElement} */ (document.getElementById('capsule-date'));
    const contentInp = /** @type {HTMLTextAreaElement} */ (document.getElementById('capsule-content'));
    const title = titleInp.value.trim();
    const openDate = dateInp.value;
    const content = contentInp.value.trim();

    if (!title || !openDate || !content) {
      alert('Заповни назву, дату та текст листа');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('time_capsules').insert({
      title,
      content,
      open_date: openDate,
      created_by: user ? user.id : null
    });

    if (error) {
      console.error('Помилка збереження капсули:', error);
      alert('Не вдалось зберегти лист');
      return;
    }

    closeModal();
    DataCache.invalidate('time_capsules');
    refresh();
  }

  /** @returns {void} */
  function init() {
    document.getElementById('add-capsule-btn')?.addEventListener('click', openAddModal);
    window.addEventListener('portal:view', (e) => {
      if (/** @type {CustomEvent} */ (e).detail.view === 'capsule') refresh();
    });
  }

  return { init, refresh };
})();
