// ============================================================
// HOME WIDGETS — міні-віджети головної
// 1) Тизер питання дня: якщо сьогодні ще не відповів — картка,
//    тап веде на вкладку Питання дня.
// 2) Найближчий спільний вихідний (обидва «Х» у графіку),
//    тап веде на Графік.
// ============================================================

const HomeWidgets = (() => {

  /** @returns {string} */
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── Тизер питання дня ──────────────────────────────────────
  /** @returns {Promise<void>} */
  async function renderQuestionTeaser() {
    const el = document.getElementById('question-teaser');
    if (!el) return;
    try {
      const user = Auth.getCurrentUser();
      if (!user) return;

      // Ім'я поточного користувача (для вибору колонки відповіді)
      /** @type {string | undefined} */
      let name = user.name;
      if (!name && Auth.getUsers) {
        const users = await Auth.getUsers();
        const found = users.find(u => u.id === user.id);
        name = found ? found.name : undefined;
      }
      if (!name) return;

      const { data, error } = /** @type {SupaResult<Pick<DailyQuestionLog, 'answer_dima' | 'answer_lena'>>} */ (await supabase
        .from('daily_question_log')
        .select('answer_dima, answer_lena')
        .eq('date', todayStr())
        .maybeSingle());
      if (error) return;

      const answered = data
        ? !!(name === 'Діма' ? data.answer_dima : data.answer_lena)
        : false;

      if (answered) { el.classList.add('hidden'); return; }

      el.innerHTML = `<span class="mini-widget-icon">💬</span>
        <span class="mini-widget-text"><b>Питання дня</b><br>чекає на відповідь</span>`;
      el.classList.remove('hidden');
      el.onclick = () => Router.showView('question');
    } catch (e) {
      console.warn('HomeWidgets: question teaser', e);
    }
  }

  // ── Найближчий спільний вихідний ───────────────────────────
  /** @returns {Promise<void>} */
  async function renderDayoff() {
    const el = document.getElementById('dayoff-widget');
    if (!el) return;
    try {
      const users = Auth.getUsers ? await Auth.getUsers() : [];
      const ids = (users || []).map(u => u.id);
      if (ids.length < 2) return;

      const { data, error } = /** @type {SupaResult<Pick<WorkScheduleRow, 'date' | 'user_id'>[]>} */ (await supabase
        .from('work_schedule')
        .select('date,user_id')
        .eq('mark', 'Х')
        .gte('date', todayStr())
        .order('date', { ascending: true })
        .limit(300));
      if (error) return;

      /** @type {Record<string, Set<number>>} */
      const byDate = {};
      (data || []).forEach(r => (byDate[r.date] ||= new Set()).add(r.user_id));
      const shared = Object.keys(byDate)
        .filter(d => ids.every(id => byDate[d].has(id)))
        .sort()[0];

      if (!shared) { el.classList.add('hidden'); return; }

      const dt = new Date(shared + 'T00:00:00');
      const label = dt.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
      const diffDays = Math.round((dt.getTime() - new Date(todayStr() + 'T00:00:00').getTime()) / 86400000);
      const when = diffDays === 0 ? 'сьогодні! 🎉' : diffDays === 1 ? 'завтра' : `через ${diffDays} дн.`;

      el.innerHTML = `<span class="mini-widget-icon">🏖</span>
        <span class="mini-widget-text"><b>Разом ${when}</b><br>${label}</span>`;
      el.classList.remove('hidden');
      el.onclick = () => Router.showView('schedule');
    } catch (e) {
      console.warn('HomeWidgets: dayoff', e);
    }
  }

  function refresh() {
    renderQuestionTeaser();
    renderDayoff();
  }

  function init() {
    window.addEventListener('portal:auth', refresh);
    // Оновлюємо при поверненні на головну (відповідь могла з'явитись)
    window.addEventListener('portal:view', (e) => {
      const detail = /** @type {any} */ (e).detail;
      if (detail && detail.view === 'home') refresh();
    });
  }

  return { init, refresh };
})();
