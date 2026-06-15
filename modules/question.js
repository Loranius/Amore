// ============================================================
// DAILY QUESTION MODULE
// Випадкове питання на день з пулу (детермінований вибір
// за датою, щоб обоє бачили те саме питання)
// Кожен пише свою відповідь окремо
// ============================================================

const DailyQuestion = (() => {

  let todayStr, questionsPool, currentQuestion, logEntry;

  function getTodayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
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
    // ім'я "Діма" -> answer_dima, "Лєна" -> answer_lena
    if (!user) return null;
    const name = user.name.toLowerCase();
    if (name.startsWith('д')) return 'answer_dima';
    return 'answer_lena';
  }

  function renderAnswers() {
    const wrap = document.getElementById('question-answers');
    if (!logEntry) {
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <div class="answer-block">
        <p class="answer-name">Діма</p>
        ${logEntry.answer_dima
          ? `<p class="answer-text">${escapeHtml(logEntry.answer_dima)}</p>`
          : `<p class="answer-text empty">Ще не відповів</p>`}
      </div>
      <div class="answer-block">
        <p class="answer-name">Лєна</p>
        ${logEntry.answer_lena
          ? `<p class="answer-text">${escapeHtml(logEntry.answer_lena)}</p>`
          : `<p class="answer-text empty">Ще не відповіла</p>`}
      </div>
    `;
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

  async function refresh() {
    todayStr = getTodayStr();
    document.getElementById('question-date').textContent = formatToday();

    if (!questionsPool) {
      questionsPool = await loadPool();
    }

    if (!questionsPool.length) {
      document.getElementById('question-text').textContent = 'Пул питань поки порожній.';
      document.getElementById('question-answers').innerHTML = '';
      document.getElementById('question-input-wrap').classList.add('hidden');
      return;
    }

    currentQuestion = pickQuestionForDate(questionsPool, todayStr);
    document.getElementById('question-text').textContent = currentQuestion.text;

    logEntry = await ensureLogEntry(todayStr, currentQuestion.id);

    renderAnswers();
    renderInput();
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
    renderAnswers();
  }

  function init() {
    document.getElementById('question-save').addEventListener('click', saveAnswer);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'question') refresh();
    });
  }

  return { init, refresh };
})();
