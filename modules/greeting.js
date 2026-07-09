// ============================================================
// GREETING MODULE
// Рандомна тепла фраза з ім'ям користувача на головній
// ============================================================

const Greeting = (() => {

  // Спільні фрази + персональні для кожного
  const COMMON = [
    'Хай, бубос 💛',
    'Привіт, пупс 🌸',
    'Шо ти там, крошка? 😏',
  ];

  const PERSONAL = {
    'Лєна': [
      'Привіт, Лєнок 🌷',
      'Привіт, Лєнусік 💕',
      'Привіт, Лєнчик ✨',
    ],
    'Діма': [
      'Як справи, Дімасік? 😎',
      'Привіт, Дімонич 🤙',
    ],
  };

  function render() {
    const user = Auth.getCurrentUser();
    const el = document.getElementById('greeting-text');
    if (!el) return;

    const pool = [...COMMON, ...(PERSONAL[user ? user.name : ''] || [])];
    el.textContent = pool[Math.floor(Math.random() * pool.length)];
  }

  function init() {
    window.addEventListener('portal:auth', render);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'home') render();
    });
  }

  return { init, render };
})();
