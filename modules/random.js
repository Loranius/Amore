// ============================================================
// RANDOM MODULE
// 1) Рандомайзер "хто/що" — редаговані категорії,
//    кожна категорія рандомить між Дімою та Лєною
// 2) Рандомайзер страв — редагований пул, кнопка "Рандом"
// ============================================================

const RandomModule = (() => {

  let dishes = [];
  let activeDishCat = 'all'; // 'all' | 'meat' | 'vegan' | 'fast' | 'other'

  const DISH_CATS = {
    meat:  { label: '🥩 М\'ясне',  color: '#C45B79' },
    vegan: { label: '🥦 Вега',     color: '#5FA777' },
    fast:  { label: '⚡ Швидке',   color: '#D9A441' },
    other: { label: '🍽️ Інше',    color: '#9B6EA8' },
  };

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
    let { data, error } = await supabase
      .from('dishes')
      .select('id, title, category, recipe')
      .order('id', { ascending: false });

    if (error) {
      // Колонка recipe ще не додана в Supabase — пробуємо без неї,
      // поки не виконано: alter table dishes add column recipe jsonb;
      let fb = await supabase.from('dishes').select('id, title, category').order('id', { ascending: false });
      if (fb.error) {
        // Немає і category — зовсім старий варіант таблиці
        fb = await supabase.from('dishes').select('id, title').order('id', { ascending: false });
        if (fb.error) {
          console.error('Помилка завантаження страв:', fb.error);
          return [];
        }
      }
      return (fb.data || []).map(d => ({ ...d, category: d.category || 'other', recipe: d.recipe || null }));
    }
    return (data || []).map(d => ({ ...d, category: d.category || 'other', recipe: d.recipe || null }));
  }

  function visibleDishes() {
    return activeDishCat === 'all'
      ? dishes
      : dishes.filter(d => (d.category || 'other') === activeDishCat);
  }

  function renderDishCatTabs() {
    const wrap = document.getElementById('dish-cat-tabs');
    if (!wrap) return;
    const defs = [{ key: 'all', label: '🎲 Всі' }, ...Object.entries(DISH_CATS).map(([key, c]) => ({ key, label: c.label }))];
    wrap.innerHTML = defs.map(d => {
      const count = d.key === 'all' ? dishes.length : dishes.filter(x => (x.category || 'other') === d.key).length;
      return `<button class="dish-cat-tab${activeDishCat === d.key ? ' active' : ''}" data-cat="${d.key}">${d.label} <span class="dish-cat-count">${count}</span></button>`;
    }).join('');
    wrap.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeDishCat = btn.dataset.cat;
        renderDishCatTabs();
        renderDishes(visibleDishes());
      });
    });
  }

  // ============================================================
  // РЕЦЕПТИ
  // recipe (jsonb): { servings, ingredients:[{name,amount,unit}], steps:[...] }
  // ============================================================
  const RCP_UNITS = ['г', 'кг', 'мл', 'л', 'шт', 'ст.л', 'ч.л', 'пучок', 'за смаком'];

  function rcpIngRowHtml(ing = {}) {
    return `
      <div class="rcp-ing-row">
        <input class="rcp-ing-name fin-inp" placeholder="Інгредієнт" value="${escapeHtml(ing.name || '')}">
        <input class="rcp-ing-amount fin-inp" placeholder="200" inputmode="decimal" value="${escapeHtml(ing.amount || '')}">
        <select class="rcp-ing-unit fin-inp">
          ${RCP_UNITS.map(u => `<option value="${u}"${u === (ing.unit || 'г') ? ' selected' : ''}>${u}</option>`).join('')}
        </select>
        <button type="button" class="delete-btn rcp-ing-del" title="Прибрати">×</button>
      </div>`;
  }

  // HTML секції рецепта всередині модалки страви
  function recipeEditorHtml(recipe) {
    const r = recipe || {};
    const ings = (r.ingredients && r.ingredients.length) ? r.ingredients : [{}];
    const hasRecipe = !!(recipe && ((recipe.ingredients || []).length || (recipe.steps || []).length));
    return `
      <div class="form-field">
        <button type="button" class="rcp-toggle${hasRecipe ? ' rcp-toggle--filled' : ''}" id="rcp-toggle">
          <span>📖 Рецепт ${hasRecipe ? '· є' : '(опційно)'}</span>
          <span class="fin-acc-arrow" id="rcp-toggle-arrow">›</span>
        </button>
        <div class="rcp-editor${hasRecipe ? '' : ' hidden'}" id="rcp-editor">
          <label>Порції</label>
          <input type="number" id="rcp-servings" class="fin-inp rcp-servings-inp" min="1" max="20" value="${r.servings || 2}">
          <label>Інгредієнти</label>
          <div id="rcp-ing-list">${ings.map(rcpIngRowHtml).join('')}</div>
          <button type="button" class="btn-secondary rcp-add-ing-btn" id="rcp-add-ing">+ Інгредієнт</button>
          <label>Приготування <span class="rcp-hint">(один крок — один рядок)</span></label>
          <textarea id="rcp-steps" rows="5" placeholder="Закип'ятити воду, посолити&#10;Зварити пасту 9 хв&#10;Обсмажити фарш з цибулею...">${escapeHtml((r.steps || []).join('\n'))}</textarea>
        </div>
      </div>`;
  }

  // Обробники редактора рецепта (кличемо після вставки HTML у DOM)
  function bindRecipeEditor(scope) {
    const editor = scope.querySelector('#rcp-editor');
    scope.querySelector('#rcp-toggle').addEventListener('click', () => {
      editor.classList.toggle('hidden');
      scope.querySelector('#rcp-toggle-arrow').classList.toggle('open', !editor.classList.contains('hidden'));
    });
    const ingList = scope.querySelector('#rcp-ing-list');
    scope.querySelector('#rcp-add-ing').addEventListener('click', () => {
      ingList.insertAdjacentHTML('beforeend', rcpIngRowHtml());
    });
    // Делегування видалення рядків
    ingList.addEventListener('click', (e) => {
      const del = e.target.closest('.rcp-ing-del');
      if (del) del.closest('.rcp-ing-row').remove();
    });
  }

  // Збирає recipe-об'єкт з редактора; null — якщо рецепт порожній
  function collectRecipe(scope) {
    const ingredients = [...scope.querySelectorAll('.rcp-ing-row')]
      .map(row => ({
        name:   row.querySelector('.rcp-ing-name').value.trim(),
        amount: row.querySelector('.rcp-ing-amount').value.trim(),
        unit:   row.querySelector('.rcp-ing-unit').value
      }))
      .filter(i => i.name);

    const steps = scope.querySelector('#rcp-steps').value
      .split('\n').map(s => s.trim()).filter(Boolean);

    if (!ingredients.length && !steps.length) return null;

    const servings = parseInt(scope.querySelector('#rcp-servings').value, 10) || 2;
    return { servings, ingredients, steps };
  }

  // ── Перегляд рецепта ──
  function openRecipeModal(dish) {
    const r = dish.recipe || {};
    const ings  = r.ingredients || [];
    const steps = r.steps || [];
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card rcp-view-card">
        <h3>${escapeHtml(dish.title)}</h3>
        ${r.servings ? `<p class="rcp-servings-line">🍽 Порцій: ${r.servings}</p>` : ''}
        ${ings.length ? `
          <p class="rcp-view-subtitle">Інгредієнти</p>
          <div class="rcp-view-ings">
            ${ings.map(i => `
              <div class="rcp-view-ing">
                <span class="rcp-view-ing-name">${escapeHtml(i.name)}</span>
                <span class="rcp-view-ing-dots"></span>
                <span class="rcp-view-ing-amount">${escapeHtml([i.amount, i.unit === 'за смаком' && !i.amount ? 'за смаком' : i.unit].filter(Boolean).join(' '))}</span>
              </div>`).join('')}
          </div>` : ''}
        ${steps.length ? `
          <p class="rcp-view-subtitle">Приготування</p>
          <ol class="rcp-view-steps">
            ${steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>` : ''}
        <div class="modal-actions">
          <button class="btn-secondary" id="rcp-view-close">Закрити</button>
          ${ings.length ? '<button class="btn-primary" id="rcp-to-shopping">🛒 В покупки</button>' : ''}
        </div>
      </div>`;
    root.innerHTML = ''; root.appendChild(overlay);

    overlay.querySelector('#rcp-view-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    const toShop = overlay.querySelector('#rcp-to-shopping');
    if (toShop) toShop.addEventListener('click', () => addIngredientsToShopping(dish, toShop));
  }

  // ── Інгредієнти → список покупок ──
  async function addIngredientsToShopping(dish, btn) {
    const ings = (dish.recipe && dish.recipe.ingredients) || [];
    if (!ings.length) return;

    btn.disabled = true;
    btn.textContent = '⏳ Додаю…';

    const user = Auth.getCurrentUser();
    const rows = ings.map(i => ({
      title: i.name,
      qty: i.unit === 'за смаком'
        ? 'за смаком'
        : ([i.amount, i.unit].filter(Boolean).join(' ') || null),
      category: 'Продукти',
      created_by: user ? user.id : null
    }));

    const { error } = await supabase.from('shopping_items').insert(rows);
    if (error) {
      console.error('Рецепт → покупки: помилка', error);
      btn.disabled = false;
      btn.textContent = '🛒 В покупки';
      ErrorBoundary.showToast('Не вдалось додати в покупки');
      return;
    }

    DataCache.invalidate('shopping:items');
    closeModal();
    ErrorBoundary.showToast(`🛒 ${rows.length} інгр. додано в покупки`, 'success');
  }

  function renderDishes(items) {
    const wrap = document.getElementById('dish-list');

    if (!items.length) {
      wrap.innerHTML = dishes.length
        ? '<p class="empty-state">У цій категорії поки порожньо.</p>'
        : '<p class="empty-state">Пул страв порожній. Додай свої улюблені!</p>';
      return;
    }

    wrap.innerHTML = '';
    items.forEach(d => {
      const cat = DISH_CATS[d.category] || DISH_CATS.other;
      const hasRecipe = !!(d.recipe && ((d.recipe.ingredients || []).length || (d.recipe.steps || []).length));
      const row = document.createElement('div');
      row.className = 'dish-row';
      row.innerHTML = `
        <span class="dish-cat-dot" style="background:${cat.color}" title="${cat.label}"></span>
        <p class="dish-title${hasRecipe ? ' dish-title--link' : ''}" ${hasRecipe ? `data-recipe-id="${d.id}"` : ''}>${escapeHtml(d.title)}</p>
        <div class="dish-row-actions">
          ${hasRecipe ? `<button class="dish-edit-btn" data-recipe-id="${d.id}" title="Рецепт">📖</button>` : ''}
          <button class="dish-edit-btn" data-edit-dish-id="${d.id}" title="Редагувати">✏️</button>
          <button class="delete-btn" data-delete-dish-id="${d.id}" title="Видалити">×</button>
        </div>
      `;
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('[data-delete-dish-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteDish(btn.dataset.deleteDishId));
    });
    wrap.querySelectorAll('[data-edit-dish-id]').forEach(btn => {
      btn.addEventListener('click', () => openEditDishModal(btn.dataset.editDishId));
    });
    wrap.querySelectorAll('[data-recipe-id]').forEach(elm => {
      elm.addEventListener('click', () => {
        const dish = dishes.find(x => String(x.id) === String(elm.dataset.recipeId));
        if (dish) openRecipeModal(dish);
      });
    });
  }

  function openEditDishModal(id) {
    const dish = dishes.find(x => String(x.id) === String(id));
    if (!dish) return;
    const currentCat = dish.category || 'other';

    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card rcp-modal-card">
        <h3>Редагувати страву</h3>
        <div class="form-field">
          <label>Назва</label>
          <input type="text" id="edit-dish-title" class="fin-inp" value="${escapeHtml(dish.title)}">
        </div>
        <div class="form-field">
          <label>Категорія</label>
          <div class="dish-cat-chips" id="edit-dish-cat-chips">
            ${Object.entries(DISH_CATS).map(([key, c]) =>
              `<button type="button" class="dish-cat-chip${key === currentCat ? ' active' : ''}" data-cat="${key}" style="${key === currentCat ? `border-color:${c.color};background:${c.color};color:#fff` : ''}">${c.label}</button>`
            ).join('')}
          </div>
        </div>
        ${recipeEditorHtml(dish.recipe)}
        <div class="modal-actions">
          <button class="btn-secondary" id="edit-dish-cancel">Скасувати</button>
          <button class="btn-primary" id="edit-dish-save">Зберегти</button>
        </div>
      </div>`;
    root.innerHTML = ''; root.appendChild(overlay);

    bindRecipeEditor(overlay);

    let selectedCat = currentCat;
    overlay.querySelectorAll('.dish-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.dish-cat-chip').forEach(c => { c.classList.remove('active'); c.removeAttribute('style'); });
        chip.classList.add('active');
        const c = DISH_CATS[chip.dataset.cat];
        chip.style.cssText = `border-color:${c.color};background:${c.color};color:#fff`;
        selectedCat = chip.dataset.cat;
      });
    });

    overlay.querySelector('#edit-dish-cancel').addEventListener('click', () => root.innerHTML = '');
    overlay.addEventListener('click', e => { if (e.target === overlay) root.innerHTML = ''; });
    overlay.querySelector('#edit-dish-save').addEventListener('click', async () => {
      const title = overlay.querySelector('#edit-dish-title').value.trim();
      if (!title) return;
      const recipe = collectRecipe(overlay);
      let { error } = await supabase.from('dishes').update({ title, category: selectedCat, recipe }).eq('id', id);
      if (error) {
        // Колонки recipe ще немає — зберігаємо без рецепта, підказуємо міграцію
        const fb = await supabase.from('dishes').update({ title, category: selectedCat }).eq('id', id);
        if (fb.error) { alert('Помилка збереження'); return; }
        if (recipe) ErrorBoundary.showToast('Збережено без рецепта: додай колонку recipe в Supabase', 'warn');
      }
      root.innerHTML = '';
      DataCache.invalidate('dishes');
      refreshDishes();
    });
  }

  function rollDish() {
    const resultEl = document.getElementById('dish-result');
    const recipeBtn = document.getElementById('dish-result-recipe-btn');
    const pool = visibleDishes();
    if (!pool.length) {
      resultEl.textContent = dishes.length ? 'У цій категорії порожньо' : 'Пул страв порожній';
      if (recipeBtn) recipeBtn.classList.add('hidden');
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const cat = DISH_CATS[pick.category] || DISH_CATS.other;
    resultEl.textContent = pick.title;
    resultEl.title = cat.label;
    resultEl.classList.remove('rolled');
    void resultEl.offsetWidth; // рестарт анімації
    resultEl.classList.add('rolled');

    // Кнопка рецепта під результатом
    if (recipeBtn) {
      const hasRecipe = !!(pick.recipe && ((pick.recipe.ingredients || []).length || (pick.recipe.steps || []).length));
      recipeBtn.classList.toggle('hidden', !hasRecipe);
      recipeBtn.dataset.dishId = pick.id;
    }
  }

  function refreshDishes() {
    DataCache.swr('dishes', loadDishes, (items) => {
      dishes = items || [];
      renderDishCatTabs();
      renderDishes(visibleDishes());
    });
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
        <div class="modal-card rcp-modal-card">
          <h3>Нова страва</h3>
          <div class="form-field">
            <label for="dish-title">Назва страви</label>
            <input type="text" id="dish-title" placeholder="Наприклад, Паста болоньєзе">
          </div>
          <div class="form-field">
            <label>Категорія</label>
            <div class="dish-cat-chips" id="add-dish-cat-chips">
              ${Object.entries(DISH_CATS).map(([key, c], i) =>
                `<button type="button" class="dish-cat-chip${i === 0 ? ' active' : ''}" data-cat="${key}" style="${i === 0 ? `border-color:${c.color};background:${c.color};color:#fff` : ''}">${c.label}</button>`
              ).join('')}
            </div>
          </div>
          ${recipeEditorHtml(null)}
          <div class="modal-actions">
            <button class="btn-secondary" id="dish-cancel">Скасувати</button>
            <button class="btn-primary" id="dish-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    bindRecipeEditor(root);

    let selectedCat = Object.keys(DISH_CATS)[0];
    document.querySelectorAll('#add-dish-cat-chips .dish-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#add-dish-cat-chips .dish-cat-chip').forEach(c => { c.classList.remove('active'); c.removeAttribute('style'); });
        chip.classList.add('active');
        const c = DISH_CATS[chip.dataset.cat];
        chip.style.cssText = `border-color:${c.color};background:${c.color};color:#fff`;
        selectedCat = chip.dataset.cat;
      });
    });

    document.getElementById('dish-cancel').addEventListener('click', closeModal);
    document.getElementById('dish-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'dish-modal-overlay') closeModal();
    });
    document.getElementById('dish-save').addEventListener('click', () => saveDish(selectedCat));
  }

  async function saveDish(category) {
    const title = document.getElementById('dish-title').value.trim();
    if (!title) {
      alert('Вкажи назву страви');
      return;
    }

    const user = Auth.getCurrentUser();
    const recipe = collectRecipe(document.getElementById('modal-root'));

    let { error } = await supabase.from('dishes').insert({
      title,
      category: category || 'other',
      recipe,
      created_by: user ? user.id : null
    });

    if (error) {
      // Колонки recipe ще немає — пробуємо без неї
      const fb = await supabase.from('dishes').insert({
        title,
        category: category || 'other',
        created_by: user ? user.id : null
      });
      if (fb.error) {
        console.error('Помилка збереження страви:', fb.error);
        alert('Не вдалось зберегти страву');
        return;
      }
      if (recipe) ErrorBoundary.showToast('Збережено без рецепта: додай колонку recipe в Supabase', 'warn');
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
    document.getElementById('dish-result-recipe-btn')?.classList.add('hidden');
  }

  function init() {
    document.getElementById('add-randcat-btn').addEventListener('click', openAddCategoryModal);
    document.getElementById('add-dish-btn').addEventListener('click', openAddDishModal);
    document.getElementById('roll-dish-btn').addEventListener('click', rollDish);
    document.getElementById('dish-result-recipe-btn')?.addEventListener('click', (e) => {
      const dish = dishes.find(x => String(x.id) === String(e.currentTarget.dataset.dishId));
      if (dish) openRecipeModal(dish);
    });

    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'random') refresh();
    });
  }

  return { init, refresh };
})();
