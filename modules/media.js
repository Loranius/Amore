// ============================================================
// MEDIA MODULE v4
// — Колапсований свайп (toggle)
// — Пошук TMDB будь-якою мовою
// — Статуси, постери, рейтинги
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
// ============================================================


import { supabase } from '../lib/supabase.js';
import { DataCache } from '../lib/cache.js';
import { Img } from '../lib/img.js';
import { ErrorBoundary } from '../lib/error-boundary.js';
import { Auth } from './auth.js';
import { Swipe } from './swipe.js';
import { closeModalAnimated } from '../lib/modal.js';

const STORAGE_BUCKET = 'media-posters';
const SUPA_URL       = 'https://yicalgoqegluzuagxssk.supabase.co';
const TMDB_KEY       = '1b28cacaab2f90a8c2bd0c383c636f01';
const TMDB_BASE      = 'https://api.themoviedb.org/3';
const TMDB_IMG_SM    = 'https://image.tmdb.org/t/p/w185';

// ---------- Статуси ----------
/** @type {Record<MediaType, Record<MediaStatus, string>>} */
const STATUS_CONFIG = {
  movie:  { want:'В планах', watching:'Дивимось', done:'Бачили', dropped:'Кинули' },
  series: { want:'В планах', watching:'Дивимось', done:'Бачили', dropped:'Кинули' },
  book:   { want:'Планую',   watching:'Читаю',    done:'Прочитала/в', dropped:'Кинула/в' },
};
/** @type {MediaStatus[]} */
const STATUS_ORDER = ['watching', 'want', 'done', 'dropped'];
/** @type {Record<MediaType, string>} */
const TYPE_LABELS  = { movie: 'Фільм', series: 'Серіал', book: 'Книга' };

/** @type {MediaType} */
let activeType   = 'movie';
/** @type {'all' | MediaStatus} */
let activeFilter = 'all';
/** @type {MediaItem[]} */
let allItems     = [];
/** @type {number | null} */
let searchTimer  = null;
const PAGE_SIZE  = 20;   // інфінітний скрол — порціями по 20
let visibleCount = PAGE_SIZE;
/** @type {IntersectionObserver | null} */
let scrollSentinel = null;

/** @param {string | null | undefined} s @returns {string} */
const esc = s => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
/** @param {string} id @returns {HTMLElement | null} */
const el  = id => document.getElementById(id);

// ── SWIPE TOGGLE ──────────────────────────────────────────
/** @returns {void} */
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
/**
 * @param {string} query
 * @param {MediaType} type
 * @returns {Promise<TmdbSearchResult[]>}
 */
async function tmdbSearch(query, type) {
  const tmdbType = type === 'series' ? 'tv' : 'movie';
  try {
    // Шукаємо двома мовами (uk-UA + en-US) і об'єднуємо, дедуплікуємо за id
    const [ukRes, enRes] = await Promise.all([
      fetch(`${TMDB_BASE}/search/${tmdbType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=uk-UA&page=1`).then(r=>r.json()),
      fetch(`${TMDB_BASE}/search/${tmdbType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`).then(r=>r.json()),
    ]);
    const seen  = new Set();
    /** @type {TmdbSearchResult[]} */
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

/**
 * @param {TmdbSearchResult[]} results
 * @returns {void}
 */
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
    card.querySelector('.media-search-add-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openAddFromSearchModal(item);
    });
    wrap.appendChild(card);
  });
  wrap.classList.remove('hidden');
}

/** @returns {void} */
function hideSearchResults() {
  const res = el('media-search-results');
  if (res) res.classList.add('hidden');
}

/**
 * @param {TmdbSearchResult} item
 * @returns {void}
 */
function openAddFromSearchModal(item) {
  const conf = STATUS_CONFIG[activeType] || STATUS_CONFIG.movie;
  const root = el('modal-root');
  if (!root) return;
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

  /** @type {MediaStatus} */
  let chosen = /** @type {MediaStatus} */ (Object.keys(conf)[0]);

  root.querySelectorAll('.media-status-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.media-status-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chosen = /** @type {MediaStatus} */ (/** @type {HTMLElement} */ (btn).dataset.status);
    });
  });

  const closeModal = () => closeModalAnimated();
  el('sm-cancel')?.addEventListener('click', closeModal);
  el('sm-ov')?.addEventListener('click', e => { if (/** @type {HTMLElement} */ (e.target).id === 'sm-ov') closeModal(); });

  el('sm-save')?.addEventListener('click', async () => {
    const saveBtn = /** @type {HTMLButtonElement} */ (el('sm-save'));
    saveBtn.disabled = true; saveBtn.textContent = 'Додаємо…';
    const user = Auth.getCurrentUser();
    /** @type {{ error: SupaError | null }} */
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
    const inp = /** @type {HTMLInputElement | null} */ (el('media-search-inp'));
    if (inp) inp.value = '';
    hideSearchResults();
    refresh();
  });
}

/** @returns {void} */
function bindSearch() {
  const inp = /** @type {HTMLInputElement | null} */ (el('media-search-inp'));
  if (!inp || inp.dataset.bound) return;
  inp.dataset.bound = '1';

  inp.addEventListener('input', () => {
    const q = inp.value.trim();
    if (searchTimer) clearTimeout(searchTimer);
    if (!q) { hideSearchResults(); return; }
    if (activeType === 'book') { hideSearchResults(); return; }
    searchTimer = setTimeout(async () => {
      // Той самий захист від гонки, що й у refresh(): за час запиту вкладку
      // могли перемкнути — тоді результати старого типу показувати не треба.
      const reqType = activeType;
      const results = await tmdbSearch(q, reqType);
      if (reqType !== activeType) return;
      renderSearchResults(results);
    }, 400);
  });

  // Закрити при кліку поза блоком пошуку
  document.addEventListener('click', e => {
    const wrap = el('media-search-wrap');
    if (wrap && !wrap.contains(/** @type {Node} */ (e.target))) hideSearchResults();
  });
}

/** @returns {void} */
function updateSearchVisibility() {
  const wrap = el('media-search-wrap');
  if (!wrap) return;
  // Пошук тільки для фільмів та серіалів (TMDB не знає про книги)
  wrap.classList.toggle('hidden', activeType === 'book');
  if (activeType === 'book') hideSearchResults();
}

// ── ЗАВАНТАЖЕННЯ ----------
/**
 * @param {MediaType} type
 * @returns {Promise<MediaItem[]>}
 */
async function loadItems(type) {
  /** @type {SupaResult<MediaItem[]>} */
  const { data, error } = await supabase
    .from('media_items')
    .select('id,type,title,status,poster_url,rating_dima,rating_lena,comment_dima,comment_lena,created_by')
    .eq('type', type);
  if (error) { console.error('loadItems error:', error); return []; }
  return data || [];
}

// ── ПОСТЕР ----------
/**
 * @param {File} file
 * @param {number} itemId
 * @returns {Promise<string | null>}
 */
async function uploadPoster(file, itemId) {
  // HEIC → JPEG до стиснення; сирий HEIC не ллємо — не відобразиться в браузері
  try {
    file = await Img.normalize(file);
  } catch (e) {
    console.error('uploadPoster: конвертація HEIC не вдалася', e);
    ErrorBoundary.showToast('Не вдалося обробити HEIC-фото: ' + /** @type {Error} */ (e).message);
    return null;
  }
  /** @type {File | Blob} */
  let blob = file;
  let ext = (file.name.split('.').pop()||'jpg').toLowerCase(), contentType = file.type;
  try {
    const out = await Img.compress(file, 900, 0.78);
    blob = out.blob; ext = out.ext; contentType = out.contentType;
  } catch (e) { console.warn('uploadPoster: стиснення не вдалося', e); }
  const path = `${activeType}-${itemId}-${Date.now()}.${ext}`;
  /** @type {{ error: SupaError | null }} */
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { upsert: true, contentType });
  if (error) { console.error('uploadPoster error:', error); return null; }
  return `${SUPA_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

// ── ФІЛЬТРИ ----------
/** @returns {void} */
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
    btn.addEventListener('click', () => {
      const f = /** @type {HTMLElement} */ (btn).dataset.filter;
      activeFilter = f === 'all' ? 'all' : /** @type {MediaStatus} */ (f);
      renderFilters(); renderGrid();
    });
  });
}

// ── СТАТИСТИКА ----------
/** @returns {void} */
function renderStats() {
  const wrap = el('media-stats');
  if (!wrap) return;
  const ratings = [...allItems.map(i=>i.rating_dima), ...allItems.map(i=>i.rating_lena)]
    .filter(/** @returns {r is number} */ (r) => !!r);
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : null;
  wrap.innerHTML = avg ? `<div class="media-stat"><span class="media-stat-num">★ ${avg}</span><span class="media-stat-label">сер. рейтинг</span></div>` : '';
}

// ── СІТКА ----------
/** @returns {void} */
function renderGrid() {
  const wrap = el('media-list');
  if (!wrap) return;
  const conf = STATUS_CONFIG[activeType];
  const items = activeFilter === 'all'
    ? [...allItems].sort((a,b) => STATUS_ORDER.indexOf(a.status)-STATUS_ORDER.indexOf(b.status))
    : allItems.filter(i=>i.status===activeFilter);

  if (!items.length) { wrap.innerHTML='<p class="empty-state">Тут порожньо. Додай щось!</p>'; return; }

  const visible = items.slice(0, visibleCount);
  const hasMore = items.length > visibleCount;

  wrap.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'media-grid';

  visible.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';
    const statusLabel = conf[item.status] || item.status;
    const rDima = item.rating_dima ? `★ ${item.rating_dima}/10` : null;
    const rLena = item.rating_lena ? `★ ${item.rating_lena}/10` : null;
    const hasReviews = rDima || rLena || item.comment_dima || item.comment_lena;

    // Клікабельний постер
    const posterEl = document.createElement('div');
    posterEl.className = 'media-poster-wrap';
    posterEl.title = 'Детальніше';
    if (item.poster_url) {
      const img = document.createElement('img');
      img.className = 'media-poster';
      img.src = item.poster_url;
      img.alt = item.title;
      img.loading = 'lazy';
      posterEl.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'media-poster-placeholder';
      ph.textContent = '🎬';
      posterEl.appendChild(ph);
    }
    posterEl.addEventListener('click', () => openMediaDetailModal(item));
    card.appendChild(posterEl);

    // Body
    const body = document.createElement('div');
    body.className = 'media-card-body';

    const titleEl = document.createElement('p');
    titleEl.className = 'media-card-title';
    titleEl.textContent = item.title;
    body.appendChild(titleEl);

    const badge = document.createElement('span');
    badge.className = 'media-status-badge';
    badge.textContent = statusLabel;
    body.appendChild(badge);

    // Кнопка відгук
    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'media-review-btn';
    reviewBtn.innerHTML = hasReviews ? '✏️ Відгук' : '+ Відгук';
    reviewBtn.addEventListener('click', () => openReviewPanel(item));
    body.appendChild(reviewBtn);

    // Міні рейтинги
    if (rDima || rLena) {
      const ratingsEl = document.createElement('div');
      ratingsEl.className = 'media-ratings-mini';
      ratingsEl.innerHTML = [
        rDima ? `<span class="media-rating-mini">Д: ${rDima}</span>` : '',
        rLena ? `<span class="media-rating-mini">Л: ${rLena}</span>` : '',
      ].join('');
      body.appendChild(ratingsEl);
    }
    card.appendChild(body);

    // Видалити
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn media-card-delete';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteItem(item.id));
    card.appendChild(delBtn);

    grid.appendChild(card);
  });

  wrap.appendChild(grid);

  if (scrollSentinel) scrollSentinel.disconnect();
  if (hasMore) {
    const sentinel = document.createElement('div');
    sentinel.className = 'media-load-more-sentinel';
    sentinel.style.height = '40px';
    wrap.appendChild(sentinel);
    scrollSentinel = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { visibleCount += PAGE_SIZE; renderGrid(); }
    }, { rootMargin: '100px' });
    scrollSentinel.observe(sentinel);
  }
}

// ── TMDB деталі ──
/**
 * @param {MediaItem} item
 * @returns {Promise<TmdbDetails | null>}
 */
async function fetchTmdbDetails(item) {
  const tmdbType = item.type === 'series' ? 'tv' : 'movie';
  try {
    const [ukRes, enRes] = await Promise.all([
      fetch(`${TMDB_BASE}/search/${tmdbType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=uk-UA&page=1`).then(r=>r.json()),
      fetch(`${TMDB_BASE}/search/${tmdbType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=en-US&page=1`).then(r=>r.json()),
    ]);
    const first = ukRes.results?.[0] || enRes.results?.[0];
    if (!first) return null;
    const tmdbId = first.id;
    const [details, videos] = await Promise.all([
      fetch(`${TMDB_BASE}/${tmdbType}/${tmdbId}?api_key=${TMDB_KEY}&language=uk-UA`).then(r=>r.json()),
      fetch(`${TMDB_BASE}/${tmdbType}/${tmdbId}/videos?api_key=${TMDB_KEY}&language=en-US`).then(r=>r.json()),
    ]);
    const trailer = (videos.results||[]).find((/** @type {any} */ v) => v.site==='YouTube' && (v.type==='Trailer'||v.type==='Teaser'));
    return {
      title:      details.title || details.name || item.title,
      overview:   details.overview || first.overview || '',
      year:       (details.release_date || details.first_air_date || '').slice(0,4),
      rating:     details.vote_average ? details.vote_average.toFixed(1) : null,
      runtime:    details.runtime || null,
      genres:     (details.genres||[]).slice(0,3).map((/** @type {any} */ g) => g.name),
      backdrop:   details.backdrop_path  ? 'https://image.tmdb.org/t/p/w780'  + details.backdrop_path  : null,
      poster:     details.poster_path    ? 'https://image.tmdb.org/t/p/w342'  + details.poster_path    : item.poster_url,
      youtubeKey: trailer ? trailer.key : null,
    };
  } catch(e) { console.error('fetchTmdbDetails:', e); return null; }
}

// ── Модалка деталей фільму ──
/**
 * @param {MediaItem} item
 * @returns {Promise<void>}
 */
async function openMediaDetailModal(item) {
  const root = el('modal-root');
  if (!root) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'media-detail-overlay';

  overlay.innerHTML = `
    <div class="modal-card media-detail-modal">
      <div class="media-detail-backdrop">
        <div class="media-detail-hero">
          ${item.poster_url
            ? `<img class="media-detail-poster" src="${esc(item.poster_url)}" alt="">`
            : `<div class="media-detail-poster-ph">🎬</div>`}
          <div class="media-detail-hero-info">
            <div class="media-detail-title">${esc(item.title)}</div>
            <div class="media-detail-meta">
              <span class="media-detail-badge">⏳ Завантаження…</span>
            </div>
          </div>
        </div>
      </div>
      <div class="media-detail-body">
        <div class="media-detail-trailer-loading">🎬 Шукаємо трейлер…</div>
        <div class="media-detail-reviews" id="mdr-reviews"></div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="mdr-close">Закрити</button>
        <button class="btn-primary"   id="mdr-edit">✏️ Редагувати</button>
      </div>
    </div>`;

  closeModalAnimated();
  root.appendChild(overlay);

  overlay.querySelector('#mdr-close')?.addEventListener('click', () => root.innerHTML='');
  overlay.querySelector('#mdr-edit')?.addEventListener('click', () => { root.innerHTML=''; openEditModal(item.id); });
  overlay.addEventListener('click', e => { if(/** @type {HTMLElement} */ (e.target).id==='media-detail-overlay') root.innerHTML=''; });

  const reviewsContainer = overlay.querySelector('#mdr-reviews');
  if (reviewsContainer) renderDetailReviews(reviewsContainer, item);

  const details = await fetchTmdbDetails(item);
  if (!root.querySelector('#media-detail-overlay')) return;

  if (details) {
    const backdrop = overlay.querySelector('.media-detail-backdrop');
    if (details.backdrop && backdrop) {
      const bImg = document.createElement('img');
      bImg.className = 'media-detail-backdrop-img';
      bImg.src = details.backdrop;
      backdrop.insertBefore(bImg, backdrop.firstChild);
      const grad = document.createElement('div');
      grad.className = 'media-detail-backdrop-grad';
      backdrop.appendChild(grad);
    }
    if (details.poster) {
      const old = overlay.querySelector('.media-detail-poster, .media-detail-poster-ph');
      if (old) {
        const img = document.createElement('img');
        img.className = 'media-detail-poster';
        img.src = details.poster;
        old.replaceWith(img);
      }
    }
    const titleEl = overlay.querySelector('.media-detail-title');
    if (titleEl) titleEl.textContent = details.title;
    const metaEl = overlay.querySelector('.media-detail-meta');
    if (metaEl) metaEl.innerHTML = [
      details.year   ? `<span class="media-detail-badge">${details.year}</span>` : '',
      details.rating ? `<span class="media-detail-rating-star">★ ${details.rating}</span>` : '',
      details.runtime? `<span class="media-detail-badge">${details.runtime} хв</span>` : '',
      ...details.genres.map(g=>`<span class="media-detail-badge">${g}</span>`),
    ].join('');

    const bodyEl = overlay.querySelector('.media-detail-body');
    const loadingEl = bodyEl?.querySelector('.media-detail-trailer-loading');

    if (details.overview && bodyEl && loadingEl) {
      const ov = document.createElement('p');
      ov.className = 'media-detail-overview';
      ov.textContent = details.overview;
      bodyEl.insertBefore(ov, loadingEl);
    }
    if (loadingEl) {
      if (details.youtubeKey) {
        const key = details.youtubeKey;
        const btn = document.createElement('button');
        btn.className = 'media-detail-trailer-btn';
        btn.innerHTML = '▶ Дивитись трейлер на YouTube';
        btn.addEventListener('click', () => {
          const frame = document.createElement('div');
          frame.className = 'media-detail-trailer';
          frame.innerHTML = `<iframe src="https://www.youtube.com/embed/${key}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
          btn.replaceWith(frame);
        });
        loadingEl.replaceWith(btn);
      } else {
        loadingEl.textContent = 'Трейлер не знайдено';
      }
    }
  } else {
    const l = overlay.querySelector('.media-detail-trailer-loading');
    if (l) l.textContent = 'Не вдалось завантажити дані TMDB';
  }
}

// ── Блок відгуків у деталях ──
/**
 * @param {Element} container
 * @param {MediaItem} item
 * @returns {void}
 */
function renderDetailReviews(container, item) {
  container.innerHTML = '<div class="media-detail-reviews-title">Відгуки</div>';
  /** @type {Array<'dima' | 'lena'>} */
  (['dima', 'lena']).forEach(who => {
    const label   = who === 'dima' ? 'Діма' : 'Лєна';
    // Динамічний ключ (rating_dima/rating_lena) — MediaItem не має
    // індекс-сигнатури (навмисно, щоб не пускати довільні поля), тому
    // явна розгалузка замість item[`rating_${who}`].
    const rating  = who === 'dima' ? item.rating_dima : item.rating_lena;
    const comment = who === 'dima' ? item.comment_dima : item.comment_lena;
    const row = document.createElement('div');
    row.className = 'media-detail-review-row';
    row.innerHTML = `
      <span class="media-detail-review-who">${label}</span>
      ${rating ? `<span class="media-detail-review-rating">★ ${rating}/10</span>` : '<span class="media-detail-review-rating" style="color:var(--text-muted)">—</span>'}
      <span class="media-detail-review-comment">${comment ? esc(comment) : '<i style="color:var(--text-muted)">Немає відгуку</i>'}</span>
      <button class="media-detail-review-edit" data-who="${who}">✏️ Відгук</button>`;
    row.querySelector('.media-detail-review-edit')?.addEventListener('click', () => {
      closeModalAnimated();
      openReviewPanel(item, who);
    });
    container.appendChild(row);
  });
}

// ── Панель відгуку ──
/**
 * @param {MediaItem} item
 * @param {'dima' | 'lena'} [preselectedWho]
 * @returns {void}
 */
function openReviewPanel(item, preselectedWho) {
  const root = el('modal-root');
  if (!root) return;
  /** @type {'dima' | 'lena'} */
  let selectedWho = preselectedWho || 'dima';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'review-panel-overlay';
  closeModalAnimated();
  root.appendChild(overlay);

  const render = () => {
    const who        = selectedWho;
    // Динамічний ключ — те саме, що й у renderDetailReviews.
    const curRating  = (who === 'dima' ? item.rating_dima : item.rating_lena) || null;
    const curComment = (who === 'dima' ? item.comment_dima : item.comment_lena) || '';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Відгук — ${esc(item.title)}</h3>
        <div class="form-field">
          <label>Хто залишає відгук</label>
          <div class="plans-status-chips">
            <button class="plans-status-chip${who==='dima'?' active':''}" data-who="dima">Діма</button>
            <button class="plans-status-chip${who==='lena'?' active':''}" data-who="lena">Лєна</button>
          </div>
        </div>
        <div class="form-field">
          <label>Оцінка (1–10)</label>
          <div class="rate-number-row">
            ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="rate-num-btn${curRating==n?' active':''}" data-score="${n}">${n}</button>`).join('')}
          </div>
        </div>
        <div class="form-field">
          <label>Коментар</label>
          <textarea id="review-comment" rows="3" placeholder="Враження, думки...">${esc(curComment)}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="review-cancel">Скасувати</button>
          <button class="btn-primary"   id="review-save">Зберегти</button>
        </div>
      </div>`;

    overlay.querySelectorAll('[data-who]').forEach(b => {
      b.addEventListener('click', () => {
        const w = /** @type {HTMLElement} */ (b).dataset.who;
        selectedWho = w === 'lena' ? 'lena' : 'dima';
        render();
      });
    });
    /** @type {number | null} */
    let selectedScore = curRating;
    overlay.querySelectorAll('.rate-num-btn').forEach(b => {
      b.addEventListener('click', () => {
        const scoreStr = /** @type {HTMLElement} */ (b).dataset.score || '0';
        selectedScore = parseInt(scoreStr);
        overlay.querySelectorAll('.rate-num-btn').forEach(x => x.classList.toggle('active', /** @type {HTMLElement} */ (x).dataset.score == String(selectedScore)));
      });
    });
    overlay.querySelector('#review-cancel')?.addEventListener('click', () => root.innerHTML='');
    overlay.addEventListener('click', e => { if(/** @type {HTMLElement} */ (e.target).id==='review-panel-overlay') root.innerHTML=''; });
    overlay.querySelector('#review-save')?.addEventListener('click', async () => {
      const commentInp = /** @type {HTMLTextAreaElement} */ (overlay.querySelector('#review-comment'));
      const comment = commentInp.value.trim();
      // Динамічний ключ на запис — тут дійсно потрібен рядковий
      // індекс (rating_dima/rating_lena/comment_dima/comment_lena
      // обираються за selectedWho), тому Record<string,...> замість
      // точного інтерфейсу MediaItem.
      /** @type {Record<string, string | number | null>} */
      const update  = {};
      if (selectedScore) update[`rating_${selectedWho}`]  = selectedScore;
      update[`comment_${selectedWho}`] = comment || null;
      /** @type {{ error: SupaError | null }} */
      const { error } = await supabase.from('media_items').update(update).eq('id', item.id);
      if (error) { alert('Помилка збереження'); return; }
      Object.assign(item, update);
      invalidateMedia();
      closeModalAnimated();
      refresh();
    });
  };
  render();
}

  // ── ВИДАЛЕННЯ ----------
/**
 * @param {number} id
 * @returns {Promise<void>}
 */
async function deleteItem(id) {
  if (!confirm('Видалити цей елемент?')) return;
  const { error } = await supabase.from('media_items').delete().eq('id', id);
  if (error) { alert('Помилка видалення'); return; }
  invalidateMedia(); refresh();
}

// ── ДОДАТИ вручну ----------
/** @returns {void} */
function openAddModal() {
  const conf = STATUS_CONFIG[activeType];
  const root = el('modal-root');
  if (!root) return;
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
          <input type="file" id="media-poster-file" accept="image/*,.heic,.heif">
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

  const closeModal = () => closeModalAnimated();
  el('media-cancel')?.addEventListener('click', closeModal);
  el('media-modal-overlay')?.addEventListener('click', e => { if (/** @type {HTMLElement} */ (e.target).id==='media-modal-overlay') closeModal(); });
  el('media-save')?.addEventListener('click', saveItem);
}

/** @returns {Promise<void>} */
async function saveItem() {
  const titleInp = /** @type {HTMLInputElement} */ (el('media-title'));
  const statusInp = /** @type {HTMLSelectElement} */ (el('media-status-new'));
  const fileInp = /** @type {HTMLInputElement} */ (el('media-poster-file'));
  const title  = titleInp.value.trim();
  const status = /** @type {MediaStatus} */ (statusInp.value);
  const file   = fileInp.files?.[0];
  if (!title) { alert('Вкажи назву'); return; }

  const saveBtn = /** @type {HTMLButtonElement} */ (el('media-save'));
  saveBtn.textContent = 'Зберігаємо…'; saveBtn.disabled = true;
  const user = Auth.getCurrentUser();

  /** @type {SupaResult<{ id: number }>} */
  const { data, error } = await supabase.from('media_items')
    .insert({ type: activeType, title, status, created_by: user?.id||null })
    .select('id').single();
  if (error || !data) { alert('Не вдалось зберегти'); saveBtn.textContent='Зберегти'; saveBtn.disabled=false; return; }

  if (file) {
    const url = await uploadPoster(file, data.id);
    if (url) await supabase.from('media_items').update({ poster_url: url }).eq('id', data.id);
  }
  closeModalAnimated();
  invalidateMedia(); refresh();
}

// ── РЕДАГУВАТИ ----------
/**
 * @param {number} id
 * @returns {void}
 */
function openEditModal(id) {
  const item = allItems.find(i => String(i.id)===String(id));
  if (!item) return;
  const conf = STATUS_CONFIG[activeType];
  const root = el('modal-root');
  if (!root) return;
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
          <input type="file" id="edit-poster-file" accept="image/*,.heic,.heif">
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

  const closeModal = () => closeModalAnimated();
  el('edit-cancel')?.addEventListener('click', closeModal);
  el('media-edit-overlay')?.addEventListener('click', e => { if (/** @type {HTMLElement} */ (e.target).id==='media-edit-overlay') closeModal(); });
  el('edit-save')?.addEventListener('click', () => saveEdit(id, item));
}

/**
 * @param {number} id
 * @param {MediaItem} item
 * @returns {Promise<void>}
 */
async function saveEdit(id, item) {
  const titleInp = /** @type {HTMLInputElement} */ (el('edit-title'));
  const statusInp = /** @type {HTMLSelectElement} */ (el('edit-status'));
  const fileInp = /** @type {HTMLInputElement} */ (el('edit-poster-file'));
  const title  = titleInp.value.trim();
  const status = /** @type {MediaStatus} */ (statusInp.value);
  const file   = fileInp.files?.[0];
  if (!title) { alert('Вкажи назву'); return; }

  const saveBtn = /** @type {HTMLButtonElement} */ (el('edit-save'));
  saveBtn.textContent = 'Зберігаємо…'; saveBtn.disabled = true;

  /** @type {{ title: string, status: MediaStatus, poster_url?: string }} */
  const update = { title, status };
  if (file) { const url = await uploadPoster(file, id); if (url) update.poster_url = url; }

  const { error } = await supabase.from('media_items').update(update).eq('id', id);
  if (error) { alert('Помилка збереження'); saveBtn.textContent='Зберегти'; saveBtn.disabled=false; return; }
  closeModalAnimated();
  invalidateMedia(); refresh();
}

// ── ВКЛАДКИ ----------
/** @returns {void} */
function renderTabs() {
  document.querySelectorAll('.media-tab').forEach(btn =>
    btn.classList.toggle('active', /** @type {HTMLElement} */ (btn).dataset.mediaType === activeType));
}

// ── REFRESH ----------
/** @returns {void} */
function invalidateMedia() { DataCache.invalidate('media:' + activeType); }

/** @returns {void} */
function showSkeleton() {
  const wrap = el('media-list');
  if (!wrap || DataCache.get('media:' + activeType) !== undefined) return;
  wrap.innerHTML = `<div class="skeleton-grid">${Array(4).fill(`
    <div class="skeleton-card">
      <div class="skeleton skeleton-avatar" style="border-radius:8px;width:56px;height:80px"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line mid"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line full"></div>
      </div>
    </div>`).join('')}</div>`;
}

/** @returns {void} */
function refresh(){
  visibleCount = PAGE_SIZE;
  renderTabs();
  showSkeleton();
  // Фіксуємо тип на момент запиту. SWR-колбек асинхронний: якщо за час
  // фетчу користувач перемкнув вкладку (activeType вже інший), застарілий
  // колбек не має перетирати allItems і рендерити чужі дані під новою
  // вкладкою — тому рано виходимо.
  const reqType = activeType;
  DataCache.swr('media:' + reqType, () => loadItems(reqType),
    DataCache.fadeRender(el('media-list'), (items) => {
      if (reqType !== activeType) return;
      allItems = items || [];
      renderStats();
      renderFilters();
      renderGrid();
    }));
}

// ── INIT ----------
/** @returns {void} */
function init() {
  el('add-media-btn')?.addEventListener('click', openAddModal);

  document.querySelectorAll('.media-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = /** @type {HTMLElement} */ (btn).dataset.mediaType;
      activeType   = t === 'series' || t === 'book' ? t : 'movie';
      activeFilter = 'all';
      // Очищуємо пошук при зміні вкладки
      const inp = /** @type {HTMLInputElement | null} */ (el('media-search-inp'));
      if (inp) inp.value = '';
      hideSearchResults();
      updateSearchVisibility();
      renderTabs();
      refresh();
    });
  });

  window.addEventListener('portal:view', e => {
    if (/** @type {CustomEvent} */ (e).detail.view === 'media') {
      bindSwipeToggle();
      bindSearch();
      updateSearchVisibility();
      refresh();
    }
  });
}

export const Media = { init, refresh };
