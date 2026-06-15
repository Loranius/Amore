// ============================================================
// PHOTOS MODULE
// Пул фото для головної сторінки (полароїд-стіна).
// При кожному вході обирається 7 випадкових без повторів
// і розкидається по картках.
// ============================================================

const Photos = (() => {

  // ---------- Пул фото ----------
  // Додай сюди посилання на свої фото (Supabase Storage,
  // або будь-який публічний URL). Мінімум 7 штук для
  // повної відсутності повторів — більше фото = більше
  // варіативності між заходами.
  const STORAGE_BASE = 'https://yicalgoqegluzuagxssk.supabase.co/storage/v1/object/public/family_photos';

  const PHOTO_POOL = [
    `${STORAGE_BASE}/photo1.jpg`,
    `${STORAGE_BASE}/photo2.jpg`,
    `${STORAGE_BASE}/photo3.jpg`,
    `${STORAGE_BASE}/photo4.jpg`,
    `${STORAGE_BASE}/photo5.jpg`,
    `${STORAGE_BASE}/photo6.jpg`,
    `${STORAGE_BASE}/photo7.jpg`,
    `${STORAGE_BASE}/photo8.jpg`,
    `${STORAGE_BASE}/photo9.jpg`,
    `${STORAGE_BASE}/photo10.jpg`,
    `${STORAGE_BASE}/photo11.jpg`,
  ];

  // ---------- Перемішування (Fisher-Yates) ----------
  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function render() {
    const images = document.querySelectorAll('.polaroid-photo img[data-photo-slot]');
    if (!images.length) return;

    const needed = images.length;
    let pool = PHOTO_POOL;

    // якщо в пулі менше фото, ніж карток — дозволяємо повтори,
    // але все одно перемішуємо порядок
    let picks;
    if (pool.length >= needed) {
      picks = shuffle(pool).slice(0, needed);
    } else {
      picks = shuffle(pool);
      while (picks.length < needed) {
        picks = picks.concat(shuffle(pool));
      }
      picks = picks.slice(0, needed);
    }

    images.forEach((img, i) => {
      img.src = picks[i];
    });
  }

  function init() {
    window.addEventListener('portal:auth', render);
  }

  return { init, render };
})();
