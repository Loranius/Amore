// ============================================================
// SHOPPING LIST MODULE
// Спільний список покупок: швидке введення кількох товарів,
// групування за категоріями, архів куплених
// ============================================================

const Shopping = (() => {

  const el  = id => document.getElementById(id);
  const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };

  let usersMap   = {};   // id -> name
  let allItems   = [];   // всі товари (активні + куплені)
  let openedCats = new Set(); // які категорії акордеону розкриті
  let archiveOpen = false;

  const CATEGORIES = [
    'Продукти',
    "М'ясо",
    'Молочне',
    'Бакалія',
    'Випічка',
    'Напої',
    'Побут',
    'Аптека',
    'Інше',
  ];

  // ── ДАНІ ──
  async function loadUsers() {
    if (Object.keys(usersMap).length) return usersMap;
    const { data, error } = await supabase.from('users').select('id, name');
    if (error) { console.error('Shopping: помилка users', error); return {}; }
    (data || []).forEach(u => { usersMap[u.id] = u.name; });
    return usersMap;
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('id,title,qty,category,bought,created_by,bought_by,created_at,bought_at')
      .order('created_at', { ascending: false });
    if (error) { console.error('Shopping: помилка завантаження', error); return []; }
    return data || [];
  }

  // ── ПАРСИНГ ВВЕДЕННЯ ──
  // Розбиває "молоко, хліб, два яблука" або текст з нових рядків
  // на окремі позиції. Це fallback-парсинг (без ШІ): розділювачі — кома та \n.
  function parseInputFallback(raw) {
    return raw
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(title => ({ title, qty: null, category: 'Інше' }));
  }

  // Розумний парсинг через Groq (Supabase Edge Function "shopping-parse").
  // Повертає масив {title, qty, category} або null, якщо щось пішло не так
  // (немає мережі, функція не задеплоєна, помилка ШІ тощо) —
  // тоді викликаючий код сам впаде на parseInputFallback.
  async function parseInputSmart(raw) {
    try {
      const { data, error } = await supabase.functions.invoke('shopping-parse', {
        body: { text: raw },
      });
      if (error) { console.warn('Shopping: shopping-parse error', error); return null; }
      if (!data || !Array.isArray(data.items) || !data.items.length) return null;
      return data.items;
    } catch (e) {
      console.warn('Shopping: shopping-parse недоступний', e);
      return null;
    }
  }

  // ── ДОДАВАННЯ ──
  async function addFromInput() {
    const input = el('sl-input');
    const addBtn = el('sl-add-btn');
    const raw = input.value;
    if (!raw.trim()) return;

    if (addBtn) { addBtn.disabled = true; addBtn.textContent = '…'; }

    let items = await parseInputSmart(raw);
    if (!items) items = parseInputFallback(raw);

    if (addBtn) { addBtn.disabled = false; addBtn.textContent = '+'; }
    if (!items.length) return;

    const user = Auth.getCurrentUser();
    const rows = items.map(i => ({
      title: i.title,
      qty: i.qty || null,
      category: i.category || 'Інше',
      created_by: user ? user.id : null,
    }));

    // 1. Оптимістично показуємо нові товари (з temp id)
    const tempItems = rows.map((r, i) => ({
      ...r, id: 'temp_' + Date.now() + '_' + i,
      bought: false, bought_by: null, bought_at: null,
    }));
    allItems = [...tempItems, ...allItems];
    input.value = '';
    renderActiveList();

    // 2. Пишемо в БД (з retry)
    const { error } = await Retry.query(() =>
      supabase.from('shopping_items').insert(rows)
    );

    if (error) {
      // Відкочуємо temp-елементи
      allItems = allItems.filter(i => !String(i.id).startsWith('temp_'));
      renderActiveList();
      ErrorBoundary.showToast('Не вдалось додати товар. Спробуй ще.');
      console.error('Shopping: помилка додавання', error);
      return;
    }

    // Підтягуємо реальні id з БД
    DataCache.invalidate('shopping:items');
    refresh();
  }

  // ── ЗМІНА СТАТУСУ (купити / повернути) ──
  // ── ЗМІНА СТАТУСУ (купити / повернути) — оптимістично ──
  async function toggleBought(item) {
    const user = Auth.getCurrentUser();
    const nowBought = !item.bought;

    // 1. Оновлюємо локально — одразу без чекання БД
    const snapshot = allItems.map(i => ({...i})); // резервна копія
    const target = allItems.find(i => i.id === item.id);
    if (target) {
      target.bought    = nowBought;
      target.bought_by = nowBought ? (user?.id ?? null) : null;
      target.bought_at = nowBought ? new Date().toISOString() : null;
    }
    renderActiveList();
    renderArchive();

    // 2. Пишемо в БД (з retry)
    const { error } = await Retry.query(() =>
      supabase.from('shopping_items').update({
        bought:    nowBought,
        bought_by: nowBought ? (user?.id ?? null) : null,
        bought_at: nowBought ? new Date().toISOString() : null,
      }).eq('id', item.id)
    );

    if (error) {
      // Відкочуємо
      allItems.splice(0, allItems.length, ...snapshot);
      renderActiveList();
      renderArchive();
      ErrorBoundary.showToast('Не вдалось оновити товар. Спробуй ще.');
      console.error('Shopping: помилка зміни статусу', error);
      return;
    }

    // Синхронізуємо кеш
    DataCache.set('shopping:items', [...allItems]);
  }

  async function deleteItem(id) {
    if (!confirm('Видалити цей товар зі списку?')) return;

    // 1. Оптимістично прибираємо з UI
    const snapshot = allItems.map(i => ({...i}));
    const idx = allItems.findIndex(i => i.id === id);
    if (idx !== -1) allItems.splice(idx, 1);
    renderActiveList();
    renderArchive();

    // 2. Видаляємо в БД (з retry)
    const { error } = await Retry.query(() =>
      supabase.from('shopping_items').delete().eq('id', id)
    );

    if (error) {
      // Відкочуємо
      allItems.splice(0, allItems.length, ...snapshot);
      renderActiveList();
      renderArchive();
      ErrorBoundary.showToast('Не вдалось видалити товар. Спробуй ще.');
      console.error('Shopping: помилка видалення', error);
      return;
    }

    DataCache.set('shopping:items', [...allItems]);
  }

  // ── РЕДАГУВАННЯ (категорія / кількість) ──
  function openEditModal(item) {
    const root = el('modal-root');
    const catOptions = CATEGORIES.map(c =>
      `<option value="${esc(c)}"${c === item.category ? ' selected' : ''}>${esc(c)}</option>`
    ).join('');

    root.innerHTML = `
      <div class="modal-overlay" id="sl-edit-overlay">
        <div class="modal-card">
          <h3>Редагувати товар</h3>
          <div class="form-field">
            <label for="sl-edit-title">Назва</label>
            <input type="text" id="sl-edit-title" value="${esc(item.title)}">
          </div>
          <div class="form-field">
            <label for="sl-edit-qty">Кількість / примітка</label>
            <input type="text" id="sl-edit-qty" placeholder="напр. 2 л, десяток" value="${esc(item.qty || '')}">
          </div>
          <div class="form-field">
            <label for="sl-edit-cat">Категорія</label>
            <select id="sl-edit-cat" class="fin-inp">${catOptions}</select>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="sl-edit-cancel">Скасувати</button>
            <button class="btn-primary" id="sl-edit-save">Зберегти</button>
          </div>
        </div>
      </div>`;

    el('sl-edit-cancel').addEventListener('click', closeModal);
    el('sl-edit-overlay').addEventListener('click', e => { if (e.target.id === 'sl-edit-overlay') closeModal(); });
    el('sl-edit-save').addEventListener('click', () => saveEdit(item.id));
  }

  async function saveEdit(id) {
    const title = el('sl-edit-title').value.trim();
    const qty   = el('sl-edit-qty').value.trim();
    const category = el('sl-edit-cat').value;

    if (!title) { alert('Назва не може бути порожньою'); return; }

    const { error } = await supabase
      .from('shopping_items')
      .update({ title, qty: qty || null, category })
      .eq('id', id);

    if (error) {
      console.error('Shopping: помилка редагування', error);
      ErrorBoundary.showToast('Не вдалось зберегти зміни');
      return;
    }
    closeModal();
    DataCache.invalidate('shopping:items'); await refresh();
  }

  function closeModal() { el('modal-root').innerHTML = ''; }

  // ── РЕНДЕР ──
  function authorName(userId) {
    return usersMap[userId] || 'Хтось';
  }

  function renderActiveList() {
    const wrap = el('sl-active-list');
    if (!wrap) return;

    const active = allItems.filter(i => !i.bought);

    if (!active.length) {
      wrap.innerHTML = '<p class="empty-state">Список порожній. Додай перший товар вище.</p>';
      return;
    }

    // групування за категорією, з порядком як у CATEGORIES (+ невідомі в кінці)
    const byCat = {};
    active.forEach(i => {
      const cat = i.category || 'Інше';
      (byCat[cat] = byCat[cat] || []).push(i);
    });
    const catOrder = [...CATEGORIES, ...Object.keys(byCat).filter(c => !CATEGORIES.includes(c))];

    wrap.innerHTML = catOrder
      .filter(cat => byCat[cat] && byCat[cat].length)
      .map(cat => {
        const items = byCat[cat];
        const isOpen = openedCats.has(cat);
        const rows = items.map(i => itemRowHtml(i)).join('');
        return `
          <div class="sl-acc-item${isOpen ? ' open' : ''}" data-cat="${esc(cat)}">
            <button class="sl-acc-head" data-acc-cat="${esc(cat)}">
              <span>${esc(cat)}</span>
              <span class="sl-acc-meta">
                <span class="sl-acc-count">${items.length}</span>
                <span class="fin-acc-arrow">›</span>
              </span>
            </button>
            <div class="sl-acc-body">${rows}</div>
          </div>`;
      }).join('');

    bindActiveListEvents();
  }

  function itemRowHtml(item) {
    return `
      <div class="sl-item-row" data-id="${item.id}">
        <button class="sl-check" data-toggle-id="${item.id}" aria-label="Куплено"></button>
        <div class="sl-item-info" data-edit-id="${item.id}">
          <span class="sl-item-title">${esc(item.title)}</span>
          ${item.qty ? `<span class="sl-item-qty">${esc(item.qty)}</span>` : ''}
          <span class="sl-item-author">від ${esc(authorName(item.created_by))}</span>
        </div>
        <button class="sl-del-btn" data-delete-id="${item.id}" title="Видалити">×</button>
      </div>`;
  }

  function renderArchive() {
    const body  = el('sl-archive-body');
    const count = el('sl-archive-count');
    const arrow = el('sl-archive-arrow');
    if (!body) return;

    const bought = allItems.filter(i => i.bought)
      .sort((a, b) => new Date(b.bought_at || 0) - new Date(a.bought_at || 0));

    count.textContent = bought.length;
    body.classList.toggle('hidden', !archiveOpen);
    if (arrow) arrow.style.transform = archiveOpen ? 'rotate(90deg)' : 'rotate(0deg)';

    if (!bought.length) {
      body.innerHTML = '<p class="empty-state">Поки нічого не куплено.</p>';
      return;
    }

    body.innerHTML = bought.map(i => `
      <div class="sl-item-row sl-item-row-bought" data-id="${i.id}">
        <button class="sl-check sl-check-on" data-toggle-id="${i.id}" aria-label="Повернути в список">✓</button>
        <div class="sl-item-info">
          <span class="sl-item-title">${esc(i.title)}</span>
          ${i.qty ? `<span class="sl-item-qty">${esc(i.qty)}</span>` : ''}
          <span class="sl-item-author">купив(ла) ${esc(authorName(i.bought_by))}</span>
        </div>
        <button class="sl-del-btn" data-delete-id="${i.id}" title="Видалити">×</button>
      </div>`).join('');

    bindArchiveEvents();
  }

  function bindActiveListEvents() {
    const wrap = el('sl-active-list');

    wrap.querySelectorAll('[data-acc-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.accCat;
        if (openedCats.has(cat)) openedCats.delete(cat);
        else openedCats.add(cat);
        renderActiveList();
      });
    });

    wrap.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = allItems.find(i => String(i.id) === btn.dataset.toggleId);
        if (item) toggleBought(item);
      });
    });

    wrap.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(btn.dataset.deleteId);
      });
    });

    wrap.querySelectorAll('[data-edit-id]').forEach(info => {
      info.addEventListener('click', () => {
        const item = allItems.find(i => String(i.id) === info.dataset.editId);
        if (item) openEditModal(item);
      });
    });
  }

  function bindArchiveEvents() {
    const body = el('sl-archive-body');
    body.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = allItems.find(i => String(i.id) === btn.dataset.toggleId);
        if (item) toggleBought(item);
      });
    });
    body.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(btn.dataset.deleteId));
    });
  }

  function bindArchiveToggle() {
    const toggle = el('sl-archive-toggle');
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', () => {
      archiveOpen = !archiveOpen;
      renderArchive();
    });
  }

  function bindInputEvents() {
    const addBtn = el('sl-add-btn');
    const input  = el('sl-input');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', addFromInput);
    }
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addFromInput(); }
      });
    }
  }

  // ── INIT / REFRESH ──
  async function refresh() {
    const users = await Auth.getUsers();
    usersMap = {};
    users.forEach(u => { usersMap[u.id] = u.name; });
    bindInputEvents();
    bindArchiveToggle();
    DataCache.swr('shopping:items', loadItems, (items) => {
      allItems = items || [];
      renderActiveList();
      renderArchive();
    });
  }

  function init() {
    window.addEventListener('portal:view', e => {
      if (e.detail.view === 'shopping') refresh();
    });
  }

  return { init, refresh };
})();
