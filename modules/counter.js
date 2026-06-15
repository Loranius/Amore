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
    const numberEl = document.getElementById('counter-number');
    const sinceEl = document.getElementById('counter-since');

    const startDate = await loadStartDate();

    if (!startDate) {
      numberEl.textContent = '?';
      sinceEl.textContent = 'дата ще не вказана';
      return;
    }

    const days = daysBetween(startDate);
    numberEl.textContent = days.toLocaleString('uk-UA');
    sinceEl.textContent = `з ${formatSinceDate(startDate)}`;
  }

  function init() {
    window.addEventListener('portal:auth', render);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'counter') render();
    });
  }

  return { init, render };
})();
