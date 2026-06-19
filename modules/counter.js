// ============================================================
// COUNTER MODULE
// Лічильник днів разом, дата береться з таблиці settings
// ============================================================

const Counter = (() => {

  async function loadStartDate() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'relationship_start_date')
      .single();

    if (error || !data) {
      console.warn('Дата старту стосунків не налаштована');
      return null;
    }
    return data.value; // очікується формат 'YYYY-MM-DD'
  }

  function formatSinceDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function daysBetween(dateStr) {
    const start = new Date(dateStr);
    const now = new Date();
    // обрізаємо до дат без часу
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffMs = now - start;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  async function renderNextEvent() {
    var widget = document.getElementById('next-event-widget');
    if (!widget) return;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayStr = today.toISOString().slice(0, 10);

    var { data, error } = await supabase
      .from('events')
      .select('title, date, description')
      .gte('date', todayStr)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      widget.innerHTML =
        '<div class="next-event-empty">📅 Найближчих подій немає</div>';
      return;
    }

    var eventDate = new Date(data.date + 'T00:00:00');
    var diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));
    var dateStr = eventDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

    var daysLabel = diffDays === 0 ? 'сьогодні! 🎉'
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

  async function renderNextAnniversary(startDate) {
    const el = document.getElementById('counter-next-anniversary');
    if (!el || !startDate) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(startDate);

    // Наступна річниця відносин (щорічно від startDate)
    let nextAnn = new Date(start);
    nextAnn.setFullYear(now.getFullYear());
    if (nextAnn <= now) nextAnn.setFullYear(now.getFullYear() + 1);

    const diffDays = Math.round((nextAnn - now) / (1000 * 60 * 60 * 24));
    const years = nextAnn.getFullYear() - start.getFullYear();

    let label;
    if (diffDays === 0) label = `🎉 Сьогодні ${years} рік разом!`;
    else if (diffDays === 1) label = `💕 Завтра ${years} рік разом`;
    else if (diffDays <= 30) label = `💕 Річниця через ${diffDays} дн. (${years} р.)`;
    else {
      const months = Math.round(diffDays / 30);
      label = `Річниця через ~${months} міс.`;
    }

    el.textContent = label;
  }

  async function render() {
    const startDate = await loadStartDate();

    const homeNumber = document.getElementById('counter-number');
    const homeSince = document.getElementById('counter-since');
    const calNumber = document.getElementById('counter-number-cal');
    const calSince = document.getElementById('counter-since-cal');

    if (!startDate) {
      [homeNumber, calNumber].forEach(el => el && (el.textContent = '?'));
      [homeSince, calSince].forEach(el => el && (el.textContent = 'дата ще не вказана'));
      return;
    }

    const days = daysBetween(startDate);
    const daysStr = days.toLocaleString('uk-UA');
    const sinceStr = `з ${formatSinceDate(startDate)}`;

    [homeNumber, calNumber].forEach(el => el && (el.textContent = daysStr));
    [homeSince, calSince].forEach(el => el && (el.textContent = sinceStr));

    renderNextEvent();
    renderNextAnniversary(startDate);
  }

  function init() {
    window.addEventListener('portal:auth', render);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'calendar' || e.detail.view === 'home') render();
    });
  }

  return { init, render };
})();
