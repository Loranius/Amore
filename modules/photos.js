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
    `${STORAGE_BASE}/photo12.jpg`,
    `${STORAGE_BASE}/photo13.jpg`,
    `${STORAGE_BASE}/photo14.jpg`,
    `${STORAGE_BASE}/photo15.jpg`,
    `${STORAGE_BASE}/photo16.jpg`,
    `${STORAGE_BASE}/photo17.jpg`,
    `${STORAGE_BASE}/photo18.jpg`,
    `${STORAGE_BASE}/photo19.jpg`,
    `${STORAGE_BASE}/photo20.jpg`,
    `${STORAGE_BASE}/photo21.jpg`,
    `${STORAGE_BASE}/photo22.jpg`,
    `${STORAGE_BASE}/photo23.jpg`,
    `${STORAGE_BASE}/photo24.jpg`,
    `${STORAGE_BASE}/photo25.jpg`,
    `${STORAGE_BASE}/photo26.jpg`,
    `${STORAGE_BASE}/photo27.jpg`,
    `${STORAGE_BASE}/photo28.jpg`,
    `${STORAGE_BASE}/photo29.jpg`,
    `${STORAGE_BASE}/photo30.jpg`,
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

  // Preload масиву URL — повертає Promise що резолвиться коли всі завантажились
  function preloadImages(urls) {
    return Promise.all(urls.map(url => new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = resolve; // resolve навіть при помилці
      img.src = url;
    })));
  }

  function render() {
    const images = document.querySelectorAll('.polaroid-photo img[data-photo-slot]');
    const polaroids = document.querySelectorAll('.polaroid');
    if (!images.length) return;

    const needed = images.length;
    let pool = PHOTO_POOL;
    let picks;
    if (pool.length >= needed) {
      picks = shuffle(pool).slice(0, needed);
    } else {
      picks = shuffle(pool);
      while (picks.length < needed) picks = picks.concat(shuffle(pool));
      picks = picks.slice(0, needed);
    }

    const STAGGER = 60;    // ms між картками
    const FADE_OUT = 220;  // ms зникнення
    const FADE_IN = 350;   // ms появи (повільніше = плавніше)

    // 1. Починаємо preload одразу — паралельно з анімацією виходу
    const preloadPromise = preloadImages(picks);

    // 2. Staggered fade OUT + легке зменшення
    polaroids.forEach((p, i) => {
      setTimeout(() => {
        p.style.transition = `opacity ${FADE_OUT}ms ease, transform ${FADE_OUT}ms ease`;
        p.style.opacity = '0';
        p.style.transform = (p.style.transform || '') + ' scale(0.93)';
      }, i * STAGGER);
    });

    const totalOut = FADE_OUT + (polaroids.length - 1) * STAGGER + 40;

    // 3. Після зникнення — чекаємо preload (якщо ще не готовий) і міняємо src
    setTimeout(() => {
      preloadPromise.then(() => {
        // Міняємо src поки картки невидимі — без кліпання
        images.forEach((img, i) => {
          img.style.transition = 'none';
          img.src = picks[i];
        });

        // 4. Staggered fade IN з пружним easing
        polaroids.forEach((p, i) => {
          setTimeout(() => {
            p.style.transition = `opacity ${FADE_IN}ms ease, transform ${FADE_IN}ms cubic-bezier(.34,1.35,.64,1)`;
            p.style.opacity = '1';
            p.style.transform = ''; // повертає CSS nth-child rotation
          }, i * STAGGER);
        });
      });
    }, totalOut);
  }

  function init() {
    window.addEventListener('portal:auth', render);
  }

  return { init, render };
})();
