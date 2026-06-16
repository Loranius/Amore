// ============================================================
// AUTH MODULE
// Вибір користувача + PIN-код, зберігання сесії в localStorage
// ============================================================

const Auth = (() => {
  let users = [];          // [{id, name, pin_hash}]
  let selectedUser = null;
  let pinBuffer = '';

  const SESSION_KEY = 'portal_session_user_id';

  // ---------- Завантаження користувачів з Supabase ----------
  async function loadUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, pin_hash')
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
    pinBuffer = '';
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
      // повернутись до вибору користувача
      selectedUser = null;
      pinBuffer = '';
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
    // Простий хеш для порівняння (узгоджено з тим, як зберігається pin_hash)
    const hash = await sha256(pinBuffer);

    if (hash === selectedUser.pin_hash) {
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

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- Перехід в апку ----------
  function enterApp(user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    window.dispatchEvent(new CustomEvent('portal:auth', { detail: { user } }));
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  // ---------- Авто-логін за збереженою сесією ----------
  async function tryAutoLogin() {
    const savedId = localStorage.getItem(SESSION_KEY);
    if (!savedId) return false;

    const { data, error } = await supabase
      .from('users')
      .select('id, name, pin_hash')
      .eq('id', savedId)
      .single();

    if (error || !data) return false;

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

    tryAutoLogin().then(loggedIn => {
      if (!loggedIn) loadUsers();
    });
  }

  function getCurrentUser() {
    return selectedUser;
  }

  return { init, getCurrentUser, _getUsers: () => users };
})();
