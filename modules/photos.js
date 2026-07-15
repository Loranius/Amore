// ============================================================
// PHOTOS MODULE
// Хмарка левітуючих фото навколо лічильника на головній.
// При вході завантажується список з Supabase Storage,
// 6 випадкових без повторів розкидаються по слотах.
// Тап по фото — заміна на наступне з колоди (без повторів,
// поки не покажемо весь пул). reloadPool() — із Settings.
// ============================================================

const Photos = (() => {

  const STORAGE_BASE = 'https://yicalgoqegluzuagxssk.supabase.co/storage/v1/object/public/family_photos';
  const BUCKET = 'family_photos';

  /** @type {string[] | null} */
  let _pool = null; // null = ще не завантажено

  // ---------- Завантаження пулу зі Storage ----------
  /** @returns {Promise<string[]>} */
  async function fetchPool() {
    const { data, error } = /** @type {SupaResult<StorageFile[]>} */ (await supabase.storage
      .from(BUCKET)
      .list('', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } }));

    if (error || !data || !data.length) {
      console.warn('Photos: не вдалось завантажити список фото або бакет порожній', error);
      return [];
    }

    return data
      .filter(f => f.name && /\.(jpe?g|png|webp|gif)$/i.test(f.name))
      .map(f => `${STORAGE_BASE}/${f.name}`);
  }

  // ---------- Перемішування (Fisher-Yates) ----------
  /** @template T @param {T[]} arr @returns {T[]} */
  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // ---------- Вибрати N фото ----------
  /** @param {string[]} pool @param {number} needed @returns {string[]} */
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
  /** @param {string[]} pool @returns {Promise<void>} */
  async function render(pool) {
    const images    = /** @type {NodeListOf<HTMLImageElement>} */ (document.querySelectorAll('.float-photo img[data-photo-slot]'));
    const polaroids = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.float-photo'));
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
      /** @type {Promise<void>} */ (new Promise(resolve => {
        const newSrc = picks[i] || img.src;
        if (img.src === newSrc && img.complete && img.naturalWidth > 0) { resolve(); return; }
        const done = () => { img.onload = img.onerror = null; resolve(); };
        img.onload  = done;
        img.onerror = done;
        setTimeout(done, 3000);
        img.src = newSrc;
      }))
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

  // ---------- Колода для тап-свапу (без повторів) ----------
  /** @type {string[]} */
  let deck = [];
  let deckIdx = 0;

  /** @returns {Set<string>} */
  function currentShown() {
    return new Set(
      [.../** @type {NodeListOf<HTMLImageElement>} */ (document.querySelectorAll('.float-photo img[data-photo-slot]'))]
        .map(i => i.src).filter(Boolean)
    );
  }

  function rebuildDeck() {
    const shown = currentShown();
    deck = shuffle((_pool || []).filter(u => !shown.has(u)));
    deckIdx = 0;
  }

  // Наступне фото, якого зараз немає на екрані; null — якщо пул ≤ 6
  /** @returns {string | null} */
  function nextPhoto() {
    if (!_pool || _pool.length <= document.querySelectorAll('.float-photo').length) return null;
    const shown = currentShown();
    for (let attempts = 0; attempts < 2; attempts++) {
      while (deckIdx < deck.length) {
        const cand = deck[deckIdx++];
        if (!shown.has(cand)) return cand;
      }
      rebuildDeck(); // колода скінчилась — тасуємо все, що не на екрані
    }
    return null;
  }

  // ---------- Тап по фото: свап на наступне ----------
  function bindTapSwap() {
    document.querySelectorAll('.float-photo').forEach(fp => {
      fp.addEventListener('click', () => {
        const img = fp.querySelector('img');
        const next = nextPhoto();
        if (!img || !next) return;

        // Прелоад, потім анімована заміна (scale+fade на img,
        // щоб не конфліктувати з keyframes левітації на контейнері)
        const pre = new Image();
        const doSwap = () => {
          img.style.transition = 'opacity .16s ease, transform .16s ease';
          img.style.opacity = '0';
          img.style.transform = 'scale(.82) rotate(-5deg)';
          setTimeout(() => {
            img.src = next;
            requestAnimationFrame(() => {
              img.style.opacity = '1';
              img.style.transform = '';
              setTimeout(() => { img.style.transition = ''; }, 200);
            });
          }, 160);
        };
        pre.onload = doSwap;
        pre.onerror = () => {}; // биту URL просто пропускаємо
        pre.src = next;
      });
    });
  }

  // ---------- Публічний: перезавантажити пул і перерисувати ----------
  /** @returns {Promise<void>} */
  async function reloadPool() {
    _pool = await fetchPool();
    rebuildDeck();
    render(_pool);
  }

  // ---------- Init ----------
  function init() {
    bindTapSwap();
    window.addEventListener('portal:auth', async () => {
      if (_pool === null) {
        _pool = await fetchPool();
        rebuildDeck();
      }
      render(_pool);
    });
  }

  return { init, reloadPool, render: async (/** @type {string[] | undefined} */ pool = undefined) => {
    if (pool !== undefined) return render(pool);
    if (_pool === null) _pool = await fetchPool();
    return render(_pool);
  }};
})();
