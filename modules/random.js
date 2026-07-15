// ============================================================
// CULINARY MODULE (вкладка "Кулінарія")
// 1) Конструктор: майстер питань → Claude (Edge Function culinary-ai)
//    генерує страву під смаки, обладнання і українські супермаркети
// 2) Улюблені: пул страв з рецептами (таблиця dishes) + рандом
// ============================================================
const RandomModule = (() => {

  /** @type {Dish[]} */
  let dishes = [];
  /** @type {'all' | DishCategory} */
  let activeDishCat = 'all'; // 'all' | 'meat' | 'vegan' | 'fast' | 'other'

  /** @type {Record<DishCategory, {label: string, color: string}>} */
  const DISH_CATS = {
    meat:  { label: '🥩 М\'ясне',  color: '#C45B79' },
    vegan: { label: '🥦 Вега',     color: '#5FA777' },
    fast:  { label: '⚡ Швидке',   color: '#D9A441' },
    other: { label: '🍽️ Інше',    color: '#9B6EA8' },
  };

  /** @param {string} str @returns {string} */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ============================================================
  // ДАНІ СТРАВ
  // ============================================================
  /** @returns {Promise<Dish[]>} */
  async function loadDishes() {
    let { data, error } = /** @type {SupaResult<any[]>} */ (await supabase
      .from('dishes')
      .select('id, title, category, recipe')
      .order('id', { ascending: false }));

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
      return (fb.data || []).map((/** @type {any} */ d) => /** @type {Dish} */ ({ ...d, category: d.category || 'other', recipe: d.recipe || null }));
    }
    return (data || []).map((/** @type {any} */ d) => /** @type {Dish} */ ({ ...d, category: d.category || 'other', recipe: d.recipe || null }));
  }

  /** @returns {Dish[]} */
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
        activeDishCat = /** @type {'all' | DishCategory} */ (/** @type {HTMLElement} */ (btn).dataset.cat);
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

  /** @param {Partial<RecipeIngredient>} [ing] @returns {string} */
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
  /** @param {Recipe | null} [recipe] @returns {string} */
  function recipeEditorHtml(recipe) {
    const r = recipe || /** @type {Partial<Recipe>} */ ({});
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
  /** @param {ParentNode} scope @returns {void} */
  function bindRecipeEditor(scope) {
    const editor = /** @type {HTMLElement} */ (scope.querySelector('#rcp-editor'));
    /** @type {HTMLElement} */ (scope.querySelector('#rcp-toggle')).addEventListener('click', () => {
      editor.classList.toggle('hidden');
      /** @type {HTMLElement} */ (scope.querySelector('#rcp-toggle-arrow')).classList.toggle('open', !editor.classList.contains('hidden'));
    });
    const ingList = /** @type {HTMLElement} */ (scope.querySelector('#rcp-ing-list'));
    /** @type {HTMLElement} */ (scope.querySelector('#rcp-add-ing')).addEventListener('click', () => {
      ingList.insertAdjacentHTML('beforeend', rcpIngRowHtml());
    });
    // Делегування видалення рядків
    ingList.addEventListener('click', (e) => {
      const del = /** @type {HTMLElement} */ (e.target).closest('.rcp-ing-del');
      if (del) del.closest('.rcp-ing-row')?.remove();
    });
  }

  // Збирає recipe-об'єкт з редактора; null — якщо рецепт порожній
  /** @param {ParentNode} scope @returns {Recipe | null} */
  function collectRecipe(scope) {
    const ingredients = [...scope.querySelectorAll('.rcp-ing-row')]
      .map(row => ({
        name:   /** @type {HTMLInputElement} */ (row.querySelector('.rcp-ing-name')).value.trim(),
        amount: /** @type {HTMLInputElement} */ (row.querySelector('.rcp-ing-amount')).value.trim(),
        unit:   /** @type {HTMLSelectElement} */ (row.querySelector('.rcp-ing-unit')).value
      }))
      .filter(i => i.name);

    const steps = /** @type {HTMLTextAreaElement} */ (scope.querySelector('#rcp-steps')).value
      .split('\n').map(s => s.trim()).filter(Boolean);

    if (!ingredients.length && !steps.length) return null;

    const servings = parseInt(/** @type {HTMLInputElement} */ (scope.querySelector('#rcp-servings')).value, 10) || 2;
    return { servings, ingredients, steps };
  }

  // ── Перегляд рецепта ──
  /** @param {Dish} dish @returns {void} */
  function openRecipeModal(dish) {
    const r = dish.recipe || /** @type {Partial<Recipe>} */ ({});
    const ings  = r.ingredients || [];
    const steps = r.steps || [];
    const root = /** @type {HTMLElement} */ (document.getElementById('modal-root'));
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

    /** @type {HTMLElement} */ (overlay.querySelector('#rcp-view-close')).addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    const toShop = overlay.querySelector('#rcp-to-shopping');
    if (toShop) toShop.addEventListener('click', () => addIngredientsToShopping(dish, /** @type {HTMLButtonElement} */ (toShop)));
  }

  // ── Інгредієнти → список покупок ──
  /** @param {{recipe: {ingredients: RecipeIngredient[]} | Recipe | null}} dish @param {HTMLButtonElement} btn @returns {Promise<void>} */
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
      category: i.shop_cat || 'Інше',
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

  /** @param {Dish[]} items @returns {void} */
  function renderDishes(items) {
    const wrap = /** @type {HTMLElement} */ (document.getElementById('dish-list'));

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
      btn.addEventListener('click', () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.deleteDishId;
        if (id) deleteDish(id);
      });
    });
    wrap.querySelectorAll('[data-edit-dish-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.editDishId;
        if (id) openEditDishModal(id);
      });
    });
    wrap.querySelectorAll('[data-recipe-id]').forEach(elm => {
      elm.addEventListener('click', () => {
        const recipeId = /** @type {HTMLElement} */ (elm).dataset.recipeId;
        const dish = dishes.find(x => String(x.id) === String(recipeId));
        if (dish) openRecipeModal(dish);
      });
    });
  }

  /** @param {string} id @returns {void} */
  function openEditDishModal(id) {
    const dish = dishes.find(x => String(x.id) === String(id));
    if (!dish) return;
    const currentCat = dish.category || 'other';

    const root = /** @type {HTMLElement} */ (document.getElementById('modal-root'));
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

    /** @type {DishCategory} */
    let selectedCat = currentCat;
    overlay.querySelectorAll('.dish-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.dish-cat-chip').forEach(c => { c.classList.remove('active'); c.removeAttribute('style'); });
        chip.classList.add('active');
        const chipEl = /** @type {HTMLElement} */ (chip);
        const catKey = /** @type {DishCategory} */ (chipEl.dataset.cat);
        const c = DISH_CATS[catKey];
        chipEl.style.cssText = `border-color:${c.color};background:${c.color};color:#fff`;
        selectedCat = catKey;
      });
    });

    /** @type {HTMLElement} */ (overlay.querySelector('#edit-dish-cancel')).addEventListener('click', () => root.innerHTML = '');
    overlay.addEventListener('click', e => { if (e.target === overlay) root.innerHTML = ''; });
    /** @type {HTMLElement} */ (overlay.querySelector('#edit-dish-save')).addEventListener('click', async () => {
      const title = /** @type {HTMLInputElement} */ (overlay.querySelector('#edit-dish-title')).value.trim();
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
    const resultEl = /** @type {HTMLElement} */ (document.getElementById('dish-result'));
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
      recipeBtn.dataset.dishId = String(pick.id);
    }
  }

  function refreshDishes() {
    DataCache.swr('dishes', loadDishes, (items) => {
      dishes = items || [];
      renderDishCatTabs();
      renderDishes(visibleDishes());
    });
  }

  /** @param {string} id @returns {Promise<void>} */
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
    const root = /** @type {HTMLElement} */ (document.getElementById('modal-root'));
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

    /** @type {DishCategory} */
    let selectedCat = /** @type {DishCategory} */ (Object.keys(DISH_CATS)[0]);
    document.querySelectorAll('#add-dish-cat-chips .dish-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#add-dish-cat-chips .dish-cat-chip').forEach(c => { c.classList.remove('active'); c.removeAttribute('style'); });
        chip.classList.add('active');
        const chipEl = /** @type {HTMLElement} */ (chip);
        const catKey = /** @type {DishCategory} */ (chipEl.dataset.cat);
        const c = DISH_CATS[catKey];
        chipEl.style.cssText = `border-color:${c.color};background:${c.color};color:#fff`;
        selectedCat = catKey;
      });
    });

    /** @type {HTMLElement} */ (document.getElementById('dish-cancel')).addEventListener('click', closeModal);
    /** @type {HTMLElement} */ (document.getElementById('dish-modal-overlay')).addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).id === 'dish-modal-overlay') closeModal();
    });
    /** @type {HTMLElement} */ (document.getElementById('dish-save')).addEventListener('click', () => saveDish(selectedCat));
  }

  /** @param {DishCategory} category @returns {Promise<void>} */
  async function saveDish(category) {
    const title = /** @type {HTMLInputElement} */ (document.getElementById('dish-title')).value.trim();
    if (!title) {
      alert('Вкажи назву страви');
      return;
    }

    const user = Auth.getCurrentUser();
    const recipe = collectRecipe(/** @type {HTMLElement} */ (document.getElementById('modal-root')));

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
  // КОНСТРУКТОР СТРАВ (Claude через Edge Function culinary-ai)
  // ============================================================
  /** @type {CulinaryStepDef[]} */
  const CUL_STEPS = [
    {
      key: 'type', title: 'Що готуємо?', hint: 'Один варіант', multi: false,
      options: ['Основна страва', 'Суп', 'Салат', 'Сніданок', 'Швидкий перекус', 'Десерт']
    },
    {
      key: 'taste', title: 'Якого смаку хочеться?', hint: 'До двох варіантів', multi: true, max: 2,
      options: ['Солоне', 'Кисле', 'Солодке', 'Гостре-пряне', 'Вершкове-ніжне', 'Копчено-димне', 'Кисло-солодке']
    },
    {
      key: 'base', title: 'Основа страви', hint: 'До трьох варіантів', multi: true, max: 3,
      options: ['Курка', 'Свинина', 'Яловичина', 'Риба', 'Морепродукти', 'Овочі', 'Гриби', 'Злаки та крупи', 'Боби', 'Яйця', 'Сир']
    },
    {
      key: 'ingredients', title: 'Наскільки прості інгредієнти?', hint: 'Один варіант', multi: false,
      options: ['Тільки базові — все є в АТБ, Сільпо чи Варусі', 'Можна щось особливе, пошукаємо']
    },
    {
      key: 'effort', title: 'Час і складність', hint: 'Один варіант', multi: false,
      options: ['Просте, до 30 хвилин', 'Середнє, до години', 'Можна заморочитись']
    },
    {
      key: 'cuisine', title: 'Кухня світу', hint: 'Один варіант', multi: false,
      options: ['Здивуй мене', 'Українська', 'Італійська', 'Грузинська', 'Азійська', 'Мексиканська', 'Близькосхідна', 'Французька', '✨ Авторська вигадка Клода']
    },
  ];

  let culStep = 0;
  /** @type {Record<string, string[]>} */
  let culAnswers = {};       // key → [обрані опції]
  /** @type {CulinaryDish | null} */
  let culDish = null;        // згенерована страва
  /** @type {string[]} */
  let culAvoid = [];         // назви вже запропонованих страв (для "ще варіант")

  const CUL_LS_KEY = 'amore:culinary';

  function culPersist() {
    try {
      localStorage.setItem(CUL_LS_KEY, JSON.stringify({
        dish: culDish, answers: culAnswers, avoid: culAvoid
      }));
    } catch (e) { /* ignore */ }
  }

  // Відновлення після перезавантаження: якщо є збережена страва — показуємо її
  function culRestore() {
    try {
      const raw = localStorage.getItem(CUL_LS_KEY);
      if (raw) {
        const saved = /** @type {{dish?: CulinaryDish, answers?: Record<string, string[]>, avoid?: string[]}} */ (JSON.parse(raw));
        if (saved && saved.dish && saved.dish.title) {
          culDish = saved.dish;
          culAnswers = saved.answers || {};
          culAvoid = saved.avoid || [];
          renderCulResult();
          return;
        }
      }
    } catch (e) { /* ignore */ }
    renderCulStep();
  }

  function culReset() {
    culStep = 0;
    culAnswers = {};
    culDish = null;
    culAvoid = [];
    try { localStorage.removeItem(CUL_LS_KEY); } catch (e) { /* ignore */ }
    renderCulStep();
  }

  function renderCulStep() {
    const card = document.getElementById('cul-card');
    if (!card) return;
    const step = CUL_STEPS[culStep];
    const chosen = culAnswers[step.key] || [];

    card.innerHTML = `
      <div class="cul-progress">
        ${CUL_STEPS.map((_, i) => `<span class="cul-progress-dot${i <= culStep ? ' filled' : ''}"></span>`).join('')}
      </div>
      <p class="cul-step-title">${step.title}</p>
      <p class="cul-step-hint">${step.hint}</p>
      <div class="cul-chips">
        ${step.options.map(o => `<button type="button" class="cul-chip${chosen.includes(o) ? ' active' : ''}" data-opt="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('')}
      </div>
      <div class="cul-nav">
        <button class="btn-secondary${culStep === 0 ? ' hidden' : ''}" id="cul-back">‹ Назад</button>
        <button class="btn-primary" id="cul-next" ${chosen.length ? '' : 'disabled'}>
          ${culStep === CUL_STEPS.length - 1 ? '🔮 Створити страву' : 'Далі ›'}
        </button>
      </div>`;

    card.querySelectorAll('.cul-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const opt = /** @type {HTMLElement} */ (chip).dataset.opt;
        let sel = culAnswers[step.key] || [];
        if (step.multi) {
          if (sel.includes(opt || '')) sel = sel.filter(x => x !== opt);
          else if (sel.length < (step.max || 99) && opt) sel = [...sel, opt];
        } else {
          sel = opt ? [opt] : [];
        }
        culAnswers[step.key] = sel;
        renderCulStep();
      });
    });

    /** @type {HTMLElement} */ (card.querySelector('#cul-back')).addEventListener('click', () => { culStep--; renderCulStep(); });
    /** @type {HTMLElement} */ (card.querySelector('#cul-next')).addEventListener('click', () => {
      if (culStep === CUL_STEPS.length - 1) culGenerate();
      else { culStep++; renderCulStep(); }
    });
  }

  /** @returns {Promise<void>} */
  async function culGenerate() {
    const card = document.getElementById('cul-card');
    if (!card) return;
    card.innerHTML = `
      <div class="cul-loading">
        <div class="cul-loading-emoji">👨‍🍳</div>
        <p class="cul-loading-text">Клод вигадує вам страву…</p>
        <p class="cul-step-hint">Аналізую смаки, підбираю інгредієнти з АТБ і Сільпо</p>
      </div>`;

    try {
      const { data, error } = await supabase.functions.invoke('culinary-ai', {
        body: { answers: culAnswers, avoid: culAvoid },
      });
      if (error) throw error;
      if (!data || !data.title || !Array.isArray(data.ingredients)) throw new Error('bad structure');

      culDish = data;
      culAvoid.push(data.title);
      culPersist();
      renderCulResult();
    } catch (e) {
      console.error('culinary-ai:', e);
      // Дістаємо реальну причину з відповіді функції, якщо вона є
      let detail = '';
      try {
        const err = /** @type {any} */ (e);
        if (err && err.context && typeof err.context.json === 'function') {
          const j = await err.context.json();
          if (j && j.error) detail = String(j.error);
        } else if (err && err.message) {
          detail = err.message;
        }
      } catch (_) { /* ignore */ }

      card.innerHTML = `
        <div class="cul-loading">
          <div class="cul-loading-emoji">😔</div>
          <p class="cul-loading-text">Не вийшло приготувати ідею</p>
          <p class="cul-step-hint">${detail ? escapeHtml(detail) : 'Спробуй ще раз за хвилину'}</p>
          <button class="btn-primary" id="cul-retry">Спробувати ще</button>
          ${culDish ? '<button class="btn-secondary" id="cul-back-dish">‹ До попередньої страви</button>' : ''}
        </div>`;
      /** @type {HTMLElement} */ (card.querySelector('#cul-retry')).addEventListener('click', culGenerate);
      const backBtn = card.querySelector('#cul-back-dish');
      if (backBtn) backBtn.addEventListener('click', renderCulResult);
    }
  }

  function renderCulResult() {
    const card = document.getElementById('cul-card');
    const d = culDish;
    if (!card || !d) return;
    const metaLine = [d.cuisine, d.time_minutes ? `⏱ ${d.time_minutes} хв` : '', d.difficulty]
      .filter(Boolean).join(' · ');

    card.innerHTML = `
      <p class="discover-title">${escapeHtml(d.title)}</p>
      ${metaLine ? `<p class="discover-meta">${escapeHtml(metaLine)}</p>` : ''}
      ${d.description ? `<p class="cul-desc">${escapeHtml(d.description)}</p>` : ''}
      ${d.tools && d.tools.length ? `<p class="cul-tools">🍳 ${escapeHtml(d.tools.join(', '))}</p>` : ''}
      <p class="rcp-view-subtitle">Інгредієнти ${d.servings ? `(на ${d.servings} порції)` : ''}</p>
      <div class="rcp-view-ings">
        ${d.ingredients.map(i => `
          <div class="rcp-view-ing">
            <span class="rcp-view-ing-name">${escapeHtml(i.name)}</span>
            <span class="rcp-view-ing-dots"></span>
            <span class="rcp-view-ing-amount">${escapeHtml([i.amount, i.unit].filter(Boolean).join(' '))}</span>
          </div>`).join('')}
      </div>
      <p class="rcp-view-subtitle">Приготування</p>
      <ol class="rcp-view-steps">
        ${(d.steps || []).map(st => `<li>${escapeHtml(st)}</li>`).join('')}
      </ol>
      <div class="discover-actions">
        <button class="btn-secondary" id="cul-fav-btn">❤️ В улюблені</button>
        <button class="btn-secondary" id="cul-shop-btn">🛒 В покупки</button>
      </div>
      <div class="discover-actions">
        <button class="btn-secondary" id="cul-again-btn">🔁 Інший варіант</button>
        <button class="btn-secondary" id="cul-restart-btn">✨ Спочатку</button>
      </div>`;

    /** @type {HTMLElement} */ (card.querySelector('#cul-fav-btn')).addEventListener('click', culSaveFavorite);
    /** @type {HTMLElement} */ (card.querySelector('#cul-shop-btn')).addEventListener('click', (e) =>
      addIngredientsToShopping({ recipe: { ingredients: d.ingredients } }, /** @type {HTMLButtonElement} */ (e.currentTarget)));
    /** @type {HTMLElement} */ (card.querySelector('#cul-again-btn')).addEventListener('click', culGenerate);
    /** @type {HTMLElement} */ (card.querySelector('#cul-restart-btn')).addEventListener('click', culReset);
  }

  /** @param {CulinaryDish} d @returns {DishCategory} */
  function culMapCategory(d) {
    const bases = (culAnswers.base || []).join(' ').toLowerCase();
    if (/курка|свинина|яловичина|риба|морепродукти/.test(bases)) return 'meat';
    if (/овочі|гриби|боби/.test(bases)) return 'vegan';
    if ((culAnswers.effort || [])[0] === 'Просте, до 30 хвилин') return 'fast';
    return 'other';
  }

  /** @returns {Promise<void>} */
  async function culSaveFavorite() {
    if (!culDish) return;
    const btn = /** @type {HTMLButtonElement} */ (document.getElementById('cul-fav-btn'));
    btn.disabled = true; btn.textContent = '⏳…';

    const user = Auth.getCurrentUser();
    const row = {
      title: culDish.title,
      category: culMapCategory(culDish),
      recipe: {
        servings: culDish.servings || 2,
        ingredients: culDish.ingredients,
        steps: culDish.steps || []
      },
      created_by: user ? user.id : null
    };

    const { error } = await supabase.from('dishes').insert(row);
    if (error) {
      console.error('Улюблені: помилка збереження', error);
      btn.disabled = false; btn.textContent = '❤️ В улюблені';
      ErrorBoundary.showToast('Не вдалось зберегти: ' + (error.message || 'невідома помилка'));
      return;
    }

    btn.textContent = '✅ В улюблених';
    DataCache.invalidate('dishes');
    refreshDishes();
    ErrorBoundary.showToast(`❤️ «${culDish.title}» збережено`, 'success');
  }

  // ── Сабтаби Кулінарії ──
  function initCulTabs() {
    document.querySelectorAll('.cul-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cul-tab').forEach(t =>
          t.classList.toggle('active', t === tab));
        document.querySelectorAll('.cul-panel').forEach(p => {
          const panelEl = /** @type {HTMLElement} */ (p);
          panelEl.classList.toggle('hidden', panelEl.dataset.culpanel !== /** @type {HTMLElement} */ (tab).dataset.cultab);
        });
      });
    });
  }

  // ============================================================
  // ЗАГАЛЬНЕ
  // ============================================================
  function closeModal() {
    closeModalAnimated();
  }

  function refresh() {
    refreshDishes();
    const resultEl = /** @type {HTMLElement} */ (document.getElementById('dish-result'));
    resultEl.textContent = 'Натисни «Рандом»';
    resultEl.classList.remove('rolled');
    document.getElementById('dish-result-recipe-btn')?.classList.add('hidden');
  }

  function init() {
    /** @type {HTMLElement} */ (document.getElementById('add-dish-btn')).addEventListener('click', openAddDishModal);
    /** @type {HTMLElement} */ (document.getElementById('roll-dish-btn')).addEventListener('click', rollDish);
    initCulTabs();
    culRestore();
    document.getElementById('dish-result-recipe-btn')?.addEventListener('click', (e) => {
      const dishId = /** @type {HTMLElement} */ (e.currentTarget).dataset.dishId;
      const dish = dishes.find(x => String(x.id) === String(dishId));
      if (dish) openRecipeModal(dish);
    });

    window.addEventListener('portal:view', (e) => {
      if (/** @type {any} */ (e).detail.view === 'random') refresh();
    });
  }

  return { init, refresh };
})();
