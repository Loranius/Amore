// ============================================================
// COUNTER MODULE
// Лічильник днів разом, дата береться з таблиці settings.
// Дата старту практично незмінна → кешуємо (DataCache + localStorage),
// тому лічильник показується МИТТЄВО, без очікування мережі.
// Найближча подія береться зі спільного кешу 'events' (без окремого запиту).
// ============================================================


import { supabase } from '../lib/supabase.js';
import { DataCache } from '../lib/cache.js';

const START_LS = 'amore:startDate';

// Канонічний завантажувач подій — ТОЙ САМИЙ select, що в calendar.js,
// щоб обидва модулі ділили один кеш-ключ 'events' без розбіжностей.
/** @returns {Promise<CalendarEvent[]>} */
async function loadEventsFull() {
  const { data } = /** @type {SupaResult<CalendarEvent[]>} */ (await supabase.from('events')
    .select('id,title,description,date,created_by,type,yearly')
    .order('date', { ascending: true }));
  return data || [];
}

/** @returns {Promise<string | null>} */
async function fetchStartDate() {
  const { data, error } = /** @type {SupaResult<AppSettingRow>} */ (await supabase
    .from('settings')
    .select('value')
    .eq('key', 'relationship_start_date')
    .single());
  if (error || !data) { console.warn('Дата старту стосунків не налаштована'); return null; }
  return /** @type {string} */ (data.value); // 'YYYY-MM-DD'
}

/** @param {string} dateStr @returns {string} */
function formatSinceDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** @param {string} dateStr @returns {number} */
function daysBetween(dateStr) {
  const start = new Date(dateStr);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/** @param {string} str @returns {string} */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Малює числа лічильника (на головній і в календарі)
/** @param {string | null} startDate @returns {void} */
function paintCounter(startDate) {
  const homeNumber = document.getElementById('counter-number');
  const homeSince  = document.getElementById('counter-since');

  if (!startDate) {
    if (homeNumber) homeNumber.textContent = '?';
    if (homeSince) homeSince.textContent = 'дата ще не вказана';
    return;
  }
  const daysStr  = daysBetween(startDate).toLocaleString('uk-UA');
  const sinceStr = `з ${formatSinceDate(startDate)}`;
  if (homeNumber) homeNumber.textContent = daysStr;
  if (homeSince) homeSince.textContent = sinceStr;
}

// Плани (type:'other') зберігають статус прямо в description у вигляді
// [status:done] — саме так calendar.js позначає план як архівний.
// Такі плани мають ігноруватись при виборі "найближчої події" на головній.
/** @param {CalendarEvent} ev @returns {boolean} */
function isArchivedPlan(ev) {
  if ((ev.type || 'other') !== 'other') return false;
  return /\[status:done\]/.test(ev.description || '');
}

/** @param {CalendarEvent[]} events @returns {void} */
function renderNextEvent(events) {
  const widget = document.getElementById('next-event-widget');
  if (!widget) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  // Локальна дата (а не toISOString, яка переводить у UTC і може
  // "з'їсти" день ближче до півночі в часових поясах з позитивним зсувом)
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  // Найближча подія з датою >= сьогодні, що не є завершеним/архівним планом
  // (events вже відсортовані за датою)
  const data = (events || []).find(e => e.date >= todayStr && !isArchivedPlan(e));

  if (!data) {
    widget.innerHTML = '<div class="next-event-empty">📅 Найближчих подій немає</div>';
    return;
  }

  const eventDate = new Date(data.date + 'T00:00:00');
  const diffDays  = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr   = eventDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  const daysLabel = diffDays === 0 ? 'сьогодні! 🎉'
    : diffDays === 1 ? 'завтра'
    : 'через ' + diffDays + ' дн.';

  widget.innerHTML =
    '<div class="next-event-widget-inner">' +
      '<span class="next-event-icon">📅</span>' +
      '<div class="next-event-info">' +
        '<p class="next-event-label">Найближча подія</p>' +
        '<p class="next-event-title">' + escapeHtml(data.title) + '</p>' +
        '<p class="next-event-date">' + dateStr + ' — ' + daysLabel + '</p>' +
      '</div>' +
    '</div>';
}

/** @param {string | null} startDate @returns {void} */
function renderNextAnniversary(startDate) {
  const el = document.getElementById('counter-next-anniversary');
  if (!el || !startDate) return;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);

  let nextAnn = new Date(start);
  const startMonth = start.getMonth();
  nextAnn.setFullYear(now.getFullYear());
  // 29 лютого у невисокосний рік setFullYear зсуває на 1 березня — повертаємо
  // на 28 лютого, щоб річниця не «стрибала» на інший місяць.
  if (nextAnn.getMonth() !== startMonth) nextAnn.setDate(0);
  if (nextAnn <= now) {
    nextAnn.setFullYear(now.getFullYear() + 1);
    if (nextAnn.getMonth() !== startMonth) nextAnn.setDate(0);
  }

  const diffDays = Math.round((nextAnn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const years = nextAnn.getFullYear() - start.getFullYear();

  let label;
  if (diffDays === 0) label = `🎉 Сьогодні ${years} рік разом!`;
  else if (diffDays === 1) label = `💕 Завтра ${years} рік разом`;
  else if (diffDays <= 30) label = `💕 Річниця через ${diffDays} дн. (${years} р.)`;
  else label = `Річниця через ~${Math.round(diffDays / 30)} міс.`;

  el.textContent = label;
}

function render() {
  // 1) Дата старту — миттєво з localStorage, потім ревалідація з БД
  const cachedStart = localStorage.getItem(START_LS);
  if (cachedStart) { paintCounter(cachedStart); renderNextAnniversary(cachedStart); }

  DataCache.swr('settings:start', fetchStartDate, (val) => {
    if (val) localStorage.setItem(START_LS, val);
    const eff = val || cachedStart;
    paintCounter(eff);
    renderNextAnniversary(eff);
  });

  // 2) Найближча подія — зі спільного кешу подій
  DataCache.swr('events', loadEventsFull, (events) => {
    renderNextEvent(events || []);
    window.dispatchEvent(new CustomEvent('cache:events'));
  });
}

function init() {
  window.addEventListener('portal:auth', render);
  window.addEventListener('portal:view', (e) => {
    const detail = /** @type {any} */ (e).detail;
    if (detail.view === 'calendar' || detail.view === 'home') render();
  });
}

export const Counter = { init, render };
