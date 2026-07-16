// ============================================================
// DAILY QUESTION MODULE
// Унікальне питання дня генерує Claude (Edge Function
// daily-question-ai): перший, хто відкрив вкладку, тригерить
// генерацію; питання пишеться в БД, тож обоє бачать те саме.
// Fallback: якщо функція недоступна — детермінований вибір
// зі старого пулу за хешем дати (як раніше).
// Кожен пише свою відповідь окремо.
// ============================================================


import { supabase } from '../lib/supabase.js';
import { DataCache } from '../lib/cache.js';
import { Auth } from './auth.js';

/**
 * Елемент гарантовано присутній — рендериться лише коли активна
 * вкладка "Питання дня".
 * @param {string} id @returns {HTMLElement}
 */
const el = id => /** @type {HTMLElement} */ (document.getElementById(id));

/** @type {string} */
let todayStr;
/** @type {QuestionPoolItem[] | undefined} */
let questionsPool;
/** @type {QuestionPoolItem | null | undefined} */
let currentQuestion;
/** @type {DailyQuestionLog | null | undefined} */
let logEntry;

/** @returns {string} */
function getTodayStr() {
  // Локальна дата, а не toISOString (яка дає UTC): у Києві до 02:00/03:00
  // ночі UTC-дата — ще вчорашня, і питання дня "відкочувалось" назад.
  const d = new Date();
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** @returns {string} */
function formatToday() {
  const d = new Date();
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------- Детермінований вибір питання за датою ----------
/** @param {string} str @returns {number} */
function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** @param {QuestionPoolItem[]} pool @param {string} dateStr @returns {QuestionPoolItem | null} */
function pickQuestionForDate(pool, dateStr) {
  if (!pool.length) return null;
  const idx = hashStringToInt(dateStr) % pool.length;
  return pool[idx];
}

// ---------- Питання дня від Claude ----------
// Ідемпотентний виклик: функція сама створює лог-запис дня,
// тож повторні виклики і гонка двох користувачів безпечні.
/** @param {string} dateStr @returns {Promise<QuestionPoolItem | null>} */
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
/** @returns {Promise<QuestionPoolItem[]>} */
async function loadPool() {
  const { data, error } = /** @type {SupaResult<QuestionPoolItem[]>} */ (await supabase
    .from('daily_questions')
    .select('id, text')
    .order('id', { ascending: true }));

  if (error) {
    console.error('Помилка завантаження пулу питань:', error);
    return [];
  }
  return data || [];
}

/** @param {string} dateStr @returns {Promise<DailyQuestionLog | null>} */
async function loadLog(dateStr) {
  const { data, error } = /** @type {SupaResult<DailyQuestionLog>} */ (await supabase
    .from('daily_question_log')
    .select('id, date, question_id, answer_dima, answer_lena')
    .eq('date', dateStr)
    .maybeSingle());

  if (error) {
    console.error('Помилка завантаження відповідей:', error);
    return null;
  }
  return data;
}

/** @param {string} dateStr @param {number} questionId @returns {Promise<DailyQuestionLog | null>} */
async function ensureLogEntry(dateStr, questionId) {
  // якщо запису ще немає — створюємо
  const { data, error } = /** @type {SupaResult<DailyQuestionLog>} */ (await supabase
    .from('daily_question_log')
    .upsert({ date: dateStr, question_id: questionId }, { onConflict: 'date', ignoreDuplicates: true })
    .select('id, date, question_id, answer_dima, answer_lena')
    .maybeSingle());

  if (error) {
    console.error('Помилка створення запису питання дня:', error);
    return await loadLog(dateStr);
  }

  if (data) return data;
  return await loadLog(dateStr);
}

/** @param {string} str @returns {string} */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------- Рендер ----------
/** @param {AppUser | null} user @returns {AnswerField | null} */
function answerFieldForUser(user) {
  if (!user) return null;
  const name = user.name;
  if (name === 'Діма') return 'answer_dima';
  if (name === 'Лєна') return 'answer_lena';
  // Невідомий користувач — не показувати поле вводу
  return null;
}

function renderAnswers() {
  const wrap = el('question-answers');
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
    const field = /** @type {HTMLElement} */ (btn).dataset.deleteField;
    // Саме обробник кліку, а НЕ прямий виклик: раніше deleteAnswer
    // спрацьовував одразу при рендері й показував confirm без кліку.
    if (field) btn.addEventListener('click', () => deleteAnswer(/** @type {AnswerField} */ (field)));
  });
}

/** @param {AnswerField} field @returns {Promise<void>} */
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

  if (logEntry) logEntry[field] = null;
  DataCache.set(logKey(), logEntry);
  renderAnswers();
  renderInput();
}

function renderInput() {
  const wrap = el('question-input-wrap');
  const user = Auth.getCurrentUser();
  const field = answerFieldForUser(user);

  if (!field) {
    wrap.classList.add('hidden');
    return;
  }

  const existing = logEntry ? logEntry[field] : null;
  /** @type {HTMLInputElement} */ (el('question-input')).value = existing || '';
  wrap.classList.remove('hidden');
}

/** @returns {string} */
function logKey() { return 'question:log:' + todayStr; }

/** @returns {Promise<void>} */
async function refresh() {
  todayStr = getTodayStr();
  el('question-date').textContent = formatToday();

  // Питання дня — миттєво з кешу, ревалідація у фоні
  const qKey = 'question:today:' + todayStr;
  const cached = /** @type {QuestionPoolItem | null} */ (DataCache.get ? DataCache.get(qKey) : null);
  if (cached) {
    currentQuestion = cached;
  } else {
    el('question-text').textContent = '🔮 Клод вигадує питання…';
    currentQuestion = await fetchAiQuestion(todayStr);
    // Fallback: старий пул з детермінованим вибором за датою
    if (!currentQuestion) {
      if (!questionsPool) questionsPool = await loadPool();
      currentQuestion = pickQuestionForDate(questionsPool, todayStr);
    }
    if (currentQuestion && DataCache.set) DataCache.set(qKey, currentQuestion);
  }

  if (!currentQuestion) {
    el('question-text').textContent = 'Не вдалось отримати питання дня.';
    el('question-answers').innerHTML = '';
    el('question-input-wrap').classList.add('hidden');
    return;
  }

  el('question-text').textContent = currentQuestion.text;
  const question = currentQuestion;

  // Запис відповідей дня — миттєво з кешу, потім ревалідація
  DataCache.swr(
    logKey(),
    () => ensureLogEntry(todayStr, question.id),
    (entry) => { logEntry = entry; renderAnswers(); renderInput(); }
  );
}

/** @returns {Promise<void>} */
async function saveAnswer() {
  const user = Auth.getCurrentUser();
  const field = answerFieldForUser(user);
  if (!field || !logEntry) return;

  const text = /** @type {HTMLInputElement} */ (el('question-input')).value.trim();
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
  const question = currentQuestion;
  DataCache.swr(
    logKey(),
    () => ensureLogEntry(todayStr, question.id),
    (entry) => {
      logEntry = entry;
      renderAnswers();
      const inp = document.getElementById('question-input');
      if (!inp || document.activeElement !== inp) renderInput();
    }
  );
}

function init() {
  el('question-save').addEventListener('click', saveAnswer);
  window.addEventListener('portal:view', (e) => {
    if (/** @type {any} */ (e).detail.view === 'question') refresh();
  });
}

export const DailyQuestion = { init, refresh, refreshLive };
