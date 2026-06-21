// ============================================================
// WISHLIST MODULE v5 — Бажання + Розміри + Архів
// ============================================================
// SQL (виконати один раз у Supabase SQL Editor):
//   ALTER TABLE wishlist_items
//     ADD COLUMN IF NOT EXISTS fulfilled      BOOLEAN DEFAULT FALSE,
//     ADD COLUMN IF NOT EXISTS fulfilled_by   INTEGER,
//     ADD COLUMN IF NOT EXISTS fulfilled_at   TIMESTAMPTZ;
// ============================================================
const Wishlist = (() => {

  let allUsers     = [];
  let currentUser  = null;
  let partnerUser  = null;
  let activeTab    = 'wishes';
  let wishingFor   = 'me';     // 'me' | 'partner'
  let sizesOwnerId = null;
  let archiveOpen  = false;    // чи розгорнутий архів у «Мої бажання»

  const el  = id => document.getElementById(id);
  const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };

  const PRIORITY_LABELS = {
    high:   '🔥 Високий',
    medium: '🟡 Середній',
    low:    '🟢 Низький',
  };

  // ── ДАНІ ──────────────────────────────────────────────────
  async function loadUsers() {
    const {data} = await supabase.from('users').select('id,name').order('id',{ascending:true});
    return data||[];
  }

  // Активні бажання (не виконані)
  async function loadItems(ownerId) {
    const {data} = await supabase
      .from('wishlist_items')
      .select('id,title,description,link,image_url,gift_date,owner,reserved,reserved_by,price,priority,fulfilled,fulfilled_by,fulfilled_at')
      .eq('owner', ownerId)
      .or('fulfilled.is.null,fulfilled.eq.false')
      .order('id', {ascending:false});
    return data||[];
  }

  // Виконані бажання (архів)
  async function loadFulfilledItems(ownerId) {
    const {data} = await supabase
      .from('wishlist_items')
      .select('id,title,description,link,image_url,price,priority,fulfilled_at,fulfilled_by')
      .eq('owner', ownerId)
      .eq('fulfilled', true)
      .order('fulfilled_at', {ascending:false});
    return data||[];
  }

  async function loadSizes(userId) {
    const {data} = await supabase.from('user_sizes').select('*').eq('user_id', userId).single();
    return data||{};
  }

  // ── TELEGRAM СПОВІЩЕННЯ ───────────────────────────────────
  // Надсилаємо лише мінімум даних — текст будує Edge Function,
  // щоб HTML-форматування і імена були централізовані на сервері.
  async function sendFulfilledNotification(item, owner, buyer) {
    try {
      await supabase.functions.invoke('db-notify', {
        body: {
          type:      'wish_fulfilled',
          itemTitle: item.title,
          ownerId:   owner?.id,
          buyerId:   buyer.id,
        },
      });
    } catch (e) {
      console.warn('[Wishlist] db-notify error:', e);
    }
  }

  // ── ВИКОНАННЯ БАЖАННЯ ─────────────────────────────────────
  async function fulfillWish(item) {
    const owner = allUsers.find(u => u.id === item.owner);
    const confirmMsg =
      `Підтверджуєш, що купив(ла) «${item.title}»? 🎁\n\nОбидва отримають сповіщення ✉️`;
    if (!confirm(confirmMsg)) return;

    // Знаходимо кнопку і ставимо лоадер
    const btn = document.querySelector(`[data-fulfill-id="${item.id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Збереження…'; }

    const { error } = await supabase.from('wishlist_items').update({
      fulfilled:    true,
      fulfilled_by: currentUser.id,
      fulfilled_at: new Date().toISOString(),
      reserved:     true,
      reserved_by:  currentUser.id,
    }).eq('id', item.id);

    if (error) {
      alert('Помилка: ' + error.message);
      if (btn) { btn.disabled = false; btn.textContent = '✅ Вже купив(ла)'; }
      return;
    }

    // Надсилаємо сповіщення (не блокуємо UI)
    sendFulfilledNotification(item, owner || { name: '?', id: item.owner }, currentUser);

    // Святкові конфеті 🎉
    if (window.Confetti) Confetti.burst();

    // Скидаємо кеш і перемальовуємо
    invalidateWishes();
    DataCache.invalidate('wishlist:archive:' + item.owner);
    renderGrid();
  }

  // ── ВКЛАДКИ (Бажання / Розміри) ───────────────────────────
  function setupTabs() {
    document.querySelectorAll('.wl-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.wl-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    el('wl-panel-wishes')?.classList.toggle('hidden', tab !== 'wishes');
    el('wl-panel-sizes')?.classList.toggle('hidden',  tab !== 'sizes');
    if (tab === 'wishes') renderWishes();
    if (tab === 'sizes')  renderSizes();
  }

  // ── ПІДВКЛАДКИ МОЄ / ПАРТНЕР ──────────────────────────────
  function renderSubTabs() {
    const rawName = partnerUser?.name || 'Партнера';
    const partnerName = rawName === 'Діма' ? 'Діми' : rawName === 'Лєна' ? 'Лєни' : rawName;
    const existing = el('wl-sub-tabs');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'wl-sub-tabs';
    bar.className = 'wl-sub-tabs';
    bar.innerHTML = `
      <button class="wl-sub-btn${wishingFor==='me'?' active':''}" data-for="me">Мої бажання</button>
      <button class="wl-sub-btn${wishingFor==='partner'?' active':''}" data-for="partner">Бажання ${esc(partnerName)}</button>`;

    const panel = el('wl-panel-wishes');
    panel.insertBefore(bar, panel.firstChild);

    bar.querySelectorAll('.wl-sub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wishingFor = btn.dataset.for;
        bar.querySelectorAll('.wl-sub-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.for === wishingFor));
        renderGrid();
      });
    });

    const title  = el('wl-title');
    const addBtn = el('add-wish-btn');
    if (title)  title.textContent  = wishingFor === 'me' ? 'Мої бажання' : `Бажання ${partnerName}`;
    if (addBtn) addBtn.style.display = wishingFor === 'me' ? 'flex' : 'none';
  }

  async function renderWishes() {
    renderSubTabs();
    renderGrid();
  }

  // ── АКТИВНА СІТКА БАЖАНЬ ──────────────────────────────────
  function renderGrid() {
    const wrap = el('wishlist-grid'); if (!wrap) return;

    const rawName     = partnerUser?.name || 'Партнера';
    const partnerName = rawName === 'Діма' ? 'Діми' : rawName === 'Лєна' ? 'Лєни' : rawName;
    const isOwnList   = wishingFor === 'me';
    const ownerId     = isOwnList ? currentUser?.id : partnerUser?.id;
    const title       = el('wl-title');
    const addBtn      = el('add-wish-btn');

    if (title)  title.textContent   = isOwnList ? 'Мої бажання' : `Бажання ${partnerName}`;
    if (addBtn) addBtn.style.display = isOwnList ? 'flex' : 'none';

    if (ownerId == null) {
      wrap.innerHTML = '<p class="empty-state">Користувача не знайдено.</p>';
      return;
    }

    if (DataCache.get('wishlist:' + ownerId) === undefined) {
      wrap.innerHTML = '<p class="empty-state" style="opacity:0.4">Завантаження...</p>';
    }

    DataCache.swr('wishlist:' + ownerId, () => loadItems(ownerId), (items) => {
      paintGrid(items || [], isOwnList, ownerId);
    });
  }

  function paintGrid(items, isOwnList, ownerId) {
    const wrap = el('wishlist-grid'); if (!wrap) return;

    const frag = document.createDocumentFragment();

    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = isOwnList
        ? 'Твій список порожній. Час додати нову забаганку.'
        : 'Партнер ще не додав жодного бажання.';
      frag.appendChild(p);
    } else {
      items.forEach(item => frag.appendChild(makeCard(item, isOwnList)));
    }

    // Архів бажань — тільки у своїй вкладці
    if (isOwnList) {
      frag.appendChild(makeArchiveBlock(ownerId));
    }

    wrap.innerHTML = '';
    wrap.appendChild(frag);
  }

  // ── КАРТКА БАЖАННЯ ────────────────────────────────────────
  function makeCard(item, isOwn) {
    const card = document.createElement('div');
    card.className = 'wl-card';

    const price    = item.price
      ? `<span class="wl-card-price">${(+item.price).toLocaleString('uk-UA')} ₴</span>` : '';
    const priority = item.priority
      ? `<span class="wl-card-priority">${PRIORITY_LABELS[item.priority]||''}</span>` : '';
    const comment  = item.description
      ? `<p class="wl-card-comment">${esc(item.description)}</p>` : '';
    const titleEl  = item.link
      ? `<a class="wl-card-title" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a>`
      : `<span class="wl-card-title">${esc(item.title)}</span>`;

    let actions = '';
    if (isOwn) {
      actions = `
        <div class="wl-card-actions">
          <button class="btn-secondary wl-edit-btn" data-id="${item.id}">✏️ Редагувати</button>
          <button class="btn-secondary wl-del-btn"  data-id="${item.id}">🗑 Видалити</button>
        </div>`;
    } else {
      const isReserved = item.reserved;
      if (isReserved) {
        // "Вже купив(ла)" — тепер справжня клікабельна кнопка
        actions = `
          <div class="wl-card-actions wl-reserved-row">
            <button class="wl-fulfill-btn" data-fulfill-id="${item.id}">✅ Вже купив(ла)</button>
            <button class="wl-cancel-reserve-btn" data-id="${item.id}">Скасувати бронь</button>
          </div>`;
      } else {
        actions = `
          <div class="wl-card-actions">
            <button class="wl-reserve-btn" data-id="${item.id}">🎁 Забронювати</button>
          </div>`;
      }
    }

    card.innerHTML = `
      <div class="wl-card-body">
        <div class="wl-card-header">${titleEl}${price}</div>
        <div class="wl-card-meta">${priority}</div>
        ${comment}
        ${actions}
      </div>`;

    // Свайп вліво для швидкого видалення (тільки свої)
    if (isOwn) {
      let startX = 0, dx = 0, swiping = false;
      card.addEventListener('touchstart', e => { startX = e.touches[0].clientX; swiping = true; dx = 0; }, { passive: true });
      card.addEventListener('touchmove',  e => {
        if (!swiping) return;
        dx = e.touches[0].clientX - startX;
        if (dx < 0) card.style.transform = `translateX(${Math.max(dx, -80)}px)`;
      }, { passive: true });
      card.addEventListener('touchend', () => {
        swiping = false;
        if (dx < -60) {
          card.style.transition = 'transform 0.2s';
          card.style.transform  = 'translateX(-80px)';
          card.querySelector('.wl-del-btn')?.classList.add('swipe-visible');
        } else {
          card.style.transition = 'transform 0.2s';
          card.style.transform  = '';
        }
      });
    }

    card.querySelector('.wl-edit-btn')?.addEventListener('click', () => openEditModal(item));
    card.querySelector('.wl-del-btn')?.addEventListener('click',  () => deleteItem(item.id));
    card.querySelector('.wl-reserve-btn')?.addEventListener('click',  () => reserveItem(item.id, false));
    card.querySelector('.wl-cancel-reserve-btn')?.addEventListener('click', () => cancelReserve(item.id));
    card.querySelector('.wl-fulfill-btn')?.addEventListener('click', () => fulfillWish(item));

    return card;
  }

  // ── АРХІВ (виконані бажання) ───────────────────────────────
  function makeArchiveBlock(ownerId) {
    const wrap = document.createElement('div');
    wrap.className = 'wl-archive-wrap';

    // Заголовок-тоглер
    const toggle = document.createElement('button');
    toggle.className = 'wl-archive-toggle';
    toggle.innerHTML = `<span class="wl-archive-toggle-label">✅ Виконані бажання</span><span class="wl-archive-toggle-arrow">${archiveOpen ? '▲' : '▼'}</span>`;
    wrap.appendChild(toggle);

    // Контейнер для карток
    const body = document.createElement('div');
    body.className = 'wl-archive-body' + (archiveOpen ? '' : ' hidden');
    wrap.appendChild(body);

    toggle.addEventListener('click', () => {
      archiveOpen = !archiveOpen;
      body.classList.toggle('hidden', !archiveOpen);
      toggle.querySelector('.wl-archive-toggle-arrow').textContent = archiveOpen ? '▲' : '▼';
      if (archiveOpen) loadAndPaintArchive(ownerId, body);
    });

    // Якщо вже відкритий — одразу вантажимо
    if (archiveOpen) loadAndPaintArchive(ownerId, body);

    return wrap;
  }

  function loadAndPaintArchive(ownerId, body) {
    body.innerHTML = '<p class="empty-state" style="opacity:0.4;padding:12px 0">Завантаження…</p>';
    DataCache.swr('wishlist:archive:' + ownerId, () => loadFulfilledItems(ownerId), (items) => {
      paintArchive(items || [], body);
    });
  }

  function paintArchive(items, body) {
    if (!items.length) {
      body.innerHTML = '<p class="empty-state" style="padding:12px 0">Поки жодного виконаного бажання 🌸</p>';
      return;
    }
    body.innerHTML = '';
    const buyerMap = allUsers.reduce((m, u) => { m[u.id] = u.name; return m; }, {});

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'wl-archive-card';

      const price = item.price
        ? `<span class="wl-archive-price">${(+item.price).toLocaleString('uk-UA')} ₴</span>` : '';
      const who = item.fulfilled_by
        ? `<span class="wl-archive-by">Купив(ла): ${esc(buyerMap[item.fulfilled_by] || '?')}</span>` : '';
      const when = item.fulfilled_at
        ? `<span class="wl-archive-date">${new Date(item.fulfilled_at).toLocaleDateString('uk-UA', {day:'numeric',month:'long',year:'numeric'})}</span>` : '';

      const titleEl = item.link
        ? `<a class="wl-archive-title" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a>`
        : `<span class="wl-archive-title">${esc(item.title)}</span>`;

      card.innerHTML = `
        <div class="wl-archive-check">✅</div>
        <div class="wl-archive-info">
          <div class="wl-archive-header">${titleEl}${price}</div>
          <div class="wl-archive-meta">${who}${when}</div>
        </div>`;
      body.appendChild(card);
    });
  }

  // ── МОДАЛКИ БАЖАНЬ ────────────────────────────────────────
  function openAddModal()       { openWishModal(null); }
  function openEditModal(item)  { openWishModal(item); }

  function openWishModal(item) {
    const isEdit  = !!item;
    const root    = el('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${isEdit ? 'Редагувати бажання' : 'Нове бажання'}</h3>
        <div class="form-field">
          <label>Назва *</label>
          <input class="fin-inp" id="wm-title" type="text" placeholder="Що хочеш?" value="${esc(item?.title||'')}">
        </div>
        <div class="form-field">
          <label>Посилання</label>
          <input class="fin-inp" id="wm-link" type="url" placeholder="https://..." value="${esc(item?.link||'')}">
        </div>
        <div class="form-field">
          <label>Фото (URL)</label>
          <input class="fin-inp" id="wm-img" type="url" placeholder="https://..." value="${esc(item?.image_url||'')}">
        </div>
        <div class="form-field">
          <label>Орієнтовна ціна, ₴</label>
          <input class="fin-inp" id="wm-price" type="number" min="0" placeholder="0" value="${item?.price||''}">
        </div>
        <div class="form-field">
          <label>Пріоритет</label>
          <select class="fin-inp" id="wm-priority">
            <option value="">— не вказано —</option>
            <option value="high"   ${item?.priority==='high'  ?'selected':''}>🔥 Високий</option>
            <option value="medium" ${item?.priority==='medium'?'selected':''}>🟡 Середній</option>
            <option value="low"    ${item?.priority==='low'   ?'selected':''}>🟢 Низький</option>
          </select>
        </div>
        <div class="form-field">
          <label>Коментар / деталі</label>
          <textarea class="fin-inp" id="wm-desc" rows="2" placeholder="Розмір, колір, деталі..." style="resize:vertical">${esc(item?.description||'')}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="wm-cancel">Скасувати</button>
          <button class="btn-primary"   id="wm-save">${isEdit ? 'Зберегти' : 'Додати'}</button>
        </div>
      </div>`;

    root.innerHTML = '';
    root.appendChild(overlay);

    overlay.querySelector('#wm-cancel').addEventListener('click', () => root.innerHTML='');
    overlay.addEventListener('click', e => { if (e.target===overlay) root.innerHTML=''; });

    overlay.querySelector('#wm-save').addEventListener('click', async () => {
      const g     = id => overlay.querySelector('#' + id);
      const title = g('wm-title').value.trim();
      if (!title) { g('wm-title').style.borderColor='var(--danger)'; return; }

      const saveBtn = g('wm-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Збереження...';

      const payload = {
        title,
        link:        g('wm-link').value.trim()||null,
        image_url:   g('wm-img').value.trim()||null,
        price:       parseFloat(g('wm-price').value)||null,
        priority:    g('wm-priority').value||null,
        description: g('wm-desc').value.trim()||null,
      };

      let error;
      if (isEdit) {
        ({error} = await supabase.from('wishlist_items').update(payload).eq('id', item.id));
      } else {
        ({error} = await supabase.from('wishlist_items').insert({
          ...payload,
          owner:       currentUser.id,
          reserved:    false,
          reserved_by: null,
          fulfilled:   false,
        }));
      }

      if (error) {
        alert('Помилка: ' + error.message);
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Зберегти' : 'Додати';
        return;
      }
      invalidateWishes();
      root.innerHTML = '';
      renderGrid();
    });
  }

  async function deleteItem(id) {
    if (!confirm('Видалити бажання?')) return;
    const ownerId = currentUser?.id;

    // Оптимістично прибираємо
    const cached = DataCache.get('wishlist:' + ownerId);
    if (cached) {
      const snapshot = [...cached];
      DataCache.set('wishlist:' + ownerId, cached.filter(i => i.id !== id));
      renderGrid();

      const { error } = await Retry.query(() =>
        supabase.from('wishlist_items').delete().eq('id', id)
      );
      if (error) {
        DataCache.set('wishlist:' + ownerId, snapshot);
        renderGrid();
        ErrorBoundary.showToast('Не вдалось видалити бажання. Спробуй ще.');
        return;
      }
    } else {
      const {error} = await supabase.from('wishlist_items').delete().eq('id', id);
      if (error) { alert('Помилка: ' + error.message); return; }
      invalidateWishes();
      renderGrid();
    }
  }

  async function reserveItem(id, isReserved) {
    const newVal = !isReserved;
    const ownerId = wishingFor === 'me' ? currentUser?.id : partnerUser?.id;

    // 1. Оптимістично оновлюємо кеш
    const cached = DataCache.get('wishlist:' + ownerId);
    if (cached) {
      const snapshot = cached.map(i => ({...i}));
      const target = cached.find(i => i.id === id);
      if (target) {
        target.reserved    = newVal;
        target.reserved_by = newVal ? currentUser.id : null;
      }
      DataCache.set('wishlist:' + ownerId, cached);
      renderGrid(); // миттєво

      // 2. Пишемо в БД (з retry)
      const { error } = await Retry.query(() =>
        supabase.from('wishlist_items')
          .update({ reserved: newVal, reserved_by: newVal ? currentUser.id : null })
          .eq('id', id)
      );

      if (error) {
        // Відкочуємо
        DataCache.set('wishlist:' + ownerId, snapshot);
        renderGrid();
        ErrorBoundary.showToast('Не вдалось оновити бажання. Спробуй ще.');
        return;
      }
    } else {
      // Кешу немає — звичайний шлях
      const { error } = await supabase.from('wishlist_items')
        .update({ reserved: newVal, reserved_by: newVal ? currentUser.id : null })
        .eq('id', id);
      if (error) { alert('Помилка: ' + error.message); return; }
      invalidateWishes();
      renderGrid();
    }
  }

  async function cancelReserve(id) {
    if (!confirm('Скасувати бронювання цього подарунка?')) return;
    await reserveItem(id, true);
  }

  // ── РОЗМІРИ ───────────────────────────────────────────────
  function renderSizes() {
    const wrap = el('wishlist-sizes-grid'); if (!wrap) return;
    if (!sizesOwnerId) sizesOwnerId = currentUser?.id;
    if (sizesOwnerId == null) return;
    DataCache.swr('sizes:' + sizesOwnerId, () => loadSizes(sizesOwnerId), (sizes) => paintSizes(sizes || {}));
  }

  function paintSizes(sizes) {
    const wrap = el('wishlist-sizes-grid'); if (!wrap) return;
    const user     = allUsers.find(u => u.id === sizesOwnerId);
    const isFemale = user?.name === 'Лєна';

    wrap.innerHTML = `
      <div class="sizes-page">
        <div class="sizes-body-wrap">${buildBodySvg(isFemale, sizes)}</div>
        <div class="sz-user-switcher">
          ${allUsers.map((u,i) => `<button class="sz-user-btn${u.id===sizesOwnerId?' active':''}" data-idx="${i}">${u.name==='Діма'?'🧔':'👩'} ${esc(u.name)}</button>`).join('')}
        </div>
        <div class="sizes-grid">
          <div class="sizes-group">
            <div class="sizes-group-title">📏 Базові габарити</div>
            <div class="sizes-row"><span>Зріст</span><b>${sizes.height||'—'} см</b></div>
            <div class="sizes-row"><span>Груди</span><b>${sizes.chest||'—'} см</b></div>
            <div class="sizes-row"><span>Талія</span><b>${sizes.waist||'—'} см</b></div>
            <div class="sizes-row"><span>Стегна</span><b>${sizes.hips||'—'} см</b></div>
          </div>
          <div class="sizes-group">
            <div class="sizes-group-title">👗 Одяг</div>
            <div class="sizes-row"><span>Міжнар.</span><b>${sizes.intl_size||'—'}</b></div>
            <div class="sizes-row"><span>EU</span><b>${sizes.eu_size||'—'}</b></div>
            <div class="sizes-row"><span>UA</span><b>${sizes.ua_size||'—'}</b></div>
          </div>
          <div class="sizes-group">
            <div class="sizes-group-title">👟 Взуття</div>
            <div class="sizes-row"><span>Устілка</span><b>${sizes.insole_cm||'—'} см</b></div>
            <div class="sizes-row"><span>EU</span><b>${sizes.shoe_eu||'—'}</b></div>
            <div class="sizes-row"><span>US</span><b>${sizes.shoe_us||'—'}</b></div>
          </div>
          ${isFemale?`<div class="sizes-group">
            <div class="sizes-group-title">🩱 Нижня білизна</div>
            <div class="sizes-row"><span>Бюстгальтер</span><b>${sizes.bra||'—'}</b></div>
            <div class="sizes-row"><span>Труси</span><b>${sizes.underwear||'—'}</b></div>
          </div>`:''}
          <div class="sizes-group">
            <div class="sizes-group-title">💍 Аксесуари</div>
            <div class="sizes-row"><span>Каблучка (безім.)</span><b>${sizes.ring_ring||'—'}</b></div>
            <div class="sizes-row"><span>Каблучка (вказ.)</span><b>${sizes.ring_index||'—'}</b></div>
          </div>
        </div>
        <button class="btn-primary" id="sizes-edit-btn" style="width:100%;margin-top:8px">✏️ Редагувати розміри</button>
      </div>`;

    wrap.querySelector('#sizes-edit-btn')?.addEventListener('click', () => openSizesModal(sizes, sizesOwnerId));
    wrap.querySelectorAll('.sz-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        if (allUsers[idx]) { sizesOwnerId = allUsers[idx].id; renderSizes(); }
      });
    });
  }

  function buildBodySvg(isFemale, sizes) {
    const c  = sizes.chest  ? sizes.chest+' см'  : '';
    const w  = sizes.waist  ? sizes.waist+' см'  : '';
    const h  = sizes.hips   ? sizes.hips+' см'   : '';
    const ht = sizes.height ? sizes.height+' см' : '';
    if (isFemale) {
      return `<svg class="body-svg" viewBox="0 0 260 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="130" cy="26" r="19" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M111 20 Q112 6 130 5 Q148 6 149 20 Q152 10 148 26 Q144 8 130 8 Q116 8 112 26 Q108 10 111 20Z" fill="#C45B79"/>
        <rect x="122" y="44" width="16" height="14" rx="5" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M96 58 Q86 78 90 96 Q88 112 98 124 Q110 134 130 134 Q150 134 162 124 Q172 112 170 96 Q174 78 164 58 Q150 52 130 52 Q110 52 96 58Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
        <ellipse cx="116" cy="82" rx="12" ry="9" fill="#F6B9CC" opacity="0.55"/>
        <ellipse cx="144" cy="82" rx="12" ry="9" fill="#F6B9CC" opacity="0.55"/>
        <path d="M96 62 Q80 82 78 120 Q84 126 92 120 Q94 96 106 78Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M164 62 Q180 82 182 120 Q176 126 168 120 Q166 96 154 78Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M98 124 Q92 144 94 158 H166 Q168 144 162 124Z" fill="#F4A6BE" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M100 158 Q92 196 90 248 Q98 256 108 248 Q114 198 118 158Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M160 158 Q168 196 170 248 Q162 256 152 248 Q146 198 142 158Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        ${ht?`<line x1="64" y1="8" x2="64" y2="288" stroke="#C45B79" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/><line x1="59" y1="8" x2="69" y2="8" stroke="#C45B79" stroke-width="1.5"/><line x1="59" y1="288" x2="69" y2="288" stroke="#C45B79" stroke-width="1.5"/><text x="58" y="150" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle" transform="rotate(-90,58,150)">${ht}</text>`:''}
        ${c?`<line x1="90" y1="82" x2="170" y2="82" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/><line x1="170" y1="78" x2="170" y2="86" stroke="#E8829C" stroke-width="1.5"/><line x1="176" y1="82" x2="198" y2="82" stroke="#E8829C" stroke-width="1"/><rect x="198" y="72" width="54" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/><text x="225" y="86" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Г: ${c}</text>`:''}
        ${w?`<line x1="92" y1="108" x2="168" y2="108" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/><line x1="168" y1="104" x2="168" y2="112" stroke="#E8829C" stroke-width="1.5"/><line x1="174" y1="108" x2="196" y2="108" stroke="#E8829C" stroke-width="1"/><rect x="196" y="98" width="56" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/><text x="224" y="112" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Т: ${w}</text>`:''}
        ${h?`<line x1="94" y1="130" x2="166" y2="130" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/><line x1="166" y1="126" x2="166" y2="134" stroke="#E8829C" stroke-width="1.5"/><line x1="172" y1="130" x2="194" y2="130" stroke="#E8829C" stroke-width="1"/><rect x="194" y="120" width="58" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/><text x="223" y="134" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">С: ${h}</text>`:''}
      </svg>`;
    } else {
      return `<svg class="body-svg" viewBox="0 0 260 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="130" cy="36" r="24" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <rect x="123" y="58" width="14" height="14" rx="5" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M94 72 Q84 90 86 114 Q86 136 94 150 H166 Q174 136 174 114 Q176 90 166 72 Q152 66 130 66 Q108 66 94 72Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M94 76 Q76 96 74 142 Q80 148 88 142 Q90 110 102 88Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M166 76 Q184 96 186 142 Q180 148 172 142 Q170 110 158 88Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M100 150 Q92 196 90 268 Q98 276 108 268 Q114 198 120 150Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M160 150 Q168 196 170 268 Q162 276 152 268 Q146 198 140 150Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        ${ht?`<line x1="62" y1="12" x2="62" y2="298" stroke="#C45B79" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/><line x1="57" y1="12" x2="67" y2="12" stroke="#C45B79" stroke-width="1.5"/><line x1="57" y1="298" x2="67" y2="298" stroke="#C45B79" stroke-width="1.5"/><text x="56" y="160" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle" transform="rotate(-90,56,160)">${ht}</text>`:''}
        ${c?`<line x1="86" y1="98" x2="174" y2="98" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/><line x1="174" y1="94" x2="174" y2="102" stroke="#E8829C" stroke-width="1.5"/><line x1="180" y1="98" x2="202" y2="98" stroke="#E8829C" stroke-width="1"/><rect x="202" y="88" width="52" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/><text x="228" y="102" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Г: ${c}</text>`:''}
        ${w?`<line x1="88" y1="126" x2="172" y2="126" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/><line x1="172" y1="122" x2="172" y2="130" stroke="#E8829C" stroke-width="1.5"/><line x1="178" y1="126" x2="200" y2="126" stroke="#E8829C" stroke-width="1"/><rect x="200" y="116" width="54" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/><text x="227" y="130" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Т: ${w}</text>`:''}
        ${h?`<line x1="90" y1="152" x2="170" y2="152" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/><line x1="170" y1="148" x2="170" y2="156" stroke="#E8829C" stroke-width="1.5"/><line x1="176" y1="152" x2="198" y2="152" stroke="#E8829C" stroke-width="1"/><rect x="198" y="142" width="56" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/><text x="226" y="156" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">С: ${h}</text>`:''}
      </svg>`;
    }
  }

  function openSizesModal(sizes, userId) {
    const root = el('modal-root');
    const isFemale = allUsers.find(u => u.id === userId)?.name === 'Лєна';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="max-height:90vh;overflow-y:auto">
        <h3>Розміри</h3>
        <div class="sizes-form-group"><div class="sizes-group-title">📏 Базові</div>
          <div class="form-field"><label>Зріст (см)</label><input class="fin-inp" id="sz-height" type="number" value="${sizes.height||''}"></div>
          <div class="form-field"><label>Груди (см)</label><input class="fin-inp" id="sz-chest" type="number" value="${sizes.chest||''}"></div>
          <div class="form-field"><label>Талія (см)</label><input class="fin-inp" id="sz-waist" type="number" value="${sizes.waist||''}"></div>
          <div class="form-field"><label>Стегна (см)</label><input class="fin-inp" id="sz-hips" type="number" value="${sizes.hips||''}"></div>
        </div>
        <div class="sizes-form-group"><div class="sizes-group-title">👗 Одяг</div>
          <div class="form-field"><label>Міжнар.</label><input class="fin-inp" id="sz-intl" type="text" value="${sizes.intl_size||''}"></div>
          <div class="form-field"><label>EU</label><input class="fin-inp" id="sz-eu" type="text" value="${sizes.eu_size||''}"></div>
          <div class="form-field"><label>UA</label><input class="fin-inp" id="sz-ua" type="text" value="${sizes.ua_size||''}"></div>
        </div>
        <div class="sizes-form-group"><div class="sizes-group-title">👟 Взуття</div>
          <div class="form-field"><label>Устілка (см)</label><input class="fin-inp" id="sz-insole" type="number" step="0.5" value="${sizes.insole_cm||''}"></div>
          <div class="form-field"><label>EU</label><input class="fin-inp" id="sz-shoe-eu" type="text" value="${sizes.shoe_eu||''}"></div>
          <div class="form-field"><label>US</label><input class="fin-inp" id="sz-shoe-us" type="text" value="${sizes.shoe_us||''}"></div>
        </div>
        ${isFemale?`<div class="sizes-form-group"><div class="sizes-group-title">🩱 Нижня білизна</div>
          <div class="form-field"><label>Бюстгальтер</label><input class="fin-inp" id="sz-bra" type="text" value="${sizes.bra||''}"></div>
          <div class="form-field"><label>Труси</label><input class="fin-inp" id="sz-underwear" type="text" value="${sizes.underwear||''}"></div>
        </div>`:''}
        <div class="sizes-form-group"><div class="sizes-group-title">💍 Каблучки</div>
          <div class="form-field"><label>Безіменний</label><input class="fin-inp" id="sz-ring" type="text" value="${sizes.ring_ring||''}"></div>
          <div class="form-field"><label>Вказівний</label><input class="fin-inp" id="sz-ring-idx" type="text" value="${sizes.ring_index||''}"></div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="sz-cancel">Скасувати</button>
          <button class="btn-primary" id="sz-save">Зберегти</button>
        </div>
      </div>`;
    root.innerHTML = ''; root.appendChild(overlay);
    overlay.querySelector('#sz-cancel').addEventListener('click', () => root.innerHTML='');
    overlay.addEventListener('click', e => { if (e.target===overlay) root.innerHTML=''; });
    overlay.querySelector('#sz-save').addEventListener('click', async () => {
      const g = id => overlay.querySelector('#' + id);
      const {error} = await supabase.from('user_sizes').upsert({
        user_id:    userId,
        height:     parseFloat(g('sz-height')?.value)||null,
        chest:      parseFloat(g('sz-chest')?.value)||null,
        waist:      parseFloat(g('sz-waist')?.value)||null,
        hips:       parseFloat(g('sz-hips')?.value)||null,
        intl_size:  g('sz-intl')?.value.trim()||null,
        eu_size:    g('sz-eu')?.value.trim()||null,
        ua_size:    g('sz-ua')?.value.trim()||null,
        insole_cm:  parseFloat(g('sz-insole')?.value)||null,
        shoe_eu:    g('sz-shoe-eu')?.value.trim()||null,
        shoe_us:    g('sz-shoe-us')?.value.trim()||null,
        bra:        g('sz-bra')?.value.trim()||null,
        underwear:  g('sz-underwear')?.value.trim()||null,
        ring_ring:  g('sz-ring')?.value.trim()||null,
        ring_index: g('sz-ring-idx')?.value.trim()||null,
      }, { onConflict: 'user_id' });
      if (error) { alert('Помилка: ' + error.message); return; }
      DataCache.invalidate('sizes:' + userId);
      root.innerHTML = '';
      renderSizes();
    });
  }

  // ── INIT ──────────────────────────────────────────────────
  async function refresh() {
    allUsers    = await Auth.getUsers();
    currentUser = Auth.getCurrentUser();
    partnerUser = allUsers.find(u => u.id !== currentUser?.id) || null;
    wishingFor   = 'me';
    sizesOwnerId = currentUser?.id || null;
    archiveOpen  = false;
    renderWishes();
  }

  function invalidateWishes() {
    if (currentUser) {
      DataCache.invalidate('wishlist:' + currentUser.id);
      DataCache.invalidate('wishlist:archive:' + currentUser.id);
    }
    if (partnerUser) {
      DataCache.invalidate('wishlist:' + partnerUser.id);
      DataCache.invalidate('wishlist:archive:' + partnerUser.id);
    }
  }

  function refreshLive() {
    if (!currentUser) return;
    if (activeTab === 'sizes') renderSizes();
    else renderWishes();
  }

  function init() {
    el('add-wish-btn')?.addEventListener('click', openAddModal);
    setupTabs();
    window.addEventListener('portal:view', e => {
      if (e.detail.view === 'wishlist') refresh();
    });
  }

  return { init, refresh, refreshLive };
})();
