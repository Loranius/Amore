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

  // Кеш URL завантажених з бакету
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

  // ---------- Вибрати N фото з пулу ----------
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
  async function render(pool) {
    const images   = document.querySelectorAll('.polaroid-photo img[data-photo-slot]');
    const polaroids = document.querySelectorAll('.polaroid');
    if (!images.length) return;

    const picks = pickPhotos(pool, images.length);

    if (!picks.length) return;

    const STAGGER  = 60;
    const FADE_OUT = 200;
    const FADE_IN  = 360;

    // 1. Staggered fade out
    polaroids.forEach((p, i) => {
      setTimeout(() => {
        p.style.transition = `opacity ${FADE_OUT}ms ease, transform ${FADE_OUT}ms ease`;
        p.style.opacity = '0';
        p.style.transform = (p.style.transform || '') + ' scale(0.93)';
      }, i * STAGGER);
    });

    const totalOut = FADE_OUT + (polaroids.length - 1) * STAGGER + 40;

    // 2. Міняємо src після fade-out, без примусового preload
    setTimeout(() => {
      images.forEach((img, i) => {
        img.style.transition = 'none';
        img.src = picks[i] || img.src;
        img.loading = 'lazy';
      });

      polaroids.forEach((p, i) => {
        setTimeout(() => {
          p.style.transition = `opacity ${FADE_IN}ms ease, transform ${FADE_IN}ms cubic-bezier(.34,1.35,.64,1)`;
          p.style.opacity = '1';
          p.style.transform = '';
        }, i * STAGGER);
      });
    }, totalOut);
  }

  // ---------- Публічний метод: перезавантажити пул і перерисувати ----------
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
