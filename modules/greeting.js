// ============================================================
// GREETING MODULE
// Рандомна тепла фраза з ім'ям користувача на головній
// ============================================================

const Greeting = (() => {

  const PHRASES = [
    name => `Привіт, ${name}! 💛`,
    name => `Раді тебе бачити, ${name}`,
    name => `${name}, як справи? 🌸`,
    name => `Вітаємо, ${name}!`,
    name => `${name}, гарного дня!`,
    name => `Знову ти, ${name}? Чудово!`,
    name => `${name}, тут затишно і тепло`,
    name => `Привіт-привіт, ${name} 🌷`,
    name => `${name}, ми на тебе чекали`,
    name => `Раді бачити тебе тут, ${name}`
  ];

  function render() {
    const user = Auth.getCurrentUser();
    const el = document.getElementById('greeting-text');
    if (!el) return;

    const name = user ? user.name : 'друже';
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    el.textContent = phrase(name);
  }

  function init() {
    window.addEventListener('portal:auth', render);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'home') render();
    });
  }

  return { init, render };
})();
