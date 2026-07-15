// ============================================================
// CONFETTI — святкова анімація частинок
// Використання: Confetti.burst() — вистрілює 60 частинок
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
// ============================================================
const Confetti = (() => {
  const COLORS = [
    '#FF6B9D','#E8829C','#C45B79','#FFB3C8',
    '#FFD700','#FF85A1','#FFC0CB','#F9A8D4',
    '#A8D8EA','#FFE066',
  ];

  /** @param {number} min @param {number} max @returns {number} */
  function rand(min, max) { return Math.random() * (max - min) + min; }
  /** @template T @param {T[]} arr @returns {T} */
  function pick(arr)       { return arr[Math.floor(Math.random() * arr.length)]; }

  /** @returns {HTMLDivElement} */
  function createPiece() {
    const el = document.createElement('div');
    el.className = 'confetti-piece';

    const size   = rand(6, 13);
    const left   = rand(5, 95);
    const dur    = rand(1.4, 2.4);
    const delay  = rand(0, 0.5);
    const swayDur= rand(0.7, 1.5);
    const color  = pick(COLORS);
    const isRect = Math.random() > 0.4;

    el.style.cssText = `
      left: ${left}%;
      width: ${size}px;
      height: ${isRect ? size * 0.55 : size}px;
      background: ${color};
      border-radius: ${isRect ? '2px' : '50%'};
      --fall-dur: ${dur}s;
      --fall-delay: ${delay}s;
      --sway-dur: ${swayDur}s;
    `;

    return el;
  }

  /** @param {number} [count] @returns {void} */
  function burst(count = 60) {
    /** @type {HTMLDivElement[]} */
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const p = createPiece();
      document.body.appendChild(p);
      pieces.push(p);
    }
    // Прибираємо після завершення анімації
    setTimeout(() => pieces.forEach(p => p.remove()), 3200);
  }

  return { burst };
})();

// window.X = X — стандартний спосіб публікувати глобаль у цьому проєкті
// (немає модулів). Той самий "немає білду" виняток, що й для DataCache/Retry.
/** @type {any} */ (window).Confetti = Confetti;
