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

  const SUPA_URL = 'https://yicalgoqegluzuagxssk.supabase.co';
  const WISH_PHOTO_BUCKET = 'wishlist-photos';

  let allUsers     = [];
  let currentUser  = null;
  let partnerUser  = null;
  let wishingFor   = 'me';     // 'me' | 'partner'
  let archiveOpen  = false;    // чи розгорнутий архів у «Мої бажання»
  let pendingPhotoFile = null; // обране з пристрою фото, ще не завантажене

  const el  = id => document.getElementById(id);
  const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };

  const PRIORITY_LABELS = {
    high:   '🔥 Високий',
    medium: '🟡 Середній',
    low:    '🟢 Низький',
  };

  // ── ДАНІ ──────────────────────────────────────────────────
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
      ErrorBoundary.showToast('Помилка: ' + error.message);
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
      wrap.innerHTML = '<div class="skeleton-grid">' +
        Array(4).fill(
          '<div class="skeleton-card">' +
            '<div class="skeleton skeleton-avatar" style="border-radius:8px;width:56px;height:80px"></div>' +
            '<div class="skeleton-body">' +
              '<div class="skeleton skeleton-line mid"></div>' +
              '<div class="skeleton skeleton-line short"></div>' +
            '</div>' +
          '</div>'
        ).join('') +
        '</div>';
    }

    DataCache.swr('wishlist:' + ownerId, () => loadItems(ownerId),
      DataCache.fadeRender(el('wishlist-grid'), (items) => {
        paintGrid(items || [], isOwnList, ownerId);
      }));
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

    const photo = item.image_url
      ? `<div class="wl-card-img"><img src="${esc(item.image_url)}" loading="lazy" alt=""></div>` : '';

    card.innerHTML = `
      ${photo}
      <div class="wl-card-body">
        <div class="wl-card-header">${titleEl}${price}</div>
        <div class="wl-card-meta">${priority}</div>
        ${comment}
        ${actions}
      </div>`;

    card.querySelector('.wl-card-img img')?.addEventListener('click', () => openPhotoLightbox(item.image_url));
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
  // ── LIGHTBOX (перегляд фото на весь екран, pinch-zoom) ─────
  function openPhotoLightbox(src) {
    document.getElementById('wl-lightbox')?.remove();

    const lb = document.createElement('div');
    lb.id = 'wl-lightbox';
    lb.className = 'wl-lightbox';
    lb.innerHTML = `
      <button class="wl-lb-close" aria-label="Закрити">✕</button>
      <img class="wl-lb-img" src="${esc(src)}" alt="">`;
    document.body.appendChild(lb);

    const closeLb = () => {
      lb.classList.add('wl-lightbox--closing');
      setTimeout(() => lb.remove(), 180);
    };

    lb.addEventListener('click', e => {
      if (e.target === lb || e.target.classList.contains('wl-lb-close')) closeLb();
    });

    // Закрити свайпом вниз
    let startY = 0;
    lb.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientY - startY > 80) closeLb();
    }, { passive: true });
  }

  // ── ФОТО З ПРИСТРОЮ ───────────────────────────────────────
  // Стискаємо на клієнті (Img.compress з lib/img.js) і вантажимо у Storage.
  async function uploadWishPhoto(file) {
    // Страховка: HEIC → JPEG (кине помилку — обробник збереження покаже тост)
    file = await Img.normalize(file);
    let blob = file, ext = (file.name.split('.').pop() || 'jpg').toLowerCase(), contentType = file.type;
    try {
      const out = await Img.compress(file, 1080, 0.78);
      blob = out.blob; ext = out.ext; contentType = out.contentType;
    } catch (e) {
      console.warn('[Wishlist] стиснення не вдалося, вантажимо оригінал:', e);
    }

    const path = `wish-${currentUser.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(WISH_PHOTO_BUCKET)
      .upload(path, blob, { upsert: true, contentType });
    if (error) throw error;

    const { data } = supabase.storage.from(WISH_PHOTO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function openAddModal()       { openWishModal(null); }
  function openEditModal(item)  { openWishModal(item); }

  function openWishModal(item) {
    const isEdit  = !!item;
    const root    = el('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    pendingPhotoFile = null;

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
          <label>Фото</label>
          <div class="wm-photo-picker">
            <div class="wm-photo-preview" id="wm-photo-preview">
              ${item?.image_url
                ? `<img src="${esc(item.image_url)}" alt="">`
                : `<span class="wm-photo-placeholder">📷</span>`}
            </div>
            <div class="wm-photo-actions">
              <button type="button" class="btn-secondary" id="wm-photo-pick">🖼 Обрати з пристрою</button>
              <button type="button" class="btn-secondary" id="wm-photo-clear" style="display:${item?.image_url?'inline-flex':'none'}">✕ Прибрати</button>
              <input type="file" id="wm-photo-file" accept="image/*,.heic,.heif" style="display:none">
            </div>
          </div>
          <input class="fin-inp" id="wm-img" type="url" placeholder="або встав посилання на фото" value="${esc(item?.image_url||'')}" style="margin-top:8px">
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

    // ── Фото з пристрою ─────────────────────────────────────
    const photoPreview = overlay.querySelector('#wm-photo-preview');
    const photoFileInp = overlay.querySelector('#wm-photo-file');
    const photoClearBtn = overlay.querySelector('#wm-photo-clear');
    const urlInp = overlay.querySelector('#wm-img');

    overlay.querySelector('#wm-photo-pick').addEventListener('click', () => photoFileInp.click());

    photoPreview.addEventListener('click', e => {
      const img = e.target.closest('img');
      if (img) openPhotoLightbox(img.src);
    });

    photoFileInp.addEventListener('change', async () => {
      let file = photoFileInp.files[0];
      if (!file) return;
      // HEIC з iPhone → JPEG одразу: інакше прев'ю не відрендериться
      try {
        file = await Img.normalize(file);
      } catch (e) {
        console.error('[Wishlist] конвертація HEIC не вдалася:', e);
        ErrorBoundary.showToast('Не вдалося обробити HEIC-фото: ' + e.message);
        photoFileInp.value = '';
        return;
      }
      pendingPhotoFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        photoPreview.innerHTML = `<img src="${e.target.result}" alt="">`;
      };
      reader.readAsDataURL(file);
      // Файл з пристрою має пріоритет над посиланням
      urlInp.value = '';
      photoClearBtn.style.display = 'inline-flex';
    });

    photoClearBtn.addEventListener('click', () => {
      pendingPhotoFile = null;
      photoFileInp.value = '';
      urlInp.value = '';
      photoPreview.innerHTML = `<span class="wm-photo-placeholder">📷</span>`;
      photoClearBtn.style.display = 'none';
    });

    urlInp.addEventListener('input', () => {
      // Якщо користувач вручну вписує посилання — скидаємо обраний файл
      if (pendingPhotoFile) { pendingPhotoFile = null; photoFileInp.value = ''; }
      photoClearBtn.style.display = urlInp.value.trim() ? 'inline-flex' : 'none';
      if (urlInp.value.trim()) photoPreview.innerHTML = `<img src="${esc(urlInp.value.trim())}" alt="">`;
    });

    overlay.querySelector('#wm-cancel').addEventListener('click', () => root.innerHTML='');
    overlay.addEventListener('click', e => { if (e.target===overlay) root.innerHTML=''; });

    overlay.querySelector('#wm-save').addEventListener('click', async () => {
      const g     = id => overlay.querySelector('#' + id);
      const title = g('wm-title').value.trim();
      if (!title) { g('wm-title').style.borderColor='var(--danger)'; return; }

      const saveBtn = g('wm-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Збереження...';

      let imageUrl = g('wm-img').value.trim() || null;

      if (pendingPhotoFile) {
        saveBtn.textContent = 'Завантаження фото…';
        try {
          imageUrl = await uploadWishPhoto(pendingPhotoFile);
        } catch (e) {
          ErrorBoundary.showToast('Помилка завантаження фото: ' + e.message);
          saveBtn.disabled = false;
          saveBtn.textContent = isEdit ? 'Зберегти' : 'Додати';
          return;
        }
        saveBtn.textContent = 'Збереження...';
      }

      const payload = {
        title,
        link:        g('wm-link').value.trim()||null,
        image_url:   imageUrl,
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
        ErrorBoundary.showToast('Помилка: ' + error.message);
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
      if (error) { ErrorBoundary.showToast('Помилка: ' + error.message); return; }
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
      if (error) { ErrorBoundary.showToast('Помилка: ' + error.message); return; }
      invalidateWishes();
      renderGrid();
    }
  }

  async function cancelReserve(id) {
    if (!confirm('Скасувати бронювання цього подарунка?')) return;
    await reserveItem(id, true);
  }

  // ── INIT ──────────────────────────────────────────────────
  async function refresh() {
    allUsers    = await Auth.getUsers();
    currentUser = Auth.getCurrentUser();
    partnerUser = allUsers.find(u => u.id !== currentUser?.id) || null;
    wishingFor   = 'me';
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
    renderWishes();
  }

  function init() {
    el('add-wish-btn')?.addEventListener('click', openAddModal);
    window.addEventListener('portal:view', e => {
      if (e.detail.view === 'wishlist') refresh();
    });
  }

  return { init, refresh, refreshLive };
})();
