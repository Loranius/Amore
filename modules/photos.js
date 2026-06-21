// ============================================================
// PHOTOS MODULE
// Пул фото для головної сторінки (полароїд-стіна).
// При кожному вході завантажується список з Supabase Storage,
// обирається 7 випадкових без повторів і розкидається по картках.
// reloadPool() — викликається з Settings після upload/delete
// ============================================================

const Photos = (() => {

  const STORAGE_BASE = 'https://yicalgoqegluzuagxssk.supabase.co/storage/v1/object/public/family_photos';
  const BUCKET = 'family_photos';

  let _pool = null; // null = ще не завантажено

  // ---------- Завантаження пулу зі Storage ----------
  async function fetchPool() {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data || !data.length) {
      console.warn('Photos: не вдалось завантажити список фото або бакет порожній', error);
      return [];
    }

    return data
      .filter(f => f.name && /\.(jpe?g|png|webp|gif)$/i.test(f.name))
      .map(f => `${STORAGE_BASE}/${f.name}`);
  }

  // ---------- Перемішування (Fisher-Yates) ----------
  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // ---------- Вибрати N фото ----------
  function pickPhotos(pool, needed) {
    if (!pool.length) return [];
    let picks;
    if (pool.length >= needed) {
      picks = shuffle(pool).slice(0, needed);
    } else {
      picks = shuffle(pool);
      while (picks.length < needed) picks = picks.concat(shuffle(pool));
      picks = picks.slice(0, needed);
    }
    return picks;
  }

  // ---------- Анімований рендер ----------
  // ВАЖЛИВО: НЕ використовуємо style.transform в inline стилях.
  // CSS-правило [style*="transform"] { transition: none !important }
  // вбивало б анімацію. Тому — тільки opacity + plавний stagger.
  async function render(pool) {
    const images    = document.querySelectorAll('.polaroid-photo img[data-photo-slot]');
    const polaroids = document.querySelectorAll('.polaroid');
    if (!images.length) return;

    const picks = pickPhotos(pool, images.length);
    if (!picks.length) return;

    const STAGGER  = 90;
    const FADE_OUT = 200;
    const FADE_IN  = 480;

    // 1. Staggered fade-out — тільки opacity
    polaroids.forEach((p, i) => {
      setTimeout(() => {
        p.style.transition = `opacity ${FADE_OUT}ms ease`;
        p.style.opacity = '0';
      }, i * STAGGER);
    });

    const totalOut = FADE_OUT + (polaroids.length - 1) * STAGGER + 80;

    // 2. Після fade-out: міняємо src і ЧЕКАЄМО реального завантаження
    await new Promise(r => setTimeout(r, totalOut));

    images.forEach((img, i) => {
      img.style.transition = 'none';
      img.loading = 'eager';
      img.src = picks[i] || img.src;
    });

    // Чекаємо поки КОЖНЕ фото завантажиться (або timeout 3с)
    await Promise.all(Array.from(images).map(img =>
      new Promise(resolve => {
        if (img.complete && img.naturalWidth > 0) { resolve(); return; }
        const done = () => { img.onload = img.onerror = null; resolve(); };
        img.onload  = done;
        img.onerror = done;
        setTimeout(done, 3000);
      })
    ));

    // 3. Плавний staggered fade-in — фото вже готові, без snap-ів
    polaroids.forEach((p, i) => {
      setTimeout(() => {
        p.style.transition = `opacity ${FADE_IN}ms ease`;
        p.style.opacity = '1';
        // Знімаємо inline transition після завершення — CSS знову керує
        setTimeout(() => { p.style.transition = ''; }, FADE_IN + 60);
      }, i * STAGGER);
    });
  }

  // ---------- Публічний: перезавантажити пул і перерисувати ----------
  async function reloadPool() {
    _pool = await fetchPool();
    render(_pool);
  }

  // ---------- Init ----------
  function init() {
    window.addEventListener('portal:auth', async () => {
      if (_pool === null) {
        _pool = await fetchPool();
      }
      render(_pool);
    });
  }

  return { init, reloadPool, render: (pool) => render(pool !== undefined ? pool : (_pool || [])) };
})();
