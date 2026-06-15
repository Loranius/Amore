// ============================================================
// WISHLIST MODULE
// Вкладки "Моє" / "[Партнер]"
// Бронювання приховане від власника бажання
// ============================================================

const Wishlist = (() => {

  let allUsers = [];        // [{id, name}]
  let activeOwnerId = null; // чий список зараз показуємо

  async function loadUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .order('id', { ascending: true });

    if (error) {
      console.error('Помилка завантаження користувачів:', error);
      return [];
    }
    return data || [];
  }

  async function loadItems(ownerId) {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('id, title, description, link, owner, reserved_by, reserved')
      .eq('owner', ownerId)
      .order('id', { ascending: false });

    if (error) {
      console.error('Помилка завантаження wishlist:', error);
      return [];
    }
    return data || [];
  }

  function renderTabs() {
    const wrap = document.getElementById('wishlist-tabs');
    const currentUser = Auth.getCurrentUser();
    wrap.innerHTML = '';

    allUsers.forEach(u => {
      const btn = document.createElement('button');
      btn.className = 'wishlist-tab';
      btn.textContent = (currentUser && u.id === currentUser.id) ? 'Моє' : u.name;
      btn.dataset.ownerId = u.id;
      if (u.id === activeOwnerId) btn.classList.add('active');
      btn.addEventListener('click', () => {
        activeOwnerId = u.id;
        renderTabs();
        refreshGrid();
      });
      wrap.appendChild(btn);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderGrid(items, isOwnList) {
    const grid = document.getElementById('wishlist-grid');

    if (!items.length) {
      grid.innerHTML = '<p class="empty-state">Тут ще порожньо. Додай бажання!</p>';
      return;
    }

    grid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'wish-card';

      // Бронювання приховане від власника списку
      let badge = '';
      if (!isOwnList && item.reserved) {
        badge = '<span class="wish-badge reserved">Заброньовано</span>';
      } else if (!isOwnList && !item.reserved) {
        badge = '<span class="wish-badge" data-reserve-id="' + item.id + '">Забронювати</span>';
      }

      card.innerHTML = `
        ${badge}
        <p class="wish-title">${escapeHtml(item.title)}</p>
        ${item.description ? `<p class="wish-desc">${escapeHtml(item.description)}</p>` : ''}
        ${item.link ? `<a class="wish-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Переглянути →</a>` : ''}
      `;

      grid.appendChild(card);
    });

    // Навісити обробники бронювання
    grid.querySelectorAll('[data-reserve-id]').forEach(badgeEl => {
      badgeEl.addEventListener('click', () => reserveItem(badgeEl.dataset.reserveId));
    });
  }

  async function reserveItem(itemId) {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const { error } = await supabase
      .from('wishlist_items')
      .update({ reserved: true, reserved_by: user.id })
      .eq('id', itemId);

    if (error) {
      console.error('Помилка бронювання:', error);
      alert('Не вдалось забронювати');
      return;
    }
    refreshGrid();
  }

  async function refreshGrid() {
    const currentUser = Auth.getCurrentUser();
    const items = await loadItems(activeOwnerId);
    const isOwnList = currentUser && activeOwnerId === currentUser.id;
    renderGrid(items, isOwnList);
  }

  // ---------- Модалка додавання бажання ----------
  function openAddModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="wish-modal-overlay">
        <div class="modal-card">
          <h3>Нове бажання</h3>
          <div class="form-field">
            <label for="wish-title">Назва</label>
            <input type="text" id="wish-title" placeholder="Що хочеш?">
          </div>
          <div class="form-field">
            <label for="wish-link">Посилання (необов'язково)</label>
            <input type="text" id="wish-link" placeholder="https://...">
          </div>
          <div class="form-field">
            <label for="wish-desc">Опис (необов'язково)</label>
            <textarea id="wish-desc" rows="2" placeholder="Деталі, розмір, колір..."></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="wish-cancel">Скасувати</button>
            <button class="btn-primary" id="wish-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('wish-cancel').addEventListener('click', closeModal);
    document.getElementById('wish-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'wish-modal-overlay') closeModal();
    });
    document.getElementById('wish-save').addEventListener('click', saveWish);
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async function saveWish() {
    const title = document.getElementById('wish-title').value.trim();
    const link = document.getElementById('wish-link').value.trim();
    const description = document.getElementById('wish-desc').value.trim();

    if (!title) {
      alert('Вкажи назву бажання');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('wishlist_items').insert({
      title,
      link: link || null,
      description: description || null,
      owner: user.id,
      reserved: false,
      reserved_by: null
    });

    if (error) {
      console.error('Помилка збереження бажання:', error);
      alert('Не вдалось зберегти бажання');
      return;
    }

    closeModal();
    if (activeOwnerId === user.id) refreshGrid();
  }

  // ---------- Init ----------
  async function refresh() {
    if (!allUsers.length) {
      allUsers = await loadUsers();
    }
    const currentUser = Auth.getCurrentUser();
    if (activeOwnerId === null && currentUser) {
      activeOwnerId = currentUser.id;
    }
    renderTabs();
    refreshGrid();
  }

  function init() {
    document.getElementById('add-wish-btn').addEventListener('click', openAddModal);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'wishlist') refresh();
    });
  }

  return { init, refresh };
})();
