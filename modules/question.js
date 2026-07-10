// ============================================================
// DAILY QUESTION MODULE
// Унікальне питання дня генерує Claude (Edge Function
// daily-question-ai): перший, хто відкрив вкладку, тригерить
// генерацію; питання пишеться в БД, тож обоє бачать те саме.
// Fallback: якщо функція недоступна — детермінований вибір
// зі старого пулу за хешем дати (як раніше).
// Кожен пише свою відповідь окремо.
// ============================================================

const DailyQuestion = (() => {

  let todayStr, questionsPool, currentQuestion, logEntry;

  function getTodayStr() {
    // Локальна дата, а не toISOString (яка дає UTC): у Києві до 02:00/03:00
    // ночі UTC-дата — ще вчорашня, і питання дня "відкочувалось" назад.
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function formatToday() {
    const d = new Date();
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ---------- Детермінований вибір питання за датою ----------
  function hashStringToInt(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function pickQuestionForDate(pool, dateStr) {
    if (!pool.length) return null;
    const idx = hashStringToInt(dateStr) % pool.length;
    return pool[idx];
  }

  // ---------- Питання дня від Claude ----------
  // Ідемпотентний виклик: функція сама створює лог-запис дня,
  // тож повторні виклики і гонка двох користувачів безпечні.
  async function fetchAiQuestion(dateStr) {
    try {
      const { data, error } = await supabase.functions.invoke('daily-question-ai', {
        body: { date: dateStr },
      });
      if (error || !data || !data.text) {
        console.warn('daily-question-ai недоступна, fallback на пул', error);
        return null;
      }
      return { id: data.id, text: data.text };
    } catch (e) {
      console.warn('daily-question-ai:', e);
      return null;
    }
  }

  // ---------- Завантаження ----------
  async function loadPool() {
    const { data, error } = await supabase
      .from('daily_questions')
      .select('id, text')
      .order('id', { ascending: true });

    if (error) {
      console.error('Помилка завантаження пулу питань:', error);
      return [];
    }
    return data || [];
  }

  async function loadLog(dateStr) {
    const { data, error } = await supabase
      .from('daily_question_log')
      .select('id, date, question_id, answer_dima, answer_lena')
      .eq('date', dateStr)
      .maybeSingle();

    if (error) {
      console.error('Помилка завантаження відповідей:', error);
      return null;
    }
    return data;
  }

  async function ensureLogEntry(dateStr, questionId) {
    // якщо запису ще немає — створюємо
    const { data, error } = await supabase
      .from('daily_question_log')
      .upsert({ date: dateStr, question_id: questionId }, { onConflict: 'date', ignoreDuplicates: true })
      .select('id, date, question_id, answer_dima, answer_lena')
      .maybeSingle();

    if (error) {
      console.error('Помилка створення запису питання дня:', error);
      return await loadLog(dateStr);
    }

    if (data) return data;
    return await loadLog(dateStr);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Рендер ----------
  function answerFieldForUser(user) {
    if (!user) return null;
    const name = user.name;
    if (name === 'Діма') return 'answer_dima';
    if (name === 'Лєна') return 'answer_lena';
    // Невідомий користувач — не показувати поле вводу
    return null;
  }

  function renderAnswers() {
    const wrap = document.getElementById('question-answers');
    if (!logEntry) {
      wrap.innerHTML = '';
      return;
    }

    const user = Auth.getCurrentUser();
    const myField = answerFieldForUser(user);

    const dimaDelete = (myField === 'answer_dima' && logEntry.answer_dima)
      ? `<button class="delete-btn" data-delete-field="answer_dima" title="Видалити відповідь">×</button>` : '';
    const lenaDelete = (myField === 'answer_lena' && logEntry.answer_lena)
      ? `<button class="delete-btn" data-delete-field="answer_lena" title="Видалити відповідь">×</button>` : '';

    wrap.innerHTML = `
      <div class="answer-block">
        ${dimaDelete}
        <p class="answer-name">Діма</p>
        ${logEntry.answer_dima
          ? `<p class="answer-text">${escapeHtml(logEntry.answer_dima)}</p>`
          : `<p class="answer-text empty">Ще не відповів</p>`}
      </div>
      <div class="answer-block">
        ${lenaDelete}
        <p class="answer-name">Лєна</p>
        ${logEntry.answer_lena
          ? `<p class="answer-text">${escapeHtml(logEntry.answer_lena)}</p>`
          : `<p class="answer-text empty">Ще не відповіла</p>`}
      </div>
    `;

    wrap.querySelectorAll('[data-delete-field]').forEach(btn => {
      btn.addEventListener('click', () => deleteAnswer(btn.dataset.deleteField));
    });
  }

  async function deleteAnswer(field) {
    if (!confirm('Видалити свою відповідь?')) return;

    const { error } = await supabase
      .from('daily_question_log')
      .update({ [field]: null })
      .eq('date', todayStr);

    if (error) {
      console.error('Помилка видалення відповіді:', error);
      alert('Не вдалось видалити відповідь');
      return;
    }

    logEntry[field] = null;
    DataCache.set(logKey(), logEntry);
    renderAnswers();
    renderInput();
  }

  function renderInput() {
    const wrap = document.getElementById('question-input-wrap');
    const user = Auth.getCurrentUser();
    const field = answerFieldForUser(user);

    if (!field) {
      wrap.classList.add('hidden');
      return;
    }

    const existing = logEntry ? logEntry[field] : null;
    document.getElementById('question-input').value = existing || '';
    wrap.classList.remove('hidden');
  }

  function logKey() { return 'question:log:' + todayStr; }

  async function refresh() {
    todayStr = getTodayStr();
    document.getElementById('question-date').textContent = formatToday();

    // Питання дня — миттєво з кешу, ревалідація у фоні
    const qKey = 'question:today:' + todayStr;
    const cached = DataCache.get ? DataCache.get(qKey) : null;
    if (cached) {
      currentQuestion = cached;
    } else {
      document.getElementById('question-text').textContent = '🔮 Клод вигадує питання…';
      currentQuestion = await fetchAiQuestion(todayStr);
      // Fallback: старий пул з детермінованим вибором за датою
      if (!currentQuestion) {
        if (!questionsPool) questionsPool = await loadPool();
        currentQuestion = pickQuestionForDate(questionsPool, todayStr);
      }
      if (currentQuestion && DataCache.set) DataCache.set(qKey, currentQuestion);
    }

    if (!currentQuestion) {
      document.getElementById('question-text').textContent = 'Не вдалось отримати питання дня.';
      document.getElementById('question-answers').innerHTML = '';
      document.getElementById('question-input-wrap').classList.add('hidden');
      return;
    }

    document.getElementById('question-text').textContent = currentQuestion.text;

    // Запис відповідей дня — миттєво з кешу, потім ревалідація
    DataCache.swr(
      logKey(),
      () => ensureLogEntry(todayStr, currentQuestion.id),
      (entry) => { logEntry = entry; renderAnswers(); renderInput(); }
    );
  }

  async function saveAnswer() {
    const user = Auth.getCurrentUser();
    const field = answerFieldForUser(user);
    if (!field || !logEntry) return;

    const text = document.getElementById('question-input').value.trim();
    if (!text) {
      alert('Напиши відповідь перед збереженням');
      return;
    }

    const { error } = await supabase
      .from('daily_question_log')
      .update({ [field]: text })
      .eq('date', todayStr);

    if (error) {
      console.error('Помилка збереження відповіді:', error);
      alert('Не вдалось зберегти відповідь');
      return;
    }

    logEntry[field] = text;
    DataCache.set(logKey(), logEntry);
    renderAnswers();
  }

  // Live-оновлення (realtime): оновлюємо відповіді, але НЕ чіпаємо поле вводу,
  // якщо користувач саме в ньому пише.
  function refreshLive() {
    if (!currentQuestion) { refresh(); return; }
    DataCache.swr(
      logKey(),
      () => ensureLogEntry(todayStr, currentQuestion.id),
      (entry) => {
        logEntry = entry;
        renderAnswers();
        const inp = document.getElementById('question-input');
        if (!inp || document.activeElement !== inp) renderInput();
      }
    );
  }

  function init() {
    document.getElementById('question-save').addEventListener('click', saveAnswer);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'question') refresh();
    });
  }

  return { init, refresh, refreshLive };
})();
