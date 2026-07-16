// ============================================================
// PHOTO CALENDAR MODULE v1
// Один спогад (фото + коментар) на день для кожного партнера.
// Бакет Supabase Storage: 'photo-calendar'
// Таблиця: public.photo_calendar (date, user_id, photo_url, comment)
// ============================================================

import { supabase } from '../lib/supabase.js';
import { DataCache } from '../lib/cache.js';
import { Img } from '../lib/img.js';
import { ErrorBoundary } from '../lib/error-boundary.js';
import { Auth } from './auth.js';
import { closeModalAnimated } from '../lib/modal.js';

/** @typedef {HTMLElement & {_cleanup?: () => void, _syncVV?: () => void}} PcalOverlay */

// ── КОНСТАНТИ ──────────────────────────────────────────────
const BUCKET = 'photo-calendar';

// ── СТАН ────────────────────────────────────────────────────
let yr = 0, mo = 0;         // поточний рік і місяць
/** @type {Record<string, PhotoCalendarRow[]>} */
let monthPhotos = {};        // { 'YYYY-MM-DD': [photo, ...] }
/** @type {AppUser | null} */
let currentUser  = null;
/** @type {AppUser | null} */
let partnerUser  = null;
/** @type {File | Blob | null} */
let pendingFile  = null;     // файл, обраний юзером до підтвердження

// ── УТИЛІТИ ─────────────────────────────────────────────────
/** @param {string} id @returns {HTMLElement | null} */
const el  = id => document.getElementById(id);
/** @param {string} s @returns {string} */
const esc = s  => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
/** @param {number} n @returns {string} */
const pad = n  => String(n).padStart(2, '0');
/** @param {number} y @param {number} m @param {number} d @returns {string} */
const dstr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
// Локальна дата (не toISOString/UTC): інакше вночі до 02:00–03:00
// "сьогодні" визначалось як учора (невірна підсвітка/блокування днів).
/** @returns {string} */
const todayStr = () => { const d = new Date(); return dstr(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

const MONTHS_UA = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'
];
const DAYS_UA = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','НД'];

// ── ДАНІ ────────────────────────────────────────────────────
/** @returns {Promise<void>} */
async function fetchUsers() {
  const all = await Auth.getUsers();
  currentUser = Auth.getCurrentUser();
  partnerUser = all.find(u => u.id !== currentUser?.id) || null;
}

/** @returns {string} */
function monthKey() { return 'pcal:' + yr + '-' + pad(mo); }

/** @returns {Promise<PhotoCalendarRow[]>} */
async function fetchMonthRows() {
  const lastDay = new Date(yr, mo, 0).getDate();
  const from = dstr(yr, mo, 1);
  const to   = dstr(yr, mo, lastDay);
  const { data, error } = /** @type {SupaResult<PhotoCalendarRow[]>} */ (await supabase
    .from('photo_calendar')
    .select('id,date,user_id,photo_url,comment')
    .gte('date', from).lte('date', to));
  if (error) { console.error('pcal load error:', error); return []; }
  return data || [];
}

/** @param {PhotoCalendarRow[]} rows @returns {void} */
function buildMonthMap(rows) {
  monthPhotos = {};
  (rows || []).forEach(p => {
    if (!monthPhotos[p.date]) monthPhotos[p.date] = [];
    monthPhotos[p.date].push(p);
  });
}

// Миттєво з кешу місяця, потім ревалідація; рендер у колбеку.
/** @returns {Promise<PhotoCalendarRow[] | null>} */
function loadMonthPhotos() {
  return DataCache.swr(monthKey(), fetchMonthRows, (rows) => {
    buildMonthMap(rows || []);
    renderCalendar();
  });
}

// ── РЕНДЕР КАЛЕНДАРЯ ────────────────────────────────────────
function renderCalendar() {
  const grid = el('pcal-grid'); if (!grid) return;
  const today      = todayStr();
  const daysInMonth = new Date(yr, mo, 0).getDate();

  // getDay() 0=Sun → Mon-based: Mon=0..Sun=6
  let firstDow = new Date(yr, mo - 1, 1).getDay();
  firstDow = firstDow === 0 ? 6 : firstDow - 1;

  grid.innerHTML = '';

  // Заголовок ПН..НД
  DAYS_UA.forEach(d => {
    const h = document.createElement('div');
    h.className = 'pcal-dow'; h.textContent = d;
    grid.appendChild(h);
  });

  // Пусті клітинки перед 1-м числом
  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div');
    e.className = 'pcal-cell pcal-cell--empty';
    grid.appendChild(e);
  }

  // Дні місяця
  for (let d = 1; d <= daysInMonth; d++) {
    const ds      = dstr(yr, mo, d);
    const photos  = monthPhotos[ds] || [];
    const isToday  = ds === today;
    const isFuture = ds > today;

    const cell = document.createElement('button');
    cell.className =
      'pcal-cell' +
      (isToday  ? ' pcal-cell--today'  : '') +
      (isFuture ? ' pcal-cell--future' : '');
    if (isFuture) cell.disabled = true;

    // Номер дня
    const num = document.createElement('span');
    num.className = 'pcal-cell-num';
    num.textContent = String(d);
    cell.appendChild(num);

    // Кольорові крапки: моя (рожева) + партнер (бузкова)
    if (photos.length) {
      const myP  = photos.find(p => p.user_id === currentUser?.id);
      const ptnP = photos.find(p => p.user_id !== currentUser?.id);
      const dots = document.createElement('div');
      dots.className = 'pcal-dots';
      if (myP)  { const s = document.createElement('span'); s.className = 'pcal-dot pcal-dot--me';      dots.appendChild(s); }
      if (ptnP) { const s = document.createElement('span'); s.className = 'pcal-dot pcal-dot--partner'; dots.appendChild(s); }
      cell.appendChild(dots);
    }

    cell.addEventListener('click', () => openDayModal(ds));
    grid.appendChild(cell);
  }

  // Заголовок місяця
  const lbl = el('pcal-month-label');
  if (lbl) lbl.textContent = `${MONTHS_UA[mo - 1]} ${yr}`;
}

// ── МОДАЛКА ДНЯ ─────────────────────────────────────────────
/** @param {string} ds @returns {void} */
function openDayModal(ds) {
  pendingFile = null;
  const photos   = monthPhotos[ds] || [];
  const myPhoto  = photos.find(p => p.user_id === currentUser?.id)  || null;
  const ptnPhoto = photos.find(p => p.user_id !== currentUser?.id) || null;

  const [y, m, d] = ds.split('-');
  const label   = `${parseInt(d)} ${MONTHS_UA[parseInt(m) - 1]} ${y}`;
  const myName  = esc(currentUser?.name || 'Я');
  const ptnName = esc(partnerUser?.name || 'Партнер');

  // Мій слот
  const mySlot = myPhoto
    ? `<img class="pcal-thumb" src="${esc(myPhoto.photo_url)}" loading="lazy" alt=""
            onerror="this.style.display='none'">
       ${myPhoto.comment ? `<p class="pcal-thumb-comment">${esc(myPhoto.comment)}</p>` : ''}
       <button class="pcal-replace-btn" id="pcal-replace-btn">Замінити фото</button>`
    : `<button class="pcal-upload-btn" id="pcal-upload-btn">
         <span class="pcal-upload-icon">📷</span>
         <span>Додати фото</span>
       </button>`;

  // Слот партнера
  const ptnSlot = ptnPhoto
    ? `<img class="pcal-thumb" src="${esc(ptnPhoto.photo_url)}" loading="lazy" alt=""
            onerror="this.style.display='none'">
       ${ptnPhoto.comment ? `<p class="pcal-thumb-comment">${esc(ptnPhoto.comment)}</p>` : ''}`
    : `<div class="pcal-empty-slot">Ще немає 🌸</div>`;

  // Блок редагування коментаря (якщо є моє фото)
  const commentBlock = myPhoto ? `
    <div class="pcal-comment-block">
      <input type="text" id="pcal-comment-inp" class="fin-inp"
             placeholder="Коментар до твого фото…"
             value="${esc(myPhoto.comment || '')}">
      <button class="btn-secondary" id="pcal-save-comment"
              data-photo-id="${myPhoto.id}" style="width:100%;margin-top:8px">
        Зберегти коментар
      </button>
    </div>` : '';

  /** @type {HTMLElement} */ (el('modal-root')).innerHTML = `
    <div class="modal-overlay" id="pcal-ov">
      <div class="modal-card pcal-day-card">
        <div class="pcal-modal-date">📆 ${label}</div>

        <div class="pcal-photos-row">
          <div class="pcal-photo-slot">
            <div class="pcal-slot-label">
              <span class="pcal-dot pcal-dot--me"></span> ${myName}
            </div>
            <div id="pcal-slot-me" class="pcal-slot-media">${mySlot}</div>
          </div>
          <div class="pcal-photo-slot">
            <div class="pcal-slot-label">
              <span class="pcal-dot pcal-dot--partner"></span> ${ptnName}
            </div>
            <div class="pcal-slot-media">${ptnSlot}</div>
          </div>
        </div>

        ${commentBlock}

        <!-- Форма появляється після вибору файлу -->
        <div id="pcal-upload-form" class="pcal-upload-form hidden">
          <div class="pcal-preview-wrap">
            <img id="pcal-preview-img" class="pcal-preview-img" src="" alt="">
          </div>
          <input type="text" id="pcal-new-comment" class="fin-inp"
                 placeholder="Коментар (необов'язково)" style="margin-bottom:10px">
          <button class="btn-primary" id="pcal-upload-confirm"
                  data-date="${ds}" style="width:100%">
            Завантажити
          </button>
          <button class="btn-secondary" id="pcal-upload-cancel"
                  style="width:100%;margin-top:8px">
            Скасувати вибір
          </button>
        </div>

        <button class="more-menu-close" id="pcal-modal-close">Закрити</button>
      </div>
    </div>`;

  bindDayModal(ds, myPhoto);
  syncVP(/** @type {PcalOverlay | null} */ (el('pcal-ov')));
}

/** @param {string} ds @param {PhotoCalendarRow | null} myPhoto @returns {void} */
function bindDayModal(ds, myPhoto) {
  // Закрити
  el('pcal-ov')?.addEventListener('click', e => {
    if (/** @type {HTMLElement} */ (e.target).id === 'pcal-ov') closeDayModal();
  });
  el('pcal-modal-close')?.addEventListener('click', closeDayModal);

  // Клік на фото → повноекранний lightbox
  el('modal-root')?.querySelectorAll('.pcal-thumb').forEach(imgEl => {
    const img = /** @type {HTMLImageElement} */ (imgEl);
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(img.src));
  });

  // Прихований файловий input — одним екземпляром на всю модалку
  const fileInp = document.createElement('input');
  fileInp.type = 'file'; fileInp.accept = 'image/*,.heic,.heif'; fileInp.style.display = 'none';
  document.body.appendChild(fileInp);
  fileInp.addEventListener('change', e => onFileSelected(/** @type {HTMLInputElement} */ (e.target).files?.[0] || null));

  // Кнопки відкриття файлового пікера
  el('pcal-upload-btn')?.addEventListener('click',  () => fileInp.click());
  el('pcal-replace-btn')?.addEventListener('click', () => fileInp.click());

  // Підтвердити завантаження
  el('pcal-upload-confirm')?.addEventListener('click', () => doUpload(ds, myPhoto?.id));

  // Скасувати вибір файлу
  el('pcal-upload-cancel')?.addEventListener('click', () => {
    pendingFile = null;
    fileInp.value = '';
    el('pcal-upload-form')?.classList.add('hidden');
  });

  // Зберегти коментар (без заміни фото)
  el('pcal-save-comment')?.addEventListener('click', async () => {
    const comment = /** @type {HTMLInputElement | null} */ (el('pcal-comment-inp'))?.value.trim() || null;
    const pid     = el('pcal-save-comment')?.dataset.photoId;
    if (!pid) return;
    await supabase.from('photo_calendar').update({ comment }).eq('id', pid);
    const p = (monthPhotos[ds] || []).find(x => String(x.id) === String(pid));
    if (p) p.comment = comment;
    DataCache.invalidate(monthKey());
    closeDayModal();
    renderCalendar();
  });

  // Прибрати файловий input при закритті
  /** @type {PcalOverlay} */ (/** @type {HTMLElement} */ (el('pcal-ov')))._cleanup = () => fileInp.remove();
}

/** @param {File | null} file @returns {Promise<void>} */
async function onFileSelected(file) {
  if (!file) return;
  // HEIC з iPhone конвертуємо в JPEG одразу — інакше прев'ю і стиснення не спрацюють
  try {
    file = await Img.normalize(file);
  } catch (e) {
    console.error('[PhotoCalendar] конвертація HEIC не вдалася:', e);
    ErrorBoundary.showToast('Не вдалося обробити HEIC-фото: ' + /** @type {Error} */ (e).message);
    return;
  }
  pendingFile = file;
  // Прев'ю
  const reader = new FileReader();
  reader.onload = e => {
    const img = /** @type {HTMLImageElement | null} */ (el('pcal-preview-img'));
    if (img) img.src = /** @type {string} */ (e.target?.result);
  };
  reader.readAsDataURL(file);
  el('pcal-upload-form')?.classList.remove('hidden');
}

// ── ЗАВАНТАЖЕННЯ / ЗАМІНА ФОТО ───────────────────────────────
/** @param {string} ds @param {number | undefined} existingId @returns {Promise<void>} */
async function doUpload(ds, existingId) {
  if (!pendingFile) return;
  if (!currentUser) return;
  const btn = /** @type {HTMLButtonElement | null} */ (el('pcal-upload-confirm'));
  if (btn) { btn.disabled = true; btn.textContent = 'Завантаження…'; }

  try {
    // Стиснення (Img.compress з lib/img.js)
    /** @type {File | Blob} */
    let blob = pendingFile;
    let ext = 'jpg', contentType = 'image/jpeg';
    try {
      const out = await Img.compress(/** @type {File} */ (pendingFile), 1280, 0.82);
      blob = out.blob; ext = out.ext; contentType = out.contentType;
    } catch (e) { console.warn('compress failed, uploading original:', e); }

    // Шлях у Storage. Розширення залежить від формату стиснення (WebP/JPEG),
    // а він різниться між браузерами — тому при заміні фото шлях може
    // змінитись (napr. .jpg → .webp) і старий файл лишився б сиротою в
    // бакеті. Прибираємо інші можливі розширення того самого (дата, юзер)
    // ПЕРЕД завантаженням. remove() на неіснуючий шлях у Supabase Storage
    // не помилка, тож перелічити кандидатів безпечно.
    const [y, m] = ds.split('-');
    const basePath = `${y}/${m}/${ds}_${currentUser.id}`;
    const path     = `${basePath}.${ext}`;

    const staleVariants = ['jpg', 'webp', 'jpeg', 'png']
      .map(e => `${basePath}.${e}`)
      .filter(p => p !== path);
    if (staleVariants.length) {
      try { await supabase.storage.from(BUCKET).remove(staleVariants); }
      catch (e) { console.warn('pcal: не вдалось прибрати старе фото:', e); }
    }

    const { error: upErr } = await supabase.storage
      .from(BUCKET).upload(path, blob, { upsert: true, contentType });
    if (upErr) throw upErr;

    // Отримуємо URL + додаємо cache-bust щоб браузер не показував старе фото
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const photo_url = urlData.publicUrl + '?t=' + Date.now();
    const comment   = /** @type {HTMLInputElement | null} */ (el('pcal-new-comment'))?.value.trim() || null;

    if (existingId) {
      // Заміна: оновлюємо існуючий рядок за id
      // (upsert з onConflict може дублювати рядки якщо немає unique constraint)
      const { error: dbErr } = await supabase.from('photo_calendar')
        .update({ photo_url, comment: comment ?? undefined })
        .eq('id', existingId);
      if (dbErr) throw dbErr;
    } else {
      // Нове фото: вставляємо рядок
      const { error: dbErr } = await supabase.from('photo_calendar')
        .insert({ date: ds, user_id: currentUser.id, photo_url, comment });
      if (dbErr) throw dbErr;
    }

    DataCache.invalidate(monthKey());
    await loadMonthPhotos();
    closeDayModal();

  } catch (e) {
    console.error('pcal upload error:', e);
    const msg = /** @type {{message?: unknown}} */ (e).message;
    alert('Помилка завантаження: ' + (msg || String(e)));
    if (btn) { btn.disabled = false; btn.textContent = 'Завантажити'; }
  }
}

// ── LIGHTBOX ─────────────────────────────────────────────────
/** @param {string} src @returns {void} */
function openLightbox(src) {
  // Закриваємо попередній якщо є
  document.getElementById('pcal-lightbox')?.remove();

  const lb = document.createElement('div');
  lb.id = 'pcal-lightbox';
  lb.className = 'pcal-lightbox';
  lb.innerHTML = `
    <button class="pcal-lb-close" aria-label="Закрити">✕</button>
    <img class="pcal-lb-img" src="${esc(src)}" alt="">`;
  document.body.appendChild(lb);

  // Закрити по тапу на фон або кнопку ✕
  lb.addEventListener('click', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target === lb || target.classList.contains('pcal-lb-close')) {
      lb.classList.add('pcal-lightbox--closing');
      setTimeout(() => lb.remove(), 180);
    }
  });

  // Закрити по свайпу вниз (мобільний жест)
  let startY = 0;
  lb.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - startY > 80) {
      lb.classList.add('pcal-lightbox--closing');
      setTimeout(() => lb.remove(), 180);
    }
  }, { passive: true });
}

function closeDayModal() {
  document.getElementById('pcal-lightbox')?.remove(); // на всяк випадок
  const ov = /** @type {PcalOverlay | null} */ (el('pcal-ov'));
  ov?._cleanup?.();
  if (window.visualViewport && ov?._syncVV) {
    window.visualViewport.removeEventListener('resize', ov._syncVV);
    window.visualViewport.removeEventListener('scroll', ov._syncVV);
  }
  closeModalAnimated();
  pendingFile = null;
}

/** @param {PcalOverlay | null} ov @returns {void} */
function syncVP(ov) {
  if (!window.visualViewport || !ov) return;
  const sync = () => {
    const vv = /** @type {VisualViewport} */ (window.visualViewport);
    ov.style.height = vv.height + 'px';
    ov.style.top    = vv.offsetTop + 'px';
  };
  sync();
  window.visualViewport.addEventListener('resize', sync);
  window.visualViewport.addEventListener('scroll', sync);
  ov._syncVV = sync;
}

// ── НАВІГАЦІЯ ────────────────────────────────────────────────
/** @param {number} delta @returns {Promise<void>} */
async function changeMonth(delta) {
  mo += delta;
  if (mo > 12) { mo = 1; yr++; }
  if (mo < 1)  { mo = 12; yr--; }
  await loadMonthPhotos();
}

// ── РЕФРЕШ / ІНІТ ───────────────────────────────────────────
/** @returns {Promise<void>} */
async function refresh() {
  currentUser = Auth.getCurrentUser();
  await fetchUsers();
  if (!yr) {
    const now = new Date();
    yr = now.getFullYear();
    mo = now.getMonth() + 1;
  }
  await loadMonthPhotos();
}

function init() {
  el('pcal-prev')?.addEventListener('click', () => changeMonth(-1));
  el('pcal-next')?.addEventListener('click', () => changeMonth(+1));
  window.addEventListener('portal:view', e => {
    if (/** @type {any} */ (e).detail.view === 'photo-calendar') refresh();
  });
}

export const PhotoCalendar = { init, refresh };
