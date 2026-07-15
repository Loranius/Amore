// ============================================================
// WEEK WIDGET — «На цей тиждень»
// Показує на головній: найближчі події + плани з дедлайном
// цього тижня, згруповані по днях.
// Використовує спільний кеш 'events' (не робить окремого запиту).
// ============================================================

const WeekWidget = (() => {

  const UA_DAYS  = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const UA_MONTHS = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер',
                     'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

  /** @type {Record<string, string>} */
  const TYPE_ICON = {
    birthday:    '🎂',
    anniversary: '💕',
    holiday:     '🎉',
    other:       '🗺️',
  };

  /** @param {string} s @returns {string} */
  const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

  // Розбираємо мета-теги планів із description
  /** @param {string | null} desc @returns {{cat: PlanCategory, status: PlanStatus}} */
  function parsePlanMeta(desc) {
    let cat = /** @type {PlanCategory} */ ('other'), status = /** @type {PlanStatus} */ ('planned');
    const mCat    = (desc || '').match(/\[cat:(\w+)\]/);
    const mStatus = (desc || '').match(/\[status:(\w+)\]/);
    if (mCat)    cat    = /** @type {PlanCategory} */ (mCat[1]);
    if (mStatus) status = /** @type {PlanStatus} */ (mStatus[1]);
    return { cat, status };
  }

  /** @param {Date} d @returns {Date} */
  function startOfDay(d) {
    const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
  }

  // Той самий канонічний select, що в counter.js/calendar.js —
  // усі три модулі ділять один кеш-ключ 'events' і один мережевий запит
  // (одночасні виклики дедуплікуються в DataCache.inflight).
  /** @returns {Promise<CalendarEvent[]>} */
  async function loadEventsFull() {
    const { data } = /** @type {SupaResult<CalendarEvent[]>} */ (await supabase.from('events')
      .select('id,title,description,date,created_by,type,yearly')
      .order('date', { ascending: true }));
    return data || [];
  }

  /** @param {CalendarEvent[]} events @returns {void} */
  function render(events) {
    const wrap = document.getElementById('week-widget');
    if (!wrap) return;

    const today  = startOfDay(new Date());
    const sunday = new Date(today);
    // Кінець поточного тижня — неділя включно.
    // (7 - day) % 7: у неділю тиждень закінчується СЬОГОДНІ,
    // а не показує події наступних семи днів.
    sunday.setDate(today.getDate() + ((7 - today.getDay()) % 7));
    sunday.setHours(23, 59, 59, 999);

    // Фільтруємо: тільки цього тижня, не виконані плани і всі звичайні події
    const week = (events || []).filter(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      if (d < today || d > sunday) return false;
      // Якщо тип "other" (план) — пропускаємо виконані
      if (ev.type === 'other') {
        const { status } = parsePlanMeta(ev.description);
        if (status === 'done') return false;
      }
      return true;
    });

    // Якщо нічого — ховаємо виджет
    if (!week.length) {
      wrap.innerHTML = '';
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');

    // Групуємо по даті
    /** @type {Record<string, CalendarEvent[]>} */
    const byDay = {};
    week.forEach(ev => {
      const key = ev.date;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(ev);
    });

    const sortedDays = Object.keys(byDay).sort();

    // Будуємо DOM
    const frag = document.createDocumentFragment();

    // Заголовок
    const hdr = document.createElement('div');
    hdr.className = 'week-widget-hdr';
    hdr.innerHTML = '<span class="week-widget-title">На цей тиждень</span>' +
      `<span class="week-widget-count">${week.length}</span>`;
    frag.appendChild(hdr);

    const list = document.createElement('div');
    list.className = 'week-widget-list';

    sortedDays.forEach(dateStr => {
      const d       = new Date(dateStr + 'T00:00:00');
      const isToday = d.toDateString() === today.toDateString();
      const isTomorrow = d.toDateString() === new Date(today.getTime() + 86400000).toDateString();

      let dayLabel;
      if (isToday)      dayLabel = 'Сьогодні';
      else if (isTomorrow) dayLabel = 'Завтра';
      else dayLabel = UA_DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + UA_MONTHS[d.getMonth()];

      // Роздільник дня
      const dayHdr = document.createElement('div');
      dayHdr.className = 'week-day-hdr' + (isToday ? ' week-day-hdr--today' : '');
      dayHdr.innerHTML = `<span class="week-day-label">${dayLabel}</span>`;
      list.appendChild(dayHdr);

      byDay[dateStr].forEach(ev => {
        const isPlan = ev.type === 'other';
        const cat = isPlan ? parsePlanMeta(ev.description).cat : null;
        /** @type {Record<string, string>} */
        const planIcons = { date: '💑', dream: '✨', trip: '✈️', goal: '🎯', other: '🗺️' };
        const icon = isPlan
          ? (planIcons[cat || ''] || '🗺️')
          : (TYPE_ICON[ev.type || ''] || '📅');

        // Підпис — чистий опис без тегів
        let note = '';
        if (isPlan) {
          note = (ev.description || '')
            .replace(/\[cat:\w+\]/g, '')
            .replace(/\[status:\w+\]/g, '')
            .replace(/\[doneAt:[^\]]*\]/g, '')
            .trim();
        }

        const row = document.createElement('div');
        row.className = 'week-event-row';
        row.innerHTML =
          `<span class="week-event-icon">${icon}</span>` +
          `<div class="week-event-body">` +
            `<span class="week-event-title">${esc(ev.title)}</span>` +
            (note ? `<span class="week-event-note">${esc(note)}</span>` : '') +
          `</div>` +
          (isPlan ? `<span class="week-event-badge week-badge-plan">план</span>`
                  : `<span class="week-event-badge week-badge-event">подія</span>`);

        list.appendChild(row);
      });
    });

    frag.appendChild(list);

    // Fade-in при оновленні
    wrap.innerHTML = '';
    wrap.appendChild(frag);
    requestAnimationFrame(() => wrap.classList.add('week-widget--visible'));
  }

  function showSkeleton() {
    const wrap = document.getElementById('week-widget');
    if (!wrap) return;
    wrap.classList.remove('hidden', 'week-widget--visible');
    wrap.innerHTML =
      '<div class="week-widget-hdr">' +
        '<span class="skeleton skeleton-line mid" style="width:120px;height:14px;border-radius:6px"></span>' +
      '</div>' +
      '<div class="week-widget-list week-skeleton-list">' +
        Array(3).fill(
          '<div class="week-event-row">' +
            '<span class="skeleton" style="width:24px;height:24px;border-radius:50%;flex-shrink:0"></span>' +
            '<div class="week-event-body">' +
              '<span class="skeleton skeleton-line mid" style="height:13px"></span>' +
            '</div>' +
          '</div>'
        ).join('') +
      '</div>';
  }

  function refresh() {
    showSkeleton();
    DataCache.swr('events', loadEventsFull, (events) => {
      if (events) render(events);
    });
  }

  function init() {
    window.addEventListener('portal:auth', refresh);
    window.addEventListener('portal:view', e => {
      if (/** @type {any} */ (e).detail.view === 'home') refresh();
    });
    // Слухаємо оновлення кешу подій від інших модулів
    window.addEventListener('cache:events', () => {
      const cached = /** @type {CalendarEvent[] | undefined} */ (DataCache.get('events'));
      if (cached) render(cached);
    });
  }

  return { init, render };
})();
