// ============================================================
// COUNTER MODULE
// Лічильник днів разом, дата береться з таблиці settings.
// Дата старту практично незмінна → кешуємо (DataCache + localStorage),
// тому лічильник показується МИТТЄВО, без очікування мережі.
// Найближча подія береться зі спільного кешу 'events' (без окремого запиту).
// ============================================================

const Counter = (() => {

  const START_LS = 'amore:startDate';

  // Канонічний завантажувач подій — ТОЙ САМИЙ select, що в calendar.js,
  // щоб обидва модулі ділили один кеш-ключ 'events' без розбіжностей.
  async function loadEventsFull() {
    const { data } = await supabase.from('events')
      .select('id,title,description,date,created_by,type,yearly')
      .order('date', { ascending: true });
    return data || [];
  }

  async function fetchStartDate() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'relationship_start_date')
      .single();
    if (error || !data) { console.warn('Дата старту стосунків не налаштована'); return null; }
    return data.value; // 'YYYY-MM-DD'
  }

  function formatSinceDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function daysBetween(dateStr) {
    const start = new Date(dateStr);
    const now = new Date();
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Малює числа лічильника (на головній і в календарі)
  function paintCounter(startDate) {
    const homeNumber = document.getElementById('counter-number');
    const homeSince  = document.getElementById('counter-since');
    const calNumber  = document.getElementById('counter-number-cal');
    const calSince   = document.getElementById('counter-since-cal');

    if (!startDate) {
      [homeNumber, calNumber].forEach(el => el && (el.textContent = '?'));
      [homeSince, calSince].forEach(el => el && (el.textContent = 'дата ще не вказана'));
      return;
    }
    const daysStr  = daysBetween(startDate).toLocaleString('uk-UA');
    const sinceStr = `з ${formatSinceDate(startDate)}`;
    [homeNumber, calNumber].forEach(el => el && (el.textContent = daysStr));
    [homeSince, calSince].forEach(el => el && (el.textContent = sinceStr));
  }

  function renderNextEvent(events) {
    const widget = document.getElementById('next-event-widget');
    if (!widget) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // Найближча подія з датою >= сьогодні (events вже відсортовані за датою)
    const data = (events || []).find(e => e.date >= todayStr);

    if (!data) {
      widget.innerHTML = '<div class="next-event-empty">📅 Найближчих подій немає</div>';
      return;
    }

    const eventDate = new Date(data.date + 'T00:00:00');
    const diffDays  = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));
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

  function renderNextAnniversary(startDate) {
    const el = document.getElementById('counter-next-anniversary');
    if (!el || !startDate) return;

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const start = new Date(startDate);

    let nextAnn = new Date(start);
    nextAnn.setFullYear(now.getFullYear());
    if (nextAnn <= now) nextAnn.setFullYear(now.getFullYear() + 1);

    const diffDays = Math.round((nextAnn - now) / (1000 * 60 * 60 * 24));
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
      if (e.detail.view === 'calendar' || e.detail.view === 'home') render();
    });
  }

  return { init, render };
})();
