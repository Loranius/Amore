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
  }

  function init() {
    window.addEventListener('portal:auth', render);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'calendar' || e.detail.view === 'home') render();
    });
  }

  return { init, render };
})();
