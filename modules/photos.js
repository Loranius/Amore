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
  async function render(pool) {
    const images    = document.querySelectorAll('.polaroid-photo img[data-photo-slot]');
    const polaroids = document.querySelectorAll('.polaroid');
    if (!images.length) return;

    const picks = pickPhotos(pool, images.length);
    if (!picks.length) {
      // Пул порожній — просто показуємо полароїди (з поточними фото або placeholder)
      polaroids.forEach(p => { p.style.opacity = '1'; });
      return;
    }

    const STAGGER  = 65;
    const FADE_OUT = 160;
    const FADE_IN  = 400;

    // Перевіряємо чи полароїди вже видимі (не перший рендер)
    const alreadyVisible = parseFloat(polaroids[0].style.opacity) > 0.1;

    if (alreadyVisible) {
      // 1. Staggered fade-out
      polaroids.forEach((p, i) => {
        setTimeout(() => {
          p.style.transition = `opacity ${FADE_OUT}ms ease`;
          p.style.opacity = '0';
        }, i * STAGGER);
      });
      await new Promise(r => setTimeout(r, FADE_OUT + (polaroids.length - 1) * STAGGER + 50));
    } else {
      // Перший рендер — ставимо opacity:0 щоб підготуватись до fade-in
      polaroids.forEach(p => { p.style.opacity = '0'; });
    }

    // 2. Міняємо src і чекаємо реального завантаження (перш ніж показати)
    images.forEach(img => { img.loading = 'eager'; });

    await Promise.all(Array.from(images).map((img, i) =>
      new Promise(resolve => {
        const newSrc = picks[i] || img.src;
        if (img.src === newSrc && img.complete && img.naturalWidth > 0) { resolve(); return; }
        const done = () => { img.onload = img.onerror = null; resolve(); };
        img.onload  = done;
        img.onerror = done;
        setTimeout(done, 3000);
        img.src = newSrc;
      })
    ));

    // 3. Staggered fade-in з легким підйомом
    polaroids.forEach((p, i) => {
      setTimeout(() => {
        p.style.transition = `opacity ${FADE_IN}ms cubic-bezier(.25,.8,.25,1), transform ${FADE_IN}ms cubic-bezier(.25,.8,.25,1)`;
        p.style.opacity    = '0';
        p.style.transform  = 'translateY(12px)';

        requestAnimationFrame(() => requestAnimationFrame(() => {
          p.style.opacity   = '1';
          p.style.transform = '';
          // Після завершення анімації — прибираємо transition, але opacity:1 ЗАЛИШАЄМО
          setTimeout(() => {
            p.style.transition = '';
          }, FADE_IN + 80);
        }));
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

  return { init, reloadPool, render: async (pool) => {
    if (pool !== undefined) return render(pool);
    if (_pool === null) _pool = await fetchPool();
    return render(_pool);
  }};
})();
