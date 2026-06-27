// ============================================================
// RANDOM MODULE
// 1) Рандомайзер "хто/що" — редаговані категорії,
//    кожна категорія рандомить між Дімою та Лєною
// 2) Рандомайзер страв — редагований пул, кнопка "Рандом"
// ============================================================

const RandomModule = (() => {

  let dishes = [];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // КАТЕГОРІЇ "ХТО/ЩО"
  // ============================================================
  async function loadCategories() {
    const { data, error } = await supabase
      .from('randomizer_categories')
      .select('id, title')
      .order('id', { ascending: true });

    if (error) {
      console.error('Помилка завантаження категорій:', error);
      return [];
    }
    return data || [];
  }

  function renderCategories(categories) {
    const wrap = document.getElementById('randcat-list');

    if (!categories.length) {
      wrap.innerHTML = '<p class="empty-state">Категорій ще немає. Додай першу!</p>';
      return;
    }

    wrap.innerHTML = '';
    categories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'randcat-row';
      row.innerHTML = `
        <div class="randcat-info">
          <p class="randcat-title">${escapeHtml(cat.title)}</p>
          <p class="randcat-result" id="randcat-result-${cat.id}"></p>
        </div>
        <button class="btn-secondary randcat-roll" data-roll-id="${cat.id}">🎲</button>
        <button class="delete-btn" data-delete-cat-id="${cat.id}" title="Видалити">×</button>
      `;
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('[data-roll-id]').forEach(btn => {
      btn.addEventListener('click', () => rollCategory(btn.dataset.rollId));
    });

    wrap.querySelectorAll('[data-delete-cat-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteCategory(btn.dataset.deleteCatId));
    });
  }

  function rollCategory(id) {
    const result = Math.random() < 0.5 ? 'Діма' : 'Лєна';
    const el = document.getElementById(`randcat-result-${id}`);
    if (el) {
      el.textContent = '→ ' + result;
      el.classList.add('rolled');
    }
  }

  function refreshCategories() {
    DataCache.swr('randcats', loadCategories, renderCategories);
  }

  async function deleteCategory(id) {
    if (!confirm('Видалити цю категорію?')) return;

    const { error } = await supabase.from('randomizer_categories').delete().eq('id', id);
    if (error) {
      console.error('Помилка видалення категорії:', error);
      alert('Не вдалось видалити категорію');
      return;
    }
    DataCache.invalidate('randcats');
    refreshCategories();
  }

  function openAddCategoryModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="randcat-modal-overlay">
        <div class="modal-card">
          <h3>Нова категорія</h3>
          <div class="form-field">
            <label for="randcat-title">Назва</label>
            <input type="text" id="randcat-title" placeholder="Наприклад, Хто вибирає музику">
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="randcat-cancel">Скасувати</button>
            <button class="btn-primary" id="randcat-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('randcat-cancel').addEventListener('click', closeModal);
    document.getElementById('randcat-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'randcat-modal-overlay') closeModal();
    });
    document.getElementById('randcat-save').addEventListener('click', saveCategory);
  }

  async function saveCategory() {
    const title = document.getElementById('randcat-title').value.trim();
    if (!title) {
      alert('Вкажи назву категорії');
      return;
    }

    const { error } = await supabase.from('randomizer_categories').insert({ title });

    if (error) {
      console.error('Помилка збереження категорії:', error);
      alert('Не вдалось зберегти категорію');
      return;
    }

    closeModal();
    DataCache.invalidate('randcats');
    refreshCategories();
  }

  // ============================================================
  // РАНДОМАЙЗЕР СТРАВ
  // ============================================================
  async function loadDishes() {
    const { data, error } = await supabase
      .from('dishes')
      .select('id, title')
      .order('id', { ascending: false });

    if (error) {
      console.error('Помилка завантаження страв:', error);
      return [];
    }
    return data || [];
  }

  function renderDishes(items) {
    const wrap = document.getElementById('dish-list');

    if (!items.length) {
      wrap.innerHTML = '<p class="empty-state">Пул страв порожній. Додай свої улюблені!</p>';
      return;
    }

    wrap.innerHTML = '';
    items.forEach(d => {
      const row = document.createElement('div');
      row.className = 'dish-row';
      row.innerHTML = `
        <p class="dish-title">${escapeHtml(d.title)}</p>
        <div class="dish-row-actions">
          <button class="dish-edit-btn" data-edit-dish-id="${d.id}" data-title="${escapeHtml(d.title)}" title="Редагувати">✏️</button>
          <button class="delete-btn" data-delete-dish-id="${d.id}" title="Видалити">×</button>
        </div>
      `;
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('[data-delete-dish-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteDish(btn.dataset.deleteDishId));
    });
    wrap.querySelectorAll('[data-edit-dish-id]').forEach(btn => {
      btn.addEventListener('click', () => openEditDishModal(btn.dataset.editDishId, btn.dataset.title));
    });
  }

  function openEditDishModal(id, currentTitle) {
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Редагувати страву</h3>
        <div class="form-field">
          <label>Назва</label>
          <input type="text" id="edit-dish-title" class="fin-inp" value="${currentTitle}">
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="edit-dish-cancel">Скасувати</button>
          <button class="btn-primary" id="edit-dish-save">Зберегти</button>
        </div>
      </div>`;
    root.innerHTML = ''; root.appendChild(overlay);
    overlay.querySelector('#edit-dish-cancel').addEventListener('click', () => root.innerHTML = '');
    overlay.addEventListener('click', e => { if (e.target === overlay) root.innerHTML = ''; });
    overlay.querySelector('#edit-dish-save').addEventListener('click', async () => {
      const title = overlay.querySelector('#edit-dish-title').value.trim();
      if (!title) return;
      const { error } = await supabase.from('dishes').update({ title }).eq('id', id);
      if (error) { alert('Помилка збереження'); return; }
      root.innerHTML = '';
      DataCache.invalidate('dishes');
      refreshDishes();
    });
  }

  function rollDish() {
    const resultEl = document.getElementById('dish-result');
    if (!dishes.length) {
      resultEl.textContent = 'Пул страв порожній';
      return;
    }
    const pick = dishes[Math.floor(Math.random() * dishes.length)];
    resultEl.textContent = pick.title;
    resultEl.classList.add('rolled');
  }

  function refreshDishes() {
    DataCache.swr('dishes', loadDishes, (items) => { dishes = items || []; renderDishes(dishes); });
  }

  async function deleteDish(id) {
    if (!confirm('Видалити цю страву з пулу?')) return;

    const { error } = await supabase.from('dishes').delete().eq('id', id);
    if (error) {
      console.error('Помилка видалення страви:', error);
      alert('Не вдалось видалити страву');
      return;
    }
    DataCache.invalidate('dishes');
    refreshDishes();
  }

  function openAddDishModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="dish-modal-overlay">
        <div class="modal-card">
          <h3>Нова страва</h3>
          <div class="form-field">
            <label for="dish-title">Назва страви</label>
            <input type="text" id="dish-title" placeholder="Наприклад, Паста болоньєзе">
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="dish-cancel">Скасувати</button>
            <button class="btn-primary" id="dish-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('dish-cancel').addEventListener('click', closeModal);
    document.getElementById('dish-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'dish-modal-overlay') closeModal();
    });
    document.getElementById('dish-save').addEventListener('click', saveDish);
  }

  async function saveDish() {
    const title = document.getElementById('dish-title').value.trim();
    if (!title) {
      alert('Вкажи назву страви');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('dishes').insert({
      title,
      created_by: user ? user.id : null
    });

    if (error) {
      console.error('Помилка збереження страви:', error);
      alert('Не вдалось зберегти страву');
      return;
    }

    closeModal();
    DataCache.invalidate('dishes');
    refreshDishes();
  }

  // ============================================================
  // ЗАГАЛЬНЕ
  // ============================================================
  function closeModal() {
    closeModalAnimated();
  }

  function refresh() {
    refreshCategories();
    refreshDishes();
    document.getElementById('dish-result').textContent = 'Натисни «Рандом»';
    document.getElementById('dish-result').classList.remove('rolled');
  }

  function init() {
    document.getElementById('add-randcat-btn').addEventListener('click', openAddCategoryModal);
    document.getElementById('add-dish-btn').addEventListener('click', openAddDishModal);
    document.getElementById('roll-dish-btn').addEventListener('click', rollDish);

    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'random') refresh();
    });
  }

  return { init, refresh };
})();
