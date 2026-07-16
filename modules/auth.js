// ============================================================
// AUTH MODULE
// Вибір користувача + PIN-код + тихий Supabase Auth
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
// ============================================================

import { supabase } from '../lib/supabase.js';
import { DataCache } from '../lib/cache.js';

/** @type {AppUser[]} */
let users        = [];
/** @type {AppUser | null} */
let selectedUser = null;
let pinBuffer    = '';

const SESSION_KEY = 'portal_session_user_id';
const DEFAULT_PIN_ERROR = 'Невірний PIN, спробуй ще';

// Статичні елементи auth-екрану (#auth-screen) — частина розмітки
// index.html, присутні в DOM від першого рендеру, тому тут доречно
// саме асертувати не-null, а не проносити | null по всьому файлу.
/** @param {string} id @returns {HTMLElement} */
const el = id => /** @type {HTMLElement} */ (document.getElementById(id));

// ---------- Завантаження користувачів з Supabase ----------
/** @returns {Promise<void>} */
async function loadUsers() {
  /** @type {SupaResult<AppUser[]>} */
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .order('id', { ascending: true });

  if (error) {
    console.error('Помилка завантаження користувачів:', error);
    renderError('Не вдалось завантажити користувачів. Перевір налаштування Supabase.');
    return;
  }
  users = data || [];
  renderUserSelect();
}

/** @param {string} msg @returns {void} */
function renderError(msg) {
  el('user-select').innerHTML = `<p class="empty-state">${msg}</p>`;
}

// ---------- Екран вибору користувача ----------
/** @returns {void} */
function renderUserSelect() {
  const wrap = el('user-select');
  wrap.innerHTML = '';
  users.forEach(u => {
    const btn = document.createElement('button');
    btn.className = 'user-btn';
    btn.textContent = u.name;
    btn.addEventListener('click', () => selectUser(u));
    wrap.appendChild(btn);
  });
}

/** @param {AppUser} user @returns {void} */
function selectUser(user) {
  selectedUser = user;
  pinBuffer    = '';
  el('user-select').classList.add('hidden');
  el('pin-pad').classList.remove('hidden');
  el('pin-name').textContent = user.name;
  el('pin-error').classList.add('hidden');
  updatePinDots();
}

// ---------- PIN-pad ----------
/** @param {'error'} [state] @returns {void} */
function updatePinDots(state) {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('filled', 'error');
    if (i < pinBuffer.length) {
      dot.classList.add(state === 'error' ? 'error' : 'filled');
    }
  });
}

/** @param {string} key @returns {Promise<void>} */
async function handlePinKey(key) {
  if (key === 'clear') {
    pinBuffer = '';
    el('pin-error').classList.add('hidden');
    updatePinDots();
    return;
  }
  if (key === 'back') {
    selectedUser = null;
    pinBuffer    = '';
    el('pin-pad').classList.add('hidden');
    el('user-select').classList.remove('hidden');
    return;
  }
  if (pinBuffer.length >= 8) return;

  pinBuffer += key;
  updatePinDots();

  if (pinBuffer.length === 8) {
    await verifyPin();
  }
}

// PIN звіряється на сервері (Edge Function auth-pin) — клієнт більше не
// бачить pin_hash жодного користувача (revoke select у Supabase),
// тому офлайн-перебір PIN з devtools більше неможливий. Функція також
// рахує невдалі спроби і блокує на 15хв після 5 підряд помилок.
/** @returns {Promise<void>} */
/**
 * Реальний контракт Edge Function auth-pin (supabase/functions/auth-pin) —
 * дискримінована унія за `ok`, а не набір опціональних полів. Так TS сам
 * звужує data.email/data.password до обов'язкових рівно в тій гілці,
 * де auth-pin їх дійсно повертає (ok:true), і не дає прочитати .error
 * там, де відповідь могла бути успішною.
 * @typedef {{ ok: true, email: string, password: string }
 *   | { ok?: false, error: 'invalid' | 'locked' | 'bad_request' | 'server_error', retryAfterSeconds?: number }} AuthPinResponse
 */

/** @returns {Promise<void>} */
async function verifyPin() {
  // Без обраного користувача перевіряти нема що — теоретично можливо
  // лише якщо клік по .pin-key якось пройшов повз приховану pin-pad
  // (у нормальному UI-потоці selectedUser тут завжди заданий).
  if (!selectedUser) return;
  const user = selectedUser;

  const pin = pinBuffer;
  /** @type {{ data: AuthPinResponse | null, error: SupaError | null }} */
  const { data, error } = await supabase.functions.invoke('auth-pin', {
    body: { user_id: user.id, pin },
  });

  if (!error && data && data.ok) {
    await signInSupabase(data.email, data.password);
    localStorage.setItem(SESSION_KEY, String(user.id));
    enterApp(user);
    return;
  }

  const errCode = data && !data.ok ? data.error : undefined;
  const errEl = el('pin-error');
  if (errCode === 'locked') {
    const mins = Math.max(1, Math.ceil(((data && !data.ok && data.retryAfterSeconds) || 900) / 60));
    errEl.textContent = `Забагато спроб, спробуй через ${mins} хв`;
  } else {
    errEl.textContent = DEFAULT_PIN_ERROR;
  }
  errEl.classList.remove('hidden');
  updatePinDots('error');
  setTimeout(() => {
    pinBuffer = '';
    errEl.classList.add('hidden');
    errEl.textContent = DEFAULT_PIN_ERROR;
    updatePinDots();
  }, errCode === 'locked' ? 2000 : 600);
}

// ---------- Supabase Auth (тихо, юзер не бачить) ----------
/**
 * @param {string | null | undefined} email
 * @param {string} password
 * @returns {Promise<void>}
 */
async function signInSupabase(email, password) {
  if (!email) return; // email ще не налаштований — пропускаємо
  /** @type {{ error: SupaError | null }} */
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) console.warn('Supabase Auth login failed (RLS буде недоступний):', error.message);
}

// ---------- Перехід в апку ----------
/** @param {AppUser} user @returns {void} */
function enterApp(user) {
  el('auth-screen').classList.add('hidden');
  el('app').classList.remove('hidden');
  hideBootLoader();
  window.dispatchEvent(new CustomEvent('portal:auth', { detail: { user } }));
}

/** @returns {void} */
function hideBootLoader() {
  const loader = document.getElementById('boot-loader');
  if (loader) loader.classList.add('hidden');
}

/** @returns {void} */
function logout() {
  supabase.auth.signOut().catch(() => {}); // розлогіниться з Supabase Auth
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

// ---------- Авто-логін за збереженою сесією ----------
/** @returns {Promise<boolean>} */
async function tryAutoLogin() {
  const savedId = localStorage.getItem(SESSION_KEY);
  if (!savedId) return false;

  // Перевіряємо чи Supabase-сесія ще жива. Реальна форма відповіді
  // Supabase Auth (не наш SupaResult) — нам важлива лише наявність
  // сесії, тому session типізовано як unknown, без вигаданих полів.
  /** @type {{ data: { session: unknown } }} */
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // Сесія витекла або ще не була — треба перелогінитись через PIN
    localStorage.removeItem(SESSION_KEY);
    return false;
  }

  // Сесія жива — відновлюємо UI-стан без повторного PIN
  /** @type {SupaResult<AppUser>} */
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', savedId)
    .single();

  if (error || !data) {
    localStorage.removeItem(SESSION_KEY);
    return false;
  }

  selectedUser = data;
  enterApp(data);
  return true;
}

// ---------- Init ----------
/** @returns {void} */
function init() {
  el('logout-btn').addEventListener('click', logout);

  document.querySelectorAll('.pin-key').forEach(btn => {
    const key = /** @type {HTMLElement} */ (btn).dataset.key;
    btn.addEventListener('click', () => { if (key) handlePinKey(key); });
  });

  tryAutoLogin().then(async loggedIn => {
    if (!loggedIn) {
      await loadUsers();
      hideBootLoader();
    }
  }).catch(err => {
    // Мережева помилка чи збій Supabase під час автологіну —
    // не даємо завантажувачу зависнути назавжди.
    console.error('Auth: tryAutoLogin впав з помилкою', err);
    loadUsers().finally(hideBootLoader);
  });
}

/** @returns {AppUser | null} */
function getCurrentUser() {
  return selectedUser;
}

// Спільний кешований список користувачів (id, name).
// Використовується іншими модулями замість власних запитів до 'users'.
/** @returns {Promise<AppUser[]>} */
async function getUsers() {
  return DataCache.ensure('users', async () => {
    /** @type {SupaResult<AppUser[]>} */
    const { data } = await supabase
      .from('users').select('id, name').order('id', { ascending: true });
    return data || [];
  });
}

export const Auth = { init, getCurrentUser, getUsers, _getUsers: () => users };
