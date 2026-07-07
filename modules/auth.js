// ============================================================
// AUTH MODULE
// Вибір користувача + PIN-код + тихий Supabase Auth
// ============================================================

const Auth = (() => {
  let users        = [];   // [{id, name, pin_hash, email}]
  let selectedUser = null;
  let pinBuffer    = '';

  const SESSION_KEY = 'portal_session_user_id';

  // ---------- Завантаження користувачів з Supabase ----------
  async function loadUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, pin_hash, email')
      .order('id', { ascending: true });

    if (error) {
      console.error('Помилка завантаження користувачів:', error);
      renderError('Не вдалось завантажити користувачів. Перевір налаштування Supabase.');
      return;
    }
    users = data || [];
    renderUserSelect();
  }

  function renderError(msg) {
    const wrap = document.getElementById('user-select');
    wrap.innerHTML = `<p class="empty-state">${msg}</p>`;
  }

  // ---------- Екран вибору користувача ----------
  function renderUserSelect() {
    const wrap = document.getElementById('user-select');
    wrap.innerHTML = '';
    users.forEach(u => {
      const btn = document.createElement('button');
      btn.className = 'user-btn';
      btn.textContent = u.name;
      btn.addEventListener('click', () => selectUser(u));
      wrap.appendChild(btn);
    });
  }

  function selectUser(user) {
    selectedUser = user;
    pinBuffer    = '';
    document.getElementById('user-select').classList.add('hidden');
    document.getElementById('pin-pad').classList.remove('hidden');
    document.getElementById('pin-name').textContent = user.name;
    document.getElementById('pin-error').classList.add('hidden');
    updatePinDots();
  }

  // ---------- PIN-pad ----------
  function updatePinDots(state) {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.remove('filled', 'error');
      if (i < pinBuffer.length) {
        dot.classList.add(state === 'error' ? 'error' : 'filled');
      }
    });
  }

  async function handlePinKey(key) {
    if (key === 'clear') {
      pinBuffer = '';
      document.getElementById('pin-error').classList.add('hidden');
      updatePinDots();
      return;
    }
    if (key === 'back') {
      selectedUser = null;
      pinBuffer    = '';
      document.getElementById('pin-pad').classList.add('hidden');
      document.getElementById('user-select').classList.remove('hidden');
      return;
    }
    if (pinBuffer.length >= 8) return;

    pinBuffer += key;
    updatePinDots();

    if (pinBuffer.length === 8) {
      await verifyPin();
    }
  }

  async function verifyPin() {
    const hash = await sha256(pinBuffer);

    if (hash === selectedUser.pin_hash) {
      // Тихий логін у Supabase Auth (для RLS)
      await signInSupabase(selectedUser.email, hash);
      localStorage.setItem(SESSION_KEY, selectedUser.id);
      enterApp(selectedUser);
    } else {
      document.getElementById('pin-error').classList.remove('hidden');
      updatePinDots('error');
      setTimeout(() => {
        pinBuffer = '';
        document.getElementById('pin-error').classList.add('hidden');
        updatePinDots();
      }, 600);
    }
  }

  // ---------- Supabase Auth (тихо, юзер не бачить) ----------
  async function signInSupabase(email, password) {
    if (!email) return; // email ще не налаштований — пропускаємо
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.warn('Supabase Auth login failed (RLS буде недоступний):', error.message);
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- Перехід в апку ----------
  function enterApp(user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    hideBootLoader();
    window.dispatchEvent(new CustomEvent('portal:auth', { detail: { user } }));
  }

  function hideBootLoader() {
    const loader = document.getElementById('boot-loader');
    if (loader) loader.classList.add('hidden');
  }

  function logout() {
    supabase.auth.signOut().catch(() => {}); // розлогіниться з Supabase Auth
    localStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  // ---------- Авто-логін за збереженою сесією ----------
  async function tryAutoLogin() {
    const savedId = localStorage.getItem(SESSION_KEY);
    if (!savedId) return false;

    // Перевіряємо чи Supabase-сесія ще жива
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Сесія витекла або ще не була — треба перелогінитись через PIN
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    // Сесія жива — відновлюємо UI-стан без повторного PIN
    const { data, error } = await supabase
      .from('users')
      .select('id, name, pin_hash, email')
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
  function init() {
    document.getElementById('logout-btn').addEventListener('click', logout);

    document.querySelectorAll('.pin-key').forEach(btn => {
      btn.addEventListener('click', () => handlePinKey(btn.dataset.key));
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

  function getCurrentUser() {
    return selectedUser;
  }

  // Спільний кешований список користувачів (id, name).
  // Використовується іншими модулями замість власних запитів до 'users'.
  async function getUsers() {
    return DataCache.ensure('users', async () => {
      const { data } = await supabase
        .from('users').select('id, name').order('id', { ascending: true });
      return data || [];
    });
  }

  return { init, getCurrentUser, getUsers, _getUsers: () => users };
})();
