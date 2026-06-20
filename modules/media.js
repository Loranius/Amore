// ============================================================
// MEDIA MODULE v4
// — Колапсований свайп (toggle)
// — Пошук TMDB будь-якою мовою
// — Статуси, постери, рейтинги
// ============================================================

const Media = (() => {

  const STORAGE_BUCKET = 'media-posters';
  const SUPA_URL       = 'https://yicalgoqegluzuagxssk.supabase.co';
  const TMDB_KEY       = '1b28cacaab2f90a8c2bd0c383c636f01';
  const TMDB_BASE      = 'https://api.themoviedb.org/3';
  const TMDB_IMG_SM    = 'https://image.tmdb.org/t/p/w185';

  // ---------- Статуси ----------
  const STATUS_CONFIG = {
    movie:  { want:'В планах', watching:'Дивимось', done:'Бачили', dropped:'Кинули' },
    series: { want:'В планах', watching:'Дивимось', done:'Бачили', dropped:'Кинули' },
    book:   { want:'Планую',   watching:'Читаю',    done:'Прочитала/в', dropped:'Кинула/в' },
  };
  const STATUS_ORDER = ['watching', 'want', 'done', 'dropped'];
  const TYPE_LABELS  = { movie: 'Фільм', series: 'Серіал', book: 'Книга' };

  let activeType   = 'movie';
  let activeFilter = 'all';
  let allItems     = [];
  let searchTimer  = null;

  const esc = s => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
  const el  = id => document.getElementById(id);

  // ── SWIPE TOGGLE ──────────────────────────────────────────
  function bindSwipeToggle() {
    const btn   = el('swipe-toggle-btn');
    const panel = el('swipe-panel');
    if (!btn || !panel || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', () => {
      const willOpen = !panel.classList.contains('open');
      panel.classList.toggle('open');
      btn.classList.toggle('open');
      // Ініціалізуємо свайп при першому відкритті
      if (willOpen && typeof Swipe !== 'undefined') Swipe.refresh();
    });
  }

  // ── TMDB SEARCH ───────────────────────────────────────────
  async function tmdbSearch(query, type) {
    const tmdbType = type === 'series' ? 'tv' : 'movie';
    try {
      // Шукаємо двома мовами (uk-UA + en-US) і об'єднуємо, дедуплікуємо за id
      const [ukRes, enRes] = await Promise.all([
        fetch(`${TMDB_BASE}/search/${tmdbType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=uk-UA&page=1`).then(r=>r.json()),
        fetch(`${TMDB_BASE}/search/${tmdbType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`).then(r=>r.json()),
      ]);
      const seen  = new Set();
      const items = [];
      for (const r of [...(ukRes.results||[]), ...(enRes.results||[])]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        items.push({
          tmdb_id:    r.id,
          title:      r.title || r.name || '?',
          poster_url: r.poster_path ? TMDB_IMG_SM + r.poster_path : null,
          year:       (r.release_date || r.first_air_date || '').slice(0,4),
          rating:     r.vote_average ? r.vote_average.toFixed(1) : null,
          overview:   r.overview || '',
        });
        if (items.length >= 8) break;
      }
      return items;
    } catch (e) {
      console.error('tmdbSearch error:', e);
      return [];
    }
  }

  function renderSearchResults(results) {
    const wrap = el('media-search-results');
    if (!wrap) return;
    if (!results.length) {
      wrap.innerHTML = '<p class="media-search-empty">Нічого не знайдено 🔍</p>';
      wrap.classList.remove('hidden');
      return;
    }
    wrap.innerHTML = '';
    results.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-search-card';
      card.innerHTML = `
        ${item.poster_url
          ? `<img class="media-search-poster" src="${esc(item.poster_url)}" loading="lazy" alt="">`
          : `<div class="media-search-poster-empty">🎬</div>`}
        <div class="media-search-info">
          <div class="media-search-title">${esc(item.title)}</div>
          <div class="media-search-meta">
            ${item.year   ? `<span>${item.year}</span>` : ''}
            ${item.rating ? `<span>★ ${item.rating}</span>` : ''}
          </div>
          ${item.overview ? `<div class="media-search-overview">${esc(item.overview.slice(0,90))}${item.overview.length>90?'…':''}</div>` : ''}
        </div>
        <button class="media-search-add-btn" aria-label="Додати">+</button>`;
      card.querySelector('.media-search-add-btn').addEventListener('click', e => {
        e.stopPropagation();
        openAddFromSearchModal(item);
      });
      wrap.appendChild(card);
    });
    wrap.classList.remove('hidden');
  }

  function hideSearchResults() {
    const res = el('media-search-results');
    if (res) res.classList.add('hidden');
  }

  function openAddFromSearchModal(item) {
    const conf = STATUS_CONFIG[activeType] || STATUS_CONFIG.movie;
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="sm-ov">
        <div class="modal-card">
          <div class="media-search-modal-header">
            ${item.poster_url
              ? `<img class="media-search-modal-poster" src="${esc(item.poster_url)}" alt="">`
              : ''}
            <div>
              <div class="media-search-modal-title">${esc(item.title)}</div>
              ${item.year ? `<div class="media-search-modal-year">${item.year}${item.rating?` · ★ ${item.rating}`:''}</div>` : ''}
            </div>
          </div>
          <div class="form-field">
            <label>Додати як</label>
            <div class="media-status-chips">
              ${Object.entries(conf).map(([val, label], i) =>
                `<button class="media-status-chip${i===0?' active':''}" data-status="${val}">${label}</button>`
              ).join('')}
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="sm-cancel">Скасувати</button>
            <button class="btn-primary"   id="sm-save">Додати до списку →</button>
          </div>
        </div>
      </div>`;

    let chosen = Object.keys(conf)[0];

    root.querySelectorAll('.media-status-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.media-status-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chosen = btn.dataset.status;
      });
    });

    const closeModal = () => root.innerHTML = '';
    el('sm-cancel').addEventListener('click', closeModal);
    el('sm-ov').addEventListener('click', e => { if (e.target.id === 'sm-ov') closeModal(); });

    el('sm-save').addEventListener('click', async () => {
      const saveBtn = el('sm-save');
      saveBtn.disabled = true; saveBtn.textContent = 'Додаємо…';
      const user = Auth.getCurrentUser();
      const { error } = await supabase.from('media_items').insert({
        type: activeType, title: item.title,
        status: chosen, poster_url: item.poster_url || null,
        created_by: user ? user.id : null,
      });
      if (error) {
        alert('Помилка додавання');
        saveBtn.disabled = false; saveBtn.textContent = 'Додати до списку →';
        return;
      }
      closeModal();
      const inp = el('media-search-inp');
      if (inp) inp.value = '';
      hideSearchResults();
      refresh();
    });
  }

  function bindSearch() {
    const inp = el('media-search-inp');
    if (!inp || inp.dataset.bound) return;
    inp.dataset.bound = '1';

    inp.addEventListener('input', () => {
      const q = inp.value.trim();
      clearTimeout(searchTimer);
      if (!q) { hideSearchResults(); return; }
      if (activeType === 'book') { hideSearchResults(); return; }
      searchTimer = setTimeout(async () => {
        const results = await tmdbSearch(q, activeType);
        renderSearchResults(results);
      }, 400);
    });

    // Закрити при кліку поза блоком пошуку
    document.addEventListener('click', e => {
      const wrap = el('media-search-wrap');
      if (wrap && !wrap.contains(e.target)) hideSearchResults();
    });
  }

  function updateSearchVisibility() {
    const wrap = el('media-search-wrap');
    if (!wrap) return;
    // Пошук тільки для фільмів та серіалів (TMDB не знає про книги)
    wrap.classList.toggle('hidden', activeType === 'book');
    if (activeType === 'book') hideSearchResults();
  }

  // ── ЗАВАНТАЖЕННЯ ----------
  async function loadItems(type) {
    const { data, error } = await supabase
      .from('media_items')
      .select('id,type,title,status,poster_url,rating_dima,rating_lena,comment_dima,comment_lena,created_by')
      .eq('type', type);
    if (error) { console.error('loadItems error:', error); return []; }
    return data || [];
  }

  // ── ПОСТЕР ----------
  async function uploadPoster(file, itemId) {
    let blob = file, ext = (file.name.split('.').pop()||'jpg').toLowerCase(), contentType = file.type;
    try {
      const out = await Img.compress(file, 900, 0.78);
      blob = out.blob; ext = out.ext; contentType = out.contentType;
    } catch (e) { console.warn('uploadPoster: стиснення не вдалося', e); }
    const path = `${activeType}-${itemId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { upsert: true, contentType });
    if (error) { console.error('uploadPoster error:', error); return null; }
    return `${SUPA_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
  }

  // ── ФІЛЬТРИ ----------
  function renderFilters() {
    const wrap = el('media-filters');
    if (!wrap) return;
    const conf = STATUS_CONFIG[activeType];
    const allCount = allItems.length;
    let html = `<button class="media-filter-btn ${activeFilter==='all'?'active':''}" data-filter="all">Всі (${allCount})</button>`;
    STATUS_ORDER.forEach(status => {
      const count = allItems.filter(i=>i.status===status).length;
      if (!count) return;
      html += `<button class="media-filter-btn ${activeFilter===status?'active':''}" data-filter="${status}">${conf[status]} (${count})</button>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.media-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeFilter = btn.dataset.filter; renderFilters(); renderGrid(); });
    });
  }

  // ── СТАТИСТИКА ----------
  function renderStats() {
    const wrap = el('media-stats');
    if (!wrap) return;
    const ratings = [...allItems.map(i=>i.rating_dima), ...allItems.map(i=>i.rating_lena)].filter(Boolean);
    const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : null;
    wrap.innerHTML = avg ? `<div class="media-stat"><span class="media-stat-num">★ ${avg}</span><span class="media-stat-label">сер. рейтинг</span></div>` : '';
  }

  // ── СІТКА ----------
  function renderGrid() {
    const wrap = el('media-list');
    const conf = STATUS_CONFIG[activeType];
    const items = activeFilter === 'all'
      ? [...allItems].sort((a,b) => STATUS_ORDER.indexOf(a.status)-STATUS_ORDER.indexOf(b.status))
      : allItems.filter(i=>i.status===activeFilter);

    if (!items.length) { wrap.innerHTML='<p class="empty-state">Тут порожньо. Додай щось!</p>'; return; }

    wrap.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'media-grid';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';
      const statusLabel = conf[item.status] || item.status;
      const poster = item.poster_url
        ? `<img class="media-poster" src="${esc(item.poster_url)}" alt="${esc(item.title)}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="media-poster-placeholder">🎬</div>`;
      const rDima = item.rating_dima ? `${item.rating_dima}/10` : '—';
      const rLena = item.rating_lena ? `${item.rating_lena}/10` : '—';

      card.innerHTML = `
        <button class="delete-btn media-card-delete" data-delete-id="${item.id}">×</button>
        <button class="media-edit-icon" data-edit-id="${item.id}">✏️</button>
        ${poster}
        <div class="media-card-body">
          <p class="media-card-title">${esc(item.title)}</p>
          <span class="media-status-badge">${statusLabel}</span>
          <div class="media-ratings">
            <div class="media-rating-row">
              <span class="media-rating-name">Діма</span>
              <span class="${item.rating_dima?'media-rating-val':'media-rating-empty'}">${rDima}</span>
              <button class="media-rate-btn" data-rate-id="${item.id}" data-rate-who="dima">✏️</button>
            </div>
            <div class="media-rating-row">
              <span class="media-rating-name">Лєна</span>
              <span class="${item.rating_lena?'media-rating-val':'media-rating-empty'}">${rLena}</span>
              <button class="media-rate-btn" data-rate-id="${item.id}" data-rate-who="lena">✏️</button>
            </div>
          </div>
          ${item.comment_dima?`<p class="media-comment"><b>Діма:</b> ${esc(item.comment_dima)}</p>`:''}
          ${item.comment_lena?`<p class="media-comment"><b>Лєна:</b> ${esc(item.comment_lena)}</p>`:''}
        </div>`;
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    wrap.querySelectorAll('[data-delete-id]').forEach(btn =>
      btn.addEventListener('click', () => deleteItem(btn.dataset.deleteId)));
    wrap.querySelectorAll('[data-rate-id]').forEach(btn =>
      btn.addEventListener('click', () => openRatingModal(btn.dataset.rateId, btn.dataset.rateWho)));
    wrap.querySelectorAll('[data-edit-id]').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.editId)));
  }

  // ── ВИДАЛЕННЯ ----------
  async function deleteItem(id) {
    if (!confirm('Видалити цей елемент?')) return;
    const { error } = await supabase.from('media_items').delete().eq('id', id);
    if (error) { alert('Помилка видалення'); return; }
    refresh();
  }

  // ── ДОДАТИ вручну ----------
  function openAddModal() {
    const conf = STATUS_CONFIG[activeType];
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="media-modal-overlay">
        <div class="modal-card">
          <h3>Додати ${TYPE_LABELS[activeType]}</h3>
          <div class="form-field">
            <label for="media-title">Назва</label>
            <input type="text" id="media-title" placeholder="Введи назву">
          </div>
          <div class="form-field">
            <label for="media-poster-file">Постер (фото)</label>
            <input type="file" id="media-poster-file" accept="image/*">
          </div>
          <div class="form-field">
            <label for="media-status-new">Статус</label>
            <select id="media-status-new">
              ${Object.entries(conf).map(([val,label])=>`<option value="${val}">${label}</option>`).join('')}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="media-cancel">Скасувати</button>
            <button class="btn-primary"   id="media-save">Зберегти</button>
          </div>
        </div>
      </div>`;

    const closeModal = () => root.innerHTML = '';
    el('media-cancel').addEventListener('click', closeModal);
    el('media-modal-overlay').addEventListener('click', e => { if (e.target.id==='media-modal-overlay') closeModal(); });
    el('media-save').addEventListener('click', saveItem);
  }

  async function saveItem() {
    const title  = el('media-title').value.trim();
    const status = el('media-status-new').value;
    const file   = el('media-poster-file').files?.[0];
    if (!title) { alert('Вкажи назву'); return; }

    const saveBtn = el('media-save');
    saveBtn.textContent = 'Зберігаємо…'; saveBtn.disabled = true;
    const user = Auth.getCurrentUser();

    const { data, error } = await supabase.from('media_items')
      .insert({ type: activeType, title, status, created_by: user?.id||null })
      .select('id').single();
    if (error) { alert('Не вдалось зберегти'); saveBtn.textContent='Зберегти'; saveBtn.disabled=false; return; }

    if (file) {
      const url = await uploadPoster(file, data.id);
      if (url) await supabase.from('media_items').update({ poster_url: url }).eq('id', data.id);
    }
    el('modal-root').innerHTML = '';
    refresh();
  }

  // ── РЕДАГУВАТИ ----------
  function openEditModal(id) {
    const item = allItems.find(i => String(i.id)===String(id));
    if (!item) return;
    const conf = STATUS_CONFIG[activeType];
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="media-edit-overlay">
        <div class="modal-card">
          <h3>Редагувати</h3>
          <div class="form-field">
            <label>Назва</label>
            <input type="text" id="edit-title" value="${esc(item.title)}">
          </div>
          <div class="form-field">
            <label>Поточний постер</label>
            ${item.poster_url ? `<img src="${esc(item.poster_url)}" style="width:60px;border-radius:8px;display:block;margin-bottom:8px;">` : '<p style="font-size:13px;color:var(--text-muted)">Немає постера</p>'}
            <label>Замінити постер</label>
            <input type="file" id="edit-poster-file" accept="image/*">
          </div>
          <div class="form-field">
            <label>Статус</label>
            <select id="edit-status">
              ${Object.entries(conf).map(([val,label])=>`<option value="${val}"${item.status===val?' selected':''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="edit-cancel">Скасувати</button>
            <button class="btn-primary"   id="edit-save">Зберегти</button>
          </div>
        </div>
      </div>`;

    const closeModal = () => root.innerHTML = '';
    el('edit-cancel').addEventListener('click', closeModal);
    el('media-edit-overlay').addEventListener('click', e => { if (e.target.id==='media-edit-overlay') closeModal(); });
    el('edit-save').addEventListener('click', () => saveEdit(id, item));
  }

  async function saveEdit(id, item) {
    const title  = el('edit-title').value.trim();
    const status = el('edit-status').value;
    const file   = el('edit-poster-file').files?.[0];
    if (!title) { alert('Вкажи назву'); return; }

    const saveBtn = el('edit-save');
    saveBtn.textContent = 'Зберігаємо…'; saveBtn.disabled = true;

    const update = { title, status };
    if (file) { const url = await uploadPoster(file, id); if (url) update.poster_url = url; }

    const { error } = await supabase.from('media_items').update(update).eq('id', id);
    if (error) { alert('Помилка збереження'); saveBtn.textContent='Зберегти'; saveBtn.disabled=false; return; }
    el('modal-root').innerHTML = '';
    refresh();
  }

  // ── ОЦІНКИ ----------
  function openRatingModal(id, who) {
    const item = allItems.find(i => String(i.id)===String(id));
    if (!item) return;
    const whoLabel     = who === 'dima' ? 'Діма' : 'Лєна';
    const ratingField  = `rating_${who}`;
    const commentField = `comment_${who}`;
    const curRating    = item[ratingField] || null;
    const curComment   = item[commentField] || '';
    const root = el('modal-root');

    root.innerHTML = `
      <div class="modal-overlay" id="rate-modal-overlay">
        <div class="modal-card">
          <h3>${esc(whoLabel)} — ${esc(item.title)}</h3>
          <div class="form-field">
            <label>Оцінка (1–10)</label>
            <div class="rate-number-row">
              ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="rate-num-btn${curRating==n?' active':''}" data-score="${n}">${n}</button>`).join('')}
            </div>
          </div>
          <div class="form-field">
            <label for="rate-comment">Коментар</label>
            <textarea id="rate-comment" rows="3" placeholder="Враження...">${esc(curComment)}</textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="rate-cancel">Скасувати</button>
            <button class="btn-primary"   id="rate-save">Зберегти</button>
          </div>
        </div>
      </div>`;

    let selectedScore = curRating;
    root.querySelectorAll('.rate-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedScore = parseInt(btn.dataset.score);
        root.querySelectorAll('.rate-num-btn').forEach(b => b.classList.toggle('active', b.dataset.score==selectedScore));
      });
    });

    const closeModal = () => root.innerHTML = '';
    el('rate-cancel').addEventListener('click', closeModal);
    el('rate-modal-overlay').addEventListener('click', e => { if (e.target.id==='rate-modal-overlay') closeModal(); });
    el('rate-save').addEventListener('click', async () => {
      const comment = el('rate-comment').value.trim();
      const update  = {};
      if (selectedScore) update[ratingField] = selectedScore;
      update[commentField] = comment || null;
      const { error } = await supabase.from('media_items').update(update).eq('id', id);
      if (error) { alert('Помилка збереження'); return; }
      closeModal(); refresh();
    });
  }

  // ── ВКЛАДКИ ----------
  function renderTabs() {
    document.querySelectorAll('.media-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.mediaType === activeType));
  }

  // ── REFRESH ----------
  async function refresh() {
    allItems = await loadItems(activeType);
    renderTabs();
    renderStats();
    renderFilters();
    renderGrid();
  }

  // ── INIT ----------
  function init() {
    el('add-media-btn')?.addEventListener('click', openAddModal);

    document.querySelectorAll('.media-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeType   = btn.dataset.mediaType;
        activeFilter = 'all';
        // Очищуємо пошук при зміні вкладки
        const inp = el('media-search-inp');
        if (inp) inp.value = '';
        hideSearchResults();
        updateSearchVisibility();
        renderTabs();
        refresh();
      });
    });

    window.addEventListener('portal:view', e => {
      if (e.detail.view === 'media') {
        bindSwipeToggle();
        bindSearch();
        updateSearchVisibility();
        refresh();
      }
    });
  }

  return { init, refresh };
})();
